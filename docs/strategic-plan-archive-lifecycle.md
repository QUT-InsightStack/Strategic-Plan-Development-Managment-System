# Strategic Plan Archive Lifecycle

## Status Model

- Plan statuses: `draft`, `finished`, `archived`, `deleted`
- Objective statuses: `draft`, `published`, `archived`, `deleted`
- Foundation / relation / core-value-link statuses: `active`, `archived`, `deleted`

## Allowed Plan Transitions

- `draft -> finished` through create/update validation
- `finished -> archived` through the archive endpoint
- `archived -> finished` through the same status endpoint as a restore action
- `draft|finished|archived -> deleted` through soft delete
- `deleted` is terminal

## Archive Rules

- Only `finished` plans can be archived
- Archive is idempotent; archiving an already archived plan returns the current record without duplicating lifecycle work
- Archive stamps `archived_at` and `archived_by` on the plan
- Restore clears `archived_at` and `archived_by` and returns the plan to `finished`

## Related Records on Archive

- Objectives move to `archived`, keep their previous status in `status_before_archive`, and receive `archived_at` / `archived_by`
- Core-value links move to `archived` and keep the plan association
- Relations move to `archived` when either connected plan is archived
- Mission, vision, and core-value foundations move to `archived` only when all remaining references are archived

## Related Records on Restore

- Objectives restore from `status_before_archive`
- Core-value links restore to `active`
- Relations restore to `active` when both connected plans are active again
- Foundations restore to `active` when they regain any active plan reference

## Related Records on Delete

- Delete is soft only; no related strategic records are physically removed
- Objectives, core-value links, and relations move to `deleted`
- Foundations move to `deleted` only when they no longer have any active or archived references

## API Expectations

- Non-existent or already deleted plans return `404`
- Invalid transitions return validation errors with business-readable messages
- Audit logging calls remain behind the current log interface and can be wired later without changing lifecycle rules
