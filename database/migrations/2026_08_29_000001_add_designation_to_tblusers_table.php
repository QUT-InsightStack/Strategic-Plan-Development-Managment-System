<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Designation is a self-service profile field: the job title a user
     * chooses to display. It is deliberately separate from `position`,
     * which forms part of the organisational structure and is maintained
     * by administrators rather than by the user.
     */
    public function up(): void
    {
        Schema::table('tblusers', function (Blueprint $table) {
            $table->string('designation', 255)
                  ->nullable()
                  ->after('position');
        });
    }

    public function down(): void
    {
        Schema::table('tblusers', function (Blueprint $table) {
            $table->dropColumn('designation');
        });
    }
};
