<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Seeder;

class ObjectiveCollaborationPermissionSeeder extends Seeder
{
    public function run(): void
    {
        $permissions = [
            'strategic_objectives.assign_responsible_unit' => 'Assign Responsible Units',
            'objective_comments.create' => 'Add Objective Comments',
            'objective_comments.view_all' => 'View All Objective Comments',
            'implementation_inputs.create' => 'Submit Implementation Inputs',
            'implementation_inputs.view_all' => 'View All Implementation Inputs',
        ];
        foreach ($permissions as $code => $name) {
            Permission::firstOrCreate(['code' => $code], [
                'permission_name' => $name, 'description' => $name,
                'module' => explode('.', $code)[0],
            ]);
        }

        Role::firstOrCreate(['role_name' => 'Responsible Unit User'], [
            'description' => 'Submits implementation feedback for objectives assigned to their office.',
            'is_assignable' => true, 'is_protected' => false,
        ]);
        $assignments = [
            'Administrator' => array_keys($permissions),
            'Planning Officer' => ['strategic_objectives.assign_responsible_unit', 'objective_comments.view_all', 'implementation_inputs.view_all'],
        ];
        foreach (['Responsible Unit User', 'Office Representative', 'Office/Agency', 'Offices / Agencies'] as $roleName) {
            $assignments[$roleName] = ['strategic_records.view', 'strategic_objectives.view', 'objective_comments.create', 'implementation_inputs.create'];
        }
        foreach ($assignments as $roleName => $codes) {
            $role = Role::where('role_name', $roleName)->first();
            $role?->permissions()->syncWithoutDetaching(Permission::whereIn('code', $codes)->pluck('permission_id')->all());
        }
    }
}
