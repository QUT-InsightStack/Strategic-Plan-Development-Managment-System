# System Activity page (SPDM-278)

The System Activity page lets Technical Administrators monitor how the system is
running. It covers service health, request performance, errors, failed sign-ins,
failed backups and alerts. It is the frontend for the SPDM-66 monitoring API
described in `docs/system-monitoring.md`.

- Page: `/system-monitoring`, listed as **System Activity** under
  **Security Management** in the Technical Admin sidebar
- View: `resources/views/pages/system-monitoring.blade.php`
- Page script: `resources/js/pages/technical-admin/system-monitoring-app.js`
- API client: `resources/js/api/system-monitoring-api.js`
- Formatting and status logic: `resources/js/data/system-monitoring-data.js`
- Styles: `resources/css/system-monitoring.css`

## Access

The route and the sidebar entry both require `system_monitoring.view`. The API
also checks this permission on every endpoint.

Roles that get the permission from the SPDM-66 seeders:

- Technical Administrator
- Technical Admin
- Administrator

Users without it are sent to `/access-denied`.

## What the page shows

| Section | Source | Notes |
| --- | --- | --- |
| Status banner | `/health` + `latest_check` from `/summary` | Shows the worst current status and lists detected issues. It warns when scheduled checks have not run in the last 3 minutes (`scheduler_stale`) or when collection is turned off. |
| Key figures | `/summary?minutes=` | Requests, server error rate, client errors, average and slowest response, slow requests, database time, failed sign-ins and failed backups. Warning colours use the thresholds the server returns. |
| Service health | `/health` | Database, cache, storage and queue, with response time and queue backlog. A `503` response is still shown, because it carries the check results. |
| Alerts | `/alerts` | Open alerts by default. **Include resolved** shows history. |
| Activity over 24 hours | `/trends?minutes=1440` | Hourly requests and server errors. Hover a bar for details, or use **Show table** for an accessible table. Averages are `duration_ms / requests`. |
| Activity events | `/events` | Filter by severity, source, outcome and event code, 15 per page. **View** opens the event with its recorded details. |
| Recent API requests | `/requests` | Filter by response code or **Slow only**. Timings over the server thresholds are highlighted. |

The time period selector (15 minutes to 24 hours) applies to key figures, events
and requests. The page refreshes every 30 seconds while it is visible. You can
turn this off or refresh manually.

## States

- **Loading:** placeholder blocks on first load. The Refresh button spins
  during later refreshes.
- **Empty:** each section explains when nothing was recorded or nothing
  matches the filters.
- **Partial failure:** each section reports its own error with **Try again**.
  The rest of the page stays usable.
- **Service missing:** if the SPDM-66 backend is not deployed, the API returns
  404 and the page says the monitoring service is not available on this server
  yet.
- **Validation:** an invalid event code shows a field error. Codes use
  lowercase letters, dots and underscores only.

The page is read-only. It never writes monitoring or audit data.

## Tests

```
npm run test:frontend
```

`tests/Frontend/system-monitoring.test.js` covers:

- issue labels;
- overall status, including a stale scheduler;
- key-figure thresholds;
- trend aggregation;
- health rows;
- formatting helpers.
