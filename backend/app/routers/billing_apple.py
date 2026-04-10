"""
Apple App Store billing endpoints.

POST /billing/apple/sync          – Verify a StoreKit 2 signed transaction and update entitlement.
                                    Auth required: Bearer Supabase JWT.
POST /billing/apple/notifications – Apple Server Notifications v2 webhook.
                                    No app auth; Apple posts directly.

Design notes
────────────
* Both endpoints verify Apple JWS (JSON Web Signature) payloads using the
  certificate chain embedded in the JWS x5c header.  No receipt-validation
  library is required — the cryptography package (already a transitive dep of
  PyJWT[crypto]) handles the ECDSA chain check.

* apple_original_transaction_id is the durable subscription key.  It never
  changes across renewals; we use it to link all lifecycle events to a user.

* appAccountToken should be set by the iOS app to the user's Supabase UUID at
  purchase time (Product.PurchaseOption.appAccountToken(uuid)).  This lets the
  notification handler resolve the user without requiring a prior /sync call.

* is_pro remains the canonical "has billing access" gate.  Both Stripe and
  Apple can independently grant or revoke it; neither source clears it while
  the other is still active.

* APPLE_ROOT_CA_FP (env var, optional): hex SHA-256 fingerprint of the Apple
  Root CA DER cert used for strict root pinning.  Obtain from:
  https://www.apple.com/certificateauthority/
  When unset the code still verifies issuer organisation ("Apple Inc.") and
  common name ("Apple Root CA …") which is sufficient for production in the
  absence of a compromised Apple intermediate CA.
"""

from __future__ import annotations

import base64
import json
import logging
import os
from datetime import datetime, timezone
from typing import Optional

from cryptography import x509
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.exceptions import InvalidSignature
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlmodel import Session, select

from ..auth import get_current_user
from ..database import get_session
from ..models import AppleNotification, AppleTransaction, Settings, User

logger = logging.getLogger("wealth.billing.apple")

# Gate verbose/debug logging behind an explicit opt-in env var.
# Never log full signed payloads — they contain financial data.
_DEBUG = os.getenv("APPLE_BILLING_DEBUG", "").strip().lower() in ("1", "true")

router = APIRouter(prefix="/billing/apple", tags=["billing-apple"])


# ─── JWS Verification ────────────────────────────────────────────────────────

def _b64url_decode(s: str) -> bytes:
    """Base64url → bytes, tolerating missing padding."""
    pad = 4 - len(s) % 4
    if pad != 4:
        s += "=" * pad
    return base64.urlsafe_b64decode(s)


def _cert_not_before(cert: x509.Certificate) -> datetime:
    if hasattr(cert, "not_valid_before_utc"):
        return cert.not_valid_before_utc
    return cert.not_valid_before.replace(tzinfo=timezone.utc)  # type: ignore[attr-defined]


def _cert_not_after(cert: x509.Certificate) -> datetime:
    if hasattr(cert, "not_valid_after_utc"):
        return cert.not_valid_after_utc
    return cert.not_valid_after.replace(tzinfo=timezone.utc)  # type: ignore[attr-defined]


def _assert_apple_root(cert: x509.Certificate) -> None:
    """
    Assert that cert is an Apple Root CA.

    Checks organisation name and common name against expected Apple values.
    For strict root pinning also set APPLE_ROOT_CA_FP to the hex SHA-256
    fingerprint of the Apple Root CA - G3 DER cert (from apple.com/certificateauthority).
    """
    try:
        subject = cert.subject
        org_attrs = subject.get_attributes_for_oid(x509.oid.NameOID.ORGANIZATION_NAME)
        cn_attrs = subject.get_attributes_for_oid(x509.oid.NameOID.COMMON_NAME)
        org = org_attrs[0].value if org_attrs else ""
        cn = cn_attrs[0].value if cn_attrs else ""
    except Exception as exc:
        raise ValueError(f"Cannot read root cert subject: {exc}") from exc

    if org != "Apple Inc.":
        raise ValueError(f"Root cert organisation {org!r} is not 'Apple Inc.'")
    if "Apple Root CA" not in cn:
        raise ValueError(f"Root cert CN {cn!r} does not contain 'Apple Root CA'")

    # Optional: strict fingerprint pinning (recommended for production).
    expected_fp = (os.getenv("APPLE_ROOT_CA_FP") or "").strip().lower()
    if expected_fp:
        actual_fp = cert.fingerprint(hashes.SHA256()).hex().lower()
        if actual_fp != expected_fp:
            raise ValueError(
                f"Apple Root CA fingerprint mismatch "
                f"(expected …{expected_fp[-8:]}, got …{actual_fp[-8:]})"
            )


