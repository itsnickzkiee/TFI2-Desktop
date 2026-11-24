from __future__ import annotations

import time
from decimal import Decimal

import pytest

from tfi_backend.coding_dpr_contract import (
    CodingDprValidationError,
    coding_dpr_calculations,
    coding_dpr_review_reasons,
    get_coding_dpr_catalog,
    normalize_coding_dpr_changes,
    normalize_coding_dpr_records,
)


CATALOG = {
    "product_codes": ["MDP-100-155", "TMRMB-24-380"],
    "line_numbers": ["1", "2", "3"],
}


def source_row(row_index=1, **changes):
    data = {
        "A": "2026-11-22", "B": "2",
        "C": "2026-11-21", "D": "MDP-100-155", "E": "1000",
        "F": "2026-11-21", "G": "TMRMB-24-380", "H": "2000",
        "U": "2026-11-21", "V": "MDP-100-155", "W": "700",
    }
    data.update(changes)
    return {"row_index": row_index, "record_data": data}


def test_coding_dpr_catalog_preserves_exact_source_contract():
    catalog = get_coding_dpr_catalog({"product_codes": ["A"], "line_numbers": ["1", "2", "3"]})
    assert catalog["source"]["worksheet"] == "Coding DPR"
    assert catalog["source"]["sheet_id"] == 1266086431
    assert catalog["source"]["input_columns"] == "A:W"
    assert catalog["source"]["derived_column"] == "X"
    assert catalog["source"]["source_total_batch_slots"] == [1, 2, 3, 4, 5, 6]
    assert catalog["source"]["batch_7_included_in_source_total"] is False


def test_coding_dpr_normalizes_seven_lot_slots_and_keeps_batch_seven():
    rows = normalize_coding_dpr_records([source_row()], CATALOG)
    record = rows[0]["record_data"]
    assert len(record["lots"]) == 7
    assert record["lots"][0] == {
        "lot_number": 1, "production_date": "2026-11-21",
        "product_code": "MDP-100-155", "quantity": "1000",
    }
    assert record["lots"][6]["quantity"] == "700"
    assert rows[0]["derived"]["total_quantity"] == "3000"
    assert rows[0]["derived"]["batch7_quantity"] == "700"


def test_coding_dpr_formula_excludes_batch_seven_exactly_like_source():
    record = normalize_coding_dpr_records([source_row()], CATALOG)[0]["record_data"]
    assert coding_dpr_calculations(record)["total_quantity"] == "3000"
    record["lots"][5]["quantity"] = "50"
    record["lots"][6]["quantity"] = "9000"
    assert coding_dpr_calculations(record)["total_quantity"] == "3050"
    assert coding_dpr_calculations(record)["batch7_quantity"] == "9000"


def test_coding_dpr_saves_partial_triplets_and_flags_module_inbox_reasons():
    rows = normalize_coding_dpr_records([
        {"row_index": 1, "record_data": {"A": "", "B": "", "C": "", "D": "", "E": ""}},
        {"row_index": 2, "record_data": {"A": "2026-11-22", "B": "", "C": "2026-11-21", "D": "MDP-100-155"}},
    ], CATALOG)
    assert len(rows) == 1
    assert rows[0]["row_index"] == 2
    assert rows[0]["derived"]["review_status"] == "needs_review"
    assert "missing_line_number" in rows[0]["derived"]["review_reasons"]
    assert "incomplete_lot_1" in rows[0]["derived"]["review_reasons"]


def test_coding_dpr_unmatched_product_codes_are_preserved_and_flagged():
    rows = normalize_coding_dpr_records([source_row(D="HISTORIC-UNKNOWN")], CATALOG)
    assert rows[0]["record_data"]["lots"][0]["product_code"] == "HISTORIC-UNKNOWN"
    assert "unmatched_product_code_lot_1" in rows[0]["derived"]["review_reasons"]


@pytest.mark.parametrize("field,value", [("X", "3700"), ("Y", "not allowed")])
def test_coding_dpr_rejects_derived_or_out_of_contract_columns(field, value):
    with pytest.raises(CodingDprValidationError, match="Calculated or unsupported"):
        normalize_coding_dpr_records([source_row(**{field: value})], CATALOG)


@pytest.mark.parametrize("field,value,match", [
    ("A", "11/22/2026", "Coding / Labelling Date"),
    ("B", "4", "Line Number"),
    ("C", "22/11/2026", "Batch 1 Production Date"),
    ("E", "-1", "nonnegative"),
    ("E", "NaN", "finite"),
    ("E", "Infinity", "finite"),
])
def test_coding_dpr_rejects_invalid_dates_line_and_quantities(field, value, match):
    with pytest.raises(CodingDprValidationError, match=match):
        normalize_coding_dpr_records([source_row(**{field: value})], CATALOG)


def test_coding_dpr_skips_blank_rows_and_limits_batch_size():
    rows = normalize_coding_dpr_records([
        {"row_index": 1, "record_data": {}},
        {"row_index": 2, "record_data": {"B": "1"}},
    ], CATALOG)
    assert len(rows) == 1 and rows[0]["row_index"] == 2
    with pytest.raises(CodingDprValidationError, match="between 1 and 50"):
        normalize_coding_dpr_records([{"row_index": i, "record_data": {"B": "1"}} for i in range(51)], CATALOG)


