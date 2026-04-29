<?php

namespace App\Services;

use App\Repositories\RoleRepository;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Collection;

class RoleService
{
    protected $roleRepository;

    public function __construct(RoleRepository $roleRepository)
    {
        $this->roleRepository = $roleRepository;
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
        return $this->roleRepository->create($data);
    }

    public function updateRole(int $id, array $data): bool
    {
        return $this->roleRepository->update($id, $data);
    }

    public function deleteRole(int $id): bool
    {
        return $this->roleRepository->delete($id);
    }

    // Unified CRUD methods for BaseCrudController
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
}