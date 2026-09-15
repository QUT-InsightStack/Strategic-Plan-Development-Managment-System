# Strategic Objective alignment mappings

Strategic Objective responses include the PDP Chapters and Presidential Agenda
items linked to each objective. The backend reads the mapping tables directly
through Eloquent many-to-many relationships; it does not infer links from titles,
codes, or the parent plan.

## API

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
- Create/update objective responses include the same two collections. This change
  does not introduce reference-management or mapping-write API endpoints.

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
the inverse relationship. For trusted imports or backend code, Laravel's relation
`syncWithoutDetaching()` / `detach()` methods can maintain the stored pairs.

## Verification

```bash
php artisan test --filter=StrategicObjectiveAlignmentTest
```

The tests use the migrations and an isolated SQLite database. They cover all three
read endpoints, seeded Planning Officer permissions with JWT middleware enabled,
exact mapping membership and reference details, empty/independent/shared links,
pagination, reference updates, link removals, archived/deleted records, query
counts, duplicate/orphan rejection, cascading deletes, and migration rollback.

For Windows PHP installations with SQLite extensions present but disabled:

```powershell
php -d xdebug.mode=off -d extension=pdo_sqlite -d extension=sqlite3 vendor/phpunit/phpunit/phpunit --filter=StrategicObjectiveAlignmentTest
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