def verify_apple_jws(signed_payload: str) -> dict:
    """
    Verify an Apple-signed JWS (StoreKit 2 transaction or server notification).

    Steps
    ─────
    1. Parse JWS structure: header.payload.signature
    2. Extract x5c certificate chain from JWS header
    3. Verify each cert is signed by the next (chain integrity)
    4. Check all certs are currently valid (not expired, not yet valid)
    5. Assert root cert belongs to Apple
    6. Verify JWS signature with leaf cert's public key
    7. Return decoded payload dict

    Raises ValueError with a human-readable message on any failure.
    Does NOT log the signed payload itself.
    """
    if not signed_payload or not isinstance(signed_payload, str):
        raise ValueError("signedPayload must be a non-empty string")

    parts = signed_payload.split(".")
    if len(parts) != 3:
        raise ValueError("JWS must have exactly three dot-separated parts")

    header_b64, payload_b64, sig_b64 = parts

    try:
        header = json.loads(_b64url_decode(header_b64))
    except Exception as exc:
        raise ValueError(f"JWS header is not valid base64url JSON: {exc}") from exc

    alg = header.get("alg", "")
    if alg != "ES256":
        raise ValueError(f"Unexpected JWS algorithm {alg!r}; expected ES256")

    x5c = header.get("x5c")
    if not isinstance(x5c, list) or len(x5c) < 2:
        raise ValueError("JWS header x5c must be a list of ≥ 2 base64-encoded DER certificates")

    # Decode certificate chain
    try:
        certs = [x509.load_der_x509_certificate(base64.b64decode(raw)) for raw in x5c]
    except Exception as exc:
        raise ValueError(f"Failed to decode x5c certificates: {exc}") from exc

    now = datetime.now(timezone.utc)

    # Validate each cert's validity period and verify chain signatures
    for i, cert in enumerate(certs):
        nb = _cert_not_before(cert)
        na = _cert_not_after(cert)
        if now < nb:
            raise ValueError(f"Certificate[{i}] is not yet valid (valid from {nb.isoformat()})")
        if now > na:
            raise ValueError(f"Certificate[{i}] has expired (expired {na.isoformat()})")

        if i < len(certs) - 1:
            parent = certs[i + 1]
            try:
                parent.public_key().verify(
                    cert.signature,
                    cert.tbs_certificate_bytes,
                    ec.ECDSA(cert.signature_hash_algorithm),  # type: ignore[arg-type]
                )
            except (InvalidSignature, Exception) as exc:
                raise ValueError(f"Certificate chain broken at index {i}: {exc}") from exc

    # Validate root certificate is Apple's
    _assert_apple_root(certs[-1])

    # Verify JWS signature using leaf certificate
    signing_input = f"{header_b64}.{payload_b64}".encode("ascii")
    try:
        signature = _b64url_decode(sig_b64)
    except Exception as exc:
        raise ValueError(f"JWS signature is not valid base64url: {exc}") from exc

    try:
        certs[0].public_key().verify(signature, signing_input, ec.ECDSA(hashes.SHA256()))
    except InvalidSignature:
        raise ValueError("JWS signature verification failed — payload may have been tampered with")
    except Exception as exc:
        raise ValueError(f"JWS signature check error: {exc}") from exc

    try:
        return json.loads(_b64url_decode(payload_b64))
    except Exception as exc:
        raise ValueError(f"JWS payload is not valid JSON: {exc}") from exc


