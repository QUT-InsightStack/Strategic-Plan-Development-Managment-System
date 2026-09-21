# Strategic objective progress

Progress is independent of the objective lifecycle (`draft`, `published`, `archived`, `deleted`). Updates accept a **JSON integer from 0 through 100**. The database generates `progress_status`: `0` → `not_started`, `1–99` → `in_progress`, `100` → `completed`. The UI displays Not Started, In Progress and Completed.

## Setup

Run `php artisan migrate` to add the progress columns, history table and permissions to an existing installation. New installations receive the same permissions through `RolePermissionSeeder`. Refresh the authenticated session after applying the permissions. Existing objectives start at 0%, with no updater or update timestamp until their first progress submission. Browser-only demo progress is not imported.

## Access

| Permission | Default roles | Scope |
| --- | --- | --- |
| `strategic_objectives.view_progress` | Planning Officer, legacy Planner/Encoder, Administrator, Office/Unit roles | Planning roles see all objectives in the existing plan visibility scope; offices see only current assignments |
| `strategic_objectives.update_progress` | Responsible Unit User, Office Representative, Office/Agency, Offices / Agencies | Active account and active unit matching the current objective assignment |
| `strategic_objectives.correct_progress` | Planning Officer, legacy Planner/Encoder, Administrator | Any assigned or unassigned objective, with a required nonblank reason |

The existing application Administrator bypass applies. A Planning Officer cannot use the office permission to bypass correction permission or the required reason. Giving an office role correction permission does not grant access to other offices. Membership comes from the administrator-maintained user `office` field resolved to an active `tblresponsible_units` row; the assignment relationship is authoritative.

Archived plans/objectives remain readable but must be restored before progress can change. Deleted content is excluded. Draft and published objectives in draft or finished plans accept updates. This follows existing collaboration lifecycle rules.

## API

All endpoints require the application's normal JWT authentication/session middleware.

`PATCH /api/strategic-objectives/{objective}/progress`

```json
{
  "progress_percentage": 75,
  "reason": "Corrected against the verified implementation report."
}
```

Reason is optional for office updates and required for every Planning Officer submission, including resubmission of the same percentage. Invalid percentages and submitted status, assignment, content or updater fields return 422. Missing update permission or incorrect office assignment returns 403. Unknown or deleted objectives return 404. Success returns `{ "success": true, "data": { ...objective } }`, including progress and latest progress updater.

`GET /api/strategic-objective-progress` returns a paginated monitoring list with current progress, office, plan, updater and timestamp. Optional filters: `plan_id`, `responsible_unit_id`, `progress_status`, `search`, `page`, `per_page` (1–100). The response has `data` and `meta.current_page`, `meta.last_page`, `meta.total`.

`GET /api/strategic-objectives/{objective}/progress-history` returns newest-first history with optional `page` and `per_page`. The same visibility rules apply; inaccessible objectives return 404.

The generic objective create/update endpoints reject progress fields. Objective lifecycle endpoints cannot set a progress status.

## Persistence and audit

`tblstrategic_objectives` stores `progress_percentage`, generated `progress_status`, `progress_updated_at` and nullable `progress_updated_by`. Progress writes also advance the ordinary `updated_at`; content, content updater, lifecycle, plan and responsible assignment remain unchanged.

Every successful submission appends to `tblobjective_progress_updates`: objective, updater ID/name/role, correction flag, previous and new percentages/statuses, reason and timestamp. Historical actor names and roles remain available if the account changes or is removed. There is no history edit/delete API. Subsequent updates do not overwrite old records, and objective hard deletion is restricted while history exists.

Plan/objective locks serialize updates with existing assignment writers. Progress and history commit in the same transaction; a failed history insert rolls back progress. MySQL enforces the 0–100 range and generates status, preventing direct independent status writes.

## Interface and verification

Offices use **Update Assigned Progress**. Planning Officers open **Monitor and update progress** on either the objective register or a plan's Manage Objectives page. Both interfaces show history and a calculated, read-only status. Planning Officer forms require a reason.

Run against the dedicated test database described in [mysql-testing.md](mysql-testing.md):

```sh
php -d xdebug.mode=off vendor/bin/phpunit tests/Feature/ObjectiveProgressTest.php
npm run test:frontend
npm run build
```

Coverage includes authenticated role and assignment checks, status boundaries, invalid input, API/database override protection, corrections across offices, reason enforcement, retained history, unchanged objective data, scoped monitoring and rollback on audit failure.

Verified on 2026-09-21: 23 progress backend tests (155 assertions), all 6 frontend tests, PHP formatting checks and the Vite production build pass. Cookie-based login, inactive-account rejection, finished-plan updates and migration rollback/reapply are covered. A broader objective/assignment/alignment/plan regression run passed 207 of 208 tests; `PlanCreationTest::test_plan_interface_routes_are_available` still expects HTTP 200 from a route that redirects with 302. The complete backend suite did not complete successfully; this is not a claim that all project tests pass.

Integration also required repairing committed merge remnants in permissions, navigation, authentication and test files, fixing moved frontend import/test paths, and replacing an unsupported schema `check()` call in the existing document migration. The application database was not migrated during verification; tests used the dedicated test database.
