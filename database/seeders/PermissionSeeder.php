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
    'permission_name' => 'View Dashboard',
    'description' => 'Allows viewing the dashboard.',
    'code' => 'dashboard.view',
    'module' => 'dashboard',
],


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
                'permission_name' => 'View Login History',
                'description' => 'Allows viewing user login-history records.',
                'code' => 'login_history.view',
                'module' => 'login_history',
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
                'permission_name' => 'Create Strategic Records',
                'description' => 'Allows creating strategic plans and records.',
                'code' => 'strategic_records.create',
                'module' => 'strategic_records',
            ],
            [
                'permission_name' => 'Update Strategic Records',
                'description' => 'Allows updating strategic plans and records.',
                'code' => 'strategic_records.update',
                'module' => 'strategic_records',
            ],
            [
                'permission_name' => 'Delete Strategic Records',
                'description' => 'Allows deleting strategic plans and records.',
                'code' => 'strategic_records.delete',
                'module' => 'strategic_records',
            ],
            [
                'permission_name' => 'Archive Strategic Records',
                'description' => 'Allows archiving and restoring strategic plans.',
                'code' => 'strategic_records.archive',
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
                'permission_name' => 'Create Strategic Foundations',
                'description' => 'Allows creating strategic foundations.',
                'code' => 'strategic_foundations.create',
                'module' => 'strategic_foundations',
            ],
            [
                'permission_name' => 'Update Strategic Foundations',
                'description' => 'Allows updating strategic foundations.',
                'code' => 'strategic_foundations.update',
                'module' => 'strategic_foundations',
            ],
            [
                'permission_name' => 'Delete Strategic Foundations',
                'description' => 'Allows deleting strategic foundations.',
                'code' => 'strategic_foundations.delete',
                'module' => 'strategic_foundations',
            ],
            [
                'permission_name' => 'View Strategic Objectives',
                'description' => 'Allows viewing strategic objectives.',
                'code' => 'strategic_objectives.view',
                'module' => 'strategic_objectives',
            ],
            [
                'permission_name' => 'Create Strategic Objectives',
                'description' => 'Allows creating strategic objectives.',
                'code' => 'strategic_objectives.create',
                'module' => 'strategic_objectives',
            ],
            [
                'permission_name' => 'Update Strategic Objectives',
                'description' => 'Allows updating strategic objectives.',
                'code' => 'strategic_objectives.update',
                'module' => 'strategic_objectives',
            ],
            [
                'permission_name' => 'Delete Strategic Objectives',
                'description' => 'Allows deleting strategic objectives.',
                'code' => 'strategic_objectives.delete',
                'module' => 'strategic_objectives',
            ],
            [
                'permission_name' => 'Manage Relations',
                'description' => 'Allows maintaining relation mappings between strategic records.',
                'code' => 'relations.manage',
                'module' => 'relations',
            ],
            [
                'permission_name' => 'View Relations',
                'description' => 'Allows viewing relation mappings between strategic records.',
                'code' => 'relations.view',
                'module' => 'relations',
            ],
            [
                'permission_name' => 'Create Relations',
                'description' => 'Allows creating relation mappings between strategic records.',
                'code' => 'relations.create',
                'module' => 'relations',
            ],
            [
                'permission_name' => 'Update Relations',
                'description' => 'Allows updating relation mappings between strategic records.',
                'code' => 'relations.update',
                'module' => 'relations',
            ],
            [
                'permission_name' => 'Delete Relations',
                'description' => 'Allows deleting relation mappings between strategic records.',
                'code' => 'relations.delete',
                'module' => 'relations',
            ],
            [
                'permission_name' => 'Manage Core Values',
                'description' => 'Allows maintaining plan core value mappings.',
                'code' => 'plan_core_values.manage',
                'module' => 'plan_core_values',
            ],
            [
                'permission_name' => 'View Core Values',
                'description' => 'Allows viewing plan core value mappings.',
                'code' => 'plan_core_values.view',
                'module' => 'plan_core_values',
            ],
            [
                'permission_name' => 'Create Core Values',
                'description' => 'Allows creating plan core value mappings.',
                'code' => 'plan_core_values.create',
                'module' => 'plan_core_values',
            ],
            [
                'permission_name' => 'Update Core Values',
                'description' => 'Allows updating plan core value mappings.',
                'code' => 'plan_core_values.update',
                'module' => 'plan_core_values',
            ],
            [
                'permission_name' => 'Delete Core Values',
                'description' => 'Allows deleting plan core value mappings.',
                'code' => 'plan_core_values.delete',
                'module' => 'plan_core_values',
            ],
            [
                'permission_name' => 'View Logs',
                'description' => 'Allows viewing system activity logs.',
                'code' => 'logs.view',
                'module' => 'logs',
            ],
            [
                'permission_name' => 'Manage PDP Chapters',
                'description' => 'Allows creating and editing PDP Chapters and their linked strategic objectives.',
                'code' => 'pdp_chapters.manage',
                'module' => 'pdp_chapters',
            ],
            // Kept separate from one another on purpose: a backup file holds
            // every user record and password hash, so being able to trigger
            // one is not the same as being allowed to take a copy off the
            // server.
            [
                'permission_name' => 'View Backups',
                'description' => 'Allows viewing the list of manual database backups.',
                'code' => 'backups.view',
                'module' => 'backups',
            ],
            [
                'permission_name' => 'Create Backups',
                'description' => 'Allows running a manual database backup.',
                'code' => 'backups.create',
                'module' => 'backups',
            ],
            [
                'permission_name' => 'Download Backups',
                'description' => 'Allows downloading a database backup file, which contains all system data.',
                'code' => 'backups.download',
                'module' => 'backups',
            ],
            [
                'permission_name' => 'Restore Backups',
                'description' => 'Allows restoring the system database from a previously created backup.',
                'code' => 'backups.restore',
                'module' => 'backups',
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
