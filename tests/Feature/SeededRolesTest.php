<?php

namespace Tests\Feature;

use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\RolesSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class SeededRolesTest extends TestCase
{
    use RefreshDatabase;

    public function test_complete_seeding_is_repeatable_and_provisions_only_the_six_defaults(): void
    {
        $this->seed(DatabaseSeeder::class);
        $grantCount = DB::table('tblrole_permissions')->count();
        $this->seed(DatabaseSeeder::class);

        $this->assertEqualsCanonicalizing([
            'Administrator', 'test', 'Planning Officer', 'Management', 'Office', 'Technical Administrator',
        ], Role::pluck('role_name')->all());
        $this->assertSame($grantCount, DB::table('tblrole_permissions')->count());
        $this->assertDatabaseCount('tblusers', 4);
        $this->assertSame('Office', User::where('email', 'testviewer@example.com')->firstOrFail()->role->role_name);

        $readOnlyCodes = [
            'dashboard.view', 'strategic_records.view', 'strategic_foundations.view', 'strategic_objectives.view',
            'strategic_documents.view', 'strategic_documents.download', 'relations.view', 'plan_core_values.view',
        ];
        foreach (['Management', 'Office'] as $name) {
            $this->assertEqualsCanonicalizing($readOnlyCodes, Role::where('role_name', $name)->firstOrFail()->permissions->pluck('code')->all());
        }

        $test = Role::where('role_name', 'test')->firstOrFail();
        $this->assertEqualsCanonicalizing(Permission::pluck('permission_id')->all(), $test->permissions->pluck('permission_id')->all());
        $this->assertTrue($test->isPrivileged());
        $this->assertTrue($test->is_protected);
        $this->assertFalse(Role::where('role_name', 'Planning Officer')->firstOrFail()->permissions()->where('code', 'like', '%.delete')->exists());
        $this->assertFalse(Role::where('role_name', 'Technical Administrator')->firstOrFail()->permissions()->where('code', 'strategic_records.create')->exists());
    }

    public function test_reseeding_renames_existing_roles_without_losing_users_permissions_or_workflows(): void
    {
        foreach (['Division Head' => 'Management', 'Viewer' => 'Office'] as $oldName => $newName) {
            $role = Role::create(['role_name' => $oldName]);
            $user = $this->user($role);
            $permission = Permission::create(['code' => 'custom.'.$role->role_id, 'permission_name' => 'Existing grant', 'module' => 'custom']);
            $role->permissions()->attach($permission);
            $stage = DB::table('approval_workflow_stages')->insertGetId([
                'workflow_id' => 1, 'name' => 'Existing stage', 'sequence' => $role->role_id, 'role_id' => $role->role_id,
            ]);

            $this->seed(RolesSeeder::class);

            $this->assertSame($newName, $role->fresh()->role_name);
            $this->assertSame($role->role_id, $user->fresh()->role_id);
            $this->assertSame(2, $user->fresh()->auth_version);
            $this->assertSame([$permission->permission_id], $role->fresh()->permissions->pluck('permission_id')->all());
            $this->assertDatabaseHas('approval_workflow_stages', ['id' => $stage, 'role_id' => $role->role_id]);
            $this->assertDatabaseMissing('tblroles', ['role_name' => $oldName]);
        }
    }

    public function test_upgrade_merges_previously_seeded_duplicate_names_and_keeps_existing_custom_roles(): void
    {
        $old = Role::create(['role_name' => 'Viewer']);
        $new = Role::create(['role_name' => 'Office']);
        $legacy = Role::create(['role_name' => 'Responsible Unit User']);
        $oldUser = $this->user($old);
        $newUser = $this->user($new);
        $test = Role::create(['role_name' => 'test']);
        $testUser = $this->user($test);
        foreach ([$old, $new] as $role) {
            $permission = Permission::create(['code' => 'custom.'.$role->role_id, 'permission_name' => 'Existing grant', 'module' => 'custom']);
            $role->permissions()->attach($permission);
        }
        DB::table('approval_workflow_stages')->insert([
            'workflow_id' => 1, 'name' => 'Duplicate role stage', 'sequence' => 1, 'role_id' => $new->role_id,
        ]);

        $migration = require database_path('migrations/2026_09_22_000001_align_seeded_role_names.php');
        $migration->up();
        $migration->up();

        $this->assertDatabaseMissing('tblroles', ['role_id' => $new->role_id]);
        $this->assertSame('Office', $old->fresh()->role_name);
        $this->assertSame($old->role_id, $newUser->fresh()->role_id);
        $this->assertSame($old->role_id, $oldUser->fresh()->role_id);
        $this->assertSame(2, $newUser->fresh()->auth_version);
        $this->assertSame(2, $old->permissions()->count());
        $this->assertDatabaseHas('approval_workflow_stages', ['role_id' => $old->role_id]);
        $this->assertDatabaseHas('approval_workflows', ['id' => 1, 'version' => 1]);
        $this->assertSame(Permission::count(), $test->permissions()->count());
        $this->assertGreaterThan(1, $testUser->fresh()->auth_version);
        $this->assertNotNull($legacy->fresh());
    }

    public function test_test_account_can_access_administration_planning_and_collaboration_endpoints(): void
    {
        $this->seed(DatabaseSeeder::class);
        $this->authenticateApiUser(User::where('email', 'test@example.com')->firstOrFail());

        foreach (['/api/roles', '/api/permissions', '/api/users', '/api/settings', '/api/security-settings',
            '/api/approval-workflow', '/api/strategic-plans', '/api/strategic-objective-progress', '/api/implementation-inputs'] as $url) {
            $this->getJson($url)->assertOk();
        }
    }

    public function test_renamed_roles_can_read_plans_but_cannot_gain_write_or_administration_access(): void
    {
        $this->seed(DatabaseSeeder::class);
        foreach (['Management', 'Office'] as $name) {
            $this->authenticateApiUser($this->user(Role::where('role_name', $name)->firstOrFail()));
            $this->getJson('/api/strategic-plans')->assertOk();
            $this->getJson('/api/roles')->assertForbidden();
            $this->getJson('/api/approval-workflow')->assertForbidden();
            $this->getJson('/api/implementation-inputs')->assertForbidden();
            $this->postJson('/api/strategic-plans', ['level' => 'strategic_plan', 'title' => 'Not permitted'])->assertForbidden();
        }
    }

    private function user(Role $role): User
    {
        return User::create([
            'first_name' => 'Existing', 'email' => fake()->unique()->safeEmail(), 'password' => 'password',
            'role_id' => $role->role_id, 'status' => 'active',
        ]);
    }
}
