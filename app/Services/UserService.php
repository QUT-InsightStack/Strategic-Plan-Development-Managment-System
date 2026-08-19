<?php

namespace App\Services;

use App\Models\Role;
use App\Repositories\UserRepository;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class UserService
{
    protected $userRepository;

    public function __construct(
        UserRepository $userRepository,
        protected UserRoleService $userRoleService
    ) {
        $this->userRepository = $userRepository;
    }

    public function getAllUsers(): Collection
    {
        return $this->userRepository->all();
    }

    public function getUserById(int $id): ?Model
    {
        return $this->userRepository->find($id);
    }

    public function createUser(array $data): Model
    {
        $role = Role::query()
            ->find($data['role_id'] ?? null);

        if (! $role) {
            throw ValidationException::withMessages([
                'role_id' => ['The selected role does not exist.'],
            ]);
        }

        $this->userRoleService->authorizeAssignment($role);

        $data['status'] ??= 'active';

        return DB::transaction(function () use ($data): Model {
            return $this->userRepository->create($data);
        });
    }

    public function updateUser(int $id, array $data): bool
    {
        // UpdateUserRequest rejects role_id. 
        // this protects internal callers from future accidental bypasses.
        unset($data['role_id']);

        return $this->userRepository->update($id, $data);
    }

    public function deleteUser(int $id): bool
    {
        return $this->userRepository->delete($id);
    }

    public function getAll(): Collection
    {
        return $this->getAllUsers();
    }

    public function getById(int $id): ?Model
    {
        return $this->getUserById($id);
    }

    public function create(array $data): Model
    {
        return $this->createUser($data);
    }

    public function update(int $id, array $data): bool
    {
        return $this->updateUser($id, $data);
    }

    public function delete(int $id): bool
    {
        return $this->deleteUser($id);
    }

    public function search(array $filters): LengthAwarePaginator
    {
        $filters['search_by'] ??= 'all';
        $filters['sort_by'] ??= 'name';
        $filters['sort_direction'] ??= 'asc';
        $filters['per_page'] ??= 15;

        return $this->userRepository->search($filters);
    }
}
