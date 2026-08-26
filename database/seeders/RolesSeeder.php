<?php

namespace Database\Seeders;

use App\Models\Role;
use Illuminate\Database\Seeder;

class RolesSeeder extends Seeder
{
    public function run(): void
    {
        $roles = [
            [
                'role_name' => 'Administrator',
                'description' => 'Full system access. Manages users, roles, and system configuration.',
                'is_assignable' => true,
                'is_protected' => true,
            ],
            [
                'role_name' => 'Planning Officer',
                'description' => 'Creates and manages strategic plans and performance indicators.',
                'is_assignable' => true,
                'is_protected' => false,
            ],
            [
                'role_name' => 'Division Head',
                'description' => 'Reviews and approves plans within their division.',
                'is_assignable' => true,
                'is_protected' => false,
            ],
            [
                'role_name' => 'Viewer',
                'description' => 'Read-only access to published plans and reports.',
                'is_assignable' => true,
                'is_protected' => false,
            ],
        ];

        foreach ($roles as $role) {
            Role::updateOrCreate(
                ['role_name' => $role['role_name']],
                [
                    'description' => $role['description'],
                    'is_assignable' => $role['is_assignable'],
                    'is_protected' => $role['is_protected'],
                ]
            );
        }
    }
}
