<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Seeder;

class RolePermissionSeeder extends Seeder
{
    public function run(): void
    {
        $permissionsByCode = Permission::query()->get()->keyBy('code');

        $assignments = [
            'Administrator' => $permissionsByCode->keys()->all(),
            'Planning Officer' => [
                'strategic_records.view',
                'strategic_records.create',
                'strategic_records.update',
                'strategic_records.delete',
                'strategic_objectives.view',
                'strategic_objectives.create',
                'strategic_objectives.update',
                'strategic_objectives.delete',
                'strategic_foundations.view',
                'strategic_foundations.create',
                'strategic_foundations.update',
                'strategic_foundations.delete',
                'relations.view',
                'relations.create',
                'relations.update',
                'relations.delete',
                'plan_core_values.view',
                'plan_core_values.create',
                'plan_core_values.update',
                'plan_core_values.delete',
                'dashboard.view',
                'reports.view',
            ],
            'Division Head' => [
                'strategic_records.view',
                'strategic_records.archive',
                'strategic_objectives.view',
                'strategic_foundations.view',
                'relations.view',
                'plan_core_values.view',
                'dashboard.view',
                'reports.view',
            ],
            'Viewer' => [
                'strategic_records.view',
                'strategic_objectives.view',
                'strategic_foundations.view',
                'relations.view',
                'plan_core_values.view',
                'dashboard.view',
                'reports.view',
            ],
        ];

        foreach ($assignments as $roleName => $codes) {
            $role = Role::where('role_name', $roleName)->first();

            if (! $role) {
                continue;
            }

            $permissionIds = collect($codes)
                ->map(fn (string $code) => $permissionsByCode->get($code)?->permission_id)
                ->filter()
                ->values()
                ->all();

            $role->permissions()->sync($permissionIds);
        }
    }
}
