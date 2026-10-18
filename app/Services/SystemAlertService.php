<?php

namespace App\Services;

use App\Models\SystemAlert;
use App\Notifications\SystemAlertNotification;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;

class SystemAlertService
{
    public function reconcile(array $issues, bool $metricsAvailable): void
    {
        DB::transaction(function () use ($issues, $metricsAvailable): void {
            foreach ($issues as $condition) {
                $created = DB::table('tblsystem_alerts')->insertOrIgnore([
                    'condition' => $condition, 'active_key' => $condition,
                    'severity' => str_contains($condition, 'unhealthy') || $condition === 'metrics.unavailable' ? 'critical' : 'warning',
                    'status' => 'open', 'occurrences' => 1, 'opened_at' => now(), 'last_seen_at' => now(),
                ]);
                $alert = SystemAlert::where('active_key', $condition)->lockForUpdate()->firstOrFail();
                if (! $created) {
                    $alert->increment('occurrences');
                    $alert->update(['last_seen_at' => now()]);
                } else {
                    $this->event($alert, false);
                }
            }
            foreach (SystemAlert::where('status', 'open')->whereNotIn('condition', $issues)->lockForUpdate()->get() as $alert) {
                if (! $metricsAvailable && in_array($alert->condition, [
                    'http.high_error_rate', 'http.slow_requests', 'database.slow_requests',
                    'auth.repeated_failures', 'auth.consecutive_failures', 'backup.failed',
                ], true)) {
                    continue; // Missing evidence is not recovery.
                }
                $alert->update(['active_key' => null, 'status' => 'resolved', 'resolved_at' => now(), 'last_seen_at' => now()]);
                $this->event($alert, true);
            }
        });

        if (! config('monitoring.mail_enabled') || ! config('monitoring.mail_to')) {
            return;
        }
        // Retry unsent transitions on subsequent checks. A provider accepting mail
        // immediately before a crash can cause a duplicate (at-least-once delivery).
        SystemAlert::where(function ($query): void {
            $query->whereNull('opening_notified_at')->orWhere(function ($query): void {
                $query->where('status', 'resolved')->whereNull('recovery_notified_at');
            });
        })->orderBy('id')->chunkById(100, function ($alerts): void {
            foreach ($alerts as $candidate) {
                try {
                    DB::transaction(function () use ($candidate): void {
                        $alert = SystemAlert::lockForUpdate()->findOrFail($candidate->id);
                        foreach ([false, true] as $recovered) {
                            $field = $recovered ? 'recovery_notified_at' : 'opening_notified_at';
                            if ($alert->$field || ($recovered && $alert->status !== 'resolved')) {
                                continue;
                            }
                            Notification::route('mail', config('monitoring.mail_to'))
                                ->notify(new SystemAlertNotification($alert, $recovered));
                            $alert->update([$field => now()]);
                        }
                    });
                } catch (\Throwable) {
                    app(SystemEventRecorder::class)->record('monitoring.notification_failed', 'monitoring', 'error', 'failure', ['alert_id' => $candidate->id]);
                }
            }
        });
    }

    private function event(SystemAlert $alert, bool $recovered): void
    {
        $source = explode('.', $alert->condition)[0];
        app(SystemEventRecorder::class)->record($recovered ? 'alert.resolved' : 'alert.opened', $source,
            $recovered ? 'info' : $alert->severity, $recovered ? 'success' : 'failure', [
                'alert_id' => $alert->id, 'condition' => $alert->condition, 'status' => $alert->status,
            ]);
    }
}
