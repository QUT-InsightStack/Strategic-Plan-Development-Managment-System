<?php

use Database\Seeders\ObjectiveProgressPermissionSeeder;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        (new ObjectiveProgressPermissionSeeder)->run();
    }

    public function down(): void
    {
        $codes = ['strategic_objectives.view_progress', 'strategic_objectives.update_progress', 'strategic_objectives.correct_progress'];
        $ids = DB::table('tblpermissions')->whereIn('code', $codes)->pluck('permission_id');
        DB::table('tblrole_permissions')->whereIn('permission_id', $ids)->delete();
        DB::table('tblpermissions')->whereIn('permission_id', $ids)->delete();
    }
};
