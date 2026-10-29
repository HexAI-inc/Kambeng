from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, APIRouter, Depends
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.exc import IntegrityError
from pathlib import Path
from urllib.parse import parse_qs
import json
import platform
import posixpath
import time
import uuid

from app.core.config import settings
from app.core.media_signing import is_private_media, verify_signed_query
from app.core.logging_config import LOG_FILE_PATH, clear_request_context, get_logger, set_request_context
from app.api.routes import admin, aliases, auth, campaign_updates, campaigns, fraud_report_notification_emails, gateway_audit, goals, kyc, marketing, organizations, moderation, payments, profiles, promotions, reviews, search, subscriptions, uploads, utils, webhooks, websockets, kyc_notification_emails
import psutil


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Scheduled jobs run ONLY in the dedicated worker process
    # (app/workers/scheduler_worker.py) — scheduling them here too would make
    # every API replica execute them in duplicate.
    yield


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
class MediaFiles(StaticFiles):
    """Public media, except private files (KYC), which need a signed link from /api/media/presign."""

    async def get_response(self, path: str, scope):
        # Normalise first so "campaigns/../kyc/..." cannot slip past the prefix check.
        path = posixpath.normpath(path.replace("\\", "/")).lstrip("/")
        if is_private_media(path):
            query = parse_qs(scope.get("query_string", b"").decode("latin-1"))
            if not verify_signed_query(path, query.get("exp", [None])[0], query.get("sig", [None])[0]):
                return JSONResponse(status_code=404, content={"detail": "Not Found"})
        return await super().get_response(path, scope)


app.mount(settings.MEDIA_URL_PREFIX, MediaFiles(directory=str(media_root)), name="media")

allowed_origins = {settings.FRONTEND_URL}
if settings.ENVIRONMENT.lower() != "prod":
    allowed_origins |= {f"http://localhost:{port}" for port in range(4200, 4206)}

app.add_middleware(
    CORSMiddleware,
    allow_origins=sorted(origin for origin in allowed_origins if origin),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


_SENSITIVE_QUERY_KEYS = {"token", "code", "sig", "signature", "password", "access_token", "refresh_token"}


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

    # Query strings carry one-time tokens (unsubscribe links, websocket auth); never log their values.
    query = {
        key: ("[redacted]" if key.lower() in _SENSITIVE_QUERY_KEYS else value)
        for key, value in request.query_params.items()
    }
    logger.info("Incoming request", extra={"query": query})
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
app.include_router(organizations.router, prefix="/api")
app.include_router(organizations.admin_router, prefix="/api")
app.include_router(kyc_notification_emails.router, prefix="/api")
app.include_router(profiles.router, prefix="/api")
app.include_router(subscriptions.router, prefix="/api")
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
app.include_router(marketing.router, prefix="/api")
app.include_router(promotions.router, prefix="/api")
app.include_router(gateway_audit.router, prefix="/api")

# Logs, Health, and Monitoring API
logs_router = APIRouter()
admin_only = [Depends(auth.get_admin_user)]

@logs_router.get("/logs", tags=["Logs"], dependencies=admin_only)
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
        return {"error": "Failed to read logs"}

@logs_router.get("/health", tags=["Monitoring"])
async def health_check():
    """Basic health check endpoint."""
    return {"status": "ok", "timestamp": int(time.time())}

@logs_router.get("/monitor", tags=["Monitoring"], dependencies=admin_only)
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

