<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\RolesSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class ClientRolePermissionCorrectionTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed([
            RolesSeeder::class,
            PermissionSeeder::class,
            RolePermissionSeeder::class,
        ]);
    }

    public function test_management_delete_grants_survive_reseeding(): void
    {
        $this->seed(RolePermissionSeeder::class);

        $codes = Role::where('role_name', 'Management')
            ->firstOrFail()
            ->permissions()
            ->pluck('code')
            ->all();

        foreach ([
            'strategic_records.delete',
            'strategic_objectives.delete',
            'strategic_alignments.delete',
            'pdp_chapters.delete',
            'presidential_agenda.delete',
        ] as $code) {
            $this->assertContains($code, $codes);
        }

        $this->assertNotContains('users.delete', $codes);
        $this->assertNotContains('users.update', $codes);
    }

    public function test_administrative_admin_cannot_retain_agenda_delete_permission(): void
    {
        $role = Role::where('role_name', 'Administrative Admin')
            ->firstOrFail();

        $permissionId = \App\Models\Permission::where(
            'code',
            'presidential_agenda.delete'
        )->firstOrFail()->permission_id;

        $role->permissions()->syncWithoutDetaching([$permissionId]);

        $this->seed(RolePermissionSeeder::class);

        $this->assertFalse(
            $role->permissions()
                ->where('code', 'presidential_agenda.delete')
                ->exists()
        );

        $this->assertTrue(
            $role->permissions()
                ->where('code', 'presidential_agenda.manage')
                ->exists()
        );
    }

    public function test_technical_admin_can_disable_administrative_admin_and_revoke_its_session(): void
    {
        $technical = $this->account('Technical Administrator');
        $administrative = $this->account('Administrative Admin');
        $version = (int) $administrative->fresh()->auth_version;

        $this->authenticateApiUser($administrative);
        $this->getJson('/api/auth/me')->assertOk();

        $this->authenticateApiUser($technical);

        $this->patchJson(
            "/api/users/{$administrative->user_id}/status",
            [
                'status' => 'inactive',
                'reason' => 'Client-approved account administration.',
            ]
        )->assertOk();

        $administrative->refresh();

        $this->assertSame('inactive', $administrative->status);
        $this->assertSame(
            $version + 1,
            (int) $administrative->auth_version
        );

        $this->postJson('/api/auth/login', [
            'email' => $administrative->email,
            'password' => 'AccountTestPassword123!',
        ])->assertUnauthorized();

        $this->assertDatabaseHas('tbllog', [
            'user_id' => $technical->user_id,
            'operation' => 'user.account_status_changed',
            'resource_id' => $administrative->user_id,
            'outcome' => 'success',
        ]);
    }

    public function test_technical_admin_cannot_disable_own_account(): void
    {
        $technical = $this->account('Technical Administrator');
        $this->authenticateApiUser($technical);

        $this->patchJson(
            "/api/users/{$technical->user_id}/status",
            ['status' => 'inactive']
        )->assertUnprocessable();

        $this->assertSame('active', $technical->fresh()->status);
    }

    private function account(string $roleName): User
    {
        return User::create([
            'first_name' => 'Permission',
            'last_name' => 'Test',
            'email' => fake()->unique()->safeEmail(),
            'password' => Hash::make('AccountTestPassword123!'),
            'status' => 'active',
            'role_id' => Role::where('role_name', $roleName)
                ->firstOrFail()->role_id,
        ])->refresh();
    }
}