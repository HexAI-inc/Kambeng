import httpx
from app.core.config import settings

class HexAIPaymentService:
    def __init__(self):
        self.base_url = settings.HEXAI_BASE_URL.rstrip("/")
        self.headers = {
            "Authorization": f"Bearer {settings.HEXAI_API_KEY}",
            "x-hexai-key": settings.HEXAI_API_KEY, # Required by HexAI
            "Content-Type": "application/json"
        }

    async def initiate_donation(self, amount: float, client_reference: str, customer_name: str):
        payload = {
            "amount": f"{amount:.2f}",
            "currency": "GMD",
            "client_reference": client_reference,
            # Removed success_url and error_url so HexAI uses its defaults!
            "customer_name": customer_name,
            "customer_mobile": "+2203947425" # Dummy Gambian number structure
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/collections/initiate",
                json=payload,
                headers=self.headers
            )
            
            if response.status_code != 200 and response.status_code != 201:
                raise Exception(f"HexAI Error ({response.status_code}): {response.text}")
                
            return response.json()

    async def initiate_payout(self, requested_amount: float, recipient_mobile: str, payout_reference: str, recipient_name: str):
        # Calculate the 2% platform fee
        platform_fee = requested_amount * 0.02
        
        # We ensure it's a clean 2-decimal string to avoid Wave rejecting fraction math
        net_payout_str = f"{(requested_amount - platform_fee):.2f}"
        
        payload = {
            "amount": net_payout_str,
            "currency": "GMD",
            "recipient_mobile": recipient_mobile, # Must be a REAL Wave number!
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
            
            if response.status_code != 200 and response.status_code != 201:
                raise Exception(f"HexAI Error ({response.status_code}): {response.text}")
                
            return response.json(), float(net_payout_str)