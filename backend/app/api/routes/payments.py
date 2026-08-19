from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from datetime import UTC, datetime, date, timedelta
import uuid, time
from app.models.payout import Payout
from app.models.user import User
from app.models.ledger import TransactionLedger, TransactionType, TransactionStatus
from app.models.audit_log import AdminAuditLog, AuditActionType
from app.api.routes.auth import get_admin_user, get_current_user, get_current_user_optional
from app.schemas.payout import PayoutRequest, CampaignWithdrawalSummaryResponse, WithdrawalHistoryItem
from app.core.config import settings
from sqlalchemy import func

from app.db.database import get_db
from app.models.campaign import Campaign, CampaignStatus
from app.models.campaign_goal import CampaignGoal, GoalStatus
from app.models.donation import Donation
from app.models.recurring_donation import RecurringDonation
from app.schemas.donation import (
    ApsConfirmRequest,
    ApsConfirmResponse,
    DonationCreate,
    DonationManualApproveRequest,
    DonationManualRejectRequest,
    DonationReconciliationResponse,
)
from app.schemas.recurring_donation import (
    RecurringDonationCreate,
    RecurringDonationRead,
    RecurringDonationUpdate,
    RecurringDonationListResponse,
)
from app.services.hexai_service import HexAIGatewayError, HexAIPaymentService
from app.services.email_service import (
    send_email,
    render_recurring_donation_confirmation_email,
    render_withdrawal_initiated_email,
)
from app.services.payment_reconciliation import (
    DonationNotFoundError,
    DonationTransitionConflictError,
    reconcile_donation_status,
)
from app.services.payout_service import apply_payout_status, normalize_gateway_status
from app.core.logging_config import get_logger

router = APIRouter(prefix="/payments", tags=["Payments"])
hexai_service = HexAIPaymentService()
logger = get_logger("payments")


async def get_campaign_withdrawal_summary(
    db: AsyncSession,
    campaign: Campaign,
) -> tuple[float, float, list[Payout]]:
    payouts_result = await db.execute(
        select(Payout)
        .where(Payout.campaign_id == campaign.id)
        .order_by(Payout.created_at.desc())
    )
    payouts = list(payouts_result.scalars().all())
    # Use net_amount (what actually left our HexAI account) to stay consistent
    # with amount_raised which is already net of the 2% HexAI collection fee.
    total_net_withdrawn = sum((payout.net_amount or payout.amount or 0.0) for payout in payouts if payout.status == "SUCCEEDED")
    # PENDING payouts are already in flight at the gateway — reserve them so a
    # second withdrawal can't spend the same balance. FAILED releases the hold.
    pending_reserved = sum((payout.net_amount or payout.amount or 0.0) for payout in payouts if payout.status == "PENDING")
    available_balance = campaign.amount_raised - total_net_withdrawn - pending_reserved
    return available_balance, total_net_withdrawn, payouts


@router.post("/admin/donations/{client_reference}/approve", response_model=DonationReconciliationResponse)
async def approve_pending_donation(
    client_reference: str,
    payload: DonationManualApproveRequest,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_admin_user),
):
    try:
        result = await reconcile_donation_status(
            db,
            client_reference=client_reference,
            target_status="SUCCEEDED",
            source="MANUAL_ADMIN",
            reason=payload.reason,
            reviewed_by_admin_id=current_admin.id,
        )
    except DonationNotFoundError:
        raise HTTPException(status_code=404, detail="Donation not found")
    except DonationTransitionConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc))

    logger.info(
        "Donation manually approved by admin",
        extra={
            "action": "admin_approve_donation",
            "admin_user_id": current_admin.id,
            "client_reference": client_reference,
            "previous_status": result["previous_status"],
            "new_status": result["new_status"],
            "idempotent": result["idempotent"],
        },
    )

    donation = result["donation"]
    audit_row = AdminAuditLog(
        action_type=AuditActionType.DONATION_MANUAL_APPROVED.value,
        performed_by_admin_id=current_admin.id,
        target_entity_type="Donation",
        target_entity_id=getattr(donation, "id", 0),
        campaign_id=getattr(donation, "campaign_id", None),
        description=f"Manual approve for donation {client_reference}",
        details=payload.reason,
        old_value=str(result["previous_status"]),
        new_value=str(result["new_status"]),
    )
    db.add(audit_row)
    await db.commit()

    return DonationReconciliationResponse(
        client_reference=client_reference,
        donation_status=str(result["new_status"]),
        previous_status=str(result["previous_status"]),
        idempotent=bool(result["idempotent"]),
        source=str(result["reconciliation_source"]),
        reason=payload.reason,
        reconciled_by_admin_id=result["reconciled_by_admin_id"],
        reconciled_at=result["reconciled_at"],
    )


