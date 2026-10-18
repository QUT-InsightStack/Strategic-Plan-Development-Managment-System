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
        Schema::create('tblroles', function (Blueprint $table) {
            $table->id('role_id');
            $table->string('role_name', 100)->unique();
            $table->text('description')->nullable();
            // Unknown roles remain protected and unavailable for assignment.
            $table->boolean('is_assignable')->default(false);
            $table->boolean('is_protected')->default(true);
            $table->timestamps();
        });

    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('tblroles');
    }
};
