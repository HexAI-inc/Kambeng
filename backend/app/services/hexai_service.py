import httpx
from app.core.config import settings


class HexAIGatewayError(Exception):
    """Carries HPG's structured error (status/code/message) instead of a
    flattened string, so callers — e.g. the APS OTP confirm step — can show
    the donor an accurate, retryable message rather than a generic failure."""

    def __init__(self, status_code: int, code: str, message: str):
        self.status_code = status_code
        self.code = code
        self.message = message
        super().__init__(f"HexAI Error {status_code} ({code}): {message}")


def _parse_gateway_error(response: httpx.Response) -> dict:
    """HPG error bodies have been observed in two shapes: {status, error:
    {code, message}} (per the published docs) and {status, code, message}
    (what aps_api_error/waychit_api_error actually return) — handle both."""
    body = response.json() if response.content else {}
    if not isinstance(body, dict):
        return {"code": "unknown_error", "message": response.text}

    error = body.get("error")
    if isinstance(error, dict) and error.get("message"):
        return {"code": error.get("code", "unknown_error"), "message": error["message"]}

    if body.get("message"):
        return {"code": body.get("code", "unknown_error"), "message": body["message"]}

    return {"code": "unknown_error", "message": response.text}


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
        provider: str | None = None,
        customer_mobile: str | None = None,
        customer_email: str | None = None,
    ):
        # provider omitted entirely (not sent as None/empty) so the gateway's
        # own default (WAVE) applies exactly as before for existing callers.
        payload = {
            "amount": f"{amount:.2f}",
            "currency": "GMD",
            "client_reference": client_reference,
            "customer_name": customer_name,
        }
        # APS is collections-only, no redirect: the docs are explicit that
        # success_url/error_url don't apply to it — the whole flow happens
        # through the app + OTP, not a hosted-page bounce.
        if provider != "APS":
            payload["success_url"] = success_url
            payload["error_url"] = error_url
        if provider:
            payload["provider"] = provider
        if customer_mobile:
            payload["customer_mobile"] = customer_mobile
        if customer_email:
            payload["customer_email"] = customer_email

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/collections/initiate",
                json=payload,
                headers=self.headers
            )

            if response.status_code not in (200, 201):
                raise HexAIGatewayError(status_code=response.status_code, **_parse_gateway_error(response))

            return response.json()

    async def confirm_collection(self, transaction_id: str, otp: str, request_token: str) -> dict:
        """Step 3 of the APS wallet+OTP flow: charge the wallet. Synchronous —
        the response is the authoritative outcome (SUCCEEDED/FAILED), no
        polling needed. Raises HexAIGatewayError (preserving HPG's code/
        message, e.g. a wrong OTP) rather than a generic exception, so the
        donor can be shown an accurate, retryable message."""
        payload = {"otp": otp, "request_token": request_token}

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/collections/{transaction_id}/confirm",
                json=payload,
                headers=self.headers,
            )

            if response.status_code not in (200, 201):
                raise HexAIGatewayError(status_code=response.status_code, **_parse_gateway_error(response))

            return response.json() if response.content else {}

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
