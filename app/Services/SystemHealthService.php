<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;
use Throwable;

class SystemHealthService
{
    public function check(): array
    {
        $checks = [
            'database' => $this->probe(function (): array {
                DB::select('SELECT 1');

                return [];
            }),
            'cache' => $this->probe(function (): array {
                $key = 'system-health:'.Str::uuid();
                try {
                    Cache::put($key, 'ok', 60);
                    if (Cache::get($key) !== 'ok') {
                        throw new RuntimeException('Cache round-trip failed.');
                    }
                } finally {
                    Cache::forget($key);
                }

                return [];
            }),
            'storage' => $this->probe(function (): array {
                if (! is_dir(storage_path('app')) || ! is_writable(storage_path('app'))) {
                    throw new RuntimeException('Application storage is not writable.');
                }
                $disk = Storage::disk();
                $key = '.health/'.Str::uuid();
                try {
                    if (! $disk->put($key, 'ok') || $disk->get($key) !== 'ok') {
                        throw new RuntimeException('Storage round-trip failed.');
                    }
                } finally {
                    $disk->delete($key);
                }

                return ['disk' => config('filesystems.default')];
            }),
            'queue' => $this->probe(fn (): array => $this->queue()),
        ];

        $statuses = array_column($checks, 'status');

        return [
            'status' => in_array('unhealthy', $statuses, true) ? 'unhealthy'
                : (array_intersect(['warning', 'unsupported'], $statuses) ? 'warning' : 'healthy'),
            'checked_at' => now()->toIso8601String(),
            'checks' => $checks,
        ];
    }

    private function probe(callable $check): array
    {
        $started = hrtime(true);
        try {
            $result = ['status' => 'healthy', ...$check()];
        } catch (Throwable) {
            // Dependency errors may contain credentials or SQL. Never return them.
            $result = ['status' => 'unhealthy'];
        }

        return [...$result, 'duration_ms' => round((hrtime(true) - $started) / 1e6, 2)];
    }

    private function queue(): array
    {
        $connection = config('queue.default');
        $settings = config("queue.connections.$connection", []);
        $driver = $settings['driver'] ?? 'unknown';
        if (in_array($driver, ['sync', 'null', 'deferred', 'background'], true)) {
            return ['status' => 'not_applicable', 'driver' => $driver];
        }
        if ($driver !== 'database') {
            return ['status' => 'unsupported', 'driver' => $driver];
        }

        $queue = $settings['queue'] ?? 'default';
        $jobs = DB::connection($settings['connection'] ?? null)
            ->table($settings['table'] ?? 'jobs')->where('queue', $queue);
        $ready = (clone $jobs)->where('available_at', '<=', now()->timestamp)
            ->where(function ($query) use ($settings): void {
                $query->whereNull('reserved_at')
                    ->orWhere('reserved_at', '<=', now()->timestamp - ($settings['retry_after'] ?? 90));
            });
        $readyCount = (clone $ready)->count();
        $oldest = (clone $ready)->min('available_at');
        $wait = $oldest === null ? 0 : max(0, now()->timestamp - (int) $oldest);
        $failed = null;
        if (in_array(config('queue.failed.driver'), ['database', 'database-uuids'], true)) {
            $failed = DB::connection(config('queue.failed.database'))
                ->table(config('queue.failed.table', 'failed_jobs'))
                ->where('connection', $connection)->where('queue', $queue)
                ->where('failed_at', '>=', now()->subMinutes(config('monitoring.window_minutes')))
                ->where('failed_at', '<=', now())->count();
        }

        return [
            'status' => $readyCount >= config('monitoring.queue_backlog_threshold')
                || $wait >= config('monitoring.queue_wait_seconds') || $failed > 0 ? 'warning' : 'healthy',
            'driver' => $driver,
            'queue' => $queue,
            'total_jobs' => (clone $jobs)->count(),
            'ready_jobs' => $readyCount,
            'oldest_ready_seconds' => $wait,
            'failed_jobs_in_window' => $failed,
        ];
    }
}
