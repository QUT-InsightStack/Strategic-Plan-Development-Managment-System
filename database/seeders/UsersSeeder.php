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
            $this->command->warn('UsersSeeder skipped — not allowed in production.');
            return;
        }

        $defaultPassword = env('SEEDER_DEFAULT_PASSWORD', 'ChangeMe123!');

        $users = [
            [
                'name'       => 'Test Administrator',
                'email'      => 'testadmin@example.com',
                'password'   => Hash::make($defaultPassword),
                'role_id'    => 1,
                'department' => 'DOST Central Office',
                'status'     => 'active',
            ],
            [
                'name'       => 'Test Planning Officer',
                'email'      => 'testplanner@example.com',
                'password'   => Hash::make($defaultPassword),
                'role_id'    => 2,
                'department' => 'Planning Division',
                'status'     => 'active',
            ],
            [
                'name'       => 'Test Viewer',
                'email'      => 'testviewer@example.com',
                'password'   => Hash::make($defaultPassword),
                'role_id'    => 4,
                'department' => 'Research Division',
                'status'     => 'inactive',
            ],
        ];

        foreach ($users as $data) {
            User::firstOrCreate(['email' => $data['email']], $data);
        }
    }
}