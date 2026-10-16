<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tblstrategic_record', function (Blueprint $table) {
            $table->enum('status_before_archive', ['draft', 'finished'])
                ->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('tblstrategic_record', function (Blueprint $table) {
            $table->dropColumn('status_before_archive');
        });
    }
};