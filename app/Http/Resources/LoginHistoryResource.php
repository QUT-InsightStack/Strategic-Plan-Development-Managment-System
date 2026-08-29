<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class LoginHistoryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'login_history_id' => $this->login_history_id,
            'email' => $this->email,
            'outcome' => $this->outcome,
            'reason' => $this->reason,
            'ip_address' => $this->ip_address,
            'device_label' => $this->deviceLabel(),

            // The full agent string only goes to the administrator view,
            // where it is needed to investigate an incident. The derived
            // label above is enough for someone checking their own history.
            'user_agent' => $this->when(
                $this->relationLoaded('user'),
                fn (): ?string => $this->user_agent
            ),

            // Only sent to the administrator view, which loads the relation.
            // A person reading their own history already knows who they are.
            'user' => $this->whenLoaded('user', function (): ?array {
                if (! $this->user) {
                    return null;
                }

                return [
                    'user_id' => $this->user->user_id,
                    'name' => $this->user->name,
                ];
            }),

            'created_at' => $this->created_at,
        ];
    }
}
