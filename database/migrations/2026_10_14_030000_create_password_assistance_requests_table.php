<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('password_assistance_requests', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id')->index();

            $table->string('status', 20)->default('pending');

            // Pending/accepted requests use 1; closed requests use null.
            // Prevents multiple open requests for the same user.
            $table->unsignedTinyInteger('open_slot')->nullable()->default(1);

            $table->unsignedBigInteger('accepted_by')->nullable();
            $table->timestamp('accepted_at')->nullable();
            $table->unsignedBigInteger('handled_by')->nullable();
            $table->timestamp('handled_at')->nullable();

            $table->timestamps();

            $table->unique(
                ['user_id', 'open_slot'],
                'password_assistance_one_open_per_user'
            );

            $table->index(['status', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('password_assistance_requests');
    }
};