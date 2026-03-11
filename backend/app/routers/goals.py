"""
Goals router: CRUD for financial goals + forecast computation.

GET    /goals
POST   /goals
PATCH  /goals/{id}
PUT    /goals/{id}
DELETE /goals/{id}

✅ Apple-style:
GET    /goals/primary -> 200 with Goal OR 200 with null (no goal yet)
GET    /goals/{id}/forecast
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from ..auth import get_current_user
from ..database import get_session
from ..models import Goal, Account, Settings, User
from ..routers.fx import convert_to_base

router = APIRouter(prefix="/goals", tags=["goals"])
logger = logging.getLogger("wealth.goals")

# ─────────────────────────────────────────────────────────────
# Utilities
# ─────────────────────────────────────────────────────────────

def _monthly_rate(annual_percent: float) -> float:
    return (annual_percent / 100.0) / 12.0


def _future_value(pv: float, pmt: float, r: float, n: int) -> float:
    if n <= 0:
        return pv
    if r == 0:
        return pv + pmt * n
    return pv * (1 + r) ** n + pmt * (((1 + r) ** n - 1) / r)


async def _current_net_worth(session: Session, user: User, base_currency: str) -> float:
    from ..routers.fx import get_fx_cache

    accounts = session.exec(
        select(Account).where(
            Account.user_id == user.id,
            Account.include_in_net_worth == True,
        )
    ).all()

    fx_cache = await get_fx_cache(base_currency, session)
    rates = fx_cache.get_rates()

    total = 0.0
    for a in accounts:
        total += convert_to_base(
            amount=a.balance,
            from_currency=a.currency,
            base_currency=base_currency,
            rates=rates,
        )

    return total


def _ensure_primary_goal(session: Session, user_id: int) -> None:
    goals = session.exec(select(Goal).where(Goal.user_id == user_id)).all()
    if not goals:
        return

    primaries = [g for g in goals if g.is_primary]

    if len(primaries) == 1:
        return

    chosen = sorted(
        goals,
        key=lambda g: (g.updated_at or g.created_at or datetime.min),
        reverse=True,
    )[0]

    for g in goals:
        g.is_primary = g.id == chosen.id
        session.add(g)

    session.commit()


# ─────────────────────────────────────────────────────────────
# Forecast Engine (shared with dashboard)
# ─────────────────────────────────────────────────────────────

def compute_goal_forecast(
    goal: Goal,
    current_net_worth: float,
    base_currency: str,
    monthly_contribution: Optional[float] = None,
    expected_return: Optional[float] = None,
):
    from datetime import date as _date

    mc = float(monthly_contribution) if monthly_contribution is not None else float(goal.monthly_contribution or 0)
    er = float(expected_return) if expected_return is not None else float(goal.expected_annual_return_pct or 0)

    years_remaining = max(int(goal.target_age) - int(goal.current_age), 0)
    n = years_remaining * 12
    r = _monthly_rate(er)

    projected_end = _future_value(
        pv=current_net_worth,
        pmt=mc,
        r=r,
        n=n,
    )

    target = float(goal.target_amount or 0)

    if target <= 0:
        status = "on_track"
    elif projected_end >= target * 1.05:
        status = "ahead"
    elif projected_end >= target:
        status = "on_track"
    else:
        status = "adjust"

    def _add_months(d: _date, months: int) -> _date:
        y = d.year + (d.month - 1 + months) // 12
        m = (d.month - 1 + months) % 12 + 1
        return _date(y, m, 1)

    start = _date.today().replace(day=1)
    projected_points = []
    required_points = []
    balance = float(current_net_worth)

    hit_month = None

    for m in range(0, n + 1):
        dt_obj = _add_months(start, m)
        dt = dt_obj.isoformat()

        projected_points.append({"date": dt, "value": round(balance, 2)})

        if target > 0 and hit_month is None and balance >= target:
            hit_month = m

        req_value = current_net_worth + (target - current_net_worth) * (m / n) if n > 0 else target
        required_points.append({"date": dt, "value": round(req_value, 2)})

        if m < n:
            balance = balance * (1.0 + r) + mc

    freedom = None
    if target > 0 and hit_month is not None:
        hit_date = _add_months(start, hit_month)
        freedom = {
            "hit_month": int(hit_month),
            "hit_date": hit_date.isoformat(),
            "hit_year": int(hit_date.year),
            "years_to_goal": round(hit_month / 12.0, 1),
        }

    return {
        "status": status,
        "projected_end_value": float(projected_end),
        "years_remaining": years_remaining,
        "projected_points": projected_points,
        "required_points": required_points,
        "freedom": freedom,
    }


# ─────────────────────────────────────────────────────────────
# Schemas
# ─────────────────────────────────────────────────────────────

class GoalCreate(BaseModel):
    goal_type: str = "retirement"
    name: str = "Independence"
    target_amount: float
    current_age: int
    target_age: int
    monthly_contribution: float = 0.0
    expected_annual_return_pct: float = 7.0
    is_primary: bool = True


class GoalUpdate(BaseModel):
    goal_type: Optional[str] = None
    name: Optional[str] = None
    target_amount: Optional[float] = None
    current_age: Optional[int] = None
    target_age: Optional[int] = None
    monthly_contribution: Optional[float] = None
    expected_annual_return_pct: Optional[float] = None
    is_primary: Optional[bool] = None


# ─────────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────────

@router.get("", response_model=List[Goal])
def list_goals(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    return session.exec(select(Goal).where(Goal.user_id == current_user.id)).all()


# ✅ Apple-style: "missing" is not an error during onboarding
@router.get("/primary", response_model=Optional[Goal])
def get_primary_goal(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    _ensure_primary_goal(session, current_user.id)

    goal = session.exec(
        select(Goal).where(
            Goal.user_id == current_user.id,
            Goal.is_primary == True,
        )
    ).first()

    # 200 OK with null (JSON null) instead of 404
    if not goal:
        return None

    return goal


@router.post("", response_model=Goal)
def create_goal(
    body: GoalCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    goal = Goal(**body.model_dump(), user_id=current_user.id)

    session.add(goal)
    session.commit()
    session.refresh(goal)

    _ensure_primary_goal(session, current_user.id)

    return goal


@router.patch("/{goal_id}", response_model=Goal)
def update_goal_partial(
    goal_id: int,
    body: GoalUpdate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    goal = session.get(Goal, goal_id)

    if not goal or goal.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Goal not found")

    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(goal, k, v)

    goal.updated_at = datetime.now(timezone.utc)

    session.add(goal)
    session.commit()
    session.refresh(goal)

    _ensure_primary_goal(session, current_user.id)

    return goal


@router.put("/{goal_id}", response_model=Goal)
def update_goal_full(
    goal_id: int,
    body: GoalCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    goal = session.get(Goal, goal_id)

    if not goal or goal.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Goal not found")

    for k, v in body.model_dump().items():
        setattr(goal, k, v)

    goal.updated_at = datetime.now(timezone.utc)

    session.add(goal)
    session.commit()
    session.refresh(goal)

    _ensure_primary_goal(session, current_user.id)

    return goal


@router.delete("/{goal_id}")
def delete_goal(
    goal_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    goal = session.get(Goal, goal_id)

    if not goal or goal.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Goal not found")

    session.delete(goal)
    session.commit()

    _ensure_primary_goal(session, current_user.id)

    return {"ok": True}


@router.get("/{goal_id}/forecast")
async def goal_forecast(
    goal_id: int,
    monthly_contribution: Optional[float] = None,
    expected_return: Optional[float] = None,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    goal = session.get(Goal, goal_id)

    if not goal or goal.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Goal not found")

    settings = session.exec(
        select(Settings).where(Settings.user_id == current_user.id)
    ).first()

    base_currency = settings.base_currency if settings else "GBP"

    net_worth = await _current_net_worth(session, current_user, base_currency)

    result = compute_goal_forecast(
        goal=goal,
        current_net_worth=net_worth,
        base_currency=base_currency,
        monthly_contribution=monthly_contribution,
        expected_return=expected_return,
    )

    return {
        "goal": goal,
        "base_currency": base_currency,
        "current_net_worth": net_worth,
        **result,
    }