<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private const PERMISSIONS = [
        'presidential_agenda.view' => [
            'View Presidential Agenda',
            'Allows viewing Presidential Agenda items.',
        ],
        'presidential_agenda.manage' => [
            'Manage Presidential Agenda',
            'Allows creating and editing Presidential Agenda items.',
        ],
        'presidential_agenda.archive' => [
            'Archive Presidential Agenda',
            'Allows archiving Presidential Agenda items.',
        ],
        'presidential_agenda.delete' => [
            'Delete Presidential Agenda',
            'Allows logically deleting archived Presidential Agenda items.',
        ],
    ];

    public function up(): void
    {
        DB::transaction(function (): void {
            $now = now();

            foreach (self::PERMISSIONS as $code => [$name, $description]) {
                DB::table('tblpermissions')->updateOrInsert(
                    ['code' => $code],
                    [
                        'permission_name' => $name,
                        'description' => $description,
                        'module' => 'presidential_agenda',
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]
                );
            }

            $administratorId = DB::table('tblroles')
                ->where('role_name', 'Administrator')
                ->value('role_id');

            if ($administratorId === null) {
                return;
            }

            $permissionIds = DB::table('tblpermissions')
                ->whereIn('code', array_keys(self::PERMISSIONS))
                ->pluck('permission_id');

            $granted = false;

            foreach ($permissionIds as $permissionId) {
                $exists = DB::table('tblrole_permissions')
                    ->where('role_id', $administratorId)
                    ->where('permission_id', $permissionId)
                    ->exists();

                if ($exists) {
                    continue;
                }

                DB::table('tblrole_permissions')->insert([
                    'role_id' => $administratorId,
                    'permission_id' => $permissionId,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);

                $granted = true;
            }

            if ($granted) {
                DB::table('tblusers')
                    ->where('role_id', $administratorId)
                    ->increment('auth_version');
            }
        });
    }

    public function down(): void
    {
        DB::transaction(function (): void {
            $permissionIds = DB::table('tblpermissions')
                ->whereIn('code', array_keys(self::PERMISSIONS))
                ->pluck('permission_id');

            if ($permissionIds->isEmpty()) {
                return;
            }

            $roleIds = DB::table('tblrole_permissions')
                ->whereIn('permission_id', $permissionIds)
                ->distinct()
                ->pluck('role_id');

            DB::table('tblrole_permissions')
                ->whereIn('permission_id', $permissionIds)
                ->delete();

            DB::table('tblpermissions')
                ->whereIn('permission_id', $permissionIds)
                ->delete();

            if ($roleIds->isNotEmpty()) {
                DB::table('tblusers')
                    ->whereIn('role_id', $roleIds)
                    ->increment('auth_version');
            }
        });
    }
};