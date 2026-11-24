from __future__ import annotations

from concurrent.futures import Future
from io import BytesIO
import uuid
from urllib.parse import parse_qs, urlparse

from openpyxl import Workbook

from tfi_backend.app import create_app
from tfi_backend.config import Settings
from tfi_backend.import_service import ImportScanError, iter_xlsx_import_rows, scan_file_sha256
from tfi_backend.google_sheets import GoogleSheetsError, GoogleSheetsService, parse_google_spreadsheet_id
from tfi_backend.session_store import SessionVault


def make_workbook(sheet_name="Product Entry"):
    workbook = Workbook()
    worksheet = workbook.active
    worksheet.title = sheet_name
    worksheet["A7"] = "Product Code"
    worksheet["B7"] = "Product Name"
    worksheet["C7"] = "Calculated"
    worksheet["A8"] = "DPGP"
    worksheet["B8"] = "Green Peas"
    worksheet["C8"] = "=1+2"
    worksheet["D8"] = "Trace"
    worksheet["C9"] = "=SUM(1,2)"
    worksheet["D10"] = "helper-only"
    worksheet["A12"] = "#DIV/0!"
    worksheet["A12"].data_type = "e"
    other = workbook.create_sheet("Other")
    other["A1"] = "Must not be scanned"
    buffer = BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()


def destination(sheet_name="Product Entry"):
    return {
        "module_key": "product_entry",
        "source_sheet_id": 545274882,
        "source_sheet_title": sheet_name,
        "grid_rows": 50,
        "grid_columns": 4,
        "header_rows": [7],
        "first_data_row": 8,
        "source_kind": "transaction",
        "contract_status": "raw_capture_only",
        "required_columns": [],
        "input_columns": ["A", "B"],
        "formula_columns": ["C"],
    }


def test_scanner_reads_only_the_registered_worksheet_and_preserves_formulas():
    stats = {}
    rows = list(iter_xlsx_import_rows(make_workbook(), destination(), stats))

    assert [row["source_row_number"] for row in rows] == [8, 9, 10, 12]
    assert rows[0]["classification"] == "operational"
    assert rows[0]["source_formulas"] == {"C": "=1+2"}
    assert rows[0]["source_values"] == ["DPGP", "Green Peas", "=1+2", "Trace"]
    assert rows[0]["completeness_status"] == "unassessed"
    assert rows[1]["classification"] == "derived"
    assert rows[2]["classification"] == "helper"
    assert rows[3]["classification"] == "invalid"
    assert stats == {
        "rows_inspected": 5,
        "blank_rows": 1,
        "formula_cells": 2,
        "derived_rows": 1,
        "unmapped_rows": 1,
        "rows_staged": 0,
    }


def test_scanner_rejects_a_workbook_without_the_approved_sheet():
    stats = {}
    try:
        list(iter_xlsx_import_rows(make_workbook("Wrong Sheet"), destination(), stats))
    except ImportScanError as error:
        assert "Product Entry" in str(error)
    else:
        raise AssertionError("A workbook without the mapped worksheet must be rejected.")


def test_scanner_rejects_non_xlsx_bytes():
    try:
        list(iter_xlsx_import_rows(b"not an xlsx", destination(), {}))
    except ImportScanError as error:
        assert ".xlsx" in str(error)
    else:
        raise AssertionError("Invalid file bytes must be rejected.")


def test_file_hash_is_stable():
    content = make_workbook()
    assert scan_file_sha256(content) == scan_file_sha256(content)


def test_google_sheet_scanner_preserves_formulas_and_source_row_numbers():
    class Response:
        status_code = 200

        def __init__(self, payload):
            self.payload = payload

        def json(self):
            return self.payload

    class Http:
        def get(self, url, params=None, headers=None, timeout=None):
            assert "spreadsheets/" in url
            assert params["includeGridData"] == "true"
            assert "'Product Entry'!A8:D12" == params["ranges"]

            def cell(value=None, formula=None, error=False):
                entered = {}
                if formula is not None:
                    entered["formulaValue"] = formula
                elif value is not None:
                    entered["stringValue"] = value
                result = {"userEnteredValue": entered}
                if error:
                    result["effectiveValue"] = {"errorValue": {"type": "DIVIDE_BY_ZERO", "message": "#DIV/0!"}}
                return result

            row_data = [
                {"values": [cell("DPGP"), cell("Green Peas"), cell(formula="=1+2"), cell("Trace")]},
                {"values": [cell(), cell(), cell(formula="=SUM(1,2)"), cell()]},
                {"values": [cell(), cell(), cell(), cell("helper-only")]},
                {"values": []},
                {"values": [cell("#DIV/0!", error=True), cell(), cell(), cell()]},
            ]
            return Response({
                "sheets": [{
                    "properties": {"sheetId": 545274882, "title": "Product Entry"},
                    "data": [{"startRow": 7, "rowData": row_data}],
                }]
            })

    class MemoryStore:
        def get(self, user_id):
            return None

        def put(self, user_id, value):
            pass

        def delete(self, user_id):
            pass

    service = GoogleSheetsService(
        "test-client",
        "test-secret",
        "http://127.0.0.1:5100/api/google-sheets/callback",
        connection_store=MemoryStore(),
        http=Http(),
        sleeper=lambda _seconds: None,
    )
    source = destination()
    source["grid_rows"] = 12
    stats = {}
    rows = list(service.iter_import_rows("google-token", "1" * 44, source, stats))

    assert [row["source_row_number"] for row in rows] == [8, 9, 10, 12]
    assert rows[0]["classification"] == "operational"
    assert rows[0]["source_formulas"] == {"C": "=1+2"}
    assert rows[0]["source_values"] == ["DPGP", "Green Peas", "=1+2", "Trace"]
    assert rows[1]["classification"] == "derived"
    assert rows[2]["classification"] == "helper"
    assert rows[3]["classification"] == "invalid"
    assert stats == {
        "rows_inspected": 5,
        "blank_rows": 1,
        "formula_cells": 2,
        "derived_rows": 1,
        "unmapped_rows": 1,
        "rows_staged": 0,
    }


