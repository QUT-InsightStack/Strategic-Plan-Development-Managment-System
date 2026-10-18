<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tblstrategic_plan_comments', function (Blueprint $table) {
            $table->id('plan_comment_id');
            $table->unsignedBigInteger('strategic_plan_id');
            $table->unsignedBigInteger('responsible_unit_id');
            $table->unsignedBigInteger('submitted_by')->nullable();
            $table->string('responsible_office_agency');
            $table->string('submitter_name', 511);
            $table->text('content');
            $table->timestamp('submitted_at')->useCurrent();
            $table->foreign('strategic_plan_id')->references('record_id')->on('tblstrategic_record')->restrictOnDelete();
            $table->foreign('responsible_unit_id')->references('responsible_unit_id')->on('tblresponsible_units')->restrictOnDelete();
            $table->foreign('submitted_by')->references('user_id')->on('tblusers')->nullOnDelete();
            $table->index(['strategic_plan_id', 'plan_comment_id'], 'plan_comment_history');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tblstrategic_plan_comments');
    }
};
