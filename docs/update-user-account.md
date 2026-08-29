# Update User Account — administrator guide and API reference

How an administrator updates another user's account, which fields they may
change, and which are handled elsewhere.

## Endpoint

```
PUT   /api/users/{user}
PATCH /api/users/{user}
```

Middleware: `auth:api`, `auth.version`, `permission:users.update`.
`UpdateUserRequest` additionally requires the `users.update` permission, so the
check is enforced in both the route and the request.

## Editable fields

All use `sometimes`, so a partial payload leaves omitted fields untouched. The
admin UI sends only the fields the administrator actually changed.

| Field | Rules |
|---|---|
| `first_name` | string, max 255 |
| `last_name` | nullable, string, max 255 |
| `email` | valid email, max 255, unique across `tblusers` (target's own address ignored) |
| `password` | string, min 8, max 128 — hashed by the model on save |
| `mobile` | nullable, string, max 20 |
| `address` | nullable, string, max 255 |
| `gender` | nullable, one of `female`, `male`, `non_binary`, `prefer_not_to_say` |
| `date_of_birth` | nullable, date, before today |
| `profile_picture` | nullable, string, max 255 |
| `department` | nullable, string, max 255 |
| `unit` | nullable, string, max 255 |
| `office` | nullable, string, max 255 |
| `position` | nullable, string, max 255 |

### Gender

Stored as a code, not a label, so the wording on screen can change without a
migration. The accepted set lives in
`App\Validation\UserValidationRules::GENDERS` and must stay in step with
`GENDER_OPTIONS` in `resources/js/pages/user-management-app.js`.

| Code | Shown as |
|---|---|
| `female` | Female |
| `male` | Male |
| `non_binary` | Non-binary |
| `prefer_not_to_say` | Prefer not to say |
| `null` | Not specified |

This column was a `boolean` until it became clear that nothing in the
application had ever defined which value meant what — no mapping, no seeder,
no screen that read or wrote it. Rather than guess, the migration to a string
clears any pre-existing value. See
`2026_08_29_000004_change_gender_to_string_on_tblusers_table.php`.

### Date of birth

Sent and returned as `YYYY-MM-DD`. Must be before today. Clearing it sends
`null` — an empty string is not a valid date and is rejected.

## Restricted fields

Sending either returns **422** naming the field. They are rejected rather than
ignored, so a caller never gets a success response for a change that did not
happen.

| Field | Why | Approved operation |
|---|---|---|
| `role_id` | Role assignment applies privilege-escalation and protected-role checks | `PUT /api/users/{user}/role` |
| `status` | Status changes block self-suspension, protect the last administrator, and increment `auth_version` so existing sessions are invalidated | `PATCH /api/users/{user}/status` |

`role_id`, `status` and `auth_version` are also stripped in
`UserService::updateByAdministrator`, so an internal caller cannot bypass the
request layer.

> **Note:** `status` was previously accepted by this endpoint. That allowed an
> administrator to suspend an account — including the last administrator, or
> their own — without the safeguards above, and without invalidating the
> suspended user's existing session. It is now rejected.

## Protected accounts

A user whose role has `is_protected = true` may only be updated by an
administrator whose role also holds `roles.assign_protected`. Otherwise the
request returns **403**.

This mirrors the rule `UserRoleService` applies when assigning protected roles,
so the same accounts are shielded consistently across both operations.

## Response codes

| Code | Meaning |
|---|---|
| `200` | Updated. Body contains `success`, `message` and `data` (a `UserResource`) |
| `401` | Not authenticated, or the token's `auth_version` is stale |
| `403` | Missing `users.update`, or target holds a protected role and the caller lacks `roles.assign_protected` |
| `404` | Target user does not exist |
| `422` | Validation failed, including any attempt to set a restricted field |

### Success body

```json
{
  "success": true,
  "message": "User updated successfully.",
  "data": {
    "user_id": 12,
    "name": "Jane Doe",
    "first_name": "Jane",
    "last_name": "Doe",
    "email": "jane@example.com",
    "department": "Planning",
    "unit": "Strategy",
    "office": "Head Office",
    "position": "Analyst",
    "status": "active",
    "profile_picture": null,
    "role": { "role_id": 3, "role_name": "Planner" },
    "created_at": "...",
    "updated_at": "..."
  }
}
```

The response is shaped by `UserResource`, so `password`, `remember_token` and
`auth_version` are never returned.

## Auditing

A successful update writes one row to `tbllog`:

- `user_id` — the **acting administrator**, not the target
- `operation` — JSON: `{"event":"user.account_updated","target_user_id":12,"fields":["first_name","department"]}`
- `states` — `success`

Only field *names* are recorded, never submitted values, so a password change
is auditable without the value appearing in the log. `updated_at` on the user
record provides the updated-date; the acting administrator is captured here
rather than as a column on `tblusers`.

A request that resolves to no change returns 200 and writes no audit row.

## Administrator UI

User Management → **Edit** on any row.

- The form is pre-filled with the user's current details.
- Editable fields: first name, last name, email, mobile, date of birth,
  gender, address, office, department, unit and position. Each input's maximum length matches the server
  rule, so it stops accepting input where the API would reject it.
- Role and account status are shown read-only with a lock icon and a note
  pointing to the action that changes them.
- Save is disabled until something changes, and only changed fields are sent.
- Closing or cancelling with unsaved changes asks for confirmation; navigating
  away from the page triggers the browser's own warning.

`designation` is not editable here. It is the user's own self-managed field
(see `docs/profile-fields.md`); `position` is the administrator-controlled
equivalent. Sending `designation` to this endpoint is ignored rather than
rejected, since it carries no validation rule.

### Errors

Validation errors appear under the field they belong to, with `aria-invalid`
and `aria-describedby` linking the input to its message.

Failures that belong to the request rather than a field — 403 on a protected
account, 404 for a deleted user — appear as a banner at the top of the form,
marked `role="alert"`. The dialog stays open so entered values are not lost.

### Keyboard and assistive technology

- Focus moves to the first editable field when the dialog opens.
- Tab and Shift+Tab cycle within the dialog rather than reaching the table
  behind the overlay.
- Escape closes the dialog, applying the same unsaved-changes confirmation as
  Cancel.
- Focus returns to the row's Edit button on close.

This behaviour lives in `resources/js/components/use-dialog-behaviour.js` and
is shared with the Create Account dialog on the same page.

## Tests

`tests/Feature/UserUpdateTest.php` covers authentication and permission checks,
successful and partial updates, missing users, email validation and uniqueness,
rejection of `role_id` and `status`, protected-account rules in both directions,
isolation between users, auditing, and that updates surface in search.

```
php artisan test --filter=UserUpdateTest
```
