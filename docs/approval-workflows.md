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
  rejection ends the cycle and allows resubmission while preserving history.

## Resubmission

Use **Resubmit for Approval** on a rejected plan, review the revisions and the
recorded rejection reason on the Finalize page, and optionally provide a revision
note. `POST /api/strategic-plans/{plan}/resubmit` accepts:

```json
{"previous_submission_id": 12, "revision_note": "Revised objectives and indicators"}
```

Both the plan and its latest submission must be rejected. The supplied ID must
match that latest cycle. Draft, pending, approved, archived and deleted plans are
not eligible for resubmission (a rejected plan retains its `finished` lifecycle
state). The normal plan validation and active-workflow validation run again.
The initial `/submit` endpoint rejects rejected plans, directing clients to
`/resubmit`.

The new cycle uses the **currently active configuration**, starts at sequence 1,
captures the revised plan and current reviewer assignments, and records a
`resubmitted` history event with the optional note. Its `previous_submission_id`
links to the rejected cycle. The prior snapshot, rejection reason and history
are retained. A plan row lock and a unique constraint on `previous_submission_id`
prevent duplicate cycles; an old retry cannot resubmit a newer rejected cycle.

## Status tracking

`/strategic-plans/{plan}/approval-status` displays the current status, stage,
assigned role/user, resolved reviewers and historical actions. It reads
`GET /api/strategic-plans/{plan}/approval-status` and offers an explicit refresh.
The plan register and review/finalize pages link to this view.

Authorised Planning Officers with plan update access and Administrators can
track all cycles within their plan scope. Other users must participate in the
latest cycle, and receive only the history of cycles in which they participated.
Technical administrator privileges alone do not grant tracking access.
History is ordered by recorded event ID, including when timestamps are equal.
Status reads use a shared plan lock so state and history reflect a consistent
workflow transaction. Pending plans identify their current stage; completed
cycles return `current_stage: null`.

## Workflow notifications

Notifications are **in-app notifications**, available from the Notifications
navigation link at `/workflow-notifications`; no email delivery is configured.

| Workflow event | Recipients |
| --- | --- |
| Submitted / resubmitted | Submitter and first-stage reviewers |
| Stage approved | Submitter, approved-stage reviewers and next-stage reviewers |
| Final approval | Submitter and final-stage reviewers |
| Rejected | Submitter and rejected-stage reviewers |

Recipients come from the submission's frozen assignments. A user who appears in
several recipient groups receives one notification per event. The database's
unique `(event_id, recipient_id)` constraint enforces this across retries.
Each notification links to the workflow event, submission, plan and recipient.

Notification intent is inserted with the workflow event in the same transaction;
rollbacks leave neither an event nor a notification. After commit, a separate
transaction publishes each pending row to its recipient's inbox. Delivery errors
are caught and cannot roll back or fail the already-committed approval request.
`pending`, `sent` and `failed` delivery states, attempts, retry time, `sent_at`
and an independent `read_at` receipt are persisted. Inactive recipients fail
delivery. Database outages leave the durable row for retry.

The scheduled `workflow:deliver-notifications` command retries pending/failed
rows every minute, with exponential delays and a limit of five attempts per row.
Concurrent delivery attempts lock the notification row; publishing and recording
`sent` happen together, preventing duplicate inbox entries. Ensure Laravel's
scheduler is running (`php artisan schedule:work` for local development). Run
`php artisan workflow:deliver-notifications` to process due retries manually.

- `GET /api/workflow-notifications`: paginated sent notifications for the signed-in
  recipient plus their unread count.
- `PATCH /api/workflow-notifications/{id}/read`: idempotent read receipt for that
  recipient only; another recipient's ID returns 404.

Apply the new migration with `php artisan migrate` before using resubmission or
notifications. Existing approval history is preserved; past events are not
retroactively notified.

## Verification

`php -d xdebug.mode=off vendor/bin/phpunit tests/Feature/PlanApprovalTest.php`
uses the isolated MySQL test database described in [mysql-testing.md](mysql-testing.md).
Coverage includes configuration validation and persistence, administrative access,
submission eligibility, duplicate prevention, snapshots, assignment-based review,
ordered decisions, rejection/resubmission and attachment access.

Verified on 2026-09-22: approval feature tests passed (27 tests, 305 assertions),
`npm.cmd run test:frontend` passed (11 tests), and `npm.cmd run build` passed.
The added tests exercise eligible and stale resubmissions, cross-cycle history
and its visibility, notification recipients and unique constraints, delivery
failures/retries, rollback isolation, read receipts and the new page interactions.
Tests migrated only the isolated test database; apply the migration to the
application database before using these pages.

The full repository suite is not green: the activity-history authentication test
returns 401, the existing plan-page test expects 200 from a route that redirects
with 302, and the initialization test requires an unavailable SQLite driver.
The full run also terminated during `SubmittedImplementationInputsTest`.
These are outside the new approval tests.
