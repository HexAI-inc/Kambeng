"""
WebSocket endpoints for real-time campaign updates.
Provides live donation notifications, payout updates, and KYC status to authenticated users.
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
import jwt
from jwt.exceptions import InvalidTokenError

from app.core.config import settings
from app.db.database import get_db
from app.models.user import User
from app.services.websocket_manager import manager

router = APIRouter(prefix="/ws", tags=["WebSocket"])


async def get_user_from_token(token: str, db: AsyncSession) -> User | None:
    """Extract user from JWT token."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        wave_number: str = payload.get("sub")
        if wave_number is None:
            return None
        
        result = await db.execute(select(User).where(User.wave_number == wave_number))
        user = result.scalars().first()
        return user
    except InvalidTokenError:
        return None


@router.websocket("/owner")
async def websocket_owner_endpoint(
    websocket: WebSocket,
    token: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """
    WebSocket endpoint for campaign owners to receive real-time updates about their campaigns.
    
    Authentication: Requires JWT token query parameter.
    Messages received: Ping/heartbeat messages only.
    Messages sent:
    - donation_received: When a new donation comes in
    - payout_processed: When a withdrawal is processed
    - kyc_status_updated: When KYC status changes
    """
    # Authenticate user
    user = await get_user_from_token(token, db)
    if not user:
        await websocket.close(code=4001, reason="Unauthorized")
        return
    
    # Connect to owner channel
    await manager.connect_owner(user.id, websocket)
    
    try:
        while True:
            # Wait for heartbeat/ping messages from client
            data = await websocket.receive_text()
            # Just acknowledge heartbeat, no real processing needed
            if data.lower() in ["ping", "heartbeat"]:
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        manager.disconnect_owner(user.id, websocket)


@router.websocket("/admin")
async def websocket_admin_endpoint(
    websocket: WebSocket,
    token: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """
    WebSocket endpoint for admins to receive platform-wide updates.
    
    Authentication: Requires JWT token for admin users.
    Messages received: Ping/heartbeat messages only.
    Messages sent:
    - campaign_donation_admin: All donations platform-wide
    - payout_admin: All payouts platform-wide
    - kyc_update_admin: All KYC updates
    """
    # Authenticate user
    user = await get_user_from_token(token, db)
    if not user or user.role != "ADMIN":
        await websocket.close(code=4001, reason="Unauthorized - Admin required")
        return
    
    # Connect to admin channel
    await manager.connect_admin(websocket)
    
    try:
        while True:
            # Wait for heartbeat/ping messages
            data = await websocket.receive_text()
            if data.lower() in ["ping", "heartbeat"]:
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        manager.disconnect_admin(websocket)


@router.websocket("/campaign/{campaign_id}")
async def websocket_campaign_endpoint(
    websocket: WebSocket,
    campaign_id: int,
    token: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """
    WebSocket endpoint for watching campaign-specific updates (public).
    
    Note: This is public - anyone can watch a campaign for donations.
    Authentication: Optional - unauthenticated users can view.
    Messages sent:
    - donation_received: When a donation comes for this campaign
    """
    # Try to authenticate but don't require it
    user = await get_user_from_token(token, db)
    
    # Connect to campaign channel
    await manager.connect_campaign(campaign_id, websocket)
    
    try:
        while True:
            # Wait for heartbeat/ping messages
            data = await websocket.receive_text()
            if data.lower() in ["ping", "heartbeat"]:
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        manager.disconnect_campaign(campaign_id, websocket)
