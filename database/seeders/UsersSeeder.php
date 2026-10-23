<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class UsersSeeder extends Seeder
{
    /**
     * Local-development fallback. Must satisfy the default password policy
     * (minimum 15 characters).
     */
    private const FALLBACK_PASSWORD = 'fallbackpassword';

    private const MIN_PASSWORD_LENGTH = 15;

    public function run(): void
    {
        if (app()->isProduction()) {
            $this->command->warn('UsersSeeder skipped - not allowed in production.');
            return;
        }

        $password = $this->resolvePassword();
        $accounts = $this->accounts();

        $roleNames = array_values(array_unique(array_column($accounts, 'role')));

        $roleIds = Role::query()
            ->whereIn('role_name', $roleNames)
            ->pluck('role_id', 'role_name');

        $missing = array_values(array_diff($roleNames, $roleIds->keys()->all()));

        if ($missing !== []) {
            throw new RuntimeException(
                'UsersSeeder requires these roles to exist: '
                . implode(', ', $missing)
                . '. Ensure RolesSeeder runs first.'
            );
        }

        DB::transaction(function () use ($accounts, $roleIds, $password): void {
            foreach ($accounts as $account) {
                $attributes = [
                    'first_name' => $account['first_name'],
                    'last_name' => $account['last_name'],
                    'email' => $account['email'],
                    'department' => $account['department'] ?? null,
                    'unit' => $account['unit'] ?? null,
                    'office' => $account['office'] ?? null,
                    'position' => $account['position'] ?? null,
                    'role_id' => $roleIds[$account['role']],
                    'password' => $password, // hashed by the User model cast
                    'status' => 'active',
                    'email_verified_at' => now(),
                    'failed_login_attempts' => 0,
                    'locked_until' => null,
                ];

                $user = User::query()
                    ->where('email', $account['email'])
                    ->lockForUpdate()
                    ->first();

                if ($user) {
                    // Re-seeding changes role/password/status, so stale
                    // sessions and tokens must stop working.
                    $user->forceFill($attributes);
                    $user->auth_version = (int) $user->auth_version + 1;
                    $user->save();

                    continue;
                }

                // forceFill: email_verified_at is not mass-assignable.
                (new User())->forceFill($attributes)->save();
            }
        });
    }

    /**
     * One development account per final role.
     */
    private function accounts(): array
    {
        return [
            [
                'role' => 'Technical Administrator',
                'first_name' => 'Test',
                'last_name' => 'Technical Administrator',
                'email' => 'testadmin@example.com',
                'department' => 'DOST Central Office',
                'unit' => 'Administration',
                'office' => 'Main Office',
                'position' => 'System Administrator',
            ],
            [
                'role' => 'Administrative Admin',
                'first_name' => 'Test',
                'last_name' => 'Administrative Admin',
                'email' => 'testadministrative@example.com',
                'department' => 'Administrative Division',
                'unit' => 'Reference Data Unit',
                'office' => 'Administrative Office',
                'position' => 'Administrative Administrator',
            ],
            [
                'role' => 'Management',
                'first_name' => 'Test',
                'last_name' => 'Management',
                'email' => 'testmanagement@example.com',
                'department' => 'Executive Division',
                'unit' => 'Office of the Director',
                'office' => 'Management Office',
                'position' => 'Division Head',
            ],
            [
                'role' => 'Planning Officer',
                'first_name' => 'Test',
                'last_name' => 'Planning Officer',
                'email' => 'testplanner@example.com',
                'department' => 'Planning Division',
                'unit' => 'Strategic Planning Unit',
                'office' => 'Planning Office',
                'position' => 'Planning Officer',
            ],
            [
                // The Office role requires organisation/office details.
                'role' => 'Office',
                'first_name' => 'Test',
                'last_name' => 'Office',
                'email' => 'testoffice@example.com',
                'department' => 'Research Division',
                'unit' => 'Monitoring Unit',
                'office' => 'Records Office',
                'position' => 'Office Representative',
            ],
        ];
    }

    private function resolvePassword(): string
    {
        $password = env('SEEDER_DEFAULT_PASSWORD') ?: self::FALLBACK_PASSWORD;

        if (mb_strlen($password) < self::MIN_PASSWORD_LENGTH) {
            throw new RuntimeException(
                'SEEDER_DEFAULT_PASSWORD must be at least '
                . self::MIN_PASSWORD_LENGTH
                . ' characters to match the default password policy.'
            );
        }

        return $password;
    }
}