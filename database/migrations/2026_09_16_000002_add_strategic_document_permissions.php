<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private const PERMISSIONS = [
        'strategic_documents.view' => ['View Strategic Documents', 'Allows viewing document metadata attached to plans and objectives.'],
        'strategic_documents.upload' => ['Upload Strategic Documents', 'Allows uploading supporting documents to plans and objectives.'],
        'strategic_documents.download' => ['Download Strategic Documents', 'Allows downloading supporting documents attached to plans and objectives.'],
    ];

    private const CONTRIBUTOR_ROLES = [
        'Planning Officer', 'Planner/Encoder', 'Office Representative',
        'Office/Agency', 'Offices / Agencies',
    ];

    public function up(): void
    {
        foreach (self::PERMISSIONS as $code => [$name, $description]) {
            DB::table('tblpermissions')->updateOrInsert(
                ['code' => $code],
                ['permission_name' => $name, 'description' => $description, 'module' => 'strategic_documents', 'updated_at' => now(), 'created_at' => now()]
            );
        }

        $permissionIds = DB::table('tblpermissions')
            ->whereIn('code', array_keys(self::PERMISSIONS))->pluck('permission_id');
        $roleIds = DB::table('tblroles')->whereIn('role_name', self::CONTRIBUTOR_ROLES)->pluck('role_id');

        foreach ($roleIds as $roleId) {
            foreach ($permissionIds as $permissionId) {
                DB::table('tblrole_permissions')->updateOrInsert(
                    ['role_id' => $roleId, 'permission_id' => $permissionId],
                    ['updated_at' => now(), 'created_at' => now()]
                );
            }
        }
    }

    public function down(): void
    {
        $permissionIds = DB::table('tblpermissions')
            ->whereIn('code', array_keys(self::PERMISSIONS))->pluck('permission_id');
        DB::table('tblrole_permissions')->whereIn('permission_id', $permissionIds)->delete();
        DB::table('tblpermissions')->whereIn('permission_id', $permissionIds)->delete();
    }
};