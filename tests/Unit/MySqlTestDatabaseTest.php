<?php

namespace Tests\Unit;

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use RuntimeException;
use Tests\Support\MySqlTestDatabase;

class MySqlTestDatabaseTest extends TestCase
{
    public function test_dedicated_mysql_database_is_accepted(): void
    {
        MySqlTestDatabase::assertSafe('testing', false, 'mysql_testing', ['driver' => 'mysql', 'database' => 'db_spdms_test']);
        $this->addToAssertionCount(1);
    }

    #[DataProvider('unsafeConfigurations')]
    public function test_unsafe_configuration_is_rejected_before_database_operations(string $environment, bool $cached, string $connection, array $config): void
    {
        $this->expectException(RuntimeException::class);
        MySqlTestDatabase::assertSafe($environment, $cached, $connection, $config);
    }

    public static function unsafeConfigurations(): array
    {
        $valid = ['driver' => 'mysql', 'database' => 'db_spdms_test'];

        return [
            'business database' => ['testing', false, 'mysql_testing', ['driver' => 'mysql', 'database' => 'dbspdms']],
            'cached config' => ['testing', true, 'mysql_testing', $valid],
            'production environment' => ['production', false, 'mysql_testing', $valid],
            'application connection' => ['testing', false, 'mysql', $valid],
            'sqlite connection' => ['testing', false, 'mysql_testing', ['driver' => 'sqlite', 'database' => ':memory:']],
            'URL override' => ['testing', false, 'mysql_testing', [...$valid, 'url' => 'mysql://localhost/dbspdms']],
            'write override' => ['testing', false, 'mysql_testing', [...$valid, 'write' => ['database' => 'dbspdms']]],
        ];
    }
}
