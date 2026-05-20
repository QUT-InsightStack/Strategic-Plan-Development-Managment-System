<?php

namespace Database\Seeders;

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

        $defaultPassword = env('SEEDER_DEFAULT_PASSWORD', 'ChangeMe123!');

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
                'role_id' => 1,
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
                'role_id' => 2,
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
                'role_id' => 4,
                'status' => 'inactive',
            ],
        ];

        foreach ($users as $data) {
            User::firstOrCreate(['email' => $data['email']], $data);
        }
    }
}
