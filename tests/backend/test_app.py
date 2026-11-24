import time

from tfi_backend.app import create_app
from tfi_backend.config import Settings
from tfi_backend.session_store import SessionVault
from tfi_backend.supabase_gateway import SupabaseError


class FakeGateway:
    def __init__(self, status="active", roles=None, permissions=None):
        self.status = status
        self.roles = roles if roles is not None else [{"role_key": "system_admin", "role_name": "System Administrator"}]
        self.permissions = permissions if permissions is not None else [
            "dashboard.view", "master_data.view", "master_data.edit"
        ]
        self.sign_out_calls = 0
        self.password_updates = []
        self.recovery_redirects = []
        self.master_data_updates = []
        values = ["CODE-1", "Old Product Name"] + [None] * 19
        self.master_data_row = {
            "id": "00000000-0000-0000-0000-000000000001",
            "category_key": "product_standard",
            "source_row_number": 3,
            "row_kind": "data",
            "source_values": list(values),
            "current_values": list(values),
            "source_notes": [],
            "source_fingerprint": "a" * 64,
            "record_status": "active",
            "row_editable": True,
            "version": 1,
        }
        self.dashboard_filter_rows_requested = []
        def setup_row(source_row_number, entries):
            current_values = [None] * 20
            for index, value in entries.items():
                current_values[index] = value
            return {
                "source_row_number": source_row_number,
                "row_kind": "data",
                "record_status": "active",
                "current_values": current_values,
            }

        self.dashboard_filter_rows = {
            "kpi_setup": [
                setup_row(2, {0: "Daily", 1: "Jan", 2: 1, 3: 1, 4: "All", 5: "All", 17: "All", 18: 2025}),
                setup_row(3, {0: "Weekly", 1: "Feb", 2: 2, 3: 2, 4: "CODE-1", 5: "Machine A", 17: "Product One", 18: 2026}),
                setup_row(4, {0: "Monthly", 1: "Mar", 2: 3, 3: 3, 4: "CODE-2", 5: "Machine B", 17: "Product Two", 18: 2027}),
                setup_row(5, {18: 2028}),
            ],
            "code_map": [
                {"source_row_number": 5, "row_kind": "data", "record_status": "active", "current_values": ["CODE-1", "Product One"]},
                {"source_row_number": 6, "row_kind": "data", "record_status": "active", "current_values": ["CODE-2", "Product Two"]},
            ],
        }
        self.master_data_categories = [{
            "category_key": "product_standard",
            "display_name": "Product Standard and Specificat",
            "source_range": "A1:U110",
            "source_row_count": 110,
            "reference_count": 58,
            "source_column_count": 21,
            "edit_policy": "controlled_fields",
            "editable_columns": ["B", "C", "D", "E", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "T", "U"],
            "read_only_columns": ["A", "F", "G", "S"],
            "locked_source_rows": [],
            "sort_order": 1,
            "is_active": True,
        }]

    def request_password_recovery(self, email, redirect_to):
        self.recovery_redirects.append((email, redirect_to))

    def get_auth_user(self, access_token):
        assert access_token == "recovery-access-token"
        return {"user_id": "user-1", "email": "admin@example.test"}

    def update_password(self, access_token, password):
        self.password_updates.append((access_token, password))

    def health(self):
        return {"connected": True, "project": "TFI2"}

    def get_dashboard_coverage_summary(self, access_token, permissions):
        self.dashboard_permissions_seen = set(permissions)
        return {
            "source": "TFI2",
            "checked_at": 1795380000,
            "total_operational_records": 0,
            "visible_module_count": 0,
            "modules_with_records": 0,
            "modules": [],
            "imports": {"batches_total": 0, "batches_in_review": 0, "staged_rows": 0},
            "audit_events": 1,
            "kpi_calculations_ready": False,
            "kpi_calculation_note": "KPI values remain blank until Phase 7C calculation rules are verified.",
        }

    def get_dashboard_analytics(self, access_token, **filters):
        assert access_token == "access"
        self.dashboard_analytics_filters = dict(filters)
        return {
            "source": "TFI2",
            "calculation_contract": "source-workbook-2026-11-22-v1",
            "metrics": {"total_output_tins": 0, "oee": None},
            "reports": {
                "production_summary": {"status": "empty"},
                "schedule_summary": {"saved_rows": 0},
                "product_entry_summary": {"status": "pending_formula_projection"},
                "removed_rows": {"status": "archive_only"},
            },
        }

    def sign_in_with_password(self, email, password):
        return {
            "user_id": "user-1",
            "email": email,
            "access_token": "access",
            "refresh_token": "refresh",
            "expires_at": time.time() + 3600,
        }

    def get_access_context(self, access_token):
        return {
            "profile": {
                "user_id": "user-1",
                "email": "admin@example.test",
                "display_name": "Test Admin",
                "account_status": self.status,
            },
            "roles": self.roles,
            "permissions": self.permissions,
        }

    def get_master_data_categories(self, access_token):
        return self.master_data_categories

    def get_master_data_rows(self, access_token, category_key):
        self.dashboard_filter_rows_requested.append(category_key)
        if category_key in self.dashboard_filter_rows:
            return [dict(row) for row in self.dashboard_filter_rows[category_key]]
        if category_key != "product_standard":
            return []
        return [dict(self.master_data_row)]

    def get_master_data_row(self, access_token, row_id):
        assert row_id == self.master_data_row["id"]
        return dict(self.master_data_row)

    def get_master_data_revisions(self, access_token, row_id):
        return []

    def update_master_data_row(self, access_token, row_id, expected_version, changes, change_reason=None):
        self.master_data_updates.append((row_id, expected_version, dict(changes), change_reason))
        values = list(self.master_data_row["current_values"])
        for column, value in changes.items():
            index = 0
            for char in column:
                index = index * 26 + ord(char) - 64
            values[index - 1] = value
        self.master_data_row["current_values"] = values
        self.master_data_row["version"] = expected_version + 1
        return {
            "changed": True,
            "id": row_id,
            "category_key": self.master_data_row["category_key"],
            "source_row_number": self.master_data_row["source_row_number"],
            "version": expected_version + 1,
            "current_values": values,
            "updated_at": "2026-11-21T00:00:00+00:00",
        }

    def sign_out(self, access_token):
        self.sign_out_calls += 1


