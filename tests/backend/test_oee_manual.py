from __future__ import annotations

import time
from decimal import Decimal
import pytest

from tfi_backend.oee_contract import (
    INPUT_FIELDS,
    OeeValidationError,
    get_oee_catalog,
    inspect_oee_row,
    normalize_oee_changes,
    normalize_oee_records,
)


PRODUCTS = [{"code": "MDP-100-155", "name": "DPGP"}] + [
    {"code": f"OEE-{i:03d}", "name": f"Product {i}"} for i in range(126)
]
MACHINES = [f"Machine {i}" for i in range(50)]
LINES = ["AGRILINE", "MEATLINE", "CODINGLINE"]


def ref_catalog():
    return get_oee_catalog({"machines": MACHINES, "lines": LINES, "products": PRODUCTS})


def record(row_index=1, **changes):
    data = {
        "production_date": "2026-11-22", "machine": "Golden Eagle AGRI",
        "line": "AGRILINE", "product_code": "MDP-100-155",
        "planned_hours": "10", "downtime_hours": "1", "ideal_rate": "100",
        "total_count": "800", "reject_count": "20", "include_in_overall": "Y",
    }
    data.update(changes)
    return {"row_index": row_index, "record_data": data}


def test_oee_catalog_contains_current_reference_lists_and_sources():
    result = ref_catalog()
    assert len(result["machines"]) == 50
    assert len(result["lines"]) == 3
    assert len(result["products"]) == 127
    assert result["product_names"]["MDP-100-155"] == "DPGP"
    assert result["validation"]["required_fields"] == list(INPUT_FIELDS)


def test_oee_source_contract_calculates_k_to_t_and_business_key():
    result = inspect_oee_row([
        "2026-11-22", "Golden Eagle AGRI", "AGRILINE", "MDP-100-155",
        "10", "1", "100", "800", "20", "Y",
    ])
    assert result["status"] == "valid"
    assert result["business_key"] == ("2026-11-22", "golden eagle agri", "mdp-100-155")
    assert result["calculated"]["run_time_hours"] == 9
    assert result["calculated"]["good_count"] == 780
    assert result["calculated"]["availability"] == Decimal("0.9")
    assert result["calculated"]["performance"] == Decimal("800") / Decimal("900")
    assert result["calculated"]["quality"] == Decimal("0.975")
    assert result["calculated"]["oee"] == Decimal("0.78")


def test_oee_normalizes_all_ten_source_inputs_and_ignores_blank_rows():
    result = normalize_oee_records([
        {"row_index": 1, "record_data": {field: "" for field in INPUT_FIELDS}},
        record(2),
    ], ref_catalog())
    assert len(result) == 1
    assert result[0]["row_index"] == 2
    assert result[0]["record_data"] == {
        "production_date": "2026-11-22", "machine": "Golden Eagle AGRI",
        "line": "AGRILINE", "product_code": "MDP-100-155",
        "planned_hours": "10", "downtime_hours": "1", "ideal_rate": "100",
        "total_count": 800, "reject_count": 20, "include_in_overall": "Y",
    }


@pytest.mark.parametrize("changes,expected", [
    ({"downtime_hours": "11"}, "downtime_hours"),
    ({"reject_count": "801"}, "reject_count"),
    ({"total_count": "800.5"}, "total_count"),
    ({"include_in_overall": "YES"}, "include_in_overall"),
])
def test_oee_rejects_invalid_source_values(changes, expected):
    result = inspect_oee_row([
        "2026-11-22", changes.get("machine", "Golden Eagle AGRI"),
        "AGRILINE", "MDP-100-155", "10", changes.get("downtime_hours", "1"),
        "100", changes.get("total_count", "800"), changes.get("reject_count", "20"),
        changes.get("include_in_overall", "Y"),
    ])
    assert result["status"] == "invalid"
    assert expected in result["errors"]


def test_oee_treats_whitespace_only_required_text_as_missing():
    result = inspect_oee_row([
        "2026-11-22", "   ", "AGRILINE", "MDP-100-155",
        "10", "1", "100", "800", "20", "Y",
    ])
    assert result["status"] == "incomplete"
    assert "machine" in result["missing_fields"]


def test_oee_manual_save_rejects_incomplete_rows_and_derived_columns():
    with pytest.raises(OeeValidationError, match="Complete all 10"):
        normalize_oee_records([{"row_index": 1, "record_data": {"machine": "Golden Eagle AGRI"}}], ref_catalog())
    with pytest.raises(OeeValidationError, match="Calculated"):
        normalize_oee_records([record(1, oee=0.78)], ref_catalog())


def test_oee_edit_normalizes_current_values_and_returns_only_changed_inputs():
    current = record()["record_data"]
    current.update({"id": "oee-1", "version": 1, "record_status": "active"})
    no_change = normalize_oee_changes(current, {
        "production_date": "2026-11-22", "machine": "Golden Eagle AGRI",
        "line": "AGRILINE", "product_code": "MDP-100-155",
        "planned_hours": 10, "downtime_hours": 1, "ideal_rate": 100,
        "total_count": 800, "reject_count": 20, "include_in_overall": "Y",
    }, ref_catalog())
    assert no_change["changes"] == {}
    changed = normalize_oee_changes(current, {"total_count": "820"}, ref_catalog())
    assert changed["changes"] == {"total_count": 820}


