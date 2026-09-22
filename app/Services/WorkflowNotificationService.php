<?php

namespace App\Services;

use App\Models\PlanSubmission;
use App\Models\PlanSubmissionStage;
use App\Models\PlanWorkflowHistory;
use App\Models\WorkflowNotification;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Throwable;

class WorkflowNotificationService
{
    public const MAX_ATTEMPTS = 5;

    public function recordEvent(PlanWorkflowHistory $event, PlanSubmission $submission, ?PlanSubmissionStage $next = null): void
    {
        // Persist intent inside the workflow transaction. Only committed events are published.
        $stage = $submission->stages()->findOrFail($event->stage_id);
        $recipients = $stage->reviewers()->pluck('tblusers.user_id')->push($submission->submitted_by);
        if ($next) {
            $recipients = $recipients->concat($next->reviewers()->pluck('tblusers.user_id'));
        }
        $ids = [];
        foreach ($recipients->unique() as $recipientId) {
            $notification = WorkflowNotification::firstOrCreate([
                'event_id' => $event->id, 'recipient_id' => $recipientId,
            ], [
                'submission_id' => $submission->id, 'plan_id' => $submission->plan_id,
                'payload' => [
                    'action' => $event->action, 'title' => $submission->plan_snapshot['title'],
                    'actor' => $event->actor_name, 'stage' => $stage->name,
                    'next_stage' => $next?->name, 'comment' => $event->comment,
                    'url' => '/strategic-plans/'.$submission->plan_id.'/approval-status',
                ],
            ]);
            if ($notification->status === 'pending') {
                $ids[] = $notification->id;
            }
        }
        DB::afterCommit(function () use ($ids): void {
            foreach ($ids as $id) {
                $this->deliver($id);
            }
        });
    }

    public function deliver(int $id): bool
    {
        try {
            return DB::transaction(function () use ($id) {
                $notification = WorkflowNotification::lockForUpdate()->findOrFail($id);
                if ($notification->status === 'sent') {
                    return true;
                }
                if ($notification->attempts >= self::MAX_ATTEMPTS || $notification->next_attempt_at?->isFuture()) {
                    return false;
                }
                $notification->attempts++;
                try {
                    $this->publish($notification);
                    $notification->forceFill(['status' => 'sent', 'sent_at' => now(), 'last_error' => null, 'next_attempt_at' => null]);
                } catch (Throwable $exception) {
                    $notification->forceFill([
                        'status' => 'failed', 'last_error' => 'Notification delivery failed.',
                        'next_attempt_at' => now()->addMinutes(2 ** ($notification->attempts - 1)),
                    ]);
                    $this->logFailure($id, $exception);
                }
                $notification->save();

                return $notification->status === 'sent';
            });
        } catch (Throwable $exception) {
            // A database outage leaves the durable pending/failed row for the scheduled retry.
            // It must never turn a committed approval action into an HTTP failure.
            $this->logFailure($id, $exception);

            return false;
        }
    }

    protected function publish(WorkflowNotification $notification): void
    {
        if ($notification->recipient?->status !== 'active') {
            throw new \RuntimeException('Recipient is not active.');
        }
        // The delivery channel is the in-app inbox. The committed "sent" transition
        // publishes this same unique row to its recipient, so retrying cannot duplicate it.
    }

    private function logFailure(int $id, Throwable $exception): void
    {
        try {
            Log::warning('Workflow notification delivery failed.', ['notification_id' => $id, 'exception_type' => $exception::class]);
        } catch (Throwable) {
            // Logging must not escape the delivery boundary either.
        }
    }
}
