<?php

namespace App\Services;

use App\Contracts\StrategicLogWriter;
use App\Models\Role;
use App\Models\User;
use App\Repositories\RoleRepository;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class RoleService
{
    public function __construct(
        protected RoleRepository $roleRepository,
        private readonly StrategicLogWriter $logWriter
    ) {
    }

    public function getAllRoles(): Collection
    {
        return $this->roleRepository->all();
    }

    public function getRoleById(int $id): ?Model
    {
        return $this->roleRepository->find($id);
    }

    public function createRole(array $data): Model
    {
        $data['is_assignable'] ??= false;
        $data['is_protected'] ??= true;

        $this->authorizeRoleCreation($data);

        $actor = $this->authenticatedActor();

        return DB::transaction(function () use (
            $data,
            $actor
        ): Model {
            $role = $this->roleRepository->create($data);

            $this->logWriter->write('role.created', [
                'actor_user_id' => $actor->user_id,
                'resource_type' => 'role',
                'resource_id' => $role->role_id,
                'role_name' => $role->role_name,
                'is_assignable' => (bool) $role->is_assignable,
                'is_protected' => (bool) $role->is_protected,
            ]);

            return $role;
        });
    }

    public function updateRole(int $id, array $data): bool
    {
        $role = $this->roleRepository->find($id);

        if (! $role instanceof Role) {
            return false;
        }

        $this->authorizeRoleUpdate($role, $data);

        $actor = $this->authenticatedActor();

        return DB::transaction(function () use (
            $id,
            $role,
            $data,
            $actor
        ): bool {
            $changedFields = array_keys($data);

            $updated = $this->roleRepository->update($id, $data);

            if (! $updated) {
                return false;
            }

            $this->logWriter->write('role.updated', [
                'actor_user_id' => $actor->user_id,
                'resource_type' => 'role',
                'resource_id' => $role->role_id,
                'role_name' => $role->role_name,
                'changed_fields' => $changedFields,
            ]);

            return true;
        });
    }

    public function deleteRole(int $id): bool
    {
        $role = $this->roleRepository->find($id);

        if (! $role instanceof Role) {
            return false;
        }

        $this->authorizeRoleDeletion($role);

        if ($role->users()->exists()) {
            throw ValidationException::withMessages([
                'role' => [
                    'The role cannot be deleted while it is assigned to users.',
                ],
            ]);
        }

        $actor = $this->authenticatedActor();

        return DB::transaction(function () use (
            $id,
            $role,
            $actor
        ): bool {
            $this->logWriter->write('role.deleted', [
                'actor_user_id' => $actor->user_id,
                'resource_type' => 'role',
                'resource_id' => $role->role_id,
                'role_name' => $role->role_name,
            ]);

            return $this->roleRepository->delete($id);
        });
    }

    public function getAll(): Collection
    {
        return $this->getAllRoles();
    }

    public function getById(int $id): ?Model
    {
        return $this->getRoleById($id);
    }

    public function create(array $data): Model
    {
        return $this->createRole($data);
    }

    public function update(int $id, array $data): bool
    {
        return $this->updateRole($id, $data);
    }

    public function delete(int $id): bool
    {
        return $this->deleteRole($id);
    }

    private function authorizeRoleCreation(array $data): void
    {
        $actor = $this->authenticatedActor();

        if (
            (bool) $data['is_protected']
            && ! $this->canManageProtectedRoles($actor)
        ) {
            throw new AuthorizationException(
                'You are not authorized to create protected roles.'
            );
        }
    }

    private function authorizeRoleUpdate(
        Role $role,
        array $data
    ): void {
        $actor = $this->authenticatedActor();

        $changesProtectedFlag =
            array_key_exists('is_protected', $data)
            && (bool) $data['is_protected']
                !== (bool) $role->is_protected;

        $changesAssignableFlag =
            array_key_exists('is_assignable', $data)
            && (bool) $data['is_assignable']
                !== (bool) $role->is_assignable;

        $requiresProtectedAccess =
            (bool) $role->is_protected
            || $changesProtectedFlag
            || $changesAssignableFlag;

        if (
            $requiresProtectedAccess
            && ! $this->canManageProtectedRoles($actor)
        ) {
            throw new AuthorizationException(
                'You are not authorized to modify protected-role settings.'
            );
        }
    }

    private function authorizeRoleDeletion(Role $role): void
    {
        if (! $role->is_protected) {
            return;
        }

        $actor = $this->authenticatedActor();

        if (! $this->canManageProtectedRoles($actor)) {
            throw new AuthorizationException(
                'You are not authorized to delete protected roles.'
            );
        }
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