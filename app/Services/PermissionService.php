<?php

namespace App\Services;

use App\Contracts\StrategicLogWriter;
use App\Models\Permission;
use App\Models\User;
use App\Repositories\PermissionRepository;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class PermissionService
{
    public function __construct(
        protected PermissionRepository $permissionRepository,
        private readonly StrategicLogWriter $logWriter
    ) {
    }

    public function getAllPermissions(): Collection
    {
        return $this->permissionRepository->all();
    }

    public function getPermissionById(int $id): ?Model
    {
        return $this->permissionRepository->find($id);
    }

    public function createPermission(array $data): Model
    {
        $actor = $this->authenticatedActor();

        return DB::transaction(function () use (
            $data,
            $actor
        ): Model {
            $permission = $this->permissionRepository->create($data);

            $this->logWriter->write('permission.created', [
                'actor_user_id' => $actor->user_id,
                'resource_type' => 'permission',
                'resource_id' => $permission->permission_id,
                'permission_code' => $permission->code,
                'permission_name' => $permission->permission_name,
            ]);

            return $permission;
        });
    }

    public function updatePermission(int $id, array $data): bool
    {
        $permission = $this->permissionRepository->find($id);

        if (! $permission instanceof Permission) {
            return false;
        }

        $actor = $this->authenticatedActor();

        return DB::transaction(function () use (
            $id,
            $permission,
            $data,
            $actor
        ): bool {
            $updated = $this->permissionRepository->update($id, $data);

            if (! $updated) {
                return false;
            }

            $this->logWriter->write('permission.updated', [
                'actor_user_id' => $actor->user_id,
                'resource_type' => 'permission',
                'resource_id' => $permission->permission_id,
                'permission_code' => $permission->code,
                'changed_fields' => array_keys($data),
            ]);

            return true;
        });
    }

    public function deletePermission(int $id): bool
    {
        $permission = $this->permissionRepository->find($id);

        if (! $permission instanceof Permission) {
            return false;
        }

        $actor = $this->authenticatedActor();

        return DB::transaction(function () use (
            $id,
            $permission,
            $actor
        ): bool {
            $this->logWriter->write('permission.deleted', [
                'actor_user_id' => $actor->user_id,
                'resource_type' => 'permission',
                'resource_id' => $permission->permission_id,
                'permission_code' => $permission->code,
                'permission_name' => $permission->permission_name,
            ]);

            return $this->permissionRepository->delete($id);
        });
    }

    public function getAll(): Collection
    {
        return $this->getAllPermissions();
    }

    public function getById(int $id): ?Model
    {
        return $this->getPermissionById($id);
    }

    public function create(array $data): Model
    {
        return $this->createPermission($data);
    }

    public function update(int $id, array $data): bool
    {
        return $this->updatePermission($id, $data);
    }

    public function delete(int $id): bool
    {
        return $this->deletePermission($id);
    }

    private function authenticatedActor(): User
    {
        $actor = Auth::guard('api')->user();

        if (! $actor instanceof User) {
            throw new AuthorizationException('Unauthenticated.');
        }

        return $actor;
    }
}