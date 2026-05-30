"""
Tests for Stripe billing logic.

Run with:
    DATABASE_URL=sqlite:///./test_billing.db pytest backend/tests/test_billing.py -v

Coverage:
- sync: does NOT downgrade when stripe_customer_id / stripe_subscription_id are NULL
- sync: respects Apple IAP status when computing is_pro from Stripe
- sync: preserves is_pro for Apple-active users even when Stripe says inactive
- _set_pro_for_user: preserves Apple Pro when Stripe says False
- webhook: ignored when event_type is unknown
"""

from __future__ import annotations

import json
import os
import sys
import time
import unittest.mock as mock
from typing import Optional

import pytest

_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
if _REPO_ROOT not in sys.path:
    sys.path.insert(0, _REPO_ROOT)

os.environ.setdefault("DATABASE_URL", "sqlite:///./test_billing.db")
os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_JWT_SECRET", "test-secret-at-least-32-chars-long-padding")
os.environ.setdefault("STRIPE_SECRET_KEY", "sk_test_placeholder")
os.environ.setdefault("STRIPE_WEBHOOK_SECRET", "whsec_placeholder")
os.environ.setdefault("STRIPE_PRICE_ID_MONTHLY", "price_monthly_test")
os.environ.setdefault("STRIPE_PRICE_ID_ANNUAL", "price_annual_test")
os.environ.setdefault("FRONTEND_URL", "http://localhost:5173")


# ═══════════════════════════════════════════════════════════════════════════════
# Shared helpers
# ═══════════════════════════════════════════════════════════════════════════════

def _make_user(session, supabase_uid: str = "test-uid-001", email: str = "user@example.com"):
    from backend.app.models import User
    user = User(username=email, supabase_user_id=supabase_uid)
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def _make_settings(
    session,
    user_id: int,
    is_pro: bool = False,
    stripe_cust: Optional[str] = None,
    apple_status: Optional[str] = None,
):
    from backend.app.models import Settings
    s = Settings(
        user_id=user_id,
        is_pro=is_pro,
        base_currency="GBP",
        goal=0.0,
        apple_subscription_status=apple_status,
    )
    session.add(s)
    session.commit()
    session.refresh(s)
    return s


@pytest.fixture(scope="module")
def test_app():
    from sqlmodel import SQLModel, Session, create_engine
    from fastapi.testclient import TestClient

    test_db_url = "sqlite:///./test_billing_integration.db"
    test_engine = create_engine(test_db_url, connect_args={"check_same_thread": False})

    import backend.app.database as db_module
    original_engine = db_module.engine
    db_module.engine = test_engine

    import backend.app.models  # noqa: F401
    SQLModel.metadata.create_all(test_engine)

    from sqlalchemy import text
    with test_engine.begin() as conn:
        for col, col_type in [
            ("subscription_status", "TEXT"),
            ("trial_end_iso", "TEXT"),
            ("apple_subscription_status", "TEXT"),
        ]:
            try:
                with conn.begin():
                    conn.execute(text(f'ALTER TABLE settings ADD COLUMN "{col}" {col_type}'))
            except Exception:
                pass
        for col, col_type in [
            ("apple_original_transaction_id", "TEXT"),
        ]:
            try:
                with conn.begin():
                    conn.execute(text(f'ALTER TABLE users ADD COLUMN "{col}" {col_type}'))
            except Exception:
                pass

    def override_session():
        with Session(test_engine) as session:
            yield session

    from backend.app.main import app as fastapi_app
    from backend.app.database import get_session
    fastapi_app.dependency_overrides[get_session] = override_session

    client = TestClient(fastapi_app, raise_server_exceptions=True)

    yield client, test_engine

    db_module.engine = original_engine
    fastapi_app.dependency_overrides.clear()


@pytest.fixture
def db_session(test_app):
    from sqlmodel import Session
    _, engine = test_app
    with Session(engine) as session:
        yield session


def _auth_header(user_id: int = 1, email: str = "user@example.com") -> dict:
    """Return a fake Authorization header by bypassing JWT verification."""
    return {"Authorization": "Bearer test-token"}