def test_oee_edit_rejects_calculated_fields():
    current = record()["record_data"]
    with pytest.raises(OeeValidationError, match="Calculated"):
        normalize_oee_changes(current, {"oee": 0.78}, ref_catalog())


class FakeOeeGateway:
    def __init__(self, permissions=None):
        self.permissions = permissions or ["oee.view", "oee.create", "oee.edit", "oee.import", "oee.approve", "oee.review"]
        self.created, self.updated, self.filters = [], [], []
        self.record = {
            "id": "00000000-0000-0000-0000-000000000921",
            "production_date": "2026-11-22", "machine": "Golden Eagle AGRI",
            "line": "AGRILINE", "product_code": "MDP-100-155",
            "planned_hours": 10, "downtime_hours": 1, "ideal_rate": 100,
            "total_count": 800, "reject_count": 20, "include_in_overall": "Y",
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

    def get_oee_catalog(self, access_token):
        return {"machines": MACHINES, "lines": LINES, "products": PRODUCTS,
                "source": {"sheet_name": "OEE", "sheet_id": 1750442014}}

    def get_oee_records(self, access_token, **kwargs):
        self.filters.append(kwargs)
        return {"records": [self.record], "page": kwargs["page"], "page_size": kwargs["page_size"],
                "total_count": 1, "has_more": False, "summary": {"record_count": 1, "overall_oee": 0.78}}

    def get_oee_record(self, access_token, record_id):
        return self.record if record_id == self.record["id"] else None

    def get_oee_revisions(self, access_token, record_id):
        return [{"version": 2, "changed_fields": ["total_count"]}]

    def create_oee_records(self, access_token, records):
        self.created.extend(records)
        return {"inserted": len(records), "duplicates": 0, "empty": 0, "results": []}

    def update_oee_record(self, access_token, record_id, expected_version, changes, change_reason=None):
        self.updated.append((record_id, expected_version, changes, change_reason))
        return {"changed": True, "id": record_id, "version": expected_version + 1}


def build_oee_app(gateway=None):
    from tfi_backend.app import create_app
    from tfi_backend.config import Settings
    from tfi_backend.session_store import SessionVault
    settings = Settings(
        supabase_url="https://slfjqrkxnsgdaturaguw.supabase.co",
        publishable_key="sb_publishable_test", host="127.0.0.1", port=5100,
        idle_timeout_seconds=0,
    )
    return create_app(settings, gateway or FakeOeeGateway(), SessionVault())


def oee_login(client):
    return client.post("/api/auth/login", json={"email": "admin@example.test", "password": "correct"},
                       headers={"Origin": "http://localhost"})


def test_oee_api_catalog_records_and_manual_batch_save():
    gateway = FakeOeeGateway()
    client = build_oee_app(gateway).test_client()
    assert oee_login(client).status_code == 200
    catalog = client.get("/api/oee/catalog")
    assert catalog.status_code == 200
    assert len(catalog.get_json()["catalog"]["machines"]) == 50
    assert len(catalog.get_json()["catalog"]["products"]) == 127
    records = client.get("/api/oee/records?date_from=2026-11-01&machine=Golden+Eagle+AGRI")
    assert records.status_code == 200
    assert gateway.filters[0]["date_from"] == "2026-11-01"
    response = client.post("/api/oee/records", json={"records": [record()]})
    assert response.status_code == 201
    assert gateway.created[0]["record_data"]["include_in_overall"] == "Y"


def test_oee_api_versioned_edit_and_revision_history():
    gateway = FakeOeeGateway()
    client = build_oee_app(gateway).test_client()
    assert oee_login(client).status_code == 200
    record_id = gateway.record["id"]
    updated = client.patch(
        f"/api/oee/records/{record_id}",
        json={"expected_version": 1, "changes": {"total_count": "820"}, "change_reason": "Corrected count"},
    )
    assert updated.status_code == 200
    assert gateway.updated[0][2] == {"total_count": 820}
    history = client.get(f"/api/oee/records/{record_id}/revisions")
    assert history.status_code == 200
    assert history.get_json()["revisions"][0]["version"] == 2


def test_oee_api_denies_create_without_permission_and_rejects_incomplete_rows():
    gateway = FakeOeeGateway(permissions=["oee.view"])
    client = build_oee_app(gateway).test_client()
    assert oee_login(client).status_code == 200
    assert client.post("/api/oee/records", json={"records": [record()]}).status_code == 403
    gateway = FakeOeeGateway()
    client = build_oee_app(gateway).test_client()
    assert oee_login(client).status_code == 200
    response = client.post("/api/oee/records", json={"records": [{"row_index": 1, "record_data": {"machine": "Only"}}]})
    assert response.status_code == 400
