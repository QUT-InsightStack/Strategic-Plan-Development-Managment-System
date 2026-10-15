<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Seeder;

class ManagementObjectiveCommentPermissionSeeder extends Seeder
{
    public function run(): void
    {
        $definitions = [
            'management_objective_comments.view' =>
                'View Management objective comments',
            'management_objective_comments.create' =>
                'Create Management objective comments',
            'management_objective_comments.acknowledge' =>
                'Acknowledge Management objective comments',
            'management_objective_comments.close' =>
                'Close own Management objective comments',
        ];

        foreach ($definitions as $code => $name) {
            Permission::updateOrCreate(
                ['code' => $code],
                [
                    'permission_name' => $name,
                    'description' => $name,
                    'module' => 'management_objective_comments',
                ]
            );
        }

        $view = ['management_objective_comments.view'];

        $management = [
            ...$view,
            'management_objective_comments.create',
            'management_objective_comments.close',
        ];

        $planner = [
            ...$view,
            'management_objective_comments.acknowledge',
        ];

        $assignments = [
            'Management' => $management,
            'Executive' => $management,
            'Management / Executive' => $management,
            'Division Head' => $management,
            'Planning Officer' => $planner,
            'Planner/Encoder' => $planner,
            'Administrative Admin' => $planner,
            'Administrative Administrator' => $planner,
            'Administrator' => array_keys($definitions),
            'test' => array_keys($definitions),
        ];

        foreach ($assignments as $roleName => $codes) {
            $role = Role::where('role_name', $roleName)->first();

            if ($role) {
                $role->permissions()->syncWithoutDetaching(
                    Permission::whereIn('code', $codes)
                        ->pluck('permission_id')
                        ->all()
                );
            }
        }
    }
}