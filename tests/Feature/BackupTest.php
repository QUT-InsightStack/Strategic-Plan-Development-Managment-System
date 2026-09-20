<?php

namespace Tests\Feature;

use App\Http\Middleware\ValidateAuthVersion;
use App\Models\Backup;
use App\Models\Log;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Process;
use Tests\TestCase;

class BackupTest extends TestCase
{
    use RefreshDatabase;

    /** @var list<string> Absolute paths to remove after each test. */
    private array $temporaryFiles = [];

    private string $testStorage;

    protected function setUp(): void
    {
        parent::setUp();
        $this->testStorage = sys_get_temp_dir() . '/spdms-backup-tests-' . \Illuminate\Support\Str::uuid();
        mkdir($this->testStorage . '/app/backups', 0750, true);
        $this->app->useStoragePath($this->testStorage);
    }

    protected function tearDown(): void
    {
        foreach ($this->temporaryFiles as $path) {
            if (is_file($path)) {
                @unlink($path);
            }
        }

        foreach (glob(storage_path('app/backups/spdms-backup-*')) ?: [] as $path) {
            @unlink($path);
        }

        @rmdir($this->testStorage . '/app/backups');
        @rmdir($this->testStorage . '/app');
        @rmdir($this->testStorage);

        parent::tearDown();
    }

    // ─── Authorisation ───────────────────────────────────────────────

    public function test_listing_backups_requires_authentication(): void
    {
        $this->getJson('/api/backups')->assertUnauthorized();
    }

    public function test_creating_a_backup_requires_authentication(): void
    {
        $this->postJson('/api/backups')->assertUnauthorized();
    }

    public function test_listing_backups_requires_the_view_permission(): void
    {
        $actor = $this->createUserWithPermissions(['users.view']);

        $this->actingAs($actor, 'api');
        $this->withoutMiddleware(ValidateAuthVersion::class)
            ->getJson('/api/backups')
            ->assertForbidden();
    }

    public function test_creating_a_backup_requires_the_create_permission(): void
    {
        // Being able to see backups is deliberately not enough to run one.
        $actor = $this->createUserWithPermissions(['backups.view']);

        $this->actingAs($actor, 'api');
        $this->withoutMiddleware(ValidateAuthVersion::class)
            ->postJson('/api/backups')
            ->assertForbidden();

        $this->assertSame(0, Backup::query()->count());
    }

    public function test_downloading_requires_the_download_permission(): void
    {
        // Creating a backup does not imply permission to take it off the box.
        $actor = $this->createUserWithPermissions(['backups.view', 'backups.create']);
        $backup = $this->completedBackup($actor);

        $this->actingAs($actor, 'api');
        $this->withoutMiddleware(ValidateAuthVersion::class)
            ->get("/api/backups/{$backup->backup_id}/download")
            ->assertForbidden();
    }

    public function test_restoring_a_backup_requires_authentication(): void
    {
        $actor = $this->createUserWithPermissions(['backups.restore']);
        $backup = $this->completedBackup($actor);

        $this->postJson("/api/backups/{$backup->backup_id}/restore")
            ->assertUnauthorized();
    }

    public function test_restoring_requires_the_restore_permission(): void
    {
        $actor = $this->createUserWithPermissions(['backups.view', 'backups.download']);
        $backup = $this->completedBackup($actor);

        $this->actingAs($actor, 'api');
        $this->withoutMiddleware(ValidateAuthVersion::class)
            ->postJson("/api/backups/{$backup->backup_id}/restore")
            ->assertForbidden();
    }

    // ─── Creating ────────────────────────────────────────────────────

    public function test_authorised_administrator_can_create_a_backup(): void
    {
        $actor = $this->createUserWithPermissions(['backups.view', 'backups.create']);
        $this->useSqliteFileDatabase();

        $this->actingAs($actor, 'api');
        $response = $this->withoutMiddleware(ValidateAuthVersion::class)
            ->postJson('/api/backups')
            ->assertCreated()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.status', 'completed');

        $filename = $response->json('data.filename');
        $this->assertNotEmpty($filename);
        $this->assertFileExists(storage_path('app/backups/' . $filename));

        $this->assertDatabaseHas('tblbackups', [
            'filename' => $filename,
            'status' => 'completed',
            'created_by' => $actor->user_id,
        ]);
    }

