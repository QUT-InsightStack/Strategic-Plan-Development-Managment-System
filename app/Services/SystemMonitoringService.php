<?php

namespace App\Services;

use App\Models\Backup;
use App\Models\LoginHistory;
use App\Models\SystemCheck;
use App\Models\SystemRequest;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\Log;
use Throwable;

class SystemMonitoringService
{
    public function __construct(private readonly SystemHealthService $health) {}

    public function recordRequest(array $data): void
    {
        $slow = $data['duration_ms'] >= config('monitoring.slow_request_ms')
            || $data['db_duration_ms'] >= config('monitoring.slow_database_ms');
        if ($data['status_code'] >= 400 || $slow) {
            app(SystemEventRecorder::class)->record(
                $data['status_code'] >= 400 ? 'http.error' : 'http.slow_request', 'http',
                $data['status_code'] >= 500 ? 'error' : 'warning',
                $data['status_code'] >= 400 ? 'failure' : 'success', $data);
        }
        try {
            SystemRequest::create($data);
        } catch (Throwable $exception) {
            $this->fallback('Unable to store system request metrics.', [
                'request_id' => $data['request_id'],
                'route' => $data['route'],
                'status_code' => $data['status_code'],
                'duration_ms' => $data['duration_ms'],
                'db_duration_ms' => $data['db_duration_ms'],
                'storage_exception_type' => $exception::class,
            ]);
        }
    }

    public function summary(int $minutes, ?CarbonInterface $from = null, ?CarbonInterface $to = null): array
    {
        $end = $to ?? now();
        $start = $from ?? $end->copy()->subMinutes($minutes);
        $totals = SystemRequest::whereBetween('occurred_at', [$start, $end])
            ->selectRaw('COUNT(*) AS requests, '
                .'SUM(CASE WHEN status_code >= 500 THEN 1 ELSE 0 END) AS server_errors, '
                .'SUM(CASE WHEN status_code >= 400 AND status_code < 500 THEN 1 ELSE 0 END) AS client_errors, '
                .'SUM(CASE WHEN duration_ms >= ? THEN 1 ELSE 0 END) AS slow_requests, '
                .'SUM(CASE WHEN db_duration_ms >= ? THEN 1 ELSE 0 END) AS slow_database_requests, '
                .'AVG(duration_ms) AS average_duration_ms, MAX(duration_ms) AS max_duration_ms, '
                .'AVG(db_duration_ms) AS average_db_duration_ms, SUM(db_query_count) AS db_queries', [
                    config('monitoring.slow_request_ms'), config('monitoring.slow_database_ms'),
                ])->first();
        $requests = (int) $totals->requests;

        return [
            'from' => $start->toIso8601String(),
            'to' => $end->toIso8601String(),
            'window_minutes' => (int) $start->diffInMinutes($end),
            'requests' => $requests,
            'server_errors' => (int) $totals->server_errors,
            'client_errors' => (int) $totals->client_errors,
            'error_rate_percent' => $requests ? round(100 * $totals->server_errors / $requests, 2) : 0.0,
            'slow_requests' => (int) $totals->slow_requests,
            'slow_database_requests' => (int) $totals->slow_database_requests,
            'average_duration_ms' => round((float) $totals->average_duration_ms, 2),
            'max_duration_ms' => round((float) $totals->max_duration_ms, 2),
            'average_db_duration_ms' => round((float) $totals->average_db_duration_ms, 2),
            'db_queries' => (int) $totals->db_queries,
            'failed_logins' => LoginHistory::where('status', 'failed')->whereBetween('attempted_at', [$start, $end])->count(),
            'failed_backups' => Backup::where('status', 'failed')->whereBetween('created_at', [$start, $end])->count(),
            'thresholds' => [
                'slow_request_ms' => config('monitoring.slow_request_ms'),
                'slow_database_ms' => config('monitoring.slow_database_ms'),
            ],
        ];
    }

