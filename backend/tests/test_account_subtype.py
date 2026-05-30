"""
Tests for account_subtype field on the accounts API.

Covers:
- Create with valid subtype → persisted and returned
- Create with None subtype → null in response
- Create with invalid subtype → 422
- Create with subtype that has extra whitespace/uppercase → normalised
- Update (PATCH) sets subtype
- Update (PATCH) clears subtype to null
- Update (PATCH) with invalid subtype → 422
- PUT alias behaves identically to PATCH
- Existing accounts (no subtype) are unaffected
- All allowed subtype values round-trip cleanly
"""

from __future__ import annotations

import os
import sys

import pytest

_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
if _REPO_ROOT not in sys.path:
    sys.path.insert(0, _REPO_ROOT)

os.environ.setdefault("DATABASE_URL", "sqlite:///./test_account_subtype.db")
os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_JWT_SECRET", "test-secret-at-least-32-chars-long-padding")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")


@pytest.fixture(scope="module")
def test_app():
    from sqlmodel import SQLModel, Session, create_engine
    from fastapi.testclient import TestClient

    test_engine = create_engine(
        "sqlite:///./test_account_subtype_integration.db",
        connect_args={"check_same_thread": False},
    )

    import backend.app.database as db_module
    original_engine = db_module.engine
    db_module.engine = test_engine

    import backend.app.models  # noqa: F401 — registers all SQLModel tables
    SQLModel.metadata.create_all(test_engine)

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

    import os as _os
    for f in ("./test_account_subtype.db", "./test_account_subtype_integration.db"):
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
    """Create a Pro user so account-limit enforcement never interferes with subtype tests."""
    from backend.app.models import User, Settings
    from sqlmodel import select

    existing = db_session.exec(select(User).where(User.supabase_user_id == uid)).first()
    if existing:
        return existing

    user = User(username=f"subtype-user-{uid}", supabase_user_id=uid)
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

    def _dep(db: Session = Depends(get_session)):
        return db.exec(select(User).where(User.supabase_user_id == uid)).first()

    from backend.app.auth import get_current_user
    app.dependency_overrides[get_current_user] = _dep


# ─── Create ──────────────────────────────────────────────────────────────────

class TestCreateWithSubtype:
    UID = "subtype-create-001"

    def test_create_with_valid_subtype(self, test_app, db_session):
        client, _ = test_app
        _make_pro_user(db_session, self.UID)
        _auth(client.app, self.UID)

        resp = client.post("/api/accounts", json={
            "name": "Monzo",
            "type": "bank",
            "currency": "GBP",
            "balance": 1000.0,
            "account_subtype": "current_account",
        })
        assert resp.status_code == 201, resp.text
        data = resp.json()
        assert data["account_subtype"] == "current_account"
        assert data["type"] == "bank"
        assert data["name"] == "Monzo"

    def test_create_without_subtype_returns_null(self, test_app, db_session):
        client, _ = test_app
        _make_pro_user(db_session, self.UID)
        _auth(client.app, self.UID)

        resp = client.post("/api/accounts", json={
            "name": "Legacy Bank",
            "type": "bank",
            "currency": "GBP",
            "balance": 500.0,
        })
        assert resp.status_code == 201, resp.text
        assert resp.json()["account_subtype"] is None

    def test_create_with_null_subtype_returns_null(self, test_app, db_session):
        client, _ = test_app
        _make_pro_user(db_session, self.UID)
        _auth(client.app, self.UID)

        resp = client.post("/api/accounts", json={
            "name": "Plain ISA",
            "type": "isa",
            "account_subtype": None,
        })
        assert resp.status_code == 201, resp.text
        assert resp.json()["account_subtype"] is None

    def test_create_with_invalid_subtype_returns_422(self, test_app, db_session):
        client, _ = test_app
        _make_pro_user(db_session, self.UID)
        _auth(client.app, self.UID)

        resp = client.post("/api/accounts", json={
            "name": "Bad Account",
            "type": "bank",
            "account_subtype": "garbage_value",
        })
        assert resp.status_code == 422, resp.text
        assert "garbage_value" in resp.json()["detail"]

    def test_create_normalises_subtype_whitespace_and_case(self, test_app, db_session):
        client, _ = test_app
        _make_pro_user(db_session, self.UID)
        _auth(client.app, self.UID)

        resp = client.post("/api/accounts", json={
            "name": "Vanguard ISA",
            "type": "isa",
            "account_subtype": "  Stocks_Shares_ISA  ",
        })
        assert resp.status_code == 201, resp.text
        assert resp.json()["account_subtype"] == "stocks_shares_isa"

    def test_create_with_empty_string_subtype_returns_null(self, test_app, db_session):
        client, _ = test_app
        _make_pro_user(db_session, self.UID)
        _auth(client.app, self.UID)

        resp = client.post("/api/accounts", json={
            "name": "Empty Subtype Account",
            "type": "bank",
            "account_subtype": "   ",
        })
        assert resp.status_code == 201, resp.text
        assert resp.json()["account_subtype"] is None


