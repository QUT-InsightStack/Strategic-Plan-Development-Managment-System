<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class ClientRolePermissionCorrectionSeeder extends Seeder
{
    public function run(): void
    {
        DB::transaction(function (): void {
            $managementCodes = [
                'strategic_records.delete',
                'strategic_objectives.delete',
                'strategic_alignments.delete',
                'pdp_chapters.delete',
                'presidential_agenda.view',
                'presidential_agenda.delete',
            ];

            $managementIds = [];

           foreach ($managementCodes as $code) {
    $permission = Permission::firstOrCreate(
        ['code' => $code],
        [
            'permission_name' => ucwords(
                str_replace(['.', '_'], ' ', $code)
            ),
            'module' => explode('.', $code)[0],
        ]
    );

    $managementIds[] = $permission->permission_id;
}

            Role::whereIn('role_name', [
                'Management',
                'Executive',
                'Management / Executive',
                'Division Head',
            ])->get()->each(function (Role $role) use ($managementIds): void {
                $changes = $role->permissions()
                    ->syncWithoutDetaching($managementIds);

                if (($changes['attached'] ?? []) !== []) {
                    DB::table('tblusers')
                        ->where('role_id', $role->role_id)
                        ->increment('auth_version');
                }
            });

            $agendaDeleteId = Permission::where(
                'code',
                'presidential_agenda.delete'
            )->firstOrFail()->permission_id;

            Role::whereIn('role_name', [
                'Administrative Admin',
                'Administrative Administrator',
            ])->get()->each(function (Role $role) use ($agendaDeleteId): void {
                if ($role->permissions()->detach([$agendaDeleteId]) > 0) {
                    DB::table('tblusers')
                        ->where('role_id', $role->role_id)
                        ->increment('auth_version');
                }
            });
        });
    }
}