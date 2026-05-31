"""
Tests for POST /accounts/{account_id}/review — Quick Update mark-reviewed endpoint.

Covers:
- reviewing an account updates updated_at
- reviewing does not change balance
- reviewing does not change account_subtype
- reviewing a nil-subtype (legacy) account works
- reviewing another user's account is 404 (consistent with existing auth style)
- unauthenticated review is rejected
- review endpoint returns AccountResponse shape
- existing PATCH/PUT tests are unaffected (subtype suite still passes is verified by
  running that suite; this file only tests the new endpoint)
"""

from __future__ import annotations

import os
import sys
from datetime import datetime, timezone

import pytest

_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
if _REPO_ROOT not in sys.path:
    sys.path.insert(0, _REPO_ROOT)

os.environ.setdefault("DATABASE_URL", "sqlite:///./test_review.db")
os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_JWT_SECRET", "test-secret-at-least-32-chars-long-padding")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")


# ─── Fixtures ────────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def test_app():
    from sqlmodel import SQLModel, Session, create_engine
    from fastapi.testclient import TestClient

    engine = create_engine(
        "sqlite:///./test_review_int.db",
        connect_args={"check_same_thread": False},
    )

    import backend.app.database as db_module
    original_engine = db_module.engine
    db_module.engine = engine

    import backend.app.models  # noqa: F401
    SQLModel.metadata.create_all(engine)

    def override_session():
        with Session(engine) as session:
            yield session

    from backend.app.main import app as fastapi_app
    from backend.app.database import get_session
    fastapi_app.dependency_overrides[get_session] = override_session

    client = TestClient(fastapi_app, raise_server_exceptions=True)
    yield client, engine

    db_module.engine = original_engine
    fastapi_app.dependency_overrides.clear()

    import os as _os
    for f in ("./test_review.db", "./test_review_int.db"):
        try:
            _os.unlink(f)
        except FileNotFoundError:
            pass


@pytest.fixture()
def db_session(test_app):
    from sqlmodel import Session
    _, engine = test_app
    with Session(engine) as session:
        yield session


def _make_pro_user(db_session, uid: str):
    from backend.app.models import User, Settings
    from sqlmodel import select

    existing = db_session.exec(select(User).where(User.supabase_user_id == uid)).first()
    if existing:
        return existing

    user = User(username=f"review-user-{uid}", supabase_user_id=uid)
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    db_session.add(Settings(user_id=user.id, is_pro=True))
    db_session.commit()
    return user


def _auth(app, uid: str):
    from fastapi import Depends
    from sqlmodel import Session, select
    from backend.app.models import User
    from backend.app.database import get_session
    from backend.app.auth import get_current_user

    def _dep(db: Session = Depends(get_session)):
        return db.exec(select(User).where(User.supabase_user_id == uid)).first()

    app.dependency_overrides[get_current_user] = _dep


def _clear_auth(app):
    from backend.app.auth import get_current_user
    app.dependency_overrides.pop(get_current_user, None)


def _create_account(client, db_session, uid: str, *, balance: float = 5000.0, subtype=None):
    _make_pro_user(db_session, uid)
    _auth(client.app, uid)
    resp = client.post("/api/accounts", json={
        "name": "Review Target",
        "type": "bank",
        "currency": "GBP",
        "balance": balance,
        "account_subtype": subtype,
    })
    assert resp.status_code == 201, resp.text
    return resp.json()


# ─── Tests ───────────────────────────────────────────────────────────────────

class TestReviewUpdatesTimestamp:
    UID = "review-ts-001"

    def test_review_updates_updated_at(self, test_app, db_session):
        client, engine = test_app
        acct = _create_account(client, db_session, self.UID, balance=3000.0)
        acct_id = acct["id"]
        original_ts = acct["updated_at"]

        import time; time.sleep(0.01)  # ensure clock advances on fast systems

        resp = client.post(f"/api/accounts/{acct_id}/review")
        assert resp.status_code == 200, resp.text
        new_ts = resp.json()["updated_at"]
        assert new_ts != original_ts, "updated_at must advance after review"


