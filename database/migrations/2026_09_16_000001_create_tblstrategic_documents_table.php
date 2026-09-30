<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tblstrategic_documents', function (Blueprint $table) {
            $table->id('document_id');
            $table->unsignedBigInteger('strategic_plan_id')->nullable();
            $table->unsignedBigInteger('objective_id')->nullable();
            $table->unsignedBigInteger('uploaded_by');
            $table->string('original_filename', 255);
            $table->string('stored_path', 500);
            $table->string('mime_type', 150);
            $table->string('extension', 20);
            $table->unsignedBigInteger('size_bytes');
            $table->string('sha256', 64);
            $table->timestamps();

            $table->foreign('strategic_plan_id')->references('record_id')
                ->on('tblstrategic_record')->cascadeOnDelete();
            $table->foreign('objective_id')->references('objective_id')
                ->on('tblstrategic_objectives')->cascadeOnDelete();
            $table->foreign('uploaded_by')->references('user_id')
                ->on('tblusers')->cascadeOnDelete();
            $table->index(['strategic_plan_id', 'created_at']);
            $table->index(['objective_id', 'created_at']);
            });

            DB::statement(
                'ALTER TABLE `tblstrategic_documents`
                 ADD CONSTRAINT `strategic_documents_one_parent_check`
                 CHECK (
                     (`strategic_plan_id` IS NOT NULL AND `objective_id` IS NULL)
                     OR
                     (`strategic_plan_id` IS NULL AND `objective_id` IS NOT NULL)
                 )'
            );
    }

    public function down(): void
    {
        Schema::dropIfExists('tblstrategic_documents');
    }
};
