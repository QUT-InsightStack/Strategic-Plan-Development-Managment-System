<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Seeder;

class ObjectiveProgressPermissionSeeder extends Seeder
{
    public function run(): void
    {
        foreach ([
            'view_progress' => 'View strategic objective progress and history',
            'update_progress' => 'Update progress for assigned Office/Unit objectives',
            'correct_progress' => 'Correct any objective progress with an audited reason',
        ] as $action => $description) {
            Permission::firstOrCreate(['code' => 'strategic_objectives.'.$action], [
                'permission_name' => $description, 'description' => $description, 'module' => 'strategic_objectives',
            ]);
        }
        foreach ([
            'Administrator' => ['view_progress', 'correct_progress'],
            'Planning Officer' => ['view_progress', 'correct_progress'],
            'Planner/Encoder' => ['view_progress', 'correct_progress'],
            'Office' => ['view_progress', 'update_progress'],
            'Responsible Unit User' => ['view_progress', 'update_progress'],
            'Office Representative' => ['view_progress', 'update_progress'],
            'Office/Agency' => ['view_progress', 'update_progress'],
            'Offices / Agencies' => ['view_progress', 'update_progress'],
        ] as $role => $actions) {
            Role::where('role_name', $role)->first()?->permissions()->syncWithoutDetaching(
                Permission::whereIn('code', array_map(fn ($action) => 'strategic_objectives.'.$action, $actions))->pluck('permission_id')->all()
            );
        }
    }
}
