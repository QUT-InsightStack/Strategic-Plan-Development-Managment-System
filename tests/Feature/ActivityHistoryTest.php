<?php

namespace Tests\Feature;

use App\Http\Middleware\ValidateAuthVersion;
use App\Models\Log;
use App\Models\LoginHistory;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\RolesSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class ActivityHistoryTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['jwt.secret' => str_repeat('test-only-secret', 5), 'app.debug' => false]);
    }

    public function test_legacy_json_actions_and_failed_states_are_searchable_without_rewriting_history(): void
    {
        $this->administrator();
        $id = DB::table('tbllog')->insertGetId([
            'operation' => '{"event":"backup.failed","backup_id":42}',
            'states' => 'failed', 'outcome' => 'success',
            'created_at' => now(), 'updated_at' => now(),
        ], 'log_id');
        Log::create(['operation' => 'backup.created', 'states' => 'success']);
        Log::create(['operation' => '{invalid JSON', 'states' => 'success']);
        Log::create(['operation' => '{"event":"backup.failed.extra"}', 'states' => 'failed']);

        $this->getJson('/api/logs?outcome=failure&action=backup.failed')->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.log_id', $id)
            ->assertJsonPath('data.0.action', 'backup.failed')
            ->assertJsonPath('data.0.outcome', 'failure')
            ->assertJsonPath('data.0.metadata.backup_id', 42);
        $this->getJson('/api/logs?outcome=success')->assertOk()->assertJsonPath('meta.total', 2);
        $this->getJson('/api/logs/'.$id)->assertOk()->assertJsonPath('data.outcome', 'failure');
        $this->assertDatabaseHas('tbllog', ['log_id' => $id, 'outcome' => 'success']);
    }

    public function test_new_failed_audit_records_cannot_inherit_success(): void
    {
        $log = Log::create(['operation' => 'test.failed', 'states' => 'failed']);
        $this->assertSame('failure', $log->fresh()->outcome);
        $this->expectException(\LogicException::class);
        $log->update(['outcome' => 'success']);
    }

    public function test_technical_role_seeding_is_idempotent_and_assigns_history_and_monitoring_access(): void
    {
        Role::create(['role_name' => 'Technical Admin']);
        for ($i = 0; $i < 2; $i++) {
            $this->seed([RolesSeeder::class, PermissionSeeder::class, RolePermissionSeeder::class]);
        }
        $this->assertSame(1, Role::where('role_name', 'Technical Administrator')->count());
        foreach (['Technical Administrator', 'Technical Admin', 'test'] as $name) {
            $role = Role::where('role_name', $name)->firstOrFail();
            $this->assertSame(3, $role->permissions()->whereIn('code', [
                'logs.view', 'login_history.view', 'system_monitoring.view',
            ])->count());
        }
        $this->assertFalse(Role::where('role_name', 'Office')->firstOrFail()
            ->permissions()->where('code', 'system_monitoring.view')->exists());
        $this->assertTrue(Role::where('role_name', 'Technical Administrator')->firstOrFail()->isPrivileged());
    }

    public function test_default_accounts_are_assigned_by_role_name_not_numeric_id(): void
    {
        Role::create(['role_name' => 'Existing custom role']);
        $this->seed(DatabaseSeeder::class);
        foreach (['System Administrator' => 'Administrator', 'Planning Officer' => 'Planning Officer', 'Office' => 'Office'] as $position => $roleName) {
            $this->assertSame($roleName, User::where('position', $position)->firstOrFail()->role->role_name);
        }
    }

    public function test_user_deletion_preserves_history_with_the_initialized_audit_foreign_key(): void
    {
        $user = $this->user();
        $log = Log::create(['user_id' => $user->user_id, 'actor_name' => 'Historical Operator', 'operation' => 'user.action']);
        $user->delete();
        $this->assertDatabaseHas('tbllog', ['log_id' => $log->log_id, 'user_id' => null, 'actor_name' => 'Historical Operator']);
        $this->assertSame('Historical Operator', $log->fresh()->actor_name);
    }

    public function test_history_uses_canonical_fields_and_combined_status_date_filters(): void
    {
        $actor = $this->administrator();
        foreach ([['2026-09-01 10:00:00', 'success'], ['2026-09-01 11:00:00', 'failed'], ['2026-09-02 10:00:00', 'success']] as [$time, $status]) {
            LoginHistory::create([
                'user_id' => $actor->user_id, 'user_name' => 'Historical Name', 'email' => $actor->email,
                'status' => $status, 'attempted_at' => $time,
                'failure_reason' => $status === 'failed' ? 'account_locked' : null,
            ]);
        }
        $this->getJson('/api/login-history?status=success&date_from=2026-09-01&date_to=2026-09-01')
            ->assertOk()->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.status', 'success')
            ->assertJsonPath('data.0.user_name', 'Historical Name')
            ->assertJsonPath('data.0.attempted_at', '2026-09-01T10:00:00.000000Z')
            ->assertJsonPath('data.0.failure_reason', null);
        $this->getJson('/api/login-history?date_to=2026-09-01')->assertOk()->assertJsonPath('meta.total', 2);
        $this->getJson('/api/login-history?date_from=2026-09-02&date_to=2026-09-01')->assertUnprocessable();
    }

    public function test_logs_permission_alone_does_not_grant_login_history_access(): void
    {
        $actor = $this->administrator();
        $actor->role->permissions()->detach(DB::table('tblpermissions')->where('code', 'login_history.view')->value('permission_id'));
        $this->getJson('/api/login-history')->assertForbidden();
        $this->getJson('/api/logs')->assertOk();
    }

    public function test_successful_login_records_a_success_and_normalizes_email(): void
    {
        $user = $this->user();
        $this->postJson('/api/auth/login', ['email' => '  '.strtoupper($user->email).'  ', 'password' => 'password'])
            ->assertOk();
        $this->assertDatabaseHas('tbllogin_history', ['email' => $user->email, 'status' => 'success', 'failure_reason' => null]);
    }

    public function test_account_lock_and_repeated_locked_attempts_are_recorded_once_each(): void
    {
        $user = $this->user();
        for ($i = 0; $i < 2; $i++) {
            $this->postJson('/api/auth/login', ['email' => $user->email, 'password' => 'wrong'])->assertUnauthorized();
        }
        for ($i = 0; $i < 2; $i++) {
            $this->postJson('/api/auth/login', ['email' => $user->email, 'password' => 'wrong'])->assertStatus(423);
        }
        $this->assertSame(4, LoginHistory::count());
        $this->assertSame(2, LoginHistory::where('failure_reason', 'account_locked')->count());
        $this->assertSame(2, LoginHistory::where('failure_reason', 'invalid_credentials')->count());
    }

    public function test_throttled_login_is_recorded_once_and_remains_a_429(): void
    {
        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/auth/login', ['email' => 'unknown@example.com', 'password' => 'wrong'])->assertUnauthorized();
        }
        $this->postJson('/api/auth/login', ['email' => ' UNKNOWN@EXAMPLE.COM ', 'password' => 'wrong'])
            ->assertStatus(429)->assertHeader('Retry-After');
        $this->assertSame(6, LoginHistory::count());
        $this->assertSame(1, LoginHistory::where('failure_reason', 'rate_limited')->count());
        $this->assertSame(5, LoginHistory::where('failure_reason', 'unknown_email')->count());
    }

    public function test_inactive_account_reason_is_only_in_protected_history(): void
    {
        $user = $this->user(['status' => 'inactive']);
        $this->postJson('/api/auth/login', ['email' => $user->email, 'password' => 'password'])
            ->assertUnauthorized()->assertJsonMissingPath('failure_reason');
        $this->assertDatabaseHas('tbllogin_history', ['email' => $user->email, 'failure_reason' => 'inactive_account']);
    }

    private function administrator(): User
    {
        $this->seed([RolesSeeder::class, PermissionSeeder::class, RolePermissionSeeder::class]);
        $user = $this->user(['role_id' => Role::where('role_name', 'Technical Administrator')->value('role_id')]);
        $this->actingAs($user, 'api')->withoutMiddleware(ValidateAuthVersion::class);

        return $user;
    }

    private function user(array $attributes = []): User
    {
        return User::create([
            'first_name' => 'Test', 'last_name' => 'Operator', 'email' => 'operator@example.com',
            'password' => 'password', 'status' => 'active', ...$attributes,
        ]);
    }
}
