from __future__ import annotations

import time
import pytest

from tfi_backend.dmr_coding_contract import (
    DmrCodingValidationError,
    calculate_dmr_coding_downtime,
    get_dmr_coding_catalog,
    normalize_dmr_coding_changes,
    normalize_dmr_coding_records,
)


def row(row_index=1, **changes):
    data = {
        "A": "2026-11-22", "B": "MDP-100-155", "C": "AGRILINE",
        "D": "23:50", "E": "00:20", "H": "BD",
        "I": "Change Basket", "J": "Coding ink issue",
    }
    data.update(changes)
    return {"row_index": row_index, "record_data": data}


def test_dmr_coding_catalog_source_suggestions_and_reference_options():
    catalog = get_dmr_coding_catalog()
    assert len(catalog["product_codes"]) == 116
    assert len(catalog["categories"]) == 8
    assert len(catalog["factors"]) == 13
    assert catalog["historical_codes_not_in_master_list"] == ["TMWKC-6-2950"]
    assert catalog["source"]["blank_template_first_row"] == 4775


def test_dmr_coding_normalizes_source_inputs_and_calculates_overnight_duration():
    result = normalize_dmr_coding_records([row()])
    assert result[0]["source_row_number"] == 4775
    assert result[0]["record_data"] == {
        "production_date": "2026-11-22", "product_code": "MDP-100-155",
        "line": "AGRILINE", "stop_time": "23:50:00", "resume_time": "00:20:00",
        "category": "BD", "factor": "Change Basket", "reason": "Coding ink issue",
        "product_code_reference_status": "matched", "completeness_status": "unassessed",
    }
    assert result[0]["derived"] == {"downtime_minutes": "30.0000", "downtime_hours": "0.5000"}
    assert result[0]["product_name"] == "DPGP"


def test_dmr_coding_saves_partial_rows_as_unassessed_and_skips_blank_rows():
    result = normalize_dmr_coding_records([
        {"row_index": 1, "record_data": {"A": "", "B": "", "C": ""}},
        {"row_index": 2, "record_data": {"B": "MDP-100-155", "J": "Reason only"}},
    ])
    assert len(result) == 1
    assert result[0]["row_index"] == 2
    assert result[0]["record_data"]["completeness_status"] == "unassessed"
    assert result[0]["record_data"]["production_date"] is None


def test_dmr_coding_preserves_unmatched_historical_code_without_substitution():
    result = normalize_dmr_coding_records([row(B="TMWKC-6-2950")])
    assert result[0]["record_data"]["product_code"] == "TMWKC-6-2950"
    assert result[0]["record_data"]["product_code_reference_status"] == "unmatched"
    assert result[0]["product_name"] == "Other"


@pytest.mark.parametrize("field,value", [("F", "30"), ("G", "0.5"), ("K", "DPGP")])
def test_dmr_coding_rejects_calculated_or_lookup_columns(field, value):
    with pytest.raises(DmrCodingValidationError, match="Calculated or unsupported"):
        normalize_dmr_coding_records([row(**{field: value})])


def test_dmr_coding_rejects_invalid_category_and_factor():
    with pytest.raises(DmrCodingValidationError, match="Category"):
        normalize_dmr_coding_records([row(H="UNKNOWN")])
    with pytest.raises(DmrCodingValidationError, match="Factor"):
        normalize_dmr_coding_records([row(I="Unknown factor")])


def test_dmr_coding_rejects_invalid_date_time_and_overlong_reason():
    with pytest.raises(DmrCodingValidationError, match="Date"):
        normalize_dmr_coding_records([row(A="11/22/2026")])
    with pytest.raises(DmrCodingValidationError, match="Stop"):
        normalize_dmr_coding_records([row(D="25:99")])
    with pytest.raises(DmrCodingValidationError, match="Reason"):
        normalize_dmr_coding_records([row(J="x" * 1001)])


def test_dmr_coding_downtime_matches_source_mod_formula_and_blank_times():
    assert calculate_dmr_coding_downtime("23:50:00", "00:20:00") == {
        "downtime_minutes": "30.0000", "downtime_hours": "0.5000"
    }
    assert calculate_dmr_coding_downtime("08:00:00", "08:00:00") == {
        "downtime_minutes": "0.0000", "downtime_hours": "0.0000"
    }
    assert calculate_dmr_coding_downtime("08:00:00", None) == {
        "downtime_minutes": None, "downtime_hours": None
    }


def test_dmr_coding_update_allows_partial_record_and_tracks_changed_fields():
    current = {
        "production_date": None, "product_code": "TMWKC-6-2950", "line": "AGRILINE",
        "stop_time": None, "resume_time": None, "category": None, "factor": None,
        "reason": "Existing reason", "product_code_reference_status": "unmatched",
    }
    result = normalize_dmr_coding_changes(current, {"J": "Corrected reason"})
    assert result["changes"] == {"reason": "Corrected reason"}
    assert result["derived"] == {"downtime_minutes": None, "downtime_hours": None}


