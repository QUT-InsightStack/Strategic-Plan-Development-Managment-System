<?php

use Database\Seeders\AdministrativePlanningPermissionSeeder;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        app(AdministrativePlanningPermissionSeeder::class)->run();
    }

    public function down(): void
    {
        // Preserve permissions that may have existed before this migration.
    }
};