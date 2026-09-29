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

Tests: `npm run test:frontend` (`tests/frontend/mapping-archive.test.mjs`).
