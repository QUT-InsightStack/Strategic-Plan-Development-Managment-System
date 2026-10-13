<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class AdministrativePlanningPermissionSeeder extends Seeder
{
    public const PLANNING_PERMISSIONS = [
        'strategic_records.view',
        'strategic_records.create',
        'strategic_records.update',
        'strategic_records.archive',

        'strategic_foundations.view',
        'strategic_foundations.manage',
        'strategic_foundations.create',
        'strategic_foundations.update',

        'plan_core_values.view',
        'plan_core_values.manage',
        'plan_core_values.create',
        'plan_core_values.update',

        'strategic_objectives.view',
        'strategic_objectives.create',
        'strategic_objectives.update',
        'strategic_objectives.archive',
        'strategic_objectives.assign_responsible_unit',
        'strategic_objectives.view_progress',
        'strategic_objectives.correct_progress',

        'relations.view',
        'relations.manage',
        'relations.create',
        'relations.update',
        'strategic_alignments.archive',

        'objective_comments.create',
        'objective_comments.view_all',

        'implementation_inputs.view',
        'implementation_inputs.view_all',
        'implementation_inputs.review',

        'strategic_documents.view',
        'strategic_documents.upload',
        'strategic_documents.download',
    ];

    public function run(): void
    {
        DB::transaction(function (): void {
            $roles = Role::whereIn('role_name', [
                'Administrative Admin',
                'Administrative Administrator',
            ])->get();

            if ($roles->isEmpty()) {
                return;
            }

            foreach (self::PLANNING_PERMISSIONS as $code) {
                Permission::firstOrCreate(['code' => $code], [
                    'permission_name' => ucwords(
                        str_replace(['.', '_'], ' ', $code)
                    ),
                    'module' => explode('.', $code)[0],
                ]);
            }

            $permissionIds = Permission::whereIn(
                'code',
                self::PLANNING_PERMISSIONS
            )->pluck('permission_id')->all();

            $deleteIds = Permission::whereIn('code', [
                'strategic_records.delete',
                'strategic_objectives.delete',
                'strategic_alignments.delete',
                'strategic_foundations.delete',
                'relations.delete',
                'plan_core_values.delete',
            ])->pluck('permission_id')->all();

            foreach ($roles as $role) {
                $changes = $role->permissions()
                    ->syncWithoutDetaching($permissionIds);

                $removed = $role->permissions()->detach($deleteIds);

                if (($changes['attached'] ?? []) !== [] || $removed > 0) {
                    DB::table('tblusers')
                        ->where('role_id', $role->role_id)
                        ->increment('auth_version');
                }
            }
        });
    }
}