<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        foreach (['tblobjective_pdp_chapter', 'tblobjective_presidential_agenda'] as $name) {
            Schema::table($name, fn (Blueprint $table) => $table->json('reference_details')->nullable());
        }
    }

    public function down(): void
    {
        foreach (['tblobjective_pdp_chapter', 'tblobjective_presidential_agenda'] as $name) {
            Schema::table($name, fn (Blueprint $table) => $table->dropColumn('reference_details'));
        }
    }
};
