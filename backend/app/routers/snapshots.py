"""Snapshots router: point-in-time net worth captures."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select
from sqlalchemy.exc import SQLAlchemyError

from ..auth import get_current_user
from ..database import get_session
from ..models import Snapshot, User
from ..services.networth import write_snapshot

router = APIRouter(prefix="/snapshots", tags=["snapshots"])


# ─── Schemas ────────────────────────────────────────────────────────────────

class BreakdownItem(BaseModel):
    id: int
    name: str
    currency: str
    balance: float
    value_base: float


class SnapshotResponse(BaseModel):
    id: int
    created_at: datetime
    base_currency: str
    total_base: float
    fx_as_of: str | None = None
    excluded_accounts: int = 0
    breakdown: list[BreakdownItem]


def _snapshot_to_response(snap: Snapshot) -> SnapshotResponse:
    breakdown_raw = snap.get_breakdown() if getattr(snap, "breakdown_json", None) else []
    breakdown = [BreakdownItem(**item) for item in breakdown_raw]
    return SnapshotResponse(
        id=snap.id,
        created_at=snap.created_at,
        base_currency=snap.base_currency,
        total_base=float(snap.total_base),
        fx_as_of=snap.fx_as_of,
        excluded_accounts=int(snap.excluded_accounts or 0),
        breakdown=breakdown,
    )


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.post("", response_model=SnapshotResponse, status_code=201)
async def create_snapshot(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    try:
        snap = await write_snapshot(session, current_user.id)
        return _snapshot_to_response(snap)
    except SQLAlchemyError as e:
        session.rollback()
        raise HTTPException(500, f"Snapshot failed: {e}")
    except Exception as e:
        session.rollback()
        raise HTTPException(500, f"Snapshot failed: {e}")


@router.get("", response_model=list[SnapshotResponse])
def list_snapshots(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    snaps = session.exec(
        select(Snapshot)
        .where(Snapshot.user_id == current_user.id)
        .order_by(Snapshot.created_at.desc())
    ).all()
    return [_snapshot_to_response(s) for s in snaps]


@router.get("/{snapshot_id}", response_model=SnapshotResponse)
def get_snapshot(
    snapshot_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    snap = session.exec(
        select(Snapshot).where(
            Snapshot.id == snapshot_id,
            Snapshot.user_id == current_user.id,
        )
    ).first()
    if not snap:
        raise HTTPException(404, "Snapshot not found")
    return _snapshot_to_response(snap)


@router.delete("/{snapshot_id}", status_code=204)
def delete_snapshot(
    snapshot_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    snap = session.exec(
        select(Snapshot).where(
            Snapshot.id == snapshot_id,
            Snapshot.user_id == current_user.id,
        )
    ).first()
    if not snap:
        raise HTTPException(404, "Snapshot not found")

    session.delete(snap)
    session.commit()
    return None
