# SPMS Security Documentation
**Project:** Strategic Plan Management System (SPMS)
**Organization:** DOST — Information Technology Division
**Standard:** ITD Security Standard — Software Development
**Last Updated:** April 2026

---

## 1. Security Architecture Overview

### Stack
- Backend: Laravel 13 (PHP 8.3)
- Frontend: React (Vite)
- Database: MySQL
- Authentication: JWT via tymon/jwt-auth
- Transport: HTTPS (TLS 1.2+)

### Authentication Model
JWT tokens issued by the Laravel API.
Tokens are stored in HttpOnly cookies — not localStorage.
This protects against XSS-based token theft.
Access token TTL: 30 minutes.
Refresh token TTL: 7 days (10080 minutes).

### Authorization Model
Role-Based Access Control (RBAC).
Default roles: Administrator, test, Planning Officer, Management, Office, Technical Administrator.
Management replaces Division Head and Office replaces Viewer without changing their permissions. The protected test role has full access for testing.
All routes deny access by default — access must be explicitly granted.
Role check is enforced server-side on every request via RoleMiddleware.

---

## 2. ITD Security Standard Compliance

### §4 — Authentication (implemented in AuthController)
| Requirement | Implementation |
|---|---|
| 4.1 Auth enforced server-side | Laravel middleware on all API routes |
| 4.8 Password hashing on server | Laravel Hash::make() — bcrypt |
| 4.10 Generic auth failure messages | Returns "Invalid credentials" only |
| 4.13 POST for credential transmission | POST /api/login |
| 4.18 Account lockout after failed attempts | [Sprint 1 — to be implemented] |

### §5 — Session Management
| Requirement | Implementation |
|---|---|
| 5.11 Session IDs not in URL | JWT stored in HttpOnly cookie only |
| 5.17 Secure flag on cookies | JWT_COOKIE_SECURE=true in production |
| 5.18 HttpOnly flag on cookies | Set on all JWT cookie responses |

### §10 — Communication Security
| Requirement | Implementation |
|---|---|
| 10.1 TLS for all connections | HTTPS enforced — AppServiceProvider |
| 10.3 No fallback to insecure | HTTP 301 redirected to HTTPS |

### §12 — Database Security
| Requirement | Implementation |
|---|---|
| 12.1 Parameterized queries | Laravel Eloquent ORM — no raw queries |
| 12.4 Least privilege DB access | App-specific DB user, not root |
| 12.6 No hardcoded connection strings | DB credentials in .env only |

---

## 3. Known Deferred Controls

These controls from the ITD Security Standard are acknowledged but
deferred to a later sprint. Each will be addressed before go-live.

| Control | Reason Deferred | Target Sprint |
|---|---|---|
| §4.18 Account lockout | Requires database + throttle table | Sprint 2 |
| §4.24 Password history | Requires password_history table | Sprint 2 |
| §8 Full audit logging | AuditLog service not yet built | Sprint 1 |
| §28 DAST / Pen Testing | Requires working application | Pre-deployment |

Any deferred control must be resolved before production deployment
per the ITD Security Standard compliance requirements.

---

## 4. Secret Management Rules

- All secrets live in `.env` — never in source code
- `.env` is in `.gitignore` and must never be committed
- `.env.example` contains key names with no values — this is committed
- `APP_KEY` — generated via `php artisan key:generate`
- `JWT_SECRET` — generated via `php artisan jwt:secret`
- Production `.env` is managed by the system administrator only
- React `.env` variables are bundled into the JavaScript build
  and are visible to users — no secrets may be stored there

---

## 5. Open Source Components

Per ITD Security Standard §17, the following open-source packages
are used and have been reviewed:

| Package | Version | Purpose | Vulnerability Check |
|---|---|---|---|
| tymon/jwt-auth | latest | JWT authentication | Verified via Packagist |
| laravel/framework | 13.x | Application framework | Official Laravel release |

`composer audit` must be run before every production deployment.
