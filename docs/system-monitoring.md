# System activity monitoring

## Applying the update

For a new database, apply the initialization migrations and the three
access-control seeders below. Migrations have been consolidated into a fresh
baseline; see [database initialization](database-initialization.md) before working
with an existing installation whose migration history predates consolidation.

```console
php artisan migrate
php artisan db:seed --class=RolesSeeder
php artisan db:seed --class=PermissionSeeder
php artisan db:seed --class=RolePermissionSeeder
php artisan config:clear
```

These seeders update roles and permissions without running `UsersSeeder` or resetting accounts.
`Technical Administrator` is the canonical technical role. Existing `Technical Admin`
roles also receive the technical permissions. `Administrator` retains full access;
planning and viewer roles do not receive system monitoring or login-history access.
Sign in again to refresh the browser's cached permissions.

Existing audit rows remain unchanged. Reads recognize plain event names and the
legacy JSON `operation.event` format. A legacy `states=failed` or `failure` is
returned and filtered as `outcome=failure`, including backup failures previously
saved with the default `success`. New backup records store the event name in
`operation`, identifiers in the resource fields, and details in `metadata`.

## Login history contract

`GET /api/login-history` requires `login_history.view`. Its filters are `status`
(`success` or `failed`), `date_from`, `date_to` (YYYY-MM-DD in application timezone),
`user_id`, `email`, `ip_address`, `search`, `page`, and `per_page` (maximum 100).
Either date boundary may be provided independently. Responses use `status`,
`attempted_at`, `failure_reason`, and the historical `user_name` snapshot.

Recorded failure reasons include `invalid_credentials`, `unknown_email`,
`inactive_account`, `account_locked`, and `rate_limited`. Failed attempts that
trigger a lock, subsequent attempts against a locked account, and throttled
requests each produce one history row. Internal reasons stay in the protected
history; ordinary invalid-credential responses remain generic.

## Monitoring API

All endpoints below require a valid API session and `system_monitoring.view`:

| Endpoint | Response |
| --- | --- |
| `GET /api/system-monitoring/summary` | Request totals, HTTP 5xx error rate, HTTP 4xx count, slow requests, database timing, failed logins/backups, latest check and scheduler freshness |
| `GET /api/system-monitoring/requests` | Paginated request measurements; optional `status_code`, `request_id`, `slow=1` |
| `GET /api/system-monitoring/health` | Live database, cache round-trip, storage writability and queue checks; HTTP 503 for an unhealthy dependency |
| `GET /api/system-monitoring/checks` | Paginated check snapshots, detected issues and recovery history |
| `GET /api/system-monitoring/events` | Paginated operational events; exact `severity`, `source`, `event`, `outcome`, `request_id`, and `status_code` filters |
| `GET /api/system-monitoring/events/{id}` | One operational event; 404 if absent |
| `GET /api/system-monitoring/alerts` | Alert episodes, optionally filtered by `status=open\|resolved` and `severity` |
| `GET /api/system-monitoring/trends` | Hourly request/error/timing aggregates retained after raw measurements expire |

Summary/list windows accept `minutes=1..1440` (default 15). Lists accept `page`
and `per_page=1..100` and return Laravel paginator fields (`data`, `total`,
`current_page`, etc.). The summary includes `scheduler_stale=true` when no
snapshot exists or the latest is older than three minutes. Check timestamps
and window bounds are returned explicitly. Application timestamps use UTC.
Summary, requests, checks, events and trends also accept `from` / `to` timestamps
(ISO 8601 recommended). Bounds are inclusive; an omitted start is `minutes`
before the end, and an omitted end is now. Alerts default to all retained episodes.
Event severities are `info`, `warning`, `error`, `critical`; outcomes are
`success`, `failure`, `denied`. Event details include `event`, `source`, `severity`,
`outcome`, `occurred_at`, `request_id`, and a safe `context` object.