def build_app(gateway=None):
    settings = Settings(
        supabase_url="https://slfjqrkxnsgdaturaguw.supabase.co",
        publishable_key="sb_publishable_test",
        host="127.0.0.1",
        port=5100,
        idle_timeout_seconds=0,
    )
    return create_app(settings, gateway or FakeGateway(), SessionVault())


def test_health_endpoint_reports_tfi2():
    client = build_app().test_client()
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.get_json()["database_project"] == "TFI2"


def test_dashboard_coverage_requires_dashboard_view_and_returns_tfi2_summary():
    gateway = FakeGateway()
    client = build_app(gateway).test_client()
    login = client.post(
        "/api/auth/login",
        json={"email": "admin@example.test", "password": "correct"},
        headers={"Origin": "http://localhost"},
    )
    assert login.status_code == 200
    response = client.get("/api/dashboard/coverage")
    assert response.status_code == 200
    payload = response.get_json()
    assert payload["source"] == "TFI2"
    assert payload["total_operational_records"] == 0
    assert payload["kpi_calculations_ready"] is False
    assert "dashboard.view" in gateway.dashboard_permissions_seen


def test_dashboard_coverage_denies_users_without_dashboard_view():
    gateway = FakeGateway(permissions=["master_data.view"])
    client = build_app(gateway).test_client()
    login = client.post(
        "/api/auth/login",
        json={"email": "admin@example.test", "password": "correct"},
        headers={"Origin": "http://localhost"},
    )
    assert login.status_code == 200
    response = client.get("/api/dashboard/coverage")
    assert response.status_code == 403
    assert response.get_json()["code"] == "dashboard_permission_denied"


def test_dashboard_filter_catalog_reads_source_aligned_kpi_setup_options():
    gateway = FakeGateway()
    client = build_app(gateway).test_client()
    login = client.post(
        "/api/auth/login",
        json={"email": "admin@example.test", "password": "correct"},
        headers={"Origin": "http://localhost"},
    )
    assert login.status_code == 200

    response = client.get("/api/dashboard/filter-catalog")

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["source"] == "TFI2"
    assert payload["status"] == "available"
    assert payload["options"] == {
        "year": ["2025", "2026", "2027", "2028"],
        "view": ["Daily", "Weekly", "Monthly"],
        "month": ["Jan", "Feb", "Mar"],
        "week": ["1", "2", "3"],
        "product_name": ["All", "Product One", "Product Two"],
        "product_code": ["All", "CODE-1", "CODE-2"],
        "machine": ["All", "Machine A", "Machine B"],
    }
    assert gateway.dashboard_filter_rows_requested == ["kpi_setup", "code_map"]


