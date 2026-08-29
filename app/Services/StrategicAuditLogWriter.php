<?php

namespace App\Services;

use App\Contracts\StrategicLogWriter;
use App\Models\Log;
use App\Models\User;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Auth;

class StrategicAuditLogWriter implements StrategicLogWriter
{
    public function write(string $event, array $context = []): void
    {
        $authenticatedUser = Auth::guard('api')->user();
        $contextUserId = $context['user_id'] ?? null;

        $userId = $authenticatedUser?->user_id
            ?? $contextUserId;

        $actor = $authenticatedUser;

        if (
            ! $actor instanceof User
            && $userId !== null
        ) {
            $actor = User::query()->find($userId);
        }

        Log::query()->create([
            'user_id' => $userId,
            'actor_name' => $this->actorName($actor),
            'operation' => $event,
            'resource_type' => $this->resourceType($event),
            'resource_id' => $context['record_id'] ?? null,
            'outcome' => $context['outcome'] ?? 'success',
            'states' => $context['status']
                ?? $context['to']
                ?? null,
            'metadata' => Arr::except($context, [
                'user_id',
                'record_id',
                'outcome',
            ]),
        ]);
    }

    private function actorName(?User $user): ?string
    {
        if (! $user) {
            return null;
        }

        $name = trim(
            ($user->first_name ?? '')
            . ' '
            . ($user->last_name ?? '')
        );

        return $name !== ''
            ? $name
            : $user->email;
    }

    private function resourceType(string $event): ?string
    {
        return match (true) {
            str_starts_with(
                $event,
                'strategic_plan.'
            ) => 'strategic_plan',

            str_starts_with(
                $event,
                'strategic_record.'
            ) => 'strategic_record',

            default => null,
        };
    }
}