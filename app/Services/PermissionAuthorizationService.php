<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Support\Collection;

class PermissionAuthorizationService
{
    public function ensureHasPermission(string $permission, ?User $user = null, ?string $message = null): User
    {
        $user = $this->resolveUser($user);

        if ($user->role?->hasFullAccess()
            || $this->userPermissionCodes($user)->contains($permission)) {
            return $user;
        }

        $this->deny($message ?? 'This action is unauthorized.');
    }

    public function userPermissionCodes(User $user): Collection
    {
        $role = $user->loadMissing('role.permissions')->role;

        return $role?->permissions?->pluck('code') ?? collect();
    }

    public function resolveUser(?User $user = null): User
    {
        $user = $user ?? auth('api')->user();

        if ($user instanceof User) {
            return $user;
        }

        throw new HttpResponseException(
            response()->json([
                'success' => false,
                'message' => 'Unauthenticated.',
                'errors' => [],
            ], 401)
        );
    }

    private function deny(string $message): never
    {
        throw new HttpResponseException(
            response()->json([
                'success' => false,
                'message' => $message,
                'errors' => [],
            ], 403)
        );
    }
}
