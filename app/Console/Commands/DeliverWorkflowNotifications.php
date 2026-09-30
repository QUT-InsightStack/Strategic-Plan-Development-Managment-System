<?php

namespace App\Console\Commands;

use App\Models\WorkflowNotification;
use App\Services\WorkflowNotificationService;
use Illuminate\Console\Command;

class DeliverWorkflowNotifications extends Command
{
    protected $signature = 'workflow:deliver-notifications';

    protected $description = 'Publish pending workflow notifications and retry failed deliveries';

    public function handle(WorkflowNotificationService $service): int
    {
        $sent = 0;
        WorkflowNotification::whereIn('status', ['pending', 'failed'])
            ->where('attempts', '<', WorkflowNotificationService::MAX_ATTEMPTS)
            ->where(fn ($query) => $query->whereNull('next_attempt_at')->orWhere('next_attempt_at', '<=', now()))
            ->chunkById(100, function ($notifications) use ($service, &$sent) {
                foreach ($notifications as $notification) {
                    $sent += (int) $service->deliver($notification->id);
                }
            });
        $this->info("Published {$sent} workflow notification(s).");

        return self::SUCCESS;
    }
}
