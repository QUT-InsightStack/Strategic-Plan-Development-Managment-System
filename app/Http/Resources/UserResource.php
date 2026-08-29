<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'user_id' => $this->user_id,
            'name' => $this->name,
            'first_name' => $this->first_name,
            'last_name' => $this->last_name,
            'email' => $this->email,
            'department' => $this->department,
            'unit' => $this->unit,
            'office' => $this->office,
            'position' => $this->position,
            'designation' => $this->designation,
            'mobile' => $this->mobile,
            'address' => $this->address,
            'status' => $this->status,
            'profile_picture' => $this->profile_picture,

            'role' => $this->whenLoaded('role', function (): array {
                return [
                    'role_id' => $this->role->role_id,
                    'role_name' => $this->role->role_name,
                ];
            }),

            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}