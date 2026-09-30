<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class ExplainMonitoringQueries extends Command
{
    protected $signature = 'monitoring:explain';

    protected $description = 'Show read-only query plans for monitoring and audit time filters';

    public function handle(): int
    {
        $prefix = DB::getDriverName() === 'sqlite' ? 'EXPLAIN QUERY PLAN ' : 'EXPLAIN ';
        foreach ([
            ['SELECT * FROM tblsystem_events WHERE severity = ? AND occurred_at >= ? AND occurred_at <= ? ORDER BY occurred_at DESC, id DESC LIMIT 25', ['error', now()->subHour(), now()]],
            ['SELECT * FROM tblsystem_events WHERE source = ? AND occurred_at >= ? AND occurred_at <= ? ORDER BY occurred_at DESC, id DESC LIMIT 25', ['http', now()->subHour(), now()]],
            ['SELECT * FROM tbllog WHERE created_at >= ? AND created_at < ? ORDER BY created_at DESC, log_id DESC LIMIT 25', [now()->subDay(), now()]],
        ] as [$sql, $bindings]) {
            $this->line($sql);
            $this->line(json_encode(DB::select($prefix.$sql, $bindings), JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR));
        }

        return self::SUCCESS;
    }
}
