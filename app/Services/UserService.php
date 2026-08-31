<?php

namespace App\Services;

use App\Models\Role;
use App\Models\User;
use App\Repositories\UserRepository;
use App\Contracts\StrategicLogWriter;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class UserService
{
    protected UserRepository $userRepository;

    public function __construct(
        UserRepository $userRepository,
        protected UserRoleService $userRoleService,
        private readonly StrategicLogWriter $logWriter
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
        $role = Role::query()->find($data['role_id'] ?? null);

        if (! $role) {
            throw ValidationException::withMessages([
                'role_id' => ['The selected role does not exist.'],
            ]);
        }

        $this->userRoleService->authorizeAssignment($role);

        $actor = Auth::guard('api')->user();

        if (! $actor instanceof User) {
            throw ValidationException::withMessages([
                'user' => ['An authenticated user is required.'],
            ]);
        }

        $data['status'] ??= 'active';

        return DB::transaction(function () use (
            $data,
            $actor,
            $role
        ): Model {
            $user = $this->userRepository->create($data);

            $this->logWriter->write('user.created', [
                'actor_user_id' => $actor->user_id,
                'resource_type' => 'user',
                'resource_id' => $user->user_id,
                'role_id' => $role->role_id,
                'role_name' => $role->role_name,
                'status' => $user->status,
            ]);

            return $user->fresh(['role']);
        });
    }

    public function updateUser(int $id, array $data): bool
    {
        /*
         * This is also enforced by UpdateUserRequest.
         * Keep this protection in the service layer as well.
         */
        unset($data['role_id']);

        $actor = Auth::guard('api')->user();

        if (! $actor instanceof User) {
            throw ValidationException::withMessages([
                'user' => ['An authenticated user is required.'],
            ]);
        }

        return DB::transaction(function () use (
            $id,
            $data,
            $actor
        ): bool {
            $user = User::query()
                ->lockForUpdate()
                ->find($id);

            if (! $user) {
                return false;
            }

            $changedFields = array_keys($data);

            $updated = $user->update($data);

            if (! $updated) {
                return false;
            }

            $this->logWriter->write('user.updated', [
                'actor_user_id' => $actor->user_id,
                'resource_type' => 'user',
                'resource_id' => $user->user_id,
                'changed_fields' => $changedFields,
            ]);

            return true;
        });
    }

    public function deleteUser(int $id): bool
    {
        $actor = Auth::guard('api')->user();

        if (! $actor instanceof User) {
            throw ValidationException::withMessages([
                'user' => ['An authenticated user is required.'],
            ]);
        }

        return DB::transaction(function () use (
            $id,
            $actor
        ): bool {
            $user = User::query()
                ->lockForUpdate()
                ->find($id);

            if (! $user) {
                return false;
            }

            /*
             * Writing the audit record before deleting the user.
             * The user_id foreign key is configured with nullOnDelete(),
             * preserving the audit row after the user is deleted.
             */
            $this->logWriter->write('user.deleted', [
                'actor_user_id' => $actor->user_id,
                'resource_type' => 'user',
                'resource_id' => $user->user_id,
                'deleted_user_name' => trim(
                    $user->first_name . ' ' . $user->last_name
                ),
                'deleted_user_email' => $user->email,
            ]);

            return (bool) $user->delete();
        });
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