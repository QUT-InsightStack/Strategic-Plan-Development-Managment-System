<?php

namespace App\Services;

use App\Models\Role;
use App\Models\User;
use App\Repositories\RoleRepository;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

class RoleService
{
    public function __construct(
        protected RoleRepository $roleRepository
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
        // Apply secure defaults before authorization.
        $data['is_assignable'] ??= false;
        $data['is_protected'] ??= true;

        $this->authorizeRoleCreation($data);

        return $this->roleRepository->create($data);
    }

    public function updateRole(int $id, array $data): bool
    {
        $role = $this->roleRepository->find($id);

        if (! $role instanceof Role) {
            return false;
        }

        $this->authorizeRoleUpdate($role, $data);

        return $this->roleRepository->update($id, $data);
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

        return $this->roleRepository->delete($id);
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
            $role->is_protected
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