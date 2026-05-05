# Kambeng Backend Runbook

## 1) Prerequisites

- Python 3.11+
- PostgreSQL 14+
- Virtual environment support

## 2) Environment Variables

Create `backend/.env`:

```env
PROJECT_NAME=Kambeng - GambiaGive API
ENVIRONMENT=dev
FRONTEND_URL=http://localhost:4200
MEDIA_ROOT=uploads
MEDIA_URL_PREFIX=/uploads
BACKEND_PUBLIC_URL=http://127.0.0.1:8001
MAX_CAMPAIGN_IMAGES=5
MAX_CAMPAIGN_IMAGE_SIZE_MB=5
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/kambeng
SECRET_KEY=replace-with-a-long-random-secret
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

API_OPENAPI_URL=/openapi.json
API_DOCS_URL=/docs
API_REDOC_URL=/redoc
SWAGGER_PERSIST_AUTHORIZATION=true

RESEND_API_KEY=
RESEND_FROM_EMAIL=Kambeng <onboarding@resend.dev>
FIELD_ENCRYPTION_KEY=

HEXAI_BASE_URL=https://hpg.hexai.gm/api/v1
HEXAI_API_KEY=
HEXAI_WEBHOOK_SECRET=replace-with-webhook-shared-secret

DO_SPACES_KEY=
DO_SPACES_SECRET=
DO_SPACES_REGION=fra1
DO_SPACES_BUCKET=kambeng-media
DO_SPACES_ENDPOINT=https://fra1.digitaloceanspaces.com
```

### Environment Profiles and Required Secrets

- `dev`: requires `SECRET_KEY`
- `test`: requires `SECRET_KEY`, `HEXAI_WEBHOOK_SECRET`
- `prod`: requires `SECRET_KEY`, `HEXAI_WEBHOOK_SECRET`, `HEXAI_API_KEY`, `RESEND_API_KEY`, `DO_SPACES_KEY`, `DO_SPACES_SECRET`

The API validates these on startup and exits with a clear error when required values are missing.

Generate a field encryption key with:

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

## 3) Install Dependencies

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## 4) Database Setup

If your `kambeng` database does not exist yet:

```bash
python create_db.py
```

Apply all migrations:

```bash
alembic upgrade head
```

## 5) Start API

```bash
uvicorn app.main:app --reload --port 8001
```

## 5.1) Start Recurring Donation Worker

Run the scheduler in a separate background worker process so recurring charges do not depend on the API server process:

```bash
python -m app.workers.recurring_donations_worker
```

If you are using Docker, bring up the API, worker, and database together from the backend directory:

```bash
docker compose up --build
```

Open Swagger UI:

- [http://localhost:8001/docs](http://localhost:8001/docs)

Optional docs URLs are configurable via `.env`:

- `API_DOCS_URL`
- `API_REDOC_URL`
- `API_OPENAPI_URL`
- `SWAGGER_PERSIST_AUTHORIZATION`

When `SWAGGER_PERSIST_AUTHORIZATION=true`, your bearer token entered in Swagger remains available across refreshes.

## 5.1 Seed Demo Data

Run the seed script after migrations:

```bash
cd backend
source venv/bin/activate
python seed_db.py
```

This script is idempotent and will create demo users/campaigns only if they do not already exist.

Demo credentials:

- Admin: `+2207000000` / `AdminPass123!`
- User: `+2207000001` / `StrongPass123!`

## 6) Smoke Tests (curl)

Health check:

```bash
curl http://localhost:8001/
```

Register user:

```bash
curl -X POST "http://localhost:8001/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "full_name": "Test User",
    "email": "test@example.com",
    "wave_number": "+2201234567",
    "password": "StrongPass123!"
  }'
```

Login (you can pass Wave number or email in `username`):

```bash
curl -X POST "http://localhost:8001/api/auth/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=%2B2201234567&password=StrongPass123!"
```

Login response now includes a structured envelope and refresh token while remaining Swagger OAuth2-compatible (`access_token`, `token_type` are still present at top level).

Refresh token exchange:

```bash
curl -X POST "http://localhost:8001/api/auth/refresh" \
  -H "Content-Type: application/json" \
  -d '{"refresh_token":"<REFRESH_TOKEN>"}'
```

Create campaign (replace `<TOKEN>`):

```bash
curl -X POST "http://localhost:8001/api/campaigns/" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Water for Brikama",
    "description": "Community borehole fundraising.",
    "mode": "TARGET",
    "target_amount": 10000
  }'
```

Initiate donation:

```bash
curl -X POST "http://localhost:8001/api/payments/donate" \
  -H "Content-Type: application/json" \
  -d '{
    "campaign_id": 1,
    "amount": 100,
    "donor_name": "Anonymous",
    "message": "Keep going"
  }'
```

Upload campaign images to local filesystem (replace `<TOKEN>` and slug):

```bash
curl -X POST "http://localhost:8001/api/uploads/campaigns/<slug>/images" \
  -H "Authorization: Bearer <TOKEN>" \
  -F "files=@/absolute/path/image1.jpg" \
  -F "files=@/absolute/path/image2.png"
```

List campaign images:

```bash
curl "http://localhost:8001/api/uploads/campaigns/<slug>/images"
```

Delete campaign image (replace `<TOKEN>`, slug, and file name):

```bash
curl -X DELETE "http://localhost:8001/api/uploads/campaigns/<slug>/images/<file_name>" \
  -H "Authorization: Bearer <TOKEN>"
```

Uploaded files are stored under `backend/uploads/campaigns/<campaign_id>/` and served from `/uploads/...`.

Legacy media migration helper:

```bash
cd backend
source venv/bin/activate
python scripts/migrate_media_to_uploads.py          # dry-run
python scripts/migrate_media_to_uploads.py --apply  # apply file + DB URL updates
```

Campaign image guardrails:

- Max file size per image: 5MB
- Max images per campaign at a time: 5

Webhook call (signature required):

```bash
curl -X POST "http://localhost:8001/api/webhooks/hexai" \
  -H "Content-Type: application/json" \
  -H "wave-signature: <HEX_DIGEST_SIGNATURE>" \
  -d '{
    "event": "transaction.completed",
    "transaction": {
      "client_reference": "DON-EXAMPLE123",
      "status": "SUCCEEDED"
    }
  }'
```

## 7) Tests

Run backend tests:

```bash
cd backend
source venv/bin/activate
pytest -q
```

Run integration tests only:

```bash
cd backend
source venv/bin/activate
ENVIRONMENT=test SECRET_KEY=test-secret-key HEXAI_WEBHOOK_SECRET=test-webhook-secret pytest -m integration -q
```

## 8) Troubleshooting

- `SECRET_KEY is not configured`: set `SECRET_KEY` in `backend/.env`.
- `Invalid webhook signature`: ensure `HEXAI_WEBHOOK_SECRET` and signature algorithm match HMAC-SHA256.
- `Could not import ...`: activate backend virtual environment and reinstall requirements.
- Port conflict on startup: change to another port, e.g. `--port 8002`.
