<?php

namespace Database\Seeders;

use App\Models\Permission;
use Illuminate\Database\Seeder;

class PermissionSeeder extends Seeder
{
    public function run(): void
    {
        $permissions = [
            [
                'permission_name' => 'View Users',
                'description' => 'Allows viewing the list of users and individual user details.',
                'code' => 'users.view',
                'module' => 'users',
            ],
            [
                'permission_name' => 'Create Users',
                'description' => 'Allows creating new user accounts.',
                'code' => 'users.create',
                'module' => 'users',
            ],
            [
                'permission_name' => 'Update Users',
                'description' => 'Allows editing existing user accounts.',
                'code' => 'users.update',
                'module' => 'users',
            ],
            [
                'permission_name' => 'Delete Users',
                'description' => 'Allows deleting user accounts.',
                'code' => 'users.delete',
                'module' => 'users',
            ],
            [
                'permission_name' => 'View Roles',
                'description' => 'Allows viewing roles and their details.',
                'code' => 'roles.view',
                'module' => 'roles',
            ],
            [
                'permission_name' => 'Manage Roles',
                'description' => 'Allows creating, updating, and deleting roles.',
                'code' => 'roles.manage',
                'module' => 'roles',
            ],
            [
                'permission_name' => 'Assign User Roles',
                'description' => 'Allows assigning approved roles to user accounts.',
                'code' => 'users.assign_roles',
                'module' => 'users',
            ],
            [
                'permission_name' => 'Assign Protected Roles',
                'description' => 'Allows assigning protected roles to user accounts.',
                'code' => 'roles.assign_protected',
                'module' => 'roles',
            ],
            [
                'permission_name' => 'View Permissions',
                'description' => 'Allows viewing the permission catalog.',
                'code' => 'permissions.view',
                'module' => 'permissions',
            ],
            [
                'permission_name' => 'Manage Permissions',
                'description' => 'Allows creating, updating, and deleting permissions.',
                'code' => 'permissions.manage',
                'module' => 'permissions',
            ],
            [
                'permission_name' => 'View Strategic Records',
                'description' => 'Allows viewing strategic records and plan details.',
                'code' => 'strategic_records.view',
                'module' => 'strategic_records',
            ],
            [
                'permission_name' => 'Manage Strategic Records',
                'description' => 'Allows creating, updating, and deleting strategic records.',
                'code' => 'strategic_records.manage',
                'module' => 'strategic_records',
            ],
            [
                'permission_name' => 'View Strategic Foundations',
                'description' => 'Allows viewing strategic foundations.',
                'code' => 'strategic_foundations.view',
                'module' => 'strategic_foundations',
            ],
            [
                'permission_name' => 'Manage Strategic Foundations',
                'description' => 'Allows creating, updating, and deleting strategic foundations.',
                'code' => 'strategic_foundations.manage',
                'module' => 'strategic_foundations',
            ],
            [
                'permission_name' => 'Manage Relations',
                'description' => 'Allows maintaining relation mappings between strategic records.',
                'code' => 'relations.manage',
                'module' => 'relations',
            ],
            [
                'permission_name' => 'Manage Core Values',
                'description' => 'Allows maintaining plan core value mappings.',
                'code' => 'plan_core_values.manage',
                'module' => 'plan_core_values',
            ],
            [
                'permission_name' => 'View Logs',
                'description' => 'Allows viewing system activity logs.',
                'code' => 'logs.view',
                'module' => 'logs',
            ],
        ];

        foreach ($permissions as $permission) {
            Permission::updateOrCreate(
                ['code' => $permission['code']],
                $permission
            );
        }
    }
}
