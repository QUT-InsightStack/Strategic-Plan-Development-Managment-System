# Default roles

`RolesSeeder` provisions six default roles: Administrator, test, Planning Officer,
Management, Office, and Technical Administrator.

- Management is the renamed Division Head. Its seeded permissions remain read-only.
- Office is the renamed Viewer. It remains read-only, and is not an alias for the
  legacy Office/Agency or Responsible Unit User collaboration roles.
- Administrator, Planning Officer, and Technical Administrator keep their existing grants.
- test receives every permission, including permissions created by the collaboration
  and progress seeders, and has the same full-access permission bypass as Administrator.
  It can also use the planning, input review, progress correction, and workflow configuration
  role gates. Authentication, active-account requirements, workflow participation,
  required office assignments for feedback, and normal data validation still apply.

## Updating an existing database

Run `php artisan migrate` followed by `php artisan db:seed --class=RolesSeeder`
and `php artisan db:seed --class=RolePermissionSeeder`.
This avoids resetting the demonstration accounts through UsersSeeder.

The migration and RolesSeeder rename Division Head and Viewer in place. If a
previous seeder run created both names, their grants are combined under the original
role ID and current user/workflow references are moved to it. Affected sessions
must sign in again. Submitted approval snapshots and audit labels stay historical.
The migration's data merge is deliberately not reversed on rollback.

Fresh installations create only the six defaults. Existing custom and legacy
collaboration roles are retained with their permissions; seeders and migrations
no longer automatically create Responsible Unit User. Merging it into Office
would change Office's read-only permissions, so it is not merged.

The inactive Office demonstration account keeps its existing email,
`testviewer@example.com`, so reseeding does not create a duplicate account.
