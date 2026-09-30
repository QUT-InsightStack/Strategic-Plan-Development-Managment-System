<?php

namespace App\Console\Commands;

use App\Services\SystemMonitoringService;
use Illuminate\Console\Command;

class CheckSystemActivity extends Command
{
    protected $signature = 'monitoring:check';

    protected $description = 'Collect dependency health and detect operational issues';

    public function handle(SystemMonitoringService $monitoring): int
    {
        if (! config('monitoring.enabled')) {
            $this->info('System monitoring is disabled.');

            return self::SUCCESS;
        }

        $result = $monitoring->runCheck();
        $this->line(json_encode($result, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR));

        return $result['status'] === 'healthy' ? self::SUCCESS : self::FAILURE;
    }
}
