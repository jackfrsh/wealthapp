# CLAUDE.md — WealthApp Codebase Guide

This file provides AI assistants with essential context about the WealthApp codebase: its architecture, development workflows, conventions, and key patterns.

---

## Project Overview

**WealthApp** is a full-stack personal net worth tracker. Users connect multiple financial accounts in different currencies, track their net worth over time, set retirement/savings goals, and view projections.

**Tech Stack**:
- **Backend**: Python 3.12, FastAPI, SQLModel, Alembic, PostgreSQL
- **Frontend**: React 18, Vite, Tailwind CSS, Recharts, React Router v6
- **Auth**: Supabase (JWT issued by Supabase, verified server-side)
- **Billing**: Stripe (Pro tier subscription)
- **Deployment**: Docker + Railway.app

---

## Repository Structure

```
wealthapp/
├── backend/
│   └── app/
│       ├── main.py              # FastAPI app init, router registration, SPA serving
│       ├── database.py          # SQLModel engine, schema management, ensure_schema()
│       ├── models.py            # SQLModel table definitions (single source of truth)
│       ├── auth.py              # Supabase JWT verification (JWKS + HS256 fallback)
│       ├── middleware.py        # Security headers, rate limiting
│       ├── supabase_auth.py     # Supabase admin client integration
│       ├── _bg_session.py       # Background task DB session helpers
│       ├── routers/             # One file per domain (13 routers)
│       │   ├── auth.py          # /auth/me (register/login return 410 Gone)
│       │   ├── accounts.py      # /accounts CRUD
│       │   ├── goals.py         # /goals CRUD + forecast computation
│       │   ├── dashboard.py     # /dashboard net worth + timeseries
│       │   ├── settings.py      # /settings user preferences
│       │   ├── snapshots.py     # /snapshots net worth history
│       │   ├── fx.py            # /fx exchange rates (daily-cached)
│       │   ├── history.py       # /history net worth over time
│       │   ├── projection.py    # /projection long-term forecasts
│       │   ├── insights.py      # /insights analytics
│       │   ├── billing.py       # /billing Stripe integration
│       │   ├── admin.py         # /admin administrative endpoints
│       │   └── events.py        # /events analytics event logging
│       └── services/
│           └── networth.py      # Net worth calculation utilities
├── frontend/
│   └── src/
│       ├── main.jsx             # React-DOM render entry point
│       ├── App.jsx              # Root component: auth context, routing, session mgmt
│       ├── api.js               # HTTP client with caching, timeout, error handling
│       ├── apiCache.js          # Cache management per user
│       ├── supabase.js          # Supabase client initialization
│       ├── utils.js             # Currency/number/date formatting utilities
│       ├── track.js             # Analytics event tracking
│       ├── index.css            # Tailwind + CSS custom properties (dark mode vars)
│       ├── components/          # Reusable UI components
│       │   ├── charts/          # Chart components (WealthTooltip, chartTheme)
│       │   └── *.jsx            # Card, Button, Modal, Toast, Sidebar, etc.
│       ├── pages/               # Route-level page components
│       │   ├── Landing.jsx      # Public marketing page
│       │   ├── Home.jsx         # Dashboard (net worth hero, milestones)
│       │   ├── Accounts.jsx     # Account management CRUD
│       │   ├── Outlook.jsx      # Goal forecasting ("Strategy" tab)
│       │   ├── GoalSetup.jsx    # Goal onboarding form
│       │   ├── Settings.jsx     # Currency, theme, profile
│       │   ├── Insights.jsx     # Analytics & recommendations
│       │   ├── Upgrade.jsx      # Pro plan upsell
│       │   └── guides/          # SEO guide pages
│       ├── lib/
│       │   └── milestones.js    # Milestone ladder logic
│       └── utils/
│           └── localFlags.js    # Feature flags / localStorage helpers
├── alembic/                     # Database migrations
│   └── versions/                # Migration files (chronological)
├── scripts/
│   └── migrate_sqlite_to_pg.py  # SQLite → PostgreSQL migration utility
├── Dockerfile                   # Multi-stage build (frontend → backend)
├── docker-compose.yml           # Local dev: PostgreSQL 17 service
├── railway.json                 # Railway.app deployment config
├── requirements.txt             # Python dependencies
├── alembic.ini                  # Alembic migration config
├── start.sh                     # Production entry: migrations + uvicorn
└── frontend/
    ├── vite.config.js           # Vite config (proxy, versioning, chunking)
    ├── tailwind.config.js       # Tailwind config (custom CSS vars, colors)
    └── package.json             # Frontend dependencies
```

