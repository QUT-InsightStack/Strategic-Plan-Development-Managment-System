<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;

final class RoleNameUpgrade
{
    public static function run(): void
    {
        DB::transaction(function () {
            foreach (['Division Head' => 'Management', 'Viewer' => 'Office'] as $oldName => $newName) {
                $old = DB::table('tblroles')->where('role_name', $oldName)->lockForUpdate()->first();
                if (! $old) {
                    continue;
                }

                $duplicate = DB::table('tblroles')->where('role_name', $newName)->lockForUpdate()->first();
                if ($duplicate) {
                    // A previous seeder run may already have created the new
                    // name. Keep the original ID and all existing grants.
                    foreach (DB::table('tblrole_permissions')->where('role_id', $duplicate->role_id)->get() as $grant) {
                        DB::table('tblrole_permissions')->insertOrIgnore([
                            'role_id' => $old->role_id, 'permission_id' => $grant->permission_id,
                            'created_at' => $grant->created_at, 'updated_at' => $grant->updated_at,
                        ]);
                    }
                    DB::table('tblusers')->where('role_id', $duplicate->role_id)->update(['role_id' => $old->role_id]);
                    $workflowIds = DB::table('approval_workflow_stages')->where('role_id', $duplicate->role_id)->pluck('workflow_id');
                    DB::table('approval_workflow_stages')->where('role_id', $duplicate->role_id)->update(['role_id' => $old->role_id]);
                    DB::table('approval_workflows')->whereIn('id', $workflowIds)->increment('version');
                    DB::table('tblrole_permissions')->where('role_id', $duplicate->role_id)->delete();
                    DB::table('tblroles')->where('role_id', $duplicate->role_id)->delete();
                }

                DB::table('tblroles')->where('role_id', $old->role_id)->update(['role_name' => $newName, 'updated_at' => now()]);
                DB::table('tblusers')->where('role_id', $old->role_id)->increment('auth_version');
                // Submitted workflow snapshots and audit labels are historical
                // records; only the live workflow configuration is updated.
            }
        });
    }
}
