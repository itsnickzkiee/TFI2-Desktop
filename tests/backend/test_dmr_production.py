from __future__ import annotations

import pytest

from tfi_backend.dmr_production_contract import (
    DmrProductionValidationError,
    calculate_downtime,
    get_dmr_production_catalog,
    normalize_dmr_production_changes,
    normalize_dmr_production_records,
)

def row(row_index=1, **changes):
    data = {
        "A": "2026-11-22",
        "B": "MDP-100-155",
        "C": "AGRILINE",
        "D": "23:50",
        "E": "00:20",
        "H": "BD",
        "I": "Filler Machine",
        "J": "Seaming Machine",
        "K": "Stop for maintenance",
    }
    data.update(changes)
    return {"row_index": row_index, "record_data": data}


def test_catalog_exposes_source_suggestions_and_discloses_product_code_validation_is_not_canonical():
    catalog = get_dmr_production_catalog()
    assert len(catalog["product_codes"]) == 58
    assert len(catalog["categories"]) == 8
    assert len(catalog["additional_options"]) == 21
    assert "not a canonical product catalog" in catalog["product_code_note"]


def test_dmr_contract_normalizes_source_columns_and_calculates_overnight_duration():
    result = normalize_dmr_production_records([row()])
    assert result[0]["record_data"] == {
        "production_date": "2026-11-22",
        "product_code": "MDP-100-155",
        "line": "AGRILINE",
        "stop_time": "23:50:00",
        "resume_time": "00:20:00",
        "category": "BD",
        "source_column_i": "Filler Machine",
        "source_column_j": "Seaming Machine",
        "remarks": "Stop for maintenance",
    }
    assert result[0]["derived"] == {"downtime_minutes": "30.0000", "downtime_hours": "0.5000"}
    assert result[0]["product_name"] == "DPGP"


def test_dmr_contract_skips_blank_rows_and_rejects_partial_rows():
    result = normalize_dmr_production_records([
        {"row_index": 1, "record_data": {"A": "", "B": "", "C": ""}},
        row(2),
    ])
    assert len(result) == 1
    assert result[0]["row_index"] == 2
    with pytest.raises(DmrProductionValidationError, match="required fields"):
        normalize_dmr_production_records([{"row_index": 3, "record_data": {"A": "2026-11-22", "B": "MDP-100-155"}}])


@pytest.mark.parametrize("field,value", [
    ("F", "30"),
    ("G", "0.5"),
    ("L", "DPGP"),
])
def test_dmr_contract_rejects_calculated_and_lookup_columns(field, value):
    with pytest.raises(DmrProductionValidationError, match="Calculated, lookup"):
        normalize_dmr_production_records([row(**{field: value})])


def test_dmr_contract_rejects_unknown_category_and_additional_option():
    with pytest.raises(DmrProductionValidationError, match="valid Category"):
        normalize_dmr_production_records([row(H="UNKNOWN")])
    with pytest.raises(DmrProductionValidationError, match="valid column I"):
        normalize_dmr_production_records([row(I="Not an approved source option")])


def test_dmr_contract_accepts_new_product_code_as_text_because_source_validation_is_broken():
    result = normalize_dmr_production_records([row(B="NEW-CODE-2026")])
    assert result[0]["record_data"]["product_code"] == "NEW-CODE-2026"
    assert result[0]["product_name"] == "Other"


def test_dmr_contract_rejects_invalid_date_time_and_overlong_remarks():
    with pytest.raises(DmrProductionValidationError, match="Date must"):
        normalize_dmr_production_records([row(A="11/22/2026")])
    with pytest.raises(DmrProductionValidationError, match="Stop must"):
        normalize_dmr_production_records([row(D="25:80")])
    with pytest.raises(DmrProductionValidationError, match="Remarks must be 1,000"):
        normalize_dmr_production_records([row(K="x" * 1001)])


def test_dmr_downtime_matches_mod_formula_for_same_and_overnight_times():
    assert calculate_downtime("08:00:00", "08:00:00") == {
        "downtime_minutes": "0.0000", "downtime_hours": "0.0000"
    }
    assert calculate_downtime("22:15:00", "00:45:00") == {
        "downtime_minutes": "150.0000", "downtime_hours": "2.5000"
    }


def test_dmr_update_revalidates_complete_record_and_returns_only_changed_fields():
    current = {
        "production_date": "2026-11-22",
        "product_code": "MDP-100-155",
        "line": "AGRILINE",
        "stop_time": "23:50:00",
        "resume_time": "00:20:00",
        "category": "BD",
        "source_column_i": "Filler Machine",
        "source_column_j": "Seaming Machine",
        "remarks": "Stop for maintenance",
    }
    result = normalize_dmr_production_changes(current, {"K": "Corrected remarks"})
    assert result["changes"] == {"remarks": "Corrected remarks"}
    assert result["derived"]["downtime_minutes"] == "30.0000"
    assert normalize_dmr_production_changes(current, {"K": current["remarks"]})["changes"] == {}


def test_dmr_update_rejects_attempt_to_edit_derived_fields():
    current = {
        "production_date": "2026-11-22", "product_code": "MDP-100-155",
        "line": "AGRILINE", "stop_time": "23:50:00", "resume_time": "00:20:00",
        "category": "BD", "source_column_i": None, "source_column_j": None, "remarks": None,
    }
    with pytest.raises(DmrProductionValidationError, match="Calculated, lookup"):
        normalize_dmr_production_changes(current, {"F": "90"})


import time

from tfi_backend.app import create_app
from tfi_backend.config import Settings
from tfi_backend.session_store import SessionVault


