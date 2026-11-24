"""Configuration loading and validation for the TFI_NEW Windows host."""
from __future__ import annotations

import base64
import json
import os
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlparse

from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(PROJECT_ROOT / ".env", override=False)


class ConfigurationError(ValueError):
    """Raised when an unsafe or incomplete runtime configuration is supplied."""


def validate_supabase_url(value: str) -> str:
    value = (value or "").strip().rstrip("/")
    parsed = urlparse(value)
    if (
        parsed.scheme != "https"
        or not parsed.hostname
        or not parsed.hostname.endswith(".supabase.co")
        or parsed.username
        or parsed.password
        or parsed.port is not None
        or parsed.path not in ("", "/")
        or parsed.query
        or parsed.fragment
    ):
        raise ConfigurationError(
            "TFI_SUPABASE_URL must be the official https://PROJECT.supabase.co URL."
        )
    return value


def validate_publishable_key(value: str) -> str:
    value = (value or "").strip()
    if not value:
        raise ConfigurationError("TFI_SUPABASE_PUBLISHABLE_KEY is required.")

    lowered = value.lower()
    if any(marker in lowered for marker in ("service_role", "sb_secret_", "sb_service_role_")):
        raise ConfigurationError(
            "A service-role or secret key is forbidden in the Windows application."
        )

    if value.startswith("sb_publishable_"):
        return value

    # Legacy Supabase anon JWTs remain supported, but service-role JWTs do not.
    parts = value.split(".")
    if len(parts) != 3:
        raise ConfigurationError(
            "Use a Supabase publishable key (sb_publishable_...) or legacy anon key."
        )
    try:
        payload = parts[1] + ("=" * (-len(parts[1]) % 4))
        claims = json.loads(base64.urlsafe_b64decode(payload.encode("ascii")))
    except Exception as exc:
        raise ConfigurationError("The legacy Supabase key is not a valid JWT.") from exc
    if claims.get("role") != "anon":
        raise ConfigurationError("Only an anon/publishable key may be used by this client.")
    return value


@dataclass(frozen=True)
class Settings:
    supabase_url: str
    publishable_key: str
    host: str = "127.0.0.1"
    port: int = 5100
    idle_timeout_seconds: int = 0
    debug: bool = False
    google_client_id: str | None = None
    google_client_secret: str | None = None

    @classmethod
    def from_env(cls) -> "Settings":
        try:
            port = int(os.getenv("TFI_PORT", "5100"))
            idle_timeout = int(os.getenv("TFI_SESSION_IDLE_TIMEOUT_SECONDS", "0"))
        except ValueError as exc:
            raise ConfigurationError("TFI_PORT and session timeout must be integers.") from exc

        host = os.getenv("TFI_HOST", "127.0.0.1").strip()
        if host not in ("127.0.0.1", "localhost", "::1"):
            raise ConfigurationError("The Windows application must bind to localhost only.")
        if not 1 <= port <= 65535:
            raise ConfigurationError("TFI_PORT must be between 1 and 65535.")
        if idle_timeout < 0:
            raise ConfigurationError("Session idle timeout cannot be negative.")

        return cls(
            supabase_url=validate_supabase_url(os.getenv("TFI_SUPABASE_URL", "")),
            publishable_key=validate_publishable_key(
                os.getenv("TFI_SUPABASE_PUBLISHABLE_KEY", "")
            ),
            host=host,
            port=port,
            idle_timeout_seconds=idle_timeout,
            debug=os.getenv("TFI_DEBUG", "false").strip().lower() == "true",
            google_client_id=os.getenv("TFI_GOOGLE_CLIENT_ID", "").strip() or None,
            google_client_secret=os.getenv("TFI_GOOGLE_CLIENT_SECRET", "").strip() or None,
        )
