<?php

use Database\Seeders\ManagementObjectiveCommentPermissionSeeder;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        app(ManagementObjectiveCommentPermissionSeeder::class)->run();
    }

    public function down(): void
    {
        // Preserve permissions and grants that may also be managed elsewhere.
    }
};