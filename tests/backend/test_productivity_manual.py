from __future__ import annotations

import time
from decimal import Decimal
import pytest

from tfi_backend.productivity_contract import (
    INPUT_FIELDS, ProductivityValidationError, inspect_productivity_row,
    normalize_productivity_changes, normalize_productivity_records,
)


def row(row_index=1, **changes):
    data = {
        "production_date": "2026-11-22", "product_code": "MDP-100-155",
        "line": "AGRILINE", "planned_run_hours": "10",
        "actual_output_tins": "85847", "dented": "151", "false_seam": "1",
        "flipper": "0", "bulged": "0", "panel": "0", "buckling": "0",
    }
    data.update(changes)
    return {"row_index": row_index, "record_data": data}


PRODUCTS = [{"code":"MDP-100-155","name":"MAYON DRY PEAS 155G X 100","capacity":102600,"std":712.5}]
LINES = ["AGRILINE", "MEATLINE"]


def test_productivity_contract_keeps_a_to_k_only_and_source_derived_l_to_v():
    assert INPUT_FIELDS == (
        "production_date", "product_code", "line", "planned_run_hours",
        "actual_output_tins", "dented", "false_seam", "flipper",
        "bulged", "panel", "buckling",
    )
    inspected = inspect_productivity_row(row()["record_data"])
    assert inspected["status"] == "valid"
    assert inspected["calculated"]["total_fg_rejects"] == Decimal("152")
    assert inspected["calculated"]["week"] == 47
    assert inspected["calculated"]["month"] == 11


def test_productivity_normalizes_google_sheets_date_serial_and_blank_rows():
    result = normalize_productivity_records([
        {"row_index":1,"record_data":{field:"" for field in INPUT_FIELDS}},
        row(2, production_date=46312),
    ])
    assert len(result) == 1
    assert result[0]["row_index"] == 2
    assert result[0]["record_data"]["production_date"] == "2026-10-17"


def test_productivity_rejects_client_derived_fields_and_duplicate_date_product():
    with pytest.raises(ProductivityValidationError, match="server-generated"):
        normalize_productivity_records([row(total_fg_rejects="152")])
    with pytest.raises(ProductivityValidationError, match="duplicate"):
        normalize_productivity_records([row(1), row(2, line="MEATLINE")])


def test_productivity_rejects_incomplete_and_invalid_numeric_values():
    assert inspect_productivity_row(row()["record_data"] | {"product_code":""})["status"] == "incomplete"
    assert inspect_productivity_row(row()["record_data"] | {"dented":"NaN"})["status"] == "invalid"
    with pytest.raises(ProductivityValidationError):
        normalize_productivity_records([{"row_index":1,"record_data":{"production_date":"2026-11-22","product_code":"X"}}])


def test_productivity_edit_normalizes_only_changed_source_inputs():
    current = row()["record_data"] | {"version":1,"record_status":"active"}
    changed = normalize_productivity_changes(current, {"actual_output_tins":"85848"})
    assert changed["changes"] == {"actual_output_tins":"85848"}
    assert normalize_productivity_changes(current, {"actual_output_tins":"85847"})["changes"] == {}
    with pytest.raises(ProductivityValidationError, match="read-only"):
        normalize_productivity_changes(current, {"total_fg_rejects":152})