    public function runCheck(): array
    {
        $health = $this->health->check();
        $issues = [];
        foreach ($health['checks'] as $component => $check) {
            if (in_array($check['status'], ['unhealthy', 'warning', 'unsupported'], true)) {
                $issues[] = $component.'.'.$check['status'];
            }
        }

        $metrics = null;
        try {
            $metrics = $this->summary(config('monitoring.window_minutes'));
            if ($metrics['requests'] >= config('monitoring.minimum_requests')
                && $metrics['error_rate_percent'] >= config('monitoring.error_rate_percent')) {
                $issues[] = 'http.high_error_rate';
            }
            if ($metrics['slow_requests'] > 0) {
                $issues[] = 'http.slow_requests';
            }
            if ($metrics['slow_database_requests'] > 0) {
                $issues[] = 'database.slow_requests';
            }
            if ($metrics['failed_logins'] >= config('monitoring.failed_login_threshold')) {
                $issues[] = 'auth.repeated_failures';
            }
            if ($metrics['failed_backups'] > 0) {
                $issues[] = 'backup.failed';
            }
            $consecutive = LoginHistory::where('status', 'failed')
                ->whereBetween('attempted_at', [now()->subMinutes(config('monitoring.window_minutes')), now()])
                ->whereNotExists(function ($query): void {
                    $query->selectRaw('1')->from('tbllogin_history as success')
                        ->whereColumn('success.email', 'tbllogin_history.email')->where('success.status', 'success')
                        ->whereColumn('success.login_history_id', '>', 'tbllogin_history.login_history_id')
                        ->where('success.attempted_at', '<=', now());
                })->groupBy('email')->havingRaw('COUNT(*) >= ?', [config('monitoring.consecutive_login_threshold')])->exists();
            if ($consecutive) {
                $issues[] = 'auth.consecutive_failures';
            }
        } catch (Throwable) {
            $metrics = null;
            $issues[] = 'metrics.unavailable';
        }

        $result = [
            'status' => $health['status'] === 'unhealthy' || $metrics === null ? 'critical'
                : ($issues ? 'warning' : 'healthy'),
            'checked_at' => now()->toIso8601String(),
            'health' => $health,
            'metrics' => $metrics,
            'issues' => $issues,
        ];

        try {
            $previous = SystemCheck::orderByDesc('id')->first();
            $snapshot = SystemCheck::create($result);
            $result['persisted'] = true;
        } catch (Throwable) {
            $result['persisted'] = false;
            $result['status'] = 'critical';
            $result['issues'][] = 'monitoring.storage_unavailable';
            $this->fallback('System monitoring check could not be stored.', [
                'status' => $result['status'], 'issues' => $result['issues'],
            ]);

            return $result;
        }

        try {
            app(SystemAlertService::class)->reconcile($issues, $metrics !== null);
            app(SystemTrendService::class)->aggregateHour(now()->subHour());
            app(SystemTrendService::class)->aggregateHour(now());
        } catch (Throwable) {
            $result['status'] = 'critical';
            $result['issues'][] = 'monitoring.processing_failed';
            try {
                $snapshot->update(['status' => $result['status'], 'issues' => $result['issues']]);
            } catch (Throwable) {
                $result['persisted'] = false;
            }
            $this->fallback('System alert or trend processing failed.', ['issues' => $result['issues']]);
        }
        $issues = $result['issues'];

        // A logging-channel failure must not misreport a successfully saved check.
        if (($previous && ($previous->issues !== $issues || $previous->status !== $result['status']))
            || (! $previous && $issues)) {
            $context = ['status' => $result['status'], 'issues' => $issues];
            try {
                Log::log($issues ? 'warning' : 'info', 'System monitoring status changed.', $context);
            } catch (Throwable) {
                $this->fallback('System monitoring status changed.', $context);
            }
        }

        return $result;
    }

    private function fallback(string $message, array $context): void
    {
        try {
            Log::channel('stderr')->warning($message, $context);
        } catch (Throwable) {
            error_log($message);
        }
    }
}
