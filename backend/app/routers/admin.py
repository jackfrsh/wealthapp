import os
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select, func

from ..auth import get_current_user
from ..database import get_session
from ..models import User, Settings, AnalyticsEvent

router = APIRouter(prefix="/admin", tags=["admin"])

def _admin_emails() -> set[str]:
  raw = os.getenv("ADMIN_EMAILS", "").strip()
  if not raw:
    return set()
  return {e.strip().lower() for e in raw.split(",") if e.strip()}

def require_admin(current_user: User = Depends(get_current_user)) -> User:
  allow = _admin_emails()
  if not allow:
    raise HTTPException(status_code=500, detail="ADMIN_EMAILS not configured")
  # current_user.username appears to be email in your app
  if (current_user.username or "").lower() not in allow:
    raise HTTPException(status_code=403, detail="Admin only")
  return current_user

@router.get("/metrics")
def metrics(
  days: int = 7,
  _admin: User = Depends(require_admin),
  db: Session = Depends(get_session),
):
  days = max(1, min(int(days or 7), 90))
  since = datetime.now(timezone.utc) - timedelta(days=days)

  total_users = db.exec(select(func.count()).select_from(User)).one()
  pro_users = db.exec(
    select(func.count()).select_from(Settings).where(Settings.is_pro == True)
  ).one()

  events = db.exec(
    select(AnalyticsEvent.name, func.count())
    .where(AnalyticsEvent.created_at >= since)
    .group_by(AnalyticsEvent.name)
    .order_by(func.count().desc())
  ).all()

  # Quick funnel (distinct users)
  def distinct_users(name: str) -> int:
    return db.exec(
      select(func.count(func.distinct(AnalyticsEvent.user_id)))
      .where(AnalyticsEvent.name == name)
      .where(AnalyticsEvent.created_at >= since)
    ).one()

  funnel = {
    "signup": distinct_users("signup"),
    "goal_created": distinct_users("goal_created"),
    "account_added": distinct_users("account_added"),
    "projection_opened": distinct_users("projection_opened"),
    "upgrade_clicked": distinct_users("upgrade_clicked"),
    "checkout_started": distinct_users("checkout_started"),
    "upgrade_success": distinct_users("upgrade_success"),
  }

  return {
    "range_days": days,
    "since": since.isoformat(),
    "totals": {"users": total_users, "pro_users": pro_users},
    "events": [{"name": n, "count": c} for (n, c) in events],
    "funnel_distinct_users": funnel,
  }