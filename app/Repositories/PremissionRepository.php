<?php

namespace App\Repositories;

use App\Models\Permission;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;

class PremissionRepository
{
    protected $model;

    public function __construct(Permission $permission)
    {
        $this->model = $permission;
    }

    public function all(): Collection
    {
        return $this->model->all();
    }

    public function find(int $id): ?Model
    {
        return $this->model->find($id);
    }

    public function create(array $data): Model
    {
        return $this->model->create($data);
    }

    public function update(int $id, array $data): bool
    {
        $record = $this->find($id);
        return $record ? $record->update($data) : false;
    }

    public function delete(int $id): bool
    {
        $record = $this->find($id);
        return $record ? $record->delete() : false;
    }
}
