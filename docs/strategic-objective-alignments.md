# Strategic Objective alignment mappings

Strategic Objective responses include the PDP Chapters and Presidential Agenda
items linked to each objective. Planning Officers can add, replace, and remove
mappings on existing objectives through the alignment endpoints. The backend uses
Eloquent many-to-many relationships; it does not infer links from titles, codes,
or the parent plan.

## API

### Create mappings

`POST /api/strategic-objectives/{id}/alignments`

Requires a valid authenticated session and `strategic_objectives.update`
permission, already assigned to Planning Officers and Administrators by the role
seeder. Creating an alignment modifies the selected existing objective. The
existing plan scope authorization hook is also applied; it currently imposes no
additional ownership/office restriction.

Example JSON body (IDs must identify existing reference records):

```json
{
  "pdp_chapter_ids": [2, 3],
  "presidential_agenda_item_ids": [5, 6]
}
```

- At least one list must be nonempty. Either list can be omitted or empty when
  the other contains IDs. Each list accepts up to 100 distinct positive JSON
  integers; strings, booleans, fractional numbers, and associative objects are
  rejected.
- PDP Chapters must exist. Presidential Agenda items must exist and be active.
  Existing links to subsequently inactivated agenda items remain readable.
- The URL selects the objective. Client-supplied `objective_id`,
  `strategic_plan_id`, `created_by`, and `updated_by` values are prohibited.
- The endpoint adds mappings and preserves all existing links. It does not
  replace the complete set of alignments. A duplicate within either input list
  or a pair already stored for this objective rejects the entire request, even
  if the other requested pairs are new. References may be shared by different
  objectives.
- Draft and published objectives can receive mappings. Archived objectives or
  plans must be restored first; deleted objectives/plans cannot receive mappings.
- Both mapping tables, the objective's `updated_by`/`updated_at`, and the
  `strategic_objective.alignments_created` audit event are written in one
  transaction. A failure leaves no partial mappings or successful audit event.
  The audit event records the authenticated actor, objective, and submitted IDs.

| Status | Meaning |
| --- | --- |
| `201` | All requested pairs created; `success: true`, `message`, and the objective in `data`, including its complete `pdp_chapters` and `presidential_agenda_items` collections |
| `401` | Missing, expired, or revoked authentication; inactive/locked user |
| `403` | Missing objective update permission or denied plan scope |
| `404` | Objective or parent plan missing/deleted, or nonnumeric objective route ID |
| `422` | Empty/malformed selections, missing/inactive references, duplicate pairs, prohibited fields, or archived objective/plan |

Validation errors use the existing `{ "success": false, "message": "Validation
failed.", "errors": { ... } }` envelope. Per-reference errors identify the list
and index, such as `presidential_agenda_item_ids.0`; a database uniqueness conflict
identifies the affected list.

The transaction locks the parent plan before the objective and holds shared
locks on selected references while checking and inserting mappings. Duplicate
checks use locking reads, and the composite primary keys provide a final guard
against competing writers. Database uniqueness conflicts are returned as `422`
and roll back the batch.

### Update mappings

`PUT /api/strategic-objectives/{id}/alignments`

Requires the same authentication, `strategic_objectives.update` permission,
plan scope authorization, and editable objective/plan status as creation.
Returns `200` with `success`, `message`, and the refreshed objective in `data`.
The same `401`, `403`, `404`, and `422` error envelopes apply.

```json
{
  "pdp_chapter_ids": [2, 3],
  "presidential_agenda_item_ids": []
}
```

Each supplied list is the desired final set for that framework on the objective
selected by the URL. For example, if the PDP set was `[1, 2]`, this request adds
chapter 3, removes chapter 1, and retains chapter 2. It also clears all Presidential
Agenda mappings. Other objectives, reference records, and the parent plan are not
modified.

- At least one list must be present. An omitted list is unchanged; an empty list
  removes all mappings for that framework. Both empty lists are accepted.
- Each list allows up to 100 distinct positive JSON integers. Invalid IDs,
  malformed arrays, duplicate input IDs, and client-supplied target/audit fields
  are rejected, using the same rules as creation. JSON objects (including `{}`
  and objects with numeric keys) are rejected; use `[]` to clear mappings.
- Newly added references must exist, and new agenda links must be active.
  Previously linked inactive agenda items can be retained or removed.
