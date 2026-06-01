from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from datetime import UTC, datetime, date, timedelta
import uuid, time
from app.models.payout import Payout
from app.models.user import User
from app.models.ledger import TransactionLedger, TransactionType, TransactionStatus
from app.models.audit_log import AdminAuditLog, AuditActionType
from app.api.routes.auth import get_admin_user, get_current_user
from app.schemas.payout import PayoutRequest, CampaignWithdrawalSummaryResponse, WithdrawalHistoryItem
from app.core.config import settings
from sqlalchemy import func

from app.db.database import get_db
from app.models.campaign import Campaign, CampaignStatus
from app.models.campaign_goal import CampaignGoal, GoalStatus
from app.models.donation import Donation
from app.models.recurring_donation import RecurringDonation
from app.schemas.donation import (
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
from app.services.hexai_service import HexAIPaymentService
from app.services.email_service import send_email, render_recurring_donation_confirmation_email
from app.services.payment_reconciliation import (
    DonationNotFoundError,
    DonationTransitionConflictError,
    reconcile_donation_status,
)
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
    available_balance = campaign.amount_raised - total_net_withdrawn
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
async def initiate_donation(donation_in: DonationCreate, db: AsyncSession = Depends(get_db)):
    """Initiates a Wave payment for a specific campaign"""
    
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

    try:
        hexai_response = await hexai_service.initiate_donation(
            amount=donation_in.amount,
            client_reference=client_reference,
            customer_name=donation_in.donor_name or "Anonymous Donor",
            success_url=success_url,
            error_url=error_url,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    # 4. If HexAI succeeds, NOW we save the PENDING donation to the DB
    new_donation = Donation(
        campaign_id=campaign.id,
        goal_id=goal.id if goal else None,
        client_reference=client_reference,
        amount=donation_in.amount,
        donor_name=donation_in.donor_name,
        message=donation_in.message,
        status="PENDING"
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
        "redirect_url": hexai_response["data"]["redirect_url"],
        "campaign_slug": campaign.slug,
    }
    
    
    
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

    # 4. Calculate fee breakdown
    gross_amount = payout_req.amount
    hexai_fee = gross_amount * settings.HEXAI_WITHDRAWAL_FEE_PERCENT
    platform_commission = settings.PLATFORM_FIXED_COMMISSION_GMD
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

    # 7. Save Successful Payout to Database with fee breakdown
    new_payout = Payout(
        campaign_id=campaign.id,
        client_reference=client_reference,
        gross_amount=gross_amount,
        hexai_fee=hexai_fee,
        platform_commission=platform_commission,
        net_amount=net_amount,
        amount=net_amount,  # Legacy field for backward compatibility
        status="SUCCEEDED"
    )
    db.add(new_payout)
    
    # 8. Record transaction in ledger
    ledger_entry = TransactionLedger(
        campaign_id=campaign.id,
        transaction_type=TransactionType.WITHDRAWAL,
        status=TransactionStatus.SUCCEEDED,
        gross_amount=gross_amount,
        hexai_fee=hexai_fee,
        platform_commission=platform_commission,
        net_amount=net_amount,
        external_reference=client_reference,
        description=f"Withdrawal to {formatted_mobile}",
        created_by_user_id=current_user.id,
        confirmed_at=datetime.now(UTC)
    )
    db.add(ledger_entry)
    
    await db.commit()
    logger.info(
        "Withdrawal completed",
        extra={
            "action": "withdraw_funds",
            "user_id": current_user.id,
            "email": current_user.email,
            "campaign_id": campaign.id,
            "gross_amount": gross_amount,
            "net_amount": net_amount,
            "payout_id": new_payout.id,
            "client_reference": client_reference,
        },
    )
    return {
        "message": "Withdrawal successful! Funds sent to your Wave app.",
        "client_reference": client_reference,
        "gross_amount": gross_amount,
        "hexai_fee": hexai_fee,
        "platform_commission": platform_commission,
        "net_received": net_amount,
        "wave_number": current_user.wave_number
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