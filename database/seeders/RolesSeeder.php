<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Support\RoleNameUpgrade;
use Illuminate\Database\Seeder;

class RolesSeeder extends Seeder
{
    public function run(): void
    {
        RoleNameUpgrade::run();

        $roles = [
            [
                'role_name' => 'Administrator',
                'description' => 'Full system access. Manages users, roles, and system configuration.',
                'is_assignable' => true,
                'is_protected' => true,
            ],
            [
                'role_name'   => 'test',
                'description' => 'Test account with full backend access.',
                'is_assignable' => true,
                'is_protected' => true,
            ],
            [
                'role_name'   => 'Planning Officer',
                'description' => 'Creates and manages strategic plans and performance indicators.',
                'is_assignable' => true,
                'is_protected' => false,
            ],
            [
                'role_name' => 'Management',
                'description' => 'Reviews and approves plans within their division.',
                'is_assignable' => true,
                'is_protected' => false,
            ],
            [
                'role_name' => 'Office',
                'description' => 'Read-only access to published plans and reports.',
                'is_assignable' => true,
                'is_protected' => false,
            ],
            [
                'role_name' => 'Technical Administrator',
                'description' => 'Manages accounts, security, backups, and system activity monitoring.',
                'is_assignable' => true,
                'is_protected' => true,
            ],
            [
                'role_name' => 'Administrative Admin',
                'description' => 'Manages planning reference data, templates, and administrative monitoring.',
                'is_assignable' => true,
                'is_protected' => true,
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
