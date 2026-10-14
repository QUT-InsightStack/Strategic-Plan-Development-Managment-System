# Frontend navigation and data boundaries

## Ownership

- `access/navigation.js` defines the five role workspaces, canonical destinations, permission requirements and planned features.
- `components/AppSidebar.js` renders that registry. Technical and Administrative sidebar modules are compatibility re-exports, not separate menu definitions.
- `pages/shared/dashboard-app.js` renders role function cards and explicit placeholders. The Management dashboard retains its existing implementation.
- Administrative Admin, Planning Officer, Office / Agency and Management workspaces are grouped by planning stage (see *Role workspaces* below). Technical Admin is unchanged.
- `access/mount-protected-page.js` refreshes `/api/auth/me` before mounting the migrated administration and plan/objective registers. Existing independently bootstrapped Office/Management pages remain intact.
- The backend remains authoritative for authorization and record scope. A visible placeholder or menu entry never grants API access.

Keep page entries in their existing role directories. Shared UI belongs in `components`, API adapters in `api`, and browser-only storage in `data` or the existing mapping storage module. Update Blade and Vite inputs only when adding a browser entry, not for imported components.

## Canonical destinations

| Function | Destination |
| --- | --- |
| Role workspace | `/dashboard` |
| Management dashboard | `/management-dashboard` |
| Monitoring Dashboard / Reports for planning, office and administrative roles | `/monitoring-dashboard`, `/monitoring-dashboard?tab=reports` |
| Real account management | `/user-management` |
| Role assignment | `/role-management` |
| Role permission settings | `/role-management?section=permissions` |
| Office plan review and plan-level comments/proposals | `/office` |
| Office document/video upload | `/office?view=inputs` |
| Shared objective progress | `/office?view=progress` |
| Input status / consolidation | `/consolidate-inputs` |
| Mapping / read-only mapping | `/mappings` / `/mappings?mode=view` |
| Management plan review | `/management-plan-review` |
| Approval list | `/management-approvals` (`/strategic-plan-reviews` redirects here) |

Old `view=agency-input` upload links normalize to `view=inputs`, retaining the selected plan. Existing objective comments and local comment history remain in clearly labeled expandable compatibility sections. The previous generic dashboard is accessible through `/dashboard?view=legacy`.

The legacy `/office?view=mapping` and `view=alignment` previews remain readable with a link to the current mapping page. The old mapping form has no working mapping-save integration; its controls are disabled rather than submitting misleading objective proposals.

Standard functions without an implemented screen have a `/dashboard?feature=...` placeholder. Missing permissions produce a disabled `No access` entry; additional nonstandard capabilities are hidden if unauthorized. Do not hide implemented forms merely because the API returns no records.

## Role workspaces

Each role's sidebar groups and `/dashboard` home cards follow the planning stages below, in this order. Entries keep their existing permission requirements; without permission a card shows *No access*. When a stage lists another name for a page that is already in the sidebar, that entry is `dashboardOnly`: it appears as a home card with a short explanation, but not twice in the sidebar. A stage whose entries are all `dashboardOnly` therefore appears only on the home page.

| Role | Stages |
| --- | --- |
| Administrative Admin | Planning reference-data preparation (Administrative Dashboard, Presidential Agenda, PDP Chapters, Reference Data) · Planning-template preparation (Template Management) · Administrative monitoring (Monitoring Dashboard, Reports, System Logs) · then the existing Strategic Planning, Strategic Alignment, Progress Monitoring and Assigned Approvals groups |
| Planning Officer | Initial strategic-plan creation · Strategic foundation development · Strategic-objective development · Strategic alignment mapping · Office/Agency input collection · Office/Agency input consolidation · Strategic-plan finalization · Approval submission · Implementation monitoring (Objective Progress Monitoring, Monitoring Dashboard, Reports) · Reviews |
| Office / Agency | Initial strategic-plan review · Planning-input submission (Planning Inputs, Proposed Objectives, Comments) · Agency-level strategic mapping (read-only `/mappings?mode=view`) · Input-processing status review · Assigned-objective progress updates (incl. Edit Objectives) · Agency implementation monitoring (Monitoring Dashboard, Reports) |
| Management / Executive | Strategic-plan approval preparation · Strategic-plan review · Strategic-alignment review · Strategic-plan approval · Implementation oversight — all open the existing Management Dashboard tabs and Plan Review |

`/dashboard` is the first card of the first stage for these roles (Management keeps `/management-dashboard` as home). `/monitoring-dashboard` renders the Management Dashboard page for any account with `strategic_records.view` or `reports.view`: only the Overview and Reports tabs, each gated by permission, with data scoped by the backend. My Pending Actions appears there only for users with a plan review assigned to them.

## Data sources

- Plans, objective progress, uploads, live comments/proposals, account administration and approval workflows use existing APIs. Errors must remain visible; do not replace failed API data with local examples.
- The mapping editor still stores mapping links/reference selections in the browser. Its notice distinguishes these from remotely loaded plans/objectives/PDP chapters and remote responsible-unit assignments. This cleanup does not implement database mapping persistence.
- `legacy-office-comments.js`, `legacy-office-updates.js` and the compatibility `office-api.js` preserve existing local demo history. They do not represent shared submissions.
- Backend comment tables, permissions and record scope must already be configured. No backend migrations or permission grants are performed by this frontend cleanup.

## Why screens appeared to disappear

Multiple sidebar definitions and duplicate URLs selected different components. Old local demos shared names with API-backed pages. Cached permissions could disagree with a freshly loaded menu. Empty lists removed entire forms. Unresolved merge markers broke the Office comments module, and previously built assets could lag behind source edits.

## Validation and builds

Run `npm run test:frontend` and `npm run build`. Build/dev scripts use Vite's native configuration loader to avoid the configuration bundling subprocess that failed in this Windows environment. This is not a universal fix for locked native files or every possible EPERM error.

After pulling changes, rebuild assets or restart Vite. Test each role with its real account, checking an allowed page, a disabled permission, an empty result, and an API error. Do not treat a successful build or mocked frontend tests as proof of database permissions or end-to-end submissions.

## Strategic objective workflow

- `/strategic-objectives` is a plan chooser only. It has no create/edit/archive/delete implementations.
- `/strategic-plans/{id}/objectives` renders the original plan-scoped page, using `strategic-objectives-app.js` and `strategic-objectives.css`.
- Legacy `?plan_id=...&edit=...` or `&create=1` links redirect in the chooser to that canonical page. Plan creation and editing link there directly.
- Target and Responsible Office/Agency use existing objective fields. Notes/Comment uses the existing plan Description/Notes field, not a new comment store.
- Each objective form saves immediately. Save as a draft saves plan notes only for editable drafts, preserving current MVC, dates, and title through the existing update API. Finished plans cannot be reset to draft here.
- Next: Strategic Mapping saves changed draft notes first and navigates to `/mappings?plan_id=...`. Mapping retains the selected plan and does not silently switch to another plan if it is unavailable.
- The obsolete cross-plan editor and its dedicated list stylesheet were removed; progress, assignment, review, archive/restore, and delete remain available on the single plan-scoped page.
