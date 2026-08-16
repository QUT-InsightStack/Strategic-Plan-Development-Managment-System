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
                'strategic_foundations.view',
                'strategic_foundations.manage',
                'relations.manage',
                'plan_core_values.manage',
                'dashboard.view',
                'reports.view',
            ],
            'Division Head' => [
                'strategic_records.view',
                'strategic_records.archive',
                'dashboard.view',
                'reports.view',
            ],
            'Viewer' => [
                'strategic_records.view',
                'strategic_foundations.view',
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
