<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (
            Schema::getConnection()->getDriverName() !== 'mysql'
            || ! Schema::hasTable('tblstrategic_objectives')
            || ! Schema::hasColumn('tblstrategic_objectives', 'status')
        ) {
            return;
        }

        DB::statement(
            "ALTER TABLE `tblstrategic_objectives`
             MODIFY `status` ENUM('draft', 'published', 'archived', 'deleted')
             NOT NULL DEFAULT 'draft'"
        );
    }

    public function down(): void
    {
        // Intentionally left blank. Narrowing the enum could corrupt existing
        // archived or deleted objective lifecycle data.
    }
};
