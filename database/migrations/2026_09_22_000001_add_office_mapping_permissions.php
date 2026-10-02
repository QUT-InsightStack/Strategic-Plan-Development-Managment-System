<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private const ROLES = [
        'Responsible Unit User',
        'Office Representative',
        'Office/Agency',
        'Offices / Agencies',
    ];

    private const PERMISSIONS = ['relations.view', 'relations.create'];

    public function up(): void
    {
        $roleIds = DB::table('tblroles')->whereIn('role_name', self::ROLES)->pluck('role_id');
        $permissionIds = DB::table('tblpermissions')->whereIn('code', self::PERMISSIONS)->pluck('permission_id');

        foreach ($roleIds as $roleId) {
            foreach ($permissionIds as $permissionId) {
                DB::table('tblrole_permissions')->insertOrIgnore([
                    'role_id' => $roleId,
                    'permission_id' => $permissionId,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }
    }

    public function down(): void
    {
        $roleIds = DB::table('tblroles')->whereIn('role_name', self::ROLES)->pluck('role_id');
        $permissionIds = DB::table('tblpermissions')->whereIn('code', self::PERMISSIONS)->pluck('permission_id');

        DB::table('tblrole_permissions')
            ->whereIn('role_id', $roleIds)
            ->whereIn('permission_id', $permissionIds)
            ->delete();
    }
};
