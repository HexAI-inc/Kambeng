import logging
import resend
import os
from string import Template
from app.core.config import settings

logger = logging.getLogger(__name__)

# Initialize the Resend client with your API key
resend.api_key = settings.RESEND_API_KEY

def send_email(to_email: str, subject: str, html_content: str) -> bool:
    """
    Sends an email using the Resend service.
    In testing/dev without a verified domain, 'to_email' must be the email address your Resend account is registered with.
    """
    if not settings.RESEND_API_KEY:
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


def render_recurring_donation_reminder(
    donor_name: str,
    campaign_title: str,
    amount: float,
    frequency: str,
    payment_link: str,
) -> str:
    """
    Renders the recurring donation reminder email template with provided variables.
    """
    template_path = os.path.join(
        os.path.dirname(__file__), 
        "..", 
        "templates", 
        "emails", 
        "recurring_donation_reminder.html"
    )
    
    try:
        with open(template_path, "r") as f:
            template_content = f.read()
    except FileNotFoundError:
        logger.error(f"Template not found at {template_path}")
        # Fallback to a simple HTML if template not found
        return f"""
        <h2>Your {frequency} Donation is Due</h2>
        <p>Hi {donor_name},</p>
        <p>Your recurring donation to <strong>{campaign_title}</strong> is due: <strong>{amount} GMD</strong></p>
        <p><a href="{payment_link}">Click here to pay</a></p>
        """
    
    # Use simple string replacement for template variables
    html = template_content.replace("{{ donor_name }}", donor_name)
    html = html.replace("{{ campaign_title }}", campaign_title)
    html = html.replace("{{ amount }}", f"{amount:.2f}")
    html = html.replace("{{ frequency }}", frequency)
    html = html.replace("{{ payment_link }}", payment_link)
    
    return html