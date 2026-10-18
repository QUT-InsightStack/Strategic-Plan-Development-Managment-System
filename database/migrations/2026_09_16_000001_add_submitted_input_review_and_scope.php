<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tblimplementation_input_scopes', function (Blueprint $table) {
            $table->unsignedBigInteger('strategic_plan_id');
            $table->unsignedBigInteger('user_id');
            $table->unsignedBigInteger('granted_by')->nullable();
            $table->timestamps();
            $table->primary(['strategic_plan_id', 'user_id']);
            $table->foreign('strategic_plan_id')->references('record_id')->on('tblstrategic_record')->cascadeOnDelete();
            $table->foreign('user_id')->references('user_id')->on('tblusers')->cascadeOnDelete();
            $table->foreign('granted_by')->references('user_id')->on('tblusers')->nullOnDelete();
        });

        Schema::table('tblimplementation_inputs', function (Blueprint $table) {
            $table->unsignedBigInteger('reviewed_by')->nullable();
            $table->string('reviewer_name', 511)->nullable();
            $table->text('review_note')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->foreign('reviewed_by')->references('user_id')->on('tblusers')->nullOnDelete();
        });

        foreach (['view' => 'View Submitted Implementation Inputs', 'review' => 'Review Implementation Inputs', 'manage_scope' => 'Manage Input Planning Scope'] as $action => $name) {
            DB::table('tblpermissions')->insertOrIgnore([
                'code' => 'implementation_inputs.'.$action, 'permission_name' => $name,
                'description' => $name, 'module' => 'implementation_inputs',
                'created_at' => now(), 'updated_at' => now(),
            ]);
        }
        foreach (['Administrator', 'Planning Officer', 'Responsible Unit User', 'Office Representative', 'Office/Agency', 'Offices / Agencies'] as $roleName) {
            $role = DB::table('tblroles')->where('role_name', $roleName)->first();
            if (! $role) {
                continue;
            }
            $codes = ['implementation_inputs.view'];
            if ($roleName === 'Planning Officer') {
                $codes[] = 'implementation_inputs.review';
            }
            if ($roleName === 'Administrator') {
                $codes[] = 'implementation_inputs.manage_scope';
            }
            foreach (DB::table('tblpermissions')->whereIn('code', $codes)->pluck('permission_id') as $id) {
                DB::table('tblrole_permissions')->insertOrIgnore([
                    'role_id' => $role->role_id, 'permission_id' => $id, 'created_at' => now(), 'updated_at' => now(),
                ]);
            }
        }
    }

    public function down(): void
    {
        Schema::table('tblimplementation_inputs', function (Blueprint $table) {
            $table->dropForeign(['reviewed_by']);
            $table->dropColumn(['reviewed_by', 'reviewer_name', 'review_note', 'reviewed_at']);
        });
        Schema::dropIfExists('tblimplementation_input_scopes');
        $ids = DB::table('tblpermissions')->whereIn('code', ['implementation_inputs.view', 'implementation_inputs.review', 'implementation_inputs.manage_scope'])->pluck('permission_id');
        DB::table('tblrole_permissions')->whereIn('permission_id', $ids)->delete();
        DB::table('tblpermissions')->whereIn('permission_id', $ids)->delete();
    }
};
