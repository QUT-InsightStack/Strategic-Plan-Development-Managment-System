<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $tables = [
            'tblstrategic_record',
            'tblstrategic_foundations',
            'tblplan_core_value',
            'tblrelation_map',
            'tblstrategic_objectives',
        ];

        foreach ($tables as $tableName) {
            Schema::table($tableName, function (Blueprint $table) use ($tableName) {
                if (! Schema::hasColumn($tableName, 'archived_by')) {
                    $table->unsignedBigInteger('archived_by')->nullable()->after('archived_at');
                    $table->foreign('archived_by')
                        ->references('user_id')
                        ->on('tblusers')
                        ->nullOnDelete();
                    $table->index('archived_by');
                }
            });
        }

        Schema::table('tblstrategic_objectives', function (Blueprint $table) {
            if (! Schema::hasColumn('tblstrategic_objectives', 'status_before_archive')) {
                $table->enum('status_before_archive', ['draft', 'published'])->nullable()->after('status');
            }
        });
    }

    public function down(): void
    {
        Schema::table('tblstrategic_objectives', function (Blueprint $table) {
            if (Schema::hasColumn('tblstrategic_objectives', 'status_before_archive')) {
                $table->dropColumn('status_before_archive');
            }
        });

        $tables = [
            'tblstrategic_record',
            'tblstrategic_foundations',
            'tblplan_core_value',
            'tblrelation_map',
            'tblstrategic_objectives',
        ];

        foreach ($tables as $tableName) {
            Schema::table($tableName, function (Blueprint $table) use ($tableName) {
                if (Schema::hasColumn($tableName, 'archived_by')) {
                    $table->dropForeign(['archived_by']);
                    $table->dropIndex(['archived_by']);
                    $table->dropColumn('archived_by');
                }
            });
        }
    }
};
