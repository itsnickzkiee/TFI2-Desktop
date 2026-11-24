import json
import time

import pytest

from tfi_backend.config import Settings
from tfi_backend.supabase_gateway import SupabaseError, SupabaseGateway


class FakeResponse:
    def __init__(self, status_code=200, payload=None):
        self.status_code = status_code
        self._payload = payload
        self.content = b"{}" if payload is not None else b""

    @property
    def ok(self):
        return 200 <= self.status_code < 300

    def json(self):
        return self._payload


class FakeTransport:
    def __init__(self, responses):
        self.responses = list(responses)
        self.calls = []

    def request(self, method, url, **kwargs):
        self.calls.append((method, url, kwargs))
        return self.responses.pop(0)


def settings():
    return Settings(
        supabase_url="https://slfjqrkxnsgdaturaguw.supabase.co",
        publishable_key="sb_publishable_test",
    )


def test_health_uses_tfi2_auth_health_endpoint():
    transport = FakeTransport([FakeResponse(200, {"name": "GoTrue"})])
    gateway = SupabaseGateway(settings(), transport)
    assert gateway.health() == {"connected": True, "project": "TFI2"}
    method, url, kwargs = transport.calls[0]
    assert method == "GET"
    assert url.endswith("/auth/v1/health")
    assert kwargs["headers"]["apikey"] == "sb_publishable_test"


def test_sign_in_uses_password_grant_and_returns_expiry():
    transport = FakeTransport([FakeResponse(200, {
        "access_token": "access",
        "refresh_token": "refresh",
        "expires_in": 3600,
        "user": {"id": "user-1", "email": "admin@example.test"},
    })])
    gateway = SupabaseGateway(settings(), transport)
    session = gateway.sign_in_with_password("admin@example.test", "password")
    assert session["user_id"] == "user-1"
    assert session["access_token"] == "access"
    assert session["refresh_token"] == "refresh"
    assert session["expires_at"] > time.time()
    assert transport.calls[0][1].endswith("/auth/v1/token?grant_type=password")


def test_access_context_uses_user_bearer_token():
    transport = FakeTransport([FakeResponse(200, {
        "profile": {"account_status": "active"},
        "roles": [],
        "permissions": [],
    })])
    gateway = SupabaseGateway(settings(), transport)
    result = gateway.get_access_context("user-jwt")
    assert result["profile"]["account_status"] == "active"
    assert transport.calls[0][1].endswith("/rest/v1/rpc/tfi_get_my_access_context")
    assert transport.calls[0][2]["headers"]["Authorization"] == "Bearer user-jwt"


def test_incomplete_auth_response_is_rejected():
    transport = FakeTransport([FakeResponse(200, {"access_token": "only"})])
    gateway = SupabaseGateway(settings(), transport)
    with pytest.raises(SupabaseError):
        gateway.sign_in_with_password("admin@example.test", "password")


def test_401_message_does_not_echo_credentials():
    transport = FakeTransport([FakeResponse(401, {
        "message": "secret raw auth detail",
        "code": "invalid_credentials",
    })])
    gateway = SupabaseGateway(settings(), transport)
    with pytest.raises(SupabaseError) as error:
        gateway.sign_in_with_password("admin@example.test", "password")
    assert "secret raw auth detail" not in str(error.value)


def test_password_recovery_request_uses_redirect_allowlisted_callback():
    transport = FakeTransport([FakeResponse(200, {})])
    gateway = SupabaseGateway(settings(), transport)
    gateway.request_password_recovery(
        "admin@example.test",
        "http://127.0.0.1:5100/auth/recovery",
    )
    method, url, kwargs = transport.calls[0]
    assert method == "POST"
    assert url.endswith("/auth/v1/recover?redirect_to=http%3A%2F%2F127.0.0.1%3A5100%2Fauth%2Frecovery")
    assert kwargs["json"] == {"email": "admin@example.test"}


def test_get_auth_user_uses_recovery_bearer_token():
    transport = FakeTransport([FakeResponse(200, {
        "id": "user-1",
        "email": "admin@example.test",
    })])
    gateway = SupabaseGateway(settings(), transport)
    user = gateway.get_auth_user("recovery-access")
    assert user == {"user_id": "user-1", "email": "admin@example.test"}
    assert transport.calls[0][0] == "GET"
    assert transport.calls[0][1].endswith("/auth/v1/user")
    assert transport.calls[0][2]["headers"]["Authorization"] == "Bearer recovery-access"


