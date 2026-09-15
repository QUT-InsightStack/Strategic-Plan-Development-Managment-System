<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tblresponsible_units', function (Blueprint $table) {
            $table->id('responsible_unit_id');
            $table->string('responsible_office_agency');
            $table->char('name_key', 64)->unique();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('tblobjective_responsible_units', function (Blueprint $table) {
            // One current assignment per objective; reassignment updates this row.
            $table->unsignedBigInteger('objective_id')->primary();
            $table->unsignedBigInteger('responsible_unit_id');
            $table->unsignedBigInteger('assigned_by')->nullable();
            $table->timestamps();
            $table->foreign('objective_id')->references('objective_id')->on('tblstrategic_objectives')->cascadeOnDelete();
            $table->foreign('responsible_unit_id')->references('responsible_unit_id')->on('tblresponsible_units')->restrictOnDelete();
            $table->foreign('assigned_by')->references('user_id')->on('tblusers')->nullOnDelete();
            $table->index(['responsible_unit_id', 'objective_id'], 'objective_unit_lookup');
        });

        Schema::create('tblobjective_comments', function (Blueprint $table) {
            $table->id('comment_id');
            $table->unsignedBigInteger('objective_id');
            $table->unsignedBigInteger('responsible_unit_id');
            $table->unsignedBigInteger('submitted_by')->nullable();
            $table->string('responsible_office_agency');
            $table->string('submitter_name', 511);
            $table->text('content');
            $table->timestamp('submitted_at')->useCurrent();
            $table->foreign('objective_id')->references('objective_id')->on('tblstrategic_objectives')->restrictOnDelete();
            $table->foreign('responsible_unit_id')->references('responsible_unit_id')->on('tblresponsible_units')->restrictOnDelete();
            $table->foreign('submitted_by')->references('user_id')->on('tblusers')->nullOnDelete();
            $table->index(['objective_id', 'comment_id'], 'objective_comment_history');
        });

        Schema::table('tblstrategic_objectives', function (Blueprint $table) {
            $table->unique(['objective_id', 'strategic_plan_id'], 'objective_plan_identity');
        });

        Schema::create('tblimplementation_inputs', function (Blueprint $table) {
            $table->id('input_id');
            $table->unsignedBigInteger('strategic_plan_id');
            $table->unsignedBigInteger('objective_id')->nullable();
            $table->unsignedBigInteger('responsible_unit_id');
            $table->unsignedBigInteger('submitted_by')->nullable();
            $table->string('responsible_office_agency');
            $table->string('submitter_name', 511);
            $table->enum('input_type', ['progress_update', 'issue', 'change_request']);
            $table->text('content');
            $table->enum('review_status', ['Pending Review', 'Approved', 'Rejected'])->default('Pending Review');
            $table->timestamp('submitted_at')->useCurrent();
            $table->foreign('strategic_plan_id')->references('record_id')->on('tblstrategic_record')->restrictOnDelete();
            // The database also rejects an objective from a different plan.
            $table->foreign(['objective_id', 'strategic_plan_id'], 'input_objective_plan_fk')
                ->references(['objective_id', 'strategic_plan_id'])->on('tblstrategic_objectives')->restrictOnDelete();
            $table->foreign('responsible_unit_id')->references('responsible_unit_id')->on('tblresponsible_units')->restrictOnDelete();
            $table->foreign('submitted_by')->references('user_id')->on('tblusers')->nullOnDelete();
            $table->index(['strategic_plan_id', 'input_id'], 'plan_input_history');
            $table->index(['responsible_unit_id', 'review_status'], 'unit_input_review');
        });

        // Preserve legacy labels and archived records without firing objective update triggers.
        DB::table('tblusers')->whereNotNull('office')->orderBy('user_id')->each(function ($user) {
            $this->unitId($user->office);
        }, 500);
        DB::table('tblstrategic_objectives')->whereNotNull('responsible_office_agency')
            ->orderBy('objective_id')->each(function ($objective) {
                $unitId = $this->unitId($objective->responsible_office_agency);
                if ($unitId !== null) {
                    DB::table('tblobjective_responsible_units')->insert([
                        'objective_id' => $objective->objective_id,
                        'responsible_unit_id' => $unitId,
                        'assigned_by' => $objective->updated_by ?? $objective->created_by,
                        'created_at' => $objective->created_at ?? now(),
                        'updated_at' => $objective->updated_at ?? now(),
                    ]);
                }
            }, 500);
    }

    private function unitId(string $name): ?int
    {
        $name = trim($name);
        if ($name === '') {
            return null;
        }
        $key = hash('sha256', mb_strtolower($name, 'UTF-8'));
        DB::table('tblresponsible_units')->insertOrIgnore([
            'name_key' => $key,
            'responsible_office_agency' => $name,
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return DB::table('tblresponsible_units')->where('name_key', $key)->value('responsible_unit_id');
    }

    public function down(): void
    {
        Schema::dropIfExists('tblimplementation_inputs');
        Schema::table('tblstrategic_objectives', function (Blueprint $table) {
            $table->dropUnique('objective_plan_identity');
        });
        Schema::dropIfExists('tblobjective_comments');
        Schema::dropIfExists('tblobjective_responsible_units');
        Schema::dropIfExists('tblresponsible_units');
    }
};
