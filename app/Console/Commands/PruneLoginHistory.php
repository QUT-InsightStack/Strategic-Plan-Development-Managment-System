<?php

namespace App\Console\Commands;

use App\Services\LoginHistoryService;
use Illuminate\Console\Command;

/**
 * Login history ties a named person to an IP address and a time, so it is
 * personal data and should not be kept forever. Schedule this, or run it by
 * hand, to enforce a retention period.
 */
class PruneLoginHistory extends Command
{
    protected $signature = 'login-history:prune
                            {--days=90 : Delete entries older than this many days}';

    protected $description = 'Delete login history entries older than the retention period';

    public function handle(LoginHistoryService $loginHistory): int
    {
        $days = (int) $this->option('days');

        if ($days < 1) {
            $this->error('The retention period must be at least one day.');

            return self::FAILURE;
        }

        $deleted = $loginHistory->prune($days);

        $this->info("Removed {$deleted} login history entries older than {$days} days.");

        return self::SUCCESS;
    }
}
