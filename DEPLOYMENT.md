# Deployment guide

This guide takes you from zero to a live, HTTPS-protected shop. Two supported setups:

| | **A. Single server (recommended)** | **B. Split hosting** |
|---|---|---|
| Where | One VPS (Hetzner, OVH, DigitalOcean, Scaleway…) running Docker | Static host for the Angular app + container host for the API |
| Origin | Same origin (`https://shop.example.com`) | `shop.example.com` + `api.example.com` |
| Complexity | Low — one `docker compose up` | Medium — two deployments, CORS/CSP to configure |
| Security | Best (SameSite=Strict, no CORS) | Good if both hosts share the same parent domain |

---

## A. Single server with Docker Compose

### 0. What you need
- A domain name (e.g. `shop.example.com`).
- A Linux VPS: 1 vCPU / 2 GB RAM is enough to start (Ubuntu 22.04/24.04).
- SSH access.

### 1. Point your domain at the server
Create an `A` record (and `AAAA` if you have IPv6) for `shop.example.com` (and `www`) pointing to the server IP. Wait until `nslookup shop.example.com` returns it — Caddy needs this to obtain the HTTPS certificate.

### 2. Prepare the server
```bash
# As root (or with sudo)
apt update && apt -y upgrade
apt -y install ufw fail2ban unattended-upgrades git
curl -fsSL https://get.docker.com | sh

# Firewall: only SSH + web
ufw default deny incoming
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw enable

# Create a non-root user for deployments (use SSH keys, disable password login)
adduser deploy && usermod -aG docker deploy
```
Disable SSH password authentication (`PasswordAuthentication no` in `/etc/ssh/sshd_config`) once your key works.

### 3. Get the code on the server
```bash
su - deploy
git clone <your-repository-url> nutrition-store
cd nutrition-store        # the folder that contains docker-compose.yml
```

### 4. Configure secrets
```bash
cp .env.example .env
nano .env
```
Fill in:

| Variable | How to get it |
|---|---|
| `DOMAIN` | `shop.example.com` |
| `POSTGRES_PASSWORD` | `openssl rand -hex 24` |
| `SECRET_KEY` | `python3 -c "import secrets; print(secrets.token_urlsafe(48))"` |
| `ADMIN_EMAIL` | your admin e-mail (optional, used by the create-admin script) |

Lock the file: `chmod 600 .env`. **Never commit it.**

### 5. Start everything
```bash
docker compose up -d --build
docker compose ps                    # all services should be "healthy"/"running"
docker compose logs -f backend       # Ctrl+C to leave
```
On start the API runs `alembic upgrade head`, creating/updating the database schema automatically.

### 6. Create the admin account and base data
```bash
docker compose exec backend python scripts/create_admin.py --email you@example.com --name "Your Name"
# → prints a generated password ONCE. Save it in a password manager.

docker compose exec backend python scripts/seed.py
# → creates default settings + the category structure (no demo products in production)
```
Open `https://shop.example.com/admin/login`, sign in, then:
1. **Security → Change password** (choose your own ≥12-character password).
2. **Settings** → shop name, logo, contact details, WhatsApp, delivery fee, free-delivery threshold, announcement bar.
3. **Categories** → adjust/translate the seeded categories.
4. **Products** → add your first products (upload images straight from the editor).
5. Place a **test order** from the storefront and check it appears on the Kanban board.

### 7. Verify the security headers
```bash
curl -sI https://shop.example.com | grep -iE "strict-transport|content-security|x-frame|x-content-type|referrer"
curl -s -o /dev/null -w "%{http_code}\n" https://shop.example.com/docs     # must NOT be 200 (docs are disabled in production)
```
You can also test with <https://securityheaders.com> and <https://www.ssllabs.com/ssltest/>.

### 8. Backups (do this before you take real orders)
```bash
mkdir -p ~/backups
# Database
docker compose exec -T db pg_dump -U nutrition nutrition | gzip > ~/backups/db-$(date +%F).sql.gz
# Uploaded images
docker run --rm -v nutrition-store_uploads:/data -v ~/backups:/backup alpine \
  tar czf /backup/uploads-$(date +%F).tgz -C /data .
```
Automate with cron (`crontab -e`) — for example daily at 03:00 — and copy the files **off the server** (object storage, another machine). Test a restore at least once:
```bash
gunzip -c ~/backups/db-2025-01-01.sql.gz | docker compose exec -T db psql -U nutrition nutrition
```
Backups contain personal data: encrypt them (e.g. `gpg -c`) and keep them for a limited time.

### 9. Updating
```bash
cd nutrition-store
git pull
docker compose up -d --build          # migrations run automatically
docker image prune -f
```
Roll back with `git checkout <previous-commit>` and the same command (restore a DB backup if a migration must be undone).

### 10. Operations cheat-sheet
```bash
docker compose logs -f --tail=100 backend web caddy
docker compose restart backend
docker compose exec backend python scripts/create_admin.py --email you@example.com   # reset a password (also logs out all sessions)
docker compose down                   # stop (data volumes are kept)
```

---

## B. Split hosting (static front + API container)

Use this if you prefer Vercel/Netlify/Cloudflare Pages for the Angular build and Railway/Render/Fly.io for the API + a managed PostgreSQL.

