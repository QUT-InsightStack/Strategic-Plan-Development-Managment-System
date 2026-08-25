<?php

namespace Tests\Feature;

use App\Models\Log;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use App\Http\Middleware\ValidateAuthVersion;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class UserAccountStatusTest extends TestCase
{
    use RefreshDatabase;

    public function test_inactive_user_cannot_log_in(): void
    {
        $user = $this->createUser('inactive');

        $this->postJson('/api/auth/login', [
            'email' => $user->email,
            'password' => 'password',
        ])->assertUnauthorized();
    }

    public function test_authorized_admin_can_change_account_status(): void
    {
        $admin = $this->createAdministrator();
        $target = $this->createUser();
        $target->refresh();
        $oldVersion = (int) $target->auth_version;

        $this->actingAs($admin, 'api');
        $this->withoutMiddleware(ValidateAuthVersion::class)
            ->patchJson("/api/users/{$target->user_id}/status", [
                'status' => 'suspended',
                'reason' => 'Security review',
            ])
            ->assertOk()
            ->assertJsonPath('data.status', 'suspended')
            ->assertJsonPath('reauthentication_required', true);

        $target->refresh();
        $this->assertSame('suspended', $target->status);
        $this->assertSame($oldVersion + 1, (int) $target->auth_version);
        $this->assertDatabaseHas('tbllog', [
            'user_id' => $admin->user_id,
            'states' => 'success',
        ]);
        $this->assertStringContainsString(
            'user.account_status_changed',
            (string) Log::latest('log_id')->value('operation')
        );
    }

    public function test_user_cannot_change_own_account_status(): void
    {
        $admin = $this->createAdministrator();

        $this->actingAs($admin, 'api');
        $this->withoutMiddleware(ValidateAuthVersion::class)
            ->patchJson("/api/users/{$admin->user_id}/status", [
                'status' => 'inactive',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('status');
    }

    public function test_invalid_account_status_is_rejected(): void
    {
        $admin = $this->createAdministrator();
        $target = $this->createUser();

        $this->actingAs($admin, 'api');
        $this->withoutMiddleware(ValidateAuthVersion::class)
            ->patchJson("/api/users/{$target->user_id}/status", [
                'status' => 'deleted',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('status');
    }

    private function createAdministrator(): User
    {
        $role = Role::create([
            'role_name' => 'Administrator',
            'description' => 'Test administrator',
            'is_assignable' => true,
            'is_protected' => true,
        ]);
        $permission = Permission::create([
            'permission_name' => 'Update Users',
            'description' => 'Update user accounts',
            'code' => 'users.update',
            'module' => 'users',
        ]);
        $role->permissions()->attach($permission->permission_id);

        return $this->createUser('active', $role->role_id, 'admin@example.com');
    }

    private function createUser(
        string $status = 'active',
        ?int $roleId = null,
        ?string $email = null
    ): User {
        return User::create([
            'first_name' => 'Test',
            'last_name' => 'User',
            'email' => $email ?? fake()->unique()->safeEmail(),
            'password' => Hash::make('password'),
            'role_id' => $roleId,
            'status' => $status,
        ]);
    }
}
