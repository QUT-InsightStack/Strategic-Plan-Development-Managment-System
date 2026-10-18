<?php

namespace App\Services;

use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;

class SystemTrendService
{
    public function aggregateHour(CarbonInterface $hour, bool $finalize = false): void
    {
        $start = $hour->copy()->startOfHour();
        // A crashed prune may have removed only part of an hour. Never replace
        // that hour's complete aggregate with the remaining partial raw data.
        if (DB::table('tblsystem_metrics')->where('bucket_at', $start)->where('finalized', true)->exists()) {
            return;
        }
        $row = DB::table('tblsystem_requests')->where('occurred_at', '>=', $start)
            ->where('occurred_at', '<', $start->copy()->addHour())
            ->selectRaw('COUNT(*) AS requests, SUM(CASE WHEN status_code >= 500 THEN 1 ELSE 0 END) AS server_errors,
                SUM(CASE WHEN status_code >= 400 AND status_code < 500 THEN 1 ELSE 0 END) AS client_errors,
                SUM(duration_ms) AS duration_ms, MAX(duration_ms) AS max_duration_ms,
                SUM(db_duration_ms) AS db_duration_ms, SUM(db_query_count) AS db_queries')->first();
        // Do not overwrite previously aggregated history after raw data was pruned.
        if (! $row->requests) {
            return;
        }
        DB::table('tblsystem_metrics')->updateOrInsert(['bucket_at' => $start], [...(array) $row, 'finalized' => $finalize]);
    }

    public function aggregateBefore(CarbonInterface $cutoff): void
    {
        $oldest = DB::table('tblsystem_requests')->where('occurred_at', '<', $cutoff)->min('occurred_at');
        if (! $oldest) {
            return;
        }
        while ($oldest !== null) {
            $hour = CarbonImmutable::parse($oldest)->startOfHour();
            $this->aggregateHour($hour, true);
            $oldest = DB::table('tblsystem_requests')->where('occurred_at', '>=', $hour->addHour())
                ->where('occurred_at', '<', $cutoff)->min('occurred_at');
        }
    }
}
