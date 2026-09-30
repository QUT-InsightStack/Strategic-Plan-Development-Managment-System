# SPMS Threat Model
**Method:** STRIDE
**Date:** April 2026

---

## System Description

SPMS is an internal web application for DOST managing strategic plans.
Users include Planning Officers, Management, Office, and Administrators.
Data is classified as OFFICIAL. No public internet access is intended.

## Trust Boundaries

1. Browser (untrusted) → Laravel API (trusted)
2. Laravel API (trusted) → MySQL Database (trusted)
3. Laravel API (trusted) → File Storage (trusted)

---

## Threat Analysis (STRIDE)

### S — Spoofing Identity

| Threat | Mitigation |
|---|---|
| Attacker submits forged credentials | JWT signed with HS256 + server secret |
| Session token stolen via XSS | HttpOnly cookie — JS cannot read it |
| Credential brute force | Account lockout after 3 attempts [Sprint 2] |

### T — Tampering with Data

| Threat | Mitigation |
|---|---|
| SQL injection via API inputs | Laravel Eloquent parameterized queries |
| Tampered JWT payload | JWT signature validation on every request |
| Modified request data | Server-side validation on all inputs |

### R — Repudiation

| Threat | Mitigation |
|---|---|
| User denies performing an action | Audit log records user + timestamp + action |
| Log tampering | Audit table is append-only at application level |

### I — Information Disclosure

| Threat | Mitigation |
|---|---|
| .env file exposed via web server | .env outside public/ directory |
| Stack traces leaked in production | APP_DEBUG=false in production |
| Error messages reveal system info | Generic error messages on all API errors |
| JWT in URL (logs, referrer headers) | JWT stored in HttpOnly cookie, never URL |

### D — Denial of Service

| Threat | Mitigation |
|---|---|
| Login endpoint flooded | Rate limiting on /api/login [Sprint 2] |
| API overwhelmed with requests | Laravel throttle middleware [Sprint 2] |

### E — Elevation of Privilege

| Threat | Mitigation |
|---|---|
| User accesses admin endpoint | RoleMiddleware checks role on every request |
| Horizontal privilege escalation | Org-unit scoping on all data queries |
| JWT with forged role claim | Role read from database, not JWT payload |

---

## Residual Risks

| Risk | Severity | Owner | Resolution Plan |
|---|---|---|---|
| No rate limiting yet | High | Person A | Sprint 2 |
| No DAST testing yet | High | Team | Pre-deployment |
| Account lockout not implemented | Medium | Person A | Sprint 2 |
