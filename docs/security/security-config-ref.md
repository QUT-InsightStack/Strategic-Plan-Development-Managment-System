# SPMS Security Configuration Reference

**Standard Reference:** ITD Security Standard §11.14
**Purpose:** Human-readable record of all security-relevant configuration
values for audit purposes. No secrets are recorded here.
**Last Updated:** April 2026

This document records the *settings* and *policies*, not the secret
values themselves. Secret values (APP_KEY, JWT_SECRET, DB_PASSWORD)
are stored exclusively in the .env file on each deployment environment.

---

## 1. Application Environment Settings

| Setting | Development Value | Production Value | Config File |
|---|---|---|---|
| `APP_ENV` | `local` | `production` | `.env` |
| `APP_DEBUG` | `true` | **`false`** | `.env` |
| `APP_URL` | `http://localhost` | `https://spms.dost.gov.ph` | `.env` |

**Critical:** `APP_DEBUG=true` in production leaks stack traces,
file paths, and environment variables to the browser. It must never
be `true` on a production or staging server.

---

## 2. HTTPS / TLS Configuration

### Laravel Application Layer
| Setting | Value | Location |
|---|---|---|
| Force HTTPS scheme | `URL::forceScheme('https')` in production | `AppServiceProvider.php` |
| Environment guard | Only activates when `APP_ENV=production` | `AppServiceProvider.php` |

### Web Server Layer (Production — Nginx)
| Setting | Value |
|---|---|
| HTTP port 80 behaviour | 301 permanent redirect to HTTPS |
| HTTPS port | 443 |
| Minimum TLS version | TLS 1.2 |
| Disabled protocols | TLS 1.0, TLS 1.1, SSLv3 |
| Certificate type | Let's Encrypt (auto-renewing) |
| HSTS header | `max-age=31536000; includeSubDomains` |
| Certificate renewal | `certbot renew` via cron — runs twice daily |

**Reference:** ITD Security Standard §10.1, §10.2, §10.3

---

## 3. CORS Configuration

**File:** `config/cors.php`

| Setting | Value | Reason |
|---|---|---|
| Paths covered | `api/*` | API routes only |
| Allowed origins | Read from `FRONTEND_URL` env variable | Never hardcoded |
| Development origin | `http://localhost:5173` | Vite dev server |
| Production origin | `https://spms.dost.gov.ph` | Set in production `.env` |
| Wildcard `*` origin | **Never used** | Disables credential-based protection |
| Allowed methods | `GET, POST, PUT, PATCH, DELETE, OPTIONS` | Standard REST verbs |
| Allowed headers | `Content-Type, Authorization, X-Requested-With, Accept` | API operation |
| `supports_credentials` | `true` | Required for HttpOnly cookie JWT |
| Preflight cache (`max_age`) | `86400` (24 hours) | Reduces OPTIONS requests |

**Why `supports_credentials: true` is required:** Without this, the
browser strips HttpOnly cookies from cross-origin requests. The JWT
cookie would never be sent with API requests, breaking authentication
entirely.

**Reference:** ITD Security Standard §5.3, §5.17

---

## 4. JWT Authentication Configuration

**File:** `config/jwt.php`
**Package:** `tymon/jwt-auth`

| Setting | Value | Notes |
|---|---|---|
| Algorithm | `HS256` | HMAC SHA-256 — symmetric signing |
| Access token lifetime (`ttl`) | `30` minutes | Read from `JWT_TTL` env var |
| Refresh token lifetime (`refresh_ttl`) | `10080` minutes (7 days) | Read from `JWT_REFRESH_TTL` env var |
| Token blacklist | **Enabled** | Required for logout to function |
| Blacklist grace period | `0` seconds | No window for reuse after invalidation |
| JWT secret | **Not recorded here** | Stored in `.env` as `JWT_SECRET` |

**Token storage decision:** JWT tokens are stored in **HttpOnly cookies**
only. They are never:
- Returned in the JSON response body
- Stored in localStorage or sessionStorage
- Passed as URL query parameters

This decision prevents XSS attacks from stealing the token via
JavaScript. Reference: ITD Security Standard §5.11, §5.18

### Cookie Flags Applied to JWT Cookie

| Flag | Development | Production | Effect |
|---|---|---|---|
| `HttpOnly` | ✅ true | ✅ true | JS cannot read the cookie |
| `Secure` | false | **true** | Cookie only sent over HTTPS |
| `SameSite` | `Lax` | `Lax` | Protects against CSRF on cross-site navigation |
| `Path` | `/` | `/` | Cookie sent with all requests |

**`Secure=false` in development** is intentional — `php artisan serve`
does not use HTTPS. The `JWT_COOKIE_SECURE` env variable controls this
and must be `true` in production.

**Reference:** ITD Security Standard §5.17, §5.18

---

## 5. Auth Guard Configuration

**File:** `config/auth.php`

| Guard | Driver | Provider | Used For |
|---|---|---|---|
| `api` | `jwt` | `users` | All API route authentication |
| `web` | `session` | `users` | Not used — SPA architecture |

All API routes use the `api` guard. The `web` session guard is not
used in this application.

---

## 6. Password Hashing

| Setting | Value | Notes |
|---|---|---|
| Algorithm | `bcrypt` | Laravel default via `Hash::make()` |
| Bcrypt rounds | `12` (Laravel default) | Configurable in `config/hashing.php` |
| MD5 / SHA-1 | **Never used** | Prohibited by ITD Standard §4.7 |

**Reference:** ITD Security Standard §4.7, §4.8

---

## 7. Input Validation

All API endpoints use Form Request classes that extend `ApiFormRequest`.

| Behaviour | Implementation |
|---|---|
| Validation runs server-side | Laravel Form Request classes |
| Validation failure response | JSON `{"success":false,"errors":{...}}` with HTTP 422 |
| HTML redirects on failure | **Disabled** — `failedValidation()` overridden |
| Authorization failure response | JSON with HTTP 403 |
| Base class location | `app/Http/Requests/ApiFormRequest.php` |

**Reference:** ITD Security Standard §2.1, §2.5

---

## 8. Error Handling

| Setting | Development | Production |
|---|---|---|
| Stack traces in response | Visible | **Hidden** — controlled by `APP_DEBUG` |
| Generic error messages | Yes | Yes |
| Custom JSON error format | Yes (via `ApiFormRequest`) | Yes |
| Exception handler | Laravel default + custom overrides | Same |

**Reference:** ITD Security Standard §8.2, §8.3, §8.4

---

## 9. Database Connection Security

| Setting | Value | Notes |
|---|---|---|
| Connection string location | `.env` only | Never in source code |
| Query method | Eloquent ORM | Parameterized queries — no raw SQL |
| Database user | Dedicated app user | Not root — least privilege |
| Password | Strong, randomly generated | Stored in `.env` only |

**Reference:** ITD Security Standard §12.1, §12.4, §12.6

---

## 10. Repository Access Control

| Control | Implementation |
|---|---|
| `.env` in `.gitignore` | ✅ Verified |
| `.env` committed to repo | Never — git history checked |
| `.env.example` committed | ✅ Contains keys, no values |
| Collaborator access | GitHub collaborator model — named individuals only |
| Branch protection | [To be configured on GitHub] |

**Reference:** ITD Security Standard §1.10, §16.3

---

## 11. Configuration Change Log

Any change to the security configuration of this application must be
recorded here with the date, the change made, and the reason.

| Date | Change | Reason | Made By |
|---|---|---|---|
| April 2026 | Initial security configuration | Sprint 1 baseline | [Your name] |
