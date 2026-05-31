# Getting Started

This quickstart helps you run the Kambeng backend and frontend locally for development.

## Prerequisites

- Git
- Python 3.12+
- Node.js 18+
- PostgreSQL 14+

## Clone

```bash
git clone https://github.com/your-org/kambeng.git
cd kambeng-monorepo
```

## Backend (quick)

1. Enter backend folder and create virtualenv:

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

2. Copy and edit env file:

```bash
cp .env.example .env
# Edit .env to set DATABASE_URL and SECRET_KEY etc.
```

3. Create DB, run migrations and seed demo data:

```bash
python create_db.py
alembic upgrade head
python seed_db.py
```

4. Start the API server:

```bash
uvicorn app.main:app --reload --port 8001
```

API docs: http://localhost:8001/docs

## Frontend (quick)

1. From repo root:

```bash
cd frontend-next
npm install
cp .env.local.example .env.local
# set NEXT_PUBLIC_API_BASE_URL to http://localhost:8001/api
npm run dev
```

App: http://localhost:3000

## Smoke checks

Backend health:

```bash
curl http://localhost:8001/
```

Register / login sample (replace values):

```bash
curl -X POST "http://localhost:8001/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"full_name":"Test","email":"test@example.com","wave_number":"+2207000002","password":"Pass123!"}'
```

Run frontend tests (Playwright):

```bash
cd frontend-next
npx playwright test
```

## Notes & next steps

- For full backend runbook see `backend/README.md`.
- For frontend details see `frontend-next/README.md`.
- Do not commit secrets; use `.env` and deployment secret management.

If you want, I can now: add a `docs/` index, consolidate the backend runbook into `docs/backend-runbook.md`, or update the root `README.md` to link to `docs/`.