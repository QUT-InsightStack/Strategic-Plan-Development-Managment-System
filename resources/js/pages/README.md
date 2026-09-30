# Page entry structure

Every browser page entry belongs under this directory. Group entries by the role or workflow that owns the page:

- `auth/`: login and password flows
- `planner/`: plan creation, objectives, consolidation, and finalization
- `office/`: Office / Agency pages and page-specific modules
- `administrative-admin/`: reference data and template administration
- `technical-admin/`: users, roles, system settings, security, and maintenance
- `management/`: plan review and approval
- `shared/`: pages used by more than one role

Reusable UI belongs in `resources/js/components/`. API calls belong in `resources/js/api/`. Shared data and demo stores belong in `resources/js/data/`.

When adding or moving a page entry, update both its Blade `@vite` reference and the `input` list in `vite.config.js`.
