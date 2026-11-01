# Security

This shop stores customers' names, phone numbers and delivery addresses, so security and privacy are part of the design, not an add-on. This document lists what is implemented, where, how it is tested, and what remains **your** responsibility.

## 1. Controls implemented

| Area | Control | Where |
|---|---|---|
| **Admin authentication** | bcrypt (cost 12) password hashes; constant-time verification with a dummy hash for unknown e-mails (no user enumeration / timing leak); password policy ≥ 12 chars, 3 of 4 character classes, ≤ 72 bytes; **no default account or password** — the first admin is created with `scripts/create_admin.py` | `core/security.py`, `scripts/create_admin.py` |
| **Brute force** | 5 failed logins per account and 10 per IP per 15 min → `429 Retry-After`; extra `limit_req` in nginx | `routers/admin_auth.py`, `frontend/nginx.conf` |
| **Session** | JWT in an **HttpOnly, Secure, SameSite=Strict** cookie (JavaScript — and therefore XSS — cannot read it); 60 min expiry; `token_version` allows "log out everywhere" and invalidates sessions on password change; deactivated admins are rejected immediately | `core/security.py`, `dependencies.py` |
| **CSRF** | Per-session CSRF token (stored inside the JWT, returned to the SPA, kept **in memory only**) required in `X-CSRF-Token` on every non-GET admin request, compared in constant time; additional `Origin` allow-list check; strict CORS (explicit origins, methods, headers) | `dependencies.py`, `core/middleware.py` |
| **Authorization** | Every admin route is behind `get_current_admin`; admin/notification responses are `Cache-Control: no-store` | `routers/*`, `core/middleware.py` |
| **Input validation** | Pydantic v2 schemas with length, range and format limits on every field; control characters stripped; Moroccan phone normalisation; e-mail validation; bounded lists (≤ 50 cart lines, ≤ 100 qty); unknown JSON fields ignored (no mass assignment); search terms escaped for `LIKE` | `schemas/*`, `core/text.py` |
| **SQL injection** | SQLAlchemy ORM / bound parameters only; no string-built SQL | `services/*` |
| **XSS** | Angular escaping everywhere; no `innerHTML` / `bypassSecurityTrust*`; image/link URLs allow-listed (`/media/…` or `https://…` — `javascript:`/`data:` rejected server-side *and* client-side); strict CSP (no inline scripts, no third-party origins) | `core/text.py`, `core/services/media.ts`, `frontend/nginx.conf` |
| **Business-logic abuse** | Prices, totals, delivery fee and availability are computed **server-side only** (client price fields are ignored); atomic stock decrement (`UPDATE … WHERE stock >= qty`) prevents overselling; duplicate lines merged so limits can't be bypassed by splitting; cancelled orders restore stock; strict state machine for order status; `NEW → CANCELLED` etc. only via allowed transitions | `services/order_service.py` |
| **Order privacy** | Order numbers are random (`secrets`), the customer confirmation contains **no personal data**, there is **no public order-lookup endpoint**; consent timestamp stored | `schemas/order.py`, `models/order.py` |
| **Bots / spam** | Per-IP rate limits (orders: 3/min & 15/h; contact: 5/h; quote: 120/min), honeypot field on the contact form, body-size limits (256 KB, 6 MB for uploads) | `dependencies.py`, `core/middleware.py` |
| **File uploads** | Size cap while streaming; Pillow decodes and **re-encodes to WebP** (removes EXIF/GPS and any embedded payload); only JPEG/PNG/WebP accepted by content, not by name/MIME; random file names (no path traversal); decompression-bomb limit (25 MP); max 1600 px; SVG rejected | `services/upload_service.py` |
| **Transport / headers** | HSTS (2 years), CSP, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`; TrustedHost allow-list; server version hidden; Swagger/OpenAPI disabled in production | `core/middleware.py`, `frontend/nginx.conf`, `main.py` |
| **Secrets** | Production refuses to start with a weak/missing `SECRET_KEY`, wildcard hosts, or `SameSite=None` without HTTPS; `.env` is git-ignored; compose `:?` guards fail if a secret is missing | `config.py`, `docker-compose.yml` |
| **Container hardening** | Non-root user, `no-new-privileges`, dropped capabilities, read-only filesystem for the API, private network (DB and API not published), health checks | `backend/Dockerfile`, `docker-compose.yml` |
| **Auditability** | Audit log of logins (success/failure), product/category/settings changes, order status changes, uploads, anonymisation — with admin e-mail and IP; visible in *Admin → Sécurité* | `services/audit_service.py` |
| **Privacy / Law 09-08** | Data minimisation (e-mail optional, no card data, no tracking cookies/analytics), explicit consent checkbox, Privacy Policy page, **order anonymisation** action (right to erasure) for delivered/cancelled orders, contact messages deletable | `routers/admin_misc.py`, `pages/store/legal.page.ts` |
| **Dependencies** | `python-jose` (history of CVEs) replaced by `PyJWT`; version ranges pinned to maintained majors | `requirements.txt` |
| **Errors** | Generic 500 responses (no stack traces / internals), generic login failure message | `main.py` |

## 2. Automated tests

`backend/tests` (run `pytest`) verifies, among others: unauthenticated access is rejected on every admin route; cookie flags; generic login errors; lockout; forged/tampered JWT; deactivated admin; "logout everywhere"; CSRF required; foreign `Origin`/CORS/Host rejected; security headers; body-size limit; server-side price calculation; client price tampering ignored; stock/option rules incl. split-line bypass; rate limiting; honeypot; consent & phone validation; unsafe image URLs; upload re-encoding and rejection of PHP/HTML/SVG polyglots; order anonymisation; audit log; SQL-wildcard search.

## 3. Before going live (your checklist)

1. Generate real secrets (`SECRET_KEY`, DB password) — never reuse those from development.
2. Serve **only over HTTPS** (the provided Caddy setup does this automatically).
3. Create admins with strong, unique passwords stored in a password manager. Prefer one account per person.
4. Enable server-level hardening: SSH keys only, `ufw`, `fail2ban`, unattended security upgrades (see DEPLOYMENT.md).
5. Configure **automatic, encrypted, off-site backups** and test a restore.
6. Complete the legal pages and register the processing with the **CNDP** (Morocco, Law 09-08). Template text is provided but must be reviewed by a lawyer.
7. Run dependency audits regularly:
   ```bash
   pip install pip-audit && pip-audit -r backend/requirements.txt
   cd frontend && npm audit --omit=dev
   ```
8. Keep Docker images updated (`docker compose pull && docker compose up -d --build`).

## 4. Known limitations / recommended next steps

- **No two-factor authentication yet.** Admin accounts rely on strong passwords + lockout. Adding TOTP (e.g. `pyotp`) is the highest-value next step if several people have admin access.
- **In-memory rate limiter** is per process (exact with the default single worker). Move to Redis before scaling horizontally.
- **Admin sessions are stateless** (revocable via "log out everywhere"/password change, not individually).
- **No e-mail/SMS notifications** are sent (so no mail-injection surface); new orders appear in the admin panel and notification bell. If you add e-mail later, never put user input into headers and use a transactional provider.
- **`style-src 'unsafe-inline'`** is required because Angular injects component styles at runtime; scripts remain fully locked down (`script-src 'self'`). A nonce-based CSP is possible with server-side rendering.
- `npm audit` currently reports moderate findings in **Angular CLI build tooling** (`glob`/`minimatch` via dev dependencies). They are **not shipped to browsers** and only run on your build machine; update the CLI when a compatible release is available.
- Card payments are not implemented; when added, follow the checklist in DEPLOYMENT.md (hosted payment page, signed webhooks, no card data on your servers).
- Order data lives in your database: access to the server = access to customer data. Restrict who can SSH/`docker exec`.

## 5. Reporting a vulnerability / incident basics

If you suspect a compromise: (1) *Admin → Sécurité → Déconnecter tous les appareils*, (2) rotate `SECRET_KEY` and DB password and redeploy, (3) review the audit log, (4) restore from a clean backup if needed, (5) notify the CNDP and affected customers when personal data may have been exposed.
