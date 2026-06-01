import logging
from datetime import date
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.future import select
from sqlalchemy.orm import sessionmaker

from app.models.recurring_donation import RecurringDonation
from app.models.campaign import Campaign, CampaignStatus
from app.models.donation import Donation
from app.models.user import User
from app.models.ledger import TransactionLedger, TransactionType, TransactionStatus
from app.services.hexai_service import HexAIPaymentService
from app.services.email_service import (
    send_email,
    render_recurring_donation_reminder,
    render_recurring_donation_issue_email,
)
from app.core.config import settings
from app.db.database import engine as async_engine
import uuid
import time

logger = logging.getLogger(__name__)
hexai_service = HexAIPaymentService()


async def get_async_session():
    """Create a new async session for background tasks."""
    AsyncSessionLocal = sessionmaker(
        async_engine, class_=AsyncSession, expire_on_commit=False
    )
    return AsyncSessionLocal()


def calculate_next_charge_date(anchor_date: date, frequency: str, from_date: date = None) -> date:
    """Calculate the next charge date based on anchor date and frequency."""
    from datetime import timedelta
    
    if from_date is None:
        from_date = date.today()
    
    current_iteration = anchor_date
    
    if frequency == "WEEKLY":
        delta = timedelta(weeks=1)
    elif frequency == "QUARTERLY":
        delta = timedelta(days=91)  # Approximately 3 months
    elif frequency == "ANNUAL":
        delta = timedelta(days=365)
    else:  # MONTHLY (default)
        # Calculate month-by-month
        if anchor_date.month == 12:
            next_date = anchor_date.replace(year=anchor_date.year + 1, month=1)
        else:
            next_date = anchor_date.replace(month=anchor_date.month + 1)
        # Handle day overflow (e.g., Jan 31 -> Feb 28)
        if next_date.day != anchor_date.day:
            next_date = next_date.replace(day=1) - timedelta(days=1)
        return next_date if next_date > from_date else calculate_next_charge_date(next_date, frequency, from_date)
    
    # For non-monthly frequencies
    while current_iteration <= from_date:
        current_iteration += delta
    return current_iteration


async def process_recurring_charges():
    """
    Process all due recurring donations.
    This should be called daily by a scheduled job.
    """
    db = await get_async_session()
    today = date.today()
    
    logger.info("Starting recurring charge processing", extra={"action": "process_recurring_charges"})
    
    try:
        # Find all active recurring donations that are due today
        result = await db.execute(
            select(RecurringDonation).where(
                RecurringDonation.is_active == True,
                RecurringDonation.next_charge_date <= today,
            )
        )
        due_donations = result.scalars().all()
        
        logger.info(
            f"Found {len(due_donations)} recurring donations due for processing",
            extra={"action": "process_recurring_charges", "count": len(due_donations)}
        )
        
        for recurring_donation in due_donations:
            try:
                await process_single_recurring_charge(db, recurring_donation)
            except Exception as e:
                logger.error(
                    f"Error processing recurring donation {recurring_donation.id}: {str(e)}",
                    extra={
                        "action": "process_recurring_charge_error",
                        "recurring_donation_id": recurring_donation.id,
                        "error": str(e),
                    },
                )
    
    finally:
        await db.close()


