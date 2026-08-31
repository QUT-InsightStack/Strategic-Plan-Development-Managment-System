<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $timestamp = now();

        DB::table('tblpermissions')->updateOrInsert(
            ['code' => 'backups.restore'],
            [
                'permission_name' => 'Restore Backups',
                'description' => 'Allows restoring the system database from a previously created backup.',
                'module' => 'backups',
                'created_at' => $timestamp,
                'updated_at' => $timestamp,
            ]
        );

        $roleId = DB::table('tblroles')
            ->where('role_name', 'Administrator')
            ->value('role_id');

        $permissionId = DB::table('tblpermissions')
            ->where('code', 'backups.restore')
            ->value('permission_id');

        if ($roleId && $permissionId) {
            DB::table('tblrole_permissions')->updateOrInsert(
                [
                    'role_id' => $roleId,
                    'permission_id' => $permissionId,
                ],
                [
                    'created_at' => $timestamp,
                    'updated_at' => $timestamp,
                ]
            );
        }
    }

    public function down(): void
    {
        $roleId = DB::table('tblroles')
            ->where('role_name', 'Administrator')
            ->value('role_id');

        $permissionId = DB::table('tblpermissions')
            ->where('code', 'backups.restore')
            ->value('permission_id');

        if ($roleId && $permissionId) {
            DB::table('tblrole_permissions')
                ->where('role_id', $roleId)
                ->where('permission_id', $permissionId)
                ->delete();
        }

        DB::table('tblpermissions')
            ->where('code', 'backups.restore')
            ->delete();
    }
};
