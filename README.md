# Kambeng - Community-Powered Crowdfunding Platform

**Kambeng** is a next-generation crowdfunding platform designed to empower Gambian communities to raise funds for meaningful causes. Built with modern web technologies and best practices, Kambeng facilitates transparent fundraising, goal-based campaigns, and secure donation management.

## 🌍 Overview

Kambeng enables community leaders, organizations, and individuals to:
- **Create transparent campaigns** with detailed descriptions, milestones, and real-time progress tracking
- **Set achievable goals** with funding targets and deadlines
- **Accept donations** securely via HexAI payment gateway
- **Track expenditures** with proof submissions and KYC verification
- **Manage recurring donations** through an automated scheduler
- **Store media locally or in the cloud** with flexible storage strategies

---

## 🏗️ Architecture

### Monorepo Structure

```
kambeng-monorepo/
├── backend/                    # FastAPI backend service
│   ├── app/
│   │   ├── api/               # REST API routes (campaigns, goals, payments, etc.)
│   │   ├── models/            # SQLAlchemy ORM models
│   │   ├── schemas/           # Pydantic request/response schemas
│   │   ├── services/          # Business logic (storage, payment reconciliation, etc.)
│   │   ├── core/              # Configuration and logging setup
│   │   └── db/                # Database connection and session management
│   ├── alembic/               # Database migrations
│   ├── scripts/               # Utility scripts (archive uploads, seed data, etc.)
│   ├── tests/                 # Integration and unit tests
│   ├── requirements.txt       # Python dependencies
│   ├── Dockerfile             # Docker configuration for backend
│   └── docker-compose.yml     # Compose setup for backend + PostgreSQL
│
├── frontend-next/             # Next.js frontend application
│   ├── src/
│   │   ├── app/              # Next.js app directory (page routes)
│   │   ├── components/       # Reusable React components
│   │   ├── hooks/            # Custom React hooks (API calls, state management)
│   │   ├── lib/              # Utilities and helpers
│   │   ├── store/            # Zustand state management
│   │   └── types/            # TypeScript type definitions
│   ├── public/               # Static assets
│   ├── tests/                # E2E tests (Playwright) and unit tests
│   ├── package.json          # Node dependencies and scripts
│   └── next.config.ts        # Next.js configuration
│
└── memory-bank/              # Project documentation and decision logs
    ├── productContext.md     # Product overview and goals
    ├── systemPatterns.md     # Architectural patterns and conventions
    ├── decisionLog.md        # Technical decisions and rationale
    └── progress.md           # Implementation progress tracker

```

---

## 🚀 Tech Stack

### Backend
- **Framework**: FastAPI (Python 3.12)
- **Database**: PostgreSQL 14+ with async support (asyncpg)
- **ORM**: SQLAlchemy 2.x with async sessions
- **Migration Tool**: Alembic
- **Authentication**: OAuth2 with JWT tokens
- **Payment Gateway**: HexAI (Gambian fintech)
- **File Storage**: 
  - **Local**: Disk-based storage (`backend/uploads/`)
  - **Cloud**: DigitalOcean Spaces (S3-compatible via boto3)
- **Scheduling**: APScheduler (recurring donations)
- **Logging**: Python logging with custom formatters

### Frontend
- **Framework**: Next.js 16.2.2 with React 19
- **Language**: TypeScript
- **State Management**: Zustand, @tanstack/react-query 5
- **UI Component Library**: Ant Design 6.3.5
- **Form Handling**: react-hook-form
- **HTTP Client**: Native fetch via api client wrapper
- **Testing**: Playwright E2E, unit tests
- **Build**: Turbopack for fast development

---

## 🎯 Key Features

### 1. **Campaign Management**
- Create campaigns with customizable descriptions, categories, and images
- Track funding progress in real-time
- Multiple campaign modes: INDIVIDUAL, ORGANIZATION, BUSINESS
- Campaign statuses: DRAFT, ACTIVE, PAUSED, COMPLETED, FAILED

### 2. **Campaign Goals** (Milestones)
- Break down large campaign targets into achievable milestones
- Set target amounts and deadlines for each goal
- Track individual goal progress independent of campaign total
- Goal statuses: DRAFT, ACTIVE, PAUSED, COMPLETED
- Automatic completion when funding target is reached

### 3. **Secure Donations**
- Seamless integration with HexAI payment gateway
- Optional goal targeting (donate toward a specific milestone)
- Recurring donation support with APScheduler
- Proof of expenditure tracking
- Donation statuses: PENDING, COMPLETED, FAILED, RECONCILED

### 4. **KYC Verification**
- User identity verification with document submission
- Support for PNG, JPEG, PDF documents (max 10MB)
- KYC statuses: DRAFT, SUBMITTED, REVIEWING, APPROVED, REJECTED
- One active submission per user at a time

### 5. **Flexible Storage Strategy**
- **Local Storage**: Files stored on server disk (`backend/uploads/campaigns/`, `backend/uploads/kyc/`)
- **DigitalOcean Spaces**: S3-compatible cloud storage for scalability
- Runtime selection via `STORAGE_STRATEGY` environment variable
- Easy to extend with additional strategies (AWS S3, GCS, etc.)

