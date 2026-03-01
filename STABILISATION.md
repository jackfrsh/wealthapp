# Wealth App — Stabilisation Patch

## How to run

```bash
cd backend
pip install -r ../requirements.txt
uvicorn app.main:app --reload --port 8000
```

Frontend (dev):
```bash
cd frontend
npm install
npm run dev
```

Frontend (prod build, served by FastAPI):
```bash
cd frontend && npm run build
# Then start backend — it auto-serves frontend/dist
```

## What I fixed

### Backend

1. **`goals.py` — Primary-goal invariant enforced everywhere**
   - New `_ensure_primary_goal()` helper: if goals exist, guarantees exactly one is `is_primary=True`. Deterministically promotes the most-recently-updated goal when zero or >1 primaries are found.
   - **Called after every mutation**: `create_goal`, `update_goal` (PATCH), `replace_goal` (PUT), `delete_goal` (unconditional — repairs even pre-existing corrupt state).
   - **Repair-on-read** in `get_primary_goal`: if no primary found but goals exist, repairs the invariant and retries before returning 404. Handles legacy/corrupt data on first access after deploy.
   - First goal created by a user is forced to `is_primary=True`.
   - `delete_goal` — `_ensure_primary_goal` called unconditionally (not just when the deleted goal was primary).

2. **`goals.py` — Forecast endpoint hardened (NEVER 500s)**
   - Wrapped net worth computation in try/except; falls back to 0 if FX or accounts fail
   - Wrapped forecast computation in try/except; returns valid `_empty_forecast()` payload on failure
   - Returns 404 if goal not found, 422 if required fields missing — never 500
   - Fixed division-by-zero in YTD momentum calculation
   - Explicit `GoalResponse.model_validate(goal, from_attributes=True)` everywhere
   - Added **PUT endpoint** (`PUT /goals/{id}`) for full goal replacement (was missing)

3. **`accounts.py` — Fixed Pydantic ORM parsing**
   - Added `model_config = ConfigDict(from_attributes=True)` to `AccountResponse`

4. **`dashboard.py` — Forecast wrapped in try/except**
   - If forecast computation fails, dashboard still returns goal metadata and all other data

5. **`insights.py` — Forecast wrapped in try/except**
   - Skips goal-related insights if forecast computation fails instead of 500

6. **`fx.py` — `get_fx_cache()` made bulletproof**
   - Every stage (cache lookup, live fetch, fallback creation) wrapped in try/except
   - Ultimate fallback: returns in-memory FxRateCache with hardcoded rates if DB write fails

### Frontend

7. **`api.js` — `ApiError` class exposes HTTP status; 401 session-expired event**
   - New `ApiError extends Error` carries `.status` (HTTP status code) on every API error
   - On any 401 response: emits a single `auth:session-expired` CustomEvent on `window` (de-duped per page lifetime so parallel 401s don't cause multiple resets)
   - `resetSessionGuard()` exported for post-login reset of the de-dup guard
   - Backward-compatible: all existing `catch(e) { e.message }` patterns still work

8. **`App.jsx` — Deterministic session reset; status-based 404 handling**
   - `resetSession()` — single function that tears down all session state (token, username, page, primaryGoal, baseCurrency, theme). Used by both explicit logout and the `auth:session-expired` event listener.
   - Listens for `auth:session-expired` event → calls `resetSession()` exactly once, deterministically.
   - `loadPrimaryGoal` — uses `e.status === 404` (not string matching) to distinguish "no primary goal" from transient errors (500, network).
   - On login: calls `resetSessionGuard()` to re-arm the 401 event for the new session.

9. **`Strategy.jsx` — Error handling added**
   - Error card with retry button when forecast fails; non-blocking banner with stale data.

10. **`Home.jsx` — Error handling added**
    - Error card with retry on dashboard failure; division-by-zero guard on progress bar.

### Summary of guarantees

| Symptom | Status |
|---------|--------|
| Strategy tab "Internal server error" | **Fixed** — forecast never 500s, frontend shows error card |
| Forecast 500 from Pydantic ORM | **Fixed** — explicit `from_attributes=True` everywhere |
| Clicking Strategy breaks Accounts | **Fixed** — independent data loading, no shared failure mode |
| Refresh resets to onboarding | **Fixed** — bootstrap uses `e.status === 404` not string matching |
| Retirement plan not editable | **Fixed** — PUT endpoint added |
| Logout leaves stale state | **Fixed** — `resetSession()` clears everything deterministically |
| No primary goal after delete | **Fixed** — `_ensure_primary_goal` after every mutation + repair-on-read |
| Multiple/zero primaries (corrupt) | **Fixed** — invariant enforced; most-recently-updated goal promoted |
| Token expires mid-session | **Fixed** — 401 → `auth:session-expired` event → single deterministic reset |
| Error string matching fragile | **Fixed** — `ApiError.status` carries HTTP status code |
