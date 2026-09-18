<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $timestamp = now();

        DB::table('tblpermissions')->updateOrInsert(
            ['code' => 'pdp_chapters.delete'],
            [
                'permission_name' => 'Delete PDP Chapters',
                'description' => 'Allows permanently deleting archived PDP Chapters. Historical data is retained via status flag.',
                'module' => 'pdp_chapters',
                'created_at' => $timestamp,
                'updated_at' => $timestamp,
            ]
        );

        $roleId = DB::table('tblroles')
            ->where('role_name', 'Administrator')
            ->value('role_id');

        $permissionId = DB::table('tblpermissions')
            ->where('code', 'pdp_chapters.delete')
            ->value('permission_id');

        if ($roleId && $permissionId) {
            DB::table('tblrole_permissions')->updateOrInsert(
                ['role_id' => $roleId, 'permission_id' => $permissionId],
                ['created_at' => $timestamp, 'updated_at' => $timestamp]
            );
        }
    }

    public function down(): void
    {
        $permissionId = DB::table('tblpermissions')
            ->where('code', 'pdp_chapters.delete')
            ->value('permission_id');

        if ($permissionId) {
            DB::table('tblrole_permissions')->where('permission_id', $permissionId)->delete();
            DB::table('tblpermissions')->where('permission_id', $permissionId)->delete();
        }
    }
};