<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('plan_submissions', function (Blueprint $table) {
            $table->foreignId('previous_submission_id')->nullable()->unique()
                ->constrained('plan_submissions')->restrictOnDelete();
        });
        Schema::create('workflow_notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('event_id')->constrained('plan_workflow_history')->restrictOnDelete();
            $table->foreignId('submission_id')->constrained('plan_submissions')->restrictOnDelete();
            $table->unsignedBigInteger('plan_id');
            $table->foreign('plan_id')->references('record_id')->on('tblstrategic_record')->restrictOnDelete();
            $table->unsignedBigInteger('recipient_id');
            $table->foreign('recipient_id')->references('user_id')->on('tblusers')->restrictOnDelete();
            $table->json('payload');
            $table->enum('status', ['pending', 'sent', 'failed'])->default('pending');
            $table->unsignedInteger('attempts')->default(0);
            $table->string('last_error')->nullable();
            $table->timestamp('next_attempt_at')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamp('read_at')->nullable();
            $table->timestamps();
            $table->unique(['event_id', 'recipient_id']);
            $table->index(['recipient_id', 'status', 'id']);
            $table->index(['status', 'next_attempt_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('workflow_notifications');
        Schema::table('plan_submissions', function (Blueprint $table) {
            $table->dropForeign(['previous_submission_id']);
            $table->dropUnique(['previous_submission_id']);
            $table->dropColumn('previous_submission_id');
        });
    }
};
