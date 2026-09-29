# Archiving and deleting strategic alignment mappings (SPDM-295, SPDM-298)

Planners can archive a strategic alignment mapping instead of deleting it. An
archived mapping stays stored and can be restored later.

## Using it

On **Mapping Module → Create / Review Mapping** (`/mappings`), the mapping
preview has two tabs: **Active** and **Archived**. Each tab shows how many
mappings it holds.

1. On the **Active** tab, click **Archive** on a mapping.
2. Confirm in the dialog. **Cancel** leaves the mapping unchanged.
3. The mapping moves to the **Archived** tab, which shows when it was archived
   and by whom.
4. On the **Archived** tab, click **Restore** to make the mapping active again.

Archived mappings are left out of:

- the reference-linking step on this page;
- the office **View Alignment** list;
- the plan finalisation summary.

Those screens only read active mappings. Adding the same Agenda → PDP → DOST
chain again also reactivates the archived mapping rather than creating a
duplicate.

## When a mapping can be archived

A mapping can be archived only when both of these are true:

- the mapping is active;
- its Strategic Plan is still a **draft** and is not under approval or
  approved.

Mappings on finalised, submitted, under-approval, approved or archived plans
are locked. For those plans the **Archive** and **Restore** buttons are
disabled, and a note above the table explains why.

These rules are checked twice: when the button is clicked, and again when
the archive is confirmed. If the plan is locked, or the mapping was already
archived in another tab, the archive does not go ahead. An error message
explains the reason instead.

The rules live in `resources/js/mappings/mapping-eligibility.js`
(`mappingChangeLockReason`, `mappingArchiveBlockReason`).

Archiving never changes or removes the related Strategic Objective, PDP
Chapter, Presidential Agenda item or Strategic Plan.

## Deleting (SPDM-298)

Users with `relations.delete` see a **Delete** action on both the Active and
Archived tabs. Delete permanently removes the mapping and its linked reference
details, and it cannot be undone. A confirmation dialog says so before
anything is removed. On an active mapping, the dialog also suggests archiving
instead when you are allowed to archive.

If the deleted mapping was selected in the reference-linking step, the
selection is cleared. The same Agenda → PDP → DOST chain can be mapped again
afterwards, and it is saved as a new mapping.

In the seeded roles, only Administrator has `relations.delete`. Planning
Officers can archive but not delete. Delete follows the same plan lock as
archive: it is unavailable on finalised, under-approval, approved or
archived plans.

## Who can archive

The **Archive** and **Restore** controls, and the **Archived** tab, appear only
for users with `relations.manage` who are not office users. They are hidden in
view-only mode (`/mappings?mode=view`) and for Office/Agency users.

## Technical notes

Mappings are still kept in browser storage (`mapping-storage.js`) until the
alignment API supports writes.

| Function | What it does |
| --- | --- |
| `archiveLocalMapping(id, session)` | Sets `status: 'archived'` and records `archived_at`, `archived_by` and `archived_by_name` |
| `restoreLocalMapping(id, session)` | Sets the mapping back to `active` and clears the archive fields |
| `listLocalArchivedMappings(planId, office)` | Lists archived mappings for a plan, newest first |
| `deleteLocalMapping(id)` | Permanently removes a mapping, active or archived |

Archiving an already-archived mapping, or restoring an active one, raises an
error. Only `deleteLocalMapping` removes data permanently.

When the backend adds archive, restore and delete endpoints, replace these
functions with API calls. The page itself only uses these functions.

Tests: `npm run test:frontend` (`tests/frontend/mapping-archive.test.mjs`,
`tests/frontend/mapping-delete.test.mjs`).
