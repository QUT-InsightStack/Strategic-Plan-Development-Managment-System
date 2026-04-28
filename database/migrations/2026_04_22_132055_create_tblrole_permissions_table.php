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
        Schema::create('tblrole_permissions', function (Blueprint $table) {
            $table->id('relation_id');
            $table->unsignedBigInteger('role_id');
            $table->unsignedBigInteger('permission_id');
            $table->timestamps();
    
    
            $table->foreign('role_id')
                  ->references('role_id')
                  ->on('tblroles')
                  ->onDelete('cascade');
    
    
            $table->foreign('permission_id')
                  ->references('permission_id')
                  ->on('tblpermissions')
                  ->onDelete('cascade');
    
    
            $table->unique(['role_id', 'permission_id']); // prevent duplicate assignments
        });
    
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('tblrole_permissions');
    }
};