# ─── All allowed subtypes round-trip ─────────────────────────────────────────

class TestAllAllowedSubtypes:
    UID = "subtype-roundtrip-001"

    @pytest.mark.parametrize("subtype", [
        "current_account",
        "savings",
        "cash_isa",
        "premium_bonds",
        "stocks_shares_isa",
        "lifetime_isa",
        "gia",
        "workplace_pension",
        "credit_card",
        "other_liability",
    ])
    def test_each_allowed_subtype_round_trips(self, test_app, db_session, subtype):
        client, _ = test_app
        _make_pro_user(db_session, self.UID)
        _auth(client.app, self.UID)

        resp = client.post("/api/accounts", json={
            "name": f"Test {subtype}",
            "type": "other",
            "account_subtype": subtype,
        })
        assert resp.status_code == 201, f"Failed for subtype '{subtype}': {resp.text}"
        assert resp.json()["account_subtype"] == subtype


# ─── Update (PATCH) ───────────────────────────────────────────────────────────

class TestPatchSubtype:
    UID = "subtype-patch-001"

    def _create_account(self, client, db_session, subtype=None):
        _make_pro_user(db_session, self.UID)
        _auth(client.app, self.UID)
        resp = client.post("/api/accounts", json={
            "name": "Patch Target",
            "type": "isa",
            "account_subtype": subtype,
        })
        assert resp.status_code == 201
        return resp.json()["id"]

    def test_patch_sets_subtype(self, test_app, db_session):
        client, _ = test_app
        acct_id = self._create_account(client, db_session)

        resp = client.patch(f"/api/accounts/{acct_id}", json={"account_subtype": "cash_isa"})
        assert resp.status_code == 200, resp.text
        assert resp.json()["account_subtype"] == "cash_isa"

    def test_patch_clears_subtype_to_null(self, test_app, db_session):
        client, _ = test_app
        _make_pro_user(db_session, self.UID)
        _auth(client.app, self.UID)
        resp = client.post("/api/accounts", json={
            "name": "Will Be Cleared",
            "type": "isa",
            "account_subtype": "cash_isa",
        })
        acct_id = resp.json()["id"]

        resp = client.patch(f"/api/accounts/{acct_id}", json={"account_subtype": None})
        assert resp.status_code == 200, resp.text
        assert resp.json()["account_subtype"] is None

    def test_patch_invalid_subtype_returns_422(self, test_app, db_session):
        client, _ = test_app
        acct_id = self._create_account(client, db_session)

        resp = client.patch(f"/api/accounts/{acct_id}", json={"account_subtype": "not_a_real_type"})
        assert resp.status_code == 422, resp.text

    def test_patch_without_subtype_field_leaves_existing_value(self, test_app, db_session):
        """Omitting account_subtype from a PATCH must not overwrite the stored value."""
        client, _ = test_app
        _make_pro_user(db_session, self.UID)
        _auth(client.app, self.UID)
        resp = client.post("/api/accounts", json={
            "name": "Stable Subtype",
            "type": "isa",
            "account_subtype": "stocks_shares_isa",
        })
        acct_id = resp.json()["id"]

        resp = client.patch(f"/api/accounts/{acct_id}", json={"name": "Renamed ISA"})
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["name"] == "Renamed ISA"
        assert data["account_subtype"] == "stocks_shares_isa"