def test_dashboard_filter_catalog_hides_reference_lists_without_master_data_view():
    gateway = FakeGateway(permissions=["dashboard.view"])
    client = build_app(gateway).test_client()
    login = client.post(
        "/api/auth/login",
        json={"email": "admin@example.test", "password": "correct"},
        headers={"Origin": "http://localhost"},
    )
    assert login.status_code == 200

    response = client.get("/api/dashboard/filter-catalog")

    assert response.status_code == 200
    assert response.get_json()["status"] == "restricted"
    assert response.get_json()["options"] == {}
    assert gateway.dashboard_filter_rows_requested == []


def test_dashboard_analytics_uses_authenticated_tfi2_and_validated_filters():
    gateway = FakeGateway()
    client = build_app(gateway).test_client()
    login = client.post(
        "/api/auth/login",
        json={"email": "admin@example.test", "password": "correct"},
        headers={"Origin": "http://localhost"},
    )
    assert login.status_code == 200
    response = client.get(
        "/api/dashboard/analytics?date_from=2026-11-01&date_to=2026-11-22&product_code=MDP-100-155&product_name=DPGP&machine=Filler"
    )
    assert response.status_code == 200
    payload = response.get_json()
    assert payload["source"] == "TFI2"
    assert payload["calculation_contract"] == "source-workbook-2026-11-22-v1"
    assert payload["reports"]["product_entry_summary"]["status"] == "restricted"
    assert gateway.dashboard_analytics_filters == {
        "date_from": "2026-11-01",
        "date_to": "2026-11-22",
        "product_code": "MDP-100-155",
        "product_name": "DPGP",
        "machine": "Filler",
    }


def test_dashboard_analytics_rejects_invalid_date_range():
    client = build_app().test_client()
    login = client.post(
        "/api/auth/login",
        json={"email": "admin@example.test", "password": "correct"},
        headers={"Origin": "http://localhost"},
    )
    assert login.status_code == 200
    response = client.get("/api/dashboard/analytics?date_from=2026-11-23&date_to=2026-11-01")
    assert response.status_code == 400
    assert response.get_json()["code"] == "dashboard_date_range_invalid"


def test_dashboard_analytics_denies_users_without_dashboard_permission():
    client = build_app(FakeGateway(permissions=["master_data.view"])).test_client()
    login = client.post(
        "/api/auth/login",
        json={"email": "admin@example.test", "password": "correct"},
        headers={"Origin": "http://localhost"},
    )
    assert login.status_code == 200
    response = client.get("/api/dashboard/analytics")
    assert response.status_code == 403
    assert response.get_json()["code"] == "dashboard_permission_denied"


def test_login_creates_httponly_same_site_cookie():
    client = build_app().test_client()
    response = client.post(
        "/api/auth/login",
        json={"email": "admin@example.test", "password": "correct"},
        headers={"Origin": "http://localhost"},
    )
    assert response.status_code == 200
    cookie = response.headers.get("Set-Cookie", "")
    assert "tfi_sid=" in cookie
    assert "HttpOnly" in cookie
    assert "SameSite=Strict" in cookie
    assert "access" not in cookie
    assert response.get_json()["profile"]["account_status"] == "active"


def test_pending_account_cannot_enter():
    client = build_app(FakeGateway(status="pending")).test_client()
    response = client.post(
        "/api/auth/login",
        json={"email": "pending@example.test", "password": "correct"},
        headers={"Origin": "http://localhost"},
    )
    assert response.status_code == 403
    assert response.get_json()["code"] == "account_pending"
    assert "Set-Cookie" not in response.headers


def test_account_without_role_cannot_enter():
    client = build_app(FakeGateway(roles=[])).test_client()
    response = client.post(
        "/api/auth/login",
        json={"email": "admin@example.test", "password": "correct"},
        headers={"Origin": "http://localhost"},
    )
    assert response.status_code == 403
    assert response.get_json()["code"] == "access_not_provisioned"


def test_module_pages_redirect_without_session():
    client = build_app().test_client()
    response = client.get("/design/dashboard-preview.html")
    assert response.status_code == 302
    assert response.headers["Location"].endswith("/design/admin-login-preview.html")


def test_login_page_is_available_without_session():
    client = build_app().test_client()
    response = client.get("/design/admin-login-preview.html")
    assert response.status_code == 200
    assert b"Work email" in response.data


def test_successful_session_can_open_dashboard():
    client = build_app().test_client()
    login = client.post(
        "/api/auth/login",
        json={"email": "admin@example.test", "password": "correct"},
        headers={"Origin": "http://localhost"},
    )
    assert login.status_code == 200
    dashboard = client.get("/design/dashboard-preview.html")
    assert dashboard.status_code == 200
    assert b"TFI | KPI Dashboard" in dashboard.data


