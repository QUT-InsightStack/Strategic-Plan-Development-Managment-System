<?php

namespace App\Services;

use App\Models\Role;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class UserRoleService
{
    public function authorizeAssignment(Role $role): void
    {
        $actor = Auth::guard('api')->user();

        if (! $actor) {
            throw new AuthorizationException('Unauthenticated.');
        }

        $this->assertCanAssignRole($actor, $role);
    }

    public function assignRole(
        int $targetUserId,
        int $roleId
    ): User {
        $actor = Auth::guard('api')->user();

        if (! $actor) {
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

            if ($this->wouldRemoveLastAdministrator($targetUser, $role)) {
                throw ValidationException::withMessages([
                    'role_id' => [
                        'This is the only remaining administrator. Assign the Administrator role to another user first.',
                    ],
                ]);
            }

            $oldRoleId = $targetUser->role_id;

            $targetUser->role_id = $role->role_id;
            $targetUser->increment('auth_version');
            $targetUser->save();

            // Add audit-log write here if the project's log service
            // and schema are already available.
            //
            // Example audit data:
            // [
            //     'actor_user_id' => $actor->user_id,
            //     'target_user_id' => $targetUser->user_id,
            //     'old_role_id' => $oldRoleId,
            //     'new_role_id' => $role->role_id,
            //     'action' => 'user.role_assigned',
            // ]

            return $targetUser
                ->fresh(['role']);
        });
    }

    /**
     * Whether reassigning $targetUser to $newRole strips the Administrator
     * role from the last user holding it.
     */
    private function wouldRemoveLastAdministrator(User $targetUser, Role $newRole): bool
    {
        $currentRole = $targetUser->role;

        if (! $currentRole || ! in_array($currentRole->role_name, Role::ADMIN_ROLES, true)) {
            return false; // They are not an administrator, so none is lost.
        }

        if (in_array($newRole->role_name, Role::ADMIN_ROLES, true)) {
            return false; // Still an administrator afterwards.
        }

        $adminRoleIds = Role::whereIn('role_name', Role::ADMIN_ROLES)->pluck('role_id');

        return User::whereIn('role_id', $adminRoleIds)->count() <= 1;
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