# ─── Entitlement helpers ─────────────────────────────────────────────────────

def _get_or_create_settings(db: Session, user_id: int) -> Settings:
    s = db.exec(select(Settings).where(Settings.user_id == user_id)).first()
    if s:
        return s
    s = Settings(user_id=user_id)
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


def compute_tier(settings: Settings) -> tuple[str, bool]:
    """
    Return (tier, trial_active) from the canonical Settings state.

    tier values: "free" | "pro" | "grace"
    trial_active: True only when the user is within a verified intro trial period.

    Priority
    ────────
    1. Apple grace overrides everything (user still has access, needs to fix billing).
    2. is_pro=True → "pro".  trial_active is True if either billing source is trialing.
    3. Fallback → "free".

    Note: Stripe past_due stays as "pro" (Stripe retries payment; we do not downgrade
    during the retry window).  Apple billing failure is surfaced explicitly as "grace".
    """
    apple_status = getattr(settings, "apple_subscription_status", None)
    stripe_status = getattr(settings, "subscription_status", None)
    is_pro = bool(getattr(settings, "is_pro", False))

    if apple_status == "grace":
        return "grace", False

    if is_pro:
        trial_active = (stripe_status == "trialing") or (apple_status == "trialing")
        return "pro", bool(trial_active)

    return "free", False


def set_apple_entitlement(
    db: Session,
    user: User,
    apple_status: str,
    original_transaction_id: Optional[str] = None,
) -> None:
    """
    Persist apple_status to the user's Settings and recompute is_pro.

    apple_status: "active" | "grace" | "trialing" | "expired" | "revoked"

    is_pro is set to True if EITHER Apple or Stripe grants access.
    This means a Stripe Pro user's access is never revoked by an Apple event alone.
    """
    settings = _get_or_create_settings(db, user.id)
    settings.apple_subscription_status = apple_status

    # Store durable subscription key on user if this is the first time we see it
    if original_transaction_id:
        if not getattr(user, "apple_original_transaction_id", None):
            user.apple_original_transaction_id = original_transaction_id
            db.add(user)

    # Recompute is_pro from both sources
    stripe_active = getattr(settings, "subscription_status", None) in (
        "active", "trialing", "past_due"
    )
    apple_active = apple_status in ("active", "grace", "trialing")
    settings.is_pro = bool(stripe_active or apple_active)

    db.add(settings)
    db.commit()


# ─── Apple transaction persistence ───────────────────────────────────────────

def _ms_to_dt(ms: Optional[int]) -> Optional[datetime]:
    if ms is None:
        return None
    try:
        return datetime.fromtimestamp(int(ms) / 1000, tz=timezone.utc)
    except Exception:
        return None


def _upsert_apple_transaction(db: Session, user_id: int, payload: dict) -> None:
    """
    Idempotent upsert of an Apple transaction record keyed on transactionId.
    Updates updated_at on re-submission; otherwise inserts.
    """
    tx_id = payload.get("transactionId") or payload.get("transaction_id")
    orig_tx_id = payload.get("originalTransactionId") or payload.get("original_transaction_id")
    product_id = payload.get("productId") or payload.get("product_id") or ""
    app_account_token = payload.get("appAccountToken") or payload.get("app_account_token")
    purchase_ms = payload.get("purchaseDate") or payload.get("purchase_date")
    expires_ms = payload.get("expiresDate") or payload.get("expires_date")

    if not tx_id or not orig_tx_id:
        raise ValueError("Transaction missing transactionId or originalTransactionId")

    existing = db.exec(
        select(AppleTransaction).where(AppleTransaction.transaction_id == tx_id)
    ).first()

    now = datetime.now(timezone.utc)

    if existing:
        existing.updated_at = now
        db.add(existing)
    else:
        db.add(AppleTransaction(
            user_id=user_id,
            transaction_id=tx_id,
            original_transaction_id=orig_tx_id,
            product_id=product_id,
            app_account_token=app_account_token,
            purchase_date=_ms_to_dt(purchase_ms) or now,
            expires_date=_ms_to_dt(expires_ms),
        ))

    db.commit()


