<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tblstrategic_plan_comments', function (Blueprint $table) {
            $table->unsignedBigInteger('responsible_unit_id')->nullable()->change();
        });

        $permissionId = DB::table('tblpermissions')->where('code', 'objective_comments.create')->value('permission_id');
        if (! $permissionId) {
            return;
        }
        foreach (['Management', 'Executive', 'Management / Executive', 'Division Head'] as $roleName) {
            $roleId = DB::table('tblroles')->where('role_name', $roleName)->value('role_id');
            if ($roleId) {
                DB::table('tblrole_permissions')->insertOrIgnore([
                    'role_id' => $roleId, 'permission_id' => $permissionId,
                    'created_at' => now(), 'updated_at' => now(),
                ]);
            }
        }
    }

    public function down(): void
    {
        // Keep the column nullable for comments already written without a unit.
        // Keep role grants because they may have been changed by an administrator.
    }
};
