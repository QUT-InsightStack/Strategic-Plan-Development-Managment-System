<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('approval_workflows', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->text('description')->nullable();
            $table->enum('status', ['draft', 'active', 'inactive'])->default('draft');
            $table->unsignedInteger('version')->default(0);
            $table->timestamps();
        });
        // One organisation-wide workflow; locking this row serializes configuration and submission.
        DB::table('approval_workflows')->insert([
            'id' => 1, 'name' => 'Strategic Plan Approval', 'status' => 'draft',
            'version' => 0, 'created_at' => now(), 'updated_at' => now(),
        ]);
        Schema::create('approval_workflow_stages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workflow_id')->constrained('approval_workflows');
            $table->string('name');
            $table->unsignedInteger('sequence');
            $table->unsignedBigInteger('user_id')->nullable();
            $table->unsignedBigInteger('role_id')->nullable();
            $table->foreign('user_id')->references('user_id')->on('tblusers')->restrictOnDelete();
            $table->foreign('role_id')->references('role_id')->on('tblroles')->restrictOnDelete();
            $table->unique(['workflow_id', 'sequence']);
        });
        Schema::table('tblstrategic_record', function (Blueprint $table) {
            $table->enum('approval_status', ['not_submitted', 'under_approval', 'approved', 'rejected'])
                ->default('not_submitted')->index();
        });
        Schema::create('plan_submissions', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('plan_id');
            $table->foreign('plan_id')->references('record_id')->on('tblstrategic_record')->restrictOnDelete();
            $table->foreignId('workflow_id')->constrained('approval_workflows');
            $table->unsignedInteger('workflow_version');
            $table->json('workflow_snapshot');
            $table->json('plan_snapshot');
            $table->unsignedBigInteger('submitted_by');
            $table->foreign('submitted_by')->references('user_id')->on('tblusers')->restrictOnDelete();
            $table->enum('status', ['under_approval', 'approved', 'rejected']);
            $table->unsignedInteger('current_sequence')->nullable();
            $table->timestamp('submitted_at');
            $table->timestamp('completed_at')->nullable();
            $table->index(['plan_id', 'id']);
        });
        Schema::create('plan_submission_stages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('submission_id')->constrained('plan_submissions')->restrictOnDelete();
            $table->unsignedInteger('sequence');
            $table->string('name');
            $table->string('approver_type');
            $table->unsignedBigInteger('approver_id');
            $table->string('approver_label');
            $table->enum('status', ['waiting', 'current', 'approved', 'rejected'])->default('waiting');
            $table->unique(['submission_id', 'sequence']);
        });
        Schema::create('plan_stage_reviewers', function (Blueprint $table) {
            $table->foreignId('stage_id')->constrained('plan_submission_stages')->restrictOnDelete();
            $table->unsignedBigInteger('user_id');
            $table->foreign('user_id')->references('user_id')->on('tblusers')->restrictOnDelete();
            $table->string('reviewer_name');
            $table->primary(['stage_id', 'user_id']);
        });
        Schema::create('plan_workflow_history', function (Blueprint $table) {
            $table->id();
            $table->foreignId('submission_id')->constrained('plan_submissions')->restrictOnDelete();
            $table->foreignId('stage_id')->constrained('plan_submission_stages')->restrictOnDelete();
            $table->unsignedBigInteger('actor_id');
            $table->foreign('actor_id')->references('user_id')->on('tblusers')->restrictOnDelete();
            $table->string('actor_name');
            $table->string('action');
            $table->text('comment')->nullable();
            $table->timestamp('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('plan_workflow_history');
        Schema::dropIfExists('plan_stage_reviewers');
        Schema::dropIfExists('plan_submission_stages');
        Schema::dropIfExists('plan_submissions');
        Schema::table('tblstrategic_record', fn (Blueprint $table) => $table->dropColumn('approval_status'));
        Schema::dropIfExists('approval_workflow_stages');
        Schema::dropIfExists('approval_workflows');
    }
};
