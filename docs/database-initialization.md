# Database initialization baseline

The migrations are consolidated into 21 initialization migrations: 20 create the
28 application tables, and one creates the cross-table strategic lifecycle
triggers. Each table is created with its final columns, defaults, indexes, and
foreign-key behavior. No subsequent add/change/remove/backfill migration is needed.

## Initialize an empty database

Create the target database and configure the connection, then run:

```console
php artisan migrate --seed
```

`DatabaseSeeder` runs roles, permissions, role-permission mappings, and the
existing initial user accounts (the user seeder skips production). To initialize access control without creating
those default accounts, use:

```console
php artisan migrate
php artisan db:seed --class=RolesSeeder
php artisan db:seed --class=PermissionSeeder
php artisan db:seed --class=RolePermissionSeeder
```

Security-setting defaults remain in their create migration. Backup restore and
PDP chapter permissions, Technical Administrator mappings, role assignment flags,
and contributor delete restrictions are initialized by the existing seeders.
There are no separate grant/revoke data migrations.

## Consolidated definitions

| Create migration/table | Final definition included |
| --- | --- |
| `tblroles` | Assignment/protection flags and safe defaults |
| `tblusers` | Search indexes, auth version, designation, nullable string gender, failed-login count, lock expiry, last activity |
| `tbllog` | Nullable actor FK with `SET NULL`, actor snapshot, resource fields, outcome, JSON metadata, all audit indexes |
| `tblstrategic_record` | Full lifecycle enum, archive/delete timestamps, archive actor FK/index |
| `tblstrategic_foundations`, `tblplan_core_value`, `tblrelation_map` | Lifecycle fields and archive actor FK/index |
| `tblstrategic_objectives` | Full status enum, pre-archive status, archive/delete metadata and actor FK/index |
| `tblpdp_chapters` | `longText` description; the removed objectives child table is never created |

The MySQL lifecycle triggers are unchanged and created only after all five
strategic tables exist. They remain a separate `create_strategic_lifecycle_database_guards`
migration because they reference multiple tables. SQLite retains its previous
behavior without these MySQL-specific triggers. The audit TEXT prefix index is
still defined for MySQL/MariaDB; SQLite uses the normal composite index.

## Existing databases

This is a fresh-install baseline, not an incremental upgrade of an older database.
Editing a create migration does not modify a table whose migration already ran.
The removed historical migrations are no longer available for upgrading or rolling
back an older installation. Keep the previous revision for such maintenance and
plan an explicit upgrade/data transfer if an existing database needs reconciliation.
Do not run `migrate:fresh` against a database whose data must be preserved.

Normal reset/rollback of this baseline drops its created tables in reverse order.
The existing populated-audit-archive rollback protection remains in place.

## Verification

The pre-consolidation and post-consolidation SQLite snapshots match across all
28 application tables: column types, nullability, defaults, auto-increment,
indexes, and foreign keys. Tests cover initialization, default seeding,
idempotent seeding, reset/re-initialization, and preservation of audit history
when a user is deleted. Offline MySQL compilation also verifies the audit TEXT
prefix index and all ten lifecycle triggers without opening a connection. MySQL
trigger SQL is preserved; executing it against an actual MySQL server requires
that deployment's integration environment.
