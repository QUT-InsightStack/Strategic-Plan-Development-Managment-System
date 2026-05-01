<?php

namespace App\Services;

use App\Repositories\PremissionRepository;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Collection;

class PremissionService
{
    protected $premissionRepository;

    public function __construct(PremissionRepository $premissionRepository)
    {
        $this->premissionRepository = $premissionRepository;
    }

    public function getAllPremissions(): Collection
    {
        return $this->premissionRepository->all();
    }

    public function getPremissionById(int $id): ?Model
    {
        return $this->premissionRepository->find($id);
    }

    public function createPremission(array $data): Model
    {
        return $this->premissionRepository->create($data);
    }

    public function updatePremission(int $id, array $data): bool
    {
        return $this->premissionRepository->update($id, $data);
    }

    public function deletePremission(int $id): bool
    {
        return $this->premissionRepository->delete($id);
    }

    // Unified CRUD methods for BaseCrudController
    public function getAll(): Collection
    {
        return $this->getAllPremissions();
    }

    public function getById(int $id): ?Model
    {
        return $this->getPremissionById($id);
    }

    public function create(array $data): Model
    {
        return $this->createPremission($data);
    }

    public function update(int $id, array $data): bool
    {
        return $this->updatePremission($id, $data);
    }

    public function delete(int $id): bool
    {
        return $this->deletePremission($id);
    }
}