The HTTP middleware records API requests after the response is rendered,
including rejected and failed requests. It returns a generated `X-Request-ID`
and correlates reported exceptions with that ID. Database timing is cumulative
query execution time during the request, not a separate slow-query trace.
Request duration measures application processing and excludes response transfer
and the subsequent metrics write.
Monitoring endpoints and `/up` are excluded from request metrics.

The request table stores route templates, method, status, durations, query
count and exception class. It does not store request bodies, headers, query
strings, SQL bindings, exception messages, stack traces, or job payloads.
Every HTTP 4xx/5xx and threshold-exceeding successful request also emits an event.
Login successes/failures, lockouts, throttling, backup operations, failed queue
jobs, caught authentication delivery/refresh exceptions and alert transitions
are recorded. One HTTP event represents a request that is both slow and failed;
an associated domain event may share its request ID. Reported exceptions outside
the measured API pipeline produce an `application.exception` event.
Telemetry write failures preserve the business response and emit safe metrics
to stderr. A deployment's process manager should retain stderr output.

Queue measurements cover the default configured database queue: total jobs,
ready jobs, oldest ready wait, and recent failures. Delayed and unexpired
reserved jobs do not count as ready. Nonpersistent queue drivers are marked
`not_applicable`; other queue drivers are explicitly `unsupported` and produce
a warning until an adapter is added.

## Scheduled detection and retention

```console
php artisan monitoring:check
php artisan schedule:list
```

Run Laravel's scheduler every minute in deployment. On Windows, configure
Task Scheduler to run `php artisan schedule:run` every minute with the project
as its working directory. On Linux, use the equivalent once-per-minute cron
entry. The existing database queue also needs its usual queue worker.

`monitoring:check` runs every minute without overlapping. It stores a snapshot
and detects unhealthy dependencies, queue backlog/failures, HTTP error-rate
increases, slow HTTP/database requests, repeated failed logins, and failed
backups. A separate detector counts consecutive failures for the same email
since its last successful attempt in the window. Changes and recoveries are
logged once per transition. Exit code is 0 for healthy/disabled and 1 for warning/critical.

`tblsystem_alerts` uses a unique active condition key to deduplicate an open
episode. Rechecks update its occurrence count and last-seen time. Recovery closes
the episode; recurrence creates a new one. Missing metrics never resolve a
metric-based alert. Mail is opt-in: configure the existing Laravel mail transport,
set `MONITORING_MAIL_ENABLED=true` and `MONITORING_MAIL_TO` to comma-separated
operator addresses. Opening/recovery notifications are sent synchronously so a
queue outage does not block dispatch. Failed sends are retried on subsequent
checks and recorded as operational events. Delivery is at least once: a crash
after provider acceptance but before the notification marker commits may repeat
a message. No email is sent by default or by the automated tests.

`/up` returns 500 when a checked dependency is unhealthy. Queue backlog warnings
remain visible in the monitoring API without failing `/up`. Use an external
uptime checker for `/up`: the application and its database-backed scheduler
cannot independently detect a complete application/database outage. When
`monitoring:check` can run but persistence is unavailable, its JSON output and
stderr include a critical status and `persisted=false`.

Defaults in `config/monitoring.php`:

| Environment variable | Default |
| --- | --- |
| `MONITORING_ENABLED` | `true` |
| `MONITORING_SLOW_REQUEST_MS` | `2000` |
| `MONITORING_SLOW_DATABASE_MS` | `500` |
| `MONITORING_ERROR_RATE_PERCENT` | `5` |
| `MONITORING_MINIMUM_REQUESTS` | `20` |
| `MONITORING_FAILED_LOGIN_THRESHOLD` | `10` |
| `MONITORING_CONSECUTIVE_LOGIN_THRESHOLD` | `5` |
| `MONITORING_QUEUE_BACKLOG_THRESHOLD` | `100` |
| `MONITORING_QUEUE_WAIT_SECONDS` | `300` |

