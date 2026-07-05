"""
Tests for free-vs-Pro account creation limits on POST /accounts.
"""

from __future__ import annotations

import os
import sys

import pytest

_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
if _REPO_ROOT not in sys.path:
    sys.path.insert(0, _REPO_ROOT)

os.environ.setdefault("DATABASE_URL", "sqlite:///./test_account_limits.db")
os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_JWT_SECRET", "test-secret-at-least-32-chars-long-padding")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")


@pytest.fixture(scope="module")
def test_app():
    from fastapi.testclient import TestClient
    from sqlmodel import SQLModel, Session, create_engine

    for db_path in ("./test_account_limits.db", "./test_account_limits_integration.db"):
        try:
            os.unlink(db_path)
        except FileNotFoundError:
            pass

    test_engine = create_engine(
        "sqlite:///./test_account_limits_integration.db",
        connect_args={"check_same_thread": False},
    )

    import backend.app.database as db_module

    original_engine = db_module.engine
    db_module.engine = test_engine

    import backend.app.models  # noqa: F401

    SQLModel.metadata.create_all(test_engine)

    def override_session():
        with Session(test_engine) as session:
            yield session

    from backend.app.database import get_session
    from backend.app.main import app as fastapi_app

    fastapi_app.dependency_overrides[get_session] = override_session

    client = TestClient(fastapi_app, raise_server_exceptions=True)
    yield client, test_engine

    db_module.engine = original_engine
    fastapi_app.dependency_overrides.clear()

    for db_path in ("./test_account_limits.db", "./test_account_limits_integration.db"):
        try:
            os.unlink(db_path)
        except FileNotFoundError:
            pass


@pytest.fixture()
def db_session(test_app):
    from sqlmodel import Session

    _, engine = test_app
    with Session(engine) as session:
        yield session


def _make_user(db_session, uid: str, *, is_pro: bool):
    from sqlmodel import select

    from backend.app.models import Settings, User

    user = db_session.exec(select(User).where(User.supabase_user_id == uid)).first()
    if not user:
        user = User(username=f"account-limit-{uid}", supabase_user_id=uid)
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)

    settings = db_session.exec(select(Settings).where(Settings.user_id == user.id)).first()
    if settings:
        settings.is_pro = is_pro
        db_session.add(settings)
    else:
        db_session.add(Settings(user_id=user.id, is_pro=is_pro))

    db_session.commit()
    return user


def _auth(app, uid: str):
    from fastapi import Depends
    from sqlmodel import Session, select

    from backend.app.auth import get_current_user
    from backend.app.database import get_session
    from backend.app.models import User

    def _dep(db: Session = Depends(get_session)):
        return db.exec(select(User).where(User.supabase_user_id == uid)).first()

    app.dependency_overrides[get_current_user] = _dep


def _post_account(client, *, name: str, account_type: str, subtype: str, balance: float):
    return client.post(
        "/api/accounts",
        json={
            "name": name,
            "type": account_type,
            "currency": "GBP",
            "balance": balance,
            "include_in_net_worth": True,
            "account_subtype": subtype,
            "monthly_contribution": 25,
            "annual_interest_rate_percent": 3.5,
        },
    )


class TestFreeAccountLimit:
    UID = "free-limit-001"

    def test_free_user_can_create_five_accounts_then_sixth_is_rejected(self, test_app, db_session):
        client, _ = test_app
        _make_user(db_session, self.UID, is_pro=False)
        _auth(client.app, self.UID)

        onboarding_accounts = [
            ("Current Account", "bank", "current_account", 1500),
            ("Cash ISA", "isa", "cash_isa", 5000),
            ("S&S ISA", "isa", "stocks_shares_isa", 12000),
            ("Workplace Pension", "pension", "workplace_pension", 45000),
            ("Premium Bonds", "savings", "premium_bonds", 2500),
        ]

        for expected_count, (name, account_type, subtype, balance) in enumerate(
            onboarding_accounts,
            start=1,
        ):
            resp = _post_account(
                client,
                name=name,
                account_type=account_type,
                subtype=subtype,
                balance=balance,
            )
            assert resp.status_code == 201, resp.text
            data = resp.json()
            assert data["account_subtype"] == subtype
            assert data["name"] == name

            list_resp = client.get("/api/accounts")
            assert list_resp.status_code == 200, list_resp.text
            assert len(list_resp.json()) == expected_count

        resp = _post_account(
            client,
            name="Credit Card",
            account_type="credit_card",
            subtype="credit_card",
            balance=1200,
        )

        assert resp.status_code == 403, resp.text
        assert resp.json()["detail"] == (
            "Free accounts are limited to 5. Upgrade to Pro for unlimited accounts."
        )

        list_resp = client.get("/api/accounts")
        assert list_resp.status_code == 200, list_resp.text
        assert len(list_resp.json()) == 5


class TestProAccountLimit:
    UID = "pro-limit-001"

    def test_pro_user_can_create_more_than_five_accounts(self, test_app, db_session):
        client, _ = test_app
        _make_user(db_session, self.UID, is_pro=True)
        _auth(client.app, self.UID)

        subtypes = [
            "current_account",
            "savings",
            "cash_isa",
            "stocks_shares_isa",
            "workplace_pension",
            "premium_bonds",
            "credit_card",
        ]

        for index, subtype in enumerate(subtypes, start=1):
            resp = _post_account(
                client,
                name=f"Pro Account {index}",
                account_type="other",
                subtype=subtype,
                balance=1000 * index,
            )
            assert resp.status_code == 201, resp.text
            assert resp.json()["account_subtype"] == subtype

        list_resp = client.get("/api/accounts")
        assert list_resp.status_code == 200, list_resp.text
        assert len(list_resp.json()) == 7