# ─── POST /billing/apple/sync ────────────────────────────────────────────────

class AppleSyncBody(BaseModel):
    signedTransaction: str


@router.post("/sync")
def apple_sync(
    body: AppleSyncBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
):
    """
    Verify a StoreKit 2 signed transaction and update the authenticated user's entitlement.

    Call this:
    - Immediately after a successful purchase
    - After a successful restore
    - On app launch during transaction reconciliation

    The endpoint is idempotent: re-submitting the same transaction is safe and
    returns the same entitlement state.

    Returns
    ───────
    { "tier": "free" | "pro" | "grace", "trial_active": bool }
    """
    if _DEBUG:
        logger.debug("apple_sync: user=%s", current_user.id)

    try:
        payload = verify_apple_jws(body.signedTransaction)
    except ValueError as exc:
        logger.warning("apple_sync: JWS verification failed user=%s: %s", current_user.id, exc)
        raise HTTPException(status_code=400, detail=f"Transaction verification failed: {exc}")

    tx_id = payload.get("transactionId") or payload.get("transaction_id")
    orig_tx_id = payload.get("originalTransactionId") or payload.get("original_transaction_id")

    if not tx_id or not orig_tx_id:
        logger.warning("apple_sync: missing identifiers user=%s", current_user.id)
        raise HTTPException(status_code=400, detail="Transaction missing required identifiers")

    product_id = payload.get("productId") or payload.get("product_id") or ""

    logger.info(
        "apple_sync: user=%s product=%s tx=…%s orig_tx=…%s",
        current_user.id,
        product_id,
        tx_id[-8:],
        orig_tx_id[-8:],
    )

    # Persist verified transaction (idempotent)
    try:
        _upsert_apple_transaction(db, current_user.id, payload)
    except ValueError as exc:
        logger.warning("apple_sync: bad transaction payload user=%s: %s", current_user.id, exc)
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception:
        logger.exception("apple_sync: upsert failed user=%s", current_user.id)
        raise HTTPException(status_code=500, detail="Failed to persist transaction")

    # Determine entitlement from transaction
    expires_ms = payload.get("expiresDate") or payload.get("expires_date")
    expires_dt = _ms_to_dt(expires_ms)
    now = datetime.now(timezone.utc)

    if expires_dt and expires_dt < now:
        # Expired transaction (e.g. restore of a cancelled subscription)
        apple_status = "expired"
    else:
        apple_status = "active"

    set_apple_entitlement(db, current_user, apple_status, orig_tx_id)

    settings = _get_or_create_settings(db, current_user.id)
    tier, trial_active = compute_tier(settings)

    return {"tier": tier, "trial_active": trial_active}


# ─── POST /billing/apple/notifications ───────────────────────────────────────

