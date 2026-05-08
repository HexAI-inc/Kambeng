from typing import Any, Dict, Optional
from contextvars import Token

from .logging_config import get_logger, set_request_context, clear_request_context

logger = get_logger("kambeng.action")


def log_action(action: str, user_id: Optional[int] = None, details: Optional[Dict[str, Any]] = None) -> None:
    """Log a generic backend action to console and file.

    - `action`: human-friendly action description (e.g. "Create campaign").
    - `user_id`: optional numeric id of the acting user.
    - `details`: optional dict with additional non-sensitive context.

    This function will redact known sensitive fields via the global
    `logging_config` rules and ensure the request context is attached to the
    log record so it appears in JSON output and console streams.
    """
    ctx = {}
    if user_id is not None:
        ctx["userId"] = user_id
    if details:
        ctx["details"] = details

    token: Token = set_request_context(**ctx)
    try:
        logger.info(action, extra=ctx)
    finally:
        clear_request_context(token)


def log_action_decorator(action_name: str):
    """Decorator that logs an action before and after a function call.

    Example:
        @log_action_decorator("Import campaign")
        def import_campaign(...):
            ...
    """

    def decorator(fn):
        def wrapper(*args, **kwargs):
            log_action(f"{action_name} - started")
            try:
                result = fn(*args, **kwargs)
                log_action(f"{action_name} - completed")
                return result
            except Exception:
                log_action(f"{action_name} - failed")
                raise

        return wrapper

    return decorator
