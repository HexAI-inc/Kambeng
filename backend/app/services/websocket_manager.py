"""
WebSocket connection manager for real-time campaign updates.
Handles client connections, broadcasting events, and channel management.
"""
from typing import Dict, Set, List
from fastapi import WebSocket
import json
from datetime import datetime


class ConnectionManager:
    def __init__(self):
        # owner_channels: {owner_user_id: set of WebSocket connections}
        self.owner_channels: Dict[int, Set[WebSocket]] = {}
        # admin_channel: set of admin WebSocket connections
        self.admin_channel: Set[WebSocket] = set()
        # campaign_channels: {campaign_id: set of WebSocket connections}
        self.campaign_channels: Dict[int, Set[WebSocket]] = {}

    async def connect_owner(self, user_id: int, websocket: WebSocket):
        """Connect an owner to their personal channel for their campaigns."""
        await websocket.accept()
        if user_id not in self.owner_channels:
            self.owner_channels[user_id] = set()
        self.owner_channels[user_id].add(websocket)

    async def connect_admin(self, websocket: WebSocket):
        """Connect an admin to the admin channel for all events."""
        await websocket.accept()
        self.admin_channel.add(websocket)

    async def connect_campaign(self, campaign_id: int, websocket: WebSocket):
        """Connect a user to a campaign channel (for live updates)."""
        await websocket.accept()
        if campaign_id not in self.campaign_channels:
            self.campaign_channels[campaign_id] = set()
        self.campaign_channels[campaign_id].add(websocket)

    def disconnect_owner(self, user_id: int, websocket: WebSocket):
        """Disconnect an owner from their channel."""
        if user_id in self.owner_channels:
            self.owner_channels[user_id].discard(websocket)
            if not self.owner_channels[user_id]:
                del self.owner_channels[user_id]

    def disconnect_admin(self, websocket: WebSocket):
        """Disconnect an admin from admin channel."""
        self.admin_channel.discard(websocket)

    def disconnect_campaign(self, campaign_id: int, websocket: WebSocket):
        """Disconnect a user from a campaign channel."""
        if campaign_id in self.campaign_channels:
            self.campaign_channels[campaign_id].discard(websocket)
            if not self.campaign_channels[campaign_id]:
                del self.campaign_channels[campaign_id]

    async def broadcast_to_owner(self, user_id: int, message: dict):
        """Broadcast a message to all connections of an owner."""
        message["timestamp"] = datetime.utcnow().isoformat()
        if user_id in self.owner_channels:
            for connection in self.owner_channels[user_id]:
                try:
                    await connection.send_json(message)
                except RuntimeError:
                    # Connection closed
                    pass

    async def broadcast_to_admin(self, message: dict):
        """Broadcast a message to all admin connections."""
        message["timestamp"] = datetime.utcnow().isoformat()
        for connection in self.admin_channel:
            try:
                await connection.send_json(message)
            except RuntimeError:
                # Connection closed
                pass

    async def broadcast_to_campaign(self, campaign_id: int, message: dict):
        """Broadcast a message to all connections watching a campaign."""
        message["timestamp"] = datetime.utcnow().isoformat()
        if campaign_id in self.campaign_channels:
            for connection in self.campaign_channels[campaign_id]:
                try:
                    await connection.send_json(message)
                except RuntimeError:
                    # Connection closed
                    pass

    async def broadcast_donation_event(self, campaign_id: int, donation_amount: float, donor_name: str, owner_id: int):
        """Broadcast a donation event to owner and campaign watchers."""
        message = {
            "event": "donation_received",
            "campaign_id": campaign_id,
            "amount": donation_amount,
            "donor_name": donor_name,
            "type": "notification"
        }
        
        # Send to campaign owner
        await self.broadcast_to_owner(owner_id, message)
        
        # Send to campaign watchers
        await self.broadcast_to_campaign(campaign_id, message)
        
        # Notify admins
        admin_message = {
            **message,
            "event": "campaign_donation_admin",
            "type": "admin_notification"
        }
        await self.broadcast_to_admin(admin_message)

    async def broadcast_payout_event(self, campaign_id: int, payout_amount: float, net_amount: float, status: str, owner_id: int):
        """Broadcast a payout event to owner and admins."""
        message = {
            "event": "payout_processed",
            "campaign_id": campaign_id,
            "gross_amount": payout_amount,
            "net_amount": net_amount,
            "status": status,
            "type": "notification"
        }
        
        # Send to campaign owner
        await self.broadcast_to_owner(owner_id, message)
        
        # Notify admins
        admin_message = {
            **message,
            "event": "payout_admin",
            "type": "admin_notification"
        }
        await self.broadcast_to_admin(admin_message)

    async def broadcast_kyc_event(self, user_id: int, kyc_status: str):
        """Broadcast a KYC update to user and admins."""
        message = {
            "event": "kyc_status_updated",
            "user_id": user_id,
            "status": kyc_status,
            "type": "notification"
        }
        
        # Send to user
        await self.broadcast_to_owner(user_id, message)
        
        # Notify admins
        admin_message = {
            **message,
            "event": "kyc_update_admin",
            "type": "admin_notification"
        }
        await self.broadcast_to_admin(admin_message)


# Global connection manager
manager = ConnectionManager()