# ─── PUT alias ───────────────────────────────────────────────────────────────

class TestPutSubtype:
    UID = "subtype-put-001"

    def test_put_sets_subtype(self, test_app, db_session):
        client, _ = test_app
        _make_pro_user(db_session, self.UID)
        _auth(client.app, self.UID)
        resp = client.post("/api/accounts", json={"name": "PUT Target", "type": "bank"})
        acct_id = resp.json()["id"]

        resp = client.put(f"/api/accounts/{acct_id}", json={"account_subtype": "savings"})
        assert resp.status_code == 200, resp.text
        assert resp.json()["account_subtype"] == "savings"

    def test_put_invalid_subtype_returns_422(self, test_app, db_session):
        client, _ = test_app
        _make_pro_user(db_session, self.UID)
        _auth(client.app, self.UID)
        resp = client.post("/api/accounts", json={"name": "PUT Invalid", "type": "bank"})
        acct_id = resp.json()["id"]

        resp = client.put(f"/api/accounts/{acct_id}", json={"account_subtype": "crypto_wallet"})
        assert resp.status_code == 422, resp.text

    def test_put_without_subtype_field_preserves_existing_subtype(self, test_app, db_session):
        """Omitting account_subtype from a PUT body must not overwrite the stored value.

        The web client always sends account_subtype explicitly, but this test
        verifies the backend's exclude_unset behaviour independently — a missing
        field should never silently wipe an existing subtype.
        """
        client, _ = test_app
        _make_pro_user(db_session, self.UID)
        _auth(client.app, self.UID)
        resp = client.post("/api/accounts", json={
            "name": "PUT Stable",
            "type": "isa",
            "account_subtype": "stocks_shares_isa",
        })
        assert resp.status_code == 201, resp.text
        acct_id = resp.json()["id"]

        # PUT without account_subtype field — only rename the account
        resp = client.put(f"/api/accounts/{acct_id}", json={"name": "Renamed ISA"})
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["name"] == "Renamed ISA"
        assert data["account_subtype"] == "stocks_shares_isa", (
            "PUT without account_subtype field must preserve the existing value"
        )


# ─── Legacy accounts (no subtype) ────────────────────────────────────────────

class TestLegacyAccounts:
    UID = "subtype-legacy-001"

    def test_legacy_account_created_without_subtype_lists_cleanly(self, test_app, db_session):
        """Accounts seeded directly via ORM (as existing prod accounts are) have null subtype."""
        from backend.app.models import Account
        client, engine = test_app
        _make_pro_user(db_session, self.UID)
        _auth(client.app, self.UID)

        from sqlmodel import Session, select
        from backend.app.models import User
        with Session(engine) as s:
            user = s.exec(select(User).where(User.supabase_user_id == self.UID)).first()
            legacy = Account(
                user_id=user.id,
                name="Old Savings",
                type="bank",
                currency="GBP",
                balance=5000.0,
            )
            s.add(legacy)
            s.commit()
            s.refresh(legacy)
            legacy_id = legacy.id

        resp = client.get("/api/accounts")
        assert resp.status_code == 200, resp.text
        accounts = resp.json()
        legacy_data = next((a for a in accounts if a["id"] == legacy_id), None)
        assert legacy_data is not None
        assert legacy_data["account_subtype"] is None
        assert legacy_data["type"] == "bank"
