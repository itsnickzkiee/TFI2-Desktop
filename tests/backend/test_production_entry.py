from __future__ import annotations

import time
from urllib.parse import urlencode

from tfi_backend.app import create_app
from tfi_backend.config import Settings
from tfi_backend.production_entry_contract import (
    PRODUCT_NAMES,
    PRODUCT_CODES,
    normalize_production_entry_changes,
    normalize_production_entry_records,
    ProductionEntryValidationError,
)
from tfi_backend.session_store import SessionVault
from tfi_backend.production_entry_contract import get_production_entry_catalog


def sample_row(source_row_number=8, **values):
    product = PRODUCT_NAMES[0]
    code = PRODUCT_CODES[product][0]
    data = {
        "A": "2026-11-21",
        "C": product,
        "D": code,
        "E": "2",
        "F": "100",
        "G": "90",
        "H": "can",
        "J": "08:00",
        "K": "08:05",
        "L": "12:00",
        "M": "12:10",
        "N": "12:25",
        "O": "10",
        "P": "8",
        "S": "1.5",
        "T": "Normal production run",
    }
    data.update(values)
    return {"source_row_number": source_row_number, "record_data": data}


def test_production_entry_contract_maps_fixed_source_rows_and_calculates_source_formulas():
    normalized = normalize_production_entry_records([sample_row()])[0]
    assert normalized["source_row_number"] == 8
    assert normalized["line"] == "Agri"
    assert normalized["has_data"] is True
    assert normalized["record_data"]["B"] == "Agri"
    assert normalized["record_data"]["I"] == "0.9"
    assert normalized["record_data"]["Q"] == "2"
    assert normalized["record_data"]["R"] == "0.8"
    assert normalized["record_data"]["W"] is True
    assert normalized["record_data"]["U"] is None
    assert normalized["record_data"]["X"] is None


def test_production_entry_contract_maps_meat_and_finishing_source_slots():
    rows = normalize_production_entry_records([
        sample_row(12),
        sample_row(16),
    ])
    assert [row["line"] for row in rows] == ["Meat", "Finishing"]


def test_production_entry_contract_accepts_incomplete_source_has_data_rows():
    normalized = normalize_production_entry_records([
        {"source_row_number": 8, "record_data": {"T": "Reason recorded"}},
        {"source_row_number": 9, "record_data": {"E": "2", "H": "can", "J": "08:00"}},
    ])
    assert normalized[0]["has_data"] is True
    assert normalized[0]["record_data"]["W"] is True
    assert normalized[1]["has_data"] is False
    assert normalized[1]["record_data"]["W"] is False


def test_production_entry_contract_rejects_invalid_product_code_for_selected_name():
    product = PRODUCT_NAMES[0]
    other = next(name for name in PRODUCT_NAMES if PRODUCT_CODES[name] and PRODUCT_CODES[name][0] not in PRODUCT_CODES[product])
    with pytest.raises(ProductionEntryValidationError, match="Product Code"):
        normalize_production_entry_records([
            {"source_row_number": 8, "record_data": {"C": product, "D": PRODUCT_CODES[other][0]}}
        ])


def test_production_entry_contract_rejects_formula_trace_and_line_inputs():
    for column in ("B", "I", "Q", "R", "U", "V", "W", "X"):
        with pytest.raises(ProductionEntryValidationError, match="calculated|trace|unsupported"):
            normalize_production_entry_records([
                {"source_row_number": 8, "record_data": {column: "forbidden"}}
            ])


def test_production_entry_contract_rejects_negative_numeric_inputs_and_invalid_time():
    with pytest.raises(ProductionEntryValidationError, match="nonnegative"):
        normalize_production_entry_records([sample_row(F="-1")])
    with pytest.raises(ProductionEntryValidationError, match="valid time"):
        normalize_production_entry_records([sample_row(J="25:99")])


def test_production_entry_contract_rejects_duplicate_source_slots_and_more_than_twelve_rows():
    with pytest.raises(ProductionEntryValidationError, match="same source row"):
        normalize_production_entry_records([sample_row(8), sample_row(8)])
    with pytest.raises(ProductionEntryValidationError, match="between 1 and 12"):
        normalize_production_entry_records([sample_row(8)] * 13)