- Existing pairs are valid selections. Only added pairs are inserted and only
  removed pairs are deleted. Retained pivot rows, including both timestamps,
  remain unchanged. Saving the same set again (even in a different order) succeeds
  without rewriting mappings, objective metadata, or an audit event.
- Both mapping tables, the objective's `updated_by`/`updated_at`, and the
  `strategic_objective.alignments_updated` audit event commit in one transaction.
  The event identifies the actor and objective and records `changes`, with
  `added` and `removed` ID lists for each changed framework. Invalid references,
  database uniqueness conflicts, or audit failures roll back all changes.
- Writes lock the parent plan before the selected objective; composite primary
  keys continue to reject duplicate pairs. No additional mapping-table migration
  is required.

### Read mappings

All three existing read endpoints include `pdp_chapters` and
`presidential_agenda_items` on each objective:

| Endpoint | Response |
| --- | --- |
| `GET /api/strategic-objectives` | Objectives in `data`, pagination in `meta` |
| `GET /api/strategic-plans/{planId}/objectives` | All objectives for the plan in `data` |
| `GET /api/strategic-objectives/{id}` | One objective in `data` |

Authentication and `strategic_objectives.view` permission are required. The
Planning Officer role receives this permission from the existing role seeder.
The existing plan authorization service remains in use; its record-level scope
hook currently imposes no additional ownership/office restriction.

The index keeps its existing filters (`search`, `plan_id`, `status`,
`responsible_office_agency`, `year`, `per_page`) and `page` pagination. Objectives
are ordered by `updated_at` descending, then `objective_id` descending to resolve
ties. Pagination applies to objectives; every linked reference is returned for
each objective on the page. Each mapping table is eager-loaded once per listing.

Example detail response (existing objective fields and reference audit fields
are abbreviated):

```json
{
  "success": true,
  "data": {
    "objective_id": 7,
    "strategic_plan_id": 3,
    "objective_title": "Improve service delivery",
    "pdp_chapters": [
      {
        "chapter_id": 2,
        "chapter_title": "Example PDP Chapter",
        "chapter_description": "Chapter details",
        "pivot": {
          "objective_id": 7,
          "chapter_id": 2,
          "created_at": "2026-09-08T00:00:00.000000Z",
          "updated_at": "2026-09-08T00:00:00.000000Z"
        }
      }
    ],
    "presidential_agenda_items": [
      {
        "agenda_id": 5,
        "code": "PA-EXAMPLE",
        "title": "Example Presidential Agenda item",
        "description": "Agenda details",
        "status": "active",
        "effective_date": "2026-01-01",
        "note": null,
        "pivot": {
          "objective_id": 7,
          "agenda_id": 5,
          "created_at": "2026-09-08T00:00:00.000000Z",
          "updated_at": "2026-09-08T00:00:00.000000Z"
        }
      }
    ]
  }
}
```

- Each reference collection is ordered by its numeric ID ascending.
- An objective with no links returns two empty arrays. Either framework can be
  linked independently, and a reference can be shared by multiple objectives.
- Archived objectives remain readable. Linked inactive agenda items remain
  visible with their status so historical alignment can be verified.
- Deleted objectives and objectives belonging to deleted plans are excluded.
  Missing/deleted detail resources return `404`; unauthenticated requests return
  `401`, and users lacking view permission receive `403`.
- Create/update objective responses include the same two collections. To add
  mappings, use the dedicated alignment endpoint after creating the objective.
  The ordinary objective CRUD endpoints do not accept mapping lists.

## Database

Run the new migration before deploying the updated query code:

```bash
php artisan migrate
```

Migration: `2026_09_08_000001_create_strategic_objective_alignment_tables.php`.

| Table | Purpose / keys |
| --- | --- |
| `tblpdp_chapters` (existing) | PDP reference data; primary key `chapter_id` |
| `tblpresidential_agenda_items` | Agenda reference data; primary key `agenda_id`, unique `code` |
| `tblobjective_pdp_chapter` | Composite primary key `(objective_id, chapter_id)` |
| `tblobjective_presidential_agenda` | Composite primary key `(objective_id, agenda_id)` |

Both mapping tables have foreign keys to the objective and reference tables,
timestamps, and indexes for reference lookups. The composite keys reject duplicate
pairs, and foreign keys reject nonexistent objectives/references. Physical
deletion of either endpoint cascades only to its mapping rows. Objective/plan
status changes preserve stored mappings. The migration's rollback drops the new
mapping tables before the agenda table and leaves existing PDP/objective tables
intact. No sample national-framework records or inferred mappings are seeded.

