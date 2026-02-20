"""History router.

GET /history/networth?days=90
Returns latest snapshot per day.
"""

from __future__ import annotations

from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlmodel import Session, select

from ..auth import get_current_user
from ..database import get_session
from ..models import Snapshot, User

router = APIRouter(prefix="/history", tags=["history"])


class NetWorthPoint(BaseModel):
    date: str  # ISO YYYY-MM-DD
    net_worth: float


class NetWorthHistoryResponse(BaseModel):
    days: int
    latest_date: str | None = None
    points: list[NetWorthPoint]


@router.get("/networth", response_model=NetWorthHistoryResponse)
def networth_history(
    days: int = 90,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    # Clamp days to keep response bounded
    if days < 1:
        days = 1
    if days > 3650:
        days = 3650

    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    snaps = session.exec(
        select(Snapshot)
        .where(Snapshot.user_id == current_user.id)
        .order_by(Snapshot.created_at.desc())
    ).all()

    latest_by_day: dict[str, Snapshot] = {}
    for s in snaps:
        dt = s.created_at
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        if dt < cutoff:
            continue
        day = dt.date().isoformat()
        # snaps are desc, so first seen per day is latest
        if day not in latest_by_day:
            latest_by_day[day] = s

    days_sorted = sorted(latest_by_day.keys())
    points = [
        NetWorthPoint(date=d, net_worth=float(latest_by_day[d].total_base))
        for d in days_sorted
    ]

    return NetWorthHistoryResponse(
        days=days,
        latest_date=days_sorted[-1] if days_sorted else None,
        points=points,
    )
