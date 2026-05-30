"""
Tests for Stripe billing logic.

Run with:
    DATABASE_URL=sqlite:///./test_billing.db pytest backend/tests/test_billing.py -v

Coverage:
- create-checkout: returns { url } for a logged-in free user
- create-checkout: 401 without auth
- create-checkout: 500 when price env var is missing
- create-checkout: uses correct price ID for monthly vs annual plan
- sync: does NOT downgrade when stripe_customer_id / stripe_subscription_id are NULL
- sync: respects Apple IAP status when computing is_pro from Stripe
- sync: preserves is_pro for Apple-active users even when Stripe says inactive
- _set_pro_for_user: preserves Apple Pro when Stripe says False
- webhook: ignored when event_type is unknown

Note on frontend tests (Upgrade.jsx):
  The project has no Vitest/Jest setup.  The component-level behaviours
  (button enabled for free user, redirect on success, red error on failure,
  loading reset) are covered by the manual verification checklist and would
  need @testing-library/react + Vitest to automate. Backend tests here
  verify the API contract those behaviours depend on.
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


@pytest.fixture(autouse=True)
def reset_rate_limiter():
    """Clear in-memory rate-limiter buckets so tests don't 429 each other."""
    from backend.app.middleware import _window
    _window._buckets.clear()
    yield
    _window._buckets.clear()


@pytest.fixture(scope="module")
def test_app():
    import tempfile
    from sqlmodel import SQLModel, Session, create_engine
    from fastapi.testclient import TestClient

    # Use a temp file so parallel runs and re-runs don't collide on a stale DB.
    _tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
    _tmp.close()
    test_db_url = f"sqlite:///{_tmp.name}"
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


# ═══════════════════════════════════════════════════════════════════════════════
# 3. Integration — /billing/create-checkout endpoint
#    Verifies the API contract that Upgrade.jsx depends on.
# ═══════════════════════════════════════════════════════════════════════════════

