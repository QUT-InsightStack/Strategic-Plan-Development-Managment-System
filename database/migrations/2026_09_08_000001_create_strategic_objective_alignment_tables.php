<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tblpresidential_agenda_items', function (Blueprint $table): void {
            $table->id('agenda_id');
            $table->string('code', 50)->unique();
            $table->string('title', 255);
            $table->longText('description');
            $table->enum('status', ['active', 'inactive'])->default('active');
            $table->date('effective_date')->nullable();
            $table->text('note')->nullable();
            $table->unsignedBigInteger('created_by');
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();

            $table->foreign('created_by')->references('user_id')->on('tblusers')->restrictOnDelete();
            $table->foreign('updated_by')->references('user_id')->on('tblusers')->nullOnDelete();
        });

        Schema::create('tblobjective_pdp_chapter', function (Blueprint $table): void {
            $table->unsignedBigInteger('objective_id');
            $table->unsignedBigInteger('chapter_id');
            $table->timestamps();

            $table->primary(['objective_id', 'chapter_id'], 'objective_pdp_chapter_pk');
            $table->index('chapter_id');
            $table->foreign('objective_id', 'objective_pdp_objective_fk')
                ->references('objective_id')->on('tblstrategic_objectives')->cascadeOnDelete();
            $table->foreign('chapter_id', 'objective_pdp_chapter_fk')
                ->references('chapter_id')->on('tblpdp_chapters')->cascadeOnDelete();
        });

        Schema::create('tblobjective_presidential_agenda', function (Blueprint $table): void {
            $table->unsignedBigInteger('objective_id');
            $table->unsignedBigInteger('agenda_id');
            $table->timestamps();

            $table->primary(['objective_id', 'agenda_id'], 'objective_presidential_agenda_pk');
            $table->index('agenda_id');
            $table->foreign('objective_id', 'objective_agenda_objective_fk')
                ->references('objective_id')->on('tblstrategic_objectives')->cascadeOnDelete();
            $table->foreign('agenda_id', 'objective_agenda_item_fk')
                ->references('agenda_id')->on('tblpresidential_agenda_items')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tblobjective_presidential_agenda');
        Schema::dropIfExists('tblobjective_pdp_chapter');
        Schema::dropIfExists('tblpresidential_agenda_items');
    }
};