async def process_single_recurring_charge(
    db: AsyncSession,
    recurring_donation: RecurringDonation,
):
    """Process a single recurring donation charge."""
    
    # 1. Fetch user, campaign, and verify everything is still valid
    user_result = await db.execute(
        select(User).where(User.id == recurring_donation.user_id)
    )
    user = user_result.scalars().first()
    
    if not user:
        logger.warning(
            f"User {recurring_donation.user_id} not found for recurring donation",
            extra={
                "action": "recurring_charge_user_not_found",
                "recurring_donation_id": recurring_donation.id,
            },
        )
        return
    
    campaign_result = await db.execute(
        select(Campaign).where(Campaign.id == recurring_donation.campaign_id)
    )
    campaign = campaign_result.scalars().first()
    
    if not campaign or campaign.status != CampaignStatus.ACTIVE:
        logger.warning(
            f"Campaign {recurring_donation.campaign_id} not found or inactive",
            extra={
                "action": "recurring_charge_campaign_inactive",
                "recurring_donation_id": recurring_donation.id,
            },
        )
        # Pause recurring donation if campaign is no longer active
        recurring_donation.is_active = False
        await db.commit()
        return
    
    # 2. Generate payment reference
    client_reference = f"REC-{uuid.uuid4().hex[:10].upper()}"
    
    # 3. Initiate payment with HexAI
    frontend_base = settings.FRONTEND_URL.rstrip("/")
    success_url = f"{frontend_base}/payment/success?ref={client_reference}&slug={campaign.slug}"
    error_url = f"{frontend_base}/payment/failed?ref={client_reference}&slug={campaign.slug}"

    try:
        hexai_response = await hexai_service.initiate_donation(
            amount=recurring_donation.amount,
            client_reference=client_reference,
            customer_name=user.full_name or "Recurring Donor",
            success_url=success_url,
            error_url=error_url,
        )
    except Exception as e:
        logger.error(
            f"HexAI payment initiation failed for recurring donation {recurring_donation.id}: {str(e)}",
            extra={
                "action": "recurring_charge_hexai_error",
                "recurring_donation_id": recurring_donation.id,
                "error": str(e),
            },
        )
        # Send error email to user
        send_email(
            user.email,
            "Payment Issue with Your Recurring Donation",
            render_recurring_donation_issue_email(
                user.full_name or "Supporter",
                campaign.title,
                recurring_donation.amount,
            ),
        )
        return
    
    # 4. Create donation record (PENDING status)
    new_donation = Donation(
        campaign_id=campaign.id,
        client_reference=client_reference,
        amount=recurring_donation.amount,
        donor_name=user.full_name or "Recurring Donor",
        message=f"Recurring donation ({recurring_donation.frequency.lower()})",
        status="PENDING",
    )
    db.add(new_donation)
    
    # 5. Record in transaction ledger
    ledger_entry = TransactionLedger(
        campaign_id=campaign.id,
        transaction_type=TransactionType.DONATION,
        status=TransactionStatus.PENDING,
        gross_amount=recurring_donation.amount,
        hexai_fee=0.0,
        platform_commission=0.0,
        net_amount=recurring_donation.amount,
        external_reference=client_reference,
        description=f"Recurring donation ({recurring_donation.frequency.lower()})",
        created_by_user_id=None,
        confirmed_at=None,
    )
    db.add(ledger_entry)
    
    # 6. Send reminder email with payment link
    payment_link = hexai_response["data"]["redirect_url"]
    html_content = render_recurring_donation_reminder(
        donor_name=user.full_name or "Supporter",
        campaign_title=campaign.title,
        amount=recurring_donation.amount,
        frequency=recurring_donation.frequency,
        payment_link=payment_link,
    )
    
    email_sent = send_email(
        user.email,
        f"Your {recurring_donation.frequency.title()} Donation to {campaign.title} is Due",
        html_content,
    )
    
    if not email_sent:
        logger.warning(
            f"Failed to send reminder email for recurring donation {recurring_donation.id}",
            extra={
                "action": "recurring_charge_email_failed",
                "recurring_donation_id": recurring_donation.id,
                "user_email": user.email,
            },
        )
    
    # 7. Update recurring donation with charge details
    recurring_donation.last_charge_date = date.today()
    recurring_donation.next_charge_date = calculate_next_charge_date(
        recurring_donation.anchor_date,
        recurring_donation.frequency,
        date.today(),
    )
    
    await db.commit()
    
    logger.info(
        "Recurring charge processed successfully",
        extra={
            "action": "recurring_charge_processed",
            "recurring_donation_id": recurring_donation.id,
            "user_id": user.id,
            "campaign_id": campaign.id,
            "amount": recurring_donation.amount,
            "client_reference": client_reference,
            "next_charge_date": str(recurring_donation.next_charge_date),
        },
    )
