"""
Insights router: automatic, computed insights.

GET /insights — returns a list of insight cards based on user data.

Design goals:
- Keep logic lightweight and safe (no heavy computation)
- Return enough insights so Pro can show 5+ consistently
- Never trust client for plan/tier. Frontend gates visibility.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from ..auth import get_current_user
from ..database import get_session
from ..models import Account, Goal, Settings, Snapshot, User
from ..routers.fx import convert_to_base, get_fx_cache
from ..routers.goals import compute_goal_forecast

router = APIRouter(prefix="/insights", tags=["insights"])


@router.get("")
async def get_insights(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    insights: list[dict] = []

    # ─── Gather data ─────────────────────────────────────────────────
    settings = session.exec(
        select(Settings).where(Settings.user_id == current_user.id)
    ).first()
    base_currency = (settings.base_currency if settings else "GBP").upper()

    # Milestone / next-step goal lives in Settings.goal
    milestone_goal = float(settings.goal) if (settings and settings.goal) else 0.0

    fx_cache = await get_fx_cache(base_currency, session)
    rates = fx_cache.get_rates()

    accounts = session.exec(
        select(Account).where(Account.user_id == current_user.id)
    ).all()
    included = [a for a in accounts if a.include_in_net_worth]
    excluded = [a for a in accounts if not a.include_in_net_worth]

    # Current net worth
    current_nw = 0.0
    per_account_base: list[tuple[str, float, str]] = []  # (name, value_in_base, type)
    for acc in included:
        try:
            val = convert_to_base(
                float(acc.balance), acc.currency.upper(), base_currency, rates
            )
            current_nw += val
            per_account_base.append((acc.name, float(val), acc.type))
        except Exception:
            pass

    # Snapshots for historical analysis
    snaps = session.exec(
        select(Snapshot)
        .where(Snapshot.user_id == current_user.id)
        .order_by(Snapshot.created_at.asc())
    ).all()

    # Primary (retirement) goal
    goal = session.exec(
        select(Goal).where(
            Goal.user_id == current_user.id,
            Goal.is_primary == True,
        )
    ).first()

    # ─── Progress insights ───────────────────────────────────────────
    if len(snaps) >= 2:
        first_snap = snaps[0]
        latest_snap = snaps[-1]
        total_change = current_nw - float(first_snap.total_base)
        days_tracked = max(1, (latest_snap.created_at - first_snap.created_at).days)

        if total_change > 0:
            insights.append({
                "category": "progress",
                "title": "Growing steadily",
                "body": f"Your net worth has grown by {_fmt(total_change, base_currency)} since you started tracking {days_tracked} days ago.",
                "tone": "positive",
                "action": None,
            })
        elif total_change < 0:
            insights.append({
                "category": "progress",
                "title": "Net worth change",
                "body": f"Your net worth has changed by {_fmt(total_change, base_currency)} over {days_tracked} days of tracking. Markets fluctuate — your plan is what matters.",
                "tone": "neutral",
                "action": None,
            })

        # 30-day momentum
        cutoff_30 = datetime.now(timezone.utc) - timedelta(days=30)
        snaps_30 = [s for s in snaps if _ensure_tz(s.created_at) >= cutoff_30]
        if len(snaps_30) >= 2:
            change_30 = float(snaps_30[-1].total_base) - float(snaps_30[0].total_base)
            if change_30 > 0:
                insights.append({
                    "category": "progress",
                    "title": "Positive momentum",
                    "body": f"Based on your records, your net worth increased {_fmt(change_30, base_currency)} in the last 30 days.",
                    "tone": "positive",
                    "action": None,
                })

    elif len(snaps) == 1:
        insights.append({
            "category": "progress",
            "title": "First record captured",
            "body": "You've started tracking. Record your net worth regularly to see trends over time.",
            "tone": "neutral",
            "action": None,
        })
    else:
        insights.append({
            "category": "progress",
            "title": "Start tracking",
            "body": "Record your net worth to begin seeing insights about your financial trajectory.",
            "tone": "neutral",
            "action": "record",
        })

    # ─── Milestone goal insights (Settings.goal) ──────────────────────
    if milestone_goal and milestone_goal > 0:
        if current_nw >= milestone_goal:
            insights.append({
                "category": "progress",
                "title": "Milestone reached",
                "body": f"You've reached your next-step goal of {_fmt(milestone_goal, base_currency)}. Consider increasing it to keep momentum.",
                "tone": "positive",
                "action": None,
            })
        else:
            remaining = max(0.0, milestone_goal - current_nw)
            pct = 0
            if milestone_goal > 0:
                pct = min(100, max(0, int(round((current_nw / milestone_goal) * 100))))
            insights.append({
                "category": "progress",
                "title": "Next milestone in view",
                "body": f"You're {pct}% of the way to your next-step goal. Remaining: {_fmt(remaining, base_currency)}.",
                "tone": "neutral",
                "action": None,
            })
    else:
        # Gentle nudge — milestone goal helps engagement
        insights.append({
            "category": "opportunity",
            "title": "Set a next-step milestone",
            "body": "Add a short-term milestone goal (e.g., £1k → £10k → £100k). It keeps progress tangible while your retirement plan runs in the background.",
            "tone": "neutral",
            "action": None,
        })

    # ─── Goal/trajectory insights (retirement goal) ───────────────────
    if goal:
        try:
            forecast = compute_goal_forecast(
                goal=goal,
                current_net_worth=current_nw,
                base_currency=base_currency,
            )

            status = forecast["status"]
            projected = forecast["projected_end_value"]
            target = goal.target_amount

            if status == "ahead":
                insights.append({
                    "category": "progress",
                    "title": "Ahead of plan",
                    "body": f"At your current pace, you're projected to exceed your {goal.name} target by {_fmt(projected - target, base_currency)}.",
                    "tone": "positive",
                    "action": "strategy",
                })
            elif status == "on_track":
                insights.append({
                    "category": "progress",
                    "title": "On track",
                    "body": f"Based on your current plan, you're on track to reach your {goal.name} goal of {_fmt(target, base_currency)}.",
                    "tone": "positive",
                    "action": "strategy",
                })
            else:
                gap = target - projected
                insights.append({
                    "category": "opportunity",
                    "title": "Room to adjust",
                    "body": f"At your current pace, you may fall short of your {goal.name} target by approximately {_fmt(gap, base_currency)}. Consider reviewing your plan.",
                    "tone": "neutral",
                    "action": "strategy",
                })
        except Exception:
            pass  # Skip goal insights if forecast fails
    else:
        insights.append({
            "category": "opportunity",
            "title": "Create a retirement plan",
            "body": "Set a primary goal to unlock projections and long-term trajectory insights.",
            "tone": "neutral",
            "action": "strategy",
        })

    # ─── Opportunity insights ─────────────────────────────────────────
    # Accounts without contributions
    no_contrib = [a for a in included if (a.monthly_contribution or 0) == 0 and (a.balance or 0) > 0]
    if len(no_contrib) > 0 and goal:
        names = ", ".join(a.name for a in no_contrib[:3])
        insights.append({
            "category": "opportunity",
            "title": "Contribution opportunity",
            "body": f"Accounts like {names} don't have monthly contributions set. Adding regular contributions can significantly improve your projected outcome.",
            "tone": "neutral",
            "action": "strategy",
        })

    # Accounts without return expectations
    no_return = [a for a in included if (a.annual_interest_rate_percent or 0) == 0 and (a.balance or 0) > 1000]
    if len(no_return) > 0 and len(no_return) != len(included):
        insights.append({
            "category": "opportunity",
            "title": "Return expectations",
            "body": f"{len(no_return)} account{'s' if len(no_return) > 1 else ''} without expected return rates. Setting these helps produce more accurate projections.",
            "tone": "neutral",
            "action": None,
        })

    # Excluded accounts note
    if len(excluded) > 0:
        insights.append({
            "category": "opportunity",
            "title": "Some accounts are excluded",
            "body": f"{len(excluded)} account{'s are' if len(excluded) > 1 else ' is'} excluded from net worth totals. Include them if you want a complete picture.",
            "tone": "neutral",
            "action": None,
        })

    # Concentration heuristic (top account share)
    if len(per_account_base) >= 2:
        per_account_base_sorted = sorted(per_account_base, key=lambda x: x[1], reverse=True)
        top_name, top_val, _ = per_account_base_sorted[0]
        if current_nw > 0:
            share = top_val / current_nw
            if share >= 0.60:
                insights.append({
                    "category": "discipline",
                    "title": "High concentration",
                    "body": f"{top_name} represents about {int(round(share*100))}% of your tracked net worth. Diversifying can reduce risk.",
                    "tone": "warning",
                    "action": None,
                })

    # Cash-drag heuristic (very rough): if lots of 'bank' vs others
    # (We only have account type strings; keep this gentle.)
    if current_nw > 0 and len(per_account_base) > 0:
        cash_like = sum(v for (_, v, t) in per_account_base if (t or "").lower() == "bank")
        if cash_like / current_nw >= 0.50 and current_nw >= 5000:
            insights.append({
                "category": "opportunity",
                "title": "Large cash allocation",
                "body": "A large portion of your tracked wealth is in bank accounts. If this is long-term money, consider whether it should be working harder.",
                "tone": "neutral",
                "action": None,
            })

    # ─── Discipline insights ─────────────────────────────────────────
    if len(snaps) >= 5:
        recent_30 = datetime.now(timezone.utc) - timedelta(days=30)
        recent_snaps = [s for s in snaps if _ensure_tz(s.created_at) >= recent_30]
        if len(recent_snaps) >= 3:
            insights.append({
                "category": "discipline",
                "title": "Consistent tracking",
                "body": f"You've recorded {len(recent_snaps)} snapshots in the last 30 days. Regular tracking builds clarity.",
                "tone": "positive",
                "action": None,
            })
    else:
        # Nudge if they have some data but not enough
        if 1 <= len(snaps) < 5:
            insights.append({
                "category": "discipline",
                "title": "Build the habit",
                "body": "Record snapshots regularly (e.g., weekly). Insights get much sharper once you have a small history.",
                "tone": "neutral",
                "action": "record",
            })

    # ─── Ensure we have enough insights (supply for Pro) ──────────────
    # Add lightweight, non-misleading fallbacks if user has limited data.
    MIN_INSIGHTS = 7
    if len(insights) < MIN_INSIGHTS:
        fallbacks = [
            {
                "category": "progress",
                "title": "Your plan is the edge",
                "body": "Short-term noise matters less than consistency. Keep contributions steady and review quarterly.",
                "tone": "neutral",
                "action": None,
            },
            {
                "category": "opportunity",
                "title": "Stress-test your assumptions",
                "body": "Try a lower expected return and see how your trajectory changes. It helps set realistic targets.",
                "tone": "neutral",
                "action": "strategy",
            },
            {
                "category": "discipline",
                "title": "One small improvement",
                "body": "Pick one action this week: increase a contribution, set an expected return, or record a snapshot.",
                "tone": "neutral",
                "action": None,
            },
        ]
        for fb in fallbacks:
            if len(insights) >= MIN_INSIGHTS:
                break
            insights.append(fb)

    return {
        "insights": insights,
        "current_net_worth": round(current_nw, 2),
        "base_currency": base_currency,
        "accounts_count": len(accounts),
        "has_goal": goal is not None,
    }


def _fmt(amount: float, ccy: str) -> str:
    """Simple server-side currency formatting."""
    symbols = {"GBP": "£", "USD": "$", "EUR": "€"}
    sym = symbols.get(ccy, f"{ccy} ")
    abs_amount = abs(amount)
    if abs_amount >= 1_000_000:
        formatted = f"{sym}{abs_amount / 1_000_000:,.2f}M"
    elif abs_amount >= 1_000:
        formatted = f"{sym}{abs_amount:,.0f}"
    else:
        formatted = f"{sym}{abs_amount:,.2f}"
    return f"-{formatted}" if amount < 0 else formatted


def _ensure_tz(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt
