<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tblstrategic_record', function (Blueprint $table) {
            if (! Schema::hasColumn('tblstrategic_record', 'status')) {
                $table->enum('status', ['draft', 'finished', 'archived', 'deleted'])
                    ->default('draft')
                    ->after('description');
            }

            if (! Schema::hasColumn('tblstrategic_record', 'archived_at')) {
                $table->timestamp('archived_at')->nullable()->after('status');
            }

            if (! Schema::hasColumn('tblstrategic_record', 'deleted_at')) {
                $table->timestamp('deleted_at')->nullable()->after('archived_at');
            }
        });

        Schema::table('tblstrategic_record', function (Blueprint $table) {
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::table('tblstrategic_record', function (Blueprint $table) {
            if (Schema::hasColumn('tblstrategic_record', 'deleted_at')) {
                $table->dropColumn('deleted_at');
            }

            if (Schema::hasColumn('tblstrategic_record', 'archived_at')) {
                $table->dropColumn('archived_at');
            }

            if (Schema::hasColumn('tblstrategic_record', 'status')) {
                $table->dropIndex(['status']);
                $table->dropColumn('status');
            }
        });
    }
};