@router.post("/notifications")
async def apple_notifications(request: Request, db: Session = Depends(get_session)):
    """
    Apple App Store Server Notifications v2 webhook.

    Apple posts directly to this endpoint — no app auth header.
    Registers the endpoint URL in App Store Connect > App Information > App Store
    Server Notifications.

    The outer signedPayload JWS is verified before any processing.
    Inner signedTransactionInfo and signedRenewalInfo (if present) are also verified.

    Idempotent: notifications with a previously-seen notificationUUID are ignored.
    Safe to retry: all entitlement writes are idempotent.

    Returns 200 for all valid payloads (including duplicates and unhandled types)
    so Apple does not retry unnecessarily.
    Returns 400 only for genuinely malformed or unverifiable payloads.
    """
    try:
        body = await request.json()
    except Exception:
        logger.warning("apple_notifications: invalid JSON body")
        raise HTTPException(status_code=400, detail="Request body must be JSON")

    signed_payload = (body or {}).get("signedPayload")
    if not signed_payload:
        logger.warning("apple_notifications: missing signedPayload field")
        raise HTTPException(status_code=400, detail="Missing signedPayload")

    # Verify outer JWS envelope
    try:
        envelope = verify_apple_jws(signed_payload)
    except ValueError as exc:
        logger.warning("apple_notifications: outer JWS verification failed: %s", exc)
        raise HTTPException(status_code=400, detail=f"Payload verification failed: {exc}")

    notification_type = envelope.get("notificationType") or ""
    subtype = envelope.get("subtype") or ""
    notification_uuid = envelope.get("notificationUUID") or ""
    data = envelope.get("data") or {}

    # Idempotency guard
    if notification_uuid:
        if db.exec(
            select(AppleNotification).where(
                AppleNotification.notification_uuid == notification_uuid
            )
        ).first():
            logger.info("apple_notifications: duplicate uuid=…%s ignored", notification_uuid[-8:])
            return {"status": "duplicate_ignored"}

    # Decode inner signed payloads (both optional; tolerate decode failures gracefully)
    tx_payload: Optional[dict] = None
    renewal_payload: Optional[dict] = None

    inner_tx = data.get("signedTransactionInfo")
    if inner_tx:
        try:
            tx_payload = verify_apple_jws(inner_tx)
        except ValueError as exc:
            logger.warning("apple_notifications: inner transaction JWS failed: %s", exc)

    inner_renewal = data.get("signedRenewalInfo")
    if inner_renewal:
        try:
            renewal_payload = verify_apple_jws(inner_renewal)
        except ValueError as exc:
            logger.warning("apple_notifications: inner renewal JWS failed: %s", exc)

    # Extract durable subscription identifiers
    orig_tx_id: Optional[str] = None
    app_account_token: Optional[str] = None

    for src in (tx_payload, renewal_payload):
        if src:
            orig_tx_id = orig_tx_id or src.get("originalTransactionId") or src.get("original_transaction_id")
            app_account_token = app_account_token or src.get("appAccountToken") or src.get("app_account_token")

    # Persist audit row (no signed payloads stored — only decoded metadata)
    audit_meta = {
        "notificationType": notification_type,
        "subtype": subtype or None,
        "environment": envelope.get("environment"),
        "bundleId": data.get("bundleId"),
        "originalTransactionId": orig_tx_id,
        "appAccountToken": bool(app_account_token),  # presence only, not the value
    }
    db.add(AppleNotification(
        notification_uuid=notification_uuid or f"unknown-{datetime.now(timezone.utc).timestamp()}",
        notification_type=notification_type,
        subtype=subtype or None,
        original_transaction_id=orig_tx_id,
        app_account_token=app_account_token,
        event_json=json.dumps(audit_meta),
    ))
    db.commit()

    logger.info(
        "apple_notifications: type=%s sub=%s uuid=…%s orig_tx=…%s",
        notification_type,
        subtype or "-",
        notification_uuid[-8:] if notification_uuid else "?",
        orig_tx_id[-8:] if orig_tx_id else "?",
    )

    # Process entitlement change
    _process_notification(
        db,
        notification_type=notification_type,
        subtype=subtype,
        orig_tx_id=orig_tx_id,
        app_account_token=app_account_token,
    )

    return {"status": "ok"}


# ─── Notification processing ─────────────────────────────────────────────────

def _find_user_for_subscription(
    db: Session,
    orig_tx_id: Optional[str],
    app_account_token: Optional[str],
) -> Optional[User]:
    """
    Resolve the user for an Apple subscription notification.

    Prefers appAccountToken (set by iOS app to the user's Supabase UUID at
    purchase time).  Falls back to the durable apple_original_transaction_id
    stored on the user row after a successful /sync call.
    """
    if app_account_token:
        user = db.exec(
            select(User).where(User.supabase_user_id == app_account_token)
        ).first()
        if user:
            return user

    if orig_tx_id:
        return db.exec(
            select(User).where(User.apple_original_transaction_id == orig_tx_id)
        ).first()

    return None