def test_dmr_coding_update_rejects_derived_field_edit():
    current = {"production_date": None, "product_code": None, "line": None, "stop_time": None,
               "resume_time": None, "category": None, "factor": None, "reason": None,
               "product_code_reference_status": "not_entered"}
    with pytest.raises(DmrCodingValidationError, match="Calculated, lookup"):
        normalize_dmr_coding_changes(current, {"K": "Other"})


class FakeDmrCodingGateway:
    def __init__(self, permissions=None):
        self.permissions = permissions or ["dmr_coding.view", "dmr_coding.create", "dmr_coding.edit"]
        self.created, self.updated, self.filters = [], [], []
        self.record = {
            "id": "00000000-0000-0000-0000-000000000902",
            "production_date": "2026-11-22", "product_code": "MDP-100-155",
            "line": "AGRILINE", "stop_time": "23:50:00", "resume_time": "00:20:00",
            "category": "BD", "factor": "Change Basket", "reason": "Coding ink issue",
            "product_code_reference_status": "matched", "completeness_status": "unassessed",
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

    def get_dmr_coding_reference_data(self, access_token):
        return {}

    def get_dmr_coding_records(self, access_token, **kwargs):
        self.filters.append(kwargs)
        return [self.record]

    def get_dmr_coding_record(self, access_token, record_id):
        return self.record if record_id == self.record["id"] else None

    def get_dmr_coding_revisions(self, access_token, record_id):
        return [{"version": 2, "changed_fields": ["reason"]}]

    def create_dmr_coding_records(self, access_token, records):
        self.created.extend(records)
        return {"inserted": len(records), "duplicates": 0, "empty": 0, "results": []}

    def update_dmr_coding_record(self, access_token, record_id, expected_version, changes, change_reason=None):
        self.updated.append((record_id, expected_version, changes, change_reason))
        return {"changed": True, "id": record_id, "version": expected_version + 1}


def build_dmr_coding_app(gateway=None):
    from tfi_backend.app import create_app
    from tfi_backend.config import Settings
    from tfi_backend.session_store import SessionVault
    settings = Settings(
        supabase_url="https://slfjqrkxnsgdaturaguw.supabase.co",
        publishable_key="sb_publishable_test", host="127.0.0.1", port=5100,
        idle_timeout_seconds=0,
    )
    return create_app(settings, gateway or FakeDmrCodingGateway(), SessionVault())


def dmr_coding_login(client):
    return client.post("/api/auth/login", json={"email": "admin@example.test", "password": "correct"},
                       headers={"Origin": "http://localhost"})


def test_dmr_coding_api_catalog_and_records_are_permission_gated():
    gateway = FakeDmrCodingGateway()
    client = build_dmr_coding_app(gateway).test_client()
    assert dmr_coding_login(client).status_code == 200
    catalog = client.get("/api/dmr-coding/catalog")
    assert catalog.status_code == 200
    assert len(catalog.get_json()["catalog"]["product_codes"]) == 116
    records = client.get("/api/dmr-coding/records?date_from=2026-11-01&category=BD")
    assert records.status_code == 200
    assert len(records.get_json()["records"]) == 1
    assert gateway.filters[0]["date_from"] == "2026-11-01"


def test_dmr_coding_api_create_partial_record_and_update_revision():
    gateway = FakeDmrCodingGateway()
    client = build_dmr_coding_app(gateway).test_client()
    assert dmr_coding_login(client).status_code == 200
    response = client.post("/api/dmr-coding/records", json={"records": [row(B="TMWKC-6-2950")]})
    assert response.status_code == 201
    assert gateway.created[0]["record_data"]["product_code_reference_status"] == "unmatched"
    record_id = gateway.record["id"]
    updated = client.patch(
        f"/api/dmr-coding/records/{record_id}",
        json={"expected_version": 1, "changes": {"J": "Corrected reason"}, "change_reason": "Clarified note"},
    )
    assert updated.status_code == 200
    assert gateway.updated[0][2] == {"reason": "Corrected reason"}
    history = client.get(f"/api/dmr-coding/records/{record_id}/revisions")
    assert history.status_code == 200
    assert history.get_json()["revisions"][0]["version"] == 2


def test_dmr_coding_api_denies_create_without_permission():
    gateway = FakeDmrCodingGateway(permissions=["dmr_coding.view"])
    client = build_dmr_coding_app(gateway).test_client()
    assert dmr_coding_login(client).status_code == 200
    response = client.post("/api/dmr-coding/records", json={"records": [row()]})
    assert response.status_code == 403
