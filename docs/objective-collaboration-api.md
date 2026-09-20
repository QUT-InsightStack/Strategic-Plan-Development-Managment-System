# Responsible units, objective comments and implementation inputs

The existing objective payload field `responsible_office_agency` remains supported. All endpoints use the existing JWT authentication (`access_token` HttpOnly cookie or Bearer token) and account/session validation. Browser code imports the API modules; authorization, unit lookup, lifecycle decisions, timestamps and database writes run in PHP services.

## Installation and existing data

Run `php artisan migrate` to install the two `2026_09_14` migrations. They create the responsible-unit directory, current objective assignments, comment history and implementation inputs, and provision the new permissions for existing roles. A fresh installation can run `php artisan db:seed` as usual. The permission seeder is idempotent.

The migration imports non-empty `tblusers.office` and objective `responsible_office_agency` values, preserving existing objective labels and archive metadata. Each distinct office name becomes one directory entry; matching ignores leading/trailing spaces and case. This follows the project's existing flat office namespace: use distinct office names for distinct agencies. An objective has one current responsible unit; multiple objectives may share that unit. Reassignment updates the existing relationship and is audited.

User membership is determined from the existing administrator-maintained `tblusers.office` field, **not** the free-text `unit` field or anything submitted with a comment/input. Administrators use the existing user create/update API to maintain `office`. Self-service profile edits cannot change it. A name entered when assigning an objective registers a directory entry, preserving the existing form's “select or enter an office/agency” behavior. The directory endpoint returns active registered units.

## Authorization

| Action | Permission | Additional scope |
| --- | --- | --- |
| List responsible units | `strategic_objectives.view` | Authenticated active account |
| Assign/reassign/clear a responsible unit | `strategic_objectives.assign_responsible_unit` | Existing plan scope; active plan and objective |
| Add comments | `objective_comments.create` | User's office must currently be assigned to the objective |
| Submit inputs | `implementation_inputs.create` | Same office rule; plan-only inputs require an assigned active objective in that plan |
| Read all objective comments | `objective_comments.view_all` | Existing plan scope |
| Read all implementation inputs | `implementation_inputs.view_all` or Planning Officer with `implementation_inputs.view` | Explicit submitted-input plan grants |

Submitted-input listing, filters, summaries, review and planning grants are documented in [Submitted Office/Agency inputs](submitted-implementation-inputs.md). Apply the additional `2026_09_16` migration for these endpoints. Office history can also be read with `implementation_inputs.view` without submission permission.

Planning Officers receive assignment and both read-all permissions. Responsible Unit Users and existing Office Representative / Office/Agency / Offices / Agencies roles receive comment/input submission permissions and plan/objective view permissions. Administrators retain the existing permission bypass, but **submitting feedback still requires an assigned office** so its provenance is meaningful. Custom roles can receive these permissions through the existing role-management API.

Contributors can list only their own office's feedback within their current assignment scope. Planners can see previous offices' feedback after reassignment. A previous office loses submission access immediately. Legacy objective creation/editing requires the new assignment permission when the responsibility value changes; submitting an unchanged value does not require that permission. Ordinary objective create/update permissions remain necessary on those legacy endpoints.

## Lifecycle rules used for this implementation

The current plan status model is `draft`, `finished`, `archived`, `deleted`; objectives use `draft`, `published`, `archived`, `deleted`. There is no separate approval workflow/status on these records. Accordingly, `finished` plans and `published` objectives are treated as finalized for proposed content changes.

| Input type | Purpose | Allowed target |
| --- | --- | --- |
| `progress_update` | Implementation progress | Draft/finished plans and draft/published objectives |
| `issue` | Implementation blockers | Same as progress updates |
| `change_request` | Proposed content changes | Draft plan; if an objective is selected it must also be draft |

Comments remain available for draft/published objectives on draft/finished plans. Archived records reject new submissions, retain history and allow authorized history reads. Deleted records return 404 and retain stored history. Inputs never write to the plan, objective, foundations, PDP chapters or presidential agenda/reference records, regardless of type. Review and applying an approved input are outside these submission endpoints.

## Endpoints

All paths below are prefixed with `/api`.

| Method | Path | Body |
| --- | --- | --- |
| GET | `/responsible-units` | Query: `page`, `per_page` |
| PUT | `/strategic-objectives/{id}/responsible-unit` | `responsible_office_agency` **or** `responsible_unit_id` |
| PUT | `/strategic-objectives/responsible-unit` | `objective_ids` (1–100 unique IDs) and the same unit selector |
| GET / POST | `/strategic-objectives/{id}/comments` | POST: `content` |
| GET / POST | `/strategic-objectives/{id}/inputs` | POST: `content`, `input_type` |
| GET / POST | `/strategic-plans/{id}/inputs` | POST: `content`, `input_type`, optional `objective_id` |

Bulk assignment is atomic: one invalid, missing, deleted or archived target rejects the entire operation. Dedicated assignment endpoints require a non-empty unit selection. Clear a draft objective's assignment through the existing objective update endpoint with `responsible_office_agency: null`; published objectives require an assignment.