def test_google_spreadsheet_url_parser_accepts_only_google_sheets_links():
    assert parse_google_spreadsheet_id(
        "https://docs.google.com/spreadsheets/d/" + "A" * 44 + "/edit#gid=123"
    ) == "A" * 44
    assert parse_google_spreadsheet_id(
        "https://docs.google.com/spreadsheets/u/0/d/" + "B" * 44 + "/edit"
    ) == "B" * 44
    try:
        parse_google_spreadsheet_id("https://drive.google.com/open?id=" + "A" * 44)
    except GoogleSheetsError as error:
        assert error.code == "invalid_google_sheets_url"
    else:
        raise AssertionError("Non-canonical Google Sheets links must be rejected.")


def test_google_oauth_uses_pkce_binds_state_and_persists_only_refresh_token():
    class Response:
        status_code = 200

        def __init__(self, payload):
            self.payload = payload

        def json(self):
            return self.payload

    class Http:
        def post(self, url, data=None, timeout=None):
            assert data["grant_type"] == "authorization_code"
            assert data["code_verifier"]
            return Response({
                "access_token": "google-access",
                "refresh_token": "google-refresh",
                "expires_in": 3600,
            })

        def get(self, url, headers=None, timeout=None):
            assert headers["Authorization"] == "Bearer google-access"
            return Response({"email": "owner@example.test", "email_verified": True})

    class MemoryStore:
        def __init__(self):
            self.connections = {}

        def get(self, user_id):
            value = self.connections.get(user_id)
            return dict(value) if value else None

        def put(self, user_id, value):
            self.connections[user_id] = dict(value)

        def delete(self, user_id):
            self.connections.pop(user_id, None)

    store = MemoryStore()
    service = GoogleSheetsService(
        "test-client-id",
        "test-client-secret",
        "http://127.0.0.1:5100/api/google-sheets/callback",
        connection_store=store,
        http=Http(),
        clock=lambda: 1_800_000_000,
    )
    authorization_url = service.start_authorization("tfi-user-1")
    params = parse_qs(urlparse(authorization_url).query)
    assert params["code_challenge_method"] == ["S256"]
    assert params["access_type"] == ["offline"]
    assert params["scope"] == ["openid email https://www.googleapis.com/auth/spreadsheets.readonly"]

    connected = service.complete_authorization("tfi-user-1", params["state"][0], "one-time-code")
    assert connected["connected"] is True
    assert connected["email"] == "owner@example.test"
    assert store.connections["tfi-user-1"]["refresh_token"] == "google-refresh"
    assert "access_token" not in store.connections["tfi-user-1"]
    assert service.get_access_token("tfi-user-1") == "google-access"


