# Strategic plan approval

Run `php artisan migrate` to install the approval tables. Existing plans receive
`approval_status = not_submitted`; existing `finished` plans are not treated as
submitted. No workflow is active by default.

## Configuration

Technical Administrators (`Technical Administrator` / `Technical Admin`) and
Administrators can configure the organisation-wide workflow at
`/workflow-configuration`. Each stage has a name, a sequence starting at 1 with no
gaps, and either an active user or a role containing active users. All stages are
applicable. One assigned reviewer must approve each stage, in sequence.

`GET /api/approval-workflow` returns the configuration and available assignees.
`PUT /api/approval-workflow` saves or activates the complete configuration:

```json
{
  "name": "Strategic Plan Approval",
  "description": "Sequential organisational review",
  "version": 0,
  "status": "active",
  "stages": [
    {"name": "Planning review", "sequence": 1, "role_id": 3},
    {"name": "Final approval", "sequence": 2, "user_id": 8}
  ]
}
```

Use actual IDs from the options response. `version` must match the retrieved
version; stale saves return 409. Status is `draft`, `active`, or `inactive`.
Validation applies to draft saves too. Configuration writes and submissions lock
the same singleton workflow row so a submission cannot capture a partial edit.

## Submission and review

Planning Officers with `strategic_records.update`, and Administrators, submit
using the Finalize Plans page or `POST /api/strategic-plans/{plan}/submit`.
Submission accepts draft or finished strategic plans with a title, mission,
vision, core values, and at least one non-archived objective with a title,
expected outcome and indicator. Pending implementation inputs must be reviewed.
Archived, deleted, approved or already-pending plans cannot be submitted.
No active workflow, invalid stages, or unavailable approvers produce a clear
validation error without changing the plan.

The transaction finalizes a draft plan, sets `approval_status = under_approval`,
records the configuration version and snapshot, snapshots the submitted plan and
supporting records, creates stage instances and reviewer assignments, starts
sequence 1 and writes submission and stage-start history. Plan row locking
prevents concurrent duplicate submissions. Approval status is separate from the
existing draft/finished/archive lifecycle.

Role membership is resolved to active user IDs at submission. Configuration,
membership, or plan content changes do not alter that submission. Inactive users
cannot access the API; reassigning an in-progress stage is not provided.

- `GET /api/strategic-plans/{plan}/approval-preparation`: pending input count for
  an authorised submitter, independent of input-management scope.
- `GET /api/plan-reviews`: paginated queue restricted to the current reviewer.
- `GET /api/strategic-plans/{plan}/approval`: latest submitted snapshot, ordered
  stage instances, frozen reviewer assignments, and history. Access is limited
  to the submitter and recorded workflow reviewers, including prior/future stages.
  An administrator who is not a participant does not receive review access.
- `GET /api/plan-submissions/{submission}/documents/{document}`: participant-only
  download of a submitted attachment; validates inclusion and its recorded hash.
- `POST /api/strategic-plans/{plan}/approval/decision`: accepts `submission_id`,
  `stage_id`, `decision` (`approve` or `reject`) and `comment`. A rejection requires
  a reason. Only a current-stage reviewer can decide. Stale or duplicate requests
  return 409. Approval starts the next recorded stage or completes the workflow;
  rejection ends the cycle and allows a new submission while preserving history.

## Verification

`php -d xdebug.mode=off vendor/bin/phpunit tests/Feature/PlanApprovalTest.php`
uses the isolated MySQL test database described in [mysql-testing.md](mysql-testing.md).
Coverage includes configuration validation and persistence, administrative access,
submission eligibility, duplicate prevention, snapshots, assignment-based review,
ordered decisions, rejection/resubmission and attachment access.

Verified on 2026-09-21: approval feature tests passed (14 tests, 134 assertions),
`npm.cmd run test:frontend` passed (6 tests), and `npm.cmd run build` passed.
Tests migrated only the isolated test database; apply the migration to the
application database before using these pages.

The full repository suite is not green: the activity-history authentication test
returns 401, the existing plan-page test expects 200 from a route that redirects
with 302, and the initialization test requires an unavailable SQLite driver.
The full run also terminated during `SubmittedImplementationInputsTest`.
These are outside the new approval tests.
