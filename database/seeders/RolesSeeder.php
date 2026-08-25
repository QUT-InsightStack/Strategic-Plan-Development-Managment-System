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
                'role_name'   => 'Administrator',
                'description' => 'Full system access. Manages users, roles, and system configuration.',
<<<<<<< Updated upstream
=======
                'is_assignable' => true,
                'is_protected' => true,
            ],
            [
                'role_name'   => 'test',
                'description' => 'Test account with full backend access.',
                'is_assignable' => true,
                'is_protected' => false,
>>>>>>> Stashed changes
            ],
            [
                'role_name'   => 'Planning Officer',
                'description' => 'Creates and manages strategic plans and performance indicators.',
            ],
            [
                'role_name'   => 'Division Head',
                'description' => 'Reviews and approves plans within their division.',
            ],
            [
                'role_name'   => 'Viewer',
                'description' => 'Read-only access to published plans and reports.',
            ],
        ];

        foreach ($roles as $role) {
            Role::updateOrCreate(
                ['role_name' => $role['role_name']],
                ['description' => $role['description']]
            );
        }
    }
}