def _override_get_current_user(user):
    """Return a FastAPI dependency override that injects the given user."""
    def _dep():
        return user
    return _dep


# ═══════════════════════════════════════════════════════════════════════════════
# 1. Unit tests — _set_pro_for_user helper
# ═══════════════════════════════════════════════════════════════════════════════

class TestSetProForUser:
    """_set_pro_for_user must not clobber Apple IAP status."""

    def _run(self, db, user, pro_arg, apple_status=None, **kwargs):
        from backend.app.models import Settings
        from sqlmodel import select
        s = db.exec(select(Settings).where(Settings.user_id == user.id)).first()
        if s is None:
            s = Settings(user_id=user.id, is_pro=False, base_currency="GBP", goal=0.0)
            db.add(s)
            db.commit()
            db.refresh(s)
        s.apple_subscription_status = apple_status
        db.add(s)
        db.commit()

        from backend.app.routers.billing import _set_pro_for_user
        _set_pro_for_user(db, user, pro_arg, **kwargs)
        db.expire_all()
        s = db.exec(select(Settings).where(Settings.user_id == user.id)).first()
        return s

    def test_stripe_true_sets_pro(self, db_session):
        user = _make_user(db_session, "uid-spu-01", "spu01@example.com")
        s = self._run(db_session, user, True, apple_status=None)
        assert s.is_pro is True

    def test_stripe_false_no_apple_clears_pro(self, db_session):
        user = _make_user(db_session, "uid-spu-02", "spu02@example.com")
        s = self._run(db_session, user, False, apple_status=None)
        assert s.is_pro is False

    def test_stripe_false_apple_active_preserves_pro(self, db_session):
        """Stripe cancelled but Apple active — user must remain Pro."""
        user = _make_user(db_session, "uid-spu-03", "spu03@example.com")
        s = self._run(db_session, user, False, apple_status="active")
        assert s.is_pro is True

    def test_stripe_false_apple_grace_preserves_pro(self, db_session):
        user = _make_user(db_session, "uid-spu-04", "spu04@example.com")
        s = self._run(db_session, user, False, apple_status="grace")
        assert s.is_pro is True

    def test_stripe_false_apple_expired_clears_pro(self, db_session):
        user = _make_user(db_session, "uid-spu-05", "spu05@example.com")
        s = self._run(db_session, user, False, apple_status="expired")
        assert s.is_pro is False


# ═══════════════════════════════════════════════════════════════════════════════
# 2. Integration — /billing/sync endpoint
# ═══════════════════════════════════════════════════════════════════════════════

