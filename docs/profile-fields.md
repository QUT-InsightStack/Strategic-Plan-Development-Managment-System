# Manage Profile — editable and restricted fields

Covers the self-service profile: what a signed-in user may change about their
own account, what they may not, and why.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/auth/me` | Returns the authenticated user's profile and effective permissions |
| `PUT` | `/api/auth/profile` | Updates the authenticated user's own profile |

Both sit behind `auth:api` and `auth.version`. The user is always resolved
from the JWT, never from request input, so neither endpoint can be pointed at
another account.

## Editable fields

A user may change these on their own profile.

| Field | Rules |
|---|---|
| `first_name` | string, max 255 |
| `last_name` | nullable, string, max 255 |
| `email` | valid email, max 255, unique across `tblusers` (own address ignored) |
| `mobile` | nullable, string, max 20 |
| `address` | nullable, string, max 255 |
| `gender` | nullable, boolean |
| `date_of_birth` | nullable, date, before today |
| `designation` | nullable, string, max 255 |
| `profile_picture` | nullable, string |

All fields use `sometimes`, so a partial update leaves omitted fields untouched.

## Restricted fields

These are administrator-controlled. Sending any of them to
`PUT /api/auth/profile` returns **422** with a validation error naming the
field. They are rejected rather than silently dropped, so a caller never
receives a success response for a change that did not happen.

| Field | Why | Where it is changed instead |
|---|---|---|
| `role_id` | Privilege escalation | `PUT /api/users/{user}/role` |
| `status` | Account suspension is an administrative act | `PATCH /api/users/{user}/status` |
| `password` | Requires current-password confirmation | Change password page |
| `user_id` | Identity cannot be reassigned | — |
| `auth_version` | Session invalidation is system-controlled | — |
| `email_verified_at` | System-controlled | — |
| `department` | Organisational structure | `PUT /api/users/{user}` (admin) |
| `unit` | Organisational structure | `PUT /api/users/{user}` (admin) |
| `office` | Organisational structure | `PUT /api/users/{user}` (admin) |
| `position` | Organisational structure | `PUT /api/users/{user}` (admin) |

The canonical list lives in
`App\Http\Requests\UpdateProfileRequest::RESTRICTED_FIELDS`. Update that
constant and this table together.

## `designation` vs `position`

Both hold a job title, and the distinction is deliberate:

- **`designation`** — self-service. What the user chooses to display.
- **`position`** — administrator-maintained. Part of organisational placement,
  used by the admin user search filters alongside department, unit and office.

## Auditing

A successful update writes one row to `tbllog`:

- `user_id` — the user whose profile changed (always the caller)
- `operation` — `Profile updated: <changed field names>`
- `states` — `success`

Only fields whose values actually changed are listed. A request that resolves
to no change returns 200 with `"No changes were made."` and writes no audit row.

## Response shape

`PUT /api/auth/profile` returns the user via `UserResource`, which exposes only
the profile fields listed above plus `role`. `role` is `null` for a user with
no role assigned.

`GET /api/auth/me` currently returns the model's full attribute set plus a
`permissions` array, because the sign-in flow reads role and permission data
from it. `password` and `remember_token` are excluded by the model's `$hidden`,
but the response is wider than `UserResource`. Narrowing it would change the
contract the login flow depends on, so it is left unchanged here.

## Tests

`tests/Feature/ProfileTest.php` covers:

- Page availability and authentication requirements
- Viewing own profile; password not exposed
- Valid updates, partial updates leaving other fields untouched
- Validation: invalid email, duplicate email, own email permitted, overlong designation
- Restricted fields rejected: role, status, password, organisational fields
- A user cannot update another user's record
- Audit row written on change

Run with:

```
php artisan test --filter=ProfileTest
```
