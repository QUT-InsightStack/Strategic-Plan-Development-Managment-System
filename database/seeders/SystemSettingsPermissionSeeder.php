<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class SystemSettingsPermissionSeeder extends Seeder
{
    public function run(): void
    {
        DB::transaction(function (): void {
            $role = Role::query()
                ->where('role_name', 'Administrator')
                ->lockForUpdate()
                ->first();

            if (! $role) {
                throw new RuntimeException('Administrator role was not found.');
            }

            $ids = [];

            foreach ([
                [
                    'code' => 'settings.view',
                    'permission_name' => 'View System Settings',
                    'description' => 'Allows viewing centralized system configuration.',
                    'module' => 'settings',
                ],
                [
                    'code' => 'settings.manage',
                    'permission_name' => 'Manage System Settings',
                    'description' => 'Allows changing centralized system configuration and accessing the system during maintenance.',
                    'module' => 'settings',
                ],
            ] as $data) {
                $permission = Permission::query()->firstOrCreate(
                    ['code' => $data['code']],
                    $data
                );

                $ids[] = $permission->permission_id;
            }

            $changes = $role->permissions()->syncWithoutDetaching($ids);

            if (($changes['attached'] ?? []) !== []) {
                User::query()
                    ->where('role_id', $role->role_id)
                    ->increment('auth_version');
            }
        });
    }
}