    public function test_creating_a_backup_is_audited(): void
    {
        $actor = $this->createUserWithPermissions(['backups.create']);
        $this->useSqliteFileDatabase();

        $this->actingAs($actor, 'api');
        $this->withoutMiddleware(ValidateAuthVersion::class)
            ->postJson('/api/backups')
            ->assertCreated();

        $this->assertDatabaseHas('tbllog', [
            'user_id' => $actor->user_id,
            'states' => 'success',
        ]);
        $this->assertStringContainsString(
            'backup.created',
            (string) Log::latest('log_id')->value('operation')
        );
    }

    public function test_a_failed_backup_is_recorded_and_reported(): void
    {
<<<<<<< HEAD
        // The test database is :memory:, so there is no file to copy and the
        // dump fails — which is the case being exercised here.
        $actor = $this->createUserWithPermissions(['backups.view', 'backups.create', 'logs.view']);
=======
        $actor = $this->createUserWithPermissions(['backups.view', 'backups.create']);
        Process::fake(['*' => Process::result(errorOutput: 'Simulated dump failure', exitCode: 1)]);
>>>>>>> origin/develop

        $this->actingAs($actor, 'api');
        $this->withoutMiddleware(ValidateAuthVersion::class)
            ->postJson('/api/backups')
            ->assertStatus(500)
            ->assertJsonPath('success', false);

        $this->assertDatabaseHas('tblbackups', [
            'status' => 'failed',
            'created_by' => $actor->user_id,
        ]);
        $this->assertStringContainsString(
            'backup.failed',
            (string) Log::latest('log_id')->value('operation')
        );
        $this->assertDatabaseHas('tbllog', [
            'operation' => 'backup.failed',
            'outcome' => 'failure',
            'states' => 'failed',
            'resource_type' => 'backup',
        ]);
        $this->getJson('/api/logs?outcome=failure&action=backup.failed')
            ->assertOk()->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.outcome', 'failure')
            ->assertJsonPath('data.0.action', 'backup.failed')
            ->assertJsonPath('data.0.metadata.backup_id', (int) Backup::value('backup_id'));
    }

    public function test_backup_directory_failure_is_also_audited_and_emits_an_event(): void
    {
        config(['monitoring.enabled' => true]);
        $actor = $this->createUserWithPermissions(['backups.create']);
        $directory = storage_path('app/backups');
        rmdir($directory);
        file_put_contents($directory, 'occupied');
        $this->temporaryFiles[] = $directory;
        $this->actingAs($actor, 'api')->withoutMiddleware(ValidateAuthVersion::class)
            ->postJson('/api/backups')->assertStatus(500);
        $this->assertDatabaseHas('tblbackups', ['status' => 'failed']);
        $this->assertDatabaseHas('tbllog', ['operation' => 'backup.failed', 'outcome' => 'failure']);
        $this->assertDatabaseHas('tblsystem_events', ['event' => 'backup.failed', 'outcome' => 'failure']);
    }

    public function test_a_failed_backup_cannot_be_downloaded(): void
    {
        $actor = $this->createUserWithPermissions(['backups.create', 'backups.download']);

        $backup = Backup::create([
            'filename' => 'spdms-backup-failed.sql',
            'size_bytes' => null,
            'driver' => 'sqlite',
            'status' => 'failed',
            'error_message' => 'Something went wrong.',
            'created_by' => $actor->user_id,
        ]);

        $this->actingAs($actor, 'api');
        $this->withoutMiddleware(ValidateAuthVersion::class)
            ->get("/api/backups/{$backup->backup_id}/download")
            ->assertNotFound();
    }

