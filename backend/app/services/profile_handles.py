"""Rules for profile handles — the "@awa" in kambeng.gm/@awa."""
import re

# Lowercase; starts with a letter so a handle can never look like a numeric
# profile id (/profiles/42 vs /profiles/awa).
HANDLE_PATTERN = re.compile(r"^[a-z][a-z0-9_]{2,29}$")

# Anything that could pass for staff, the platform, or an app route.
RESERVED_HANDLES = frozenset({
    "admin", "administrator", "api", "auth", "campaign", "campaigns", "dashboard", "donate",
    "follow", "handle", "help", "home", "kambeng", "kambeng_team", "login", "logout", "me",
    "moderator", "null", "official", "profile", "profiles", "quick_pay", "register", "root",
    "search", "security", "settings", "signup", "staff", "support", "system", "team",
    "undefined", "verified", "wave",
})


def normalize_handle(raw: str) -> str:
    return raw.strip().lstrip("@").lower()


def handle_problem(handle: str) -> str | None:
    """Why `handle` (already normalized) can't be used, or None if the format is fine."""
    if not HANDLE_PATTERN.match(handle):
        return "Use 3–30 lowercase letters, numbers or underscores, starting with a letter"
    if handle in RESERVED_HANDLES or handle.startswith("kambeng"):
        return "That handle is reserved"
    return None
