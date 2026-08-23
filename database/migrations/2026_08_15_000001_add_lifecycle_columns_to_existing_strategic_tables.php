<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $this->addFoundationLifecycleColumns();
        $this->addLinkLifecycleColumns();
        $this->addRelationLifecycleColumns();
        $this->addObjectiveLifecycleColumns();
    }

    public function down(): void
    {
        // Intentionally left blank.
        // This migration backfills legacy databases whose original create-table
        // migrations may already include these columns on fresh installs.
    }

    private function addFoundationLifecycleColumns(): void
    {
        Schema::table('tblstrategic_foundations', function (Blueprint $table) {
            if (! Schema::hasColumn('tblstrategic_foundations', 'status')) {
                $table->enum('status', ['active', 'archived', 'deleted'])
                    ->default('active')
                    ->after('version');
            }

            if (! Schema::hasColumn('tblstrategic_foundations', 'archived_at')) {
                $table->timestamp('archived_at')->nullable()->after('status');
            }

            if (! Schema::hasColumn('tblstrategic_foundations', 'deleted_at')) {
                $table->timestamp('deleted_at')->nullable()->after('archived_at');
            }
        });
    }

    private function addLinkLifecycleColumns(): void
    {
        Schema::table('tblplan_core_value', function (Blueprint $table) {
            if (! Schema::hasColumn('tblplan_core_value', 'status')) {
                $table->enum('status', ['active', 'archived', 'deleted'])
                    ->default('active')
                    ->after('updated_by');
            }

            if (! Schema::hasColumn('tblplan_core_value', 'archived_at')) {
                $table->timestamp('archived_at')->nullable()->after('status');
            }

            if (! Schema::hasColumn('tblplan_core_value', 'deleted_at')) {
                $table->timestamp('deleted_at')->nullable()->after('archived_at');
            }
        });
    }

    private function addRelationLifecycleColumns(): void
    {
        Schema::table('tblrelation_map', function (Blueprint $table) {
            if (! Schema::hasColumn('tblrelation_map', 'status')) {
                $table->enum('status', ['active', 'archived', 'deleted'])
                    ->default('active')
                    ->after('created_by');
            }

            if (! Schema::hasColumn('tblrelation_map', 'archived_at')) {
                $table->timestamp('archived_at')->nullable()->after('status');
            }

            if (! Schema::hasColumn('tblrelation_map', 'deleted_at')) {
                $table->timestamp('deleted_at')->nullable()->after('archived_at');
            }
        });
    }

    private function addObjectiveLifecycleColumns(): void
    {
        if (! Schema::hasTable('tblstrategic_objectives')) {
            return;
        }

        Schema::table('tblstrategic_objectives', function (Blueprint $table) {
            if (! Schema::hasColumn('tblstrategic_objectives', 'status')) {
                $table->enum('status', ['draft', 'published', 'archived', 'deleted'])
                    ->default('draft')
                    ->after('responsible_office_agency');
            }

            if (! Schema::hasColumn('tblstrategic_objectives', 'archived_at')) {
                $table->timestamp('archived_at')->nullable()->after('status');
            }

            if (! Schema::hasColumn('tblstrategic_objectives', 'deleted_at')) {
                $table->timestamp('deleted_at')->nullable()->after('archived_at');
            }
        });
    }
};
