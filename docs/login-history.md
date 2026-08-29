# Login history

Records every sign-in attempt and shows it two ways: to the person whose
account it is, and to administrators across all accounts.

## Why a separate table

`tbllog` could not hold this. Its `user_id` is `NOT NULL` with a foreign key,
so an attempt against an address matching no account — the shape a
credential-stuffing run takes — cannot be stored there at all. Login events
also carry fields no other log entry needs: the address the attempt came from
and the agent it was made with.

Before this change, **successful logins were not recorded anywhere** and
failed ones were not either. Only `logout` wrote a row.

## `tbllogin_history`

| Column | Notes |
|---|---|
| `login_history_id` | Primary key |
| `user_id` | Nullable — null when the address matched no account |
| `email` | The address used, so a failed attempt still shows the target |
| `outcome` | `success` or `failed` |
| `reason` | `invalid_credentials`, `unknown_email`, `inactive_account`; null on success |
| `ip_address` | 45 characters, enough for IPv6 |
| `user_agent` | Raw agent string, capped at 1000 characters |
| `created_at` | When the attempt happened |

Indexed on `(user_id, created_at)`, `(outcome, created_at)` and
`(email, created_at)` — the three ways the table is read.

## What the caller is told

`reason` exists for the log only. `AuthController::login()` returns the same
generic message whichever way an attempt failed, so the response cannot be
used to work out whether an address has an account. A test asserts the two
messages are identical.

Only credential failures reach the log. A malformed request is rejected by
`LoginRequest` validation before the controller runs, so nothing is recorded
— which also means a password accidentally typed into the email field is
never stored.

Recording is best-effort: if the write fails it is reported to the
application log and swallowed, because a logging problem must never stop
somebody signing in.

## Endpoints

```
GET /api/login-history/me   own history      authenticated
GET /api/login-history      all accounts     logs.view
```

Both sit behind `auth:api` and `auth.version`.

`me` takes the account from the token and never from a parameter, so it
cannot be aimed at anyone else. It accepts `limit` (1–50, default 10) and
returns a `meta.recent_failures` count of failed attempts in the last 30
days.

The full list accepts `user_id`, `outcome`, `search` (matches the email),
`from`, `to` (both `Y-m-d`) and `per_page` (1–100, default 15). `to` must be
on or after `from`.

### Response codes

| Code | Meaning |
|---|---|
| `200` | History returned |
| `401` | Not authenticated, or the token's `auth_version` is stale |
| `403` | The full list without `logs.view` |
| `422` | Invalid filter — a bad date format, or `to` before `from` |

### Shape

```json
{
  "login_history_id": 41,
  "email": "jane@example.com",
  "outcome": "failed",
  "reason": "invalid_credentials",
  "ip_address": "203.0.113.9",
  "device_label": "Chrome on Windows",
  "user_agent": "Mozilla/5.0 …",
  "user": { "user_id": 3, "name": "Jane Doe" },
  "created_at": "2026-08-29T09:14:02.000000Z"
}
```

`user_agent` and `user` are only present in the administrator view. Someone
reading their own history gets `device_label` alone — the short form is
enough to answer "was that me?", and they already know who they are.

`device_label` is derived from the agent string by a deliberately rough
match (`Chrome on Windows`, `Safari on iOS`). It is a recognition aid, not
device fingerprinting, and returns null when it cannot tell.

## The two views

**Profile → Recent sign-ins.** The last five attempts with time, address and
device, plus a warning when there have been failed attempts on the account in
the last 30 days. No permission needed — everyone is entitled to see where
their own account has been used.

**Technical Admin → Login History** (`/login-history`). Every account,
filterable by user, outcome, email and date range, paginated. Attempts on an
address with no account appear as "Unknown account", which is the point.

## Retention

Login history ties a named person to an IP address and a time, so it is
personal data and is not kept indefinitely.

```
php artisan login-history:prune --days=90
```

Deletes entries older than the given period; 90 days is the default, and the
command refuses anything under a day. **It is not scheduled** — add it to
`routes/console.php` with a retention period the project has actually agreed
on, rather than inheriting whatever this default happens to be.

## Tests

`tests/Feature/LoginHistoryTest.php` covers recording of successes, wrong
passwords, unknown addresses and suspended accounts; that the response does
not reveal which; that the client address is captured; own-history access,
its isolation from other accounts, the failure count and the omitted agent
string; the permission on the full list, its filters and date validation; and
pruning in both directions.

```
php artisan test --filter=LoginHistoryTest
```
