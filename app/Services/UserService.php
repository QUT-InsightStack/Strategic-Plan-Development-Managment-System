<?php

namespace App\Services;

use App\Models\Log;
use App\Models\Role;
use App\Models\User;
use App\Repositories\UserRepository;
use Illuminate\Auth\Access\AuthorizationException;
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
        // UpdateUserRequest rejects role_id and status.
        // this protects internal callers from future accidental bypasses.
        unset($data['role_id'], $data['status']);

        return $this->userRepository->update($id, $data);
    }

    /**
     * Update another user's account on behalf of an administrator.
     *
     * Returns null when the target does not exist, so the caller can respond
     * 404. Role and status are stripped regardless of what reaches here:
     * both have dedicated endpoints that apply safeguards this path does not.
     *
     * Accounts holding a protected role may only be updated by an
     * administrator who also holds `roles.assign_protected`, matching the
     * rule UserRoleService applies when assigning those roles.
     */
    public function updateByAdministrator(int $id, array $data, User $actor): ?User
    {
        return DB::transaction(function () use ($id, $data, $actor): ?User {
            $user = User::query()
                ->with('role')
                ->lockForUpdate()
                ->find($id);

            if (! $user) {
                return null;
            }

            if ($user->role?->is_protected && ! $this->actorMayManageProtectedAccounts($actor)) {
                throw new AuthorizationException(
                    'You are not authorized to update this account.'
                );
            }

            unset($data['role_id'], $data['status'], $data['auth_version']);

            $user->fill($data);

            $changed = array_keys($user->getDirty());

            if ($changed === []) {
                return $user->fresh(['role']);
            }

            $user->save();

            // Field names only — never the submitted values, which may
            // include a password.
            Log::create([
                'user_id' => $actor->user_id,
                'operation' => json_encode([
                    'event' => 'user.account_updated',
                    'target_user_id' => $user->user_id,
                    'fields' => $changed,
                ], JSON_UNESCAPED_SLASHES),
                'states' => 'success',
            ]);

            return $user->fresh(['role']);
        });
    }

    private function actorMayManageProtectedAccounts(User $actor): bool
    {
        return (bool) $actor->role
            ?->permissions()
            ->where('code', 'roles.assign_protected')
            ->exists();
    }

    public function updateStatus(
        int $userId,
        string $status,
        ?string $reason,
        User $actor
    ): User {
        return DB::transaction(function () use ($userId, $status, $reason, $actor): User {
            $user = User::query()
                ->with('role')
                ->lockForUpdate()
                ->find($userId);

            if (! $user) {
                throw ValidationException::withMessages([
                    'user' => ['The selected user does not exist.'],
                ]);
            }

            if ((int) $user->user_id === (int) $actor->user_id) {
                throw ValidationException::withMessages([
                    'status' => ['You cannot change the status of your own account.'],
                ]);
            }

            if ($user->status === $status) {
                return $user;
            }

            if ($status !== 'active' && $this->wouldDisableLastAdministrator($user)) {
                throw ValidationException::withMessages([
                    'status' => ['The last active administrator cannot be disabled or suspended.'],
                ]);
            }

            $previousStatus = $user->status;
            $user->status = $status;
            $user->increment('auth_version');
            $user->save();

            Log::create([
                'user_id' => $actor->user_id,
                'operation' => json_encode([
                    'event' => 'user.account_status_changed',
                    'target_user_id' => $user->user_id,
                    'from' => $previousStatus,
                    'to' => $status,
                    'reason' => $reason,
                ], JSON_UNESCAPED_SLASHES),
                'states' => 'success',
            ]);

            return $user->fresh(['role']);
        });
    }

    private function wouldDisableLastAdministrator(User $user): bool
    {
        if (! $user->role || ! in_array($user->role->role_name, Role::ADMIN_ROLES, true)) {
            return false;
        }

        $adminRoleIds = Role::query()
            ->whereIn('role_name', Role::ADMIN_ROLES)
            ->pluck('role_id');

        return User::query()
            ->whereIn('role_id', $adminRoleIds)
            ->where('status', 'active')
            ->count() <= 1;
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
