import httpx
from app.core.config import settings

class HexAIPaymentService:
    def __init__(self):
        self.base_url = settings.HEXAI_BASE_URL.rstrip("/")
        self.headers = {
            "Authorization": f"Bearer {settings.HEXAI_API_KEY}",
            "x-hexai-key": settings.HEXAI_API_KEY,
            "Content-Type": "application/json"
        }

    async def initiate_donation(
        self,
        amount: float,
        client_reference: str,
        customer_name: str,
        success_url: str,
        error_url: str,
    ):
        payload = {
            "amount": f"{amount:.2f}",
            "currency": "GMD",
            "client_reference": client_reference,
            "customer_name": customer_name,
            "success_url": success_url,
            "error_url": error_url,
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/collections/initiate",
                json=payload,
                headers=self.headers
            )

            if response.status_code not in (200, 201):
                raise Exception(f"HexAI Error ({response.status_code}): {response.text}")

            return response.json()

    async def get_collection_status(self, client_reference: str) -> dict:
        """Check the current status of a collection using the client reference."""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/collections/status/{client_reference}",
                headers=self.headers,
            )

            if response.status_code == 404:
                raise Exception(f"Transaction {client_reference!r} not found at HexAI")

            if response.status_code not in (200, 201):
                raise Exception(f"HexAI Error ({response.status_code}): {response.text}")

            return response.json()

    async def get_payout_status(self, client_reference: str) -> dict:
        """Check the current status of a payout using the client reference."""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/payouts/status/{client_reference}",
                headers=self.headers,
            )

            if response.status_code == 404:
                raise Exception(f"Payout {client_reference!r} not found at HexAI")

            if response.status_code not in (200, 201):
                raise Exception(f"HexAI Error ({response.status_code}): {response.text}")

            return response.json()

    async def initiate_payout(
        self,
        requested_amount: float,
        recipient_mobile: str,
        payout_reference: str,
        recipient_name: str,
    ):
        # requested_amount is already net of all fees (calculated in payments.py).
        # Send it directly — do NOT deduct another fee here.
        amount_str = f"{requested_amount:.2f}"

        payload = {
            "amount": amount_str,
            "currency": "GMD",
            "recipient_mobile": recipient_mobile,
            "recipient_name": recipient_name,
            "client_reference": payout_reference,
            "reason": "Kambeng Campaign Withdrawal"
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/payouts/send",
                json=payload,
                headers=self.headers
            )

            if response.status_code not in (200, 201):
                raise Exception(f"HexAI Error ({response.status_code}): {response.text}")

            return response.json(), float(amount_str)
