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
        Schema::create('tblpermissions', function (Blueprint $table) {
            $table->id('permission_id');
            $table->string('permission_name', 255);
            $table->text('description')->nullable();
            $table->string('code', 100)->unique(); // e.g. "plans.create", "plans.view"
            $table->string('module', 100);         // e.g. "strategic_plans", "users"
            $table->timestamps();
        });
    
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('tblpermissions');
    }
};
