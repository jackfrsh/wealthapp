"""
Tests for Apple App Store billing logic.

Run with:
    DATABASE_URL=sqlite:///./test.db pytest backend/tests/test_apple_billing.py -v

The tests are split into two layers:

1. Pure unit tests — no database required.
   Tests: entitlement mapping, JWS validation error paths.

2. Integration tests — use a SQLite in-memory database via TestClient.
   Tests: /sync idempotency, /notifications duplicate handling,
          grace → pro recovery, expired → free, malformed payload rejection.

All JWS verification is monkeypatched so tests can run without valid Apple
certificates.  The verification function itself is tested separately for its
rejection of malformed inputs.
"""

from __future__ import annotations

import json
import os
import sys
import base64
import unittest.mock as mock
from datetime import datetime, timezone, timedelta
from typing import Optional

import pytest

# ─── Ensure the project root is importable regardless of working directory ────
_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
if _REPO_ROOT not in sys.path:
    sys.path.insert(0, _REPO_ROOT)

# ─── Patch DATABASE_URL before any app module is imported ─────────────────────
os.environ.setdefault("DATABASE_URL", "sqlite:///./test_apple_billing.db")
os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_JWT_SECRET", "test-secret-at-least-32-chars-long-padding")


# ═══════════════════════════════════════════════════════════════════════════════
# 1. Pure unit tests — no DB, no HTTP
# ═══════════════════════════════════════════════════════════════════════════════

class TestComputeTier:
    """compute_tier maps Settings state to (tier, trial_active) without DB access."""

    def _settings(
        self,
        is_pro: bool = False,
        subscription_status: Optional[str] = None,
        apple_subscription_status: Optional[str] = None,
    ):
        from backend.app.models import Settings
        s = Settings(user_id=1, is_pro=is_pro)
        s.subscription_status = subscription_status
        s.apple_subscription_status = apple_subscription_status
        return s

    def test_free_user_returns_free(self):
        from backend.app.routers.billing_apple import compute_tier
        tier, trial = compute_tier(self._settings())
        assert tier == "free"
        assert trial is False

    def test_stripe_active_returns_pro(self):
        from backend.app.routers.billing_apple import compute_tier
        tier, trial = compute_tier(self._settings(is_pro=True, subscription_status="active"))
        assert tier == "pro"
        assert trial is False

    def test_stripe_trialing_returns_pro_with_trial_active(self):
        from backend.app.routers.billing_apple import compute_tier
        tier, trial = compute_tier(self._settings(is_pro=True, subscription_status="trialing"))
        assert tier == "pro"
        assert trial is True

    def test_stripe_past_due_returns_pro_not_grace(self):
        """Stripe past_due is treated as pro (billing retry), NOT grace."""
        from backend.app.routers.billing_apple import compute_tier
        tier, trial = compute_tier(self._settings(is_pro=True, subscription_status="past_due"))
        assert tier == "pro"
        assert trial is False

    def test_apple_active_returns_pro(self):
        from backend.app.routers.billing_apple import compute_tier
        tier, trial = compute_tier(self._settings(is_pro=True, apple_subscription_status="active"))
        assert tier == "pro"
        assert trial is False

    def test_apple_grace_returns_grace(self):
        """Apple grace period surfaces as 'grace' regardless of is_pro value."""
        from backend.app.routers.billing_apple import compute_tier
        tier, trial = compute_tier(self._settings(is_pro=True, apple_subscription_status="grace"))
        assert tier == "grace"
        assert trial is False

    def test_apple_grace_overrides_pro(self):
        """Grace takes priority even when is_pro=True from another source."""
        from backend.app.routers.billing_apple import compute_tier
        tier, trial = compute_tier(self._settings(
            is_pro=True,
            subscription_status="active",
            apple_subscription_status="grace",
        ))
        assert tier == "grace"

    def test_apple_expired_with_no_stripe_returns_free(self):
        from backend.app.routers.billing_apple import compute_tier
        tier, trial = compute_tier(self._settings(is_pro=False, apple_subscription_status="expired"))
        assert tier == "free"

    def test_both_stripe_and_apple_active_returns_pro(self):
        from backend.app.routers.billing_apple import compute_tier
        tier, trial = compute_tier(self._settings(
            is_pro=True,
            subscription_status="active",
            apple_subscription_status="active",
        ))
        assert tier == "pro"

    def test_apple_trialing_sets_trial_active(self):
        from backend.app.routers.billing_apple import compute_tier
        tier, trial = compute_tier(self._settings(is_pro=True, apple_subscription_status="trialing"))
        assert tier == "pro"
        assert trial is True


