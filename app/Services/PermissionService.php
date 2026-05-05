<?php

namespace App\Services;

use App\Repositories\PermissionRepository;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Collection;

class PermissionService
{
    protected $permissionRepository;

    public function __construct(PermissionRepository $permissionRepository)
    {
        $this->permissionRepository = $permissionRepository;
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
        return $this->permissionRepository->create($data);
    }

    public function updatePermission(int $id, array $data): bool
    {
        return $this->permissionRepository->update($id, $data);
    }

    public function deletePermission(int $id): bool
    {
        return $this->permissionRepository->delete($id);
    }

    // Unified CRUD methods for BaseCrudController
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
}