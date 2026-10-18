<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tblpdp_chapters', function (Blueprint $table): void {
            $table->id('chapter_id');
            $table->string('chapter_title', 255);
            $table->longText('chapter_description');
            $table->unsignedBigInteger('created_by');
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();

            $table->foreign('created_by')->references('user_id')->on('tblusers')->restrictOnDelete();
            $table->foreign('updated_by')->references('user_id')->on('tblusers')->nullOnDelete();
            $table->index('chapter_title');
        });

    }

    public function down(): void
    {
        Schema::dropIfExists('tblpdp_chapters');
    }
};
