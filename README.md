# Nutrition Store

A secure, bilingual (FR/AR) sports-nutrition e-commerce site — storefront + back-office — built on the same stack as the original `arg` project:

| Layer | Tech |
|---|---|
| Frontend | Angular 21 (standalone components, signals, zoneless), TypeScript, self-hosted fonts, no UI/icon libraries |
| Backend | Python 3.12+ · FastAPI · SQLAlchemy 2 · Alembic · Pydantic v2 |
| Database | PostgreSQL (production) · SQLite (local dev) |
| Delivery | Docker Compose · Caddy (automatic HTTPS) · nginx |

The structure of the storefront is inspired by prodietnutrition.ma (goal-based navigation, categories, "new products", "best sellers", promo prices, free-delivery badges, packs, brands). **No text, photos, logos or product data were copied** — everything is original and you add your own products from the admin panel.

> Clothing and women's-space sections are intentionally **disabled**. Their places are marked with `LATER` comments (see [CHANGES.md](CHANGES.md#disabled-for-later)).

## Highlights

**Storefront**
- Purple/magenta gradient design system, glass header with mega-menu, live search suggestions, slide-over cart with a free-delivery progress bar, sticky mobile "add to cart" bar, skeleton loaders, RTL support for Arabic.
- Filterable shop (category, goal, brand, price range, promo, in-stock, free delivery, sorting, pagination — all in the URL).
- Product variants (e.g. flavour), promo pricing, stock status, nutrition facts and usage tabs.
- Checkout with **cash on delivery only** (card payment is stubbed and documented for later), Moroccan phone validation, privacy consent, order confirmation page that shows no personal data.
- Cart prices are **always re-computed by the server** (`POST /cart/quote`); the browser is never trusted.

**Back-office** (`/admin`)
- Dashboard with KPIs, sales chart, order pipeline, best sellers, low-stock alerts and a first-steps checklist.
- **Orders as a Kanban board** with a detail drawer (no tables).
- **Products as a visual card grid** with inline stock/visibility controls and a live storefront preview in the editor.
- Reorderable categories, contact-message inbox, site settings (delivery fee, free-delivery threshold, announcement bar, contact & social links), security page (password change, "log out everywhere", audit log).

**Security** — see [SECURITY.md](SECURITY.md): HttpOnly session cookie + CSRF token, bcrypt, login lockout, rate limiting, strict validation, safe image uploads, CSP & security headers, audit log, GDPR/Law 09-08-style data minimisation and order anonymisation.

## Repository layout

```
nutrition-store/
├── backend/            FastAPI app, Alembic migrations, scripts, tests, Dockerfile
├── frontend/           Angular app, nginx.conf, Dockerfile
├── deploy/Caddyfile    HTTPS reverse proxy config
├── docker-compose.yml  Production stack (db + api + web + caddy)
├── .env.example        Production secrets template (copy to .env)
├── README.md           This file
├── DEPLOYMENT.md       Step-by-step deployment guide
├── SECURITY.md         Security model, checklist, residual risks
└── CHANGES.md          What was cloned, what changed vs the original project
```

## Quick start (local development)

Prerequisites: Python 3.12+, Node.js 20 or 22 LTS, npm.

### 1. Backend

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1          # macOS/Linux: source .venv/bin/activate
pip install -r requirements-dev.txt
copy .env.example .env              # macOS/Linux: cp .env.example .env
python scripts/seed.py --demo       # categories + settings + clearly-labelled DEMO products
python scripts/create_admin.py --email you@example.com --name "Your Name"   # prints a generated password once
uvicorn app.main:app --reload --port 8000
```

API docs (development only): <http://localhost:8000/docs>

### 2. Frontend

```powershell
cd frontend
npm install                         # on Windows PowerShell use npm.cmd if scripts are blocked
npm start                           # http://localhost:4200
```

- Storefront: <http://localhost:4200>
- Admin: <http://localhost:4200/admin/login>

> In development the API runs on another port, so the browser treats it as a different origin. The default `.env.example` already allows `http://localhost:4200` and uses `SameSite=Strict`, which works because `localhost` ports share the same *site*.

### 3. Tests

```powershell
cd backend ; pytest                 # 70+ tests: auth, CSRF, validation, orders, uploads, headers…
cd frontend ; npm test              # unit tests (Vitest)
cd frontend ; npm run build         # production build
```

## Images

Everything visual is managed from the admin panel, with no code changes:
- **Product photos:** Admin → Produits → edit a product → Visuel. Square images work best (at least 1000 × 1000 px).
- **Category pictures:** Admin → Catégories.
- **Logo and home-page hero photo:** Admin → Paramètres → Identité. The hero photo is shown full-width on the home page under a dark green overlay; use a horizontal image (1600 × 900 px or larger).

Uploads are checked and re-encoded to WebP on the server (max 5 MB, JPEG/PNG/WebP only). Only use photos you own or are licensed to use, for example your own shoots or images supplied by the brands you sell.

## Configuration

All backend settings are environment variables (see `backend/.env.example`). In production the app **refuses to start** with a weak `SECRET_KEY`, wildcard `ALLOWED_HOSTS`, or `SameSite=None` without HTTPS.

Business rules you can change in the admin panel (Settings): shop name, tagline, logo, announcement bar, contact details, WhatsApp number, social links, delivery fee, free-delivery threshold.

## Going live

Follow [DEPLOYMENT.md](DEPLOYMENT.md). In short: a small VPS, a domain, `cp .env.example .env`, fill the secrets, `docker compose up -d --build`, create your admin account.
