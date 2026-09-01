<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class LoginHistoryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'login_history_id' => (int) $this->login_history_id,

            /*
             * this is the currently associated user, if the account still
             * exists. Only safe identity fields returned.
             */
            'user' => $this->currentUser(),

            /*
             * These snapshot values represent the identity at the time
             * of the authentication attempt.
             */
            'user_name' => $this->user_name,
            'email' => $this->email,

            'ip_address' => $this->ip_address,
            'user_agent' => $this->user_agent,
            'status' => $this->status,
            'failure_reason' => $this->failure_reason,
            'attempted_at' => $this->attempted_at,
        ];
    }

    private function currentUser(): ?array
    {
        if (
            ! $this->relationLoaded('user')
            || ! $this->user
        ) {
            return null;
        }

        return [
            'user_id' => (int) $this->user->user_id,
            'name' => trim(
                ($this->user->first_name ?? '')
                . ' '
                . ($this->user->last_name ?? '')
            ),
            'email' => $this->user->email,
        ];
    }
}