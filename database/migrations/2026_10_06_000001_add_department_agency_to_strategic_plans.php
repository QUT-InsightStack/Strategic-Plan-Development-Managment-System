<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tblstrategic_record', function (Blueprint $table) {
            $table->string('department_agency', 255)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('tblstrategic_record', function (Blueprint $table) {
            $table->dropColumn('department_agency');
        });
    }
};