---

## Development Setup

### Prerequisites
- Python 3.12+
- Node.js 20+
- Docker + Docker Compose (for local PostgreSQL)

### Backend

```bash
# Start local PostgreSQL
docker compose up -d

# Install dependencies
pip install -r requirements.txt

# Set required environment variables
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/wealthapp"
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_ANON_KEY="your-anon-key"
export SUPABASE_SERVICE_ROLE_KEY="your-service-key"
export SUPABASE_JWT_SECRET="your-jwt-secret"
export STRIPE_SECRET_KEY="sk_test_..."
export STRIPE_WEBHOOK_SECRET="whsec_..."

# Run database migrations
alembic upgrade head

# Start dev server (auto-reload)
uvicorn backend.app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Copy and configure env
cp .env.example .env.local
# Edit .env.local: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY

# Start dev server (proxies /api/* to localhost:8000)
npm run dev

# Build for production
npm run build
```

The Vite dev server proxies `/api/*` requests to `http://127.0.0.1:8000` (configured in `vite.config.js`).

### Environment Variables

| Variable | Where Used | Description |
|---|---|---|
| `DATABASE_URL` | Backend | PostgreSQL connection string |
| `SUPABASE_URL` | Backend + Frontend | Supabase project URL |
| `SUPABASE_ANON_KEY` | Frontend (`VITE_SUPABASE_ANON_KEY`) | Supabase public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend | Supabase admin key (server-side only) |
| `SUPABASE_JWT_SECRET` | Backend | JWT secret for token verification |
| `STRIPE_SECRET_KEY` | Backend | Stripe API key |
| `STRIPE_WEBHOOK_SECRET` | Backend | Stripe webhook signature secret |
| `STRIPE_PRO_PRICE_ID` | Backend | Stripe price ID for Pro plan |

---

## Database

### Schema (models.py is the source of truth)

| Table | Purpose | Key Fields |
|---|---|---|
| `users` | User accounts | `id`, `username`, `supabase_user_id` (FK to Supabase), `stripe_customer_id`, `stripe_subscription_id` |
| `settings` | User preferences (1:1 with user) | `user_id` (UNIQUE), `base_currency`, `goal`, `theme_preference`, `is_pro`, `subscription_status`, `trial_end_iso` |
| `accounts` | Financial accounts | `user_id`, `name`, `type`, `currency`, `balance`, `include_in_net_worth`, `monthly_contribution`, `annual_interest_rate_percent` |
| `goals` | Financial goals | `user_id`, `goal_type`, `name`, `target_amount`, `current_age`, `target_age`, `monthly_contribution`, `expected_annual_return_pct`, `is_primary` |
| `snapshots` | Net worth history | `user_id`, `created_at`, `base_currency`, `total_base`, `fx_as_of`, `breakdown_json` |
| `fx_rate_cache` | Cached exchange rates | `cache_date` (YYYY-MM-DD), `base_currency`, `rates_json` |
| `analytics_events` | Event logging | `user_id`, `name`, `meta_json`, `created_at` |
| `stripe_events` | Webhook idempotency | `id` (= Stripe event ID) |

### Migrations

```bash
# Create a new migration
alembic revision --autogenerate -m "describe_change"

# Apply all pending migrations
alembic upgrade head

# Rollback one migration
alembic downgrade -1
```

**Important**: The app also calls `ensure_schema()` at startup which creates tables if missing and calls `_migrate_columns()` for schema evolution. Always create proper Alembic migrations for production changes — don't rely solely on `ensure_schema()`.

### Key Constraints
- `settings.user_id` is UNIQUE (enforces 1:1 user→settings)
- Each user has exactly one `is_primary = True` goal (enforced by `_ensure_primary_goal()` in `routers/goals.py`)
- FX rates stored as: `1 BASE = X QUOTE` (e.g., `{"USD": 1.366}` means 1 GBP = 1.366 USD)

