# Management interface on `codex/management-dashboard-restructure`

This branch starts from `develop` and incorporates the navigation, dashboard and read-only plan review from Meng Sun's `076dbc0` commit. Management pages open directly from the sidebar.

## What changed

- **Approve List** (`/management-approvals`) separates pending, approved and returned-for-correction plans. It lists plans within the account's authorised scope with search and pagination. Only a review assigned to the current user links to the decision page. The existing decision API performs `approve` or `reject`; the interface describes `reject` as returning the plan for correction because a rejected submission can be resubmitted.
- **Planning Module** opens the same existing plan list with distinct plan-summary and objective-summary views. Both lists are searchable and paginated. The plan review page also shows plan comments when the account has `objective_comments.create`.
- **Alignment Review** and **Agency Input Review** are separate top-level sidebar links into the existing objective API alignment summary. The agency view filters the same Agenda/PDP/objective associations by responsible office. The older `/mappings?mode=view` page uses browser-local mappings and is not the management summary.
- **Monitoring** keeps the original per-plan progress view and adds plan level, parent plan, plan search, level filtering, pagination and an expandable objective breakdown. Parent rows include objectives under child plans. It reads progress fields from the objective API.
- **Reports & Summary** presents a list of report datasets. A reviewer can open paginated rows in the page and export each complete dataset as CSV.
- Management sidebar links are flat and open their corresponding content directly. The redundant horizontal dashboard tabs were removed; the five strategic-planning KPI cards appear only in Reports & Summary.
- The existing management permission helper is retained. The local-storage-based dashboard aggregation, which was unused after the redesign, was removed.

## APIs and backend changes

- Existing APIs: `GET /api/strategic-plans`, `GET /api/strategic-objectives`, `GET /api/plan-reviews`, `GET /api/strategic-plans/{id}/approval`, `POST /api/strategic-plans/{id}/approval/decision`, and plan comment endpoints.
- A migration makes `responsible_unit_id` nullable on plan comments and grants management roles `objective_comments.create`. This lets management users comment without being assigned an agency unit. Deploying the comment feature requires applying this migration.
- The approval backend has statuses `under_approval`, `approved`, `rejected`. There is no distinct `returned` status or `return` decision. If the project needs "returned" to differ from "rejected" in workflow rules or reports, extend the schema, service, API, and tracking UI together.
- `GET /api/plan-reviews` only returns currently assigned pending submissions. The approved and returned tabs therefore show the current status of all authorised plans, not a history of decisions personally made by the current reviewer. A reviewer-specific history endpoint would be needed for that view.

## Data notes

The pages use objective `progress_percentage`, `progress_status`, `progress_updated_at`, Agenda/PDP relations, and plan `parents` supplied by the backend. They no longer derive management summaries from browser local storage. Reporting-period filters apply to Monitoring and Reports & Summary objective progress dates; alignment review always shows all authorised mappings, while plan counts include all authorised plans.

Agenda and PDP are separate objective relations in the current backend. The alignment summary lists those associations on one objective row; it cannot certify a specific Agenda → PDP pair without an explicit combined mapping relation/API.
