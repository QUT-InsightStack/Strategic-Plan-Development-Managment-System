<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('tblpdp_chapter_objectives');

        Schema::table('tblpdp_chapters', function (Blueprint $table): void {
            $table->longText('chapter_description')->change();
        });
    }

    public function down(): void
    {
        Schema::table('tblpdp_chapters', function (Blueprint $table): void {
            $table->text('chapter_description')->change();
        });
    }
};
