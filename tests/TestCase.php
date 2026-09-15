<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Tests\Support\MySqlTestDatabase;

abstract class TestCase extends BaseTestCase
{
    public function createApplication()
    {
        $app = parent::createApplication();
        $connection = $app['config']->get('database.default');

        // Runs before RefreshDatabase can call migrate:fresh or open a transaction.
        MySqlTestDatabase::assertSafe(
            $app->environment(),
            $app->configurationIsCached(),
            $connection,
            $app['config']->get('database.connections.'.$connection, []),
        );

        // Backup tests must never clean up files from the application's storage.
        $app->useStoragePath($app->basePath('storage/framework/testing'));
        foreach (['app/private', 'app/public', 'framework/views', 'logs'] as $directory) {
            $path = $app->storagePath($directory);
            if (! is_dir($path)) {
                mkdir($path, 0750, true);
            }
        }
        $app['config']->set([
            'view.compiled' => $app->storagePath('framework/views'),
            'filesystems.disks.local.root' => $app->storagePath('app/private'),
            'filesystems.disks.public.root' => $app->storagePath('app/public'),
            'logging.channels.single.path' => $app->storagePath('logs/laravel.log'),
        ]);

        return $app;
    }
}
