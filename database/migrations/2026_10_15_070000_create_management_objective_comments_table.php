<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tblmanagement_objective_comments', function (Blueprint $table) {
            $table->id('comment_id');

            $table->unsignedBigInteger('strategic_plan_id');
            $table->unsignedBigInteger('objective_id');

            $table->unsignedBigInteger('author_id')->nullable();
            $table->string('author_name');
            $table->text('content');

            $table->enum('acknowledgement_status', [
                'not_acknowledged',
                'acknowledged',
            ])->default('not_acknowledged');

            $table->unsignedBigInteger('acknowledged_by')->nullable();
            $table->string('acknowledger_name')->nullable();
            $table->timestamp('acknowledged_at')->nullable();

            $table->enum('completion_status', [
                'open',
                'completed',
                'incomplete',
            ])->default('open');

            $table->text('closing_remarks')->nullable();
            $table->unsignedBigInteger('closed_by')->nullable();
            $table->string('closer_name')->nullable();
            $table->timestamp('closed_at')->nullable();

            $table->timestamps();

            $table->foreign('strategic_plan_id', 'mgmt_comment_plan_fk')
                ->references('record_id')
                ->on('tblstrategic_record')
                ->restrictOnDelete();

            // Also enforce that the objective belongs to the stored plan.
            $table->foreign(
                ['objective_id', 'strategic_plan_id'],
                'mgmt_comment_objective_plan_fk'
            )
                ->references(['objective_id', 'strategic_plan_id'])
                ->on('tblstrategic_objectives')
                ->restrictOnDelete();

            $table->foreign('author_id', 'mgmt_comment_author_fk')
                ->references('user_id')
                ->on('tblusers')
                ->nullOnDelete();

            $table->foreign('acknowledged_by', 'mgmt_comment_ack_actor_fk')
                ->references('user_id')
                ->on('tblusers')
                ->nullOnDelete();

            $table->foreign('closed_by', 'mgmt_comment_close_actor_fk')
                ->references('user_id')
                ->on('tblusers')
                ->nullOnDelete();

            $table->index(
                ['strategic_plan_id', 'completion_status', 'acknowledgement_status'],
                'mgmt_comment_queue_idx'
            );

            $table->index(['objective_id', 'created_at'], 'mgmt_comment_objective_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tblmanagement_objective_comments');
    }
};