class FakeGateway:
    def __init__(self, permissions=None, include_sheet=True):
        self.permissions = permissions or [
            "spreadsheet_import.view",
            "spreadsheet_import.create",
            "spreadsheet_import.review",
            "spreadsheet_import.import",
            "duplicate_review.review",
            "import_confirmation.import",
            "product_entry.import",
            "product_entry.review",
        ]
        self.include_sheet = include_sheet
        self.destination = destination()
        self.batch = None
        self.staged = []
        self.failures = []
        self.decisions = []
        self.finalized = []
        self.next_row_id = 1

    def sign_in_with_password(self, email, password):
        import time
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
                "account_status": "active",
            },
            "roles": [{"role_key": "system_admin"}],
            "permissions": list(self.permissions),
        }

    def refresh_session(self, refresh_token):
        import time
        return {
            "user_id": "user-1",
            "email": "admin@example.test",
            "access_token": "access-refreshed",
            "refresh_token": "refresh",
            "expires_at": time.time() + 3600,
        }

    def sign_out(self, access_token):
        return None

    def get_import_destinations(self, access_token):
        return [self.destination] if self.include_sheet else []

    def get_import_destination(self, access_token, module_key):
        if module_key != self.destination.get("module_key") or not self.include_sheet:
            from tfi_backend.supabase_gateway import SupabaseError
            raise SupabaseError("Import destination not available.", 403, "import_destination_not_allowed")
        return dict(self.destination)

    def create_import_batch(self, access_token, **kwargs):
        self.created_kwargs = kwargs
        self.batch = {
            "id": "00000000-0000-0000-0000-000000000101",
            "batch_ref": "TFI-IMP-TEST-0001",
            "module_key": kwargs["module_key"],
            "status": "scanning",
            "source_type": kwargs.get("source_type", "xlsx"),
            "source_spreadsheet_id": kwargs.get("source_spreadsheet_id"),
            "source_sheet_id": kwargs["source_sheet_id"],
            "source_sheet_title": "Product Entry",
        }
        return dict(self.batch)

    def stage_import_rows(self, access_token, batch_id, rows, module_key=None):
        self.staged_module_key = module_key
        for row in rows:
            staged = dict(row)
            staged["id"] = str(uuid.UUID(int=self.next_row_id))
            self.next_row_id += 1
            self.staged.append(staged)
        return {"batch_id": batch_id, "rows_staged": len(self.staged)}

    def complete_import_scan(self, access_token, batch_id, stats):
        self.batch.update(status="review", **stats, rows_staged=len(self.staged))
        return dict(self.batch)

    def fail_import_batch(self, access_token, batch_id, message):
        self.failures.append(message)
        self.batch.update(status="failed", error_message=message)
        return dict(self.batch)

    def get_import_batch(self, access_token, batch_id):
        return dict(self.batch) if self.batch and self.batch["id"] == batch_id else None

    def get_import_rows(self, access_token, batch_id, **kwargs):
        rows = list(self.staged)
        row_ids = kwargs.get("row_ids")
        if row_ids:
            rows = [row for row in rows if row.get("id") in row_ids]
        offset = int(kwargs.get("offset", 0))
        limit = int(kwargs.get("limit", 100))
        return rows[offset:offset + limit]

    def set_import_row_decision(self, access_token, batch_id, row_id, decision, reason=None):
        row = next(item for item in self.staged if item.get("id") == row_id)
        row["review_decision"] = decision
        row["review_reason"] = reason
        row["duplicate_status"] = {"import_as_new": "distinct_new", "skip_duplicate": "confirmed_duplicate"}.get(decision, row.get("duplicate_status"))
        row["import_status"] = {"import_as_new": "pending", "skip_duplicate": "skipped_existing", "hold": "held"}[decision]
        result = {"id": row_id, "review_decision": decision, "review_reason": reason, "duplicate_status": row["duplicate_status"], "import_status": row["import_status"]}
        self.decisions.append(result)
        return result

    def finalize_coding_dpr_import(self, access_token, batch_id, row_ids):
        self.coding_dpr_finalized = (batch_id, list(row_ids))
        return {"id": batch_id, "status": "completed", "rows_inserted": len(row_ids),
                "rows_incomplete": 1, "rows_duplicates": 0, "rows_held": 0,
                "rows_failed": 0, "rows_pending": 0}

    def finalize_import_batch(self, access_token, batch_id, row_ids):
        selected = [row for row in self.staged if row.get("id") in row_ids]
        inserted = 0
        for row in selected:
            if row.get("classification") == "operational" and row.get("import_status") == "pending":
                row["import_status"] = "inserted"
                inserted += 1
            elif row.get("classification") != "operational":
                row["import_status"] = "excluded"
        result = {"id": batch_id, "status": "completed", "rows_inserted": inserted, "rows_incomplete": 0, "rows_duplicates": sum(row.get("import_status") == "skipped_existing" for row in selected), "rows_held": sum(row.get("import_status") == "held" for row in selected), "rows_failed": 0, "rows_pending": sum(row.get("import_status") == "pending" for row in self.staged)}
        self.finalized.append(result)
        self.batch.update(status=result["status"], rows_inserted=result["rows_inserted"])
        return result

    def save_all_dmp_import_batch(self, access_token, batch_id):
        self.dmp_save_all_called = batch_id
        return {
            "id": batch_id, "status": "completed", "rows_inserted": 0,
            "rows_incomplete": 0, "rows_duplicates": 0, "rows_held": 0,
            "rows_failed": 0, "rows_pending": 0,
        }

    def get_import_batches(self, access_token, module_key=None, limit=100):
        return [dict(self.batch)] if self.batch else []