def test_production_entry_contract_recomputes_edit_fields_and_rejects_derived_changes():
    original = normalize_production_entry_records([sample_row()])[0]["record_data"]
    updated = normalize_production_entry_changes(original, 8, {"G": "95"})
    assert updated["changes"] == {"G": "95"}
    assert updated["record"]["record_data"]["I"] == "0.95"
    with pytest.raises(ProductionEntryValidationError, match="calculated|trace|unsupported"):
        normalize_production_entry_changes(original, 8, {"I": "1.0"})


def test_production_entry_contract_clears_dependent_product_code_only_with_valid_pair():
    original = normalize_production_entry_records([sample_row()])[0]["record_data"]
    new_product = next(name for name in PRODUCT_NAMES if name != original["C"])
    new_code = PRODUCT_CODES[new_product][0]
    updated = normalize_production_entry_changes(
        original, 8, {"C": new_product, "D": new_code}
    )
    assert updated["changes"] == {"C": new_product, "D": new_code}
    with pytest.raises(ProductionEntryValidationError, match="Product Code"):
        normalize_production_entry_changes(original, 8, {"C": new_product})


import pytest


class FakeGateway:
    def __init__(self, permissions=None):
        self.permissions = permissions or [
            "production_entry.view",
            "production_entry.create",
            "production_entry.edit",
        ]
        self.catalog = get_production_entry_catalog()
        self.created = []
        self.updated = []
        self.filters = []
        self.record = {
            "id": "00000000-0000-0000-0000-000000000456",
            "source_row_number": 8,
            "record_data": normalize_production_entry_records([sample_row()])[0]["record_data"],
            "version": 1,
            "record_status": "active",
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
                "account_status": "active",
            },
            "roles": [{"role_key": "system_admin"}],
            "permissions": list(self.permissions),
        }

    def sign_out(self, access_token):
        return None

    def get_production_entry_catalog(self, access_token):
        return self.catalog

    def get_production_entry_summary(self, access_token):
        return {"saved_rows": 1, "days_saved": 1, "avg_attainment": 0.9, "last_saved": "2026-11-21T09:00:00Z"}

    def get_production_entry_records(self, access_token, **kwargs):
        self.filters.append(kwargs)
        return {"total": 1, "records": [self.record]}

    def create_production_entry_records(self, access_token, records):
        self.created = list(records)
        return {"entry_batch_id": "00000000-0000-0000-0000-000000000789", "inserted": 1, "duplicates": 0, "empty": 0, "results": [{"row_index": 1, "status": "inserted"}]}

    def get_production_entry_record(self, access_token, record_id):
        return self.record if record_id == self.record["id"] else None

    def update_production_entry_record(self, access_token, record_id, expected_version, changes, change_reason=None):
        self.updated.append((record_id, expected_version, changes, change_reason))
        return {"id": record_id, "changed": True, "version": expected_version + 1}

    def get_production_entry_revisions(self, access_token, record_id):
        return [{"version": 2, "changed_columns": ["G"]}]


def build_app(gateway=None):
    settings = Settings(
        supabase_url="https://slfjqrkxnsgdaturaguw.supabase.co",
        publishable_key="sb_publishable_test",
        host="127.0.0.1",
        port=5100,
        idle_timeout_seconds=0,
    )
    return create_app(settings, gateway or FakeGateway(), SessionVault())


def login(client):
    return client.post(
        "/api/auth/login",
        json={"email": "admin@example.test", "password": "correct"},
        headers={"Origin": "http://localhost"},
    )


def test_production_entry_catalog_returns_verified_source_contract_and_permissions():
    client = build_app().test_client()
    assert login(client).status_code == 200
    response = client.get("/api/production-entry/catalog")
    assert response.status_code == 200
    payload = response.get_json()
    assert len(payload["catalog"]["product_names"]) == 32
    assert len(payload["catalog"]["form"]["slots"]) == 12
    assert len(payload["catalog"]["summary"]["headers"]) == 24
    assert payload["permissions"] == {"view": True, "create": True, "edit": True}


def test_production_entry_summary_returns_live_metric_shape():
    client = build_app().test_client()
    assert login(client).status_code == 200
    response = client.get("/api/production-entry/summary")
    assert response.status_code == 200
    assert response.get_json()["summary"]["saved_rows"] == 1


