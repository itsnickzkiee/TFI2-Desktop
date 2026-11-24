import base64
import json

import pytest

from tfi_backend.config import (
    ConfigurationError,
    Settings,
    validate_publishable_key,
    validate_supabase_url,
)


def test_accepts_tfi2_project_url():
    assert validate_supabase_url("https://slfjqrkxnsgdaturaguw.supabase.co") == (
        "https://slfjqrkxnsgdaturaguw.supabase.co"
    )


@pytest.mark.parametrize(
    "url",
    [
        "http://example.supabase.co",
        "https://example.com",
        "https://user:pass@example.supabase.co",
        "https://example.supabase.co:8443",
        "https://example.supabase.co/path",
    ],
)
def test_rejects_unsafe_supabase_urls(url):
    with pytest.raises(ConfigurationError):
        validate_supabase_url(url)


def test_accepts_publishable_key():
    assert validate_publishable_key("sb_publishable_example") == "sb_publishable_example"


def test_rejects_service_role_key():
    with pytest.raises(ConfigurationError):
        validate_publishable_key("sb_secret_do_not_use")


def test_legacy_key_must_have_anon_role():
    def jwt(role):
        header = base64.urlsafe_b64encode(b'{"alg":"HS256"}').decode().rstrip("=")
        payload = base64.urlsafe_b64encode(
            json.dumps({"role": role}).encode()
        ).decode().rstrip("=")
        return f"{header}.{payload}.signature"

    assert validate_publishable_key(jwt("anon")) == jwt("anon")
    with pytest.raises(ConfigurationError):
        validate_publishable_key(jwt("service_role"))


def test_settings_restricts_host_to_loopback(monkeypatch):
    monkeypatch.setenv("TFI_SUPABASE_URL", "https://slfjqrkxnsgdaturaguw.supabase.co")
    monkeypatch.setenv("TFI_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_example")
    monkeypatch.setenv("TFI_HOST", "0.0.0.0")
    with pytest.raises(ConfigurationError):
        Settings.from_env()