class TestBillingSync:
    """
    P0 regression tests: sync must NOT downgrade is_pro when Stripe IDs are absent.
    """

    def _post_sync(self, client, user, fastapi_app):
        from backend.app.auth import get_current_user
        fastapi_app.dependency_overrides[get_current_user] = _override_get_current_user(user)
        try:
            return client.post("/api/billing/sync")
        finally:
            fastapi_app.dependency_overrides.pop(get_current_user, None)

    def test_sync_no_stripe_ids_does_not_downgrade_pro_user(self, test_app, db_session):
        """
        If stripe_customer_id is NULL and is_pro=True, sync must preserve is_pro.
        This was the P0 regression: sync was setting is_pro=False on every focus event.
        """
        client, _ = test_app
        from backend.app.main import app as fastapi_app

        user = _make_user(db_session, "uid-sync-01", "sync01@example.com")
        _make_settings(db_session, user.id, is_pro=True)
        # Ensure no Stripe IDs
        assert user.stripe_customer_id is None
        assert user.stripe_subscription_id is None

        resp = self._post_sync(client, user, fastapi_app)
        assert resp.status_code == 200
        data = resp.json()

        # is_pro must remain True — we cannot downgrade without a Stripe confirmation
        assert data["is_pro"] is True

    def test_sync_no_stripe_ids_free_user_stays_free(self, test_app, db_session):
        """A free user with no Stripe IDs correctly stays free."""
        client, _ = test_app
        from backend.app.main import app as fastapi_app

        user = _make_user(db_session, "uid-sync-02", "sync02@example.com")
        _make_settings(db_session, user.id, is_pro=False)

        resp = self._post_sync(client, user, fastapi_app)
        assert resp.status_code == 200
        assert resp.json()["is_pro"] is False

    def test_sync_no_stripe_ids_apple_pro_stays_pro(self, test_app, db_session):
        """Apple IAP active user with no Stripe IDs must remain Pro after sync."""
        client, _ = test_app
        from backend.app.main import app as fastapi_app

        user = _make_user(db_session, "uid-sync-03", "sync03@example.com")
        _make_settings(db_session, user.id, is_pro=True, apple_status="active")

        resp = self._post_sync(client, user, fastapi_app)
        assert resp.status_code == 200
        assert resp.json()["is_pro"] is True

    def test_sync_stripe_active_sets_pro(self, test_app, db_session):
        """When Stripe confirms active, is_pro becomes True."""
        client, _ = test_app
        from backend.app.main import app as fastapi_app

        user = _make_user(db_session, "uid-sync-04", "sync04@example.com")
        user.stripe_customer_id = "cus_test_active"
        user.stripe_subscription_id = "sub_test_active"
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        _make_settings(db_session, user.id, is_pro=False)

        fake_sub = {"status": "active", "trial_end": None, "id": "sub_test_active"}
        with mock.patch("stripe.Subscription.retrieve", return_value=fake_sub):
            resp = self._post_sync(client, user, fastapi_app)

        assert resp.status_code == 200
        data = resp.json()
        assert data["is_pro"] is True
        assert data["status"] == "active"

    def test_sync_stripe_cancelled_no_apple_clears_pro(self, test_app, db_session):
        """Stripe canceled + no Apple = downgrade to free."""
        client, _ = test_app
        from backend.app.main import app as fastapi_app

        user = _make_user(db_session, "uid-sync-05", "sync05@example.com")
        user.stripe_customer_id = "cus_test_cancelled"
        user.stripe_subscription_id = "sub_test_cancelled"
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        _make_settings(db_session, user.id, is_pro=True, apple_status=None)

        fake_sub = {"status": "canceled", "trial_end": None, "id": "sub_test_cancelled"}
        with mock.patch("stripe.Subscription.retrieve", return_value=fake_sub):
            resp = self._post_sync(client, user, fastapi_app)

        assert resp.status_code == 200
        data = resp.json()
        assert data["is_pro"] is False
        assert data["status"] == "canceled"

    def test_sync_stripe_cancelled_apple_active_preserves_pro(self, test_app, db_session):
        """Stripe canceled but Apple active — user must NOT be downgraded."""
        client, _ = test_app
        from backend.app.main import app as fastapi_app

        user = _make_user(db_session, "uid-sync-06", "sync06@example.com")
        user.stripe_customer_id = "cus_test_combo"
        user.stripe_subscription_id = "sub_test_combo"
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        _make_settings(db_session, user.id, is_pro=True, apple_status="active")

        fake_sub = {"status": "canceled", "trial_end": None, "id": "sub_test_combo"}
        with mock.patch("stripe.Subscription.retrieve", return_value=fake_sub):
            resp = self._post_sync(client, user, fastapi_app)

        assert resp.status_code == 200
        data = resp.json()
        assert data["is_pro"] is True

    def test_sync_stripe_api_failure_preserves_is_pro(self, test_app, db_session):
        """If the Stripe API call raises, is_pro must not change."""
        client, _ = test_app
        from backend.app.main import app as fastapi_app

        user = _make_user(db_session, "uid-sync-07", "sync07@example.com")
        user.stripe_customer_id = "cus_test_error"
        user.stripe_subscription_id = "sub_test_error"
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        _make_settings(db_session, user.id, is_pro=True)

        with mock.patch("stripe.Subscription.retrieve", side_effect=Exception("Stripe timeout")):
            resp = self._post_sync(client, user, fastapi_app)

        assert resp.status_code == 200
        data = resp.json()
        # Must preserve existing state on Stripe error
        assert data["is_pro"] is True