class FakeDmrGateway:
    def __init__(self, permissions=None):
        self.permissions = permissions or [
            "dmr_production.view", "dmr_production.create", "dmr_production.edit"
        ]
        self.created = []
        self.updated = []
        self.filters = []
        self.record = {
            "id": "00000000-0000-0000-0000-000000000901",
            "production_date": "2026-11-22",
            "product_code": "MDP-100-155",
            "line": "AGRILINE",
            "stop_time": "23:50:00",
            "resume_time": "00:20:00",
            "category": "BD",
            "source_column_i": "Filler Machine",
            "source_column_j": "Seaming Machine",
            "remarks": "Stop for maintenance",
            "version": 1,
            "record_status": "active",
        }

    def sign_in_with_password(self, email, password):
        return {
            "user_id": "user-1", "email": email, "access_token": "access",
            "refresh_token": "refresh", "expires_at": time.time() + 3600,
        }

    def get_access_context(self, access_token):
        return {
            "profile": {"user_id": "user-1", "email": "admin@example.test",
                        "display_name": "Test Admin", "account_status": "active"},
            "roles": [{"role_key": "system_admin"}],
            "permissions": list(self.permissions),
        }

    def sign_out(self, access_token):
        return None

    def get_dmr_production_reference_data(self, access_token):
        return {}

    def get_dmr_production_records(self, access_token, **kwargs):
        self.filters.append(kwargs)
        return [self.record]

    def get_dmr_production_record(self, access_token, record_id):
        return self.record if record_id == self.record["id"] else None

    def get_dmr_production_revisions(self, access_token, record_id):
        return [{"version": 2, "changed_fields": ["remarks"]}]

    def create_dmr_production_records(self, access_token, records):
        self.created.extend(records)
        return {"inserted": len(records), "duplicates": 0, "conflicts": 0, "results": []}

    def update_dmr_production_record(self, access_token, record_id, expected_version, changes, change_reason=None):
        self.updated.append((record_id, expected_version, changes, change_reason))
        return {"changed": True, "id": record_id, "version": expected_version + 1}


def build_dmr_app(gateway=None):
    settings = Settings(
        supabase_url="https://slfjqrkxnsgdaturaguw.supabase.co",
        publishable_key="sb_publishable_test",
        host="127.0.0.1",
        port=5100,
        idle_timeout_seconds=0,
    )
    return create_app(settings, gateway or FakeDmrGateway(), SessionVault())


def dmr_login(client):
    return client.post(
        "/api/auth/login",
        json={"email": "admin@example.test", "password": "correct"},
        headers={"Origin": "http://localhost"},
    )


def test_dmr_api_catalog_and_records_are_permission_gated_and_source_aligned():
    gateway = FakeDmrGateway()
    client = build_dmr_app(gateway).test_client()
    assert dmr_login(client).status_code == 200
    catalog = client.get("/api/dmr-production/catalog")
    assert catalog.status_code == 200
    payload = catalog.get_json()
    assert len(payload["catalog"]["product_codes"]) == 58
    assert payload["permissions"] == {"view": True, "create": True, "edit": True}
    records = client.get("/api/dmr-production/records?date_from=2026-11-01&category=BD")
    assert records.status_code == 200
    assert len(records.get_json()["records"]) == 1
    assert gateway.filters[0]["date_from"] == "2026-11-01"
    assert gateway.filters[0]["category"] == "BD"


def test_dmr_api_rejects_invalid_date_filters():
    client = build_dmr_app().test_client()
    assert dmr_login(client).status_code == 200
    response = client.get("/api/dmr-production/records?date_from=not-a-date")
    assert response.status_code == 400
    assert response.get_json()["code"] == "invalid_date_filter"


def test_dmr_api_create_normalizes_source_inputs_and_returns_created_status():
    gateway = FakeDmrGateway()
    client = build_dmr_app(gateway).test_client()
    assert dmr_login(client).status_code == 200
    response = client.post("/api/dmr-production/records", json={"records": [row()]})
    assert response.status_code == 201
    saved = gateway.created[0]["record_data"]
    assert saved["source_column_i"] == "Filler Machine"
    assert saved["source_column_j"] == "Seaming Machine"
    assert saved["product_code"] == "MDP-100-155"


def test_dmr_api_create_rejects_incomplete_and_derived_inputs():
    client = build_dmr_app().test_client()
    assert dmr_login(client).status_code == 200
    incomplete = client.post(
        "/api/dmr-production/records",
        json={"records": [{"row_index": 1, "record_data": {"A": "2026-11-22", "B": "MDP-100-155"}}]},
    )
    assert incomplete.status_code == 400
    derived = client.post("/api/dmr-production/records", json={"records": [row(F="30")]})
    assert derived.status_code == 400


def test_dmr_api_update_uses_version_and_revision_history():
    gateway = FakeDmrGateway()
    client = build_dmr_app(gateway).test_client()
    assert dmr_login(client).status_code == 200
    record_id = gateway.record["id"]
    response = client.patch(
        f"/api/dmr-production/records/{record_id}",
        json={"expected_version": 1, "changes": {"K": "Corrected downtime note"}, "change_reason": "Clarified event"},
    )
    assert response.status_code == 200
    assert gateway.updated[0][1] == 1
    assert gateway.updated[0][2] == {"remarks": "Corrected downtime note"}
    revisions = client.get(f"/api/dmr-production/records/{record_id}/revisions")
    assert revisions.status_code == 200
    assert revisions.get_json()["revisions"][0]["version"] == 2


def test_dmr_api_denies_create_without_create_permission():
    gateway = FakeDmrGateway(permissions=["dmr_production.view"])
    client = build_dmr_app(gateway).test_client()
    assert dmr_login(client).status_code == 200
    response = client.post("/api/dmr-production/records", json={"records": [row()]})
    assert response.status_code == 403
