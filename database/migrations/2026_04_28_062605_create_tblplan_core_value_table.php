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
        Schema::create('tblplan_core_value', function (Blueprint $table) {
            $table->id('link_id');
            $table->unsignedBigInteger('core_value_id');
            $table->unsignedBigInteger('plan_id');
            $table->unsignedBigInteger('created_by');
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->enum('status', ['active', 'archived', 'deleted'])->default('active');
            $table->timestamp('archived_at')->nullable();
            $table->timestamp('deleted_at')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();

            $table->foreign('core_value_id')
                  ->references('foundation_id')
                  ->on('tblstrategic_foundations')
                  ->onDelete('cascade');
            $table->foreign('plan_id')
                  ->references('record_id')
                  ->on('tblstrategic_record')
                  ->onDelete('cascade');
            $table->foreign('created_by')
                  ->references('user_id')
                  ->on('tblusers')
                  ->onDelete('cascade');
            $table->foreign('updated_by')
                  ->references('user_id')
                  ->on('tblusers')
                  ->onDelete('cascade');
             $table->unique(['core_value_id', 'plan_id']); // prevent duplicate links
             $table->index('status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('tblplan_core_value');
    }
};
