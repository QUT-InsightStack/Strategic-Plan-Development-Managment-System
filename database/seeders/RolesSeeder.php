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
                'description' => 'Legacy full-access role retained for existing accounts. Not available for new assignments.',
                'is_assignable' => false,
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
                'description' => 'Submits planning proposals and feedback within authorised scope and updates assigned objective progress after plan approval. Requires organisation/office details.',
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
            // Retain legacy roles and their existing accounts, but stop offering
// them for new assignments.
Role::query()
    ->whereIn('role_name', [
        'Responsible Unit User',
        'Office Representative',
        'Office/Agency',
        'Offices / Agencies',
    ])
    ->update(['is_assignable' => false]);
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
