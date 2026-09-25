<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tblstrategic_objectives', function (Blueprint $table) {
            $table->unsignedTinyInteger('progress_percentage')->default(0);
            // Progress is independent of the draft/published/archive lifecycle.
            $table->string('progress_status', 20)->storedAs("CASE WHEN progress_percentage = 0 THEN 'not_started' WHEN progress_percentage = 100 THEN 'completed' ELSE 'in_progress' END");
            $table->timestamp('progress_updated_at')->nullable();
            $table->unsignedBigInteger('progress_updated_by')->nullable();
            $table->foreign('progress_updated_by')->references('user_id')->on('tblusers')->nullOnDelete();
            $table->index(['progress_status', 'progress_updated_at'], 'objective_progress_lookup');
        });
        DB::statement('ALTER TABLE tblstrategic_objectives ADD CONSTRAINT objective_progress_range CHECK (progress_percentage BETWEEN 0 AND 100)');

        Schema::create('tblobjective_progress_updates', function (Blueprint $table) {
            $table->id('progress_update_id');
            $table->unsignedBigInteger('objective_id');
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->string('updater_name', 511);
            $table->string('updater_role');
            $table->boolean('is_correction');
            $table->unsignedTinyInteger('previous_percentage');
            $table->string('previous_status', 20);
            $table->unsignedTinyInteger('new_percentage');
            $table->string('new_status', 20);
            $table->text('reason')->nullable();
            $table->timestamp('created_at');
            $table->foreign('objective_id')->references('objective_id')->on('tblstrategic_objectives')->restrictOnDelete();
            $table->foreign('updated_by')->references('user_id')->on('tblusers')->nullOnDelete();
            $table->index(['objective_id', 'progress_update_id'], 'objective_progress_history');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tblobjective_progress_updates');
        DB::statement('ALTER TABLE tblstrategic_objectives DROP CHECK objective_progress_range');
        Schema::table('tblstrategic_objectives', function (Blueprint $table) {
            $table->dropForeign(['progress_updated_by']);
            $table->dropIndex('objective_progress_lookup');
            $table->dropColumn(['progress_status', 'progress_percentage', 'progress_updated_at', 'progress_updated_by']);
        });
    }
};
