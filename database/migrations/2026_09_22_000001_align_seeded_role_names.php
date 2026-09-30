<?php

use App\Support\RoleNameUpgrade;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::transaction(function () {
            RoleNameUpgrade::run();

            $testRoleId = DB::table('tblroles')->where('role_name', 'test')->value('role_id');
            if ($testRoleId) {
                foreach (DB::table('tblpermissions')->pluck('permission_id') as $permissionId) {
                    DB::table('tblrole_permissions')->insertOrIgnore([
                        'role_id' => $testRoleId, 'permission_id' => $permissionId,
                        'created_at' => now(), 'updated_at' => now(),
                    ]);
                }
                DB::table('tblusers')->where('role_id', $testRoleId)->increment('auth_version');
            }
        });
    }

    public function down(): void
    {
        // Data merges cannot safely be reversed: retain roles, grants, and
        // account/workflow references instead of guessing their former owners.
    }
};
