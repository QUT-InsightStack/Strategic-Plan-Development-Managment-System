<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private const CODE = 'strategic_alignments.archive';

    // Initial grant only. Authorization checks use the permission, so other
    // roles can be granted this permission later through RBAC.
    private const ROLE_NAMES = ['Administrator', 'Planning Officer'];

    public function up(): void
    {
        DB::transaction(function (): void {
            $now = now();

            DB::table('tblpermissions')->updateOrInsert(
                ['code' => self::CODE],
                [
                    'permission_name' => 'Archive Strategic Alignments',
                    'description' => 'Allows archiving obsolete or incorrect Strategic Alignment mappings.',
                    'module' => 'strategic_alignments',
                    'created_at' => $now,
                    'updated_at' => $now,
                ]
            );

            $permissionId = DB::table('tblpermissions')
                ->where('code', self::CODE)
                ->value('permission_id');

            $roleIds = DB::table('tblroles')
                ->whereIn('role_name', self::ROLE_NAMES)
                ->pluck('role_id');

            $changedRoleIds = [];

            foreach ($roleIds as $roleId) {
                $exists = DB::table('tblrole_permissions')
                    ->where('role_id', $roleId)
                    ->where('permission_id', $permissionId)
                    ->exists();

                if ($exists) {
                    continue;
                }

                DB::table('tblrole_permissions')->insert([
                    'role_id' => $roleId,
                    'permission_id' => $permissionId,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);

                $changedRoleIds[] = $roleId;
            }

            if ($changedRoleIds !== []) {
                DB::table('tblusers')
                    ->whereIn('role_id', $changedRoleIds)
                    ->increment('auth_version');
            }
        });
    }

    public function down(): void
    {
        DB::transaction(function (): void {
            $permissionId = DB::table('tblpermissions')
                ->where('code', self::CODE)
                ->value('permission_id');

            if ($permissionId === null) {
                return;
            }

            $roleIds = DB::table('tblrole_permissions')
                ->where('permission_id', $permissionId)
                ->distinct()
                ->pluck('role_id');

            DB::table('tblrole_permissions')->where('permission_id', $permissionId)->delete();
            DB::table('tblpermissions')->where('permission_id', $permissionId)->delete();

            if ($roleIds->isNotEmpty()) {
                DB::table('tblusers')
                    ->whereIn('role_id', $roleIds)
                    ->increment('auth_version');
            }
        });
    }
};