class FakeGoogleSheets:
    def __init__(self, sheet_id=545274882, title="Product Entry", configured=True, connected=True):
        self.sheet_id = sheet_id
        self.title = title
        self.configured = configured
        self.connected = connected
        self.authorized_user = None
        self.metadata_calls = []

    def status(self, user_id):
        return {
            "configured": self.configured,
            "connected": self.connected,
            "email": "tfi-import@example.test" if self.connected else None,
            "redirect_uri": "http://127.0.0.1:5100/api/google-sheets/callback",
        }

    def start_authorization(self, user_id):
        self.authorized_user = user_id
        if not self.configured:
            raise GoogleSheetsError("Google OAuth is not configured.", 503, "google_oauth_not_configured")
        return "https://accounts.google.com/o/oauth2/v2/auth?state=fake-state"

    def complete_authorization_for_state(self, state, code):
        if not self.authorized_user:
            raise GoogleSheetsError("Invalid OAuth state.", 400, "google_oauth_state_invalid")
        return self.complete_authorization(self.authorized_user, state, code)

    def complete_authorization(self, user_id, state, code):
        if state != "fake-state" or code != "fake-code":
            raise GoogleSheetsError("Invalid OAuth state.", 400, "google_oauth_state_invalid")
        self.connected = True
        self.authorized_user = user_id
        return self.status(user_id)

    def disconnect(self, user_id):
        self.connected = False
        return self.status(user_id)

    def get_access_token(self, user_id):
        if not self.connected:
            raise GoogleSheetsError("Connect Google first.", 409, "google_account_not_connected")
        self.authorized_user = user_id
        return "google-access-token"

    def get_spreadsheet_metadata(self, access_token, spreadsheet_id):
        self.metadata_calls.append((access_token, spreadsheet_id))
        return {
            "spreadsheet_id": spreadsheet_id,
            "title": "Client TFI Workbook",
            "sheets": [
                {
                    "sheet_id": self.sheet_id,
                    "title": self.title,
                    "row_count": 50,
                    "column_count": 4,
                },
                {
                    "sheet_id": 999999,
                    "title": "Other",
                    "row_count": 10,
                    "column_count": 2,
                },
            ],
        }

    def verify_import_header(self, access_token, spreadsheet_id, title, row_count, module_key):
        assert title == self.title
        assert module_key == "product_entry"
        return 8

    def iter_import_rows(self, access_token, spreadsheet_id, destination, stats):
        yield from iter_xlsx_import_rows(make_workbook(), destination, stats)


class InlineExecutor:
    def submit(self, function, *args, **kwargs):
        future = Future()
        try:
            future.set_result(function(*args, **kwargs))
        except Exception as error:
            future.set_exception(error)
        return future


def build_import_app(gateway=None, google_sheets=None):
    settings = Settings(
        supabase_url="https://slfjqrkxnsgdaturaguw.supabase.co",
        publishable_key="sb_publishable_test",
        host="127.0.0.1",
        port=5100,
        idle_timeout_seconds=0,
        google_client_id="test-google-client",
        google_client_secret="test-google-secret",
    )
    gateway = gateway or FakeGateway()
    google_sheets = google_sheets or FakeGoogleSheets()
    app = create_app(settings, gateway, SessionVault(), InlineExecutor(), google_sheets)
    return app, gateway


def login(client):
    return client.post(
        "/api/auth/login",
        json={"email": "admin@example.test", "password": "correct"},
        headers={"Origin": "http://localhost"},
    )


def test_upload_creates_a_batch_and_stages_only_the_mapped_sheet():
    app, gateway = build_import_app()
    client = app.test_client()
    assert login(client).status_code == 200

    response = client.post(
        "/api/import/batches",
        data={
            "module_key": "product_entry",
            "file": (BytesIO(make_workbook()), "production-source.xlsx"),
        },
        content_type="multipart/form-data",
        headers={"Origin": "http://localhost"},
    )
    assert response.status_code == 202
    assert response.get_json()["batch"]["status"] == "scanning"
    assert gateway.created_kwargs["source_sheet_id"] == 545274882
    assert gateway.created_kwargs["source_name"] == "production-source.xlsx"
    assert gateway.created_kwargs["source_workbook_key"].startswith("sha256:")
    assert [row["source_row_number"] for row in gateway.staged] == [8, 9, 10, 12]
    assert gateway.batch["status"] == "review"
    assert gateway.batch["rows_staged"] == 4

    batch_id = response.get_json()["batch"]["id"]
    detail = client.get(f"/api/import/batches/{batch_id}")
    assert detail.status_code == 200
    assert detail.get_json()["batch"]["status"] == "review"

    rows = client.get(f"/api/import/batches/{batch_id}/rows")
    assert rows.status_code == 200
    assert len(rows.get_json()["rows"]) == 4


def test_import_upload_requires_module_permission():
    gateway = FakeGateway(permissions=["spreadsheet_import.view", "spreadsheet_import.create"])
    app, _ = build_import_app(gateway)
    client = app.test_client()
    assert login(client).status_code == 200

    response = client.post(
        "/api/import/batches",
        data={
            "module_key": "product_entry",
            "file": (BytesIO(make_workbook()), "source.xlsx"),
        },
        content_type="multipart/form-data",
        headers={"Origin": "http://localhost"},
    )
    assert response.status_code == 403
    assert response.get_json()["code"] == "import_permission_denied"


