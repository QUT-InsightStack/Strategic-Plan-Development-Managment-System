<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;


return new class extends Migration
{
    private const TABLE = 'tbllog';

    private const USER_FOREIGN_KEY = 'tbllog_user_id_audit_foreign';

    public function up(): void
    {
        /*
         * Discover and remove every foreign key currently attached to
         * tbllog.user_id.
         */
        $this->dropUserForeignKeys();

        /*
         * Audit history must survive user deletion, so user_id must allow
         * NULL before the new nullOnDelete foreign key is added.
         */
        Schema::table(self::TABLE, function (Blueprint $table): void {
            $table->unsignedBigInteger('user_id')
                ->nullable()
                ->change();
        });

        /*
         * Add columns separately so this migration can recover if MySQL
         * committed some ALTER TABLE statements before a previous failure.
         */
        if (! Schema::hasColumn(self::TABLE, 'actor_name')) {
            Schema::table(self::TABLE, function (Blueprint $table): void {
                $table->string('actor_name', 511)
                    ->nullable()
                    ->after('user_id');
            });
        }

        if (! Schema::hasColumn(self::TABLE, 'resource_type')) {
            Schema::table(self::TABLE, function (Blueprint $table): void {
                $table->string('resource_type', 100)
                    ->nullable()
                    ->after('operation');
            });
        }

        if (! Schema::hasColumn(self::TABLE, 'resource_id')) {
            Schema::table(self::TABLE, function (Blueprint $table): void {
                $table->unsignedBigInteger('resource_id')
                    ->nullable()
                    ->after('resource_type');
            });
        }

        if (! Schema::hasColumn(self::TABLE, 'outcome')) {
            Schema::table(self::TABLE, function (Blueprint $table): void {
                $table->string('outcome', 30)
                    ->default('success')
                    ->after('resource_id');
            });
        }

        if (! Schema::hasColumn(self::TABLE, 'metadata')) {
            Schema::table(self::TABLE, function (Blueprint $table): void {
                $table->json('metadata')
                    ->nullable()
                    ->after('states');
            });
        }

        /*
         * The old foreign key appears to be missing in this database.
         * If orphaned IDs exist, the new foreign key cannot be created.
         * Preserve those audit records while detaching them from missing
         * user account.
         */
        DB::table(self::TABLE)
            ->whereNotNull('user_id')
            ->whereNotIn('user_id', DB::table('tblusers')->select('user_id'))
            ->update(['user_id' => null]);

        /*
         * Re-create the relationship using a known name. Deleting a user
         * now sets user_id to NULL instead of deleting historical logs.
         */
        if (! $this->foreignKeyExists(self::USER_FOREIGN_KEY)) {
            Schema::table(self::TABLE, function (Blueprint $table): void {
                $table->foreign(
                    'user_id',
                    self::USER_FOREIGN_KEY
                )
                    ->references('user_id')
                    ->on('tblusers')
                    ->nullOnDelete();
            });
        }

        $this->addIndexes();
    }

    public function down(): void
    {
        /*
         * The old schema requires every audit record to have a user.
         * Refuse a destructive rollback rather than deleting historical
         * records or assigning them to an unrelated user.
         */
        $nullUserCount = DB::table(self::TABLE)
            ->whereNull('user_id')
            ->count();

        if ($nullUserCount > 0) {
            throw new \RuntimeException(
                'Cannot roll back the audit-log migration because '
                . $nullUserCount
                . ' audit record(s) no longer have an associated user.'
            );
        }
            

        $this->dropUserForeignKeys();
        $this->dropIndexes();

        $columns = collect([
            'actor_name',
            'resource_type',
            'resource_id',
            'outcome',
            'metadata',
        ])->filter(
            fn (string $column): bool => Schema::hasColumn(
                self::TABLE,
                $column
            )
        )->values()->all();

        if ($columns !== []) {
            Schema::table(
                self::TABLE,
                function (Blueprint $table) use ($columns): void {
                    $table->dropColumn($columns);
                }
            );
        }

        Schema::table(self::TABLE, function (Blueprint $table): void {
            $table->unsignedBigInteger('user_id')
                ->nullable(false)
                ->change();

            $table->foreign('user_id')
                ->references('user_id')
                ->on('tblusers')
                ->cascadeOnDelete();
        });
    }

    private function addIndexes(): void
    {
        if (! $this->indexExists('tbllog_created_log_idx')) {
            Schema::table(self::TABLE, function (Blueprint $table): void {
                $table->index(
                    ['created_at', 'log_id'],
                    'tbllog_created_log_idx'
                );
            });
        }

        if (! $this->indexExists('tbllog_user_created_idx')) {
            Schema::table(self::TABLE, function (Blueprint $table): void {
                $table->index(
                    ['user_id', 'created_at'],
                    'tbllog_user_created_idx'
                );
            });
        }

        /*
         * operation is currently TEXT. MySQL requires a prefix length when
         * indexing a TEXT column, which Blueprint's ordinary index method
         * does not provide for a composite index.
         */
        if (! $this->indexExists('tbllog_operation_created_idx')) {
            if (Schema::getConnection()->getDriverName() === 'sqlite') {
                Schema::table(self::TABLE, function (Blueprint $table): void {
                    $table->index(['operation', 'created_at'], 'tbllog_operation_created_idx');
                });
            } else {
                DB::statement(
                    'CREATE INDEX `tbllog_operation_created_idx` '
                    . 'ON `tbllog` (`operation`(100), `created_at`)'
                );
            }
        }

        if (! $this->indexExists('tbllog_resource_idx')) {
            Schema::table(self::TABLE, function (Blueprint $table): void {
                $table->index(
                    ['resource_type', 'resource_id'],
                    'tbllog_resource_idx'
                );
            });
        }

        if (! $this->indexExists('tbllog_outcome_created_idx')) {
            Schema::table(self::TABLE, function (Blueprint $table): void {
                $table->index(
                    ['outcome', 'created_at'],
                    'tbllog_outcome_created_idx'
                );
            });
        }
    }

    private function dropIndexes(): void
    {
        $indexes = [
            'tbllog_created_log_idx',
            'tbllog_user_created_idx',
            'tbllog_operation_created_idx',
            'tbllog_resource_idx',
            'tbllog_outcome_created_idx',
        ];

        foreach ($indexes as $index) {
            if ($this->indexExists($index)) {
                Schema::table(self::TABLE, function (Blueprint $table) use ($index): void {
                    $table->dropIndex($index);
                });
            }
        }
    }

    private function dropUserForeignKeys(): void
    {
        if (Schema::getConnection()->getDriverName() === 'sqlite') {
            Schema::table(self::TABLE, function (Blueprint $table): void {
                $table->dropForeign(['user_id']);
            });

            return;
        }

        $foreignKeys = DB::select(
            <<<'SQL'
            SELECT DISTINCT `CONSTRAINT_NAME`
            FROM `information_schema`.`KEY_COLUMN_USAGE`
            WHERE `CONSTRAINT_SCHEMA` = DATABASE()
              AND `TABLE_NAME` = ?
              AND `COLUMN_NAME` = 'user_id'
              AND `REFERENCED_TABLE_NAME` IS NOT NULL
            SQL,
            [self::TABLE]
        );

        foreach ($foreignKeys as $foreignKey) {
            $constraintName = (string) $foreignKey->CONSTRAINT_NAME;

            /*
             * constraint names came from information_schema, but retain
             * strict validation before placing one in an identifier.
             */
            if (! preg_match('/^[A-Za-z0-9_$]+$/', $constraintName)) {
                throw new \RuntimeException(
                    'Unexpected foreign-key name on tbllog.user_id.'
                );
            }
            

            DB::statement(
                sprintf(
                    'ALTER TABLE `%s` DROP FOREIGN KEY `%s`',
                    self::TABLE,
                    $constraintName
                )
            );
        }
    }

    private function foreignKeyExists(string $constraintName): bool
    {
        if (Schema::getConnection()->getDriverName() === 'sqlite') {
            return collect(Schema::getForeignKeys(self::TABLE))->contains(
                fn (array $foreignKey): bool => $foreignKey['columns'] === ['user_id']
            );
        }

        return DB::table('information_schema.TABLE_CONSTRAINTS')
            ->whereRaw('CONSTRAINT_SCHEMA = DATABASE()')
            ->where('TABLE_NAME', self::TABLE)
            ->where('CONSTRAINT_NAME', $constraintName)
            ->where('CONSTRAINT_TYPE', 'FOREIGN KEY')
            ->exists();
    }

    private function indexExists(string $indexName): bool
    {
        return Schema::hasIndex(self::TABLE, $indexName);
    }
};
