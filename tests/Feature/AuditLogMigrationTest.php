<?php

namespace Tests\Feature;

use App\Models\Log;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class AuditLogMigrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_migration_round_trip_preserves_logs_and_restores_null_on_user_deletion(): void
    {
        $user = User::create([
            'first_name' => 'Audit',
            'last_name' => 'User',
            'email' => 'audit-migration@example.com',
            'password' => Hash::make('password'),
            'status' => 'active',
        ]);
        $log = Log::create([
            'user_id' => $user->user_id,
            'operation' => 'migration.test',
        ]);
        $migration = require database_path('migrations/2026_07_18_000001_expand_tbllog_for_audit_logs.php');

        $migration->down();
        $this->assertFalse(Schema::hasColumn('tbllog', 'actor_name'));
        $this->assertDatabaseHas('tbllog', ['log_id' => $log->log_id, 'user_id' => $user->user_id]);

        $migration->up();
        $this->assertTrue(Schema::hasColumn('tbllog', 'actor_name'));
        $this->assertTrue(Schema::hasIndex('tbllog', 'tbllog_operation_created_idx'));
        $this->assertDatabaseHas('tbllog', ['log_id' => $log->log_id, 'user_id' => $user->user_id]);

        $user->delete();
        $this->assertDatabaseHas('tbllog', [
            'log_id' => $log->log_id,
            'user_id' => null,
            'operation' => 'migration.test',
        ]);
    }
}
