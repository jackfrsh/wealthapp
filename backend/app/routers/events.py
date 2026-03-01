import json
from datetime import datetime, timezone
from typing import Any, Dict, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field as PydField
from sqlmodel import Session, select

from ..auth import get_current_user
from ..database import get_session
from ..models import AnalyticsEvent, User

router = APIRouter(prefix="/events", tags=["events"])

# Keep this strict. You can add more later, but don’t allow freeform “anything”.
EventName = Literal[
    "signup",
    "goal_created",
    "account_added",
    "projection_opened",
    "upgrade_clicked",
    "checkout_started",
    "upgrade_success",
]

# Cap payload size: keep this lightweight and non-sensitive.
MAX_META_KEYS = 25
MAX_META_JSON_BYTES = 1500


class EventIn(BaseModel):
    name: EventName
    meta: Optional[Dict[str, Any]] = PydField(default=None)


def _sanitize_meta(meta: Optional[Dict[str, Any]]) -> str:
    if not meta:
        return "{}"
    if not isinstance(meta, dict):
        return "{}"

    # Limit keys
    items = list(meta.items())[:MAX_META_KEYS]
    clean: Dict[str, Any] = {}

    for k, v in items:
        # Keep keys short + safe
        if not isinstance(k, str):
            continue
        k2 = k.strip()[:64]
        if not k2:
            continue

        # Only allow JSON-serializable primitives + small lists/dicts
        if isinstance(v, (str, int, float, bool)) or v is None:
            clean[k2] = v
        elif isinstance(v, list):
            clean[k2] = v[:25]  # cap list length
        elif isinstance(v, dict):
            # shallow dict only
            clean[k2] = {str(kk)[:64]: vv for kk, vv in list(v.items())[:25]}
        else:
            # drop weird objects
            continue

    raw = json.dumps(clean, separators=(",", ":"), ensure_ascii=False)
    if len(raw.encode("utf-8")) > MAX_META_JSON_BYTES:
        # If too big, drop meta entirely
        return "{}"
    return raw


@router.post("")
def log_event(
    body: EventIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
):
    # OPTIONAL: if you add an opt-out flag later, enforce it here.
    # e.g. if settings.analytics_opt_out: return {"ok": True}

    evt = AnalyticsEvent(
        user_id=current_user.id,
        name=body.name,
        meta_json=_sanitize_meta(body.meta),
        created_at=datetime.now(timezone.utc),
    )
    db.add(evt)
    db.commit()
    return {"ok": True}


# Optional (admin/debug): list recent events for the authed user
@router.get("/mine")
def list_my_events(
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
):
    limit = max(1, min(int(limit or 50), 200))
    rows = db.exec(
        select(AnalyticsEvent)
        .where(AnalyticsEvent.user_id == current_user.id)
        .order_by(AnalyticsEvent.created_at.desc())
        .limit(limit)
    ).all()

    return [
        {
            "id": r.id,
            "name": r.name,
            "created_at": r.created_at,
            "meta": r.get_meta(),
        }
        for r in rows
    ]