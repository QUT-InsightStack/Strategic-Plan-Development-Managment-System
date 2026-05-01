<?php

namespace App\Services;

use App\Models\Role;
use App\Models\RolePremission;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class RolePremissionService
{
    public function getAll(array $filters = []): Collection
    {
        $query = RolePremission::with(['role', 'permission']);

        if (!empty($filters['role_id'])) {
            $query->where('role_id', $filters['role_id']);
        }

        if (!empty($filters['permission_id'])) {
            $query->where('permission_id', $filters['permission_id']);
        }

        return $query->get();
    }

    public function getById(int $id): ?Model
    {
        return RolePremission::with(['role', 'permission'])->find($id);
    }

    public function getByRoleId(int $roleId): Collection
    {
        return RolePremission::with('permission')
            ->where('role_id', $roleId)
            ->get();
    }

    public function create(array $data): Model
    {
        $this->ensureUnique($data['role_id'], $data['permission_id']);

        return RolePremission::create($data)->load(['role', 'permission']);
    }

    public function update(int $id, array $data): ?Model
    {
        $rolePremission = RolePremission::find($id);

        if (!$rolePremission) {
            return null;
        }

        $roleId = $data['role_id'] ?? $rolePremission->role_id;
        $permissionId = $data['permission_id'] ?? $rolePremission->permission_id;

        $this->ensureUnique($roleId, $permissionId, $id);

        $rolePremission->update($data);

        return $rolePremission->load(['role', 'permission']);
    }

    public function delete(int $id): bool
    {
        $rolePremission = RolePremission::find($id);

        return $rolePremission ? (bool) $rolePremission->delete() : false;
    }

    public function syncPermissions(int $roleId, array $permissionIds): Collection
    {
        return DB::transaction(function () use ($roleId, $permissionIds) {
            $role = Role::findOrFail($roleId);
            $role->permissions()->sync($permissionIds);

            return $this->getByRoleId($roleId);
        });
    }

    protected function ensureUnique(int $roleId, int $permissionId, ?int $ignoreId = null): void
    {
        $query = RolePremission::where('role_id', $roleId)
            ->where('permission_id', $permissionId);

        if ($ignoreId) {
            $query->where('relation_id', '!=', $ignoreId);
        }

        if ($query->exists()) {
            throw ValidationException::withMessages([
                'permission_id' => ['This role permission relationship already exists.'],
            ]);
        }
    }
}
