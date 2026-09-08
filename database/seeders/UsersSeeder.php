<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class UsersSeeder extends Seeder
{
    public function run(): void
    {
        if (app()->isProduction()) {
            $this->command->warn('UsersSeeder skipped - not allowed in production.');
            return;
        }

        $defaultPassword = env('SEEDER_DEFAULT_PASSWORD', '123456');
        $testRoleId = Role::where('role_name', 'test')->value('role_id');

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
                'role_id' => Role::where('role_name', 'Administrator')->value('role_id'),
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
                'role_id' => Role::where('role_name', 'Planning Officer')->value('role_id'),
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
                'role_id' => Role::where('role_name', 'Viewer')->value('role_id'),
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
                'role_id' => $testRoleId,
                'status' => 'active',
            ],
        ];

        foreach ($users as $data) {
            User::firstOrCreate(['email' => $data['email']], $data);
        }
    }
}
