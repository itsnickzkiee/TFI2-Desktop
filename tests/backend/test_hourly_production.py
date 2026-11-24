from __future__ import annotations

import time
import pytest

from tfi_backend.hourly_production_contract import (
    HOURLY_MODULES,
    HourlyProductionValidationError,
    get_hourly_production_catalog,
    normalize_hourly_production_changes,
    normalize_hourly_production_records,
    validate_hourly_module,
)


PRODUCTS = [{"code": "MDP-100-155", "name": "DPGP"}] + [
    {"code": f"TEST-{i:03d}", "name": f"Product {i}"} for i in range(67)
]


def catalog(module="hourly_meat"):
    return get_hourly_production_catalog(
        module,
        {"products": PRODUCTS, "product_code_count": len(PRODUCTS)},
    )


def item(index=1, **changes):
    data = {
        "production_date": "2026-11-22", "hour": 23,
        "product_code": "MDP-100-155", "target_tins": 120,
        "actual_tins": 115, "remarks": "Night shift",
    }
    data.update(changes)
    return {"row_index": index, "record_data": data}


def test_hourly_catalog_has_separate_source_sheet_metadata_for_all_three_modules():
    assert validate_hourly_module("hourly_meat") == "hourly_meat"
    assert catalog("hourly_meat")["source"]["sheet_id"] == 428082343
    assert catalog("hourly_coding")["source"]["sheet_id"] == 1916766220
    assert catalog("hourly_agri")["source"]["sheet_id"] == 534145404
    assert catalog("hourly_meat")["module_name"] == "Hourly Meat"
    assert catalog("hourly_coding")["module_name"] == "Hourly Coding"
    assert catalog("hourly_agri")["module_name"] == "Hourly Agri"


def test_hourly_catalog_preserves_code_map_options_and_formula_contract():
    result = catalog()
    assert result["product_code_count"] == 68
    assert result["product_names"]["MDP-100-155"] == "DPGP"
    assert result["formula_rules"]["variance"] == "Actual output minus target for the hour"
    assert "same date and product code" in result["formula_rules"]["cumulative_target"]


@pytest.mark.parametrize("module", ["hourly_meat", "hourly_coding", "hourly_agri"])
def test_hourly_normalizes_source_inputs_and_preserves_partial_rows(module):
    result = normalize_hourly_production_records([
        {"row_index": 1, "record_data": {"product_code": "mdp-100-155", "target_tins": "100"}},
    ], catalog(module))
    assert result[0]["record_data"] == {
        "production_date": None, "hour": None, "product_code": "MDP-100-155",
        "target_tins": "100.00", "actual_tins": None, "remarks": None,
    }
    assert result[0]["product_code_reference_status"] == "matched"


def test_hourly_ignores_blank_rows_and_rejects_all_blank_batch():
    result = normalize_hourly_production_records([
        {"row_index": 1, "record_data": {"production_date": "", "hour": "", "product_code": ""}},
        item(2),
    ], catalog())
    assert len(result) == 1 and result[0]["row_index"] == 2
    with pytest.raises(HourlyProductionValidationError, match="at least one"):
        normalize_hourly_production_records([
            {"row_index": 1, "record_data": {"remarks": " "}},
        ], catalog())


@pytest.mark.parametrize("field,value", [
    ("production_date", "11/22/2026"), ("production_date", "2000-01-01"),
    ("hour", 24), ("hour", -1), ("hour", 1.5),
    ("target_tins", -1), ("actual_tins", "NaN"),
    ("remarks", "x" * 401), ("product_code", "x" * 101),
])
def test_hourly_rejects_invalid_source_values(field, value):
    with pytest.raises(HourlyProductionValidationError):
        normalize_hourly_production_records([item(**{field: value})], catalog())


def test_hourly_rejects_calculated_fields_and_unknown_modules():
    with pytest.raises(HourlyProductionValidationError, match="Calculated"):
        normalize_hourly_production_records([item(time_slot="23:00-00:00")], catalog())
    with pytest.raises(HourlyProductionValidationError, match="Choose Hourly"):
        validate_hourly_module("hourly_other")


def test_hourly_flags_unmatched_code_without_replacing_it():
    result = normalize_hourly_production_records([item(product_code="TMWKC-6-2950")], catalog())
    assert result[0]["record_data"]["product_code"] == "TMWKC-6-2950"
    assert result[0]["product_code_reference_status"] == "unmatched"


def test_hourly_update_normalizes_numeric_current_values_and_returns_only_changed_fields():
    current = {
        "production_date": "2026-11-22", "hour": 23, "product_code": "MDP-100-155",
        "target_tins": 120, "actual_tins": 115, "remarks": "Night shift",
    }
    no_change = normalize_hourly_production_changes(current, {
        "production_date": "2026-11-22", "hour": 23, "product_code": "MDP-100-155",
        "target_tins": "120", "actual_tins": "115", "remarks": "Night shift",
    }, catalog())
    assert no_change["changes"] == {}
    changed = normalize_hourly_production_changes(current, {"actual_tins": 110}, catalog())
    assert changed["changes"] == {"actual_tins": "110.00"}


