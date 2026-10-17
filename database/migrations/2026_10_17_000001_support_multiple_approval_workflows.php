<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (
            DB::table('approval_workflows')
                ->where('status', 'active')
                ->count() > 1
        ) {
            throw new RuntimeException(
                'Resolve multiple active approval workflows before migrating.'
            );
        }

        // A shared lock coordinates workflow changes and new submissions.
        Schema::create('approval_workflow_control', function (Blueprint $table) {
            $table->unsignedTinyInteger('id')->primary();
        });

        DB::table('approval_workflow_control')->insert(['id' => 1]);

        // NULL permits many inactive workflows; 1 permits only one active row.
        Schema::table('approval_workflows', function (Blueprint $table) {
            $table->unsignedTinyInteger('active_slot')
                ->nullable()
                ->storedAs("CASE WHEN status = 'active' THEN 1 ELSE NULL END");

            $table->unique(
                'active_slot',
                'approval_workflows_one_active'
            );
        });
    }

    public function down(): void
    {
        Schema::table('approval_workflows', function (Blueprint $table) {
            $table->dropUnique('approval_workflows_one_active');
            $table->dropColumn('active_slot');
        });

        Schema::dropIfExists('approval_workflow_control');
    }
};