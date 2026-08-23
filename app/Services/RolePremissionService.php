<?php

namespace App\Services;

use App\Models\Permission;
use App\Models\Role;
use App\Models\RolePremission;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class RolePremissionService
{
    private const SENSITIVE_PERMISSION_CODES = [
        'roles.manage',
        'roles.assign_protected',
        'permissions.manage',
        'users.assign_roles',
    ];

    public function getAll(array $filters = []): Collection
    {
        $query = RolePremission::with([
            'role',
            'permission',
        ]);

        if (! empty($filters['role_id'])) {
            $query->where('role_id', $filters['role_id']);
        }

        if (! empty($filters['permission_id'])) {
            $query->where(
                'permission_id',
                $filters['permission_id']
            );
        }

        return $query->get();
    }

    public function getById(int $id): ?Model
    {
        return RolePremission::with([
            'role',
            'permission',
        ])->find($id);
    }

    public function getByRoleId(int $roleId): Collection
    {
        return RolePremission::with('permission')
            ->where('role_id', $roleId)
            ->get();
    }

    public function create(array $data): Model
    {
        return DB::transaction(function () use ($data): Model {
            $role = Role::query()
                ->lockForUpdate()
                ->findOrFail($data['role_id']);

            $permission = Permission::query()
                ->findOrFail($data['permission_id']);

            $this->authorizePermissionChange(
                $role,
                [$permission->permission_id]
            );

            $this->ensureUnique(
                $role->role_id,
                $permission->permission_id
            );

            $relation = RolePremission::create($data);

            $this->invalidateRoleSessions($role->role_id);

            return $relation->load([
                'role',
                'permission',
            ]);
        });
    }

    public function update(int $id, array $data): ?Model
    {
        return DB::transaction(function () use (
            $id,
            $data
        ): ?Model {
            $relation = RolePremission::query()
                ->lockForUpdate()
                ->find($id);

            if (! $relation) {
                return null;
            }

            $oldRoleId = (int) $relation->role_id;
            $roleId = (int) (
                $data['role_id']
                ?? $relation->role_id
            );
            $permissionId = (int) (
                $data['permission_id']
                ?? $relation->permission_id
            );

            $role = Role::query()
                ->lockForUpdate()
                ->findOrFail($roleId);

            $permission = Permission::query()
                ->findOrFail($permissionId);

            // Protect both the old and new role when moving a relation.
            $oldRole = Role::query()
                ->lockForUpdate()
                ->findOrFail($oldRoleId);

            $this->authorizePermissionChange(
                $oldRole,
                [$permissionId]
            );

            if ($roleId !== $oldRoleId) {
                $this->authorizePermissionChange(
                    $role,
                    [$permissionId]
                );
            }

            $this->ensureUnique(
                $roleId,
                $permissionId,
                $id
            );

            $relation->update($data);

            $this->invalidateRoleSessions($oldRoleId);

            if ($roleId !== $oldRoleId) {
                $this->invalidateRoleSessions($roleId);
            }

            return $relation->load([
                'role',
                'permission',
            ]);
        });
    }

    public function delete(int $id): bool
    {
        return DB::transaction(function () use ($id): bool {
            $relation = RolePremission::query()
                ->with('permission')
                ->lockForUpdate()
                ->find($id);

            if (! $relation) {
                return false;
            }

            $role = Role::query()
                ->lockForUpdate()
                ->findOrFail($relation->role_id);

            $permissionId = (int) $relation->permission_id;

            $this->authorizePermissionChange(
                $role,
                [$permissionId]
            );

            $deleted = (bool) $relation->delete();

            if ($deleted) {
                $this->invalidateRoleSessions($role->role_id);
            }

            return $deleted;
        });
    }

    public function syncPermissions(
        int $roleId,
        array $permissionIds
    ): Collection {
        return DB::transaction(function () use (
            $roleId,
            $permissionIds
        ): Collection {
            $role = Role::query()
                ->lockForUpdate()
                ->findOrFail($roleId);

            $normalizedIds = array_values(array_unique(
                array_map('intval', $permissionIds)
            ));

            $this->authorizePermissionChange(
                $role,
                $normalizedIds
            );

            $currentIds = $role->permissions()
                ->pluck('tblpermissions.permission_id')
                ->map(fn ($id): int => (int) $id)
                ->sort()
                ->values()
                ->all();

            $newIds = $normalizedIds;
            sort($newIds);

            if ($currentIds === $newIds) {
                return $this->getByRoleId($roleId);
            }

            $role->permissions()->sync($normalizedIds);

            $this->invalidateRoleSessions($roleId);

            return $this->getByRoleId($roleId);
        });
    }

    protected function ensureUnique(
        int $roleId,
        int $permissionId,
        ?int $ignoreId = null
    ): void {
        $query = RolePremission::query()
            ->where('role_id', $roleId)
            ->where('permission_id', $permissionId);

        if ($ignoreId !== null) {
            $query->where('relation_id', '!=', $ignoreId);
        }

        if ($query->exists()) {
            throw ValidationException::withMessages([
                'permission_id' => [
                    'This role permission relationship already exists.',
                ],
            ]);
        }
    }

    private function authorizePermissionChange(
        Role $role,
        array $newPermissionIds
    ): void {
        $actor = $this->authenticatedActor();

        $requiresProtectedAccess = (bool) $role->is_protected;

        if (! $requiresProtectedAccess) {
            $requiresProtectedAccess = Permission::query()
                ->whereIn('permission_id', $newPermissionIds)
                ->whereIn(
                    'code',
                    self::SENSITIVE_PERMISSION_CODES
                )
                ->exists();
        }

        if (
            $requiresProtectedAccess
            && ! $this->canManageProtectedRoles($actor)
        ) {
            throw new AuthorizationException(
                'You are not authorized to change protected role permissions.'
            );
        }
    }

    private function invalidateRoleSessions(int $roleId): void
    {
        User::query()
            ->where('role_id', $roleId)
            ->increment('auth_version');
    }

    private function authenticatedActor(): User
    {
        $actor = Auth::guard('api')->user();

        if (! $actor instanceof User) {
            throw new AuthorizationException('Unauthenticated.');
        }

        return $actor;
    }

    private function canManageProtectedRoles(User $actor): bool
    {
        return $actor->role?->permissions()
            ->where(
                'tblpermissions.code',
                'roles.assign_protected'
            )
            ->exists() ?? false;
    }
}