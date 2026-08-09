<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Seeder;
use RuntimeException;

class RolePermissionSeeder extends Seeder
{
    public function run(): void
    {
        $administrator = Role::query()
            ->where('role_name', 'Administrator')
            ->first();

        if (! $administrator) {
            throw new RuntimeException(
                'The Administrator role must be seeded before role permissions.'
            );
        }

        $permissionCodes = [
            'users.view',
            'users.create',
            'users.update',
            'users.delete',
        ];

        $permissionIds = Permission::query()
            ->whereIn('code', $permissionCodes)
            ->pluck('permission_id');

        if ($permissionIds->count() !== count($permissionCodes)) {
            throw new RuntimeException(
                'One or more required user permissions have not been seeded.'
            );
        }

        $administrator->permissions()->syncWithoutDetaching($permissionIds);
    }
}