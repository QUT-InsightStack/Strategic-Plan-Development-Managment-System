<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/*
 * Client permission table: permanent deletion of reference data (PDP Chapters, Presidential Agenda)
 * belongs to Management and Technical Admin only. Administrative Admin keeps create, update and archive.
 */
return new class extends Migration
{
    private const ROLES = ['Administrative Admin', 'Administrative Administrator'];

    private const PERMISSIONS = ['pdp_chapters.delete', 'presidential_agenda.delete'];

    public function up(): void
    {
        $roleIds = DB::table('tblroles')->whereIn('role_name', self::ROLES)->pluck('role_id');
        $permissionIds = DB::table('tblpermissions')->whereIn('code', self::PERMISSIONS)->pluck('permission_id');
        if ($roleIds->isEmpty() || $permissionIds->isEmpty()) {
            return;
        }

        $removed = DB::table('tblrole_permissions')->whereIn('role_id', $roleIds)->whereIn('permission_id', $permissionIds)->delete();
        if ($removed > 0) {
            // Signed-in Administrative Admins pick up the change on their next request.
            DB::table('tblusers')->whereIn('role_id', $roleIds)->increment('auth_version');
        }
    }

    public function down(): void
    {
        // Restoring deletion rights to Administrative Admin needs an explicit client decision.
    }
};