class FakeProductivityGateway:
    def __init__(self, permissions=None):
        self.permissions = permissions or ["productivity.view","productivity.create","productivity.edit"]
        self.created, self.updated, self.filters = [], [], []
        self.record = {
            "id":"00000000-0000-0000-0000-000000000921",
            "production_date":"2026-11-22","product_code":"MDP-100-155","line":"AGRILINE",
            "planned_run_hours":10,"actual_output_tins":85847,
            "dented":151,"false_seam":1,"flipper":0,"bulged":0,"panel":0,"buckling":0,
            "total_fg_rejects":152,"manpower_hours_dmp":120,"target_output_12h_tins":102600,
            "standard_productivity_tins_per_mhr":712.5,"standard_output_actual_mhr":85500,
            "productivity_tins_per_mhr":715.39,"output_attainment":0.8369,"reject_rate":0.00176,
            "iso_week":47,"month_number":11,"product_name":"MAYON DRY PEAS 155G X 100",
            "version":1,"record_status":"active",
        }

    def sign_in_with_password(self, email, password):
        return {"user_id":"user-1","email":email,"access_token":"access","refresh_token":"refresh","expires_at":time.time()+3600}

    def get_access_context(self, access_token):
        return {
            "profile":{"user_id":"user-1","email":"admin@example.test","display_name":"Test Admin","account_status":"active"},
            "roles":[{"role_key":"system_admin"}],"permissions":list(self.permissions),
        }

    def sign_out(self, access_token):
        return None

    def get_productivity_catalog(self, access_token):
        return {"products":PRODUCTS,"lines":LINES,"source":{"sheet_name":"Productivity","sheet_id":1688444278}}

    def get_productivity_records(self, access_token, **kwargs):
        self.filters.append(kwargs)
        return {"records":[self.record],"page":kwargs["page"],"page_size":kwargs["page_size"],"total_count":1,"has_more":False}

    def preview_productivity_row(self, access_token, record_data):
        return {"total_fg_rejects":152,"manpower_hours_dmp":120,"target_output_12h_tins":102600,
                "standard_productivity_tins_per_mhr":712.5,"standard_output_actual_mhr":85500,
                "productivity_tins_per_mhr":715.39,"output_attainment":0.8369,"reject_rate":0.00176,
                "iso_week":47,"month_number":11,"product_name":"MAYON DRY PEAS 155G X 100"}

    def get_productivity_record(self, access_token, record_id):
        return self.record if record_id == self.record["id"] else None

    def get_productivity_revisions(self, access_token, record_id):
        return [{"version":2,"changed_fields":["actual_output_tins"]}]

    def create_productivity_records(self, access_token, records):
        self.created.extend(records)
        return {"inserted":len(records),"duplicates":0,"empty":0,"results":[]}

    def update_productivity_record(self, access_token, record_id, expected_version, changes, change_reason=None):
        self.updated.append((record_id,expected_version,changes,change_reason))
        return {"changed":True,"id":record_id,"version":expected_version+1}


def build_app(gateway=None):
    from tfi_backend.app import create_app
    from tfi_backend.config import Settings
    from tfi_backend.session_store import SessionVault
    settings=Settings(
        supabase_url="https://slfjqrkxnsgdaturaguw.supabase.co",
        publishable_key="sb_publishable_test",host="127.0.0.1",port=5100,idle_timeout_seconds=0,
    )
    return create_app(settings,gateway or FakeProductivityGateway(),SessionVault())


def login(client):
    return client.post("/api/auth/login",json={"email":"admin@example.test","password":"correct"},
                       headers={"Origin":"http://localhost"})


def test_productivity_api_catalog_records_and_batch_save():
    gateway=FakeProductivityGateway()
    client=build_app(gateway).test_client()
    assert login(client).status_code==200
    catalog=client.get("/api/productivity/catalog")
    assert catalog.status_code==200
    assert len(catalog.get_json()["catalog"]["products"])==1
    records=client.get("/api/productivity/records?date_from=2026-11-01&line=AGRILINE")
    assert records.status_code==200
    assert gateway.filters[0]["date_from"]=="2026-11-01"
    response=client.post("/api/productivity/records",json={"records":[row()]})
    assert response.status_code==201
    assert gateway.created[0]["record_data"]["actual_output_tins"]=="85847"


def test_productivity_api_versioned_edit_and_revision_history():
    gateway=FakeProductivityGateway()
    client=build_app(gateway).test_client()
    assert login(client).status_code==200
    record_id=gateway.record["id"]
    updated=client.patch(f"/api/productivity/records/{record_id}",
        json={"expected_version":1,"changes":{"actual_output_tins":"85848"},"change_reason":"Corrected output"})
    assert updated.status_code==200
    assert gateway.updated[0][2]=={"actual_output_tins":"85848"}
    history=client.get(f"/api/productivity/records/{record_id}/revisions")
    assert history.status_code==200
    assert history.get_json()["revisions"][0]["version"]==2


def test_productivity_api_denies_create_without_permission_and_rejects_incomplete_rows():
    gateway=FakeProductivityGateway(permissions=["productivity.view"])
    client=build_app(gateway).test_client()
    assert login(client).status_code==200
    assert client.post("/api/productivity/records",json={"records":[row()]}).status_code==403
    gateway=FakeProductivityGateway()
    client=build_app(gateway).test_client()
    assert login(client).status_code==200
    response=client.post("/api/productivity/records",json={"records":[{"row_index":1,"record_data":{"product_code":"Only"}}]})
    assert response.status_code==400



def test_productivity_api_source_formula_preview():
    gateway=FakeProductivityGateway()
    client=build_app(gateway).test_client()
    assert login(client).status_code==200
    response=client.post("/api/productivity/preview",json={"record_data":{
        "production_date":"2026-11-22","product_code":"MDP-100-155",
        "planned_run_hours":"10","actual_output_tins":"85847","dented":"151","false_seam":"1"
    }})
    assert response.status_code==200
    calculated=response.get_json()["calculated"]
    assert calculated["manpower_hours_dmp"]==120
    assert calculated["total_fg_rejects"]==152
    assert calculated["product_name"]=="MAYON DRY PEAS 155G X 100"
