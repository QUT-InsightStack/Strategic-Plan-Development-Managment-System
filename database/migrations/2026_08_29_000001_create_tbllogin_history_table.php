<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tbllogin_history', function (Blueprint $table): void {
            $table->id('login_history_id');

            /*
             * Nullable because:
             * - failed attempts may use an unknown email;
             * - deleting a user must not delete login history.
             */
            $table->unsignedBigInteger('user_id')->nullable();

            /*
             * historical snapshots remain available if user is deleted
             * or later changes their name or email address.
             */
            $table->string('user_name', 511)->nullable();
            $table->string('email', 255);

            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();

            // Controlled values: success or failed.
            $table->string('status', 20);

            // Controlled internal reason, such as invalid_credentials.
            $table->string('failure_reason', 100)->nullable();

            $table->timestamp('attempted_at');

            $table->foreign('user_id')
                ->references('user_id')
                ->on('tblusers')
                ->nullOnDelete();

            /*
             * Indexes for the default date ordering and supported filters.
             */
            $table->index(
                ['attempted_at', 'login_history_id'],
                'login_history_attempted_id_idx'
            );

            $table->index(
                ['user_id', 'attempted_at'],
                'login_history_user_attempted_idx'
            );

            $table->index(
                ['status', 'attempted_at'],
                'login_history_status_attempted_idx'
            );

            $table->index(
                ['email', 'attempted_at'],
                'login_history_email_attempted_idx'
            );

            $table->index(
                ['ip_address', 'attempted_at'],
                'login_history_ip_attempted_idx'
            );
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tbllogin_history');
    }
};