"""Projection router.

GET /projection/networth?years=25
Returns aggregated net worth projection series + milestones.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from ..auth import get_current_user
from ..database import get_session
from ..models import ProjectionScenario, User
from ..services.networth import compute_projection_series
from sqlmodel import SQLModel

router = APIRouter(prefix="/projection", tags=["projection"])


class ProjectionScenarioCreate(SQLModel):
    name: str
    monthly_contribution: float = 0.0
    expected_annual_return_pct: float = 7.0
    notes: Optional[str] = None
    sort_order: int = 0


class ProjectionScenarioUpdate(SQLModel):
    name: Optional[str] = None
    monthly_contribution: Optional[float] = None
    expected_annual_return_pct: Optional[float] = None
    notes: Optional[str] = None
    sort_order: Optional[int] = None


@router.get("/networth")
async def networth_projection(
    years: int = Query(default=25, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    result = await compute_projection_series(session, current_user.id, years=years)

    raw_points = result.get("points", [])

    points = [
        {
            "date": p["date"],
            "value": p["projected_net_worth"],
        }
        for p in raw_points
    ]

    milestones = []
    milestone_years = [1, 5, 10, 15, 20, 25, 30, 40]

    for my in milestone_years:
        month_idx = my * 12
        if month_idx < len(raw_points):
            point = raw_points[month_idx]
            milestones.append(
                {
                    "label": f"Year {my}",
                    "amount": point["projected_net_worth"],
                    "date": point["date"],
                    "reached": False,
                    "year": my,
                    "projected_net_worth": point["projected_net_worth"],
                }
            )

    # Assumptions derived from real account data, not defaults.
    # weighted_avg_return_pct is None when no accounts have a non-zero balance.
    assumptions = {
        "monthlyContribution": result.get("total_monthly_contribution"),
        "expectedReturn": result.get("weighted_avg_return_pct"),
        "inflationRate": None,
    }

    return {
        "points": points,
        "milestones": milestones,
        "assumptions": assumptions,
    }


@router.get("/scenarios")
async def list_projection_scenarios(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    rows = session.exec(
        select(ProjectionScenario)
        .where(ProjectionScenario.user_id == current_user.id)
        .order_by(ProjectionScenario.sort_order, ProjectionScenario.created_at)
    ).all()

    return {
        "items": [
            {
                "id": row.id,
                "name": row.name,
                "monthly_contribution": row.monthly_contribution,
                "expected_annual_return_pct": row.expected_annual_return_pct,
                "notes": row.notes,
                "sort_order": row.sort_order,
                "created_at": row.created_at,
                "updated_at": row.updated_at,
            }
            for row in rows
        ]
    }


@router.post("/scenarios")
async def create_projection_scenario(
    payload: ProjectionScenarioCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    name = (payload.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Scenario name is required")

    existing_count = len(
        session.exec(
            select(ProjectionScenario).where(ProjectionScenario.user_id == current_user.id)
        ).all()
    )
    if existing_count >= 3:
        raise HTTPException(status_code=400, detail="You can save up to 3 scenarios")

    now = datetime.now(timezone.utc)

    row = ProjectionScenario(
        user_id=current_user.id,
        name=name,
        monthly_contribution=payload.monthly_contribution,
        expected_annual_return_pct=payload.expected_annual_return_pct,
        notes=payload.notes,
        sort_order=payload.sort_order,
        created_at=now,
        updated_at=now,
    )
    session.add(row)
    session.commit()
    session.refresh(row)

    return {
        "id": row.id,
        "name": row.name,
        "monthly_contribution": row.monthly_contribution,
        "expected_annual_return_pct": row.expected_annual_return_pct,
        "notes": row.notes,
        "sort_order": row.sort_order,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


@router.patch("/scenarios/{scenario_id}")
async def update_projection_scenario(
    scenario_id: int,
    payload: ProjectionScenarioUpdate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    row = session.get(ProjectionScenario, scenario_id)
    if not row or row.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Scenario not found")

    updates = payload.model_dump(exclude_unset=True)

    if "name" in updates:
        name = (updates["name"] or "").strip()
        if not name:
            raise HTTPException(status_code=400, detail="Scenario name is required")
        row.name = name

    if "monthly_contribution" in updates:
        row.monthly_contribution = float(updates["monthly_contribution"] or 0)

    if "expected_annual_return_pct" in updates:
        row.expected_annual_return_pct = float(updates["expected_annual_return_pct"] or 0)

    if "notes" in updates:
        row.notes = updates["notes"]

    if "sort_order" in updates:
        row.sort_order = int(updates["sort_order"] or 0)

    row.updated_at = datetime.now(timezone.utc)

    session.add(row)
    session.commit()
    session.refresh(row)

    return {
        "id": row.id,
        "name": row.name,
        "monthly_contribution": row.monthly_contribution,
        "expected_annual_return_pct": row.expected_annual_return_pct,
        "notes": row.notes,
        "sort_order": row.sort_order,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


@router.delete("/scenarios/{scenario_id}")
async def delete_projection_scenario(
    scenario_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    row = session.get(ProjectionScenario, scenario_id)
    if not row or row.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Scenario not found")

    session.delete(row)
    session.commit()
    return {"ok": True}