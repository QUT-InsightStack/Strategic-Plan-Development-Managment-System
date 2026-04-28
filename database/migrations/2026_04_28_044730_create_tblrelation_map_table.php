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
        Schema::create('tblrelation_map', function (Blueprint $table) {
            $table->id('relation_id');
            $table->unsignedBigInteger('record_id');
            $table->unsignedBigInteger('parent_id');
            $table->unsignedBigInteger('created_by');
            $table->timestamps();

                $table->foreign('record_id')
                    ->references('record_id')
                    ->on('tblstrategic_record')
                    ->onDelete('cascade');
    
                $table->foreign('parent_id')
                    ->references('record_id')
                    ->on('tblstrategic_record')
                    ->onDelete('cascade');
    
                $table->foreign('created_by')
                    ->references('user_id')
                    ->on('tblusers')
                    ->onDelete('cascade');

                $table->unique(['record_id', 'parent_id']); // prevent duplicate relationships
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('tblrelation_map');
    }
};
