<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Record of every sign-in attempt, successful or not.
 *
 * Deliberately separate from tbllog. That table requires a user_id, so a
 * failed attempt against an address that matches no account — the case worth
 * watching for — cannot be stored there at all. Login events also carry
 * fields no other log entry needs: where the attempt came from and what it
 * was made with.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tbllogin_history', function (Blueprint $table): void {
            $table->id('login_history_id');

            // Null when the attempt used an address with no matching account.
            $table->unsignedBigInteger('user_id')->nullable();

            // The address the attempt was made with, kept so a failed attempt
            // still shows which account was targeted.
            $table->string('email', 255);

            $table->enum('outcome', ['success', 'failed']);

            // Why a failed attempt failed. Never sent to the person signing
            // in — the response stays deliberately generic — but an
            // administrator needs to tell a wrong password apart from an
            // attempt on an account that is already suspended.
            $table->string('reason', 50)->nullable();

            // 45 characters covers IPv6, including IPv4-mapped form.
            $table->string('ip_address', 45)->nullable();

            $table->text('user_agent')->nullable();

            $table->timestamps();

            $table->foreign('user_id')
                ->references('user_id')
                ->on('tblusers')
                ->nullOnDelete();

            // Supports the three ways this table is read: one person's own
            // history, the administrator list filtered by outcome, and
            // counting recent failures against one address.
            $table->index(['user_id', 'created_at']);
            $table->index(['outcome', 'created_at']);
            $table->index(['email', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tbllogin_history');
    }
};
