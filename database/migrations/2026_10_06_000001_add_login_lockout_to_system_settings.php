<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tblsystem_settings', function (Blueprint $table) {
            // Preserve the runtime lockout previously configured in security.php.
            $table->unsignedInteger('login_lockout_minutes')->default(15);
        });
    }

    public function down(): void
    {
        Schema::table('tblsystem_settings', fn (Blueprint $table) => $table->dropColumn('login_lockout_minutes'));
    }
};
