<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Seeder;
use RuntimeException;

class RolePermissionSeeder extends Seeder
{
    public function run(): void
    {
        $administrator = Role::query()
            ->where('role_name', 'Administrator')
            ->first();

        if (! $administrator) {
            throw new RuntimeException(
                'The Administrator role must exist before role permissions are seeded.'
            );
        }

        $permissionCodes = [
            'users.view',
            'users.create',
            'users.update',
            'users.delete',
            'users.assign_roles',
            'roles.view',
            'roles.manage',
            'roles.assign_protected',
            'permissions.view',
            'permissions.manage',
        ];

        $permissions = Permission::query()
            ->whereIn('code', $permissionCodes)
            ->get();

        if ($permissions->count() !== count($permissionCodes)) {
            $foundCodes = $permissions->pluck('code')->all();
            $missingCodes = array_values(array_diff($permissionCodes, $foundCodes));

            throw new RuntimeException(
                'Missing permissions: ' . implode(', ', $missingCodes)
            );
        }

        $administrator->permissions()->syncWithoutDetaching(
            $permissions->pluck('permission_id')->all()
        );

        // Optional: permit other approved administrative roles to assign
        // ordinary roles without permitting protected-role assignment.
        $planningOfficer = Role::query()
            ->where('role_name', 'Planning Officer')
            ->first();

        if ($planningOfficer) {
            $ordinaryAssignmentPermission = Permission::query()
                ->where('code', 'users.assign_roles')
                ->first();

            if ($ordinaryAssignmentPermission) {
                $planningOfficer->permissions()->syncWithoutDetaching([
                    $ordinaryAssignmentPermission->permission_id,
                ]);
            }
        }
    }
}
