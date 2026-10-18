# Submitted Office/Agency inputs

## Acceptance review

The existing backend stored submissions and restricted Office/Agency history, but planning scope was an empty authorization hook. It lacked a cross-plan list, detail/review endpoints, filters and status summaries. `/consolidate-inputs` read browser demo storage instead of database submissions.

The implementation now covers:

| Acceptance criterion | Implementation |
| --- | --- |
| Authorized access | JWT, account/session validation and input view permissions on every endpoint |
| Planning scope | Explicit user/Strategic Plan grants in `tblimplementation_input_scopes`; no grants means no accessible plans |
| Office/Agency scope | Active administrator-maintained office membership, current objective assignments and submitting unit ID |
| Authorized reviews | Planning Officer role, view permission, review permission and a grant for the input's plan; checked again when saving |
| Reject out-of-scope requests | HTTP 403 for explicit plan, objective, office and input requests outside scope; missing/deleted targets return 404 |
| Filters and summary | Derived from the same authorized query as the list, before pagination |
| Stored identity and associations | Original plan/objective/unit/user IDs, office/name snapshots, type, status and submission timestamp |
| Read-only retrieval | GET endpoints execute no writes, including user/session activity timestamps; authentication and expiration checks still run |

## Installation and planning scope

Run `php artisan migrate` to apply `2026_09_16_000001_add_submitted_input_review_and_scope.php`. Existing submission content, identity, status and timestamps are preserved. No plan grants are inferred from ownership or department. This implements the conservative default of explicit authorization for **submitted inputs**; other strategic-plan APIs retain their existing authorization rules.

Existing built-in roles receive `implementation_inputs.view`. Planning Officers also receive `implementation_inputs.review`; Administrators receive `implementation_inputs.manage_scope`. Fresh installations receive the same permissions through the idempotent collaboration seeder. Custom viewers may retain `implementation_inputs.view_all` and receive explicit plan grants. Assign `implementation_inputs.view` as well to expose the navigation link.

An Administrator, or an account explicitly granted `implementation_inputs.manage_scope`, manages each plan's complete grant list:

```http
PUT /api/strategic-plans/12/input-scope
Content-Type: application/json

{"user_ids": [34, 56]}
```

`GET` on the same URL returns the current user IDs. An empty `user_ids` list revokes all grants for that plan. Scope changes are atomic, audited and idempotent. Recipients must be active planning users; Office/Agency roles cannot use plan grants to expand their own-office scope. A scope grant alone does not grant view or review permission. The default Administrator may view all plans but cannot perform a review: the acceptance criterion reserves review actions for Planning Officers.

## Query API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/implementation-inputs` | Paginated inputs across authorized plans |
| GET | `/api/implementation-inputs/{inputId}` | One authorized input |
| GET | `/api/strategic-plans/{planId}/inputs` | Inputs for an authorized plan |
| GET | `/api/strategic-objectives/{objectiveId}/inputs` | Inputs for an authorized objective |
| POST | `/api/implementation-inputs/{inputId}/review` | Approve or reject a pending input |

List filters: `plan_id`, `objective_id`, `responsible_unit_id`, `input_type`, `status`, `submitted_from`, `submitted_to`, `page`, `per_page`. Dates use `YYYY-MM-DD`, inclusive, in the application's database timezone. Types are `progress_update`, `issue`, `change_request`; statuses are `Pending Review`, `Approved`, `Rejected`. Default page size is 25, maximum 100; ascending input IDs make pagination deterministic. A filter cannot override a nested route's plan or objective ID.

Responses retain `{success, data, meta}` and add:

- `data[].strategic_plan`: stored plan ID, current title and status.
- `data[].objective`: stored objective ID, current title and status, or null for plan-only submissions.
- `data[].can_review`: current server-authorized availability of review actions.
- `meta.filters.plans`: authorized non-deleted plans, including archived history.
- `meta.filters.offices`: offices present in authorized input records for the selected plan/objective.
- `meta.summary`: all three status counts, including zero. Counts follow the plan, objective, office, type and date filters, **exclude the status filter**, and do not depend on the current page.

Office users see submissions by all users of their own office within current assignments. Reassignment never transfers ownership of a historical submission to the new office. Deleted plans/objectives are excluded; archived records retain read access but cannot be reviewed. Deleting a submitting user nulls the foreign key while preserving the submitter and office name snapshots.

## Review API

```json
{"status": "Rejected", "review_note": "Please supply the reporting period."}
```

Only `Approved` and `Rejected` are accepted. Rejection requires a nonblank note; notes have a 5,000-character limit. The server records reviewer ID, name snapshot and review timestamp. Original content, type, submitter, office and submission time cannot be changed by a review. Review does not apply proposed changes to the Strategic Plan or objective. A second/stale decision or a closed target returns 409. The review and audit write share a transaction, so an audit failure rolls back the decision.

## Page and read behavior

The **Submitted Inputs** navigation item opens `/consolidate-inputs`. It fetches database records, shows plan, submitting office/user, type, plain-text content, status and local date/time, supports filters/pagination and displays authorized status summaries. Details are fetched again when opened. Review controls follow `can_review`, and failed saves refresh permissions/status. Errors clear previously loaded list data and provide a retry action.

The page uses the implementation input API and its three stored input types. Browser-only planning proposals (`objective`/`core_value`) from the separate Office planning demo are not stored implementation submissions and are not imported by this migration.

Read-only route metadata is defined on the server and cannot be set through query parameters. Reading inputs does not extend session activity or persist expired-session revocation. Expired sessions are still rejected; ordinary API calls retain activity tracking and persisted revocation.

## Verification

Tests use the isolated MySQL test database described in [mysql-testing.md](mysql-testing.md). Run:

```powershell
php -d xdebug.mode=off vendor/bin/phpunit --filter 'SubmittedImplementationInputsTest|ObjectiveCollaborationTest'
npm.cmd run build
```

Coverage includes real JWT sessions, missing/revoked permissions and grants, office isolation (including extra role permissions), filters and summary totals, pagination, identity retention, database snapshots and SQL write detection on GET, review integrity/audit rollback, lifecycle restrictions, scope administration, migration upgrade/rollback, and ordinary session activity behavior.
