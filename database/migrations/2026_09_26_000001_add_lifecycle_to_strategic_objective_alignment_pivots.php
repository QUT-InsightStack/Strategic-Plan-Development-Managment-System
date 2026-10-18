<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Composite primary keys and existing reference foreign keys are left
     * unchanged, so each historical mapping keeps its identity.
     */
    private const TABLES = [
        'tblobjective_pdp_chapter' => [
            'after' => 'chapter_id',
            'prefix' => 'objective_pdp',
        ],
        'tblobjective_presidential_agenda' => [
            'after' => 'agenda_id',
            'prefix' => 'objective_agenda',
        ],
    ];

    public function up(): void
    {
        foreach (self::TABLES as $table => $config) {
            Schema::table($table, function (Blueprint $blueprint) use ($config): void {
                // Existing rows receive the default and remain active.
                $blueprint->enum('status', ['active', 'archived'])
                    ->default('active')
                    ->after($config['after']);
                $blueprint->timestamp('archived_at')->nullable()->after('status');
                $blueprint->unsignedBigInteger('archived_by')->nullable()->after('archived_at');

                // Archive history survives deletion of the acting user.
                $blueprint->foreign('archived_by', $config['prefix'].'_archived_by_fk')
                    ->references('user_id')
                    ->on('tblusers')
                    ->nullOnDelete();

                $blueprint->index(['objective_id', 'status'], $config['prefix'].'_status_idx');
            });

            if ($this->supportsCheckConstraints()) {
                // archived_by is deliberately excluded: MySQL prohibits CHECK
                // constraints on columns with ON DELETE SET NULL actions.
                DB::statement(sprintf(
                    "ALTER TABLE `%s` ADD CONSTRAINT `%s_archive_state_chk` CHECK ("
                    ."(`status` = 'active' AND `archived_at` IS NULL) "
                    ."OR (`status` = 'archived' AND `archived_at` IS NOT NULL))",
                    $table,
                    $config['prefix']
                ));
            }
        }
    }

    public function down(): void
    {
        foreach (array_keys(self::TABLES) as $table) {
            if (DB::table($table)->where('status', 'archived')->exists()) {
                throw new RuntimeException(
                    "Cannot roll back alignment lifecycle columns while archived mappings exist in {$table}."
                );
            }
        }

        foreach (self::TABLES as $table => $config) {
            if ($this->supportsCheckConstraints()) {
                DB::statement(sprintf(
                    'ALTER TABLE `%s` DROP CONSTRAINT `%s_archive_state_chk`',
                    $table,
                    $config['prefix']
                ));
            }

            Schema::table($table, function (Blueprint $blueprint) use ($config): void {
                $blueprint->dropForeign($config['prefix'].'_archived_by_fk');
                $blueprint->dropIndex($config['prefix'].'_status_idx');
                $blueprint->dropColumn(['status', 'archived_at', 'archived_by']);
            });
        }
    }

    private function supportsCheckConstraints(): bool
    {
        return in_array(DB::getDriverName(), ['mysql', 'mariadb'], true);
    }
};