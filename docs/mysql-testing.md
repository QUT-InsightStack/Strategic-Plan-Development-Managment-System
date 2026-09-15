# MySQL test environment

The default PHPUnit environment uses the `mysql_testing` connection with MySQL 8.0 and a dedicated `db_spdms_test` database. Application connections and `.env` remain unchanged. `php artisan test`, `composer test` and `vendor/bin/phpunit` use the same `phpunit.xml` configuration.

## Local setup

1. Enable PHP's `pdo_mysql` extension and start MySQL. SQLite extensions are not required.
2. Copy `.env.testing.example` to `.env.testing` and configure `TEST_DB_HOST`, `TEST_DB_PORT`, `TEST_DB_DATABASE`, `TEST_DB_USERNAME` and `TEST_DB_PASSWORD`. These credentials are separate from the application's `DB_*` settings. `.env.testing` is ignored by Git.
3. Create an empty dedicated test database using your MySQL administration account:

   ```sql
   CREATE DATABASE IF NOT EXISTS db_spdms_test
       CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```

   Use a MySQL user with DDL/DML and trigger privileges on this database. The user named `spdms_test` in the template is a placeholder; provision it or replace it with your local test account. Migration tests create and drop tables and triggers, so read/write-only grants are insufficient.
4. Generate independent test secrets:

   ```powershell
   php artisan key:generate --env=testing
   php artisan jwt:secret --env=testing
   php artisan config:clear
   ```
5. Run tests:

   ```powershell
   php artisan test
   ```

   To run the objective collaboration tests and database guard checks:

   ```powershell
   php -d xdebug.mode=off vendor/bin/phpunit --filter 'ObjectiveCollaborationTest|StrategicObjectiveApiTest|MySqlTestDatabaseTest'
   ```

The testing database is disposable: Laravel's `RefreshDatabase` runs migrations against it and rolls back test data. Do not put application data in it. Migrations are run by the test suite; there is no need to migrate the business database first.

## Isolation

- `phpunit.xml` forces `APP_ENV=testing`, `DB_CONNECTION=mysql_testing` and an empty `DB_URL`.
- The connection reads only `TEST_DB_*` values; it never falls back to application database credentials.
- Before `RefreshDatabase` can reset tables, `Tests\TestCase` rejects cached configuration, non-MySQL connections, non-testing environments, URL/read/write overrides, and database names that do not end in `_test` (an optional numeric suffix is accepted for isolated workers).
- Tests use `storage/framework/testing` for backups, uploads, views and logs, so backup cleanup cannot remove application backups.
- The collaboration migration round-trip explicitly leaves the outer test transaction before executing DDL, because MySQL implicitly commits schema changes. It marks the schema for rebuilding before the next test.
- Backup adapter tests mock export processes or supply temporary files while model queries continue using the actual MySQL test connection. They do not export or restore the application database.

Do not run concurrent test commands against the same schema. Use separate test databases for independent test runs.

## Differences from the previous SQLite setup

MySQL now executes the real foreign keys, enums and strategic lifecycle triggers. Test fixtures must therefore satisfy the same lifecycle rules as application data. The prior SQLite-only `ESCAPE expression must be a single character` failure in user search is avoided without changing the application's MySQL SQL.

The two PDP test setup problems are corrected: permission setup reuses the permission provisioned by migrations, and the unauthorized deletion test creates a real chapter before checking for HTTP 403.

## Verification

On 2026-09-15, the complete suite passed on local MySQL 8.0.42: **149 tests, 647 assertions**. The three previously failing tests also passed through the `php artisan test` command (3 tests, 14 assertions). The local `db_spdms_test` database and ignored `.env.testing` are configured; the `dbspdms` application database was not migrated or reset.
