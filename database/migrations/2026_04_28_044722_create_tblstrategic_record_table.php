<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('tblstrategic_record', function (Blueprint $table) {
            $table->id('record_id');
            $table->unsignedBigInteger('created_by');
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->string('level');
            $table->string('title', 255);
            $table->text('description')->nullable();
            $table->enum('status', ['draft', 'finished', 'archived', 'deleted'])->default('draft');
            $table->timestamp('archived_at')->nullable();
            $table->unsignedBigInteger('archived_by')->nullable();
            $table->timestamp('deleted_at')->nullable();
            $table->string('file_path')->nullable();
            $table->unsignedBigInteger('mission_id');
            $table->unsignedBigInteger('vision_id');
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();

            $table->foreign('created_by')
                ->references('user_id')
                ->on('tblusers')
                ->onDelete('cascade');

            $table->foreign('updated_by')
                ->references('user_id')
                ->on('tblusers')
                ->nullOnDelete();

            $table->foreign('mission_id')
                ->references('foundation_id')
                ->on('tblstrategic_foundations')
                ->onDelete('cascade');
            $table->foreign('vision_id')
                ->references('foundation_id')
                ->on('tblstrategic_foundations')
                ->onDelete('cascade');

            $table->index('mission_id');
            $table->index('vision_id');
            $table->index('status');
            $table->foreign('archived_by')->references('user_id')->on('tblusers')->nullOnDelete();
            $table->index('archived_by');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('tblstrategic_record');
    }
};
