<?php

namespace Tests\Support;

use RuntimeException;

final class MySqlTestDatabase
{
    public static function assertSafe(string $environment, bool $cached, string $connection, array $config): void
    {
        if ($cached) {
            throw new RuntimeException('Clear cached configuration before testing: php artisan config:clear');
        }

        if ($environment !== 'testing' || $connection !== 'mysql_testing'
            || ($config['driver'] ?? null) !== 'mysql'
            || ! empty($config['url']) || ! empty($config['read']) || ! empty($config['write'])
            || ! preg_match('/\A[a-zA-Z0-9_]+_test(?:_\d+)?\z/', $config['database'] ?? '')) {
            throw new RuntimeException('Tests require the mysql_testing connection and a dedicated database ending in _test. Configure TEST_DB_* in .env.testing.');
        }
    }
}
