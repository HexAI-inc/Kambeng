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

    async def _request(self, method: str, path: str, *, params: dict | None = None, json_body: dict | None = None) -> dict:
        """Shared GET/POST helper for the audit/reporting endpoints — raises
        HexAIGatewayError with HPG's real code/message on any non-2xx."""
        async with httpx.AsyncClient() as client:
            response = await client.request(
                method, f"{self.base_url}{path}", params=params, json=json_body, headers=self.headers,
            )
            if response.status_code not in (200, 201):
                raise HexAIGatewayError(status_code=response.status_code, **_parse_gateway_error(response))
            return response.json() if response.content else {}

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

    async def get_payout_status(self, transaction_id: str) -> dict:
        """Check the current status of a payout using HPG's own transaction
        id (Payout.gateway_transaction_id) — NOT our client_reference.

        GET /payouts/status/{client_reference} (the endpoint this used to
        call) does not exist on the current gateway — confirmed live: it
        404s even for a payout HPG's own /client/transactions list shows as
        genuinely SUCCEEDED. GET /client/transactions/{id} is the correct,
        working replacement (it covers both collections and payouts)."""
        response_body = await self._request("GET", f"/client/transactions/{transaction_id}")
        return response_body

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

    # -----------------------------------------------------------------
    # Audit / reporting endpoints (GET /client/*, GET /collections, etc.)
    # -----------------------------------------------------------------

    async def get_balance(self) -> dict:
        """GET /client/balance — the live HexAI wallet balance, for
        cross-checking against our own ledger's available balance."""
        return await self._request("GET", "/client/balance")

    async def get_stats(self) -> dict:
        """GET /client/stats — volume/commission/pending totals, broken
        down by provider, as HPG sees them."""
        return await self._request("GET", "/client/stats")

    async def get_client_profile(self) -> dict:
        return await self._request("GET", "/client/profile")

    async def list_collections(self, *, status: str | None = None, limit: int = 50, offset: int = 0) -> dict:
        """GET /collections — HPG's own transaction ledger, for reconciling
        against our local `donations` table (catches cases like the webhook
        event-name mismatch that stranded donations in PENDING)."""
        params: dict = {"limit": limit, "offset": offset}
        if status:
            params["status"] = status
        return await self._request("GET", "/collections", params=params)

    async def get_collection_by_transaction_id(self, transaction_id: str) -> dict:
        return await self._request("GET", f"/collections/{transaction_id}")

    async def list_client_transactions(self) -> dict:
        """GET /client/transactions — a unified view across collections and
        payouts (unlike /collections, which is collections-only)."""
        return await self._request("GET", "/client/transactions")

    async def get_client_transaction(self, transaction_id: str) -> dict:
        return await self._request("GET", f"/client/transactions/{transaction_id}")

    async def verify_payout_recipient(
        self, *, mobile: str, name: str | None = None, amount: float | None = None, currency: str = "GMD",
    ) -> dict:
        """POST /payouts/verify-recipient — checks a Wave number is
        registered (and optionally that the name matches / the amount is
        within limits) before actually sending a payout to it."""
        payload: dict = {"mobile": mobile}
        if name:
            payload["name"] = name
        if amount is not None:
            payload["amount"] = f"{amount:.2f}"
            payload["currency"] = currency
        return await self._request("POST", "/payouts/verify-recipient", json_body=payload)

    async def reverse_payout(self, transaction_id: str) -> dict:
        """POST /payouts/{id}/reverse — Wave rail only, 3-day window from
        the payout's creation. Idempotent against an already-reversed payout."""
        return await self._request("POST", f"/payouts/{transaction_id}/reverse")

    async def test_webhook(self) -> dict:
        """POST /client/webhooks/test — delivers a signed ping to our
        configured webhook URL and returns the live delivery result, so an
        admin can confirm the endpoint + signature check are working."""
        return await self._request("POST", "/client/webhooks/test")
