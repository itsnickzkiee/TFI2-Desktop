from __future__ import annotations

import time

from tfi_backend.app import create_app
from tfi_backend.config import Settings
from tfi_backend.product_entry_contract import (
    PRODUCT_ENTRY_BLOCKS,
    ProductEntryValidationError,
    get_product_entry_catalog,
    normalize_product_entry_changes,
    normalize_product_entry_records,
)
from tfi_backend.session_store import SessionVault


def test_product_entry_manifest_preserves_all_39_separate_blocks():
    catalog = get_product_entry_catalog()
    assert len(catalog["blocks"]) == 39
    assert len(PRODUCT_ENTRY_BLOCKS) == 39
    assert len({block["product_key"] for block in catalog["blocks"]}) == 39
    assert all(block["editable_columns"] for block in catalog["blocks"])
    assert all(block["product_codes"] for block in catalog["blocks"])
    assert catalog["source"]["sheet_id"] == 545274882
    assert catalog["source"]["column_count"] == 164


def test_product_entry_contract_accepts_source_valid_block_values():
    rows = normalize_product_entry_records("BLK_01", [{
        "A": "2026-11-21",
        "B": "MDP-100-155",
        "D": "PR-2026-001",
        "E": "2",
        "DH": "Reviewed",
    }])
    assert rows[0]["block_key"] == "BLK_01"
    assert rows[0]["product_key"] == "DPGP"
    assert rows[0]["product_code"] == "MDP-100-155"
    assert rows[0]["pr_number"] == "PR-2026-001"
    assert rows[0]["review_status"] == "Reviewed"
    assert rows[0]["record_data"] == {
        "A": "2026-11-21",
        "B": "MDP-100-155",
        "D": "PR-2026-001",
        "E": "2",
        "DH": "Reviewed",
    }
    assert rows[0]["completeness_status"] == "unassessed"


def test_product_entry_product_code_options_are_block_specific():
    normalize_product_entry_records("BLK_02", [{"B": "MGB-48-225"}])
    try:
        normalize_product_entry_records("BLK_01", [{"B": "MGB-48-225"}])
    except ProductEntryValidationError as error:
        assert "not valid for" in str(error)
    else:
        raise AssertionError("A product code from another family block was accepted.")


def test_product_entry_rejects_formula_hidden_and_trailing_columns():
    for row in ({"F": "calculated"}, {"Z": "hidden"}, {"FH": "unmapped"}):
        try:
            normalize_product_entry_records("BLK_01", [row])
        except ProductEntryValidationError as error:
            assert "hidden, calculated, or unsupported" in str(error)
        else:
            raise AssertionError(f"Unsupported Product Entry field was accepted: {row}")


def test_product_entry_review_status_uses_each_blocks_review_column():
    rows = normalize_product_entry_records("BLK_39", [{"CA": "For Verification of Data"}])
    assert rows[0]["review_status"] == "For Verification of Data"
    try:
        normalize_product_entry_records("BLK_39", [{"CA": "Approved"}])
    except ProductEntryValidationError as error:
        assert "review status" in str(error)
    else:
        raise AssertionError("An unapproved review status was accepted.")


def test_product_entry_allows_blank_rows_and_preserves_incomplete_values():
    rows = normalize_product_entry_records("BLK_01", [{}, {"D": "PR-ONLY"}])
    assert rows[0]["record_data"] == {}
    assert rows[1]["record_data"] == {"D": "PR-ONLY"}
    assert rows[1]["product_code"] is None


def test_product_entry_rejects_invalid_batch_and_nested_cell_values():
    for records in ([], [{}] * 41, [{"E": {"nested": "value"}}], [{"E": True}]):
        try:
            normalize_product_entry_records("BLK_01", records)
        except ProductEntryValidationError:
            pass
        else:
            raise AssertionError(f"Invalid Product Entry request was accepted: {records!r}")


def test_product_entry_update_contract_only_returns_valid_changed_cells():
    result = normalize_product_entry_changes(
        "BLK_01", {"B": "MDP-100-155", "DH": "Cancelled", "E": ""}
    )
    assert result["changes"] == {
        "B": "MDP-100-155", "DH": "Cancelled", "E": None
    }
    assert result["product_code"] == "MDP-100-155"
    assert result["review_status"] == "Cancelled"


def test_product_entry_update_contract_preserves_explicit_field_clears():
    result = normalize_product_entry_changes(
        "BLK_01", {"E": None, "DH": ""}
    )
    assert result["changes"] == {"E": None, "DH": None}


