<?php

namespace App\Services;

use App\Contracts\StrategicLogWriter;
use App\Models\Role;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class UserRoleService
{
    public function __construct(
        private readonly StrategicLogWriter $logWriter
    ) {
    }

    public function authorizeAssignment(Role $role): void
    {
        $actor = Auth::guard('api')->user();

        if (! $actor instanceof User) {
            throw new AuthorizationException('Unauthenticated.');
        }

        $this->assertCanAssignRole($actor, $role);
    }

    public function assignRole(
        int $targetUserId,
        int $roleId
    ): User {
        $actor = Auth::guard('api')->user();

        if (! $actor instanceof User) {
            throw new AuthorizationException('Unauthenticated.');
        }

        return DB::transaction(function () use (
            $actor,
            $targetUserId,
            $roleId
        ): User {
            $targetUser = User::query()
                ->with('role')
                ->lockForUpdate()
                ->find($targetUserId);

            if (! $targetUser) {
                throw ValidationException::withMessages([
                    'user' => ['The selected user does not exist.'],
                ]);
            }

            $role = Role::query()
                ->lockForUpdate()
                ->find($roleId);

            if (! $role) {
                throw ValidationException::withMessages([
                    'role_id' => ['The selected role does not exist.'],
                ]);
            }

            if ((int) $actor->user_id === (int) $targetUser->user_id) {
                throw new AuthorizationException(
                    'Users cannot change their own role.'
                );
            }

            $this->assertCanAssignRole($actor, $role);

            if ((int) $targetUser->role_id === (int) $role->role_id) {
                throw ValidationException::withMessages([
                    'role_id' => [
                        'The user already has the selected role.',
                    ],
                ]);
            }

            $oldRoleId = $targetUser->role_id;
            $oldRoleName = $targetUser->role?->role_name;

            $targetUser->role_id = $role->role_id;
            $targetUser->increment('auth_version');
            $targetUser->save();

            $this->logWriter->write('user.role_assigned', [
                'actor_user_id' => $actor->user_id,
                'resource_type' => 'user',
                'resource_id' => $targetUser->user_id,
                'old_role_id' => $oldRoleId,
                'old_role_name' => $oldRoleName,
                'new_role_id' => $role->role_id,
                'new_role_name' => $role->role_name,
            ]);

            return $targetUser->fresh(['role']);
        });
    }

    private function assertCanAssignRole(
        User $actor,
        Role $role
    ): void {
        $actorRole = $actor->role;

        if (! $actorRole) {
            throw new AuthorizationException(
                'The acting user has no assigned role.'
            );
        }

        $hasAssignmentPermission = $actorRole
            ->permissions()
            ->where('code', 'users.assign_roles')
            ->exists();

        if (! $hasAssignmentPermission) {
            throw new AuthorizationException(
                'You are not authorized to assign user roles.'
            );
        }

        if (! $role->is_assignable) {
            throw ValidationException::withMessages([
                'role_id' => [
                    'The selected role is not approved for assignment.',
                ],
            ]);
        }

        if ($role->is_protected) {
            $canAssignProtectedRole = $actorRole
                ->permissions()
                ->where('code', 'roles.assign_protected')
                ->exists();

            if (! $canAssignProtectedRole) {
                throw new AuthorizationException(
                    'You are not authorized to assign this protected role.'
                );
            }
        }
    }
}