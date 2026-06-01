from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, APIRouter
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.exc import IntegrityError
from pathlib import Path
import json
import platform
import time
import uuid

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.core.config import settings
from app.core.logging_config import LOG_FILE_PATH, clear_request_context, get_logger, set_request_context
from app.api.routes import admin, aliases, auth, campaign_updates, campaigns, fraud_report_notification_emails, goals, kyc, moderation, payments, reviews, search, uploads, utils, webhooks, websockets, kyc_notification_emails
from app.services.recurring_charge_service import process_recurring_charges
import psutil


@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler = AsyncIOScheduler(timezone="UTC")
    scheduler.add_job(
        process_recurring_charges,
        CronTrigger(hour=2, minute=0, timezone="UTC"),
        id="process_recurring_charges",
        name="Process Recurring Donations",
        replace_existing=True,
        misfire_grace_time=3600,  # allow up to 1h late if server was down
    )
    scheduler.start()
    _logger = get_logger("kambeng")
    _logger.info("Recurring donation scheduler started", extra={"action": "scheduler_startup"})
    yield
    if scheduler.running:
        scheduler.shutdown(wait=False)
    _logger.info("Recurring donation scheduler stopped", extra={"action": "scheduler_shutdown"})


app = FastAPI(
    title=settings.PROJECT_NAME,
    lifespan=lifespan,
    description="The backend engine for Kambeng Crowdfunding Platform",
    version="1.0.0",
    openapi_url=settings.API_OPENAPI_URL,
    docs_url=settings.API_DOCS_URL,
    redoc_url=settings.API_REDOC_URL,
    swagger_ui_parameters={"persistAuthorization": settings.SWAGGER_PERSIST_AUTHORIZATION},
)


# Initialize logging
logger = get_logger("kambeng")
logger.info("Kambeng backend starting up.")
settings.validate_required_secrets()

# Initialize storage strategy
from app.services.storage_strategy import get_storage_strategy

try:
    storage_strategy = get_storage_strategy()
    logger.info(f"Storage strategy initialized: {type(storage_strategy).__name__}")
except ValueError as e:
    logger.error(f"Failed to initialize storage strategy: {e}")
    raise

# Mount local media directory (used by local strategy)
media_root = Path(settings.MEDIA_ROOT)
media_root.mkdir(parents=True, exist_ok=True)
app.mount(settings.MEDIA_URL_PREFIX, StaticFiles(directory=str(media_root)), name="media")

allowed_origins = {
    settings.FRONTEND_URL,
    "http://localhost:4200",
    "http://localhost:4201",
    "http://localhost:4202",
    "http://localhost:4203",
    "http://localhost:4204",
    "http://localhost:4205",
}

app.add_middleware(
    CORSMiddleware,
    allow_origins=sorted(origin for origin in allowed_origins if origin),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    request_id = str(uuid.uuid4())
    started_at = time.perf_counter()
    forwarded_for = request.headers.get("x-forwarded-for", "")
    client_ip = forwarded_for.split(",")[0].strip() if forwarded_for else (request.client.host if request.client else None)
    user_agent = request.headers.get("user-agent", "unknown")

    token = set_request_context(
        requestId=request_id,
        method=request.method,
        path=request.url.path,
        ip=client_ip,
        userAgent=user_agent,
    )

    logger.info("Incoming request", extra={"query": dict(request.query_params)})
    try:
        response = await call_next(request)
    except Exception:
        duration_ms = int((time.perf_counter() - started_at) * 1000)
        logger.exception("Request failed", extra={"statusCode": 500, "duration": f"{duration_ms}ms"})
        clear_request_context(token)
        raise

    duration_ms = int((time.perf_counter() - started_at) * 1000)
    logger.info("Request completed", extra={"statusCode": response.status_code, "duration": f"{duration_ms}ms"})
    response.headers["X-Request-ID"] = request_id
    clear_request_context(token)
    return response

@app.exception_handler(IntegrityError)
async def sqlalchemy_integrity_error_handler(request: Request, exc: IntegrityError):
    return JSONResponse(
        status_code=400,
        content={"detail": "A database integrity error occurred. This might be due to duplicate data (e.g. phone number already registered)."}
    )

# ==== REGISTER ROUTERS HERE ====
app.include_router(auth.router, prefix="/api")
app.include_router(campaigns.router, prefix="/api")
app.include_router(goals.router, prefix="/api")
app.include_router(payments.router, prefix="/api")
app.include_router(webhooks.router, prefix="/api")
app.include_router(uploads.router, prefix="/api")
app.include_router(reviews.router, prefix="/api")
app.include_router(kyc.router, prefix="/api")
app.include_router(kyc_notification_emails.router, prefix="/api")
app.include_router(fraud_report_notification_emails.router, prefix="/api")
from app.api.routes import media as media_router
app.include_router(media_router.router, prefix="/api")
app.include_router(aliases.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(websockets.router)
app.include_router(moderation.router, prefix="/api")
app.include_router(search.router, prefix="/api")
app.include_router(utils.router, prefix="/api")
app.include_router(campaign_updates.router, prefix="/api")

# Logs, Health, and Monitoring API
logs_router = APIRouter()

@logs_router.get("/logs", tags=["Logs"])
async def get_recent_logs(lines: int = 100):
    """Return most recent logs as parsed JSON objects for UI readability."""
    try:
        with open(LOG_FILE_PATH, "r", encoding="utf-8") as f:
            all_lines = f.readlines()
        recent = all_lines[-max(1, min(lines, 1000)):]
        entries = []

        for line in recent:
            text = line.strip()
            if not text:
                continue
            try:
                entries.append(json.loads(text))
            except json.JSONDecodeError:
                # Keep non-JSON log lines visible (e.g., third-party output)
                entries.append({"msg": text, "format": "plain"})

        return {"count": len(entries), "entries": entries}
    except Exception as e:
        logger.error(f"Failed to read logs: {e}")
        return {"error": str(e)}

@logs_router.get("/health", tags=["Monitoring"])
async def health_check():
    """Basic health check endpoint."""
    return {"status": "ok", "timestamp": int(time.time())}

@logs_router.get("/monitor", tags=["Monitoring"])
async def system_monitor():
    """System resource usage and environment info."""
    try:
        return {
            "status": "ok",
            "timestamp": int(time.time()),
            "system": platform.system(),
            "release": platform.release(),
            "python_version": platform.python_version(),
            "cpu_percent": psutil.cpu_percent(interval=0.2),
            "memory": psutil.virtual_memory()._asdict(),
            "disk": psutil.disk_usage("/")._asdict(),
            "process_count": len(psutil.pids()),
            "uptime_seconds": int(time.time() - psutil.boot_time()),
        }
    except Exception as e:
        logger.error(f"System monitor error: {e}")
        return {"status": "error", "error": str(e)}

app.include_router(logs_router, prefix="/api")


@app.get("/")
async def root():
    return {
        "message": "Welcome to Kambeng API!", 
        "status": "online",
        "docs": "Visit /docs for Swagger UI"
    }

