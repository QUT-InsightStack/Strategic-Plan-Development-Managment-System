<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/*
 * Client permission table, confirmed 16 Oct 2026:
 * - Technical Admin views and permanently deletes plans, objectives, mappings and reference data,
 *   and manages system configuration and security settings (the RolePermissionSeeder technical list).
 * - Management views audit logs (read-only) for monitoring.
 * Grants only; nothing is revoked.
 */
return new class extends Migration
{
    private const GRANTS = [
        'Technical Administrator' => [
            'strategic_records.view', 'strategic_records.delete',
            'strategic_foundations.view', 'plan_core_values.view',
            'strategic_objectives.view', 'strategic_objectives.delete',
            'relations.view', 'strategic_alignments.delete',
            'strategic_documents.view', 'strategic_documents.download',
            'pdp_chapters.delete', 'presidential_agenda.view', 'presidential_agenda.delete',
            'settings.view', 'settings.manage',
        ],
        'Management' => ['logs.view'],
        'Management / Executive' => ['logs.view'],
        'Executive' => ['logs.view'],
        'Division Head' => ['logs.view'],
    ];

    public function up(): void
    {
        foreach (self::GRANTS as $roleName => $codes) {
            $roleId = DB::table('tblroles')->where('role_name', $roleName)->value('role_id');
            if (! $roleId) {
                continue;
            }
            $granted = 0;
            foreach (DB::table('tblpermissions')->whereIn('code', $codes)->pluck('permission_id') as $permissionId) {
                $granted += DB::table('tblrole_permissions')->insertOrIgnore([
                    'role_id' => $roleId, 'permission_id' => $permissionId,
                    'created_at' => now(), 'updated_at' => now(),
                ]);
            }
            if ($granted > 0) {
                DB::table('tblusers')->where('role_id', $roleId)->increment('auth_version');
            }
        }
    }

    public function down(): void
    {
        // These roles may already have held some of these grants; they cannot be told apart, so none are revoked.
    }
};