1. **Choose sub-domains of the same parent domain**, e.g. `shop.example.com` (front) and `api.example.com` (API). They are the same *site*, so the session cookie can stay `SameSite=Strict`. If you use unrelated domains (e.g. `*.vercel.app` + `*.railway.app`) you must use `COOKIE_SAMESITE=none`, which weakens CSRF defences — avoid it.
2. **API** (container from `backend/Dockerfile`), environment:
   ```
   ENVIRONMENT=production
   DATABASE_URL=postgresql+psycopg2://…        # managed Postgres, with SSL (?sslmode=require)
   SECRET_KEY=<48+ random chars>
   CORS_ORIGINS=https://shop.example.com
   ALLOWED_HOSTS=api.example.com
   COOKIE_SAMESITE=strict
   TRUST_PROXY=true                              # only if the platform proxy sets X-Forwarded-For
   UPLOAD_DIR=/data/uploads                      # mount a persistent volume here!
   ```
   Platforms with ephemeral disks lose uploaded images on redeploy — attach a volume or move uploads to object storage.
3. **Frontend**: edit `frontend/src/environments/environment.prod.ts`:
   ```ts
   export const environment = { production: true, apiUrl: 'https://api.example.com/api/v1', mediaUrl: 'https://api.example.com' };
   ```
   Build: `npm ci && npm run build` → publish `dist/frontend/browser`. Configure an SPA fallback (all routes → `index.html`) and add the security headers from `frontend/nginx.conf` in your host's header settings, with `connect-src 'self' https://api.example.com` and `img-src 'self' data: https:`.
4. Create the admin and seed the categories with a one-off command on the API service (`python scripts/create_admin.py …`, `python scripts/seed.py`).

---

## Environment variable reference (backend)

| Variable | Default | Notes |
|---|---|---|
| `ENVIRONMENT` | `development` | `production` enables HSTS, hides `/docs`, forces Secure cookies, validates secrets |
| `DATABASE_URL` | `sqlite:///./nutrition.db` | Use PostgreSQL in production |
| `SECRET_KEY` | *(random per start in dev)* | **Required in production**, ≥ 32 chars. Changing it logs everyone out |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `60` | Admin session length |
| `COOKIE_SAMESITE` | `strict` | `strict`/`lax`/`none` |
| `COOKIE_SECURE` | `false` | Forced `true` in production |
| `CORS_ORIGINS` | `http://localhost:4200` | Comma separated, exact origins. Also used for the Origin check on admin mutations |
| `ALLOWED_HOSTS` | `localhost,127.0.0.1,testserver` | Host header allow-list; real domain(s) in production |
| `TRUST_PROXY` | `false` | `true` only behind a proxy you control |
| `UPLOAD_DIR` / `MAX_UPLOAD_MB` | `./uploads` / `5` | |
| `ORDER_PREFIX` | `NS` | Order numbers look like `NS-7K2M9QXA` |
| `MAX_QTY_PER_LINE` | `20` | |
| `WEB_CONCURRENCY` | `1` | Gunicorn workers (see note below) |

> **Rate limiting & workers.** The API's limiter is in memory, so it is exact with one worker. nginx adds a second, global layer (`limit_req`). If you scale to several workers/containers, replace `app/core/rate_limit.py` with a Redis-backed implementation first.

---

## Adding card payments later

Cash on delivery is enforced in three places so nothing can be bypassed by accident:
1. `backend/app/schemas/order.py` — `payment_method: Literal["CASH_ON_DELIVERY"]`
2. `backend/app/models/order.py` — `PAYMENT_METHODS`
3. `frontend/src/app/pages/store/checkout.page.html` — the card option is a commented `LATER` block

When you are ready: choose a Moroccan-compatible provider (CMI, Payzone, Stripe where available…), widen the `Literal`, create the payment session server-side in `order_service.create_order`, **verify the provider's webhook signature**, mark the order paid only from the webhook, and never store card numbers (PCI-DSS) — use the provider's hosted fields/redirect.

---

## Pre-launch checklist
- [ ] `.env` has strong, unique secrets; file permissions `600`; not in git.
- [ ] HTTPS works; `http://` redirects to `https://`; HSTS header present.
- [ ] `/docs` and `/openapi.json` return 404.
- [ ] Admin password changed and stored in a password manager; only the people who need access have accounts.
- [ ] Backups run automatically **and** a restore was tested.
- [ ] Legal pages completed: replace `[bracketed]` placeholders in the Privacy Policy and Terms (`pages/store/legal.page.ts`), add the CNDP receipt number, and have a lawyer review them.
- [ ] Settings page filled in (contact details, delivery fee, threshold).
- [ ] A full test order completed on a phone.
- [ ] `docker compose logs backend` shows no errors; uptime monitoring configured (e.g. UptimeRobot on `/health` through the domain).

## Troubleshooting
| Symptom | Likely cause / fix |
|---|---|
| Backend exits at start with `SECRET_KEY must be set…` | Set a ≥32-char `SECRET_KEY` in `.env` |
| Admin login says "Origin not allowed" / CORS error | `CORS_ORIGINS` must equal the exact site origin (`https://shop.example.com`, no trailing slash) |
| Admin login works but you are logged out on every click | Cookie not sent: check HTTPS, `COOKIE_SAMESITE`, and that front/API share the same site |
| `400 Invalid host header` | Add the domain to `ALLOWED_HOSTS` |
| Caddy cannot get a certificate | DNS not pointing to the server yet, or ports 80/443 blocked |
| Images vanish after redeploy | `uploads` volume not persistent (split hosting) |
| `429 Too many requests` while testing | Rate limits working as designed; wait or restart the backend in dev |
