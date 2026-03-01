# Stabilisation + Hero Contract + Version Badge

## Files changed (10 files)

### Phase 1: Stabilise permanently

#### 1. `backend/app/routers/goals.py` — GoalCreate/GoalUpdate defaults
**Change**: `monthly_contribution` default 500 → 0 in `GoalCreate` and `GoalUpdate` schemas.
**Why**: Aligns with single-step goal setup (no monthly contribution asked during onboarding).
**Already in place**: `_ensure_primary_goal` after create/patch/put/delete, repair-on-read in GET /primary, first-goal-forced-primary.

#### 2. `frontend/src/api.js` — No changes needed
Already correct: `ApiError` with `.status`, 401 → `auth:session-expired` event (de-duped).

#### 3. `frontend/src/App.jsx` — Bootstrap fix + data version counter
**Bootstrap fix**: `.catch()` on `/auth/me` now only calls `clearToken()` on 401. On 5xx/network errors, it preserves the token and sets `authed=true` optimistically so the user isn't kicked to login by a transient backend outage.
**Data version**: Added `dataVersion` counter + `bumpData()` to context. Any mutation in Accounts or Strategy bumps it, causing Home to reload its dashboard data.
**Also**: `resetSession()` now resets `dataVersion` to 0.

#### 4. `frontend/src/pages/GoalSetup.jsx` — Single-step form
**Change**: Removed 2-step flow entirely. All fields (name, current_age, target_age, target_amount, expected_annual_return_pct) are on one screen. No monthly_contribution input — defaults to 0 in the POST payload.
**Why**: "Goal setup should be single-step".

#### 5. `frontend/src/pages/Accounts.jsx` — Tab sync
**Change**: After `save()` and `del()`, calls `bumpData()` so Home dashboard reloads with fresh net worth.

#### 6. `frontend/src/pages/Strategy.jsx` — Tab sync
**Change**: After `applyAssumptions()` (PATCH goal), calls `bumpData()` so Home hero updates.

#### 7. `frontend/src/pages/Home.jsx` — Goal duality removed + dataVersion reload
**Change**: Now explicitly uses `data.primary_goal` (not legacy `data.goal` from settings). Added `dataVersion` to the `useEffect` dependency array so the dashboard reloads when accounts/goals change.

### Phase 2: Home hero contract

#### 8. `frontend/src/pages/Home.jsx` — Hero UI
**Changes**:
- Hero header changed from "Total Net Worth" to "Total Wealth"
- Added goal target line: `Goal: £1M`
- Added progress bar (h-2) in the hero card: current_net_worth / goal_target
- Derived `goalAchieved = total >= goalTarget`
- When achieved: subtle emerald ring on hero card + "Goal reached" badge with CheckCircle icon
- Progress bar turns emerald gradient when goal achieved
- Status line and forward anchor hidden when goal achieved (they're irrelevant)
- Quick Stats card also uses the same goalAchieved green styling

### Phase 3: Version badge

#### 9. `frontend/vite.config.js` — Version injection
**Change**: Reads version from `package.json` (or `VITE_APP_VERSION` env var override), injects as `__APP_VERSION__` via Vite's `define` option. Changes on every rebuild.

#### 10. `frontend/src/components/Sidebar.jsx` — Desktop badge
**Change**: Small `v1.0.0` badge in mono font, 20% opacity white, inline with the logo in the sidebar header.

#### 11. `frontend/src/App.jsx` — Mobile badge
**Change**: Small absolute-positioned version badge in top-right corner, visible only on mobile (`lg:hidden`). 25% opacity, non-interactive.

#### 12. `frontend/package.json` — Version bumped to `1.0.0`

---

## Smoke test checklist

| # | Test | Pass criteria |
|---|------|---------------|
| 1 | New user: complete goal setup | Single screen, no step 2. Creates goal, setup disappears, Home + Strategy work. |
| 2 | Login → refresh → still logged in | Token preserved, bootstrap succeeds, no flash to login. |
| 3 | Stop backend → refresh frontend | Token NOT cleared. App shows error/retry states. Recovers when backend returns. |
| 4 | Tamper token (edit in DevTools) | Next API call → 401 → session-expired event → reset to login. |
| 5 | Create 2nd goal, set as primary | Exactly one `is_primary=true` in DB. Old primary demoted. |
| 6 | Delete primary with others present | Another goal auto-promoted to primary. |
| 7 | Update account balance → Home | After save, switch to Home. Total wealth and progress bar reflect new balance. |
| 8 | Version badge visible | Desktop: `v1.0.0` next to logo in sidebar. Mobile: top-right corner. |
| 9 | Change version → rebuild | Update `package.json` or `VITE_APP_VERSION` env → badge shows new version. |
| 10 | `api()` throws with `.status` | `catch(e) { e.status }` returns HTTP status code. |
| 11 | Multiple rapid 401s | Only one session reset (de-duped `_sessionExpiredFired` flag). |
| 12 | Goal duality | Home hero never reads `data.goal` (legacy settings). Only `data.primary_goal`. |
