"""Projection router.

GET /projection/networth?years=25
Returns aggregated net worth projection series + milestones.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session

from ..auth import get_current_user
from ..database import get_session
from ..models import User
from ..services.networth import compute_projection_series

router = APIRouter(prefix="/projection", tags=["projection"])


@router.get("/networth")
async def networth_projection(
    years: int = Query(default=25, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    result = await compute_projection_series(session, current_user.id, years=years)

    # Compute milestones (year 1, 5, 10, 15, 20, 25, 30, 40)
    points = result.get("points", [])
    milestones = []
    milestone_years = [1, 5, 10, 15, 20, 25, 30, 40]
    for my in milestone_years:
        month_idx = my * 12
        if month_idx < len(points):
            milestones.append({
                "year": my,
                "projected_net_worth": points[month_idx]["projected_net_worth"],
                "date": points[month_idx]["date"],
            })

    result["milestones"] = milestones
    return result