`StrategicObjective::pdpChapters()` and `presidentialAgendaItems()` expose the
forward relationships; each reference model exposes `strategicObjectives()` for
the inverse relationship. User-initiated mapping changes go through the alignment
endpoint so validation, authorization, duplicate rejection, and audit logging
are applied. No additional schema migration is needed for creation or updates;
the alignment-table migration above must already be applied.

## Verification

### Update acceptance verification — 2026-09-16

**161 related tests passed (983 assertions) on the isolated MySQL test database.**
This includes 62 update cases, 59 creation cases, alignment reads/database guards,
objective CRUD/archive/restore, and PDP Chapter regression tests.

```powershell
php -d xdebug.mode=off vendor/phpunit/phpunit/phpunit --filter='StrategicObjectiveAlignment|StrategicObjectiveApiTest|PdpChapterTest'
```

`StrategicObjectiveAlignmentUpdateTest` verifies API changes with authentication
and session middleware enabled: additions, removals, clearing one/both frameworks,
omitted lists, retained pivot timestamps, repeated/reordered selections, inactive
historical references, changes by the same editor, and isolation from other
objectives in the same or different plans. It checks saved data through subsequent
GET requests and verifies audit metadata, validation failures, denied permissions
and sessions, unavailable targets, and rollback after database/audit failures.
Database uniqueness conflicts are injected to exercise the MySQL error path;
simultaneous HTTP load was not tested.

The controller syntax/structure and missing alignment eager-loading were repaired.
Related test authentication now creates a real database session with the required
JWT `sid` claim. Duplicate imports/fixtures, MySQL migration-test transaction
handling, and outdated archive fixture assumptions were corrected. All changed
PHP files and the JavaScript API module passed syntax checks; the implementation
and alignment tests passed Pint, and `git diff --check` passed. The application
database was not migrated or reset. This is a related regression run, not a
claim that the complete application test suite passed.

### Earlier verification

Verification on 2026-09-15: 103 related tests passed (645 assertions), covering
alignment reads/writes, objective CRUD, plan creation/lifecycle, PDP Chapters,
role permissions, and the audit migration. This includes 55 new mapping creation
cases (321 assertions). All five changed/new PHP files passed syntax checks;
the three new PHP files passed Pint. Execution used an isolated SQLite in-memory
database. MySQL execution and real concurrent requests were not tested.

```bash
php artisan test --filter=StrategicObjectiveAlignment
```

The tests use the migrations and an isolated SQLite database. They cover all three
read endpoints, seeded Planning Officer permissions with JWT middleware enabled,
exact mapping membership and reference details, empty/independent/shared links,
pagination, reference updates, link removals, archived/deleted records, query
counts, duplicate/orphan rejection, cascading deletes, and migration rollback.

`StrategicObjectiveAlignmentWriteTest` additionally covers creation through the
API with JWT middleware enabled: one/many links to either/both frameworks,
preservation of existing/shared links, persisted timestamps and audit metadata,
malformed or empty selections, duplicates within a batch and repeated requests,
missing/inactive references, denied permissions/sessions/scope, archived/deleted
targets, and transaction rollback. A controlled conflicting insert exercises the
database uniqueness error response; it is not a concurrent MySQL load test.

For Windows PHP installations with SQLite extensions present but disabled:

```powershell
php -d xdebug.mode=off -d extension=pdo_sqlite -d extension=sqlite3 vendor/phpunit/phpunit/phpunit --filter=StrategicObjectiveAlignment
```

Two existing setup issues were corrected to run these checks: an unfinished array
in `RolePermissionSeeder`, and MySQL-only SQL in the audit-log migration (SQLite
schema handling is now supported while retaining the MySQL text-prefix index).

Verification on 2026-09-08: 48 related tests passed (324 assertions), including
objective CRUD, PDP Chapters, role permissions, and the audit migration round
trip. The existing PDP tests now create a chapter before checking forbidden
deletion and reuse the manage permission already inserted by a migration.

The full suite ran 138 tests (626 assertions): 135 passed and three failed outside
the alignment feature. Two password-management tests expect an auth-version value
of 1 but receive 2; the user-search test encounters an SQLite `ESCAPE` expression
error. All changed PHP files passed syntax checks, and the new PHP files passed
Pint. Database execution was verified on SQLite; MySQL execution was not tested.
