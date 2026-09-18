<?php

namespace App\Services;

use App\Contracts\StrategicLogWriter;
use App\Models\Log;
use App\Models\User;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Auth;

class StrategicAuditLogWriter implements StrategicLogWriter
{
    public function write(
        string $event,
        array $context = []
    ): void {
        $authenticatedUser = Auth::guard('api')->user();

        /*
         * Previous strategic services use user_id for the acting user.
         * New services use actor_user_id. Support both names.
         */
        $actorUserId = $context['actor_user_id']
            ?? $context['user_id']
            ?? $authenticatedUser?->user_id;

        $actor = $authenticatedUser;

        if (
            $actorUserId !== null
            && (
                ! $actor instanceof User
                || (int) $actor->user_id !== (int) $actorUserId
            )
        ) {
            $actor = User::query()->find($actorUserId);
        }

        $resourceType = $context['resource_type']
            ?? $this->resourceTypeFromEvent($event);

        $resourceId = $context['resource_id']
            ?? $context['record_id']
            ?? null;

        $metadata = Arr::except($context, [
            'actor_user_id',
            'user_id',
            'resource_type',
            'resource_id',
            'record_id',
            'outcome',
        ]);

        Log::query()->create([
            'user_id' => $actorUserId,
            'actor_name' => $this->actorName($actor),
            'operation' => $event,
            'resource_type' => $resourceType,
            'resource_id' => $resourceId,
            'outcome' => $context['outcome'] ?? 'success',
            'states' => $context['status']
                ?? $context['to']
                ?? null,
            'metadata' => $metadata !== []
                ? $metadata
                : null,
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

    private function resourceTypeFromEvent(string $event): ?string
    {
        return match (true) {
            str_starts_with($event, 'strategic_plan.') =>
                'strategic_plan',

            str_starts_with($event, 'strategic_record.') =>
                'strategic_record',

            str_starts_with($event, 'pdp_chapter.') =>
            'pdp_chapter',
    
            str_starts_with($event, 'user.') =>
                'user',

            str_starts_with($event, 'role.') =>
                'role',

            str_starts_with($event, 'permission.') =>
                'permission',

            str_starts_with($event, 'system_settings.') =>
            'system_settings',
            
            str_starts_with($event, 'auth.') =>
                'user',

            default => null,
        };
    }
}