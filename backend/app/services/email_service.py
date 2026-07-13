import logging
from pathlib import Path

import resend
from jinja2 import Environment, FileSystemLoader, TemplateNotFound, select_autoescape

from app.core.config import settings

logger = logging.getLogger(__name__)

# Initialize the Resend client with your API key
resend.api_key = settings.RESEND_API_KEY

TEMPLATE_DIR = Path(__file__).resolve().parent.parent / "templates" / "emails"
jinja_env = Environment(
    loader=FileSystemLoader(str(TEMPLATE_DIR)),
    autoescape=select_autoescape(["html", "xml"]),
)


def render_template(template_name: str, **context: object) -> str:
    base_context = {
        "app_name": "Kambeng",
        "brand_color": "#1dc5ff",
        "brand_dark": "#079bd4",
        "brand_bg": "#0a0f1a",
        "brand_surface": "#0d1120",
        "brand_text": "#f0f6ff",
        "brand_muted": "#8899aa",
        "frontend_url": settings.FRONTEND_URL.rstrip("/"),
    }

    try:
        template = jinja_env.get_template(template_name)
        return template.render(**base_context, **context)
    except TemplateNotFound:
        logger.error("Email template not found", extra={"template": template_name})
        return ""

def send_email(to_email: str, subject: str, html_content: str) -> bool:
    """
    Sends an email using the Resend service.
    In testing/dev without a verified domain, 'to_email' must be the email address your Resend account is registered with.
    """
    if not settings.RESEND_API_KEY or settings.ENVIRONMENT == "test":
        logger.warning(f"MOCK EMAIL to {to_email}: {subject} | {html_content}")
        return True

    params = {
        "from": settings.RESEND_FROM_EMAIL,
        "to": to_email,
        "subject": subject,
        "html": html_content,
    }

    try:
        email = resend.Emails.send(params)
        logger.info(f"Email sent successfully to {to_email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {str(e)}")
        return False


def render_password_reset_email(full_name: str, reset_link: str) -> str:
    return render_template(
        "password_reset.html",
        full_name=full_name,
        reset_link=reset_link,
    )


def render_email_verification_email(full_name: str, verification_code: str, wave_number: str) -> str:
    return render_template(
        "verify_email.html",
        full_name=full_name,
        verification_code=verification_code,
        wave_number=wave_number,
    )


def render_recurring_donation_reminder(
    donor_name: str,
    campaign_title: str,
    amount: float,
    frequency: str,
    payment_link: str,
) -> str:
    return render_template(
        "recurring_donation_reminder.html",
        donor_name=donor_name,
        campaign_title=campaign_title,
        amount=f"{amount:,.2f}",
        frequency=frequency,
        payment_link=payment_link,
    )


def render_recurring_donation_confirmation_email(
    full_name: str,
    campaign_title: str,
    amount: float,
    frequency: str,
    next_charge_date: str,
) -> str:
    return render_template(
        "recurring_donation_confirmation.html",
        full_name=full_name,
        campaign_title=campaign_title,
        amount=f"{amount:,.2f}",
        frequency=frequency,
        next_charge_date=next_charge_date,
    )


def render_recurring_donation_issue_email(
    full_name: str,
    campaign_title: str,
    amount: float,
) -> str:
    return render_template(
        "recurring_donation_issue.html",
        full_name=full_name,
        campaign_title=campaign_title,
        amount=f"{amount:,.2f}",
    )


def render_kyc_submission_review(full_name: str, user_email: str, document_type: str, review_link: str) -> str:
    return render_template(
        "kyc_submission_review.html",
        full_name=full_name,
        user_email=user_email,
        document_type=document_type,
        review_link=review_link,
    )


def render_campaign_update_notification(
    full_name: str,
    campaign_title: str,
    update_title: str | None,
    update_preview: str,
    campaign_link: str,
) -> str:
    return render_template(
        "campaign_update_notification.html",
        full_name=full_name,
        campaign_title=campaign_title,
        update_title=update_title,
        update_preview=update_preview,
        campaign_link=campaign_link,
    )


def render_kyc_pending_reminder(pending_count: int, submissions: list, queue_link: str) -> str:
    return render_template(
        "kyc_pending_reminder.html",
        pending_count=pending_count,
        submissions=submissions,
        queue_link=queue_link,
    )


def render_kyc_approved_email(full_name: str, dashboard_link: str) -> str:
    return render_template(
        "kyc_approved.html",
        full_name=full_name,
        dashboard_link=dashboard_link,
    )


def render_kyc_rejected_email(full_name: str, rejection_reason: str, kyc_link: str) -> str:
    return render_template(
        "kyc_rejected.html",
        full_name=full_name,
        rejection_reason=rejection_reason,
        kyc_link=kyc_link,
    )


def render_withdrawal_initiated_email(
    full_name: str,
    campaign_title: str,
    gross_amount: float,
    hexai_fee: float,
    platform_fee: float,
    net_amount: float,
    wave_number: str,
    reference: str,
) -> str:
    return render_template(
        "withdrawal_initiated.html",
        full_name=full_name,
        campaign_title=campaign_title,
        gross_amount=f"{gross_amount:,.2f}",
        hexai_fee=f"{hexai_fee:,.2f}",
        platform_fee=f"{platform_fee:,.2f}",
        net_amount=f"{net_amount:,.2f}",
        wave_number=wave_number,
        reference=reference,
    )


def render_withdrawal_confirmed_email(
    full_name: str,
    campaign_title: str,
    net_amount: float,
    wave_number: str,
    reference: str,
    dashboard_link: str,
) -> str:
    return render_template(
        "withdrawal_confirmed.html",
        full_name=full_name,
        campaign_title=campaign_title,
        net_amount=f"{net_amount:,.2f}",
        wave_number=wave_number,
        reference=reference,
        dashboard_link=dashboard_link,
    )


def render_moderation_warning_email(
    full_name: str,
    reason: str,
    warning_message: str,
    dashboard_link: str,
) -> str:
    return render_template(
        "moderation_warning.html",
        full_name=full_name,
        reason=reason,
        warning_message=warning_message,
        dashboard_link=dashboard_link,
    )


def render_withdrawal_failed_email(
    full_name: str,
    campaign_title: str,
    gross_amount: float,
    wave_number: str,
    reference: str,
    dashboard_link: str,
) -> str:
    return render_template(
        "withdrawal_failed.html",
        full_name=full_name,
        campaign_title=campaign_title,
        gross_amount=f"{gross_amount:,.2f}",
        wave_number=wave_number,
        reference=reference,
        dashboard_link=dashboard_link,
    )