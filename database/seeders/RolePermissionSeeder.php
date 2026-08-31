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
        $permissionsByCode = Permission::query()->get()->keyBy('code');

        $planningPermissions = [
            'users.assign_roles',
            'strategic_records.view', 'strategic_records.manage', 'strategic_records.create',
            'strategic_records.update', 'strategic_records.delete', 'strategic_records.archive',
            'strategic_foundations.view', 'strategic_foundations.manage', 'strategic_foundations.create',
            'strategic_foundations.update', 'strategic_foundations.delete',
            'strategic_objectives.view', 'strategic_objectives.create',
            'strategic_objectives.update', 'strategic_objectives.delete',
            'relations.view', 'relations.manage', 'relations.create', 'relations.update', 'relations.delete',
            'plan_core_values.view', 'plan_core_values.manage', 'plan_core_values.create',
            'plan_core_values.update', 'plan_core_values.delete',
        ];

        $viewOnlyPermissions = [
            'strategic_records.view', 'strategic_foundations.view', 'strategic_objectives.view',
            'relations.view', 'plan_core_values.view',
        ];

        $assignments = [
            'Administrator' => $permissionsByCode->keys()->all(),
            'Planning Officer' => $planningPermissions,
            'Division Head' => $viewOnlyPermissions,
            'Viewer' => $viewOnlyPermissions,
        ];

        foreach ($assignments as $roleName => $codes) {
            $role = Role::query()->where('role_name', $roleName)->first();
            if (! $role) {
                continue;
            }

            $missing = array_values(array_diff($codes, $permissionsByCode->keys()->all()));
            if ($missing !== []) {
                throw new RuntimeException("Missing {$roleName} permissions: " . implode(', ', $missing));
            }

            $role->permissions()->syncWithoutDetaching(
                $permissionsByCode
                    ->filter(fn (Permission $permission) => in_array($permission->code, $codes, true))
                    ->pluck('permission_id')
                    ->all()
            );
        }
    }
}