Comments accept non-blank plain text up to 10,000 characters; input content accepts up to 20,000. All history lists use ascending IDs for stable pagination, default `per_page=25`, maximum 100. Pagination responses use the existing `{success, data, meta: {current_page, last_page, per_page, total}}` envelope. Assignment returns `{success, message, data}` with the objective (an array for bulk operations) and `responsible_unit_assignment.responsible_unit`.

Example input response (HTTP 201):

```json
{
  "success": true,
  "message": "Input submitted successfully.",
  "data": {
    "input_id": 12,
    "strategic_plan_id": 3,
    "objective_id": 7,
    "responsible_unit_id": 2,
    "responsible_office_agency": "ICT Office",
    "submitted_by": 9,
    "submitter_name": "Office User",
    "submitted_at": "2026-09-14T03:00:00.000000Z",
    "input_type": "progress_update",
    "content": "The pilot rollout is complete.",
    "review_status": "Pending Review"
  }
}
```

Comments return the same provenance fields with `comment_id`, `objective_id` and `content`, without input type or review status. Identity, unit, date and review status fields must be omitted from request bodies; the backend rejects attempts to supply them. The objective on a plan-input request must belong to that plan; the database also enforces this with a composite foreign key.

Failures return 401 for missing/expired/inactive authentication, 403 for missing permission or office assignment, 404 for unavailable targets, and 422 for validation/lifecycle violations. Field validation errors are in `errors` as in the existing API client.

## Frontend integration

The existing `resources/js/api/strategic-objectives-api.js` now exports `listResponsibleUnits`, `assignResponsibleUnit`, `assignResponsibleUnitToObjectives`, `addObjectiveComment`, and `listObjectiveComments`. Input helpers are in `resources/js/api/implementation-inputs-api.js`. They use the existing cookie-aware `apiRequest` and expose only HTTP calls.

Example from a module in `resources/js/strategic-objectives/`:

```js
import { addObjectiveComment, listObjectiveComments } from '../api/strategic-objectives-api.js';
import { submitObjectiveInput } from '../api/implementation-inputs-api.js';

export async function saveCommentAndDisplayHistory(objectiveId, content, container) {
    await addObjectiveComment(objectiveId, content);
    const { data, meta } = await listObjectiveComments(objectiveId, { page: 1, per_page: 25 });
    container.replaceChildren(...data.map(comment => {
        const row = document.createElement('p');
        row.style.whiteSpace = 'pre-wrap';
        row.textContent = `${comment.submitter_name} (${comment.responsible_office_agency})\n${comment.content}`;
        return row;
    }));
    return meta; // Use this for page controls.
}

export function sendProgress(objectiveId, content) {
    return submitObjectiveInput(objectiveId, { input_type: 'progress_update', content });
}
```

Render feedback using React text children or `textContent`. Feedback is plain text; it should not be inserted as HTML. Display `error.message` and `error.errors` from the shared API client when a request fails. No new page is required for these backend tasks; the helpers and example are ready for the frontend's comment/input controls.

## Storage and verification

`tblobjective_responsible_units.objective_id` is the primary key, preventing duplicate current assignments. Comments and inputs store unit/user foreign keys plus office and author name snapshots. User deletion nulls the submitting-user foreign key while preserving those snapshots. Strategic content uses the existing soft lifecycle; history foreign keys prevent physical removal of referenced plan/objective records. No comment/input update or delete routes are exposed. Audit writes share the submission/assignment transaction.

Run the targeted API and migration tests:

```powershell
php -d xdebug.mode=off vendor/bin/phpunit --filter 'ObjectiveCollaborationTest|StrategicObjectiveApiTest'
```

Tests now run against a dedicated MySQL database using the `mysql_testing` connection; see [MySQL test setup](mysql-testing.md). The suite covers JWT authentication, field validation, office scope, legacy endpoint permissions, atomic assignment, reassignment, immutable history through the API, lifecycle protection, unchanged source/reference records, foreign keys, migration backfill/rollback and permission seeding. MySQL lifecycle triggers are enabled during these tests.

Historical SQLite verification on 2026-09-14: the 36 targeted tests passed (283 assertions), PHP formatting checks for new files passed, and `npm.cmd run build` succeeded. Full regression then passed 138 of 141 tests. The three failures recorded at that time were:

- `PdpChapterTest::test_administrator_can_create_update_and_delete_a_chapter`: its fixture inserts `pdp_chapters.manage` even though a migration already created that unique permission.
- `PdpChapterTest::test_authenticated_user_can_view_but_cannot_manage_chapters`: an unavailable chapter returns 404 during binding; the test expects 403.
- `UserUpdateTest::test_updated_information_appears_in_search_results`: the existing search SQL uses a MySQL backslash escape expression that SQLite rejects.

The subsequent MySQL test-environment change fixes both PDP test fixtures and runs the search query with its intended database driver.

Current verification on 2026-09-15: **149 tests passed, 647 assertions** on MySQL 8.0.42, including all objective collaboration tests. The three historical failures above now pass.

The production/development business database was not migrated as part of these tests.
