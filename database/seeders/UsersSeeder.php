<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use RuntimeException;

class UsersSeeder extends Seeder
{
    public function run(): void
    {
        if (app()->isProduction()) {
            $this->command->warn('UsersSeeder skipped - not allowed in production.');
            return;
        }

        $defaultPassword = env('SEEDER_DEFAULT_PASSWORD', '123456');

        $roleIds = Role::query()
            ->whereIn('role_name', ['Administrator', 'Planning Officer', 'Viewer', 'test'])
            ->pluck('role_id', 'role_name');

        foreach (['Administrator', 'Planning Officer', 'Viewer', 'test'] as $roleName) {
            if (! $roleIds->has($roleName)) {
                throw new RuntimeException(
                    "UsersSeeder requires the '{$roleName}' role to exist. Ensure RolesSeeder runs first."
                );
            }
        }

        $users = [
            [
                'first_name' => 'Test',
                'last_name' => 'Administrator',
                'email' => 'testadmin@example.com',
                'email_verified_at' => now(),
                'department' => 'DOST Central Office',
                'unit' => 'Administration',
                'office' => 'Main Office',
                'position' => 'System Administrator',
                'password' => Hash::make($defaultPassword),
                'role_id' => $roleIds['Administrator'],
                'status' => 'active',
            ],
            [
                'first_name' => 'Test',
                'last_name' => 'Planning Officer',
                'email' => 'testplanner@example.com',
                'email_verified_at' => now(),
                'department' => 'Planning Division',
                'unit' => 'Strategic Planning Unit',
                'office' => 'Planning Office',
                'position' => 'Planning Officer',
                'password' => Hash::make($defaultPassword),
                'role_id' => $roleIds['Planning Officer'],
                'status' => 'active',
            ],
            [
                'first_name' => 'Test',
                'last_name' => 'Viewer',
                'email' => 'testviewer@example.com',
                'department' => 'Research Division',
                'unit' => 'Monitoring Unit',
                'office' => 'Records Office',
                'position' => 'Viewer',
                'password' => Hash::make($defaultPassword),
                'role_id' => $roleIds['Viewer'],
                'status' => 'inactive',
            ],
            [
                'first_name' => 'Test',
                'last_name' => 'User',
                'email' => 'test@example.com',
                'email_verified_at' => now(),
                'department' => 'Testing',
                'position' => 'Test User',
                'password' => Hash::make($defaultPassword),
                'role_id' => $roleIds['test'],
                'status' => 'active',
            ],
        ];

        foreach ($users as $data) {
            User::updateOrCreate(['email' => $data['email']], $data);
        }
    }
}