def test_google_sheets_link_starts_selective_scan_and_stages_approved_sheet():
    app, gateway = build_import_app()
    client = app.test_client()
    assert login(client).status_code == 200
    spreadsheet_id = "1" * 44

    response = client.post(
        "/api/import/batches",
        json={
            "module_key": "product_entry",
            "source_type": "google_sheets",
            "spreadsheet_url": f"https://docs.google.com/spreadsheets/d/{spreadsheet_id}/edit",
        },
        headers={"Origin": "http://localhost"},
    )
    assert response.status_code == 202
    assert response.get_json()["source"]["type"] == "google_sheets"
    assert response.get_json()["source"]["sheet_count"] == 2
    assert gateway.created_kwargs["source_type"] == "google_sheets"
    assert gateway.created_kwargs["source_spreadsheet_id"] == spreadsheet_id
    assert gateway.created_kwargs["source_file_sha256"] is None
    assert gateway.created_kwargs["source_file_size"] is None
    assert gateway.created_kwargs["source_workbook_key"] == f"google:{spreadsheet_id}"
    assert [row["source_row_number"] for row in gateway.staged] == [8, 9, 10, 12]
    assert gateway.batch["status"] == "review"


def test_google_sheets_link_requires_a_canonical_google_url():
    app, gateway = build_import_app()
    client = app.test_client()
    assert login(client).status_code == 200
    response = client.post(
        "/api/import/batches",
        json={
            "module_key": "product_entry",
            "source_type": "google_sheets",
            "spreadsheet_url": "https://example.com/spreadsheets/d/not-a-google-sheet",
        },
        headers={"Origin": "http://localhost"},
    )
    assert response.status_code == 400
    assert response.get_json()["code"] == "invalid_google_sheets_url"
    assert gateway.batch is None


def test_google_sheets_requires_the_approved_worksheet_id_and_title():
    google = FakeGoogleSheets(sheet_id=123456, title="Product Entry")
    app, gateway = build_import_app(google_sheets=google)
    client = app.test_client()
    assert login(client).status_code == 200
    spreadsheet_id = "2" * 44
    response = client.post(
        "/api/import/batches",
        json={
            "module_key": "product_entry",
            "source_type": "google_sheets",
            "spreadsheet_url": f"https://docs.google.com/spreadsheets/d/{spreadsheet_id}/edit",
        },
        headers={"Origin": "http://localhost"},
    )
    assert response.status_code == 409
    assert response.get_json()["code"] == "google_sheet_id_mismatch"
    assert gateway.batch is None


def test_google_sheets_connection_status_and_oauth_routes_are_account_scoped():
    google = FakeGoogleSheets(connected=False)
    app, _gateway = build_import_app(google_sheets=google)
    client = app.test_client()
    assert login(client).status_code == 200

    status = client.get("/api/google-sheets/status")
    assert status.status_code == 200
    assert status.get_json()["configured"] is True
    assert status.get_json()["connected"] is False

    connect = client.get("/api/google-sheets/connect")
    assert connect.status_code == 302
    assert connect.headers["Location"].startswith("https://accounts.google.com/")
    assert google.authorized_user == "user-1"


def test_google_sheets_import_requires_an_authorized_google_account():
    google = FakeGoogleSheets(connected=False)
    app, gateway = build_import_app(google_sheets=google)
    client = app.test_client()
    assert login(client).status_code == 200
    spreadsheet_id = "3" * 44
    response = client.post(
        "/api/import/batches",
        json={
            "module_key": "product_entry",
            "source_type": "google_sheets",
            "spreadsheet_url": f"https://docs.google.com/spreadsheets/d/{spreadsheet_id}/edit",
        },
        headers={"Origin": "http://localhost"},
    )
    assert response.status_code == 409
    assert response.get_json()["code"] == "google_account_not_connected"
    assert gateway.batch is None


def test_google_oauth_callback_returns_to_import_center_after_authorization():
    google = FakeGoogleSheets(connected=False)
    app, _gateway = build_import_app(google_sheets=google)
    client = app.test_client()
    assert login(client).status_code == 200
    connect = client.get("/api/google-sheets/connect")
    assert connect.status_code == 302
    response = client.get(
        "/api/google-sheets/callback?state=fake-state&code=fake-code"
    )
    assert response.status_code == 302
    assert response.headers["Location"].endswith("?googleConnected=1")
    assert google.connected is True
    assert google.authorized_user == "user-1"


def test_upload_rejects_a_non_xlsx_filename():
    app, _gateway = build_import_app()
    client = app.test_client()
    assert login(client).status_code == 200
    response = client.post(
        "/api/import/batches",
        data={
            "module_key": "product_entry",
            "file": (BytesIO(make_workbook()), "source.csv"),
        },
        content_type="multipart/form-data",
        headers={"Origin": "http://localhost"},
    )
    assert response.status_code == 400
    assert response.get_json()["code"] == "import_xlsx_only"


def upload_test_batch(client, gateway):
    response = client.post(
        "/api/import/batches",
        data={
            "module_key": "product_entry",
            "file": (BytesIO(make_workbook()), "decision-source.xlsx"),
        },
        content_type="multipart/form-data",
        headers={"Origin": "http://localhost"},
    )
    assert response.status_code == 202
    assert gateway.batch["status"] == "review"
    return gateway.batch["id"]


def test_product_entry_review_only_batch_cannot_be_finalized():
    app, gateway = build_import_app()
    client = app.test_client()
    assert login(client).status_code == 200
    batch_id = upload_test_batch(client, gateway)

    response = client.post(
        f"/api/import/batches/{batch_id}/finalize",
        json={"row_ids": [gateway.staged[0]["id"]]},
        headers={"Origin": "http://localhost"},
    )
    assert response.status_code == 409
    assert response.get_json()["code"] == "product_entry_import_review_only"


