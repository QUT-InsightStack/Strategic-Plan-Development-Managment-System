<?php

namespace App\Services;

use App\Models\Log;
use App\Models\Role;
use App\Models\User;
use App\Repositories\UserRepository;
use App\Contracts\StrategicLogWriter;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

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
        $this->validateSubmittedPassword($data);
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
        $actor = Auth::guard('api')->user();
    
        if (! $actor instanceof User) {
            throw new AuthorizationException('Unauthenticated.');
        }
    
        return $this->updateByAdministrator($id, $data, $actor) !== null;
    }

    public function updateByAdministrator(
        int $id,
        array $data,
        User $actor
    ): ?User {
        app(PermissionAuthorizationService::class)
            ->ensureHasPermission('users.update', $actor);
    
        foreach (['role_id', 'status', 'auth_version'] as $field) {
            if (array_key_exists($field, $data)) {
                throw ValidationException::withMessages([
                    $field => ['This field cannot be changed through this operation.'],
                ]);
            }
        }
    
        $this->validateSubmittedPassword($data);
    
        return DB::transaction(function () use ($id, $data, $actor): ?User {
            $user = User::query()
                ->with('role')
                ->lockForUpdate()
                ->find($id);
    
            if (! $user) {
                return null;
            }
    
            if (
                $user->role?->is_protected
                && ! $this->actorMayManageProtectedAccounts($actor)
            ) {
                throw new AuthorizationException(
                    'You are not authorized to update this account.'
                );
            }
    
            $user->fill($data);
    
            $changed = array_keys($user->getDirty());
    
            if ($changed === []) {
                return $user->fresh(['role']);
            }
    
            $passwordChanged = $user->isDirty('password');
    
            if ($passwordChanged) {
                $user->auth_version = (int) $user->auth_version + 1;
                $user->setRememberToken(Str::random(60));
            }
    
            $user->saveOrFail();
    
            $this->logWriter->write('user.updated', [
                'actor_user_id' => $actor->user_id,
                'resource_type' => 'user',
                'resource_id' => $user->user_id,
                'changed_fields' => $changed,
                'sessions_invalidated' => $passwordChanged,
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

    private function validateSubmittedPassword(array $data): void
    {
        if (! array_key_exists('password', $data)) {
            return;
        }
    
        Validator::make(
            ['password' => $data['password']],
            [
                'password' => app(PasswordPolicyService::class)->rules(),
            ]
        )->validate();
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