def test_hourly_update_rejects_derived_fields():
    current = {"production_date": None, "hour": None, "product_code": None,
               "target_tins": None, "actual_tins": None, "remarks": None}
    with pytest.raises(HourlyProductionValidationError, match="Calculated"):
        normalize_hourly_production_changes(current, {"variance_tins": 0}, catalog())


class FakeHourlyGateway:
    def __init__(self, permissions=None):
        self.permissions = permissions or [
            f"{module}.{action}" for module in HOURLY_MODULES
            for action in ("view", "create", "edit", "submit", "approve", "review")
        ]
        self.created, self.updated, self.filters = [], [], []
        self.module_key = "hourly_meat"
        self.record = {
            "id": "00000000-0000-0000-0000-000000000911",
            "module_key": "hourly_meat", "production_date": "2026-11-22",
            "hour": 23, "product_code": "MDP-100-155", "target_tins": 120,
            "actual_tins": 115, "remarks": "Night shift",
            "product_code_reference_status": "matched", "version": 1, "record_status": "active",
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

    def get_hourly_production_catalog(self, access_token, module_key):
        return {"products": PRODUCTS, "product_code_count": len(PRODUCTS)}

    def get_hourly_production_records(self, access_token, module_key, **kwargs):
        self.module_key = module_key
        self.filters.append(kwargs)
        return {"records": [self.record], "page": kwargs["page"], "page_size": kwargs["page_size"],
                "total_count": 1, "has_more": False, "summary": {"record_count": 1}}

    def get_hourly_production_record(self, access_token, module_key, record_id):
        return self.record if module_key == self.record["module_key"] and record_id == self.record["id"] else None

    def get_hourly_production_revisions(self, access_token, record_id):
        return [{"version": 2, "changed_fields": ["actual_tins"]}]

    def create_hourly_production_records(self, access_token, module_key, records):
        self.module_key = module_key
        self.created.extend(records)
        return {"inserted": len(records), "duplicates": 0, "empty": 0, "results": []}

    def update_hourly_production_record(self, access_token, module_key, record_id, expected_version, changes, change_reason=None):
        self.updated.append((module_key, record_id, expected_version, changes, change_reason))
        return {"changed": True, "id": record_id, "version": expected_version + 1}


def build_hourly_app(gateway=None):
    from tfi_backend.app import create_app
    from tfi_backend.config import Settings
    from tfi_backend.session_store import SessionVault
    settings = Settings(
        supabase_url="https://slfjqrkxnsgdaturaguw.supabase.co",
        publishable_key="sb_publishable_test", host="127.0.0.1", port=5100,
        idle_timeout_seconds=0,
    )
    return create_app(settings, gateway or FakeHourlyGateway(), SessionVault())


def hourly_login(client):
    return client.post("/api/auth/login", json={"email": "admin@example.test", "password": "correct"},
                       headers={"Origin": "http://localhost"})


@pytest.mark.parametrize("module", ["hourly_meat", "hourly_coding", "hourly_agri"])
def test_hourly_api_catalog_records_and_create_are_module_scoped(module):
    gateway = FakeHourlyGateway()
    client = build_hourly_app(gateway).test_client()
    assert hourly_login(client).status_code == 200
    assert client.get(f"/api/hourly/{module}/catalog").status_code == 200
    assert client.get(f"/api/hourly/{module}/records?page=1&page_size=50").status_code == 200
    response = client.post(f"/api/hourly/{module}/records", json={"records": [item()]})
    assert response.status_code == 201
    assert gateway.module_key == module
    assert gateway.created[0]["record_data"]["product_code"] == "MDP-100-155"


def test_hourly_api_versioned_edit_and_revision_history():
    gateway = FakeHourlyGateway()
    client = build_hourly_app(gateway).test_client()
    assert hourly_login(client).status_code == 200
    record_id = gateway.record["id"]
    response = client.patch(f"/api/hourly/hourly_meat/records/{record_id}",
        json={"expected_version": 1, "changes": {"actual_tins": "110"}, "change_reason": "Correction"})
    assert response.status_code == 200
    assert gateway.updated[0][3] == {"actual_tins": "110.00"}
    history = client.get(f"/api/hourly/hourly_meat/records/{record_id}/revisions")
    assert history.status_code == 200
    assert history.get_json()["revisions"][0]["version"] == 2


def test_hourly_api_denies_create_without_module_permission():
    gateway = FakeHourlyGateway(permissions=["hourly_meat.view"])
    client = build_hourly_app(gateway).test_client()
    assert hourly_login(client).status_code == 200
    response = client.post("/api/hourly/hourly_meat/records", json={"records": [item()]})
    assert response.status_code == 403


def test_hourly_api_rejects_unknown_module_and_invalid_date_range():
    client = build_hourly_app().test_client()
    assert hourly_login(client).status_code == 200
    assert client.get("/api/hourly/not_real/catalog").status_code == 404
    response = client.get("/api/hourly/hourly_meat/records?date_from=2026-11-23&date_to=2026-11-22")
    assert response.status_code == 400