---

## API Reference

All routes are prefixed with `/api`.

### Authentication
All endpoints except `/auth/register`, `/auth/login`, and `/health` require:
```
Authorization: Bearer <supabase-jwt>
```

### Key Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/auth/me` | Current user profile |
| GET | `/accounts` | List accounts |
| POST | `/accounts` | Create account |
| PATCH | `/accounts/:id` | Update account |
| DELETE | `/accounts/:id` | Delete account |
| GET | `/dashboard?range=1M` | Net worth + timeseries (ranges: 7D, 1M, 3M, 1Y, ALL) |
| GET | `/goals` | List goals |
| POST | `/goals` | Create goal |
| GET | `/goals/primary` | Get primary goal |
| GET | `/goals/:id/forecast` | Goal forecast (never returns 500) |
| PATCH | `/goals/:id` | Update goal |
| DELETE | `/goals/:id` | Delete goal |
| GET | `/settings` | User settings |
| PUT | `/settings` | Update settings |
| POST | `/snapshots` | Create snapshot |
| GET | `/snapshots` | List snapshots |
| GET | `/history/networth?days=90` | Historical net worth |
| GET | `/projection/networth?years=25` | Long-term projections |
| GET | `/fx/latest?base=GBP` | FX rates (daily-cached) |
| POST | `/billing/checkout` | Stripe checkout session |
| GET | `/billing/status` | Subscription status |
| GET | `/health` | Health check (no auth) |

---

## Code Conventions

### Backend (Python/FastAPI)

**File Organization**:
- One router file per domain in `backend/app/routers/`
- Pydantic schema naming: `{Entity}Create`, `{Entity}Patch`, `{Entity}Response`
- Private helper functions prefixed with underscore: `_ensure_primary_goal()`

**Patterns**:
```python
# Logger per module
logger = logging.getLogger("wealth.goals")

# Router dependency injection for auth
@router.get("/goals")
def list_goals(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ...

# Error handling — use HTTPException, not bare exceptions
raise HTTPException(status_code=404, detail="Goal not found")

# ORM serialization — models use ConfigDict(from_attributes=True)
class GoalResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
```

**Database Sessions**:
```python
# Always commit explicitly after mutations
db.add(obj)
db.commit()
db.refresh(obj)
```

**Financial Math**:
- Monthly rate: `annual_pct / 100 / 12`
- Compound growth: standard future-value formula
- All monetary amounts stored/returned as floats

### Frontend (React/JavaScript)

**File/Component Conventions**:
- Components: PascalCase files matching export (`Home.jsx` exports `Home`)
- Utilities: camelCase functions in `utils.js`
- Pages in `src/pages/`, reusable components in `src/components/`

**API Calls**:
```javascript
// Always use the api.js wrapper, not raw fetch
import { api } from '../api';

// api.js handles: auth headers, caching, 15s timeout, 401 event emission
const data = await api.get('/accounts');
await api.post('/accounts', { name: 'Savings', balance: 1000 });
```

**Styling**:
- Tailwind utility classes first
- Dark mode via `dark:` prefix classes
- CSS custom properties for dynamic theming (defined in `index.css`):
  - `--bg-rgb`, `--text-rgb`, `--accent-rgb` etc.

**State Management**:
- React Context for global state (auth, settings)
- `localStorage` for theme and token persistence
- No external state management library (no Redux, Zustand, etc.)

**Currency Formatting** (always use utils.js helpers):
```javascript
import { fmtCurrency, fmtCurrencyCompact } from '../utils';

fmtCurrency(12345.67, 'GBP')  // "£12,345.67"
fmtCurrencyCompact(1234567, 'USD')  // "$1.2M"
```

---

## Authentication Flow

1. User signs in via Supabase Auth UI (`src/pages/Auth.jsx`)
2. Supabase issues a JWT
3. Frontend stores token, injects it into all API requests via `api.js` token provider
4. Backend verifies JWT in `auth.py` using JWKS endpoint (ES256/RS256) with HS256 fallback
5. `get_current_user()` dependency resolves the Supabase user ID to internal `users` table record
6. New users are auto-created on first `/auth/me` call

