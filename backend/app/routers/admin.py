import json
import os
from collections import Counter
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, func, select

from ..auth import get_current_user
from ..database import get_session
from ..models import Account, AnalyticsEvent, Goal, Settings, User

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
    if (current_user.username or "").lower() not in allow:
        raise HTTPException(status_code=403, detail="Admin only")
    return current_user


def _safe_int(value) -> int:
    try:
        return int(value or 0)
    except Exception:
        return 0


def _safe_meta(meta_json: str | None) -> dict:
    if not meta_json:
        return {}
    try:
        data = json.loads(meta_json)
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def _to_iso(dt):
    return dt.isoformat() if dt else None


def _distinct_users_for_names(db: Session, since: datetime, names: tuple[str, ...]) -> int:
    value = db.exec(
        select(func.count(func.distinct(AnalyticsEvent.user_id)))
        .where(AnalyticsEvent.created_at >= since)
        .where(AnalyticsEvent.name.in_(list(names)))
    ).one()
    return _safe_int(value)


@router.get("/metrics")
def metrics(
    days: int = 7,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_session),
):
    days = max(1, min(int(days or 7), 90))
    since = datetime.now(timezone.utc) - timedelta(days=days)

    total_users = _safe_int(db.exec(select(func.count(User.id))).one())
    pro_users = _safe_int(
        db.exec(
            select(func.count(Settings.id)).where(Settings.is_pro == True)  # noqa: E712
        ).one()
    )

    active_users = _safe_int(
        db.exec(
            select(func.count(func.distinct(AnalyticsEvent.user_id)))
            .where(AnalyticsEvent.created_at >= since)
        ).one()
    )

    event_counts = db.exec(
        select(AnalyticsEvent.name, func.count(AnalyticsEvent.id))
        .where(AnalyticsEvent.created_at >= since)
        .group_by(AnalyticsEvent.name)
        .order_by(func.count(AnalyticsEvent.id).desc())
    ).all()

    account_counts = {
        int(user_id): int(count)
        for user_id, count in db.exec(
            select(Account.user_id, func.count(Account.id))
            .group_by(Account.user_id)
        ).all()
    }

    goal_counts = {
        int(user_id): int(count)
        for user_id, count in db.exec(
            select(Goal.user_id, func.count(Goal.id))
            .group_by(Goal.user_id)
        ).all()
    }

    last_active_rows = db.exec(
        select(AnalyticsEvent.user_id, func.max(AnalyticsEvent.created_at))
        .group_by(AnalyticsEvent.user_id)
    ).all()
    last_active_by_user = {int(user_id): last_active for user_id, last_active in last_active_rows}

    settings_rows = db.exec(select(Settings)).all()
    settings_by_user = {int(s.user_id): s for s in settings_rows}

    page_view_rows = db.exec(
        select(AnalyticsEvent.user_id, AnalyticsEvent.meta_json)
        .where(AnalyticsEvent.created_at >= since)
        .where(AnalyticsEvent.name == "page_view")
    ).all()

    page_counter: Counter[str] = Counter()
    page_users: dict[str, set[int]] = {}
    page_views_per_user: Counter[int] = Counter()

    for user_id, meta_json in page_view_rows:
        user_id = int(user_id)
        meta = _safe_meta(meta_json)
        page = (meta.get("page") or meta.get("route") or meta.get("path") or "").strip()
        if not page:
            continue

        page = page[:80]
        page_counter[page] += 1
        page_views_per_user[user_id] += 1
        page_users.setdefault(page, set()).add(user_id)

    pages = [
        {
            "page": page,
            "views": count,
            "unique_users": len(page_users.get(page, set())),
        }
        for page, count in page_counter.most_common(12)
    ]

    funnel = {
        "signup": _distinct_users_for_names(db, since, ("signup",)),
        "goal_created": _distinct_users_for_names(db, since, ("goal_created",)),
        "account_added": _distinct_users_for_names(
            db, since, ("account_added", "account_created")
        ),
        "projection_opened": _distinct_users_for_names(db, since, ("projection_opened",)),
        "upgrade_clicked": _distinct_users_for_names(db, since, ("upgrade_clicked",)),
        "checkout_started": _distinct_users_for_names(db, since, ("checkout_started",)),
        "upgrade_success": _distinct_users_for_names(
            db, since, ("upgrade_success", "checkout_completed")
        ),
    }

    checkout_started_users = {
        int(user_id)
        for (user_id,) in db.exec(
            select(AnalyticsEvent.user_id)
            .where(AnalyticsEvent.created_at >= since)
            .where(AnalyticsEvent.name.in_(["checkout_started"]))
            .distinct()
        ).all()
    }

    converted_users = {
        int(user_id)
        for (user_id,) in db.exec(
            select(AnalyticsEvent.user_id)
            .where(AnalyticsEvent.created_at >= since)
            .where(AnalyticsEvent.name.in_(["upgrade_success", "checkout_completed"]))
            .distinct()
        ).all()
    }

    user_rows = db.exec(select(User)).all()

    users_with_accounts = sum(1 for count in account_counts.values() if count > 0)
    users_with_goals = sum(1 for count in goal_counts.values() if count > 0)

    funded_account_counts = [count for count in account_counts.values() if count > 0]
    avg_accounts_per_user = (
        round(sum(funded_account_counts) / len(funded_account_counts), 1)
        if funded_account_counts
        else 0
    )

    users = []
    for user in user_rows:
        uid = int(user.id)
        settings = settings_by_user.get(uid)
        last_active = last_active_by_user.get(uid)

        users.append(
            {
                "user_id": uid,
                "email": user.username,
                "created_at": _to_iso(user.created_at),
                "last_active_at": _to_iso(last_active),
                "account_count": account_counts.get(uid, 0),
                "goal_count": goal_counts.get(uid, 0),
                "has_goal": goal_counts.get(uid, 0) > 0,
                "is_pro": bool(settings.is_pro) if settings else False,
                "subscription_status": settings.subscription_status if settings else None,
                "trial_end_iso": settings.trial_end_iso if settings else None,
                "page_views": page_views_per_user.get(uid, 0),
                "checkout_started": uid in checkout_started_users,
                "converted": uid in converted_users or (bool(settings.is_pro) if settings else False),
            }
        )

    users.sort(
        key=lambda u: (
            u["last_active_at"] or "",
            u["created_at"] or "",
        ),
        reverse=True,
    )

    return {
        "range_days": days,
        "since": since.isoformat(),
        "totals": {
            "users": total_users,
            "pro_users": pro_users,
            "active_users": active_users,
            "users_with_accounts": users_with_accounts,
            "users_with_goals": users_with_goals,
            "avg_accounts_per_user": avg_accounts_per_user,
        },
        "events": [{"name": name, "count": int(count)} for (name, count) in event_counts],
        "funnel_distinct_users": funnel,
        "pages": pages,
        "users": users[:100],
    }