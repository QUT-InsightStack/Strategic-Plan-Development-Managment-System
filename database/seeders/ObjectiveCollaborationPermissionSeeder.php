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
            'implementation_inputs.view' => 'View Submitted Implementation Inputs',
            'implementation_inputs.review' => 'Review Implementation Inputs',
            'implementation_inputs.manage_scope' => 'Manage Input Planning Scope',
        ];
        foreach ($permissions as $code => $name) {
            Permission::firstOrCreate(['code' => $code], [
                'permission_name' => $name, 'description' => $name,
                'module' => explode('.', $code)[0],
            ]);
        }

        // Preserve grants for existing collaboration roles without creating
        // another default role. Office retains the former Viewer's access.
        $assignments = [
            'Administrator' => array_keys($permissions),
            'Planning Officer' => ['strategic_objectives.assign_responsible_unit', 'objective_comments.view_all', 'implementation_inputs.view_all', 'implementation_inputs.view', 'implementation_inputs.review'],
        ];
        foreach (['Responsible Unit User', 'Office Representative', 'Office/Agency', 'Offices / Agencies'] as $roleName) {
            $assignments[$roleName] = ['strategic_records.view', 'strategic_objectives.view', 'objective_comments.create', 'implementation_inputs.create', 'implementation_inputs.view'];
        }
        foreach ($assignments as $roleName => $codes) {
            $role = Role::where('role_name', $roleName)->first();
            $role?->permissions()->syncWithoutDetaching(Permission::whereIn('code', $codes)->pluck('permission_id')->all());
        }
    }
}
