<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class LogResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'log_id' => (int) $this->log_id,
            'user' => $this->userSummary(),
            'actor_name' => $this->actor_name,
            'action' => $this->resource->eventName(),
            'resource' => [
                'type' => $this->resource_type,
                'id' => $this->resource_id !== null
                    ? (int) $this->resource_id
                    : null,
            ],
            'outcome' => $this->resource->effectiveOutcome(),
            'state' => $this->states,
            'metadata' => $this->resource->eventMetadata(),
            'occurred_at' => $this->created_at,
        ];
    }

    private function userSummary(): ?array
    {
        if (! $this->relationLoaded('user') || ! $this->user) {
            return null;
        }

        return [
            'user_id' => (int) $this->user->user_id,
            'name' => trim(
                $this->user->first_name
                . ' '
                . $this->user->last_name
            ),
            'email' => $this->user->email,
        ];
    }
}