**Note**: `/auth/register` and `/auth/login` endpoints return **410 Gone** — all authentication is handled by Supabase.

---

## Billing (Stripe)

- Pro plan managed via Stripe Subscriptions
- `settings.is_pro` and `settings.subscription_status` track subscription state
- Stripe webhooks update subscription status (idempotent via `stripe_events` table)
- Trial logic uses `settings.trial_end_iso` (ISO 8601 string)
- Pro-gated features check `settings.is_pro` on both frontend and backend

---

## Deployment

### Production (Railway.app)
```bash
# Railway auto-deploys from Dockerfile on push to master
# Manual deploy: use Railway CLI or dashboard
```

### Dockerfile
Multi-stage build:
1. **Stage 1** (Node 20-alpine): Builds frontend (`npm run build`)
2. **Stage 2** (Python 3.12-slim): Copies frontend dist, installs Python deps

### start.sh
Production startup sequence:
1. `alembic upgrade head` — run pending migrations
2. `uvicorn backend.app.main:app` — start API server

The backend serves the React SPA from `frontend/dist` for all non-API routes (configured in `main.py`).

---

## Key Architectural Decisions

1. **Single-process deployment**: Backend serves both API and frontend static files. No separate CDN/nginx needed for Railway.

2. **No dedicated snapshot scheduler**: Snapshots are created manually by users. The `/dashboard` endpoint computes live net worth from current account balances, while `/snapshots` stores point-in-time records.

3. **FX rate caching**: Rates are cached daily in `fx_rate_cache` table. Hardcoded fallback rates prevent failures if external FX API is down.

4. **Goal invariant**: Every user has exactly one `is_primary = True` goal. The `_ensure_primary_goal()` function enforces this after any create/delete/update operation.

5. **Supabase-only auth**: No local password management. `/auth/register` and `/auth/login` are deprecated (410 Gone).

6. **Frontend cache scoping**: `apiCache.js` namespaces cache keys by user ID to prevent cross-account data leakage on shared devices.

---

## Common Tasks

### Adding a New API Endpoint

1. Add route to appropriate file in `backend/app/routers/`
2. Define Pydantic request/response schemas
3. Register router in `backend/app/main.py` if it's a new router file
4. Add corresponding API call in `frontend/src/api.js` or call inline

### Adding a New Database Column

1. Add field to SQLModel class in `backend/app/models.py`
2. Create Alembic migration: `alembic revision --autogenerate -m "add_column_name"`
3. Review generated migration in `alembic/versions/`
4. Optionally add column to `_migrate_columns()` in `database.py` for safety

### Adding a New Page

1. Create `frontend/src/pages/NewPage.jsx`
2. Add route in `frontend/src/App.jsx`
3. Add navigation link to `Sidebar.jsx` and `BottomNav.jsx` if needed

### Adding a New Component

1. Create `frontend/src/components/NewComponent.jsx`
2. Use Tailwind classes + `dark:` variants for theming
3. Accept props for customization; avoid hardcoded strings

---

## Testing

There is currently no automated test suite. Manual smoke testing is documented in `STABILISATION.md`.

When adding tests in the future:
- Backend: use `pytest` with `httpx.AsyncClient` for API tests
- Frontend: use `vitest` (already compatible with Vite config)

---

## Important Files to Know

| File | Why It Matters |
|---|---|
| `backend/app/models.py` | Single source of truth for all DB tables |
| `backend/app/main.py` | App initialization, all routers registered here |
| `backend/app/auth.py` | Auth dependency used by every protected endpoint |
| `backend/app/routers/goals.py` | Complex business logic (forecasting, primary goal invariant) |
| `backend/app/routers/dashboard.py` | Core net worth computation with FX conversion |
| `frontend/src/App.jsx` | Auth context, all client-side routes |
| `frontend/src/api.js` | All HTTP communication — always use this, not raw fetch |
| `frontend/src/utils.js` | Currency/number formatting — always use these helpers |
| `frontend/src/pages/Home.jsx` | Main dashboard, milestone logic |
| `alembic/versions/` | Database migration history |
