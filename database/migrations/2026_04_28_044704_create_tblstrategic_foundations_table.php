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
        Schema::create('tblstrategic_foundations', function (Blueprint $table) {
            $table->id('foundation_id');
            $table->unsignedBigInteger('created_by');
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->enum('type', ['MISSION', 'VISION', 'CORE_VALUE']);
            $table->text('content');
            $table->string('version');
            $table->enum('status', ['active', 'archived', 'deleted'])->default('active');
            $table->timestamp('archived_at')->nullable();
            $table->unsignedBigInteger('archived_by')->nullable();
            $table->timestamp('deleted_at')->nullable();
            $table->timestamps();

            $table->foreign('created_by')
                ->references('user_id')
                ->on('tblusers')
                ->onDelete('cascade');

            $table->foreign('updated_by')
                ->references('user_id')
                ->on('tblusers')
                ->onDelete('cascade');

            $table->index('type');
            $table->foreign('archived_by')->references('user_id')->on('tblusers')->nullOnDelete();
            $table->index('archived_by');
            $table->index('status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('tblstrategic_foundations');
    }
};
