<?php

use Database\Seeders\ClientRolePermissionCorrectionSeeder;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        app(ClientRolePermissionCorrectionSeeder::class)->run();
    }

    public function down(): void
    {
        // Reversing client-approved permissions requires an explicit change.
    }
};