<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $permissions = [
            'implementation_inputs.view' => 'View Submitted Implementation Inputs',
            'implementation_inputs.view_all' => 'View All Implementation Inputs',
        ];
        foreach ($permissions as $code => $name) {
            DB::table('tblpermissions')->insertOrIgnore([
                'code' => $code, 'permission_name' => $name, 'description' => $name,
                'module' => 'implementation_inputs', 'created_at' => now(), 'updated_at' => now(),
            ]);
        }

        $permissionIds = DB::table('tblpermissions')->whereIn('code', array_keys($permissions))->pluck('permission_id');
        foreach (['Management', 'Executive', 'Management / Executive', 'Division Head'] as $roleName) {
            $roleId = DB::table('tblroles')->where('role_name', $roleName)->value('role_id');
            if (! $roleId) {
                continue;
            }
            foreach ($permissionIds as $permissionId) {
                DB::table('tblrole_permissions')->insertOrIgnore([
                    'role_id' => $roleId, 'permission_id' => $permissionId,
                    'created_at' => now(), 'updated_at' => now(),
                ]);
            }
        }
    }

    public function down(): void
    {
        // Existing administrators or seeders may have granted these read permissions.
        // Do not revoke grants that this migration cannot distinguish from prior grants.
    }
};
