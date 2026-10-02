<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
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
            'strategic_alignments.archive',
            'strategic_documents.view', 'strategic_documents.upload', 'strategic_documents.download',
            'relations.view', 'relations.manage', 'relations.create', 'relations.update',
            'plan_core_values.view', 'plan_core_values.manage', 'plan_core_values.create',
            'plan_core_values.update',
        ];

        $technicalPermissions = [
            'dashboard.view',
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
            'system_monitoring.view',
            'backups.view',
            'backups.create',
            'backups.download',
            'backups.restore',
            'strategic_alignments.delete',
        ];

        $managementPermissions = [
            'dashboard.view',
            'strategic_records.view', 'strategic_foundations.view', 'strategic_objectives.view',
            'strategic_documents.view', 'strategic_documents.download',
            'relations.view', 'plan_core_values.view',
        ];

        $administrativeAdminPermissions = [
            'dashboard.view',
            'reference_data.manage',
            'pdp_chapters.manage', 'pdp_chapters.archive', 'pdp_chapters.delete',
            'presidential_agenda.view', 'presidential_agenda.manage',
            'presidential_agenda.archive', 'presidential_agenda.delete',
            'templates.manage', 'monitoring.view', 'reports.view', 'logs.view',
        ];

        $viewOnlyPermissions = [
            'dashboard.view',
            'strategic_records.view', 'strategic_foundations.view', 'strategic_objectives.view',
            'strategic_documents.view', 'strategic_documents.download',
            'relations.view', 'plan_core_values.view',
        ];

        $assignments = [
            'Administrator' => $permissionsByCode->keys()->all(),
            'test' => $permissionsByCode->keys()->all(),
            'Technical Administrator' => $technicalPermissions,
            'Administrative Admin' => $administrativeAdminPermissions,
            'Management' => $managementPermissions,
            'Planning Officer' => $planningPermissions,
            'Office' => array_merge($viewOnlyPermissions, ['strategic_documents.upload']),
        ];

        // Office accounts use several legacy role names in existing data. Keep
        // their page visibility and progress-update grants aligned as well.
        foreach (['Office', 'Responsible Unit User', 'Office Representative', 'Office/Agency', 'Offices / Agencies'] as $roleName) {
            $assignments[$roleName] = array_values(array_unique(array_merge(
                $viewOnlyPermissions,
                ['strategic_documents.upload', 'strategic_objectives.view_progress', 'strategic_objectives.update_progress']
            )));
        }

        foreach ($assignments as $roleName => $codes) {
            $role = Role::query()->where('role_name', $roleName)->first();
            if (! $role) {
                continue;
            }

            $missing = array_values(array_diff($codes, $permissionsByCode->keys()->all()));
            if ($missing !== []) {
                throw new RuntimeException("Missing {$roleName} permissions: ".implode(', ', $missing));
            }

            $changes = $role->permissions()->syncWithoutDetaching(
                $permissionsByCode
                    ->filter(fn (Permission $permission) => in_array($permission->code, $codes, true))
                    ->pluck('permission_id')
                    ->all()
            );
            
            if (($changes['attached'] ?? []) !== []) {
                DB::table('tblusers')
                    ->where('role_id', $role->role_id)
                    ->increment('auth_version');
            }
        }

        // Contributor roles must not retain delete rights; Management is
        // read-only and must not retain alignment deletion from older seeds.
        // The explicit detach is required because syncWithoutDetaching above does
        // not revoke permissions assigned by an earlier seeder run.
        $restrictedRoleNames = [
            'Management',
            'Planning Officer',
            'Planner/Encoder',
            'Office Representative',
            'Office/Agency',
            'Offices / Agencies',
            'Office',
        ];

        $deletePermissionIds = $permissionsByCode
            ->filter(fn (Permission $permission) => str_ends_with($permission->code, '.delete'))
            ->pluck('permission_id')
            ->all();

        Role::query()
        ->whereIn('role_name', $restrictedRoleNames)
        ->each(function (Role $role) use ($deletePermissionIds): void {
            if ($role->permissions()->detach($deletePermissionIds) > 0) {
                DB::table('tblusers')
                    ->where('role_id', $role->role_id)
                    ->increment('auth_version');
            }
        });

        $documentPermissionIds = $permissionsByCode
            ->filter(fn (Permission $permission) => str_starts_with($permission->code, 'strategic_documents.'))
            ->pluck('permission_id')
            ->all();

        Role::query()
        ->whereIn('role_name', $restrictedRoleNames)
        ->each(function (Role $role) use ($documentPermissionIds): void {
            $changes = $role->permissions()->syncWithoutDetaching($documentPermissionIds);
    
            if (($changes['attached'] ?? []) !== []) {
                DB::table('tblusers')
                    ->where('role_id', $role->role_id)
                    ->increment('auth_version');
            }
        });

        $this->call(ObjectiveCollaborationPermissionSeeder::class);
        $this->call(ObjectiveProgressPermissionSeeder::class);

        // Include permissions created by the feature seeders above as well.
        $testRole = Role::query()->where('role_name', 'test')->first();

        if ($testRole) {
            $changes = $testRole->permissions()->syncWithoutDetaching(
                Permission::query()->pluck('permission_id')->all()
            );

            if (($changes['attached'] ?? []) !== []) {
                DB::table('tblusers')
                    ->where('role_id', $testRole->role_id)
                    ->increment('auth_version');
            }
        }
    }
}
