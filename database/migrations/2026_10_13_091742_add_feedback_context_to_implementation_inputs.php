<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tblimplementation_inputs', function (Blueprint $table) {
            $table->string('feedback_category', 40)->nullable();
            $table->string('mapping_type', 40)->nullable();
            $table->unsignedBigInteger('mapping_reference_id')->nullable();
            $table->string('mapping_reference_title')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('tblimplementation_inputs', function (Blueprint $table) {
            $table->dropColumn([
                'feedback_category',
                'mapping_type',
                'mapping_reference_id',
                'mapping_reference_title',
            ]);
        });
    }
};