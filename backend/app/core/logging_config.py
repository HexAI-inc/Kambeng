import json
import logging
import os
import re
import socket
import sys
import time
from contextvars import ContextVar, Token
from pathlib import Path
from typing import Any, Dict

LOG_FILE_PATH = Path(__file__).parent.parent / "kambeng.log"

REQUEST_CONTEXT: ContextVar[Dict[str, Any]] = ContextVar("request_context", default={})

REDACT_FIELDS = {
    "password",
    "token",
    "access_token",
    "refresh_token",
    "secret",
    "api_key",
    "authorization",
    "cookie",
    "set-cookie",
    "username",
    "email",
    "wave_number",
    "full_name",
    "donor_name",
    "recipient_name",
    "admin_email",
    "user_email",
    "phone",
    "mobile",
    "comment",
}

EMAIL_PATTERN = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
PHONE_PATTERN = re.compile(r"(?<!\d)(?:\+?\d[\d\s().-]{7,}\d)(?!\d)")

STANDARD_LOG_RECORD_FIELDS = {
    "name", "msg", "args", "levelname", "levelno", "pathname", "filename", "module",
    "exc_info", "exc_text", "stack_info", "lineno", "funcName", "created", "msecs",
    "relativeCreated", "thread", "threadName", "processName", "process", "message",
}


def set_request_context(**kwargs: Any) -> Token:
    current = REQUEST_CONTEXT.get({})
    merged = {**current, **kwargs}
    return REQUEST_CONTEXT.set(merged)


def clear_request_context(token: Token) -> None:
    REQUEST_CONTEXT.reset(token)


def _redact_value(key: str, value: Any) -> Any:
    lower_key = key.lower()
    if any(field in lower_key for field in REDACT_FIELDS):
        return "[REDACTED]"
    if isinstance(value, str):
        redacted = EMAIL_PATTERN.sub("[REDACTED_EMAIL]", value)
        redacted = PHONE_PATTERN.sub("[REDACTED_PHONE]", redacted)
        return redacted
    if isinstance(value, dict):
        return {str(inner_key): _redact_value(str(inner_key), inner_value) for inner_key, inner_value in value.items()}
    if isinstance(value, (list, tuple, set)):
        sanitized_items = [_redact_value(key, item) for item in value]
        return type(value)(sanitized_items) if not isinstance(value, set) else set(sanitized_items)
    return value


class RequestContextFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        context = REQUEST_CONTEXT.get({})
        for key, value in context.items():
            if not hasattr(record, key):
                setattr(record, key, value)
        return True

class JsonLogFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        log: Dict[str, Any] = {
            "level": record.levelno,
            "time": int(time.time() * 1000),
            "pid": os.getpid(),
            "hostname": socket.gethostname(),
            "msg": _redact_value("msg", record.getMessage()),
        }

        for key, value in record.__dict__.items():
            if key in STANDARD_LOG_RECORD_FIELDS or key.startswith("_"):
                continue
            log[key] = _redact_value(key, value)

        if record.exc_info:
            log["error"] = self.formatException(record.exc_info)

        return json.dumps(log, ensure_ascii=False)

# Configure root logger for JSON output
handler = logging.FileHandler(LOG_FILE_PATH, encoding="utf-8")
handler.setFormatter(JsonLogFormatter())
handler.addFilter(RequestContextFilter())

stream_handler = logging.StreamHandler(sys.stdout)
stream_handler.setFormatter(JsonLogFormatter())
stream_handler.addFilter(RequestContextFilter())

logging.basicConfig(
    level=logging.INFO,
    handlers=[handler, stream_handler],
    force=True,
)

# Keep SQL logs readable by default.
logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
logging.getLogger("sqlalchemy.pool").setLevel(logging.WARNING)

def get_logger(name: str = None):
    return logging.getLogger(name)