    public function test_a_failed_backup_cannot_be_restored(): void
    {
        $actor = $this->createUserWithPermissions(['backups.restore']);

        $backup = Backup::create([
            'filename' => 'spdms-backup-failed.sql',
            'size_bytes' => null,
            'driver' => 'sqlite',
            'status' => 'failed',
            'error_message' => 'Something went wrong.',
            'created_by' => $actor->user_id,
        ]);

        $this->actingAs($actor, 'api');
        $this->withoutMiddleware(ValidateAuthVersion::class)
            ->postJson("/api/backups/{$backup->backup_id}/restore")
            ->assertStatus(422)
            ->assertJsonPath('success', false);
    }

    public function test_restoring_a_missing_backup_file_returns_a_validation_error(): void
    {
        $actor = $this->createUserWithPermissions(['backups.restore']);
        $backup = $this->completedBackup($actor);

        @unlink(storage_path('app/backups/' . $backup->filename));

        $this->actingAs($actor, 'api');
        $this->withoutMiddleware(ValidateAuthVersion::class)
            ->postJson("/api/backups/{$backup->backup_id}/restore")
            ->assertStatus(422)
            ->assertJsonPath('message', 'This backup file is no longer available.');
    }

    public function test_restoring_a_backup_for_a_different_driver_is_rejected(): void
    {
        $actor = $this->createUserWithPermissions(['backups.restore']);
        $backup = $this->completedBackup($actor);
        $backup->forceFill(['driver' => 'sqlite'])->save();

        $this->actingAs($actor, 'api');
        $this->withoutMiddleware(ValidateAuthVersion::class)
            ->postJson("/api/backups/{$backup->backup_id}/restore")
            ->assertStatus(422)
            ->assertJsonPath(
                'message',
                'This backup was created for a different database driver and cannot be restored here.'
            );
    }

    // ─── mysqldump handling ──────────────────────────────────────────

    /**
     * Credentials must reach mysqldump through a defaults file, never on the
     * command line, where any local user could read them out of the process
     * list.
     */
    public function test_mysql_credentials_are_not_passed_on_the_command_line(): void
    {
        $actor = $this->createUserWithPermissions(['backups.create']);

        Process::fake();

        // Keep the already-resolved test PDO; override only the export adapter's
        // configuration. Process::fake prevents an actual database export.
        config([
            'database.connections.mysql_testing.driver' => 'mysql',
            'database.connections.mysql_testing.database' => 'db_spdms_test',
            'database.connections.mysql_testing.username' => 'spdms_user',
            'database.connections.mysql_testing.password' => 'sup3r-s3cret-pw',
            'database.connections.mysql_testing.host' => '127.0.0.1',
            'database.connections.mysql_testing.port' => 3306,
        ]);

        $this->actingAs($actor, 'api');
        $this->withoutMiddleware(ValidateAuthVersion::class)
            ->postJson('/api/backups')
            ->assertCreated()
            ->assertJsonPath('data.driver', 'mysql');

        Process::assertRan(function ($process) {
            $command = $process->command;
            $this->assertIsArray($command, 'The dump must be run as an argument array, not a shell string.');
            $this->assertSame('mysqldump', $command[0]);

            foreach ($command as $argument) {
                $this->assertStringNotContainsString(
                    'sup3r-s3cret-pw',
                    (string) $argument,
                    'The database password must never appear in the command arguments.'
                );
            }

            $defaults = array_values(array_filter(
                $command,
                fn ($argument) => str_starts_with((string) $argument, '--defaults-extra-file=')
            ));

            $this->assertCount(1, $defaults, 'mysqldump must be given a defaults file.');

            return true;
        });
    }

    public function test_the_defaults_file_is_removed_after_the_dump(): void
    {
        $actor = $this->createUserWithPermissions(['backups.create']);

        Process::fake();

        config([
            'database.connections.mysql_testing.driver' => 'mysql',
            'database.connections.mysql_testing.database' => 'db_spdms_test',
            'database.connections.mysql_testing.password' => 'sup3r-s3cret-pw',
        ]);

        $this->actingAs($actor, 'api');
        $this->withoutMiddleware(ValidateAuthVersion::class)
            ->postJson('/api/backups')
            ->assertCreated();

        $path = null;
        Process::assertRan(function ($process) use (&$path) {
            foreach ($process->command as $argument) {
                if (str_starts_with((string) $argument, '--defaults-extra-file=')) {
                    $path = substr((string) $argument, strlen('--defaults-extra-file='));
                }
            }

            return true;
        });

        $this->assertNotNull($path);
        $this->assertFileDoesNotExist($path, 'The credentials file must not be left on disk.');
    }

