<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tblusers', function (Blueprint $table): void {
            $table->unsignedInteger('failed_login_attempts')->default(0)->after('status');
            $table->timestamp('locked_until')->nullable()->after('failed_login_attempts');
            $table->timestamp('last_activity_at')->nullable()->after('locked_until');
        });
    }

    public function down(): void
    {
        Schema::table('tblusers', function (Blueprint $table): void {
            $table->dropColumn(['failed_login_attempts', 'locked_until', 'last_activity_at']);
        });
    }
};