def test_production_entry_list_passes_filters_and_server_sort_to_gateway():
    gateway = FakeGateway()
    client = build_app(gateway).test_client()
    assert login(client).status_code == 200
    response = client.get(
        "/api/production-entry/records?"
        + urlencode({
            "page": 2,
            "page_size": 25,
            "date_from": "2026-11-01",
            "date_to": "2026-11-21",
            "line": "Meat",
            "product_name": PRODUCT_NAMES[0],
            "product_code": PRODUCT_CODES[PRODUCT_NAMES[0]][0],
            "sort": "produced",
            "direction": "asc",
        })
    )
    assert response.status_code == 200
    assert gateway.filters[-1] == {
        "date_from": "2026-11-01",
        "date_to": "2026-11-21",
        "line": "Meat",
        "product_name": PRODUCT_NAMES[0],
        "product_code": PRODUCT_CODES[PRODUCT_NAMES[0]][0],
        "search": None,
        "page": 2,
        "page_size": 25,
        "sort_key": "produced",
        "sort_direction": "asc",
    }


def test_production_entry_create_sends_only_source_input_columns():
    gateway = FakeGateway()
    client = build_app(gateway).test_client()
    assert login(client).status_code == 200
    response = client.post(
        "/api/production-entry/records",
        json={"records": [sample_row()]},
        headers={"Origin": "http://localhost"},
    )
    assert response.status_code == 201
    assert gateway.created == [{
        "source_row_number": 8,
        "record_data": {
            "A": "2026-11-21",
            "C": PRODUCT_NAMES[0],
            "D": PRODUCT_CODES[PRODUCT_NAMES[0]][0],
            "E": "2",
            "F": "100",
            "G": "90",
            "H": "can",
            "J": "08:00",
            "K": "08:05",
            "L": "12:00",
            "M": "12:10",
            "N": "12:25",
            "O": "10",
            "P": "8",
            "S": "1.5",
            "T": "Normal production run",
        },
    }]


def test_production_entry_create_rejects_cross_product_code_before_database_write():
    gateway = FakeGateway()
    client = build_app(gateway).test_client()
    assert login(client).status_code == 200
    product = PRODUCT_NAMES[0]
    other = next(name for name in PRODUCT_NAMES if PRODUCT_CODES[name] and PRODUCT_CODES[name][0] not in PRODUCT_CODES[product])
    response = client.post(
        "/api/production-entry/records",
        json={"records": [{"source_row_number": 8, "record_data": {"C": product, "D": PRODUCT_CODES[other][0]}}]},
        headers={"Origin": "http://localhost"},
    )
    assert response.status_code == 400
    assert gateway.created == []


def test_production_entry_update_is_version_checked_and_recomputes_source_formula():
    gateway = FakeGateway()
    client = build_app(gateway).test_client()
    assert login(client).status_code == 200
    response = client.patch(
        f"/api/production-entry/records/{gateway.record['id']}",
        json={"expected_version": 1, "changes": {"G": "95"}, "change_reason": "Corrected produced quantity"},
        headers={"Origin": "http://localhost"},
    )
    assert response.status_code == 200
    assert gateway.updated == [(gateway.record["id"], 1, {"G": "95"}, "Corrected produced quantity")]


def test_production_entry_update_rejects_formula_fields_before_database_write():
    gateway = FakeGateway()
    client = build_app(gateway).test_client()
    assert login(client).status_code == 200
    response = client.patch(
        f"/api/production-entry/records/{gateway.record['id']}",
        json={"expected_version": 1, "changes": {"I": "1"}},
        headers={"Origin": "http://localhost"},
    )
    assert response.status_code == 400
    assert gateway.updated == []


def test_production_entry_create_is_denied_without_permission():
    gateway = FakeGateway(permissions=["production_entry.view"])
    client = build_app(gateway).test_client()
    assert login(client).status_code == 200
    response = client.post(
        "/api/production-entry/records",
        json={"records": [sample_row()]},
        headers={"Origin": "http://localhost"},
    )
    assert response.status_code == 403
    assert response.get_json()["code"] == "operational_permission_denied"
