"""Accounts router: CRUD for user accounts.

Minimal changes:
- Adds per-account projection inputs:
  - monthly_contribution
  - annual_interest_rate_percent
- Writes a net worth snapshot on create/update/delete.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from ..auth import get_current_user
from ..database import get_session
from ..models import Account, User
from ..services.networth import write_snapshot

router = APIRouter(prefix="/accounts", tags=["accounts"])


# ─── Schemas ─────────────────────────────────────────────────────────────────

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


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("", response_model=list[AccountResponse])
def list_accounts(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    return session.exec(select(Account).where(Account.user_id == current_user.id)).all()


@router.post("", response_model=AccountResponse, status_code=201)
async def create_account(
    body: AccountCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    account = Account(
        user_id=current_user.id,
        name=body.name.strip(),
        type=body.type,
        currency=body.currency.upper(),
        balance=body.balance,
        include_in_net_worth=body.include_in_net_worth,
        notes=body.notes,
        monthly_contribution=float(body.monthly_contribution or 0.0),
        annual_interest_rate_percent=float(body.annual_interest_rate_percent or 0.0),
        updated_at=datetime.utcnow(),
    )
    session.add(account)
    session.commit()
    session.refresh(account)

    # Snapshot on change
    await write_snapshot(session, current_user.id)
    return account


@router.patch("/{account_id}", response_model=AccountResponse)
async def update_account(
    account_id: int,
    body: AccountPatch,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    account = session.exec(
        select(Account).where(Account.id == account_id, Account.user_id == current_user.id)
    ).first()
    if not account:
        raise HTTPException(404, "Account not found")

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field == "currency" and value:
            value = value.upper()
        setattr(account, field, value)

    account.updated_at = datetime.utcnow()
    session.add(account)
    session.commit()
    session.refresh(account)

    await write_snapshot(session, current_user.id)
    return account


@router.delete("/{account_id}", status_code=204)
async def delete_account(
    account_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    account = session.exec(
        select(Account).where(Account.id == account_id, Account.user_id == current_user.id)
    ).first()
    if not account:
        raise HTTPException(404, "Account not found")

    session.delete(account)
    session.commit()

    await write_snapshot(session, current_user.id)
    return None
