<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class ArchiveActivity extends Command
{
    protected $signature = 'monitoring:archive';

    protected $description = 'Archive audits and login history according to the configured retention policy';

    public function handle(): int
    {
        $archived = 0;
        foreach ([
            ['tbllog', 'log_id', 'created_at', 'audit_archive_days'],
            ['tbllogin_history', 'login_history_id', 'attempted_at', 'login_archive_days'],
        ] as [$table, $key, $time, $policy]) {
            $days = (int) config('monitoring.'.$policy);
            if ($days <= 0) {
                continue;
            }
            $cutoff = now()->subDays($days)->startOfDay();
            do {
                $count = DB::transaction(function () use ($table, $key, $time, $cutoff): int {
                    $rows = DB::table($table)->where($time, '<', $cutoff)->orderBy($key)->limit(500)->lockForUpdate()->get();
                    foreach ($rows as $row) {
                        // Insert must succeed before deletion. Duplicate/conflicting archive
                        // IDs abort the batch instead of silently losing the online record.
                        DB::table('tblaudit_archives')->insert([
                            'source' => $table, 'original_id' => $row->$key,
                            'record' => json_encode($row, JSON_THROW_ON_ERROR),
                            'occurred_at' => $row->$time, 'archived_at' => now(),
                        ]);
                    }
                    DB::table($table)->whereIn($key, $rows->pluck($key))->delete();

                    return $rows->count();
                });
                $archived += $count;
            } while ($count === 500);
        }
        $this->info("Archived $archived records; archived copies are retained indefinitely.");

        return self::SUCCESS;
    }
}
