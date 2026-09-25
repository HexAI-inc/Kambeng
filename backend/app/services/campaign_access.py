"""Who may manage a campaign.

The campaign's creator, platform admins, and — for organization campaigns —
the organization's owner and accepted team members. Relies on
Campaign.organization and Organization.members being selectin-loaded, so it
works on any Campaign fetched with a plain select().
"""
from app.models.campaign import Campaign
from app.models.user import User


def can_manage_campaign(campaign: Campaign, user: User | None, *, allow_admin: bool = True) -> bool:
    if user is None:
        return False
    if campaign.user_id == user.id:
        return True
    if allow_admin and user.role == "ADMIN":
        return True
    organization = campaign.organization if campaign.organization_id else None
    return organization is not None and user.id in organization.active_manager_ids()
