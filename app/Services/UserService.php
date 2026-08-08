<?php

namespace App\Services;

use App\Models\Log;
use App\Repositories\UserRepository;
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
     * Assign or remove a user's role.
     *
     * Records the change in the audit log with both the previous and the new
     * role, and who made it. Returns null when the user does not exist so the
     * controller can respond 404.
     *
     * Note: the acting user's role is embedded in their JWT at sign in, so a
     * change here does not affect the target's existing session until their
     * token is refreshed or they sign in again.
     */
    public function assignRole(int $userId, ?int $roleId, int $actorId): ?Model
    {
        $user = $this->userRepository->find($userId);

        if (! $user) {
            return null;
        }

        $previousRole = $user->role?->role_name ?? 'None';

        $this->userRepository->update($userId, ['role_id' => $roleId]);

        $updated = $this->userRepository->find($userId);
        $updated->load('role');

        $newRole = $updated->role?->role_name ?? 'None';

        Log::create([
            'user_id'   => $actorId,
            'operation' => sprintf(
                'Role changed for user %d (%s): %s -> %s',
                $userId,
                $updated->email,
                $previousRole,
                $newRole
            ),
            'states'    => 'success',
        ]);

        return $updated;
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