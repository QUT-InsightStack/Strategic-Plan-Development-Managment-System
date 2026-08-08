<?php

namespace App\Services;

use App\Repositories\UserRepository;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Collection;

class UserService
{
    protected $userRepository;

    public function __construct(UserRepository $userRepository)
    {
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

    /**
     * Search users by name, email or role.
     *
     * @param array{term?:string,role_id?:int,status?:string,sort_by?:string,sort_dir?:string,per_page?:int} $filters
     */
    public function searchUsers(array $filters = []): LengthAwarePaginator
    {
        return $this->userRepository->search($filters);
    }

    /**
     * Distinct unit, office and department values for the search filters.
     *
     * @return array{units:string[],offices:string[],departments:string[]}
     */
    public function getSearchFilterOptions(): array
    {
        return $this->userRepository->filterOptions();
    }

    public function createUser(array $data): Model
    {
        // Business logic: such as password hashing, validation, etc.
        // $data['password'] = bcrypt($data['password']);
        return $this->userRepository->create($data);
    }

    public function updateUser(int $id, array $data): bool
    {
        // Business logic: such as checking permissions
        return $this->userRepository->update($id, $data);
    }

    public function deleteUser(int $id): bool
    {
        // Business logic: such as soft delete or association checks
        return $this->userRepository->delete($id);
    }

    // Unified CRUD methods for BaseCrudController
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
}