import pytest

from tfi_backend.google_sheets import (
    GoogleSheetsError,
    GoogleSheetsService,
    parse_google_spreadsheet_id,
)


SPREADSHEET_ID = "1rCbQ16wj7MRjQCFF3tA-WEMkudraJK0RkwcqayUlz7k"


def test_google_link_preserves_spreadsheet_id():
    assert parse_google_spreadsheet_id(
        f"https://docs.google.com/spreadsheets/u/0/d/{SPREADSHEET_ID}/edit#gid=321"
    ) == SPREADSHEET_ID


@pytest.mark.parametrize("url", ["", "https://example.com", "https://docs.google.com/document/d/test"])
def test_google_link_requires_a_spreadsheet_url(url):
    with pytest.raises(GoogleSheetsError, match="Google Sheets|docs.google.com") as error:
        parse_google_spreadsheet_id(url)
    assert error.value.code == "invalid_google_sheets_url"


def test_sheet_scan_preserves_partial_rows_and_formula_metadata(monkeypatch):
    service = GoogleSheetsService(None, None, "", connection_store=object())
    destination = dict(
        source_sheet_title="Test OEE", source_sheet_id=321,
        first_data_row=5, grid_rows=9, grid_columns=3, input_columns=["A", "B"],
    )
    partial = {"values": [{"userEnteredValue": {"stringValue": "Machine 1"}}]}
    formula = {"userEnteredValue": {"formulaValue": "=1+1"}}
    error = dict(formula, effectiveValue={"errorValue": {"type": "REF"}})

    def fake_api(url, token, params, *, timeout):
        assert url.endswith(SPREADSHEET_ID)
        assert token == "test-token"
        assert params["ranges"] == "'Test OEE'!A5:C9"
        return {"sheets": [{
            "properties": {"sheetId": 321, "title": "Test OEE"},
            "data": [{"startRow": 4, "rowData": [
                partial, {}, partial, {"values": [{}, {}, formula]},
                {"values": [{}, {}, error]},
            ]}],
        }]}

    monkeypatch.setattr(service, "_api_get", fake_api)
    stats = {}
    rows = list(service.iter_import_rows("test-token", SPREADSHEET_ID, destination, stats))
    assert [row["source_row_number"] for row in rows] == [5, 7, 8, 9]
    assert rows[0]["source_values"] == ["Machine 1"]
    assert rows[0]["source_fingerprint"] == rows[1]["source_fingerprint"]
    assert rows[2]["source_formulas"] == {"C": "=1+1"}
    assert [row["classification"] for row in rows] == [
        "operational", "operational", "derived", "invalid",
    ]
    assert stats["rows_inspected"] == 5
    assert stats["blank_rows"] == 1
    assert stats["formula_cells"] == 2


def test_schedule_scan_captures_effective_date_and_retains_the_formula(monkeypatch):
    service = GoogleSheetsService(None, None, "", connection_store=object())
    destination = {
        "source_sheet_id": 1538651320, "source_sheet_title": "Production Schedule",
        "first_data_row": 8, "grid_rows": 8, "grid_columns": 3,
        "input_columns": ["B", "C"],
    }

    def fake_api(url, token, params, *, timeout):
        return {"sheets": [{
            "properties": {"sheetId": 1538651320, "title": "Production Schedule"},
            "data": [{"startRow": 7, "rowData": [{"values": [
                {"userEnteredValue": {"formulaValue": "=$A$7"},
                 "effectiveValue": {"numberValue": 46336}},
                {"userEnteredValue": {"stringValue": "Group"}},
                {"userEnteredValue": {"stringValue": "SKU"}},
            ]}]}],
        }]}

    monkeypatch.setattr(service, "_api_get", fake_api)
    [row] = service.iter_import_rows("token", SPREADSHEET_ID, destination, {})
    assert row["source_values"] == [46336, "Group", "SKU"]
    assert row["source_formulas"] == {"A": "=$A$7"}


class MemoryConnectionStore:
    def __init__(self):
        self.values = {}

    def get(self, user_id):
        value = self.values.get(str(user_id))
        return dict(value) if value else None

    def put(self, user_id, value):
        self.values[str(user_id)] = dict(value)


class OAuthFakeResponse:
    status_code = 200

    def __init__(self, payload):
        self.payload = payload

    def json(self):
        return self.payload


class OAuthFakeHttp:
    def post(self, url, data, timeout):
        assert url.endswith("/token")
        assert data["grant_type"] == "authorization_code"
        assert data["code_verifier"]
        return OAuthFakeResponse({
            "access_token": "test-access-token",
            "refresh_token": "test-refresh-token",
            "expires_in": 3600,
        })

    def get(self, url, headers, timeout):
        assert url.endswith("/userinfo")
        assert headers["Authorization"] == "Bearer test-access-token"
        return OAuthFakeResponse({
            "email": "owner@example.test",
            "email_verified": True,
        })


def test_oauth_callback_completes_from_one_time_state_without_login_cookie():
    from urllib.parse import parse_qs, urlparse

    store = MemoryConnectionStore()
    service = GoogleSheetsService(
        "client-id",
        "client-secret",
        "http://127.0.0.1:5100/api/google-sheets/callback",
        connection_store=store,
        http=OAuthFakeHttp(),
    )
    authorization_url = service.start_authorization("tfi-user-123")
    state = parse_qs(urlparse(authorization_url).query)["state"][0]

    result = service.complete_authorization_for_state(state, "google-auth-code")

    assert result["configured"] is True
    assert result["connected"] is True
    assert result["email"] == "owner@example.test"
    assert store.get("tfi-user-123")["refresh_token"] == "test-refresh-token"
    with pytest.raises(GoogleSheetsError) as error:
        service.complete_authorization_for_state(state, "replayed-code")
    assert error.value.code == "google_oauth_state_invalid"


def test_oauth_callback_rejects_unknown_state_without_binding_a_user():
    service = GoogleSheetsService("client-id", "client-secret", "http://127.0.0.1/callback", connection_store=MemoryConnectionStore(), http=OAuthFakeHttp())
    with pytest.raises(GoogleSheetsError) as error:
        service.complete_authorization_for_state("not-a-valid-state", "some-code")
    assert error.value.code == "google_oauth_state_invalid"
