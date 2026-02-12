# wealth.

A premium personal net worth tracker with projections, snapshots, and multi-currency support.

## Architecture

| Layer | Stack |
|-------|-------|
| **Backend** | FastAPI · SQLModel · Alembic |
| **Database** | PostgreSQL (production) · SQLite (local dev) |
| **Frontend** | React 18 · Vite · Tailwind CSS · Recharts |
| **Auth** | JWT (pbkdf2_sha256 passwords) |
| **FX** | Daily-cached from open.er-api.com, hardcoded fallback rates |
| **Deploy** | Docker · Railway |

In production the Vite build is served from FastAPI — one process, one URL.

---

## Local Development

### Prerequisites

- Python 3.10+
- Node.js 18+

### 1. Backend

```bash
pip install -r requirements.txt

# Start (uses SQLite by default)
uvicorn backend.app.main:app --reload --port 8000
```

API docs: `http://localhost:8000/api/docs`

### 2. Frontend (dev server with hot-reload)

```bash
cd frontend
npm install
npm run dev          # → http://localhost:5173
```

Vite proxies `/api/*` to port 8000 automatically.

### 3. Migrations (local)

```bash
# Create tables via Alembic (SQLite)
alembic upgrade head

# After changing models, generate a new migration
alembic revision --autogenerate -m "describe change"
alembic upgrade head
```

---

## Deploy to Railway

### 1. Create Railway project

1. Go to [railway.app](https://railway.app) → **New Project**
2. Choose **Deploy from GitHub repo** → connect your repo
3. Railway auto-detects the `Dockerfile`

### 2. Add Postgres

1. In the project dashboard → **+ New** → **Database** → **PostgreSQL**
2. Railway auto-injects `DATABASE_URL` into your service's env vars.
   Verify: go to your service → **Variables** tab → `DATABASE_URL` should be set.

### 3. Set required env vars

In your service → **Variables** → add:

| Variable | Example | Required |
|----------|---------|----------|
| `JWT_SECRET` | `super-secret-random-string-here` | **Yes** |
| `DATABASE_URL` | *(auto-set by Postgres plugin)* | Auto |
| `CORS_ORIGINS` | `*` | No (default: `*`) |
| `PORT` | *(auto-set by Railway)* | Auto |

> Generate a good JWT_SECRET: `python -c "import secrets; print(secrets.token_urlsafe(48))"`

### 4. Deploy

Railway auto-builds on push. The `start.sh` script:
1. Runs `alembic upgrade head` (creates/updates tables)
2. Starts `uvicorn` on `0.0.0.0:$PORT`

### 5. Verify

Open your Railway-provided URL:
- App loads at `/`
- API docs at `/api/docs`
- Health check: `/api/health`

---

## Migrate local SQLite data to Railway Postgres

If you have existing data in `wealth.db`:

```bash
# Get your Railway Postgres URL from the dashboard
export DATABASE_URL="postgresql://user:pass@host:port/dbname"

# Ensure tables exist on Postgres
alembic upgrade head

# Run the migration script
python scripts/migrate_sqlite_to_pg.py
```

---

## Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `sqlite:///./wealth.db` | Database connection string |
| `JWT_SECRET` | dev fallback only | JWT signing key (**required in production**) |
| `CORS_ORIGINS` | `*` | Comma-separated allowed origins |
| `SQL_ECHO` | *(empty)* | Set to any value to log SQL queries |
| `PORT` | `8000` | Server port (Railway sets this) |

---

## API Routes

All API routes are prefixed with `/api`:

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Get JWT token |
| GET | `/api/auth/me` | Current user |
| GET | `/api/accounts` | List accounts |
| POST | `/api/accounts` | Create account |
| PATCH | `/api/accounts/:id` | Update account |
| DELETE | `/api/accounts/:id` | Delete account |
| GET | `/api/settings` | Get settings |
| PUT | `/api/settings` | Update settings |
| GET | `/api/dashboard?range=1M` | Dashboard data |
| POST | `/api/snapshots` | Create snapshot |
| GET | `/api/snapshots` | List snapshots |
| DELETE | `/api/snapshots/:id` | Delete snapshot |
| GET | `/api/history/networth?days=90` | Net worth history |
| GET | `/api/projection/networth?years=25` | Projections |
| GET | `/api/fx/latest?base=GBP` | FX rates |
| POST | `/api/fx/refresh?base=GBP` | Refresh FX |
| GET | `/api/health` | Health check |

---

## Beta Checklist

1. Register a new account → sign in
2. Add accounts (various types, currencies)
3. Create snapshots → verify chart shows data
4. Change base currency in Settings → all values convert
5. Toggle dark mode
6. Set a wealth goal → progress bar appears
7. View Projections page → milestone cards + chart
8. Delete an account → net worth updates
9. Sign out / sign back in → data persists