@router.post("/admin/donations/{client_reference}/reject", response_model=DonationReconciliationResponse)
async def reject_pending_donation(
    client_reference: str,
    payload: DonationManualRejectRequest,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_admin_user),
):
    try:
        result = await reconcile_donation_status(
            db,
            client_reference=client_reference,
            target_status="FAILED",
            source="MANUAL_ADMIN",
            reason=payload.reason,
            reviewed_by_admin_id=current_admin.id,
        )
    except DonationNotFoundError:
        raise HTTPException(status_code=404, detail="Donation not found")
    except DonationTransitionConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc))

    logger.info(
        "Donation manually rejected by admin",
        extra={
            "action": "admin_reject_donation",
            "admin_user_id": current_admin.id,
            "client_reference": client_reference,
            "previous_status": result["previous_status"],
            "new_status": result["new_status"],
            "idempotent": result["idempotent"],
            "reason": payload.reason,
        },
    )

    donation = result["donation"]
    audit_row = AdminAuditLog(
        action_type=AuditActionType.DONATION_MANUAL_REJECTED.value,
        performed_by_admin_id=current_admin.id,
        target_entity_type="Donation",
        target_entity_id=getattr(donation, "id", 0),
        campaign_id=getattr(donation, "campaign_id", None),
        description=f"Manual reject for donation {client_reference}",
        details=payload.reason,
        old_value=str(result["previous_status"]),
        new_value=str(result["new_status"]),
    )
    db.add(audit_row)
    await db.commit()

    return DonationReconciliationResponse(
        client_reference=client_reference,
        donation_status=str(result["new_status"]),
        previous_status=str(result["previous_status"]),
        idempotent=bool(result["idempotent"]),
        source=str(result["reconciliation_source"]),
        reason=payload.reason,
        reconciled_by_admin_id=result["reconciled_by_admin_id"],
        reconciled_at=result["reconciled_at"],
    )