class TestVerifyAppleJws:
    """verify_apple_jws rejects malformed inputs before touching certificates."""

    def test_empty_string_rejected(self):
        from backend.app.routers.billing_apple import verify_apple_jws
        with pytest.raises(ValueError, match="non-empty"):
            verify_apple_jws("")

    def test_none_rejected(self):
        from backend.app.routers.billing_apple import verify_apple_jws
        with pytest.raises((ValueError, TypeError)):
            verify_apple_jws(None)  # type: ignore[arg-type]

    def test_wrong_number_of_parts(self):
        from backend.app.routers.billing_apple import verify_apple_jws
        with pytest.raises(ValueError, match="three"):
            verify_apple_jws("only.two")

    def test_invalid_base64_header(self):
        from backend.app.routers.billing_apple import verify_apple_jws
        with pytest.raises(ValueError):
            verify_apple_jws("!!!.payload.sig")

    def test_wrong_algorithm(self):
        from backend.app.routers.billing_apple import verify_apple_jws
        header = base64.urlsafe_b64encode(json.dumps({"alg": "RS256", "x5c": []}).encode()).decode().rstrip("=")
        with pytest.raises(ValueError, match="ES256"):
            verify_apple_jws(f"{header}.payload.sig")

    def test_missing_x5c(self):
        from backend.app.routers.billing_apple import verify_apple_jws
        header = base64.urlsafe_b64encode(json.dumps({"alg": "ES256"}).encode()).decode().rstrip("=")
        with pytest.raises(ValueError, match="x5c"):
            verify_apple_jws(f"{header}.payload.sig")

    def test_x5c_too_short(self):
        from backend.app.routers.billing_apple import verify_apple_jws
        header = base64.urlsafe_b64encode(
            json.dumps({"alg": "ES256", "x5c": ["onlyone"]}).encode()
        ).decode().rstrip("=")
        with pytest.raises(ValueError, match="x5c"):
            verify_apple_jws(f"{header}.payload.sig")


# ═══════════════════════════════════════════════════════════════════════════════
# 2. Integration tests using an in-memory SQLite database
# ═══════════════════════════════════════════════════════════════════════════════

def _make_signed_transaction(
    tx_id: str = "tx-001",
    orig_tx_id: str = "orig-001",
    product_id: str = "com.app.pro.monthly",
    expires_offset_seconds: int = 3600,
    app_account_token: Optional[str] = None,
) -> str:
    """
    Return a fake 'signedTransaction' string.
    Tests that call /sync must monkeypatch verify_apple_jws to decode this.
    This value is what the monkeypatched function receives as input.
    """
    return f"fake.jws.{tx_id}"


def _transaction_payload(
    tx_id: str = "tx-001",
    orig_tx_id: str = "orig-001",
    product_id: str = "com.app.pro.monthly",
    expires_offset_seconds: int = 3600,
    app_account_token: Optional[str] = None,
) -> dict:
    now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
    payload = {
        "transactionId": tx_id,
        "originalTransactionId": orig_tx_id,
        "productId": product_id,
        "purchaseDate": now_ms,
        "expiresDate": now_ms + expires_offset_seconds * 1000,
    }
    if app_account_token:
        payload["appAccountToken"] = app_account_token
    return payload


def _notification_body(
    notification_type: str,
    subtype: str = "",
    notification_uuid: str = "uuid-001",
    orig_tx_id: str = "orig-001",
    app_account_token: Optional[str] = None,
) -> dict:
    """Build a minimal Apple notification body for testing."""
    return {
        "signedPayload": f"fake.notification.{notification_uuid}",
        "_test_envelope": {
            "notificationType": notification_type,
            "subtype": subtype,
            "notificationUUID": notification_uuid,
            "data": {
                "signedTransactionInfo": f"fake.tx.{orig_tx_id}",
                "_test_tx": {
                    "originalTransactionId": orig_tx_id,
                    **({"appAccountToken": app_account_token} if app_account_token else {}),
                },
            },
        },
    }


