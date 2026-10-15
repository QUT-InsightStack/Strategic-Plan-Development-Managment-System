<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/*
 * Planning, office and administrative roles get the report master as their Reports page.
 * The report only contains sections and rows the account's other permissions and data scope
 * allow. Export is granted too because every export is audited.
 */
return new class extends Migration
{
    public const ROLES = [
        'Planning Officer', 'Planner/Encoder',
        'Office', 'Responsible Unit User', 'Office Representative', 'Office/Agency', 'Offices / Agencies',
        'Administrative Admin', 'Administrative Administrator',
    ];

    public function up(): void
    {
        $permissions = [
            'reports.view' => ['View Reports', 'Allows opening administrative reports and the Management report.'],
            'reports.export' => ['Export Reports', 'Allows exporting Management report sections as CSV.'],
        ];
        foreach ($permissions as $code => [$name, $description]) {
            DB::table('tblpermissions')->insertOrIgnore([
                'code' => $code, 'permission_name' => $name, 'description' => $description,
                'module' => 'reports', 'created_at' => now(), 'updated_at' => now(),
            ]);
        }

        $permissionIds = DB::table('tblpermissions')->whereIn('code', array_keys($permissions))->pluck('permission_id');
        foreach (self::ROLES as $roleName) {
            $roleId = DB::table('tblroles')->where('role_name', $roleName)->value('role_id');
            if (! $roleId) {
                continue;
            }
            foreach ($permissionIds as $permissionId) {
                DB::table('tblrole_permissions')->insertOrIgnore([
                    'role_id' => $roleId, 'permission_id' => $permissionId,
                    'created_at' => now(), 'updated_at' => now(),
                ]);
            }
        }
    }

    public function down(): void
    {
        // These roles may already have held reports.view; grants cannot be told apart, so none are revoked.
    }
};