@router.post("/donate")
async def initiate_donation(
    donation_in: DonationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    """Initiates a donation via the HexAI Payment Gateway (Wave by default,
    or Waychit Card via `provider`). Works anonymously; a logged-in donor
    gets the donation linked to their account for giving history."""
    
    # 1. Verify the campaign exists and is active
    result = await db.execute(select(Campaign).where(Campaign.id == donation_in.campaign_id))
    campaign = result.scalars().first()
    
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if campaign.status != CampaignStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="This campaign is no longer accepting donations.")

    goal = None
    if donation_in.goal_id is not None:
        goal_result = await db.execute(select(CampaignGoal).where(CampaignGoal.id == donation_in.goal_id))
        goal = goal_result.scalars().first()
        if not goal or goal.campaign_id != campaign.id:
            raise HTTPException(status_code=400, detail="Selected goal does not belong to this campaign")
        if goal.status != GoalStatus.ACTIVE:
            raise HTTPException(status_code=400, detail="Selected goal is not accepting funding")

    # 2. Generate a unique client reference (Made it 10 chars just to be ultra-safe)
    client_reference = f"DON-{uuid.uuid4().hex[:10].upper()}"

    # 3. Call HexAI Gateway FIRST (Don't touch the database yet!)
    frontend_base = settings.FRONTEND_URL.rstrip("/")
    success_url = f"{frontend_base}/payment/success?ref={client_reference}&slug={campaign.slug}"
    error_url = f"{frontend_base}/payment/failed?ref={client_reference}&slug={campaign.slug}"

    # HPG expects rail identifiers uppercase (WAVE|APS|WAYCHIT_CARD); omit
    # entirely for "wave" so the gateway's own default applies unchanged.
    gateway_provider = donation_in.provider.upper() if donation_in.provider and donation_in.provider != "wave" else None

    try:
        hexai_response = await hexai_service.initiate_donation(
            amount=donation_in.amount,
            client_reference=client_reference,
            customer_name=donation_in.donor_name or "Anonymous Donor",
            success_url=success_url,
            error_url=error_url,
            provider=gateway_provider,
            customer_mobile=donation_in.customer_mobile if donation_in.provider == "aps" else None,
            customer_email=donation_in.customer_email,
        )
    except HexAIGatewayError as exc:
        # Gateway-side validation (e.g. a missing required field) — surface
        # the real message rather than a flattened 500.
        raise HTTPException(status_code=400, detail=exc.message)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    gateway_data = hexai_response.get("data", {})
    next_action = gateway_data.get("next_action") or {}

    # 4. If HexAI succeeds, NOW we save the PENDING donation to the DB
    new_donation = Donation(
        campaign_id=campaign.id,
        goal_id=goal.id if goal else None,
        user_id=current_user.id if current_user else None,
        client_reference=client_reference,
        amount=donation_in.amount,
        donor_name=donation_in.donor_name,
        donor_email=donation_in.customer_email,
        message=donation_in.message,
        status="PENDING",
        provider=donation_in.provider or "wave",
        gateway_transaction_id=gateway_data.get("transaction_id"),
        gateway_request_token=next_action.get("request_token"),
    )
    db.add(new_donation)

    # Mirror donation initiation in the transaction ledger so admin reports
    # can see pending donations before webhook confirmation.
    donation_ledger_entry = TransactionLedger(
        campaign_id=campaign.id,
        transaction_type=TransactionType.DONATION,
        status=TransactionStatus.PENDING,
        gross_amount=donation_in.amount,
        hexai_fee=0.0,
        platform_commission=0.0,
        net_amount=donation_in.amount,
        external_reference=client_reference,
        description=f"Donation initiated by {donation_in.donor_name or 'Anonymous'}",
        created_by_user_id=None,
        confirmed_at=None,
    )
    db.add(donation_ledger_entry)

    await db.commit()
    logger.info(
        "Donation initiated",
        extra={
            "action": "initiate_donation",
            "donor_name": donation_in.donor_name,
            "amount": donation_in.amount,
            "campaign_id": campaign.id,
            "goal_id": goal.id if goal else None,
            "client_reference": client_reference,
        },
    )

    return {
        "client_reference": client_reference,
        "redirect_url": gateway_data.get("redirect_url"),
        # APS has no redirect — the frontend switches to an OTP-entry step
        # when it sees this instead of a redirect_url.
        "otp_required": next_action.get("type") == "confirm_otp",
        "campaign_slug": campaign.slug,
    }


@router.post("/aps/confirm", response_model=ApsConfirmResponse)
async def confirm_aps_donation(
    payload: ApsConfirmRequest,
    db: AsyncSession = Depends(get_db),
):
    """Step 3 of the APS wallet+OTP flow: charge the wallet with the code the
    donor was texted. Synchronous — HPG's response is authoritative, so we
    reconcile immediately rather than waiting on the backup webhook."""
    result = await db.execute(select(Donation).where(Donation.client_reference == payload.client_reference))
    donation = result.scalars().first()
    if not donation:
        raise HTTPException(status_code=404, detail="Donation not found")
    if donation.provider != "aps":
        raise HTTPException(status_code=400, detail="This donation was not initiated via APS")
    if not donation.gateway_transaction_id or not donation.gateway_request_token:
        raise HTTPException(status_code=400, detail="No pending OTP confirmation for this donation")
    if donation.status != "PENDING":
        # Already resolved (e.g. by the backup webhook) — report the current
        # state instead of erroring, so a slow/duplicate confirm is harmless.
        return ApsConfirmResponse(status=donation.status, client_reference=donation.client_reference)

    try:
        confirm_response = await hexai_service.confirm_collection(
            transaction_id=donation.gateway_transaction_id,
            otp=payload.otp,
            request_token=donation.gateway_request_token,
        )
    except HexAIGatewayError as exc:
        # Wrong/expired OTP etc — surface HPG's message so the donor can retry.
        raise HTTPException(status_code=400, detail=exc.message)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    gateway_status = str(confirm_response.get("data", {}).get("status") or "").upper()
    if gateway_status not in ("SUCCEEDED", "FAILED"):
        raise HTTPException(status_code=502, detail=f"Unexpected status from gateway: {gateway_status or 'none'}")

    try:
        reconciled = await reconcile_donation_status(
            db,
            client_reference=payload.client_reference,
            target_status=gateway_status,
            source="APS_CONFIRM",
            reason="aps_otp_confirmed",
        )
    except DonationNotFoundError:
        raise HTTPException(status_code=404, detail="Donation not found")
    except DonationTransitionConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc))

    logger.info(
        "APS donation confirmed",
        extra={
            "action": "aps_confirm",
            "client_reference": payload.client_reference,
            "status": gateway_status,
        },
    )
    return ApsConfirmResponse(status=reconciled["new_status"], client_reference=payload.client_reference)
    
    
    