@pytest.fixture(scope="module")
def test_app():
    """
    Create a FastAPI TestClient backed by an in-memory SQLite database.

    We override the DATABASE_URL, create all tables, and yield a (client, engine) pair.
    """
    from sqlmodel import SQLModel, Session, create_engine
    from fastapi.testclient import TestClient

    test_db_url = "sqlite:///./test_apple_billing_integration.db"

    from sqlmodel import create_engine as _ce
    test_engine = _ce(test_db_url, connect_args={"check_same_thread": False})

    # Override the module-level engine before importing models/app
    import backend.app.database as db_module
    original_engine = db_module.engine
    db_module.engine = test_engine

    # Import models to register them, then create all tables
    import backend.app.models  # noqa: F401
    SQLModel.metadata.create_all(test_engine)

    # Add columns that _migrate_columns would normally add (SQLite silently ignores
    # ADD COLUMN if the column already exists via CREATE TABLE, so just ensure schema)
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
                pass  # Already exists
        for col, col_type in [
            ("apple_original_transaction_id", "TEXT"),
        ]:
            try:
                with conn.begin():
                    conn.execute(text(f'ALTER TABLE users ADD COLUMN "{col}" {col_type}'))
            except Exception:
                pass

    # Override get_session to use test engine
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

    # Cleanup test DB file
    import os as _os
    try:
        _os.unlink("./test_apple_billing_integration.db")
    except FileNotFoundError:
        pass


@pytest.fixture()
def db_session(test_app):
    """Provide a clean session for direct DB manipulation in tests."""
    from sqlmodel import Session
    _, engine = test_app
    with Session(engine) as session:
        yield session


def _create_test_user(db_session, supabase_uid: str = "test-uid-001") -> "User":
    from backend.app.models import User, Settings
    from sqlmodel import select
    from sqlalchemy.exc import IntegrityError

    existing = db_session.exec(select(User).where(User.supabase_user_id == supabase_uid)).first()
    if existing:
        return existing

    user = User(username=f"user-{supabase_uid}", supabase_user_id=supabase_uid)
    db_session.add(user)
    try:
        db_session.commit()
        db_session.refresh(user)
    except IntegrityError:
        db_session.rollback()
        user = db_session.exec(select(User).where(User.supabase_user_id == supabase_uid)).first()

    # Ensure settings row exists
    s = db_session.exec(select(Settings).where(Settings.user_id == user.id)).first()
    if not s:
        s = Settings(user_id=user.id)
        db_session.add(s)
        db_session.commit()

    return user


def _override_auth_by_uid(supabase_uid: str):
    """
    Return a FastAPI dependency override that loads the user from the
    *request's own* DB session.  Using a user object attached to `db_session`
    directly causes SQLAlchemy cross-session errors.
    """
    from fastapi import Depends
    from sqlmodel import Session, select
    from backend.app.models import User
    from backend.app.database import get_session

    def _dep(db: Session = Depends(get_session)):
        return db.exec(select(User).where(User.supabase_user_id == supabase_uid)).first()
    return _dep


