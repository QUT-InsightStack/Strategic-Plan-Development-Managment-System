<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('security_settings', function (Blueprint $table): void {
            $table->id();
            $table->string('key')->unique();
            $table->unsignedInteger('value');
            $table->timestamps();
        });

        $now = now();
        DB::table('security_settings')->insert([
            ['key' => 'session_timeout_minutes', 'value' => 30, 'created_at' => $now, 'updated_at' => $now],
            ['key' => 'max_failed_login_attempts', 'value' => 3, 'created_at' => $now, 'updated_at' => $now],
            ['key' => 'lockout_duration_minutes', 'value' => 120, 'created_at' => $now, 'updated_at' => $now],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('security_settings');
    }
};