def test_update_password_uses_authenticated_auth_user_endpoint():
    transport = FakeTransport([FakeResponse(200, {"id": "user-1"})])
    gateway = SupabaseGateway(settings(), transport)
    gateway.update_password("recovery-access", "new-secure-password")
    method, url, kwargs = transport.calls[0]
    assert method == "PUT"
    assert url.endswith("/auth/v1/user")
    assert kwargs["headers"]["Authorization"] == "Bearer recovery-access"
    assert kwargs["json"] == {"password": "new-secure-password"}


def test_recovery_email_rate_limit_has_a_specific_user_message():
    transport = FakeTransport([FakeResponse(429, {
        "code": "over_email_send_rate_limit",
        "message": "Email rate limit exceeded",
    })])
    gateway = SupabaseGateway(settings(), transport)
    with pytest.raises(SupabaseError) as error:
        gateway.request_password_recovery(
            "admin@example.test",
            "http://127.0.0.1:5100/auth/recovery",
        )
    assert error.value.status_code == 429
    assert error.value.code == "email_rate_limited"
    assert "email-sending quota" in str(error.value)
    assert "invitation" in str(error.value)
    assert "hourly allowance" in str(error.value)


def test_non_email_rate_limit_keeps_generic_message():
    transport = FakeTransport([FakeResponse(429, {
        "code": "over_request_rate_limit",
        "message": "Too many requests",
    })])
    gateway = SupabaseGateway(settings(), transport)
    with pytest.raises(SupabaseError) as error:
        gateway.health()
    assert error.value.status_code == 429
    assert error.value.code == "rate_limited"


def test_master_data_categories_uses_authenticated_postgrest_request():
    transport = FakeTransport([FakeResponse(200, [{"category_key": "product_standard"}])])
    gateway = SupabaseGateway(settings(), transport)
    rows = gateway.get_master_data_categories("user-jwt")
    assert rows[0]["category_key"] == "product_standard"
    method, url, kwargs = transport.calls[0]
    assert method == "GET"
    assert "/rest/v1/tfi_master_data_categories?" in url
    assert kwargs["headers"]["Authorization"] == "Bearer user-jwt"


def test_master_data_rows_are_scoped_to_one_category_and_active_records():
    transport = FakeTransport([FakeResponse(200, [{"source_row_number": 3}])])
    gateway = SupabaseGateway(settings(), transport)
    rows = gateway.get_master_data_rows("user-jwt", "product_standard")
    assert rows[0]["source_row_number"] == 3
    url = transport.calls[0][1]
    assert "category_key=eq.product_standard" in url
    assert "record_status=eq.active" in url
    assert "order=source_row_number.asc" in url


def test_master_data_revision_history_uses_authenticated_postgrest_request():
    transport = FakeTransport([FakeResponse(200, [{
        "version": 2,
        "changed_columns": ["B"],
        "change_reason": "Verified name",
    }])])
    gateway = SupabaseGateway(settings(), transport)
    revisions = gateway.get_master_data_revisions(
        "user-jwt",
        "00000000-0000-0000-0000-000000000001",
    )
    assert revisions[0]["version"] == 2
    method, url, kwargs = transport.calls[0]
    assert method == "GET"
    assert "/rest/v1/tfi_master_data_row_revisions?" in url
    assert "master_data_row_id=eq.00000000-0000-0000-0000-000000000001" in url
    assert "order=version.desc" in url
    assert kwargs["headers"]["Authorization"] == "Bearer user-jwt"


def test_master_data_update_uses_restricted_rpc_and_expected_version():
    transport = FakeTransport([FakeResponse(200, {
        "changed": True,
        "version": 2,
        "current_values": ["CODE-1", "New Name"],
    })])
    gateway = SupabaseGateway(settings(), transport)
    result = gateway.update_master_data_row(
        "user-jwt",
        "00000000-0000-0000-0000-000000000001",
        1,
        {"B": "New Name"},
        "Verified name",
    )
    assert result["version"] == 2
    method, url, kwargs = transport.calls[0]
    assert method == "POST"
    assert url.endswith("/rest/v1/rpc/tfi_update_master_data_row")
    assert kwargs["headers"]["Authorization"] == "Bearer user-jwt"
    assert kwargs["json"] == {
        "p_row_id": "00000000-0000-0000-0000-000000000001",
        "p_expected_version": 1,
        "p_changes": {"B": "New Name"},
        "p_change_reason": "Verified name",
    }


