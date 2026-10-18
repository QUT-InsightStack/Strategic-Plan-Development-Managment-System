<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tblsystem_settings', function (Blueprint $table): void {
            $table->unsignedTinyInteger('id')->primary();

            $table->unsignedSmallInteger('session_idle_timeout_minutes')
                ->default(30);

            $table->unsignedTinyInteger('login_attempt_limit')
                ->default(5);

            $table->boolean('maintenance_enabled')
                ->default(false);

            $table->unsignedTinyInteger('password_min_length')
                ->default(15);

            $table->boolean('password_require_mixed_case')
                ->default(false);

            $table->boolean('password_require_numbers')
                ->default(false);

            $table->boolean('password_require_symbols')
                ->default(false);

            $table->timestamps();
        });

        DB::table('tblsystem_settings')->insert([
            'id' => 1,
            'session_idle_timeout_minutes' => 30,
            'login_attempt_limit' => 5,
            'maintenance_enabled' => false,
            'password_min_length' => 15,
            'password_require_mixed_case' => false,
            'password_require_numbers' => false,
            'password_require_symbols' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        Schema::create('tblauth_sessions', function (Blueprint $table): void {
            $table->uuid('id')->primary();

            $table->unsignedBigInteger('user_id');

            $table->timestamp('last_activity_at');
            $table->timestamp('expires_at');
            $table->timestamp('revoked_at')->nullable();

            $table->timestamps();

            $table->foreign('user_id')
                ->references('user_id')
                ->on('tblusers')
                ->cascadeOnDelete();

            $table->index(['user_id', 'revoked_at']);
            $table->index('expires_at');
        });

        /*
         * Independent of login history: this is operational lockout state.
         * A hashed normalized identifier avoids storing duplicate email PII.
         */
        Schema::create('tbllogin_attempt_states', function (Blueprint $table): void {
            $table->char('identifier_hash', 64)->primary();
            $table->unsignedInteger('failed_attempts')->default(0);
            $table->timestamp('window_started_at')->nullable();
            $table->timestamp('locked_until')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tbllogin_attempt_states');
        Schema::dropIfExists('tblauth_sessions');
        Schema::dropIfExists('tblsystem_settings');
    }
};