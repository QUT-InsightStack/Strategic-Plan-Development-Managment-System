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

<<<<<<< Updated upstream
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
            'strategic_records.view',
            'strategic_records.manage',
            'strategic_records.create',
            'strategic_records.update',
            'strategic_records.delete',
            'strategic_records.archive',
            'strategic_foundations.view',
            'strategic_foundations.manage',
            'strategic_foundations.create',
            'strategic_foundations.update',
            'strategic_foundations.delete',
            'strategic_objectives.view',
            'strategic_objectives.create',
            'strategic_objectives.update',
            'strategic_objectives.delete',
            'relations.view',
            'relations.manage',
            'relations.create',
            'relations.update',
            'relations.delete',
            'plan_core_values.view',
            'plan_core_values.manage',
            'plan_core_values.create',
            'plan_core_values.update',
            'plan_core_values.delete',
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
            $planningOfficerPermissionCodes = [
                'users.assign_roles',
=======
        $assignments = [
            'Administrator' => $permissionsByCode->keys()->all(),
            'test' => $permissionsByCode->keys()->all(),
            'Planning Officer' => [
>>>>>>> Stashed changes
                'strategic_records.view',
                'strategic_records.manage',
                'strategic_records.create',
                'strategic_records.update',
                'strategic_records.delete',
                'strategic_records.archive',
                'strategic_foundations.view',
                'strategic_foundations.manage',
                'strategic_foundations.create',
                'strategic_foundations.update',
                'strategic_foundations.delete',
                'strategic_objectives.view',
                'strategic_objectives.create',
                'strategic_objectives.update',
                'strategic_objectives.delete',
                'relations.view',
                'relations.manage',
                'relations.create',
                'relations.update',
                'relations.delete',
                'plan_core_values.view',
                'plan_core_values.manage',
                'plan_core_values.create',
                'plan_core_values.update',
                'plan_core_values.delete',
            ];

            $planningOfficerPermissions = Permission::query()
                ->whereIn('code', $planningOfficerPermissionCodes)
                ->get();

            if ($planningOfficerPermissions->count() !== count($planningOfficerPermissionCodes)) {
                $missingCodes = array_values(array_diff(
                    $planningOfficerPermissionCodes,
                    $planningOfficerPermissions->pluck('code')->all()
                ));

                throw new RuntimeException(
                    'Missing Planning Officer permissions: ' . implode(', ', $missingCodes)
                );
            }

            $planningOfficer->permissions()->syncWithoutDetaching(
                $planningOfficerPermissions->pluck('permission_id')->all()
            );
        }

        $viewOnlyPermissionCodes = [
            'strategic_records.view',
            'strategic_foundations.view',
            'strategic_objectives.view',
            'relations.view',
            'plan_core_values.view',
        ];

        $viewOnlyPermissions = Permission::query()
            ->whereIn('code', $viewOnlyPermissionCodes)
            ->get();

        if ($viewOnlyPermissions->count() !== count($viewOnlyPermissionCodes)) {
            $missingCodes = array_values(array_diff(
                $viewOnlyPermissionCodes,
                $viewOnlyPermissions->pluck('code')->all()
            ));

            throw new RuntimeException(
                'Missing view-only permissions: ' . implode(', ', $missingCodes)
            );
        }

        foreach (['Division Head', 'Viewer'] as $roleName) {
            $role = Role::query()->where('role_name', $roleName)->first();

            if ($role) {
                $role->permissions()->syncWithoutDetaching(
                    $viewOnlyPermissions->pluck('permission_id')->all()
                );
            }
        }
    }
}