### 6. **Transparency & Reconciliation**
- Payment reconciliation service syncs HexAI events with local records
- Transaction ledger for full audit trail
- Proof submission for fund expenditure
- Admin moderation reports

---

## 🛠️ Installation & Setup

### Prerequisites
- **Python 3.12+**
- **Node.js 18+** (for frontend)
- **PostgreSQL 14+**
- **Git**

### Backend Setup

1. **Clone repository and navigate to backend:**
   ```bash
   git clone https://github.com/HexAI-inc/Kambeng.git
   cd kambeng-monorepo/backend
   ```

2. **Create virtual environment:**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your values:
   ```env
   DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5432/kambeng
   SECRET_KEY=your-super-secret-key-change-in-production
   HEXAI_API_KEY=your-hexai-key
   HEXAI_WEBHOOK_SECRET=your-webhook-secret
   STORAGE_STRATEGY=local  # or "do_spaces"
   DO_SPACES_KEY=your-key
   DO_SPACES_SECRET=your-secret
   ```

5. **Create database:**
   ```bash
   python create_db.py
   ```

6. **Apply migrations:**
   ```bash
   alembic upgrade head
   ```

7. **Seed sample data (optional):**
   ```bash
   python seed_db.py
   ```

8. **Start API server:**
   ```bash
   uvicorn app.main:app --reload --port 8001
   ```

   API docs available at: `http://localhost:8001/docs`

9. **Start recurring donations worker (separate terminal):**
   ```bash
   python -m app.workers.recurring_donations_worker
   ```

### Frontend Setup

1. **Navigate to frontend directory:**
   ```bash
   cd ../frontend-next
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   ```bash
   cp .env.local.example .env.local
   ```
   
   Update `NEXT_PUBLIC_API_BASE_URL`:
   ```env
   NEXT_PUBLIC_API_BASE_URL=http://localhost:8001/api
   ```

4. **Start development server:**
   ```bash
   npm run dev
   ```

   App available at: `http://localhost:3000`

---

## 📋 Project Structure Details

### Backend Key Modules

**Models** (`app/models/`):
- `user.py` - User accounts, authentication, KYC status
- `campaign.py` - Campaign metadata, status, funding tracking
- `campaign_goal.py` - Milestone goals within campaigns
- `donation.py` - Donation records with goal linkage
- `kyc.py` - KYC submission documents and verification
- `ledger.py` - Transaction audit trail
- `payout.py` - Payout records for campaign organizers

**Services** (`app/services/`):
- `storage_strategy.py` - Abstract storage interface and factory
- `local_storage_strategy.py` - Local disk implementation
- `do_spaces_strategy.py` - DigitalOcean Spaces implementation
- `payment_reconciliation.py` - HexAI payment sync and verification
- `qrcode_service.py` - QR code generation for donations

**Routes** (`app/api/routes/`):
- `campaigns.py` - Campaign CRUD and listing
- `goals.py` - Goal management (public list, owner management)
- `donations.py` - Donation creation and history
- `payments.py` - Payment initiation with HexAI
- `uploads.py` - Campaign images and proof submissions
- `kyc.py` - KYC document submission
- `webhooks.py` - HexAI payment callback handler
- `utils.py` - Utilities (home feed, campaign resolution)

### Frontend Key Modules

**Pages** (`src/app/`):
- `(public)/` - Public-facing pages (campaigns, donations, QR pay)
- `(dashboard)/` - Owner dashboard (campaign management, goals, analytics)
- `(admin)/` - Admin panel (moderation, KYC review, reports)

**Components** (`src/components/`):
- `CampaignCard` - Campaign preview with funding progress
- `GoalCard` - Goal/milestone display with funding status
- `DonationForm` - Donation payment form with goal selection
- Navigation, layouts, modals, etc.

**Hooks** (`src/hooks/`):
- `use-frontend-data.ts` - React Query hooks for API calls (campaigns, goals, donations, etc.)
- `use-auth.ts` - Authentication state and login/logout
- `use-app-feedback.ts` - Toast notifications and error handling

---

## 🔑 Environment Variables Reference

### Backend (`.env`)

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `DATABASE_URL` | ✅ | - | PostgreSQL connection string |
| `SECRET_KEY` | ✅ | - | JWT signing key |
| `HEXAI_API_KEY` | ✅ (prod) | - | HexAI payment gateway API key |
| `HEXAI_WEBHOOK_SECRET` | ✅ (prod) | - | HexAI webhook shared secret |
| `STORAGE_STRATEGY` | ❌ | `local` | Storage backend: `local` or `do_spaces` |
| `DO_SPACES_KEY` | ✅ (if `do_spaces`) | - | DigitalOcean API key |
| `DO_SPACES_SECRET` | ✅ (if `do_spaces`) | - | DigitalOcean API secret |
| `DO_SPACES_BUCKET` | ❌ | `kambeng-media` | S3 bucket name |
| `RESEND_API_KEY` | ❌ | - | Email service (Resend) |
| `BACKEND_PUBLIC_URL` | ❌ | `http://127.0.0.1:8001` | Public backend URL (for media URLs) |
| `FRONTEND_URL` | ❌ | `http://localhost:3000` | Frontend URL for CORS |

