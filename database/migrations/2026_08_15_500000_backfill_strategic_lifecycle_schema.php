<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('tblstrategic_record')) {
            return;
        }

        // Some existing databases ran the original status-only version of
        // the strategic-record lifecycle migration. Add only missing columns
        // before the archive-metadata migration runs.
        Schema::table('tblstrategic_record', function (Blueprint $table) {
            if (! Schema::hasColumn('tblstrategic_record', 'archived_at')) {
                $table->timestamp('archived_at')->nullable()->after('status');
            }

            if (! Schema::hasColumn('tblstrategic_record', 'deleted_at')) {
                $table->timestamp('deleted_at')->nullable()->after('archived_at');
            }
        });
    }

    public function down(): void
    {
        // Intentionally left blank. These lifecycle columns may contain data
        // and are required by later migrations and application code.
    }
};