def test_raw_capture_only_destinations_are_blocked_before_final_approval():
    for module_key, sheet_title in (
        ("nonprod", "NON-PROD"),
        ("pr_monitoring", "PR MONITORING"),
        ("productivity", "Productivity"),
        ("product_entry", "Product Entry"),
        ("production_entry", "Production Summary"),
    ):
        gateway = FakeGateway()
        if f"{module_key}.import" not in gateway.permissions:
            gateway.permissions.append(f"{module_key}.import")
        app, gateway = build_import_app(gateway)
        client = app.test_client()
        assert login(client).status_code == 200
        batch_id = upload_test_batch(client, gateway)
        gateway.destination.update(
            module_key=module_key,
            source_sheet_title=sheet_title,
            contract_status="raw_capture_only",
        )
        gateway.batch.update(module_key=module_key, source_sheet_title=sheet_title)

        response = client.post(
            f"/api/import/batches/{batch_id}/finalize",
            json={"row_ids": [gateway.staged[0]["id"]]},
            headers={"Origin": "http://localhost"},
        )
        assert response.status_code == 409, module_key
        assert response.get_json()["code"] in {
            "import_destination_review_only",
            "product_entry_import_review_only",
            "production_summary_import_review_only",
        }
        assert gateway.finalized == [], module_key


def test_pending_business_rule_destination_is_blocked_before_final_approval():
    gateway = FakeGateway()
    gateway.permissions.append("co_qa.import")
    app, gateway = build_import_app(gateway)
    client = app.test_client()
    assert login(client).status_code == 200
    batch_id = upload_test_batch(client, gateway)
    gateway.destination.update(
        module_key="co_qa",
        source_sheet_title="co QA",
        contract_status="hold_pending_business_rule",
    )
    gateway.batch.update(module_key="co_qa", source_sheet_title="co QA")

    response = client.post(
        f"/api/import/batches/{batch_id}/finalize",
        json={"row_ids": [gateway.staged[0]["id"]]},
        headers={"Origin": "http://localhost"},
    )
    assert response.status_code == 409
    assert response.get_json()["code"] == "import_mapping_pending_business_rule"
    assert gateway.finalized == []


def test_dmp_final_approval_uses_selected_rows_and_keeps_save_all_separate():
    gateway = FakeGateway()
    gateway.permissions.extend(["dmp_production.import", "dmp_production.create"])
    app, gateway = build_import_app(gateway)
    client = app.test_client()
    assert login(client).status_code == 200
    batch_id = upload_test_batch(client, gateway)
    gateway.destination.update(
        module_key="dmp_production",
        source_sheet_title="DMP - Production",
        contract_status="approved",
    )
    gateway.batch.update(module_key="dmp_production", source_sheet_title="DMP - Production")

    gateway.staged[0]["classification"] = "operational"
    gateway.staged[0]["import_status"] = "pending"
    second = dict(gateway.staged[0])
    second["id"] = str(uuid.UUID(int=99))
    second["source_row_number"] = 99
    gateway.staged.append(second)
    selected_id = gateway.staged[0]["id"]

    response = client.post(
        f"/api/import/batches/{batch_id}/finalize",
        json={"row_ids": [selected_id]},
        headers={"Origin": "http://localhost"},
    )
    assert response.status_code == 200
    assert gateway.finalized[-1]["rows_inserted"] == 1
    assert gateway.staged[0]["import_status"] == "inserted"
    assert gateway.staged[-1]["import_status"] == "pending"
    assert not hasattr(gateway, "dmp_save_all_called")


def test_dmp_save_all_endpoint_remains_a_separate_explicit_bulk_action():
    gateway = FakeGateway()
    gateway.permissions.extend(["dmp_production.import", "dmp_production.create"])
    app, gateway = build_import_app(gateway)
    client = app.test_client()
    assert login(client).status_code == 200
    batch_id = upload_test_batch(client, gateway)
    gateway.destination.update(
        module_key="dmp_production",
        source_sheet_title="DMP - Production",
        contract_status="approved",
    )
    gateway.batch.update(module_key="dmp_production", source_sheet_title="DMP - Production")

    response = client.post(
        f"/api/dmp-production/import-batches/{batch_id}/save-all",
        json={},
        headers={"Origin": "http://localhost"},
    )
    assert response.status_code == 200
    assert gateway.dmp_save_all_called == batch_id