class TestAppleSync:
    """Integration tests for POST /api/billing/apple/sync."""

    def test_malformed_payload_rejected(self, test_app, db_session):
        client, _ = test_app
        _create_test_user(db_session, "sync-uid-001")

        from backend.app.main import app
        from backend.app.auth import get_current_user
        app.dependency_overrides[get_current_user] = _override_auth_by_uid("sync-uid-001")

        resp = client.post(
            "/api/billing/apple/sync",
            json={"signedTransaction": "not.a.valid.jws.payload"},
        )
        assert resp.status_code == 400
        assert "verification failed" in resp.json()["detail"].lower()

        app.dependency_overrides.pop(get_current_user, None)

    def test_valid_transaction_grants_pro(self, test_app, db_session):
        client, _ = test_app
        _create_test_user(db_session, "sync-uid-002")

        from backend.app.main import app
        from backend.app.auth import get_current_user
        import backend.app.routers.billing_apple as ba

        app.dependency_overrides[get_current_user] = _override_auth_by_uid("sync-uid-002")

        payload = _transaction_payload("tx-sync-002", "orig-sync-002")
        with mock.patch.object(ba, "verify_apple_jws", return_value=payload):
            resp = client.post(
                "/api/billing/apple/sync",
                json={"signedTransaction": "fake.jws.tx-sync-002"},
            )

        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["tier"] == "pro"
        assert data["trial_active"] is False

        app.dependency_overrides.pop(get_current_user, None)

    def test_expired_transaction_returns_free(self, test_app, db_session):
        """A transaction whose expiresDate is in the past should result in free tier."""
        client, _ = test_app
        _create_test_user(db_session, "sync-uid-003")

        from backend.app.main import app
        from backend.app.auth import get_current_user
        import backend.app.routers.billing_apple as ba

        app.dependency_overrides[get_current_user] = _override_auth_by_uid("sync-uid-003")

        expired_ms = int((datetime.now(timezone.utc) - timedelta(days=1)).timestamp() * 1000)
        payload = _transaction_payload("tx-sync-003", "orig-sync-003")
        payload["expiresDate"] = expired_ms

        with mock.patch.object(ba, "verify_apple_jws", return_value=payload):
            resp = client.post(
                "/api/billing/apple/sync",
                json={"signedTransaction": "fake.jws.tx-sync-003"},
            )

        assert resp.status_code == 200, resp.text
        assert resp.json()["tier"] == "free"

        app.dependency_overrides.pop(get_current_user, None)

    def test_idempotent_on_same_transaction_id(self, test_app, db_session):
        """Submitting the same transactionId twice returns the same result without error."""
        client, _ = test_app
        _create_test_user(db_session, "sync-uid-004")

        from backend.app.main import app
        from backend.app.auth import get_current_user
        import backend.app.routers.billing_apple as ba

        app.dependency_overrides[get_current_user] = _override_auth_by_uid("sync-uid-004")

        payload = _transaction_payload("tx-sync-idempotent", "orig-sync-idempotent")

        for _ in range(3):
            with mock.patch.object(ba, "verify_apple_jws", return_value=payload):
                resp = client.post(
                    "/api/billing/apple/sync",
                    json={"signedTransaction": "fake.jws.tx-sync-idempotent"},
                )
            assert resp.status_code == 200, resp.text
            assert resp.json()["tier"] == "pro"

        app.dependency_overrides.pop(get_current_user, None)

        # Verify only one transaction row was created
        from backend.app.models import AppleTransaction
        from sqlmodel import select
        rows = db_session.exec(
            select(AppleTransaction).where(
                AppleTransaction.transaction_id == "tx-sync-idempotent"
            )
        ).all()
        assert len(rows) == 1