class FakeGateway:
    def __init__(self, permissions=None):
        self.permissions = permissions or [
            "product_entry.view", "product_entry.create", "product_entry.edit"
        ]
        self.created = []
        self.updated = []
        self.filters = []
        self.record = {
            "id": "00000000-0000-0000-0000-000000000123",
            "block_key": "BLK_01",
            "product_key": "DPGP",
            "record_data": {"B": "MDP-100-155"},
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

    def get_product_entry_catalog(self, access_token):
        return get_product_entry_catalog()

    def get_product_entry_records(self, access_token, **kwargs):
        self.filters.append(kwargs)
        return [{"id": self.record["id"], "block_key": kwargs["block_key"]}]

    def get_product_entry_record(self, access_token, record_id):
        return self.record if record_id == self.record["id"] else None

    def get_product_entry_revisions(self, access_token, record_id):
        return [{"version": 2, "changed_columns": ["E"]}]

    def create_product_entry_records(self, access_token, block_key, records):
        self.created = [block_key, list(records)]
        return {
            "block_key": block_key,
            "inserted": 1,
            "duplicates": 0,
            "empty": 0,
            "results": [{"row_index": 1, "status": "inserted"}],
        }

    def update_product_entry_record(
        self, access_token, record_id, expected_version, changes, change_reason=None
    ):
        self.updated.append((record_id, expected_version, changes, change_reason))
        return {"id": record_id, "changed": True, "version": expected_version + 1}


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


def test_product_entry_catalog_requires_view_permission_and_returns_39_blocks():
    client = build_app().test_client()
    assert login(client).status_code == 200
    response = client.get("/api/product-entry/catalog")
    assert response.status_code == 200
    assert len(response.get_json()["catalog"]["blocks"]) == 39


def test_product_entry_records_filter_and_create_routes_use_selected_block():
    gateway = FakeGateway()
    client = build_app(gateway).test_client()
    assert login(client).status_code == 200

    listed = client.get(
        "/api/product-entry/records?block_key=BLK_01&page=2&page_size=25&product_code=MDP-100-155"
    )
    assert listed.status_code == 200
    assert gateway.filters[-1] == {
        "block_key": "BLK_01",
        "limit": 25,
        "offset": 25,
        "date_from": None,
        "date_to": None,
        "product_code": "MDP-100-155",
        "pr_number": None,
        "review_status": None,
    }

    saved = client.post(
        "/api/product-entry/records",
        json={
            "block_key": "BLK_01",
            "records": [{"A": "2026-11-21", "B": "MDP-100-155", "DH": "Reviewed"}],
        },
        headers={"Origin": "http://localhost"},
    )
    assert saved.status_code == 201
    assert gateway.created == [
        "BLK_01",
        [{"A": "2026-11-21", "B": "MDP-100-155", "DH": "Reviewed"}],
    ]


def test_product_entry_create_rejects_cross_block_code_before_database_write():
    gateway = FakeGateway()
    client = build_app(gateway).test_client()
    assert login(client).status_code == 200
    response = client.post(
        "/api/product-entry/records",
        json={"block_key": "BLK_01", "records": [{"B": "MGB-48-225"}]},
        headers={"Origin": "http://localhost"},
    )
    assert response.status_code == 400
    assert gateway.created == []


def test_product_entry_update_uses_record_block_and_expected_version():
    gateway = FakeGateway()
    client = build_app(gateway).test_client()
    assert login(client).status_code == 200
    record_id = gateway.record["id"]
    response = client.patch(
        f"/api/product-entry/records/{record_id}",
        json={
            "expected_version": 1,
            "changes": {"E": "4"},
            "change_reason": "Corrected batch count",
        },
        headers={"Origin": "http://localhost"},
    )
    assert response.status_code == 200
    assert gateway.updated == [
        (record_id, 1, {"E": "4"}, "Corrected batch count")
    ]


def test_product_entry_create_is_denied_without_permission():
    gateway = FakeGateway(permissions=["product_entry.view"])
    client = build_app(gateway).test_client()
    assert login(client).status_code == 200
    response = client.post(
        "/api/product-entry/records",
        json={"block_key": "BLK_01", "records": [{"B": "MDP-100-155"}]},
        headers={"Origin": "http://localhost"},
    )
    assert response.status_code == 403
    assert response.get_json()["code"] == "operational_permission_denied"
