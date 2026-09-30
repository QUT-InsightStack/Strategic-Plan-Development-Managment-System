# Archiving strategic alignment mappings (SPDM-295)

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

Archiving an already-archived mapping, or restoring an active one, raises an
error. Nothing is hard-deleted.

When the backend adds archive and restore endpoints, replace these three
functions with API calls. The page itself only uses these functions.

Tests: `npm run test:frontend` (`tests/Frontend/mapping-archive.test.js`, `tests/Frontend/mapping-eligibility.test.js`).
