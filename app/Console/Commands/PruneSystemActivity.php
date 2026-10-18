<?php

namespace App\Console\Commands;

use App\Services\SystemTrendService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class PruneSystemActivity extends Command
{
    protected $signature = 'monitoring:prune';

    protected $description = 'Prune expired operational metrics and health snapshots';

    public function handle(): int
    {
        // Aggregate every expired raw bucket before deleting any requests.
        app(SystemTrendService::class)->aggregateBefore(
            now()->subDays(max(1, (int) config('monitoring.request_retention_days')))->startOfDay());
        $deleted = 0;
        foreach ([
            ['tblsystem_requests', 'occurred_at', 'request_retention_days'],
            ['tblsystem_checks', 'checked_at', 'check_retention_days'],
            ['tblsystem_events', 'occurred_at', 'event_retention_days'],
            ['tblsystem_metrics', 'bucket_at', 'trend_retention_days'],
            ['tblsystem_alerts', 'resolved_at', 'resolved_alert_retention_days'],
        ] as [$table, $column, $retention]) {
            $cutoff = now()->subDays(max(1, (int) config("monitoring.$retention")))->startOfDay();
            do {
                $ids = DB::table($table)->where($column, '<', $cutoff)->orderBy('id')->limit(1000)->pluck('id');
                $deleted += DB::table($table)->whereIn('id', $ids)->delete();
            } while ($ids->count() === 1000);
        }
        $this->info("Pruned $deleted operational records.");
        if ($this->call('monitoring:archive') !== self::SUCCESS) {
            return self::FAILURE;
        }

        return self::SUCCESS;
    }
}
