<?php

namespace App\Services;

use App\Models\SystemEvent;
use Illuminate\Support\Arr;
use Throwable;

class SystemEventRecorder
{
    public function record(string $event, string $source, string $severity, string $outcome, array $context = []): void
    {
        if (! config('monitoring.enabled')) {
            return;
        }
        // Deliberately exclude emails, bodies, tokens, SQL, bindings and exception messages.
        $context = Arr::only($context, [
            'request_id', 'route', 'method', 'status_code', 'duration_ms', 'db_duration_ms',
            'db_query_count', 'exception_type', 'reason', 'actor_user_id', 'resource_type',
            'resource_id', 'login_history_id', 'alert_id', 'condition', 'status',
        ]);
        $requestId = Arr::pull($context, 'request_id') ?? request()->attributes->get('monitoring')['request_id'] ?? null;
        try {
            SystemEvent::create([
                'event' => $event, 'source' => $source, 'severity' => $severity,
                'outcome' => $outcome, 'request_id' => $requestId,
                'context' => $context ?: null, 'occurred_at' => now(),
            ]);
        } catch (Throwable) {
            // Independent of the application database and logging channel configuration.
            error_log('System event could not be stored: '.$event);
        }
    }
}
