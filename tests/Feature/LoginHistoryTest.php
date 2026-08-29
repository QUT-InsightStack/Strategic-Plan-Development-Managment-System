<?php

namespace Tests\Feature;

use App\Http\Middleware\ValidateAuthVersion;
use App\Models\LoginHistory;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class LoginHistoryTest extends TestCase
{
    use RefreshDatabase;

    // ─── Recording ───────────────────────────────────────────────────

    public function test_a_successful_login_is_recorded(): void
    {
        $user = $this->createUser(['email' => 'jane@example.com']);

        $this->postJson('/api/auth/login', [
            'email' => 'jane@example.com',
            'password' => 'password',
        ])->assertOk();

        $entry = LoginHistory::query()->latest('login_history_id')->first();

        $this->assertNotNull($entry);
        $this->assertSame($user->user_id, $entry->user_id);
        $this->assertSame('jane@example.com', $entry->email);
        $this->assertSame(LoginHistory::OUTCOME_SUCCESS, $entry->outcome);
        $this->assertNull($entry->reason);
    }

    public function test_a_wrong_password_is_recorded_against_the_account(): void
    {
        $user = $this->createUser(['email' => 'jane@example.com']);

        $this->postJson('/api/auth/login', [
            'email' => 'jane@example.com',
            'password' => 'not-the-password',
        ])->assertUnauthorized();

        $entry = LoginHistory::query()->latest('login_history_id')->first();

        $this->assertNotNull($entry);
        $this->assertSame($user->user_id, $entry->user_id);
        $this->assertSame(LoginHistory::OUTCOME_FAILED, $entry->outcome);
        $this->assertSame(LoginHistory::REASON_INVALID_CREDENTIALS, $entry->reason);
    }

    /**
     * The case tbllog could not hold: an attempt on an address that matches
     * no account, which is the shape a credential-stuffing run takes.
     */
    public function test_an_attempt_on_an_unknown_address_is_recorded_without_a_user(): void
    {
        $this->postJson('/api/auth/login', [
            'email' => 'nobody@example.com',
            'password' => 'whatever',
        ])->assertUnauthorized();

        $entry = LoginHistory::query()->latest('login_history_id')->first();

        $this->assertNotNull($entry);
        $this->assertNull($entry->user_id);
        $this->assertSame('nobody@example.com', $entry->email);
        $this->assertSame(LoginHistory::REASON_UNKNOWN_EMAIL, $entry->reason);
    }

    public function test_an_attempt_on_a_suspended_account_is_distinguished(): void
    {
        $user = $this->createUser(['email' => 'jane@example.com', 'status' => 'suspended']);

        $this->postJson('/api/auth/login', [
            'email' => 'jane@example.com',
            'password' => 'password',
        ])->assertUnauthorized();

        $entry = LoginHistory::query()->latest('login_history_id')->first();

        $this->assertSame($user->user_id, $entry->user_id);
        $this->assertSame(LoginHistory::REASON_INACTIVE_ACCOUNT, $entry->reason);
    }

    /**
     * The reason is for the log only. A caller must not be able to tell an
     * unknown address apart from a wrong password.
     */
    public function test_the_login_response_does_not_reveal_why_it_failed(): void
    {
        $this->createUser(['email' => 'jane@example.com']);

        $known = $this->postJson('/api/auth/login', [
            'email' => 'jane@example.com',
            'password' => 'wrong',
        ])->assertUnauthorized();

        $unknown = $this->postJson('/api/auth/login', [
            'email' => 'nobody@example.com',
            'password' => 'wrong',
        ])->assertUnauthorized();

        $this->assertSame($known->json('message'), $unknown->json('message'));
        $this->assertStringNotContainsStringIgnoringCase('exist', (string) $known->json('message'));
    }

    public function test_the_client_address_is_recorded(): void
    {
        $this->createUser(['email' => 'jane@example.com']);

        $this->withServerVariables(['REMOTE_ADDR' => '203.0.113.9'])
            ->postJson('/api/auth/login', [
                'email' => 'jane@example.com',
                'password' => 'password',
            ])->assertOk();

        $this->assertSame(
            '203.0.113.9',
            LoginHistory::query()->latest('login_history_id')->value('ip_address')
        );
    }

    // ─── The signed-in user's own history ────────────────────────────

    public function test_a_user_can_read_their_own_history_without_any_permission(): void
    {
        $user = $this->createUser();
        $this->entryFor($user, LoginHistory::OUTCOME_SUCCESS);

        $this->actingAs($user, 'api');
        $this->withoutMiddleware(ValidateAuthVersion::class)
            ->getJson('/api/login-history/me')
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonCount(1, 'data');
    }

    public function test_own_history_requires_authentication(): void
    {
        $this->getJson('/api/login-history/me')->assertUnauthorized();
    }

    public function test_own_history_never_includes_another_users_entries(): void
    {
        $user = $this->createUser();
        $other = $this->createUser();

        $this->entryFor($user, LoginHistory::OUTCOME_SUCCESS);
        $this->entryFor($other, LoginHistory::OUTCOME_SUCCESS);
        $this->entryFor($other, LoginHistory::OUTCOME_FAILED);

        $this->actingAs($user, 'api');
        $payload = $this->withoutMiddleware(ValidateAuthVersion::class)
            ->getJson('/api/login-history/me')
            ->assertOk()
            ->json('data');

        $this->assertCount(1, $payload);
        $this->assertSame($user->email, $payload[0]['email']);
    }

    public function test_own_history_reports_recent_failed_attempts(): void
    {
        $user = $this->createUser();
        $this->entryFor($user, LoginHistory::OUTCOME_FAILED);
        $this->entryFor($user, LoginHistory::OUTCOME_FAILED);
        $this->entryFor($user, LoginHistory::OUTCOME_SUCCESS);

        $this->actingAs($user, 'api');
        $this->withoutMiddleware(ValidateAuthVersion::class)
            ->getJson('/api/login-history/me')
            ->assertOk()
            ->assertJsonPath('meta.recent_failures', 2);
    }

    /**
     * The full agent string is for the administrator view. Someone reading
     * their own history gets the short label only.
     */
    public function test_own_history_omits_the_raw_user_agent(): void
    {
        $user = $this->createUser();
        $this->entryFor($user, LoginHistory::OUTCOME_SUCCESS);

        $this->actingAs($user, 'api');
        $data = $this->withoutMiddleware(ValidateAuthVersion::class)
            ->getJson('/api/login-history/me')
            ->assertOk()
            ->json('data');

        $this->assertArrayNotHasKey('user_agent', $data[0]);
        $this->assertArrayHasKey('device_label', $data[0]);
    }

    // ─── The administrator view ──────────────────────────────────────

    public function test_the_full_list_requires_the_logs_permission(): void
    {
        $user = $this->createUserWithPermissions(['users.view']);

        $this->actingAs($user, 'api');
        $this->withoutMiddleware(ValidateAuthVersion::class)
            ->getJson('/api/login-history')
            ->assertForbidden();
    }

    public function test_an_administrator_sees_every_account(): void
    {
        $admin = $this->createUserWithPermissions(['logs.view']);
        $other = $this->createUser();

        $this->entryFor($other, LoginHistory::OUTCOME_SUCCESS);
        $this->entryFor($admin, LoginHistory::OUTCOME_FAILED);

        $this->actingAs($admin, 'api');
        $this->withoutMiddleware(ValidateAuthVersion::class)
            ->getJson('/api/login-history')
            ->assertOk()
            ->assertJsonPath('meta.total', 2);
    }

    public function test_the_list_can_be_filtered_by_outcome(): void
    {
        $admin = $this->createUserWithPermissions(['logs.view']);
        $this->entryFor($admin, LoginHistory::OUTCOME_SUCCESS);
        $this->entryFor($admin, LoginHistory::OUTCOME_FAILED);

        $this->actingAs($admin, 'api');
        $data = $this->withoutMiddleware(ValidateAuthVersion::class)
            ->getJson('/api/login-history?outcome=failed')
            ->assertOk()
            ->json('data');

        $this->assertCount(1, $data);
        $this->assertSame('failed', $data[0]['outcome']);
    }

    public function test_the_list_can_be_filtered_by_user(): void
    {
        $admin = $this->createUserWithPermissions(['logs.view']);
        $other = $this->createUser();

        $this->entryFor($admin, LoginHistory::OUTCOME_SUCCESS);
        $this->entryFor($other, LoginHistory::OUTCOME_SUCCESS);

        $this->actingAs($admin, 'api');
        $data = $this->withoutMiddleware(ValidateAuthVersion::class)
            ->getJson("/api/login-history?user_id={$other->user_id}")
            ->assertOk()
            ->json('data');

        $this->assertCount(1, $data);
        $this->assertSame($other->email, $data[0]['email']);
    }

    public function test_an_end_date_before_the_start_date_is_rejected(): void
    {
        $admin = $this->createUserWithPermissions(['logs.view']);

        $this->actingAs($admin, 'api');
        $this->withoutMiddleware(ValidateAuthVersion::class)
            ->getJson('/api/login-history?from=2026-08-10&to=2026-08-01')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('to');
    }

    public function test_the_administrator_list_names_the_account_holder(): void
    {
        $admin = $this->createUserWithPermissions(['logs.view']);
        $this->entryFor($admin, LoginHistory::OUTCOME_SUCCESS);

        $this->actingAs($admin, 'api');
        $this->withoutMiddleware(ValidateAuthVersion::class)
            ->getJson('/api/login-history')
            ->assertOk()
            ->assertJsonPath('data.0.user.name', $admin->name);
    }

    // ─── Retention ───────────────────────────────────────────────────

    public function test_pruning_removes_only_entries_past_the_retention_period(): void
    {
        $user = $this->createUser();

        $old = $this->entryFor($user, LoginHistory::OUTCOME_SUCCESS);
        $old->forceFill(['created_at' => now()->subDays(120)])->save();

        $recent = $this->entryFor($user, LoginHistory::OUTCOME_SUCCESS);

        $this->artisan('login-history:prune', ['--days' => 90])
            ->assertSuccessful();

        $this->assertDatabaseMissing('tbllogin_history', ['login_history_id' => $old->login_history_id]);
        $this->assertDatabaseHas('tbllogin_history', ['login_history_id' => $recent->login_history_id]);
    }

    public function test_pruning_rejects_a_retention_period_below_one_day(): void
    {
        $this->artisan('login-history:prune', ['--days' => 0])
            ->assertFailed();
    }

    // ─── Helpers ─────────────────────────────────────────────────────

    private function entryFor(User $user, string $outcome): LoginHistory
    {
        return LoginHistory::create([
            'user_id' => $user->user_id,
            'email' => $user->email,
            'outcome' => $outcome,
            'reason' => $outcome === LoginHistory::OUTCOME_FAILED
                ? LoginHistory::REASON_INVALID_CREDENTIALS
                : null,
            'ip_address' => '203.0.113.5',
            'user_agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        ]);
    }

    private function createUser(array $attributes = []): User
    {
        return User::create(array_merge([
            'first_name' => 'Test',
            'last_name' => 'User',
            'email' => fake()->unique()->safeEmail(),
            'password' => Hash::make('password'),
            'status' => 'active',
        ], $attributes));
    }

    /**
     * @param  list<string>  $codes
     */
    private function createUserWithPermissions(array $codes): User
    {
        $role = Role::create([
            'role_name' => 'Role ' . fake()->unique()->word(),
            'is_assignable' => true,
            'is_protected' => false,
        ]);

        foreach ($codes as $code) {
            $permission = Permission::firstOrCreate(
                ['code' => $code],
                [
                    'permission_name' => $code,
                    'description' => $code,
                    'module' => explode('.', $code)[0],
                ]
            );
            $role->permissions()->attach($permission->permission_id);
        }

        return $this->createUser(['role_id' => $role->role_id]);
    }
}
