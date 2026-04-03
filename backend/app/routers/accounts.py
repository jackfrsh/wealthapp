# backend/app/routers/accounts.py
"""
Accounts router: CRUD for user accounts.

- Includes projection inputs:
  - monthly_contribution
  - annual_interest_rate_percent
- Writes a net worth snapshot on create/update/delete (best-effort).
- Supports BOTH PATCH and PUT for updates to avoid frontend method mismatch.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlmodel import Session, select
from sqlalchemy.exc import SQLAlchemyError

from ..auth import get_current_user
from ..database import get_session
from ..models import Account, User
from ..services.networth import write_snapshot_background

router = APIRouter(prefix="/accounts", tags=["accounts"])


# ─── Schemas ────────────────────────────────────────────────────────────────

class AccountCreate(BaseModel):
    name: str
    type: str = "bank"
    currency: str = "GBP"
    balance: float = 0.0
    include_in_net_worth: bool = True
    notes: Optional[str] = None

    # Projection inputs
    monthly_contribution: float = 0.0
    annual_interest_rate_percent: float = 0.0


class AccountPatch(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    currency: Optional[str] = None
    balance: Optional[float] = None
    include_in_net_worth: Optional[bool] = None
    notes: Optional[str] = None

    monthly_contribution: Optional[float] = None
    annual_interest_rate_percent: Optional[float] = None


class AccountResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    type: str
    currency: str
    balance: float
    include_in_net_worth: bool
    notes: Optional[str]
    monthly_contribution: float
    annual_interest_rate_percent: float
    updated_at: datetime


# ─── Helpers ────────────────────────────────────────────────────────────────

def _get_account_or_404(session: Session, user_id: int, account_id: int) -> Account:
    account = session.exec(
        select(Account).where(Account.id == account_id, Account.user_id == user_id)
    ).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    return account


def _schedule_snapshot(user_id: int) -> None:
    """Fire-and-forget background snapshot. Never blocks the response."""
    write_snapshot_background(user_id)


def _apply_patch(account: Account, patch: dict) -> None:
    for field, value in patch.items():
        if field == "currency" and value:
            value = str(value).upper()

        if field == "type" and value:
            value = str(value).lower()

        if field == "balance" and value is not None:
            value = float(value)

        if field in ("monthly_contribution", "annual_interest_rate_percent") and value is not None:
            value = float(value)

        setattr(account, field, value)

    account.updated_at = datetime.now(timezone.utc)


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("", response_model=list[AccountResponse])
def list_accounts(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    return session.exec(select(Account).where(Account.user_id == current_user.id)).all()


@router.get("/{account_id}", response_model=AccountResponse)
def get_account(
    account_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    return _get_account_or_404(session, current_user.id, account_id)


@router.post("", response_model=AccountResponse, status_code=201)
async def create_account(
    body: AccountCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    # Enforce free-tier account limit
    from ..models import Settings

    settings = session.exec(select(Settings).where(Settings.user_id == current_user.id)).first()
    is_pro = bool(getattr(settings, "is_pro", False)) if settings else False

    if not is_pro:
        FREE_ACCOUNT_LIMIT = 3
        count = len(session.exec(select(Account).where(Account.user_id == current_user.id)).all())
        if count >= FREE_ACCOUNT_LIMIT:
            raise HTTPException(
                status_code=403,
                detail=f"Free accounts are limited to {FREE_ACCOUNT_LIMIT}. Upgrade to Pro for unlimited accounts.",
            )

    account = Account(
        user_id=current_user.id,
        name=body.name.strip(),
        type=(body.type or "bank").lower(),
        currency=(body.currency or "GBP").upper(),
        balance=float(body.balance or 0.0),
        include_in_net_worth=bool(body.include_in_net_worth),
        notes=body.notes,
        monthly_contribution=float(body.monthly_contribution or 0.0),
        annual_interest_rate_percent=float(body.annual_interest_rate_percent or 0.0),
        updated_at=datetime.now(timezone.utc),
    )

    session.add(account)
    session.commit()
    session.refresh(account)

    _schedule_snapshot(current_user.id)
    return account


# PATCH = partial update (recommended)
@router.patch("/{account_id}", response_model=AccountResponse)
async def patch_account(
    account_id: int,
    body: AccountPatch,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    account = _get_account_or_404(session, current_user.id, account_id)

    patch = body.model_dump(exclude_unset=True)
    _apply_patch(account, patch)

    session.add(account)
    session.commit()
    session.refresh(account)

    _schedule_snapshot(current_user.id)
    return account


# PUT = alias (accept it so frontend never 405s)
@router.put("/{account_id}", response_model=AccountResponse)
async def put_account(
    account_id: int,
    body: AccountPatch,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    # Treat PUT as "update these fields" (same as PATCH) for simplicity/stability.
    account = _get_account_or_404(session, current_user.id, account_id)

    patch = body.model_dump(exclude_unset=True)
    _apply_patch(account, patch)

    session.add(account)
    session.commit()
    session.refresh(account)

    _schedule_snapshot(current_user.id)
    return account


@router.delete("/{account_id}", status_code=204)
async def delete_account(
    account_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    account = _get_account_or_404(session, current_user.id, account_id)

    session.delete(account)
    session.commit()

    _schedule_snapshot(current_user.id)
    return None