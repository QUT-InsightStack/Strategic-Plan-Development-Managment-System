<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private const CONTRIBUTOR_ROLE_NAMES = [
        'Planning Officer',
        'Planner/Encoder',
        'Office Representative',
        'Office/Agency',
        'Offices / Agencies',
    ];

    private const FULL_ACCESS_ROLE_NAMES = [
        'Administrator',
        'Technical Administrator',
        'Technical Admin',
        'Management',
        'Executive',
        'Management / Executive',
    ];

    private const CONTRIBUTOR_PERMISSION_CODES = [
        'strategic_objectives.view',
        'strategic_objectives.create',
        'strategic_objectives.update',
        'strategic_objectives.archive',
    ];

    private const FULL_ACCESS_PERMISSION_CODES = [
        'strategic_objectives.view',
        'strategic_objectives.create',
        'strategic_objectives.update',
        'strategic_objectives.archive',
        'strategic_objectives.delete',
    ];

    public function up(): void
    {
        $timestamp = now();

        DB::table('tblpermissions')->updateOrInsert(
            ['code' => 'strategic_objectives.archive'],
            [
                'permission_name' => 'Archive Strategic Objectives',
                'description' => 'Allows archiving and restoring Strategic Objectives.',
                'module' => 'strategic_objectives',
                'created_at' => $timestamp,
                'updated_at' => $timestamp,
            ]
        );

        $this->assignPermissions(
            self::CONTRIBUTOR_ROLE_NAMES,
            self::CONTRIBUTOR_PERMISSION_CODES,
            $timestamp
        );

        $this->assignPermissions(
            self::FULL_ACCESS_ROLE_NAMES,
            self::FULL_ACCESS_PERMISSION_CODES,
            $timestamp
        );

        $this->removeDeletePermissionFromContributors();
    }

    public function down(): void
    {
        $archivePermissionId = DB::table('tblpermissions')
            ->where('code', 'strategic_objectives.archive')
            ->value('permission_id');

        if ($archivePermissionId) {
            DB::table('tblrole_permissions')
                ->where('permission_id', $archivePermissionId)
                ->delete();

            DB::table('tblpermissions')
                ->where('permission_id', $archivePermissionId)
                ->delete();
        }

        // Delete permission is intentionally not restored to contributor
        // roles because the client explicitly prohibits that access.
    }

    private function assignPermissions(
        array $roleNames,
        array $permissionCodes,
        $timestamp
    ): void {
        $roleIds = DB::table('tblroles')
            ->whereIn('role_name', $roleNames)
            ->pluck('role_id');

        $permissionIds = DB::table('tblpermissions')
            ->whereIn('code', $permissionCodes)
            ->pluck('permission_id');

        foreach ($roleIds as $roleId) {
            foreach ($permissionIds as $permissionId) {
                DB::table('tblrole_permissions')->updateOrInsert(
                    [
                        'role_id' => $roleId,
                        'permission_id' => $permissionId,
                    ],
                    [
                        'created_at' => $timestamp,
                        'updated_at' => $timestamp,
                    ]
                );
            }
        }
    }

    private function removeDeletePermissionFromContributors(): void
    {
        $roleIds = DB::table('tblroles')
            ->whereIn('role_name', self::CONTRIBUTOR_ROLE_NAMES)
            ->pluck('role_id');

        $deletePermissionId = DB::table('tblpermissions')
            ->where('code', 'strategic_objectives.delete')
            ->value('permission_id');

        if ($roleIds->isEmpty() || ! $deletePermissionId) {
            return;
        }

        DB::table('tblrole_permissions')
            ->whereIn('role_id', $roleIds)
            ->where('permission_id', $deletePermissionId)
            ->delete();
    }
};