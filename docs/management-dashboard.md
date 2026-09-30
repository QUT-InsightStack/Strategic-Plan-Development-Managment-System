# Management Dashboard (SPDM-50)

The Management dashboard gives Management and Executive users one page to
monitor strategic plans, objective progress, alignment, approvals and office
performance within their assigned scope.

- Page: `/management-dashboard`
- Blade view: `resources/views/pages/management-dashboard.blade.php`
- Page script: `resources/js/pages/management/management-dashboard-app.js`
- Summaries: `resources/js/data/management-dashboard-data.js`
- Access rules: `resources/js/access/management-access.js`
- Styles: `resources/css/management-dashboard.css`

## For Management users

Management and Executive users land on the dashboard after signing in, and
**Home** in the sidebar opens it.

| Section | What it shows |
| --- | --- |
| Key figures | Plans in scope, average objective progress, alignment coverage, plans awaiting approval, and overdue or at-risk items |
| Strategic Plan status | Plans by planning status (draft or finished) and by approval status |
| Objective progress | Average reported progress and objectives by progress status (not started, in progress, blocked, completed) |
| Strategic alignment coverage | Share of active objectives mapped to the Presidential Agenda and PDP chapters |
| Inputs and consolidation | Office and agency inputs by review status, with review and consolidation rates |
| Office / Unit performance | Objectives, reporting, average progress, completions and blocked items per responsible office or unit |
| Plans awaiting approval | Current stage, assigned approver and how long each plan has waited |
| Approved, returned and rejected plans | The most recent approval outcomes and their notes |
| Overdue or at-risk items | Items that need attention (see below) |
| Management controls | Links to management tools, shown only for permissions assigned to you |

### Filters

Filter by Strategic Plan, planning period, office or unit, plan status,
objective status and approval status. Filters apply to every section at once.
**Clear filters** resets them.

### Approving plans

A **Review** button appears only on plans where you are an assigned reviewer
for the current stage; other plans are marked *View only*. It opens the plan
review page (`/strategic-plan-reviews/{id}`), where the approval decision is
recorded. The dashboard itself does not record decisions.

### Quick links

Cards link to Assigned Plan Reviews, Strategic Plans, Agenda and PDP
Alignment, Agency Input Review and Objective Progress. Each card appears only
with its permission.

### Overdue and at-risk items

Planning records do not have due dates yet, so the dashboard flags:

- **Overdue:** plans waiting 14 or more days at an approval stage, and inputs
  pending review for 7 or more days.
- **At risk:** objectives reported as blocked, and objectives with no progress
  update in 30 or more days.

You can change these limits in `RISK_THRESHOLDS`.

## Technical notes

### Access and scope

- The route requires `dashboard.view`, enforced by `routeRules` in
  `access-policy.js`.
- The page also requires a management level (`isManagementSession`):
  - the roles `Management`, `Executive`, `Management / Executive` or
    `Division Head`;
  - any role granted `management_dashboard.view`, so access can be configured
    without a code change;
  - Administrator (`*`).

  Everyone else, including Technical Administrators, is sent to
  `/access-denied`.
- Scope is enforced by the API. `/api/strategic-plans` and
  `/api/strategic-objectives` only return records inside the user's authorised
  scope, and the dashboard summarises only what they return. If the API
  refuses objectives (403), objective, alignment and unit summaries are
  reduced and a notice explains why.
- Management and Executive roles now land on `/management-dashboard` after
  sign-in instead of `/strategic-plans`.

### Controls and permissions

| Control | Permission |
| --- | --- |
| Review | Assigned reviewer for the current stage (`isSubmissionAssignedToReviewer` in `plan-approval-api.js`) |
| Manage or delete plans | `strategic_records.delete` |
| Manage or delete objectives | `strategic_objectives.delete` |
| Manage alignment mappings | `relations.manage` |
| Manage reference data | `reference_data.manage` |
| Manage user accounts | `users.manage` |
| Manage roles and permissions | `roles.manage` |
| Edit planning content | `strategic_records.update` |

Technical security, system configuration, backup, restore and maintenance
screens are never linked from this dashboard.

### Data sources

| Data | Source |
| --- | --- |
| Plans | `GET /api/strategic-plans` (all pages, 100 per page, up to 1,000) |
| Objectives | `GET /api/strategic-objectives` (same paging) |
| Plan approval status | `approval_status` on each plan |
| Current stage and history | `GET /api/plan-reviews` (submissions assigned to you) |
| Agency inputs, progress updates | `data/office-demo-storage.js` (browser storage, frontend demo) |
| Alignment mappings | `mapping-storage.js` (browser storage, frontend demo) |

All summaries are pure functions in `management-dashboard-data.js`. Building
the dashboard only reads records; the page writes nothing.

When backend endpoints exist for inputs, progress and mappings,
replace the browser-storage readers in `loadDashboardData`. The summary
functions will not need to change.

### Tests

```
npm run test:frontend
```

The tests in `tests/Frontend/management-dashboard.test.js` cover:

- the summaries and filters, and that building the dashboard does not change
  the loaded records;
- management access checks.
