<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private const PERMISSIONS = [
        'strategic_objectives.assign_responsible_unit' => 'Assign Responsible Units',
        'objective_comments.create' => 'Add Objective Comments',
        'objective_comments.view_all' => 'View All Objective Comments',
        'implementation_inputs.create' => 'Submit Implementation Inputs',
        'implementation_inputs.view_all' => 'View All Implementation Inputs',
    ];

    public function up(): void
    {
        foreach (self::PERMISSIONS as $code => $name) {
            DB::table('tblpermissions')->insertOrIgnore([
                'code' => $code, 'permission_name' => $name, 'description' => $name,
                'module' => explode('.', $code)[0], 'created_at' => now(), 'updated_at' => now(),
            ]);
        }
        // RolesSeeder owns the default role catalog. Existing collaboration
        // roles may still receive their original permissions below.

        $assignments = [
            'Administrator' => array_keys(self::PERMISSIONS),
            'Planning Officer' => ['strategic_objectives.assign_responsible_unit', 'objective_comments.view_all', 'implementation_inputs.view_all'],
        ];
        foreach (['Responsible Unit User', 'Office Representative', 'Office/Agency', 'Offices / Agencies'] as $role) {
            $assignments[$role] = ['strategic_records.view', 'strategic_objectives.view', 'objective_comments.create', 'implementation_inputs.create'];
        }
        foreach ($assignments as $roleName => $codes) {
            $roleId = DB::table('tblroles')->where('role_name', $roleName)->value('role_id');
            if (! $roleId) {
                continue;
            }
            foreach (DB::table('tblpermissions')->whereIn('code', $codes)->pluck('permission_id') as $permissionId) {
                DB::table('tblrole_permissions')->insertOrIgnore([
                    'role_id' => $roleId, 'permission_id' => $permissionId,
                    'created_at' => now(), 'updated_at' => now(),
                ]);
            }
        }
    }

    public function down(): void
    {
        DB::table('tblpermissions')->whereIn('code', array_keys(self::PERMISSIONS))->delete();
        // Keep the role: deployed user accounts may already reference it.
    }
};