def test_duplicate_review_and_finalization_routes_use_selected_rows():
    gateway = FakeGateway()
    gateway.destination["contract_status"] = "approved"
    app, gateway = build_import_app(gateway)
    client = app.test_client()
    assert login(client).status_code == 200
    batch_id = upload_test_batch(client, gateway)

    row = gateway.staged[0]
    row["duplicate_status"] = "possible_duplicate"
    row["import_status"] = "held"
    decision = client.post(
        f"/api/import/batches/{batch_id}/rows/{row['id']}/decision",
        json={
            "decision": "import_as_new",
            "reason": "Verified as a distinct incoming operational record.",
        },
        headers={"Origin": "http://localhost"},
    )
    assert decision.status_code == 200
    assert decision.get_json()["duplicate_status"] == "distinct_new"
    assert row["import_status"] == "pending"

    finalized = client.post(
        f"/api/import/batches/{batch_id}/finalize",
        json={"row_ids": [row["id"]]},
        headers={"Origin": "http://localhost"},
    )
    assert finalized.status_code == 200
    assert finalized.get_json()["rows_inserted"] == 1
    assert gateway.finalized[0]["rows_inserted"] == 1
    assert row["import_status"] == "inserted"


def test_duplicate_review_route_requires_duplicate_review_permission():
    permissions = [
        "spreadsheet_import.view",
        "spreadsheet_import.create",
        "spreadsheet_import.review",
        "product_entry.import",
        "product_entry.review",
        "spreadsheet_import.import",
        "import_confirmation.import",
    ]
    gateway = FakeGateway(permissions=permissions)
    app, _gateway = build_import_app(gateway)
    client = app.test_client()
    assert login(client).status_code == 200
    batch_id = upload_test_batch(client, gateway)
    row_id = gateway.staged[0]["id"]

    response = client.post(
        f"/api/import/batches/{batch_id}/rows/{row_id}/decision",
        json={"decision": "skip_duplicate"},
        headers={"Origin": "http://localhost"},
    )
    assert response.status_code == 403
    assert response.get_json()["code"] == "import_permission_denied"


def test_final_import_route_rejects_more_than_one_thousand_rows():
    app, gateway = build_import_app()
    client = app.test_client()
    assert login(client).status_code == 200
    batch_id = upload_test_batch(client, gateway)

    response = client.post(
        f"/api/import/batches/{batch_id}/finalize",
        json={"row_ids": ["00000000-0000-0000-0000-000000000001"] * 1001},
        headers={"Origin": "http://localhost"},
    )
    assert response.status_code == 400
    assert response.get_json()["code"] == "import_rows_required"


def test_destination_with_pending_business_rule_is_blocked_before_upload():
    gateway = FakeGateway()
    gateway.destination["contract_status"] = "hold_pending_business_rule"
    app, _gateway = build_import_app(gateway)
    client = app.test_client()
    assert login(client).status_code == 200

    response = client.post(
        "/api/import/batches",
        data={
            "module_key": "product_entry",
            "file": (BytesIO(make_workbook()), "source.xlsx"),
        },
        content_type="multipart/form-data",
        headers={"Origin": "http://localhost"},
    )
    assert response.status_code == 409
    assert response.get_json()["code"] == "import_mapping_pending_business_rule"
    assert gateway.batch is None


def make_coding_dpr_workbook():
    workbook = Workbook()
    worksheet = workbook.active
    worksheet.title = "Coding DPR"
    worksheet["A2"] = "Coding/labelling date"
    worksheet["B2"] = "Line Number"
    worksheet["C2"] = "Production Date"
    worksheet["D2"] = "Product Code"
    worksheet["E2"] = "Quantity (tins)"
    worksheet["A3"] = "2026-11-22"
    worksheet["B3"] = "2"
    worksheet["C3"] = "2026-11-21"
    worksheet["D3"] = "MDP-100-155"
    worksheet["E3"] = 1000
    worksheet["U3"] = "2026-11-21"
    worksheet["V3"] = "HISTORIC-LOT-7"
    worksheet["W3"] = 700
    worksheet["X3"] = "=SUM(E3,H3,N3,T3)"
    worksheet["A4"] = "2026-11-22"
    worksheet["C4"] = "2026-11-21"
    worksheet["D4"] = "PARTIAL-LOT"
    worksheet["A5"] = "=TODAY()"
    worksheet["B5"] = "2"
    worksheet["C5"] = "2026-11-21"
    worksheet["D5"] = "FORMULA-INPUT"
    worksheet["E5"] = 10
    buffer = BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()


def coding_dpr_destination():
    return {
        "module_key": "coding_dpr",
        "source_sheet_id": 1266086431,
        "source_sheet_title": "Coding DPR",
        "grid_rows": 1000,
        "grid_columns": 26,
        "header_rows": [2],
        "first_data_row": 3,
        "source_kind": "transaction",
        "contract_status": "approved",
        "required_columns": [],
        "input_columns": list("ABCDEFGHIJKLMNOPQRSTUVW"),
        "formula_columns": ["X"],
    }


def test_coding_dpr_scanner_maps_seven_lots_and_excludes_derived_total():
    stats = {}
    rows = list(iter_xlsx_import_rows(make_coding_dpr_workbook(), coding_dpr_destination(), stats))
    assert [row["source_row_number"] for row in rows] == [3, 4, 5]
    assert rows[0]["classification"] == "operational"
    assert rows[0]["source_formulas"] == {"X": "=SUM(E3,H3,N3,T3)"}
    assert rows[0]["completeness_status"] == "unassessed"
    assert rows[1]["completeness_status"] == "incomplete"
    assert rows[1]["missing_fields"] == ["line_number", "lot_1.quantity"]
    assert rows[2]["completeness_status"] == "incomplete"
    assert "formula_input_A" in rows[2]["missing_fields"]


