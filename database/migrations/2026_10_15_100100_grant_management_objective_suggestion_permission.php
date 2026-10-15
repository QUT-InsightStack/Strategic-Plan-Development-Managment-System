<?php

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        $permission = Permission::where(
            'code',
            'implementation_inputs.create'
        )->firstOrFail();

        Role::whereIn('role_name', [
            'Management',
            'Executive',
            'Management / Executive',
            'Division Head',
        ])->get()->each(function (Role $role) use ($permission) {
            $role->permissions()->syncWithoutDetaching([
                $permission->permission_id,
            ]);
        });
    }

    public function down(): void
    {
        // Preserve grants that may have existed before this migration.
    }
};