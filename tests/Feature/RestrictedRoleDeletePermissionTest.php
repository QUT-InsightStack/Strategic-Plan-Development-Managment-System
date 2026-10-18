<?php

namespace Tests\Feature;

use App\Models\Permission;
use App\Models\Role;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\RolesSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RestrictedRoleDeletePermissionTest extends TestCase
{
    use RefreshDatabase;

    public function test_planner_and_office_roles_do_not_retain_any_delete_permissions(): void
    {
        $this->seed([
            PermissionSeeder::class,
            RolesSeeder::class,
        ]);

        $restrictedRoleNames = [
            'Planning Officer',
            'Planner/Encoder',
            'Office Representative',
            'Office/Agency',
            'Offices / Agencies',
        ];

        foreach ($restrictedRoleNames as $roleName) {
            Role::query()->firstOrCreate(
                ['role_name' => $roleName],
                [
                    'description' => 'Planning contributor test role.',
                    'is_assignable' => true,
                    'is_protected' => false,
                ]
            );
        }

        $deletePermissionIds = Permission::query()
            ->where('code', 'like', '%.delete')
            ->pluck('permission_id')
            ->all();

        Role::query()
            ->whereIn('role_name', $restrictedRoleNames)
            ->each(fn (Role $role) => $role->permissions()->attach($deletePermissionIds));

        $this->seed(RolePermissionSeeder::class);

        foreach ($restrictedRoleNames as $roleName) {
            $role = Role::query()->where('role_name', $roleName)->firstOrFail();

            $this->assertFalse(
                $role->permissions()->where('code', 'like', '%.delete')->exists(),
                "{$roleName} still has a Delete permission."
            );
        }

        $planningOfficer = Role::query()
            ->where('role_name', 'Planning Officer')
            ->firstOrFail();

        $this->assertTrue(
            $planningOfficer->permissions()->where('code', 'strategic_records.archive')->exists()
        );

        $administrator = Role::query()
            ->where('role_name', 'Administrator')
            ->firstOrFail();

        $this->assertTrue(
            $administrator->permissions()->where('code', 'strategic_records.delete')->exists()
        );
    }
}