def test_cross_origin_write_is_blocked():
    client = build_app().test_client()
    response = client.post(
        "/api/auth/login",
        json={"email": "admin@example.test", "password": "correct"},
        headers={"Origin": "https://evil.example"},
    )
    assert response.status_code == 403


def test_logout_clears_local_cookie():
    gateway = FakeGateway()
    client = build_app(gateway).test_client()
    client.post(
        "/api/auth/login",
        json={"email": "admin@example.test", "password": "correct"},
        headers={"Origin": "http://localhost"},
    )
    response = client.post("/api/auth/logout", headers={"Origin": "http://localhost"})
    assert response.status_code == 200
    assert "tfi_sid=;" in response.headers.get("Set-Cookie", "")
    assert gateway.sign_out_calls == 1


def test_password_recovery_request_uses_fixed_local_callback():
    gateway = FakeGateway()
    client = build_app(gateway).test_client()
    response = client.post(
        "/api/auth/recover",
        json={"email": "admin@example.test"},
        headers={"Origin": "http://localhost"},
    )
    assert response.status_code == 200
    assert response.get_json()["message"].startswith("If an active TFI account")
    assert gateway.recovery_redirects == [
        ("admin@example.test", "http://127.0.0.1:5100/auth/recovery")
    ]


def test_recovery_callback_is_public():
    response = build_app().test_client().get("/auth/recovery")
    assert response.status_code == 200
    assert b"Choose a new password" in response.data


def test_recovery_token_is_exchanged_for_httponly_cookie():
    client = build_app().test_client()
    response = client.post(
        "/api/auth/recovery/consume",
        json={"access_token": "recovery-access-token", "type": "recovery"},
        headers={"Origin": "http://localhost"},
    )
    assert response.status_code == 200
    cookie = response.headers.get("Set-Cookie", "")
    assert "tfi_recovery=" in cookie
    assert "HttpOnly" in cookie
    assert "SameSite=Strict" in cookie
    assert "recovery-access-token" not in cookie
    assert response.get_json()["email"] == "admin@example.test"


def test_recovery_rejects_wrong_flow_type():
    client = build_app().test_client()
    response = client.post(
        "/api/auth/recovery/consume",
        json={"access_token": "recovery-access-token", "type": "invite"},
        headers={"Origin": "http://localhost"},
    )
    assert response.status_code == 400
    assert response.get_json()["code"] == "recovery_invalid"


def test_password_update_requires_twelve_characters():
    gateway = FakeGateway()
    client = build_app(gateway).test_client()
    client.post(
        "/api/auth/recovery/consume",
        json={"access_token": "recovery-access-token", "type": "recovery"},
        headers={"Origin": "http://localhost"},
    )
    response = client.post(
        "/api/auth/recovery/update",
        json={"new_password": "short"},
        headers={"Origin": "http://localhost"},
    )
    assert response.status_code == 400
    assert response.get_json()["code"] == "password_policy"
    assert gateway.password_updates == []


def test_password_update_uses_server_side_recovery_session():
    gateway = FakeGateway()
    client = build_app(gateway).test_client()
    client.post(
        "/api/auth/recovery/consume",
        json={"access_token": "recovery-access-token", "type": "recovery"},
        headers={"Origin": "http://localhost"},
    )
    response = client.post(
        "/api/auth/recovery/update",
        json={"new_password": "correct horse battery staple"},
        headers={"Origin": "http://localhost"},
    )
    assert response.status_code == 200
    assert response.get_json()["password_updated"] is True
    assert gateway.password_updates == [("recovery-access-token", "correct horse battery staple")]
    assert "tfi_recovery=;" in response.headers.get("Set-Cookie", "")
    assert gateway.sign_out_calls == 1



def authenticated_client(gateway=None):
    gateway = gateway or FakeGateway()
    client = build_app(gateway).test_client()
    response = client.post(
        "/api/auth/login",
        json={"email": "admin@example.test", "password": "correct"},
        headers={"Origin": "http://localhost"},
    )
    assert response.status_code == 200
    return client, gateway


def test_master_data_categories_requires_view_permission_and_returns_database_rows():
    client, _ = authenticated_client()
    response = client.get("/api/master-data/categories")
    assert response.status_code == 200
    payload = response.get_json()
    assert payload["permissions"] == {"view": True, "edit": True}
    assert payload["categories"][0]["category_key"] == "product_standard"