def test_coding_dpr_update_merges_single_field_and_preserves_other_lots():
    current = {
        "coding_date": "2026-11-22", "line_number": "2",
        "lots": [{"lot_number": 1, "production_date": "2026-11-21", "product_code": "MDP-100-155", "quantity": 1000}],
    }
    result = normalize_coding_dpr_changes(current, {"E": "1250"}, CATALOG)
    assert result["changed_fields"] == ["lots"]
    assert result["record_data"]["coding_date"] == "2026-11-22"
    assert result["record_data"]["line_number"] == "2"
    assert result["record_data"]["lots"][0]["quantity"] == "1250"
    assert len(result["record_data"]["lots"]) == 7


def test_coding_dpr_update_rejects_editing_derived_total():
    current = {"coding_date": None, "line_number": "1", "lots": []}
    with pytest.raises(CodingDprValidationError, match="Calculated, lookup"):
        normalize_coding_dpr_changes(current, {"X": "100"}, CATALOG)


class FakeCodingDprGateway:
    def __init__(self, permissions=None):
        self.permissions = permissions or ["coding_dpr.view", "coding_dpr.create", "coding_dpr.edit"]
        self.created, self.updated, self.filters = [], [], []
        self.record = {
            "id": "00000000-0000-0000-0000-000000000913",
            "coding_date": "2026-11-22", "line_number": "2",
            "lots": [{"lot_number": 1, "production_date": "2026-11-21", "product_code": "MDP-100-155",
                      "quantity": 1000, "product_code_reference_status": "matched"}],
            "total_quantity": 1000, "batch7_quantity": 0, "lot_count": 1,
            "review_status": "unassessed", "review_reasons": [],
            "version": 1, "record_status": "active",
        }

    def sign_in_with_password(self, email, password):
        return {"user_id": "user-1", "email": email, "access_token": "access",
                "refresh_token": "refresh", "expires_at": time.time() + 3600}

    def get_access_context(self, access_token):
        return {
            "profile": {"user_id": "user-1", "email": "admin@example.test",
                        "display_name": "Test Admin", "account_status": "active"},
            "roles": [{"role_key": "system_admin"}], "permissions": list(self.permissions),
        }

    def sign_out(self, access_token):
        return None

    def get_coding_dpr_catalog(self, access_token):
        return CATALOG

    def get_coding_dpr_records(self, access_token, **kwargs):
        self.filters.append(kwargs)
        return {"records": [self.record], "total_count": 1}

    def get_coding_dpr_record(self, access_token, record_id):
        return self.record if record_id == self.record["id"] else None

    def get_coding_dpr_revisions(self, access_token, record_id):
        return [{"version": 2, "changed_fields": ["lots"]}]

    def create_coding_dpr_records(self, access_token, records):
        self.created.extend(records)
        return {"inserted": len(records), "duplicates": 0, "empty": 0, "results": []}

    def update_coding_dpr_record(self, access_token, record_id, expected_version, changes, change_reason=None):
        self.updated.append((record_id, expected_version, changes, change_reason))
        return {"changed": True, "id": record_id, "version": expected_version + 1}


def build_coding_dpr_app(gateway=None):
    from tfi_backend.app import create_app
    from tfi_backend.config import Settings
    from tfi_backend.session_store import SessionVault
    settings = Settings(
        supabase_url="https://slfjqrkxnsgdaturaguw.supabase.co",
        publishable_key="sb_publishable_test", host="127.0.0.1", port=5100,
        idle_timeout_seconds=0,
    )
    return create_app(settings, gateway or FakeCodingDprGateway(), SessionVault())


def coding_dpr_login(client):
    return client.post("/api/auth/login", json={"email": "admin@example.test", "password": "correct"},
                       headers={"Origin": "http://localhost"})


def test_coding_dpr_api_catalog_and_saved_records_are_permission_gated():
    gateway = FakeCodingDprGateway()
    client = build_coding_dpr_app(gateway).test_client()
    assert coding_dpr_login(client).status_code == 200
    catalog = client.get("/api/coding-dpr/catalog")
    assert catalog.status_code == 200
    assert catalog.get_json()["catalog"]["line_numbers"] == ["1", "2", "3"]
    records = client.get("/api/coding-dpr/records?date_from=2026-11-01&line_number=2&review_status=needs_review")
    assert records.status_code == 200
    assert records.get_json()["total_count"] == 1
    assert gateway.filters[0]["date_from"] == "2026-11-01"
    assert gateway.filters[0]["line_number"] == "2"


def test_coding_dpr_api_create_update_and_revision_history():
    gateway = FakeCodingDprGateway()
    client = build_coding_dpr_app(gateway).test_client()
    assert coding_dpr_login(client).status_code == 200
    response = client.post("/api/coding-dpr/records", json={"records": [source_row()]})
    assert response.status_code == 201
    assert len(gateway.created[0]["record_data"]["lots"]) == 7
    assert gateway.created[0]["record_data"]["lots"][6]["quantity"] == "700"
    record_id = gateway.record["id"]
    updated = client.patch(
        f"/api/coding-dpr/records/{record_id}",
        json={"expected_version": 1, "changes": {"E": "1250"}, "change_reason": "Quantity correction"},
    )
    assert updated.status_code == 200
    assert gateway.updated[0][2]["lots"][0]["quantity"] == "1250"
    history = client.get(f"/api/coding-dpr/records/{record_id}/revisions")
    assert history.status_code == 200
    assert history.get_json()["revisions"][0]["version"] == 2


def test_coding_dpr_api_denies_create_without_permission():
    gateway = FakeCodingDprGateway(permissions=["coding_dpr.view"])
    client = build_coding_dpr_app(gateway).test_client()
    assert coding_dpr_login(client).status_code == 200
    response = client.post("/api/coding-dpr/records", json={"records": [source_row()]})
    assert response.status_code == 403
