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
            'action' => $this->operation,
            'resource' => [
                'type' => $this->resource_type,
                'id' => $this->resource_id !== null
                    ? (int) $this->resource_id
                    : null,
            ],
            'outcome' => $this->outcome,
            'state' => $this->states,
            'metadata' => $this->metadata,
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