def test_coding_dpr_scanner_retains_seventh_lot_and_ignores_total_formula_for_inputs():
    rows = list(iter_xlsx_import_rows(make_coding_dpr_workbook(), coding_dpr_destination(), {}))
    first = rows[0]
    assert first["source_values"][20:23] == ["2026-11-21", "HISTORIC-LOT-7", 700]
    assert "X" in first["source_formulas"]
    assert not any(field.startswith("formula_input_") for field in first["missing_fields"])


def test_coding_dpr_finalization_route_uses_dedicated_operational_rpc():
    gateway = FakeGateway()
    gateway.permissions.extend([
        "coding_dpr.view", "coding_dpr.create", "coding_dpr.import", "coding_dpr.review",
    ])
    app, gateway = build_import_app(gateway)
    client = app.test_client()
    assert login(client).status_code == 200
    batch_id = upload_test_batch(client, gateway)
    gateway.destination.update(
        module_key="coding_dpr",
        source_sheet_title="Coding DPR",
        contract_status="approved",
    )
    gateway.batch["module_key"] = "coding_dpr"
    selected_row_id = gateway.staged[0]["id"]

    response = client.post(
        f"/api/import/batches/{batch_id}/finalize",
        json={"row_ids": [selected_row_id]},
        headers={"Origin": "http://localhost"},
    )
    assert response.status_code == 200
    assert response.get_json()["rows_inserted"] == 1
    assert gateway.coding_dpr_finalized == (batch_id, [selected_row_id])
    assert gateway.finalized == []


def make_hourly_workbook(sheet_name="Hourly Meat"):
    workbook = Workbook()
    worksheet = workbook.active
    worksheet.title = sheet_name
    headers = ["Date", "Hour (0-23)", "Product Code", "Target for the hour (tins)",
               "Actual output (tins)", "Remarks", "Product Name (auto)", "Time slot",
               "Variance (actual - target)", "Cum. target (day, this code)",
               "Cum. actual (day, this code)", "Hour attain. %"]
    for col, value in enumerate(headers, start=1):
        worksheet.cell(4, col, value)
    worksheet["A5"] = "2026-11-22"
    worksheet["B5"] = 7
    worksheet["C5"] = "MDP-100-155"
    worksheet["D5"] = 120
    worksheet["E5"] = 115
    worksheet["F5"] = "Morning shift"
    worksheet["G5"] = "=IFERROR(VLOOKUP(C5,CodeMap!A:B,2,FALSE),\"Other\")"
    worksheet["H5"] = "=TEXT(B5,\"00\")&\":00-\"&TEXT(B5+1,\"00\")&\":00"
    worksheet["I5"] = "=E5-D5"
    worksheet["J5"] = "=SUMIFS(D$5:D5,A$5:A5,A5,C$5:C5,C5)"
    worksheet["K5"] = "=SUMIFS(E$5:E5,A$5:A5,A5,C$5:C5,C5)"
    worksheet["L5"] = "=IFERROR(E5/D5,\"\")"
    worksheet["A6"] = "2026-11-22"
    worksheet["C6"] = "MDP-100-155"
    worksheet["D6"] = 80
    worksheet["A7"] = "=TODAY()"
    worksheet["B7"] = 8
    worksheet["C7"] = "FORMULA-CODE"
    worksheet["D7"] = 20
    buffer = BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()


def hourly_destination(module_key="hourly_meat"):
    return {
        "module_key": module_key, "source_sheet_title": "Hourly Meat", "grid_rows": 5004,
        "grid_columns": 12, "first_data_row": 5,
        "input_columns": ["A", "B", "C", "D", "E", "F"],
        "formula_columns": ["G", "H", "I", "J", "K", "L"],
    }


def test_hourly_scanner_keeps_only_six_inputs_and_preserves_derived_formulas():
    stats = {}
    rows = list(iter_xlsx_import_rows(make_hourly_workbook(), hourly_destination(), stats))
    assert [row["source_row_number"] for row in rows] == [5, 6, 7]
    assert rows[0]["classification"] == "operational"
    assert rows[0]["source_formulas"].keys() == {"G", "H", "I", "J", "K", "L"}
    assert rows[0]["source_values"][0:6] == ["2026-11-22", 7, "MDP-100-155", 120, 115, "Morning shift"]
    assert rows[0]["completeness_status"] == "unassessed"
    assert rows[1]["completeness_status"] == "incomplete"
    assert rows[1]["missing_fields"] == ["hour", "actual_tins"]
    assert rows[2]["completeness_status"] == "incomplete"
    assert "formula_input_A" in rows[2]["missing_fields"]


def test_hourly_source_contract_is_identical_for_all_three_module_mappings():
    for module in ("hourly_meat", "hourly_coding", "hourly_agri"):
        rows = list(iter_xlsx_import_rows(make_hourly_workbook(), hourly_destination(module), {}))
        assert rows[0]["classification"] == "operational"
        assert rows[0]["source_values"][2] == "MDP-100-155"