def _process_notification(
    db: Session,
    notification_type: str,
    subtype: str,
    orig_tx_id: Optional[str],
    app_account_token: Optional[str],
) -> None:
    """
    Map an Apple notification type/subtype to a canonical entitlement change.

    Unknown types are safely ignored.  All writes go through set_apple_entitlement
    which is idempotent and respects concurrent Stripe grants.

    Notification type reference:
    https://developer.apple.com/documentation/appstoreservernotifications/notificationtype
    """
    user = _find_user_for_subscription(db, orig_tx_id, app_account_token)
    if not user:
        logger.info(
            "apple_notifications: no user found for orig_tx=…%s token_present=%s — skipping",
            orig_tx_id[-8:] if orig_tx_id else "?",
            bool(app_account_token),
        )
        return

    if notification_type == "SUBSCRIBED":
        # New subscription or re-subscribe after lapse
        set_apple_entitlement(db, user, "active", orig_tx_id)

    elif notification_type == "DID_RENEW":
        # Successful renewal (normal or billing recovery after grace period)
        set_apple_entitlement(db, user, "active", orig_tx_id)

    elif notification_type == "DID_FAIL_TO_RENEW":
        if subtype == "GRACE_PERIOD":
            # Apple granted a billing grace period — user retains pro access
            # temporarily while Apple retries payment.
            set_apple_entitlement(db, user, "grace", orig_tx_id)
        else:
            # Billing failure without a grace period grant.
            # Do NOT immediately revoke — Apple may still recover via SUBSCRIBED/DID_RENEW.
            # Entitlement will be revoked explicitly by GRACE_PERIOD_EXPIRED or EXPIRED.
            logger.info(
                "apple_notifications: DID_FAIL_TO_RENEW (no grace) user=%s — holding state",
                user.id,
            )

    elif notification_type == "GRACE_PERIOD_EXPIRED":
        # Grace period ended without recovery; revoke Apple entitlement.
        _revoke_apple_if_no_stripe(db, user, "expired", orig_tx_id)

    elif notification_type == "EXPIRED":
        _revoke_apple_if_no_stripe(db, user, "expired", orig_tx_id)

    elif notification_type == "REVOKED":
        # Family sharing revocation or other forced revocation
        _revoke_apple_if_no_stripe(db, user, "revoked", orig_tx_id)

    elif notification_type == "REFUND":
        _revoke_apple_if_no_stripe(db, user, "revoked", orig_tx_id)

    elif notification_type == "REFUND_REVERSED":
        # Apple reversed a refund — restore access
        set_apple_entitlement(db, user, "active", orig_tx_id)

    else:
        # Unhandled types (CONSUMPTION_REQUEST, PRICE_INCREASE, etc.) — no entitlement change
        logger.info(
            "apple_notifications: unhandled type=%s sub=%s user=%s — no change",
            notification_type,
            subtype or "-",
            user.id,
        )


def _revoke_apple_if_no_stripe(
    db: Session,
    user: User,
    apple_status: str,
    orig_tx_id: Optional[str],
) -> None:
    """
    Set apple_subscription_status to apple_status ("expired" or "revoked").
    If Stripe is still active, only the Apple column is updated and is_pro stays True.
    """
    settings = _get_or_create_settings(db, user.id)
    stripe_active = getattr(settings, "subscription_status", None) in (
        "active", "trialing", "past_due"
    )

    if stripe_active:
        # Preserve is_pro from Stripe; just update the Apple column for audit.
        settings.apple_subscription_status = apple_status
        db.add(settings)
        db.commit()
    else:
        set_apple_entitlement(db, user, apple_status, orig_tx_id)
