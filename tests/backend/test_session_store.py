import time

import pytest

from tfi_backend.session_store import RecoveryVault, SessionVault
from tfi_backend.supabase_gateway import SupabaseError


class FakeGateway:
    def __init__(self):
        self.refresh_calls = 0

    def refresh_session(self, refresh_token):
        self.refresh_calls += 1
        return {
            "access_token": "refreshed-access",
            "refresh_token": "refreshed-refresh",
            "expires_at": time.time() + 3600,
        }


def test_session_tokens_stay_in_server_side_vault():
    vault = SessionVault()
    gateway = FakeGateway()
    vault.add("sid-1", {
        "user_id": "user-1",
        "email": "admin@example.test",
        "access_token": "access",
        "refresh_token": "refresh",
        "expires_at": time.time() + 3600,
    })

    result = vault.get("sid-1", gateway)

    assert result["access_token"] == "access"
    assert result["refresh_token"] == "refresh"
    assert gateway.refresh_calls == 0
    assert vault.count() == 1


def test_expiring_session_is_refreshed():
    vault = SessionVault()
    gateway = FakeGateway()
    vault.add("sid-2", {
        "user_id": "user-2",
        "email": "user@example.test",
        "access_token": "old-access",
        "refresh_token": "old-refresh",
        "expires_at": time.time() + 30,
    })

    result = vault.get("sid-2", gateway)

    assert result["access_token"] == "refreshed-access"
    assert result["refresh_token"] == "refreshed-refresh"
    assert gateway.refresh_calls == 1


def test_missing_session_is_rejected():
    vault = SessionVault()
    with pytest.raises(SupabaseError) as error:
        vault.get(None, FakeGateway())
    assert error.value.code == "session_missing"


def test_idle_timeout_expires_session(monkeypatch):
    now = [1000.0]
    monkeypatch.setattr("tfi_backend.session_store.time.time", lambda: now[0])
    vault = SessionVault(idle_timeout_seconds=60)
    gateway = FakeGateway()
    vault.add("sid-3", {
        "user_id": "user-3",
        "email": "user@example.test",
        "access_token": "access",
        "refresh_token": "refresh",
        "expires_at": 5000,
    })
    now[0] = 1061.0

    with pytest.raises(SupabaseError) as error:
        vault.get("sid-3", gateway)
    assert error.value.code == "session_idle_timeout"
    assert vault.count() == 0


def test_remove_clears_session():
    vault = SessionVault()
    vault.add("sid-4", {
        "user_id": "user-4",
        "email": "user@example.test",
        "access_token": "access",
        "refresh_token": "refresh",
        "expires_at": time.time() + 3600,
    })
    vault.remove("sid-4")
    assert vault.count() == 0


def test_recovery_vault_keeps_reset_token_server_side():
    vault = RecoveryVault(ttl_seconds=600)
    vault.add("rid-1", {
        "user_id": "user-1",
        "email": "user@example.test",
        "access_token": "recovery-token",
    })
    assert vault.get("rid-1")["access_token"] == "recovery-token"
    assert vault.count() == 1


def test_recovery_vault_expires_short_lived_tokens(monkeypatch):
    now = [1000.0]
    monkeypatch.setattr("tfi_backend.session_store.time.time", lambda: now[0])
    vault = RecoveryVault(ttl_seconds=60)
    vault.add("rid-2", {"access_token": "recovery-token"})
    now[0] = 1061.0
    with pytest.raises(SupabaseError) as error:
        vault.get("rid-2")
    assert error.value.code == "recovery_session_expired"
    assert vault.count() == 0


def test_recovery_vault_requires_a_valid_session_id():
    vault = RecoveryVault()
    with pytest.raises(SupabaseError) as error:
        vault.get(None)
    assert error.value.code == "recovery_session_missing"
