# What was built, and how it differs from the original project

The original project (`D:\arg`, "Argan Cosmetics": `frontend/` Angular + `backend/` FastAPI) is **unchanged**. This folder (`nutrition-store/`) is a new, separate project that keeps the same stack and general architecture.

## 1. Scope decisions

| Request | Result |
|---|---|
| Base the new site on prodietnutrition.ma | Same shopping concepts and information architecture: goal-based navigation ("Objectifs"), category mega-menu, *Nouveaux produits*, *Meilleures ventes*, promotions with strike-through prices, "Livraison gratuite" badges, packs, brands, search, free-delivery threshold. All copy, design, code and sample data are **original** — nothing was copied from that site. |
| Keep the stack | Angular 21 + FastAPI + SQLAlchemy + Alembic + PostgreSQL/SQLite, same folder layout (`frontend/`, `backend/`) |
| Exclude clothes and women's stuff, keep in comments | See [Disabled for later](#disabled-for-later) |
| Fancy front-end, purple + gradients | New design system in `frontend/src/styles.css` (tokens `--grad`, `--p-50…900`, glass surfaces, glow shadows, animated hero, micro-interactions, skeleton loaders, reduced-motion support) |
| Rework the "silly" admin with tables | Kanban for orders, visual card grid for products, reorderable category cards, inbox for messages, timeline for audit — **no data tables** |
| Cash on delivery only, card later | Enforced server-side and in the UI; card option left as documented `LATER` stubs |
| Keep the original, put the new work in another folder with description & deployment | `nutrition-store/` + `README.md`, `DEPLOYMENT.md`, `SECURITY.md`, this file |
| Secure (personal data) | See [SECURITY.md](SECURITY.md) |
| Name & logo later | Shop name/tagline/logo are **settings** (Admin → Paramètres). A neutral wordmark placeholder is used until a logo is uploaded. |

## 2. Disabled for later

Search the code for `LATER` to find every place:

- `frontend/src/app/layout/store-layout.component.html` — header nav and mega-menu entries "Vêtements" and "Espace femme" (commented).
- `frontend/src/app/pages/store/home.page.html` — category tiles for the same two sections (commented).
- `backend/scripts/seed.py` — the categories `vetements` and `femme` (commented in `CATEGORIES`).
- `frontend/src/app/pages/store/checkout.page.html` — card-payment option (commented), plus `backend/app/schemas/order.py` (`Literal`) and `backend/app/models/order.py` (`PAYMENT_METHODS`).

To enable clothing later: uncomment the seed entries and the template blocks, or simply create the categories from the admin panel (they will appear automatically in the menus and filters).

## 3. Backend changes vs. the original

| Original | New |
|---|---|
| `python-jose` JWT in `Authorization: Bearer`, token in `localStorage` | `PyJWT`, token in an **HttpOnly cookie**, CSRF token, `Origin` check, session revocation (`token_version`) |
| Seed script created `admin@argan.ma / admin123` | **No default credentials**; `scripts/create_admin.py` (generated or prompted password, policy enforced) |
| Hard-coded CORS origins | `CORS_ORIGINS`, `ALLOWED_HOSTS`, `TRUST_PROXY` environment variables; production start-up validation |
| Client could send any order; server trusted product lookup only | Server-side quote (`POST /cart/quote`), stock reservation, option validation, delivery-fee rules, consent, strict status machine incl. `CANCELLED`, no PII in the public response |
| No rate limiting, no body limits, no security headers | Rate limiter, body-size limits, security headers, no-store caching on admin data |
| Public catalogue returned all products | Paginated, filterable, sortable catalogue (`category`, `goal`, `brand`, `q`, price range, promo, new, best-seller, free delivery, in-stock) |
| Product: name, price, image, stock *status* string | Adds brand, goal, promo price (`compare_at_price`), badges (`is_new`, `is_bestseller`, `free_delivery`), variants (`options`), nutrition facts, usage, weight label, **numeric stock** (`NULL` = untracked) |
| Order: email required | E-mail optional (common for COD in Morocco), phone normalised to `+212…`, `subtotal`, `delivery_fee`, `consent_at`, `admin_note`, `cancelled_at`, `anonymized_at`; items keep name/price/option/image **snapshots** |
| Site settings: title, phone, email, address | Adds tagline, logo, WhatsApp, social links, announcement bar (FR/AR), delivery fee, free-delivery threshold |
| Notifications only | + contact-message inbox, + audit log, + image upload endpoint, + dashboard analytics, + category reordering, + order anonymisation |
| Tables created by `Base.metadata.create_all` in seed | Alembic migration `0001_initial_schema` (applied automatically by the container) |
| Basic tests | 70+ pytest tests, many security-focused |

### New / changed API surface (summary)

Public (`/api/v1`): `GET /site-settings/public`, `/goals`, `/categories`, `/categories/{slug}`, `/brands`, `/products`, `/products/{slug}`, `/products/{slug}/related`; `POST /cart/quote`, `/orders`, `/contact`.

Admin (`/api/v1/admin`, cookie + CSRF): `auth/{login,me,logout,logout-all,change-password}`; `categories` (CRUD + `reorder`); `products` (CRUD + `PATCH` quick edit); `orders` (list/search, detail, `PATCH …/status`, `PATCH …/note`, `POST …/anonymize`); `dashboard/stats`; `notifications` (+ `read-all`); `messages`; `uploads`; `settings`; `audit-logs`.

## 4. Frontend changes vs. the original

| Original | New |
|---|---|
| Single stylesheet, green theme, plain pages | Purple/magenta gradient design system, Outfit + Inter fonts (self-hosted, no Google Fonts requests), glass header, mega-menu, animated hero |
| Inline French/Arabic ternaries (`lang() === 'fr' ? … : …`) | Central dictionary (`core/i18n/translations.ts`) with `t`, `loc`, `money` pipes; full RTL layout using CSS logical properties |
| Search on home only | Global live search with suggestions; URL-driven shop filters |
| Cart in `localStorage` trusted as-is | Cart validated on load and re-priced by the server |
| Checkout: a few `ngModel` inputs | Reactive form with inline validation (mirrors server rules), consent, COD info, order confirmation page |
| Admin: tables + forms; JWT in `localStorage` | Kanban / card UI, drawers, live product preview, image uploader; no token in storage |
| Fixed Railway API URL in `environment.prod.ts` | Same-origin `/api/v1` by default (nginx proxy) — change for split hosting |
| Console logging of API data | Removed |

## 5. Not included / next steps

- Real product data, photos, logo and shop name (you will add them).
- Card payments, e-mail/SMS notifications, customer accounts, coupons, reviews (deliberately out of scope; the design leaves room for them).
- Two-factor authentication for admins (recommended, see SECURITY.md).
- Legal texts are templates and must be reviewed.