The detector uses a 15-minute window. `monitoring:prune` runs daily in batches of
1,000. Age cutoffs use the start of the UTC day; an open alert is never pruned.

| Environment variable | Default days | Action |
| --- | --- | --- |
| `MONITORING_REQUEST_RETENTION_DAYS` | 14 | Aggregate expired hours, then delete raw requests |
| `MONITORING_CHECK_RETENTION_DAYS` | 30 | Delete expired dependency snapshots |
| `MONITORING_EVENT_RETENTION_DAYS` | 90 | Delete expired operational events |
| `MONITORING_TREND_RETENTION_DAYS` | 365 | Delete expired hourly aggregates |
| `MONITORING_ALERT_RETENTION_DAYS` | 365 | Delete episodes resolved before the cutoff |
| `MONITORING_AUDIT_ARCHIVE_DAYS` | 0 | Keep all audits online; positive values enable archival |
| `MONITORING_LOGIN_ARCHIVE_DAYS` | 0 | Keep all login history online; positive values enable archival |

Hourly aggregates (`tblsystem_metrics`) contain counts and timing sums/maxima.
Compute average duration as `duration_ms / requests` and error percentage as
`100 * server_errors / requests`; never average averages across buckets. Checks
refresh the current and preceding hour; pruning backfills missed older buckets
before removing raw data. Repeated aggregation replaces a bucket, and an empty
raw bucket never overwrites retained history. Buckets are finalized before
pruning, so an interrupted batch cannot replace the complete total with a partial
one on retry. Sparse historical periods are skipped using the timestamp index.
Summary and request queries use retained raw measurements; use the trends endpoint
for older aggregate history.

`monitoring:archive`, also called by daily pruning, copies audit/login rows into
`tblaudit_archives` before removing online originals, in transactions of 500.
The archive includes the original table, ID, timestamps and complete unmodified
raw record, including legacy JSON. A copy failure rolls back that entire batch.
Archives have no expiry and no foreign key to mutable user accounts. Online APIs
search `tbllog` / `tbllogin_history`; archived records require authorized database
access and are not exposed through the lower-privilege monitoring API. Choose
positive archive horizons only after agreeing the required online search period.
The default preserves the full existing API history. Include the archive table in
database backups. Migration rollback refuses to discard a populated archive.

## Audit writer and indexes

Business services use `StrategicLogWriter` / `StrategicAuditLogWriter`. Pass a
stable dotted event, `actor_user_id`, `resource_type`, `resource_id`, `outcome`,
and safe additional metadata. Explicit null actors represent system actions.
The writer resolves the matching actor name snapshot and attaches the server
request ID. Updated services no longer embed JSON or prose in `operation`.
Legacy JSON reads stay compatible; they do not rewrite prior audit evidence.

Event indexes cover time/ID, severity/time/ID, source/time/ID and event/time.
Audit date filtering uses `>= start` and `< next day` instead of wrapping the
indexed timestamp in a date function. SQLite query-plan tests verify that the
event and audit range queries use these indexes without a temporary event sort.
Legacy JSON/outcome compatibility expressions still require evaluating candidate
rows; use a time window when querying a large legacy corpus.

Run the read-only command against the deployed database to inspect its optimizer:

```console
php artisan monitoring:explain
```

Local verification uses SQLite. MySQL execution plans depend on deployment data
and must be checked there; the command does not run migrations or mutate rows.

## Verification

```console
php artisan test
npm run test:frontend
npm run build
```

The PHPUnit configuration uses an isolated SQLite in-memory database. If the
SQLite DLLs are installed but disabled on Windows, run PHP with temporary
`-d extension=pdo_sqlite -d extension=sqlite3` options when invoking PHPUnit.
The audit create migration includes its complete schema and retains the
MySQL text-prefix index where required. Backup tests use a separate temporary
storage directory for each test.
