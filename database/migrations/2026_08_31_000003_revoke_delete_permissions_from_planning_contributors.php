<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private const RESTRICTED_ROLE_NAMES = [
        'Planning Officer',
        'Planner/Encoder',
        'Office Representative',
        'Office/Agency',
        'Offices / Agencies',
    ];

    public function up(): void
    {
        $roleIds = DB::table('tblroles')
            ->whereIn('role_name', self::RESTRICTED_ROLE_NAMES)
            ->pluck('role_id');

        $deletePermissionIds = DB::table('tblpermissions')
            ->where('code', 'like', '%.delete')
            ->pluck('permission_id');

        if ($roleIds->isEmpty() || $deletePermissionIds->isEmpty()) {
            return;
        }

        DB::table('tblrole_permissions')
            ->whereIn('role_id', $roleIds)
            ->whereIn('permission_id', $deletePermissionIds)
            ->delete();
    }

    public function down(): void
    {
        // Intentionally irreversible: restoring Delete privileges during a
        // rollback would recreate an access path that this security migration
        // explicitly removes, including permissions assigned manually.
    }
};
