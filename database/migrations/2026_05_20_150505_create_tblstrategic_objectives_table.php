<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tblstrategic_objectives', function (Blueprint $table) {
            $table->id('objective_id');

            $table->unsignedBigInteger('strategic_plan_id');

            $table->unsignedBigInteger('created_by');
            $table->unsignedBigInteger('updated_by')->nullable();

            $table->string('objective_title', 255)->nullable();
            $table->text('objective_description')->nullable();
            $table->text('expected_outcome')->nullable();
            $table->text('indicator')->nullable();
            $table->string('target', 255)->nullable();
            $table->string('responsible_office_agency', 255)->nullable();

            $table->enum('status', ['draft', 'published'])->default('published');

            $table->timestamps();

            $table->foreign('strategic_plan_id')
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
                ->nullOnDelete();

            $table->index('strategic_plan_id');
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tblstrategic_objectives');
    }
};