class TestCreateCheckout:
    """
    The Upgrade CTA calls POST /api/billing/create-checkout with { plan }.
    These tests confirm the endpoint returns { url } under normal conditions
    and fails safely when misconfigured, so the frontend error path is exercised
    by a real 500 rather than a silent hang.
    """

    def _post_checkout(self, client, user, fastapi_app, plan="monthly"):
        from backend.app.auth import get_current_user
        fastapi_app.dependency_overrides[get_current_user] = _override_get_current_user(user)
        try:
            return client.post("/api/billing/create-checkout", json={"plan": plan})
        finally:
            fastapi_app.dependency_overrides.pop(get_current_user, None)

    def test_checkout_returns_url_for_free_user(self, test_app, db_session):
        """
        A logged-in free user (no existing customer ID) gets a checkout URL.
        Upgrade.jsx checks res?.url — this confirms the field name is correct.
        """
        client, _ = test_app
        from backend.app.main import app as fastapi_app

        user = _make_user(db_session, "uid-co-01", "co01@example.com")
        _make_settings(db_session, user.id, is_pro=False)

        fake_session = mock.MagicMock()
        fake_session.url = "https://checkout.stripe.com/pay/cs_test_abc"

        with mock.patch("stripe.checkout.Session.create", return_value=fake_session):
            resp = self._post_checkout(client, user, fastapi_app, plan="monthly")

        assert resp.status_code == 200
        data = resp.json()
        assert "url" in data
        assert data["url"].startswith("https://checkout.stripe.com/")

    def test_checkout_monthly_uses_monthly_price(self, test_app, db_session):
        """Monthly plan sends STRIPE_PRICE_ID_MONTHLY to Stripe."""
        client, _ = test_app
        from backend.app.main import app as fastapi_app

        user = _make_user(db_session, "uid-co-02", "co02@example.com")
        _make_settings(db_session, user.id, is_pro=False)

        fake_session = mock.MagicMock()
        fake_session.url = "https://checkout.stripe.com/pay/cs_test_monthly"

        with mock.patch("stripe.checkout.Session.create", return_value=fake_session) as mock_create:
            resp = self._post_checkout(client, user, fastapi_app, plan="monthly")

        assert resp.status_code == 200
        call_kwargs = mock_create.call_args[1]
        price_used = call_kwargs["line_items"][0]["price"]
        assert price_used == os.environ["STRIPE_PRICE_ID_MONTHLY"]

    def test_checkout_annual_uses_annual_price(self, test_app, db_session):
        """Annual plan sends STRIPE_PRICE_ID_ANNUAL to Stripe."""
        client, _ = test_app
        from backend.app.main import app as fastapi_app

        user = _make_user(db_session, "uid-co-03", "co03@example.com")
        _make_settings(db_session, user.id, is_pro=False)

        fake_session = mock.MagicMock()
        fake_session.url = "https://checkout.stripe.com/pay/cs_test_annual"

        with mock.patch("stripe.checkout.Session.create", return_value=fake_session) as mock_create:
            resp = self._post_checkout(client, user, fastapi_app, plan="annual")

        assert resp.status_code == 200
        call_kwargs = mock_create.call_args[1]
        price_used = call_kwargs["line_items"][0]["price"]
        assert price_used == os.environ["STRIPE_PRICE_ID_ANNUAL"]

    def test_checkout_requires_auth(self, test_app):
        """Without a valid bearer token the endpoint must return 401/403.
        Upgrade.jsx relies on this to surface an error rather than hang."""
        client, _ = test_app
        resp = client.post("/api/billing/create-checkout", json={"plan": "monthly"})
        assert resp.status_code in (401, 403)

    def test_checkout_stripe_failure_returns_500(self, test_app, db_session):
        """
        When Stripe.checkout.Session.create raises, the endpoint returns 500.
        Upgrade.jsx's catch block then shows the error message — confirming
        it never silently swallows a backend failure.
        """
        client, _ = test_app
        from backend.app.main import app as fastapi_app

        user = _make_user(db_session, "uid-co-04", "co04@example.com")
        _make_settings(db_session, user.id, is_pro=False)

        with mock.patch(
            "stripe.checkout.Session.create",
            side_effect=Exception("Stripe API unavailable"),
        ):
            resp = self._post_checkout(client, user, fastapi_app, plan="monthly")

        assert resp.status_code == 500
        assert "checkout" in resp.json().get("detail", "").lower()

    def test_checkout_missing_price_env_returns_500(self, test_app, db_session):
        """
        If STRIPE_PRICE_ID_MONTHLY is absent the endpoint returns 500.
        The frontend catch block surfaces this as a visible error (not a hang).
        """
        client, _ = test_app
        from backend.app.main import app as fastapi_app

        user = _make_user(db_session, "uid-co-05", "co05@example.com")
        _make_settings(db_session, user.id, is_pro=False)

        saved = os.environ.pop("STRIPE_PRICE_ID_MONTHLY", None)
        try:
            resp = self._post_checkout(client, user, fastapi_app, plan="monthly")
        finally:
            if saved is not None:
                os.environ["STRIPE_PRICE_ID_MONTHLY"] = saved

        assert resp.status_code == 500

    def test_checkout_includes_user_id_in_metadata(self, test_app, db_session):
        """
        The session must carry user_id in metadata so the webhook and
        checkout-status endpoint can find the user without a cookie.
        """
        client, _ = test_app
        from backend.app.main import app as fastapi_app

        user = _make_user(db_session, "uid-co-06", "co06@example.com")
        _make_settings(db_session, user.id, is_pro=False)

        fake_session = mock.MagicMock()
        fake_session.url = "https://checkout.stripe.com/pay/cs_test_meta"

        with mock.patch("stripe.checkout.Session.create", return_value=fake_session) as mock_create:
            resp = self._post_checkout(client, user, fastapi_app, plan="monthly")

        assert resp.status_code == 200
        call_kwargs = mock_create.call_args[1]
        assert str(user.id) == call_kwargs["metadata"]["user_id"]

    def test_checkout_stripe_error_returns_503(self, test_app, db_session):
        """
        A stripe.error.StripeError (e.g. invalid price ID, mode mismatch) must
        return 503 — not 200 — so Upgrade.jsx shows the error banner.
        """
        client, _ = test_app
        from backend.app.main import app as fastapi_app

        user = _make_user(db_session, "uid-co-07", "co07@example.com")
        _make_settings(db_session, user.id, is_pro=False)

        import stripe as stripe_mod
        with mock.patch(
            "stripe.checkout.Session.create",
            side_effect=stripe_mod.error.InvalidRequestError(
                "No such price: 'price_bad'", param="price"
            ),
        ):
            resp = self._post_checkout(client, user, fastapi_app, plan="monthly")

        assert resp.status_code == 503

    def test_checkout_live_key_with_non_https_frontend_url_returns_503(
        self, test_app, db_session
    ):
        """
        When STRIPE_SECRET_KEY is sk_live_* but FRONTEND_URL is HTTP/localhost,
        Stripe would reject the success_url — we must fail fast with 503 before
        wasting the Stripe API round-trip.

        This is the most likely cause of the production 500: FRONTEND_URL not
        set on Railway → fallback is http://localhost:5173.
        """
        client, _ = test_app
        from backend.app.main import app as fastapi_app

        user = _make_user(db_session, "uid-co-08", "co08@example.com")
        _make_settings(db_session, user.id, is_pro=False)

        saved_key = os.environ.get("STRIPE_SECRET_KEY")
        saved_url = os.environ.get("FRONTEND_URL")
        os.environ["STRIPE_SECRET_KEY"] = "sk_live_test_placeholder_key"
        os.environ["FRONTEND_URL"] = "http://localhost:5173"
        try:
            resp = self._post_checkout(client, user, fastapi_app, plan="monthly")
        finally:
            if saved_key is not None:
                os.environ["STRIPE_SECRET_KEY"] = saved_key
            else:
                os.environ.pop("STRIPE_SECRET_KEY", None)
            if saved_url is not None:
                os.environ["FRONTEND_URL"] = saved_url
            else:
                os.environ.pop("FRONTEND_URL", None)

        assert resp.status_code == 503