def test_master_data_version_conflict_has_a_refresh_message():
    transport = FakeTransport([FakeResponse(409, {
        "code": "40001",
        "message": "master_data_version_conflict",
    })])
    gateway = SupabaseGateway(settings(), transport)
    with pytest.raises(SupabaseError) as error:
        gateway.update_master_data_row(
            "user-jwt",
            "00000000-0000-0000-0000-000000000001",
            1,
            {"B": "New Name"},
        )
    assert error.value.status_code == 409
    assert error.value.code == "master_data_version_conflict"
    assert "Reload it" in str(error.value)


def test_master_data_protected_column_error_is_not_exposed_as_raw_sql():
    transport = FakeTransport([FakeResponse(403, {
        "code": "42501",
        "message": "master_data_column_protected",
    })])
    gateway = SupabaseGateway(settings(), transport)
    with pytest.raises(SupabaseError) as error:
        gateway.update_master_data_row(
            "user-jwt",
            "00000000-0000-0000-0000-000000000001",
            1,
            {"A": "CHANGED"},
        )
    assert error.value.status_code == 403
    assert error.value.code == "master_data_protected"
    assert "protected by the approved source rules" in str(error.value)
    assert "master_data_column_protected" not in str(error.value)


def test_master_data_permission_error_remains_distinct_from_protected_field():
    transport = FakeTransport([FakeResponse(403, {
        "code": "42501",
        "message": "master_data_edit_permission_required",
    })])
    gateway = SupabaseGateway(settings(), transport)
    with pytest.raises(SupabaseError) as error:
        gateway.update_master_data_row(
            "user-jwt",
            "00000000-0000-0000-0000-000000000001",
            1,
            {"B": "New Name"},
        )
    assert error.value.status_code == 403
    assert error.value.code == "master_data_permission_denied"
    assert "does not have permission" in str(error.value)


def test_finalize_coding_dpr_import_uses_dedicated_rpc_and_user_token():
    transport = FakeTransport([FakeResponse(200, {
        "id": "batch-1", "status": "completed", "rows_inserted": 1,
    })])
    gateway = SupabaseGateway(settings(), transport)
    result = gateway.finalize_coding_dpr_import(
        "user-jwt", "batch-1", ["row-1"]
    )
    assert result["rows_inserted"] == 1
    method, url, kwargs = transport.calls[0]
    assert method == "POST"
    assert url.endswith("/rest/v1/rpc/tfi_finalize_coding_dpr_import")
    assert kwargs["headers"]["Authorization"] == "Bearer user-jwt"
    assert kwargs["json"] == {"p_batch_id": "batch-1", "p_row_ids": ["row-1"]}


def test_hourly_import_gateway_routes_to_module_specific_stage_and_finalize_rpcs():
    transport = FakeTransport([FakeResponse(200, {"rows_staged": 1}), FakeResponse(200, {"rows_inserted": 1})])
    gateway = SupabaseGateway(settings(), transport)
    gateway.stage_import_rows("user-jwt", "batch-1", [{"source_row_number": 5}], module_key="hourly_agri")
    gateway.finalize_hourly_production_import("user-jwt", "batch-1", ["row-1"])
    assert transport.calls[0][1].endswith("/rest/v1/rpc/tfi_stage_hourly_production_import_rows")
    assert transport.calls[1][1].endswith("/rest/v1/rpc/tfi_finalize_hourly_production_import")
    assert transport.calls[0][2]["headers"]["Authorization"] == "Bearer user-jwt"
    assert transport.calls[1][2]["json"] == {"p_batch_id": "batch-1", "p_row_ids": ["row-1"]}


def test_non_hourly_import_gateway_keeps_existing_generic_stage_rpc():
    transport = FakeTransport([FakeResponse(200, {"rows_staged": 1})])
    gateway = SupabaseGateway(settings(), transport)
    gateway.stage_import_rows("user-jwt", "batch-1", [{"source_row_number": 5}], module_key="oee")
    assert transport.calls[0][1].endswith("/rest/v1/rpc/tfi_stage_import_rows")