class TestReviewPreservesData:
    UID = "review-preserve-001"

    def test_review_does_not_change_balance(self, test_app, db_session):
        client, _ = test_app
        acct = _create_account(client, db_session, self.UID, balance=12345.67)
        acct_id = acct["id"]

        resp = client.post(f"/api/accounts/{acct_id}/review")
        assert resp.status_code == 200, resp.text
        assert resp.json()["balance"] == 12345.67

    def test_review_does_not_change_account_subtype(self, test_app, db_session):
        client, _ = test_app
        acct = _create_account(client, db_session, self.UID, subtype="savings")
        acct_id = acct["id"]

        resp = client.post(f"/api/accounts/{acct_id}/review")
        assert resp.status_code == 200, resp.text
        assert resp.json()["account_subtype"] == "savings"

    def test_review_nil_subtype_legacy_account_works(self, test_app, db_session):
        """Legacy accounts with no subtype must be reviewable without error."""
        client, engine = test_app
        _make_pro_user(db_session, self.UID)
        _auth(client.app, self.UID)

        # Seed a legacy account directly via ORM (as real prod accounts exist)
        from backend.app.models import Account, User
        from sqlmodel import Session, select
        with Session(engine) as s:
            user = s.exec(select(User).where(User.supabase_user_id == self.UID)).first()
            legacy = Account(
                user_id=user.id,
                name="Legacy Savings",
                type="bank",
                currency="GBP",
                balance=2000.0,
                # account_subtype intentionally omitted — defaults to None
            )
            s.add(legacy)
            s.commit()
            s.refresh(legacy)
            legacy_id = legacy.id

        resp = client.post(f"/api/accounts/{legacy_id}/review")
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["account_subtype"] is None
        assert data["balance"] == 2000.0


class TestReviewReturnsAccountResponse:
    UID = "review-shape-001"

    def test_review_returns_account_response_shape(self, test_app, db_session):
        client, _ = test_app
        acct = _create_account(client, db_session, self.UID, balance=9999.0, subtype="cash_isa")
        acct_id = acct["id"]

        resp = client.post(f"/api/accounts/{acct_id}/review")
        assert resp.status_code == 200, resp.text
        data = resp.json()

        # All AccountResponse fields must be present
        for field in ("id", "name", "type", "currency", "balance",
                      "include_in_net_worth", "notes", "account_subtype",
                      "monthly_contribution", "annual_interest_rate_percent",
                      "updated_at"):
            assert field in data, f"AccountResponse missing field '{field}'"

        assert data["id"] == acct_id
        assert data["balance"] == 9999.0
        assert data["account_subtype"] == "cash_isa"


class TestReviewAuthorisation:
    UID_OWNER = "review-auth-owner-001"
    UID_OTHER = "review-auth-other-001"

    def test_review_another_users_account_returns_404(self, test_app, db_session):
        """Ownership is enforced: another user's account looks like 404."""
        client, _ = test_app

        # Create account as owner
        acct = _create_account(client, db_session, self.UID_OWNER, balance=500.0)
        acct_id = acct["id"]

        # Switch to a different authenticated user
        _make_pro_user(db_session, self.UID_OTHER)
        _auth(client.app, self.UID_OTHER)

        resp = client.post(f"/api/accounts/{acct_id}/review")
        assert resp.status_code == 404, (
            f"Expected 404 for another user's account, got {resp.status_code}: {resp.text}"
        )

    def test_review_unauthenticated_is_rejected(self, test_app, db_session):
        """No auth token → 401 or 403."""
        client, _ = test_app

        # Create account as owner first
        acct = _create_account(client, db_session, self.UID_OWNER, balance=500.0)
        acct_id = acct["id"]

        # Remove auth override to simulate an unauthenticated request
        _clear_auth(client.app)

        resp = client.post(f"/api/accounts/{acct_id}/review")
        assert resp.status_code in (401, 403), (
            f"Expected 401/403 for unauthenticated request, got {resp.status_code}: {resp.text}"
        )
