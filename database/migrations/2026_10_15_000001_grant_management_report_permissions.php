<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $permissions = [
            'reports.view' => ['View Reports', 'Allows opening administrative reports and the Management report.'],
            'reports.export' => ['Export Reports', 'Allows exporting Management report sections as CSV.'],
        ];
        foreach ($permissions as $code => [$name, $description]) {
            DB::table('tblpermissions')->insertOrIgnore([
                'code' => $code, 'permission_name' => $name, 'description' => $description,
                'module' => 'reports', 'created_at' => now(), 'updated_at' => now(),
            ]);
        }

        $permissionIds = DB::table('tblpermissions')->whereIn('code', array_keys($permissions))->pluck('permission_id');
        foreach (['Management', 'Executive', 'Management / Executive', 'Division Head', 'Administrator'] as $roleName) {
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
        // reports.view existed before this migration and may have been granted elsewhere.
        // Do not revoke grants that this migration cannot distinguish from prior grants.
    }
};