def test_master_data_categories_rejects_user_without_view_permission():
    client, _ = authenticated_client(FakeGateway(permissions=["dashboard.view"]))
    response = client.get("/api/master-data/categories")
    assert response.status_code == 403
    assert response.get_json()["code"] == "master_data_permission_denied"


def test_master_data_rows_are_paginated_and_category_scoped():
    client, _ = authenticated_client()
    response = client.get("/api/master-data/product_standard/rows?page=1&page_size=10")
    assert response.status_code == 200
    payload = response.get_json()
    assert payload["category_key"] == "product_standard"
    assert payload["total"] == 1
    assert payload["rows"][0]["source_row_number"] == 3
    assert payload["rows"][0]["current_values"][1] == "Old Product Name"


def test_master_data_rows_reject_unknown_category():
    client, _ = authenticated_client()
    response = client.get("/api/master-data/unknown_category/rows")
    assert response.status_code == 404
    assert response.get_json()["code"] == "invalid_category"


def test_master_data_edit_saves_only_allowed_fields_and_returns_new_version():
    client, gateway = authenticated_client()
    response = client.patch(
        "/api/master-data/rows/00000000-0000-0000-0000-000000000001",
        json={
            "expected_version": 1,
            "changes": {"B": "New Product Name"},
            "change_reason": "Verified product-name correction",
        },
        headers={"Origin": "http://localhost"},
    )
    assert response.status_code == 200
    payload = response.get_json()
    assert payload["changed"] is True
    assert payload["version"] == 2
    assert payload["current_values"][1] == "New Product Name"
    assert gateway.master_data_updates == [(
        "00000000-0000-0000-0000-000000000001",
        1,
        {"B": "New Product Name"},
        "Verified product-name correction",
    )]


def test_master_data_edit_rejects_protected_source_key_before_rpc():
    client, gateway = authenticated_client()
    response = client.patch(
        "/api/master-data/rows/00000000-0000-0000-0000-000000000001",
        json={"expected_version": 1, "changes": {"A": "NEW-CODE"}},
        headers={"Origin": "http://localhost"},
    )
    assert response.status_code == 400
    assert "protected" in response.get_json()["error"]
    assert gateway.master_data_updates == []


def test_master_data_edit_requires_edit_permission():
    client, gateway = authenticated_client(FakeGateway(permissions=["dashboard.view", "master_data.view"]))
    response = client.patch(
        "/api/master-data/rows/00000000-0000-0000-0000-000000000001",
        json={"expected_version": 1, "changes": {"B": "New Product Name"}},
        headers={"Origin": "http://localhost"},
    )
    assert response.status_code == 403
    assert response.get_json()["code"] == "master_data_permission_denied"
    assert gateway.master_data_updates == []


def test_master_data_edit_requires_expected_version_and_same_origin():
    client, gateway = authenticated_client()
    response = client.patch(
        "/api/master-data/rows/00000000-0000-0000-0000-000000000001",
        json={"changes": {"B": "New Product Name"}},
        headers={"Origin": "http://localhost"},
    )
    assert response.status_code == 400
    assert response.get_json()["code"] == "expected_version_required"
    assert gateway.master_data_updates == []


def test_master_data_revision_history_requires_view_permission():
    client, gateway = authenticated_client()
    response = client.get("/api/master-data/rows/00000000-0000-0000-0000-000000000001/revisions")
    assert response.status_code == 200
    assert response.get_json() == {
        "row_id": "00000000-0000-0000-0000-000000000001",
        "revisions": [],
    }


class FakeGoogleOAuthCallback:
    def __init__(self):
        self.calls = []

    def complete_authorization_for_state(self, state, code):
        self.calls.append((state, code))
        return {"connected": True}


def test_google_oauth_callback_uses_one_time_state_without_strict_login_cookie():
    settings = Settings(
        supabase_url="https://slfjqrkxnsgdaturaguw.supabase.co",
        publishable_key="sb_publishable_test",
        host="127.0.0.1",
        port=5100,
        idle_timeout_seconds=0,
    )
    google = FakeGoogleOAuthCallback()
    app = create_app(
        settings,
        FakeGateway(permissions=["import.view"]),
        SessionVault(),
        google_sheets=google,
    )
    response = app.test_client().get(
        "/api/google-sheets/callback?state=one-time-state&code=google-code"
    )
    assert response.status_code == 302
    assert response.headers["Location"].endswith(
        "/design/spreadsheet-import-center-preview.html?googleConnected=1"
    )
    assert google.calls == [("one-time-state", "google-code")]
