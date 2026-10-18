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
        Schema::create('tblusers', function (Blueprint $table) {
            $table->id('user_id');
            $table->unsignedBigInteger('role_id')->nullable();
            $table->unsignedBigInteger('auth_version')->default(1);
            $table->string('first_name', 255);
            $table->string('last_name', 255)->nullable();
            $table->string('email', 255)->unique();
            $table->timestamp('email_verified_at')->nullable();
            $table->string('mobile', 20)->nullable();
            $table->string('address', 255)->nullable();
            $table->string('gender', 32)->nullable();
            $table->date('date_of_birth')->nullable();
            $table->string('profile_picture')->nullable();
            $table->string('department', 255)->nullable();
            $table->string('unit', 255)->nullable();
            $table->string('office', 255)->nullable();
            $table->string('position', 255)->nullable();
            $table->string('designation', 255)->nullable();
            $table->string('password');
            $table->enum('status', ['active', 'inactive', 'suspended'])
                ->default('active');
            $table->unsignedInteger('failed_login_attempts')->default(0);
            $table->timestamp('locked_until')->nullable();
            $table->timestamp('last_activity_at')->nullable();
            $table->rememberToken();
            $table->timestamps();

            $table->foreign('role_id')
                ->references('role_id')
                ->on('tblroles')
                ->nullOnDelete(); // preserve user record if role is deleted
            $table->index('first_name', 'tblusers_first_name_index');
            $table->index('last_name', 'tblusers_last_name_index');
            $table->index('status', 'tblusers_status_index');
        });

    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('tblusers');
    }
};
