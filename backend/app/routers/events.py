import json
from datetime import datetime, timezone
from typing import Any, Dict, Literal, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field as PydField
from sqlmodel import Session, select

from ..auth import get_current_user
from ..database import get_session
from ..models import AnalyticsEvent, User

router = APIRouter(prefix="/events", tags=["events"])

# Keep this strict. Add names deliberately, not freeform.
EventName = Literal[
    "signup",
    "page_view",
    "goal_created",
    "goal_updated",
    "account_added",
    "account_created",
    "account_updated",
    "account_deleted",
    "projection_opened",
    "upgrade_viewed",
    "upgrade_clicked",
    "checkout_started",
    "checkout_completed",
    "upgrade_success",
    "billing_portal_opened",
    "dashboard_loaded",
    "insights_viewed",
    "settings_updated",
]

MAX_META_KEYS = 25
MAX_META_JSON_BYTES = 1500
MAX_STR_LEN = 120


class EventIn(BaseModel):
    name: EventName
    page: Optional[str] = None
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None
    meta: Optional[Dict[str, Any]] = PydField(default=None)


def _clean_short_str(value: Any, limit: int = MAX_STR_LEN) -> Optional[str]:
    if not isinstance(value, str):
        return None
    value = value.strip()
    if not value:
        return None
    return value[:limit]


def _sanitize_meta(
    meta: Optional[Dict[str, Any]],
    *,
    page: Optional[str] = None,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
) -> str:
    clean: Dict[str, Any] = {}

    if isinstance(meta, dict):
        items = list(meta.items())[:MAX_META_KEYS]

        for k, v in items:
            if not isinstance(k, str):
                continue

            key = k.strip()[:64]
            if not key:
                continue

            if isinstance(v, (str, int, float, bool)) or v is None:
                clean[key] = v
            elif isinstance(v, list):
                clean[key] = v[:25]
            elif isinstance(v, dict):
                nested: Dict[str, Any] = {}
                for kk, vv in list(v.items())[:25]:
                    if isinstance(vv, (str, int, float, bool)) or vv is None:
                        nested[str(kk)[:64]] = vv
                clean[key] = nested

    page_value = _clean_short_str(page)
    entity_type_value = _clean_short_str(entity_type)
    entity_id_value = _clean_short_str(entity_id)

    if page_value and "page" not in clean:
        clean["page"] = page_value
    if entity_type_value and "entity_type" not in clean:
        clean["entity_type"] = entity_type_value
    if entity_id_value and "entity_id" not in clean:
        clean["entity_id"] = entity_id_value

    raw = json.dumps(clean, separators=(",", ":"), ensure_ascii=False)
    if len(raw.encode("utf-8")) > MAX_META_JSON_BYTES:
        return "{}"

    return raw


@router.post("")
def log_event(
    body: EventIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
):
    evt = AnalyticsEvent(
        user_id=current_user.id,
        name=body.name,
        meta_json=_sanitize_meta(
            body.meta,
            page=body.page,
            entity_type=body.entity_type,
            entity_id=body.entity_id,
        ),
        created_at=datetime.now(timezone.utc),
    )
    db.add(evt)
    db.commit()
    return {"ok": True}


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