### Frontend (`.env.local`)

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_API_BASE_URL` | Backend API base URL (e.g., `http://localhost:8001/api`) |

---

## 🧪 Testing

### Backend Unit & Integration Tests

```bash
cd backend
pytest tests/
# With coverage:
pytest --cov=app tests/
```

Key test files:
- `tests/test_auth.py` - Authentication flows
- `tests/test_campaigns.py` - Campaign CRUD
- `tests/test_payments.py` - Payment processing
- `tests/test_integration_*.py` - Full workflows

### Frontend E2E Tests

```bash
cd frontend-next
npx playwright test
# Or in UI mode:
npx playwright test --ui
```

---

## 📦 Archive & Version Control

### Archiving Uploads

Use the provided script to compress and track uploads:

```bash
cd backend
./scripts/archive_uploads.sh           # Archive and push to remote
./scripts/archive_uploads.sh --no-push # Archive only (local)
```

The script:
1. Adds `uploads/` to `.gitignore`
2. Creates `uploads.tar.gz` snapshot
3. Commits both `.gitignore` and archive
4. Optionally pushes to remote

### Git Workflow

**Branches:**
- `main` - Production releases (stable)
- `development` - Active development branch
- Feature branches: `feature/goal-feature`, `fix/payment-bug`, etc.

**Commits:**
- Use conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `test:`, etc.
- Example: `feat: add campaign goal milestone tracking`

---

## 🚀 Deployment

### Docker Deployment (Backend + Database)

```bash
cd backend
docker-compose up -d
```

Services:
- **API**: `http://localhost:8001`
- **PostgreSQL**: `localhost:5432`
- **Docs**: `http://localhost:8001/docs`

### Frontend Deployment

**Build:**
```bash
cd frontend-next
npm run build
```

**Deploy to Vercel:**
```bash
vercel deploy --prod
```

Or deploy to your own server:
```bash
npm run build && npm start
```

---

## 📊 Key APIs

### Create Campaign
```bash
POST /api/campaigns
{
  "title": "Build School Library",
  "slug": "build-school-library",
  "description": "Help us establish a library for our community school",
  "category": "EDUCATION",
  "target_amount": 5000,
  "mode": "ORGANIZATION"
}
```

### Create Campaign Goal
```bash
POST /api/goals/campaigns/{slug}
{
  "title": "Phase 1: Foundation",
  "description": "Secure the building and basic setup",
  "target_amount": 1500,
  "due_date": "2026-06-30"
}
```

### Initiate Donation
```bash
POST /api/payments/initiate
{
  "campaign_id": 1,
  "amount": 100,
  "donor_email": "donor@example.com",
  "goal_id": 1  # Optional
}
```

---

## 🔐 Security

- **Authentication**: OAuth2 with JWT tokens (24-hour expiry)
- **Authorization**: Role-based access control (USER, ADMIN)
- **Data Encryption**: PII encrypted at rest (optional field encryption key)
- **Validation**: Pydantic schemas for request validation
- **CORS**: Configured for frontend domain only
- **SQL Injection**: Protected via SQLAlchemy ORM
- **Secrets**: Loaded from environment, never committed to repo

---

## 📝 Documentation

Additional documentation available in `memory-bank/`:
- **`productContext.md`** - Product vision and roadmap
- **`systemPatterns.md`** - Architectural decisions and conventions
- **`decisionLog.md`** - Technical decisions and rationale
- **`progress.md`** - Implementation status and milestones

---

## 🤝 Contributing

1. **Create feature branch** from `development`:
   ```bash
   git checkout development
   git pull origin development
   git checkout -b feature/your-feature-name
   ```

2. **Make changes** and test locally

3. **Commit with clear messages**:
   ```bash
   git commit -m "feat: add feature description"
   ```

4. **Push and create Pull Request**:
   ```bash
   git push origin feature/your-feature-name
   ```

5. **Code Review**: Address feedback and iterate

6. **Merge**: Once approved, merge to `development`

---

## 📞 Support & Contact

For questions or issues:
- 📧 Email: support@kambeng.gm
- 🐛 Report bugs: [GitHub Issues](https://github.com/HexAI-inc/Kambeng/issues)
- 💬 Discussions: [GitHub Discussions](https://github.com/HexAI-inc/Kambeng/discussions)

---

## 📄 License

This project is licensed under the MIT License. See `LICENSE` file for details.

---

## 🙏 Acknowledgments

- **HexAI**: Payment gateway integration
- **FastAPI Community**: Excellent framework and documentation
- **Next.js Team**: Amazing React framework
- **Community Contributors**: For feedback and improvements

---

**Made with ❤️ for the Gambian community**