class TestAppleNotifications:
    """Integration tests for POST /api/billing/apple/notifications."""

    def _post_notification(self, client, envelope: dict):
        """
        Post a notification, patching verify_apple_jws to return envelope for the
        outer signed payload and the inner transaction payload.
        """
        import backend.app.routers.billing_apple as ba

        inner_tx = envelope.get("data", {}).get("_test_tx", {})
        inner_signed = envelope.get("data", {}).get("signedTransactionInfo", "")

        def fake_verify(signed):
            if signed == envelope.get("_signed_outer", "fake.outer"):
                return {k: v for k, v in envelope.items() if not k.startswith("_")}
            if signed == inner_signed:
                return inner_tx
            return {}

        body = {"signedPayload": envelope.get("_signed_outer", "fake.outer")}
        with mock.patch.object(ba, "verify_apple_jws", side_effect=fake_verify):
            return client.post("/api/billing/apple/notifications", json=body)

    def _make_envelope(
        self,
        notification_type: str,
        subtype: str = "",
        uuid: str = "notif-uuid-001",
        orig_tx_id: str = "orig-notif-001",
        app_account_token: Optional[str] = None,
    ) -> dict:
        inner_tx: dict = {"originalTransactionId": orig_tx_id}
        if app_account_token:
            inner_tx["appAccountToken"] = app_account_token
        return {
            "_signed_outer": f"fake.outer.{uuid}",
            "notificationType": notification_type,
            "subtype": subtype,
            "notificationUUID": uuid,
            "environment": "Sandbox",
            "data": {
                "bundleId": "com.app.test",
                "signedTransactionInfo": f"fake.inner.{orig_tx_id}",
                "_test_tx": inner_tx,
            },
        }

    def test_malformed_body_rejected(self, test_app):
        client, _ = test_app
        resp = client.post(
            "/api/billing/apple/notifications",
            content=b"not json",
            headers={"Content-Type": "application/json"},
        )
        assert resp.status_code == 400

    def test_missing_signed_payload_rejected(self, test_app):
        client, _ = test_app
        resp = client.post("/api/billing/apple/notifications", json={"foo": "bar"})
        assert resp.status_code == 400
        assert "signedPayload" in resp.json()["detail"]

    def test_subscribed_grants_pro(self, test_app, db_session):
        client, _ = test_app
        user = _create_test_user(db_session, "notif-uid-subscribed")
        user.apple_original_transaction_id = "orig-subscribed"
        db_session.add(user)
        db_session.commit()

        envelope = self._make_envelope("SUBSCRIBED", uuid="uuid-subscribed", orig_tx_id="orig-subscribed")
        resp = self._post_notification(client, envelope)
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"

        db_session.refresh(user)
        from backend.app.models import Settings
        from sqlmodel import select
        s = db_session.exec(select(Settings).where(Settings.user_id == user.id)).first()
        assert s.apple_subscription_status == "active"
        assert s.is_pro is True

    def test_duplicate_notification_ignored(self, test_app, db_session):
        """Same notificationUUID sent twice; second is silently ignored."""
        client, _ = test_app
        user = _create_test_user(db_session, "notif-uid-dup")
        user.apple_original_transaction_id = "orig-dup"
        db_session.add(user)
        db_session.commit()

        envelope = self._make_envelope("SUBSCRIBED", uuid="uuid-dup-001", orig_tx_id="orig-dup")

        resp1 = self._post_notification(client, envelope)
        assert resp1.status_code == 200
        assert resp1.json()["status"] == "ok"

        resp2 = self._post_notification(client, envelope)
        assert resp2.status_code == 200
        assert resp2.json()["status"] == "duplicate_ignored"

    def test_did_fail_to_renew_grace_period_sets_grace(self, test_app, db_session):
        client, _ = test_app
        user = _create_test_user(db_session, "notif-uid-grace")
        user.apple_original_transaction_id = "orig-grace"
        db_session.add(user)
        db_session.commit()

        envelope = self._make_envelope(
            "DID_FAIL_TO_RENEW",
            subtype="GRACE_PERIOD",
            uuid="uuid-grace-001",
            orig_tx_id="orig-grace",
        )
        resp = self._post_notification(client, envelope)
        assert resp.status_code == 200

        db_session.expire_all()
        from backend.app.models import Settings
        from sqlmodel import select
        s = db_session.exec(select(Settings).where(Settings.user_id == user.id)).first()
        assert s.apple_subscription_status == "grace"
        assert s.is_pro is True  # grace still grants access

    def test_grace_to_pro_recovery_via_did_renew(self, test_app, db_session):
        """DID_RENEW after a GRACE_PERIOD restores full pro status."""
        client, _ = test_app
        user = _create_test_user(db_session, "notif-uid-recovery")
        user.apple_original_transaction_id = "orig-recovery"
        db_session.add(user)

        from backend.app.models import Settings
        from sqlmodel import select
        s = db_session.exec(select(Settings).where(Settings.user_id == user.id)).first()
        if not s:
            from backend.app.models import Settings as S
            s = S(user_id=user.id, is_pro=True)
            db_session.add(s)
        s.apple_subscription_status = "grace"
        s.is_pro = True
        db_session.commit()

        envelope = self._make_envelope(
            "DID_RENEW",
            uuid="uuid-recovery-001",
            orig_tx_id="orig-recovery",
        )
        resp = self._post_notification(client, envelope)
        assert resp.status_code == 200

        db_session.expire_all()
        s = db_session.exec(select(Settings).where(Settings.user_id == user.id)).first()
        assert s.apple_subscription_status == "active"
        assert s.is_pro is True

    def test_expired_sets_free(self, test_app, db_session):
        client, _ = test_app
        user = _create_test_user(db_session, "notif-uid-expired")
        user.apple_original_transaction_id = "orig-expired"
        db_session.add(user)

        from backend.app.models import Settings
        from sqlmodel import select
        s = db_session.exec(select(Settings).where(Settings.user_id == user.id)).first()
        if s:
            s.apple_subscription_status = "active"
            s.is_pro = True
            db_session.commit()

        envelope = self._make_envelope(
            "EXPIRED",
            uuid="uuid-expired-001",
            orig_tx_id="orig-expired",
        )
        resp = self._post_notification(client, envelope)
        assert resp.status_code == 200

        db_session.expire_all()
        s = db_session.exec(select(Settings).where(Settings.user_id == user.id)).first()
        assert s.apple_subscription_status == "expired"
        assert s.is_pro is False

    def test_expired_preserves_stripe_pro(self, test_app, db_session):
        """If Stripe is still active, Apple EXPIRED should not revoke is_pro."""
        client, _ = test_app
        user = _create_test_user(db_session, "notif-uid-stripe-safe")
        user.apple_original_transaction_id = "orig-stripe-safe"
        db_session.add(user)

        from backend.app.models import Settings
        from sqlmodel import select
        s = db_session.exec(select(Settings).where(Settings.user_id == user.id)).first()
        if s:
            s.apple_subscription_status = "active"
            s.subscription_status = "active"  # Stripe still active
            s.is_pro = True
            db_session.commit()

        envelope = self._make_envelope(
            "EXPIRED",
            uuid="uuid-stripe-safe-001",
            orig_tx_id="orig-stripe-safe",
        )
        resp = self._post_notification(client, envelope)
        assert resp.status_code == 200

        db_session.expire_all()
        s = db_session.exec(select(Settings).where(Settings.user_id == user.id)).first()
        assert s.apple_subscription_status == "expired"
        assert s.is_pro is True  # Stripe grant preserved

    def test_revoke_sets_free(self, test_app, db_session):
        client, _ = test_app
        user = _create_test_user(db_session, "notif-uid-revoked")
        user.apple_original_transaction_id = "orig-revoked"
        db_session.add(user)

        from backend.app.models import Settings
        from sqlmodel import select
        s = db_session.exec(select(Settings).where(Settings.user_id == user.id)).first()
        if s:
            s.apple_subscription_status = "active"
            s.is_pro = True
            db_session.commit()

        envelope = self._make_envelope(
            "REVOKED",
            uuid="uuid-revoked-001",
            orig_tx_id="orig-revoked",
        )
        resp = self._post_notification(client, envelope)
        assert resp.status_code == 200

        db_session.expire_all()
        s = db_session.exec(select(Settings).where(Settings.user_id == user.id)).first()
        assert s.apple_subscription_status == "revoked"
        assert s.is_pro is False

    def test_billing_recovery_restores_pro(self, test_app, db_session):
        """DID_RENEW with subtype BILLING_RECOVERY restores pro from grace."""
        client, _ = test_app
        user = _create_test_user(db_session, "notif-uid-billing-recovery")
        user.apple_original_transaction_id = "orig-billing-recovery"
        db_session.add(user)

        from backend.app.models import Settings
        from sqlmodel import select
        s = db_session.exec(select(Settings).where(Settings.user_id == user.id)).first()
        if s:
            s.apple_subscription_status = "grace"
            s.is_pro = True
            db_session.commit()

        envelope = self._make_envelope(
            "DID_RENEW",
            subtype="BILLING_RECOVERY",
            uuid="uuid-billing-recovery-001",
            orig_tx_id="orig-billing-recovery",
        )
        resp = self._post_notification(client, envelope)
        assert resp.status_code == 200

        db_session.expire_all()
        s = db_session.exec(select(Settings).where(Settings.user_id == user.id)).first()
        assert s.apple_subscription_status == "active"
        assert s.is_pro is True

    def test_unknown_user_handled_gracefully(self, test_app):
        """Notification for unknown orig_tx_id should return 200, not 500."""
        client, _ = test_app
        envelope = self._make_envelope(
            "SUBSCRIBED",
            uuid="uuid-unknown-user",
            orig_tx_id="orig-nobody-has-this",
        )
        resp = self._post_notification(client, envelope)
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"

    def test_app_account_token_resolves_user(self, test_app, db_session):
        """appAccountToken == supabase_user_id should link notification to user."""
        client, _ = test_app
        supabase_uid = "aat-supabase-uid"
        user = _create_test_user(db_session, supabase_uid)

        envelope = self._make_envelope(
            "SUBSCRIBED",
            uuid="uuid-aat-001",
            orig_tx_id="orig-aat-001",
            app_account_token=supabase_uid,
        )
        resp = self._post_notification(client, envelope)
        assert resp.status_code == 200

        db_session.expire_all()
        from backend.app.models import Settings
        from sqlmodel import select
        s = db_session.exec(select(Settings).where(Settings.user_id == user.id)).first()
        assert s.apple_subscription_status == "active"
        assert s.is_pro is True
