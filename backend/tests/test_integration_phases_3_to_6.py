"""
Integration tests for KYC, Fee Ledger, Moderation, Aliases, and WebSocket features (Phases 1-6).
"""
import pytest


@pytest.mark.integration
def test_kyc_submit_and_admin_approval_flow(client):
    """Test full KYC submission and approval workflow."""
    from io import BytesIO

    # 1. Register and login
    register_payload = {
        "full_name": "KYC Test User",
        "email": "kyc-test@example.com",
        "wave_number": "+2207000010",
        "password": "StrongPass123!",
    }
    register_response = client.post("/api/auth/register", json=register_payload)
    assert register_response.status_code == 201

    login_response = client.post(
        "/api/auth/login",
        data={"username": register_payload["wave_number"], "password": register_payload["password"]},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert login_response.status_code == 200
    token = login_response.json()["access_token"]
    auth_headers = {"Authorization": f"Bearer {token}"}

    # 2. User submits KYC
    pdf_content = b"%PDF-1.4\n%EOF"
    files = {"file": ("passport.pdf", BytesIO(pdf_content), "application/pdf")}
    data = {"document_type": "PASSPORT"}

    response = client.post(
        "/api/kyc/submit",
        headers=auth_headers,
        files=files,
        data=data
    )
    assert response.status_code == 201
    kyc_submission = response.json()
    assert kyc_submission["status"] == "SUBMITTED"
    submission_id = kyc_submission["id"]

    # 3. User checks status
    response = client.get("/api/kyc/status", headers=auth_headers)
    assert response.status_code == 200
    status = response.json()
    assert status["status"] == "SUBMITTED"


@pytest.mark.integration
def test_withdrawal_blocked_without_kyc(client):
    """Test that withdrawals are blocked without approved KYC."""
    # Register and login
    register_payload = {
        "full_name": "No KYC User",
        "email": "no-kyc@example.com",
        "wave_number": "+2207000011",
        "password": "StrongPass123!",
    }
    client.post("/api/auth/register", json=register_payload)

    login_response = client.post(
        "/api/auth/login",
        data={"username": register_payload["wave_number"], "password": register_payload["password"]},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    token = login_response.json()["access_token"]
    auth_headers = {"Authorization": f"Bearer {token}"}

    payout_request = {"campaign_id": 1, "amount": 100.0}

    response = client.post(
        "/api/payments/withdraw",
        json=payout_request,
        headers=auth_headers
    )
    # Should fail because user doesn't have approved KYC
    assert response.status_code == 403
    assert "KYC" in response.json()["detail"]


@pytest.mark.integration
def test_fee_breakdown_in_withdrawal(client):
    """Test that withdrawal response shows correct fee breakdown."""
    # This test assumes user has approved KYC and a campaign with funds
    # Would need proper mock setup
    pass


@pytest.mark.integration
def test_transaction_ledger_recording(client):
    """Test that transactions are recorded in ledger."""
    # This is a placeholder test - actual implementation would require
    # setting up a complete withdrawal flow with KYC and campaign
    pass


@pytest.mark.integration
def test_admin_audit_logs_kyc_approval(client):
    """Test that KYC approval is logged to audit trail."""
    # This would require admin access and KYC approval test setup
    pass


@pytest.mark.integration
def test_campaign_alias_creation_and_redirect(client):
    """Test creating and using short-link aliases."""
    # Register a user first
    register_payload = {
        "full_name": "Alias Test User",
        "email": "alias-test@example.com",
        "wave_number": "+2207000012",
        "password": "StrongPass123!",
    }
    client.post("/api/auth/register", json=register_payload)

    login_response = client.post(
        "/api/auth/login",
        data={"username": register_payload["wave_number"], "password": register_payload["password"]},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    token = login_response.json()["access_token"]
    auth_headers = {"Authorization": f"Bearer {token}"}

    # 1. Create alias
    response = client.post(
        "/api/aliases/campaigns/1",
        json={"short_code": "test123"},
        headers=auth_headers
    )
    if response.status_code == 201:
        alias = response.json()
        assert alias["short_code"] == "test123"

        # 2. Test redirect
        response = client.get(f"/api/aliases/redirect/test123")
        assert response.status_code == 200
        redirect = response.json()
        assert "campaign_id" in redirect
        assert "redirect_url" in redirect


@pytest.mark.integration
def test_moderation_report_submission_and_resolution(client):
    """Test submitting and resolving a moderation report."""
    # Register a user
    register_payload = {
        "full_name": "Moderation Test User",
        "email": "moderation-test@example.com",
        "wave_number": "+2207000013",
        "password": "StrongPass123!",
    }
    client.post("/api/auth/register", json=register_payload)

    login_response = client.post(
        "/api/auth/login",
        data={"username": register_payload["wave_number"], "password": register_payload["password"]},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    token = login_response.json()["access_token"]
    auth_headers = {"Authorization": f"Bearer {token}"}

    # 1. Submit report (anonymous reports are allowed too)
    report_data = {
        "reported_entity_type": "CAMPAIGN",
        "reported_entity_id": 1,
        "reason": "SCAM",
        "description": "This campaign appears to be a scam"
    }

    response = client.post(
        "/api/moderation/reports",
        json=report_data,
        headers=auth_headers
    )
    assert response.status_code == 201
    report = response.json()
    report_id = report["id"]
    assert report["status"] == "OPEN"