@router.post("/withdraw")
async def withdraw_funds(
        payout_req: PayoutRequest,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user) # 👈 Requires login!
    ):
        
    """Campaigners use this to withdraw funds to their Wave account"""
    
    # 1. Verify KYC Status (Required before withdrawals)
    if current_user.kyc_status != "APPROVED":
        raise HTTPException(
            status_code=403,
            detail=f"KYC verification required to withdraw funds. Current status: {current_user.kyc_status}. Please submit and wait for approval."
        )
    
    # 2. Verify Campaign Ownership
    result = await db.execute(select(Campaign).where(Campaign.id == payout_req.campaign_id))
    campaign = result.scalars().first()

    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    if campaign.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the campaign owner can withdraw funds")

    # 3. Calculate Available Balance (Updated for new fee structure)
    available_balance, total_gross_withdrawn, _ = await get_campaign_withdrawal_summary(db, campaign)

    if payout_req.amount > available_balance:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient funds. You only have {available_balance:.2f} GMD available."
        )

    # 4. Calculate fee breakdown — check for an active fee waiver first
    # (Founding Campaigns / NGO onboarding / referral reward). See
    # app/services/promotions.py for the priority order (no stacking).
    from app.services.promotions import resolve_withdrawal_fee_waiver

    gross_amount = payout_req.amount
    hexai_fee = gross_amount * settings.HEXAI_WITHDRAWAL_FEE_PERCENT
    standard_commission = settings.PLATFORM_FIXED_COMMISSION_GMD

    waiver = await resolve_withdrawal_fee_waiver(db, campaign, current_user)
    platform_commission = round(standard_commission * (1 - (waiver.waiver_pct / 100 if waiver.applies else 0.0)), 2)
    fee_waived_amount = round(standard_commission - platform_commission, 2)
    net_amount = gross_amount - hexai_fee - platform_commission

    # Ensure net amount is positive
    if net_amount <= 0:
        raise HTTPException(
            status_code=400,
            detail=f"Withdrawal amount too small. After fees ({hexai_fee:.2f} GMD HexAI + {platform_commission:.2f} GMD platform), you would receive {net_amount:.2f} GMD. Minimum recommended withdrawal: {hexai_fee + platform_commission + 1:.2f} GMD"
        )

    # 5. Generate Payout Reference
    client_reference = f"PAYOUT-{int(time.time() * 1000)}"

    # 5.5 Format the Phone Number for Wave (+220)
    formatted_mobile = current_user.wave_number.strip()
    if not formatted_mobile.startswith("+220"):
        # If they entered 07834351, strip the 0. Otherwise just prepend +220.
        formatted_mobile = f"+220{formatted_mobile.lstrip('0')}"

    # 5.6 Pre-flight: verify the recipient is a registered Wave user before
    # sending, to avoid a failed payout to an unregistered number. Fails
    # open on any gateway/network error — this is a safety net, not a
    # blocker for real money movement — and only hard-blocks on the one
    # unambiguous signal (receive limit reached); a name mismatch alone
    # can be legitimate (nicknames, formatting) so it's logged, not blocked.
    verify_data: dict = {}
    try:
        verification = await hexai_service.verify_payout_recipient(
            mobile=formatted_mobile, name=current_user.full_name, amount=net_amount,
        )
        verify_data = verification.get("data", {})
    except Exception as exc:
        logger.warning(
            "Recipient verification unavailable — proceeding with payout anyway",
            extra={"action": "payout_verify_recipient_failed", "user_id": current_user.id, "error": str(exc)},
        )

    if verify_data.get("receive_limit_reached"):
        raise HTTPException(status_code=400, detail="This Wave number has reached its receive limit for this amount.")
    if verify_data.get("name_match") is False:
        logger.warning(
            "Payout recipient name mismatch — proceeding anyway",
            extra={"action": "payout_verify_name_mismatch", "user_id": current_user.id, "gateway_name": verify_data.get("name")},
        )

    # 6. Process Payout with HexAI
    try:
        hexai_response, hexai_net_amount = await hexai_service.initiate_payout(
            requested_amount=net_amount,  # Send the net amount after Kambeng fees
            recipient_mobile=formatted_mobile,
            payout_reference=client_reference,
            recipient_name=current_user.full_name # <--- Passes the real DB name
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Payout Gateway Error: {str(e)}")

    # 7. Save payout as PENDING — webhook/poll will mark it SUCCEEDED or FAILED
    new_payout = Payout(
        campaign_id=campaign.id,
        client_reference=client_reference,
        gross_amount=gross_amount,
        hexai_fee=hexai_fee,
        platform_commission=platform_commission,
        net_amount=net_amount,
        amount=net_amount,
        status="PENDING",
        gateway_transaction_id=(hexai_response or {}).get("data", {}).get("transaction_id"),
    )
    db.add(new_payout)

    # 8. Record in ledger as PENDING
    ledger_entry = TransactionLedger(
        campaign_id=campaign.id,
        transaction_type=TransactionType.WITHDRAWAL,
        status=TransactionStatus.PENDING,
        gross_amount=gross_amount,
        hexai_fee=hexai_fee,
        platform_commission=platform_commission,
        net_amount=net_amount,
        external_reference=client_reference,
        description=f"Withdrawal to {formatted_mobile}",
        created_by_user_id=current_user.id,
        confirmed_at=None,
    )
    db.add(ledger_entry)
    await db.flush()

    if waiver.applies:
        from app.services.promotions import record_withdrawal_waiver_application

        await record_withdrawal_waiver_application(
            db,
            result=waiver,
            campaign=campaign,
            owner=current_user,
            payout=new_payout,
            fee_waived_amount=fee_waived_amount,
        )

    await db.commit()
    logger.info(
        "Withdrawal initiated",
        extra={
            "action": "withdraw_funds",
            "user_id": current_user.id,
            "email": current_user.email,
            "campaign_id": campaign.id,
            "gross_amount": gross_amount,
            "net_amount": net_amount,
            "payout_id": new_payout.id,
            "client_reference": client_reference,
            "promo_fee_waived": fee_waived_amount,
        },
    )

    # 9. Send initiation email (fire-and-forget)
    try:
        dashboard_link = f"{settings.FRONTEND_URL.rstrip('/')}/dashboard/my-campaigns/{campaign.id}/withdrawals"
        send_email(
            current_user.email,
            f"Withdrawal of {gross_amount:,.2f} GMD initiated — {campaign.title}",
            render_withdrawal_initiated_email(
                full_name=current_user.full_name or current_user.email,
                campaign_title=campaign.title,
                gross_amount=gross_amount,
                hexai_fee=hexai_fee,
                platform_fee=platform_commission,
                net_amount=net_amount,
                wave_number=current_user.wave_number,
                reference=client_reference,
            ),
        )
    except Exception:
        pass

    return {
        "message": "Withdrawal initiated. Funds are on their way to your Wave account.",
        "client_reference": client_reference,
        "gross_amount": gross_amount,
        "hexai_fee": hexai_fee,
        "platform_commission": platform_commission,
        "promo_fee_waived": fee_waived_amount,
        "net_received": net_amount,
        "wave_number": current_user.wave_number,
        "status": "PENDING",
    }


@router.get("/donations/{client_reference}/status")
async def get_donation_status(
    client_reference: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Public endpoint — lets the payment success page check donation state.

    If the donation is still PENDING, this also queries HexAI directly
    and reconciles immediately if HexAI considers it terminal (SUCCEEDED
    or FAILED). This is the fallback for when the webhook is delayed or
    was never delivered.
    """
    from app.services.payment_reconciliation import (
        reconcile_donation_status,
        DonationNotFoundError,
        DonationTransitionConflictError,
    )

    result = await db.execute(select(Donation).where(Donation.client_reference == client_reference))
    donation = result.scalars().first()
    if not donation:
        raise HTTPException(status_code=404, detail="Donation not found")

    # If still PENDING, ask HexAI for the real status and reconcile on the spot
    if donation.status == "PENDING":
        try:
            hexai_data = await hexai_service.get_collection_status(client_reference)
            # HexAI returns status inside data.status or top-level status
            hexai_status = (
                hexai_data.get("data", {}).get("status")
                or hexai_data.get("status")
                or ""
            ).upper()

            if hexai_status in ("SUCCEEDED", "SUCCESS", "COMPLETED"):
                await reconcile_donation_status(
                    db,
                    client_reference=client_reference,
                    target_status="SUCCEEDED",
                    source="WEBHOOK",
                    reason="hexai_poll_confirmed",
                )
                await db.refresh(donation)
            elif hexai_status in ("FAILED", "CANCELLED", "REJECTED", "EXPIRED"):
                await reconcile_donation_status(
                    db,
                    client_reference=client_reference,
                    target_status="FAILED",
                    source="WEBHOOK",
                    reason=f"hexai_poll_{hexai_status.lower()}",
                )
                await db.refresh(donation)

            logger.info(
                "HexAI poll completed",
                extra={
                    "action": "hexai_poll",
                    "client_reference": client_reference,
                    "hexai_status": hexai_status,
                    "donation_status": donation.status,
                },
            )
        except DonationNotFoundError:
            pass  # edge case; leave donation as PENDING
        except DonationTransitionConflictError:
            pass  # already terminal — refresh to pick it up
        except Exception as exc:
            # HexAI unreachable — log and fall through; return current DB state
            logger.warning(
                "HexAI poll failed",
                extra={"action": "hexai_poll_error", "client_reference": client_reference, "error": str(exc)},
            )

    campaign_result = await db.execute(select(Campaign).where(Campaign.id == donation.campaign_id))
    campaign = campaign_result.scalars().first()

    return {
        "client_reference": client_reference,
        "status": donation.status,
        "amount": donation.amount,
        "campaign_id": donation.campaign_id,
        "campaign_slug": campaign.slug if campaign else None,
        "campaign_title": campaign.title if campaign else None,
    }


@router.get("/withdraw/status/{client_reference}")
async def get_payout_status(
    client_reference: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Check withdrawal status. If still PENDING, polls HexAI directly and
    reconciles + sends email if the payout has reached a terminal state.
    """
    result = await db.execute(select(Payout).where(Payout.client_reference == client_reference))
    payout = result.scalars().first()
    if not payout:
        raise HTTPException(status_code=404, detail="Payout not found")

    # Ownership check — only the campaign owner can query their payout
    if payout.campaign_id:
        campaign_result = await db.execute(select(Campaign).where(Campaign.id == payout.campaign_id))
        campaign = campaign_result.scalars().first()
        if campaign and campaign.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorised to view this payout")
    else:
        campaign = None

    if payout.status == "PENDING":
        try:
            hexai_data = await hexai_service.get_payout_status(client_reference)
            hexai_status = (
                (hexai_data or {}).get("data", {}).get("status")
                or (hexai_data or {}).get("status")
                or ""
            )

            # Shared transition: updates payout + ledger, notifies the owner
            new_status = normalize_gateway_status(hexai_status)
            if new_status:
                await apply_payout_status(db, payout, new_status, source="POLL")
                logger.info(
                    "Payout poll reconciled",
                    extra={
                        "action": "payout_poll",
                        "client_reference": client_reference,
                        "hexai_status": hexai_status,
                        "new_status": new_status,
                    },
                )
        except Exception as exc:
            logger.warning(
                "Payout poll failed",
                extra={"action": "payout_poll_error", "client_reference": client_reference, "error": str(exc)},
            )

    return {
        "client_reference": client_reference,
        "status": payout.status,
        "gross_amount": payout.gross_amount,
        "net_amount": payout.net_amount,
        "hexai_fee": payout.hexai_fee,
        "platform_commission": payout.platform_commission,
        "campaign_id": payout.campaign_id,
        "campaign_title": campaign.title if campaign else None,
    }


@router.get("/withdraw/summary/{campaign_id}", response_model=CampaignWithdrawalSummaryResponse)
async def get_withdrawal_summary(
    campaign_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
    campaign = result.scalars().first()

    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    if campaign.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the campaign owner can view withdrawal history")

    available_balance, total_net_withdrawn, payouts = await get_campaign_withdrawal_summary(db, campaign)

    return CampaignWithdrawalSummaryResponse(
        campaign_id=campaign.id,
        campaign_title=campaign.title,
        amount_raised=campaign.amount_raised,
        total_withdrawn=total_net_withdrawn,
        available_balance=available_balance,
        withdrawal_history=[
            WithdrawalHistoryItem(
                id=payout.id,
                client_reference=payout.client_reference,
                gross_amount=payout.gross_amount or 0.0,
                hexai_fee=payout.hexai_fee or 0.0,
                platform_commission=payout.platform_commission or 0.0,
                net_amount=payout.net_amount or payout.amount or 0.0,
                status=payout.status,
                created_at=payout.created_at,
            )
            for payout in payouts
        ],
    )


@router.get("/donations/me")
async def list_my_donations(
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """The logged-in user's giving history (donations made while signed in)."""
    result = await db.execute(
        select(Donation, Campaign)
        .join(Campaign, Donation.campaign_id == Campaign.id)
        .where(Donation.user_id == current_user.id)
        .order_by(Donation.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    rows = result.all()
    return [
        {
            "id": donation.id,
            "client_reference": donation.client_reference,
            "amount": donation.amount,
            "status": donation.status,
            "message": donation.message,
            "created_at": donation.created_at.isoformat() if donation.created_at else None,
            "campaign_id": campaign.id,
            "campaign_title": campaign.title,
            "campaign_slug": campaign.slug,
        }
        for donation, campaign in rows
    ]


# ===== Recurring Donation Endpoints =====

def calculate_next_charge_date(anchor_date: date, frequency: str) -> date:
    """Calculate the next charge date based on anchor date and frequency."""
    today = date.today()
    current_iteration = anchor_date
    
    if frequency == "WEEKLY":
        delta = timedelta(weeks=1)
    elif frequency == "QUARTERLY":
        delta = timedelta(days=91)  # Approximately 3 months
    elif frequency == "ANNUAL":
        delta = timedelta(days=365)
    else:  # MONTHLY (default)
        # Calculate month difference
        if anchor_date.month == 12:
            next_date = anchor_date.replace(year=anchor_date.year + 1, month=1)
        else:
            next_date = anchor_date.replace(month=anchor_date.month + 1)
        # Handle day overflow (e.g., Jan 31 -> Feb 28)
        if next_date.day != anchor_date.day:
            next_date = next_date.replace(day=1) - timedelta(days=1)
        return next_date if next_date > today else calculate_next_charge_date(next_date, frequency)
    
    # For non-monthly frequencies
    while current_iteration <= today:
        current_iteration += delta
    return current_iteration


@router.post("/donations/recurring", response_model=RecurringDonationRead)
async def create_recurring_donation(
    payload: RecurringDonationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new recurring donation for a campaign."""
    
    # 1. Verify campaign exists and is active
    result = await db.execute(select(Campaign).where(Campaign.id == payload.campaign_id))
    campaign = result.scalars().first()
    
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if campaign.status != CampaignStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="This campaign is not accepting donations")
    
    # 2. Set anchor date (default to today)
    anchor_date = payload.anchor_date or date.today()
    
    # 3. Calculate next charge date
    next_charge_date = calculate_next_charge_date(anchor_date, payload.frequency.value)
    
    # 4. Create recurring donation record
    recurring_donation = RecurringDonation(
        user_id=current_user.id,
        campaign_id=payload.campaign_id,
        amount=payload.amount,
        frequency=payload.frequency.value,
        anchor_date=anchor_date,
        next_charge_date=next_charge_date,
        is_active=True,
    )
    db.add(recurring_donation)
    await db.commit()
    await db.refresh(recurring_donation)

    send_email(
        current_user.email,
        f"Recurring donation set up for {campaign.title}",
        render_recurring_donation_confirmation_email(
            current_user.full_name or "there",
            campaign.title,
            recurring_donation.amount,
            recurring_donation.frequency,
            recurring_donation.next_charge_date.isoformat(),
        ),
    )
    
    logger.info(
        "Recurring donation created",
        extra={
            "action": "create_recurring_donation",
            "user_id": current_user.id,
            "campaign_id": payload.campaign_id,
            "amount": payload.amount,
            "frequency": payload.frequency.value,
            "recurring_donation_id": recurring_donation.id,
        },
    )
    
    return recurring_donation


@router.get("/donations/recurring", response_model=RecurringDonationListResponse)
async def list_recurring_donations(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all recurring donations for the current user."""
    
    result = await db.execute(
        select(RecurringDonation).where(RecurringDonation.user_id == current_user.id)
    )
    recurring_donations = result.scalars().all()
    
    return RecurringDonationListResponse(
        total=len(recurring_donations),
        recurring_donations=recurring_donations,
    )


@router.patch("/donations/recurring/{recurring_donation_id}", response_model=RecurringDonationRead)
async def update_recurring_donation(
    recurring_donation_id: int,
    payload: RecurringDonationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update an existing recurring donation (amount, frequency, or pause status)."""
    
    result = await db.execute(
        select(RecurringDonation).where(
            RecurringDonation.id == recurring_donation_id,
            RecurringDonation.user_id == current_user.id,
        )
    )
    recurring_donation = result.scalars().first()
    
    if not recurring_donation:
        raise HTTPException(status_code=404, detail="Recurring donation not found")
    
    # Update fields if provided
    if payload.amount is not None:
        recurring_donation.amount = payload.amount
    
    if payload.frequency is not None:
        recurring_donation.frequency = payload.frequency.value
        # Recalculate next charge date with new frequency
        recurring_donation.next_charge_date = calculate_next_charge_date(
            recurring_donation.anchor_date, payload.frequency.value
        )
    
    if payload.is_active is not None:
        recurring_donation.is_active = payload.is_active
        if not payload.is_active and recurring_donation.paused_at is None:
            recurring_donation.paused_at = datetime.now(UTC)
    
    recurring_donation.updated_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(recurring_donation)
    
    logger.info(
        "Recurring donation updated",
        extra={
            "action": "update_recurring_donation",
            "user_id": current_user.id,
            "recurring_donation_id": recurring_donation_id,
            "updates": {
                "amount": payload.amount,
                "frequency": payload.frequency.value if payload.frequency else None,
                "is_active": payload.is_active,
            },
        },
    )
    
    return recurring_donation


@router.delete("/donations/recurring/{recurring_donation_id}")
async def cancel_recurring_donation(
    recurring_donation_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cancel a recurring donation."""
    
    result = await db.execute(
        select(RecurringDonation).where(
            RecurringDonation.id == recurring_donation_id,
            RecurringDonation.user_id == current_user.id,
        )
    )
    recurring_donation = result.scalars().first()
    
    if not recurring_donation:
        raise HTTPException(status_code=404, detail="Recurring donation not found")
    
    recurring_donation.is_active = False
    recurring_donation.cancelled_at = datetime.now(UTC)
    recurring_donation.cancellation_reason = "User requested cancellation"
    await db.commit()
    
    logger.info(
        "Recurring donation cancelled",
        extra={
            "action": "cancel_recurring_donation",
            "user_id": current_user.id,
            "recurring_donation_id": recurring_donation_id,
        },
    )
    
    return {"message": "Recurring donation cancelled successfully"}