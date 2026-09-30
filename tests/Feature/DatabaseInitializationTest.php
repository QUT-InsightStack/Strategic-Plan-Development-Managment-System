<?php

namespace Tests\Feature;

use App\Models\Role;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Database\MySqlConnection;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class DatabaseInitializationTest extends TestCase
{
    public function test_mysql_initialization_compiles_the_audit_prefix_index_and_all_lifecycle_triggers_without_a_server(): void
    {
        $originalSchema = Schema::getFacadeRoot();
        $connection = new MySqlConnection(
            static fn () => throw new \LogicException('SQL compilation must not connect to a database.'),
            'initialization_test', '', [
                'driver' => 'mysql', 'charset' => 'utf8mb4', 'collation' => 'utf8mb4_unicode_ci',
                'prefix' => '', 'version' => '8.0.0',
            ]
        );
        DB::extend('offline_mysql', fn () => $connection);
        config(['database.default' => 'mysql_compilation', 'database.connections.mysql_compilation' => ['driver' => 'offline_mysql']]);
        Schema::swap(DB::connection()->getSchemaBuilder());
        try {
            $queries = $connection->pretend(function (): void {
                (require database_path('migrations/2026_04_28_044457_create_tbllog_table.php'))->up();
                (require database_path('migrations/2026_05_20_150506_create_strategic_lifecycle_database_guards.php'))->up();
            });
            $sql = implode("\n", array_column($queries, 'query'));
            $this->assertStringContainsString('create table `tbllog`', $sql);
            $this->assertStringContainsString('`tbllog_operation_created_idx`(`operation`(100), `created_at`)', $sql);
            $this->assertStringContainsString('on delete set null', $sql);
            $this->assertSame(10, substr_count($sql, 'CREATE TRIGGER'));
            $this->assertStringContainsString('SPDMS_VALIDATION|', $sql);
        } finally {
            Schema::swap($originalSchema);
            DB::purge('mysql_compilation');
        }
    }

    public function test_empty_database_can_be_initialized_seeded_rolled_back_and_initialized_again(): void
    {
        // A dedicated in-memory connection avoids both the application database
        // and the shared RefreshDatabase transaction used by other feature tests.
        config([
            'database.default' => 'initialization_test',
            'database.connections.initialization_test' => [
                'driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '',
                'foreign_key_constraints' => true,
            ],
            'monitoring.enabled' => false,
        ]);

        try {
            $this->assertSame(0, Artisan::call('migrate', ['--force' => true]));
            $this->assertInitializedSchema();
            $this->seed(DatabaseSeeder::class);
            $this->assertInitialPermissions();
            $this->seed(DatabaseSeeder::class);
            $this->assertInitialPermissions();

            $this->assertSame(0, Artisan::call('migrate', ['--force' => true]));
            $this->assertSame(count(glob(database_path('migrations/*.php'))), DB::table('migrations')->count());
            $this->assertSame(0, Artisan::call('migrate:reset', ['--force' => true]));
            $this->assertFalse(Schema::hasTable('tblusers'));
            $this->assertFalse(Schema::hasTable('tbllog'));
            $this->assertFalse(Schema::hasTable('tblsystem_events'));
            $this->assertSame(0, DB::table('migrations')->count());

            $this->assertSame(0, Artisan::call('migrate', ['--force' => true]));
            $this->assertInitializedSchema();
        } finally {
            DB::purge('initialization_test');
        }
    }

    private function assertInitializedSchema(): void
    {
        $this->assertTrue(Schema::hasColumns('tblusers', [
            'auth_version', 'gender', 'designation', 'failed_login_attempts', 'locked_until', 'last_activity_at',
        ]));
        $this->assertTrue(Schema::hasColumns('tbllog', ['actor_name', 'resource_type', 'resource_id', 'outcome', 'metadata']));
        foreach (['tblstrategic_record', 'tblstrategic_foundations', 'tblplan_core_value', 'tblrelation_map', 'tblstrategic_objectives'] as $table) {
            $this->assertTrue(Schema::hasColumns($table, ['status', 'archived_at', 'archived_by', 'deleted_at']));
            $this->assertTrue(Schema::hasIndex($table, ['archived_by']));
        }
        $this->assertTrue(Schema::hasColumn('tblstrategic_objectives', 'status_before_archive'));
        $this->assertFalse(Schema::hasTable('tblpdp_chapter_objectives'));
        $this->assertTrue(Schema::hasIndex('tbllog', 'tbllog_operation_created_idx'));
        $this->assertTrue(Schema::hasIndex('tblusers', 'tblusers_status_index'));
        $this->assertSame('set null', collect(Schema::getForeignKeys('tbllog'))->firstWhere('columns', ['user_id'])['on_delete']);
        $this->assertSame(3, DB::table('security_settings')->count());
        $this->assertSame(3, DB::table('security_settings')->where('key', 'max_failed_login_attempts')->value('value'));
    }

    private function assertInitialPermissions(): void
    {
        $administrator = Role::where('role_name', 'Administrator')->firstOrFail();
        $this->assertSame(2, $administrator->permissions()->whereIn('code', ['backups.restore', 'pdp_chapters.manage'])->count());
        $technical = Role::where('role_name', 'Technical Administrator')->firstOrFail();
        $this->assertTrue($technical->is_assignable);
        $this->assertTrue($technical->is_protected);
        $this->assertTrue($technical->permissions()->where('code', 'system_monitoring.view')->exists());
        $this->assertFalse(Role::where('role_name', 'Planning Officer')->firstOrFail()->permissions()->where('code', 'like', '%.delete')->exists());
    }
}