    // ─── Listing and downloading ─────────────────────────────────────

    public function test_backups_are_listed_newest_first_with_their_author(): void
    {
        $actor = $this->createUserWithPermissions(['backups.view']);

        $older = $this->completedBackup($actor, 'spdms-backup-older.sql');
        $older->forceFill(['created_at' => now()->subDay()])->save();
        $newer = $this->completedBackup($actor, 'spdms-backup-newer.sql');

        $this->actingAs($actor, 'api');
        $this->withoutMiddleware(ValidateAuthVersion::class)
            ->getJson('/api/backups')
            ->assertOk()
            ->assertJsonPath('data.0.filename', $newer->filename)
            ->assertJsonPath('data.0.created_by.name', $actor->name)
            ->assertJsonPath('data.1.filename', $older->filename);
    }

    public function test_a_backup_can_be_downloaded_and_the_download_is_audited(): void
    {
        $actor = $this->createUserWithPermissions(['backups.view', 'backups.download']);
        $backup = $this->completedBackup($actor);

        $this->actingAs($actor, 'api');
        $this->withoutMiddleware(ValidateAuthVersion::class)
            ->get("/api/backups/{$backup->backup_id}/download")
            ->assertOk()
            ->assertDownload($backup->filename);

        $this->assertStringContainsString(
            'backup.downloaded',
            (string) Log::latest('log_id')->value('operation')
        );
    }

    public function test_downloading_a_missing_file_returns_not_found(): void
    {
        $actor = $this->createUserWithPermissions(['backups.download']);
        $backup = $this->completedBackup($actor);

        @unlink(storage_path('app/backups/' . $backup->filename));

        $this->actingAs($actor, 'api');
        $this->withoutMiddleware(ValidateAuthVersion::class)
            ->get("/api/backups/{$backup->backup_id}/download")
            ->assertNotFound();
    }

    // ─── Helpers ─────────────────────────────────────────────────────

    /**
     * Exercise the SQLite file-copy adapter without changing the resolved MySQL
     * test PDO used for model records. No SQLite extension is needed.
     */
    private function useSqliteFileDatabase(): void
    {
        $path = tempnam(sys_get_temp_dir(), 'spdms-test-db-');
        file_put_contents($path, 'SQLite format 3');
        $this->temporaryFiles[] = $path;

        config([
            'database.connections.mysql_testing.driver' => 'sqlite',
            'database.connections.mysql_testing.database' => $path,
        ]);
    }

    private function completedBackup(User $actor, ?string $filename = null): Backup
    {
        $filename ??= 'spdms-backup-' . uniqid() . '.sql';
        $directory = storage_path('app/backups');

        if (! is_dir($directory)) {
            mkdir($directory, 0750, true);
        }

        file_put_contents($directory . DIRECTORY_SEPARATOR . $filename, '-- dump');

        return Backup::create([
            'filename' => $filename,
            'size_bytes' => 7,
            'driver' => config('database.connections.mysql_testing.driver'),
            'status' => 'completed',
            'error_message' => null,
            'created_by' => $actor->user_id,
        ]);
    }

    /**
     * @param  list<string>  $codes
     */
    private function createUserWithPermissions(array $codes): User
    {
        $role = Role::create([
            'role_name' => 'Role ' . fake()->unique()->word(),
            'is_assignable' => true,
            'is_protected' => false,
        ]);

        foreach ($codes as $code) {
            $permission = Permission::firstOrCreate(
                ['code' => $code],
                [
                    'permission_name' => $code,
                    'description' => $code,
                    'module' => explode('.', $code)[0],
                ]
            );
            $role->permissions()->attach($permission->permission_id);
        }

        return User::create([
            'first_name' => 'Test',
            'last_name' => 'Administrator',
            'email' => fake()->unique()->safeEmail(),
            'password' => Hash::make('password'),
            'status' => 'active',
            'role_id' => $role->role_id,
        ]);
    }
}
