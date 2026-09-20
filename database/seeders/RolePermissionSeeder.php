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
            'dashboard.view',
            'users.assign_roles',
            'strategic_records.view', 'strategic_records.manage', 'strategic_records.create',
            'strategic_records.update', 'strategic_records.archive',
            'strategic_foundations.view', 'strategic_foundations.manage', 'strategic_foundations.create',
            'strategic_foundations.update',
            'strategic_objectives.view', 'strategic_objectives.create',
            'strategic_objectives.update',
            'strategic_documents.view', 'strategic_documents.upload', 'strategic_documents.download',
            'relations.view', 'relations.manage', 'relations.create', 'relations.update',
            'plan_core_values.view', 'plan_core_values.manage', 'plan_core_values.create',
            'plan_core_values.update',
        ];

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
            'logs.view',
            'login_history.view',
        ];

        $viewOnlyPermissions = [
            'dashboard.view',
            'strategic_records.view', 'strategic_foundations.view', 'strategic_objectives.view',
            'strategic_documents.view', 'strategic_documents.download',
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
                throw new RuntimeException("Missing {$roleName} permissions: ".implode(', ', $missing));
            }

            $role->permissions()->syncWithoutDetaching(
                $permissionsByCode
                    ->filter(fn (Permission $permission) => in_array($permission->code, $codes, true))
                    ->pluck('permission_id')
                    ->all()
            );
        }

        // These contributor roles may create, review, update, and archive,
        // but must never retain a permission whose action is Delete. The
        // explicit detach is required because syncWithoutDetaching above does
        // not revoke permissions assigned by an earlier seeder run.
        $restrictedRoleNames = [
            'Planning Officer',
            'Planner/Encoder',
            'Office Representative',
            'Office/Agency',
            'Offices / Agencies',
        ];

        $deletePermissionIds = $permissionsByCode
            ->filter(fn (Permission $permission) => str_ends_with($permission->code, '.delete'))
            ->pluck('permission_id')
            ->all();

        Role::query()
            ->whereIn('role_name', $restrictedRoleNames)
            ->each(fn (Role $role) => $role->permissions()->detach($deletePermissionIds));

        $documentPermissionIds = $permissionsByCode
            ->filter(fn (Permission $permission) => str_starts_with($permission->code, 'strategic_documents.'))
            ->pluck('permission_id')
            ->all();

        Role::query()
            ->whereIn('role_name', $restrictedRoleNames)
            ->each(fn (Role $role) => $role->permissions()->syncWithoutDetaching($documentPermissionIds));

        $this->call(ObjectiveCollaborationPermissionSeeder::class);
    }
}
