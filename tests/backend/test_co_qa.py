from __future__ import annotations

import time

from tfi_backend.app import create_app
from tfi_backend.config import Settings
from tfi_backend.co_qa_contract import (
    CO_QA_COST_FIELDS,
    CO_QA_PROJECTION_BLOCKS,
    get_co_qa_source_contract,
    normalize_co_qa_cost_changes,
    project_co_qa_product_entry_record,
)
from tfi_backend.product_entry_contract import get_product_entry_catalog
from tfi_backend.session_store import SessionVault


def test_co_qa_cost_contract_keeps_all_six_source_columns_distinct():
    assert [field["column"] for field in CO_QA_COST_FIELDS] == ["Y", "Z", "AA", "AB", "AC", "AD"]
    assert [field["key"] for field in CO_QA_COST_FIELDS] == [
        "labels_cost_per_piece_y",
        "box_cost_per_piece_z",
        "can_cost_per_piece_aa",
        "lid_cover_cost_per_piece_ab",
        "labels_cost_per_piece_ac",
        "box_cost_per_piece_ad",
    ]
    contract = get_co_qa_source_contract()
    assert contract["cost_storage"]["key"] == "product_entry_record_id"
    assert contract["cost_storage"]["versioned"] is True
    assert contract["capabilities"]["save_cost_inputs"] is True
    assert contract["capabilities"]["import_promote"] is False
    assert contract["dependencies"]["co_qa_projection_blocks"] == 31
    assert len(contract["projection_blocks"]) == 31


def test_co_qa_cost_normalizer_accepts_partial_numeric_inputs_and_explicit_clears():
    assert normalize_co_qa_cost_changes({"Y": "0.25", "AA": 1.5, "AD": None}) == {
        "Y": "0.250000",
        "AA": "1.500000",
        "AD": None,
    }



def test_co_qa_cost_normalizer_rejects_negative_nonfinite_and_boolean_values():
    for value in ("-0.01", float("inf"), float("nan"), True):
        try:
            normalize_co_qa_cost_changes({"Y": value})
        except ValueError:
            pass
        else:
            raise AssertionError(f"Invalid CO QA unit cost was accepted: {value!r}")


def test_co_qa_cost_normalizer_enforces_numeric_precision_and_supported_columns():
    for changes in (
        {"Y": "0.0000001"},
        {"Y": "100000000"},
        {"UNKNOWN": "1"},
        {},
        {"Y": {"nested": "1"}},
    ):
        try:
            normalize_co_qa_cost_changes(changes)
        except ValueError:
            pass
        else:
            raise AssertionError(f"Invalid CO QA cost payload was accepted: {changes!r}")


class FakeGateway:
    def __init__(self, permissions=None):
        self.permissions = permissions or [
            "co_qa.view", "co_qa.create", "co_qa.edit", "product_entry.view"
        ]
        self.record_filters = []
        self.cost_saves = []
        self.record = {
            "id": "00000000-0000-0000-0000-000000000123",
            "block_key": "BLK_01",
            "product_key": "DPGP",
            "production_date_text": "2026-11-22",
            "product_code": "MDP-100-155",
            "pr_number": "PR-001",
            "record_data": {"A": "2026-11-22", "B": "MDP-100-155", "G": "2"},
            "costs": {"Y": "0.250000", "Z": None, "AA": "1.500000", "AB": None, "AC": None, "AD": None},
            "cost_version": 1,
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

    def get_co_qa_records(self, access_token, **kwargs):
        self.record_filters.append(kwargs)
        return [self.record]

    def upsert_co_qa_cost_record(self, access_token, record_id, expected_version, costs, change_reason=None):
        self.cost_saves.append((record_id, expected_version, costs, change_reason))
        return {
            "product_entry_record_id": record_id,
            "created": expected_version is None,
            "changed": True,
            "version": 1 if expected_version is None else expected_version + 1,
            "costs": costs,
        }

    def get_co_qa_cost_revisions(self, access_token, record_id):
        return [{"version": 2, "changed_columns": ["AA"], "product_entry_record_id": record_id}]


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


def test_co_qa_catalog_requires_view_and_exposes_product_entry_block_selector():
    client = build_app().test_client()
    assert login(client).status_code == 200
    response = client.get("/api/co-qa/catalog")
    assert response.status_code == 200
    payload = response.get_json()
    assert payload["catalog"]["cost_storage"]["key"] == "product_entry_record_id"
    assert len(payload["product_entry_catalog"]["blocks"]) == 31
    assert payload["catalog"]["dependencies"]["co_qa_projection_blocks"] == 31
    assert payload["permissions"]["edit"] is True


def test_co_qa_record_list_passes_block_date_product_and_pagination_filters():
    gateway = FakeGateway()
    client = build_app(gateway).test_client()
    assert login(client).status_code == 200
    response = client.get(
        "/api/co-qa/records?block_key=BLK_01&page=2&page_size=25&date_from=2026-11-01&date_to=2026-11-30&product_code=MDP-100-155&pr_number=PR-001"
    )
    assert response.status_code == 200
    assert response.get_json()["records"][0]["cost_version"] == 1
    assert response.get_json()["records"][0]["qa_projection"]["source_range"] == "CA:CR"
    assert set(response.get_json()["records"][0]["qa_calculations"]) == {"AE", "AF", "AG", "AH"}
    assert response.get_json()["records"][0]["qa_calculations"]["AE"]["status"] == "calculated"
    assert gateway.record_filters[-1]["block_key"] == "BLK_01"
    assert gateway.record_filters[-1]["block_keys"] is None
    assert gateway.record_filters[-1] == {
        "block_key": "BLK_01",
        "block_keys": None,
        "limit": 25,
        "offset": 25,
        "date_from": "2026-11-01",
        "date_to": "2026-11-30",
        "product_code": "MDP-100-155",
        "pr_number": "PR-001",
    }


def test_co_qa_record_list_rejects_invalid_block_and_cross_block_product_code():
    client = build_app().test_client()
    assert login(client).status_code == 200
    bad_block = client.get("/api/co-qa/records?block_key=NOT_A_BLOCK")
    assert bad_block.status_code == 400
    bad_code = client.get("/api/co-qa/records?block_key=BLK_01&product_code=MGB-48-225")
    assert bad_code.status_code == 400


def test_co_qa_cost_save_uses_product_entry_uuid_and_expected_version():
    gateway = FakeGateway()
    client = build_app(gateway).test_client()
    assert login(client).status_code == 200
    record_id = gateway.record["id"]
    response = client.put(
        f"/api/co-qa/records/{record_id}/costs",
        json={
            "expected_version": 1,
            "costs": {"AA": "1.75", "AD": None},
            "change_reason": "Updated unit costs",
        },
        headers={"Origin": "http://localhost"},
    )
    assert response.status_code == 200
    assert gateway.cost_saves[-1] == (
        record_id,
        1,
        {"AA": "1.750000", "AD": None},
        "Updated unit costs",
    )


def test_co_qa_cost_create_uses_null_expected_version():
    gateway = FakeGateway()
    client = build_app(gateway).test_client()
    assert login(client).status_code == 200
    record_id = gateway.record["id"]
    response = client.put(
        f"/api/co-qa/records/{record_id}/costs",
        json={"costs": {"Y": "0.15"}},
        headers={"Origin": "http://localhost"},
    )
    assert response.status_code == 201
    assert gateway.cost_saves[-1][1] is None


def test_co_qa_cost_save_rejects_invalid_id_version_and_cost_payload():
    client = build_app().test_client()
    assert login(client).status_code == 200
    assert client.put("/api/co-qa/records/not-a-uuid/costs", json={"costs": {"Y": "1"}}).status_code == 400
    assert client.put(
        "/api/co-qa/records/00000000-0000-0000-0000-000000000123/costs",
        json={"expected_version": -1, "costs": {"Y": "1"}},
    ).status_code == 400
    invalid = client.put(
        "/api/co-qa/records/00000000-0000-0000-0000-000000000123/costs",
        json={"costs": {"Y": "-1"}},
    )
    assert invalid.status_code == 400
    assert invalid.get_json()["code"] == "co_qa_invalid_costs"


def test_co_qa_cost_revision_history_uses_product_entry_uuid():
    gateway = FakeGateway()
    client = build_app(gateway).test_client()
    assert login(client).status_code == 200
    record_id = gateway.record["id"]
    response = client.get(f"/api/co-qa/records/{record_id}/cost-revisions")
    assert response.status_code == 200
    assert response.get_json()["revisions"][0]["changed_columns"] == ["AA"]


def test_co_qa_endpoints_require_module_and_product_entry_view_permissions():
    gateway = FakeGateway(permissions=["product_entry.view"])
    client = build_app(gateway).test_client()
    assert login(client).status_code == 200
    response = client.get("/api/co-qa/records")
    assert response.status_code == 403
    assert response.get_json()["code"] == "operational_permission_denied"

    source_denied = FakeGateway(permissions=["co_qa.view"])
    client = build_app(source_denied).test_client()
    assert login(client).status_code == 200
    response = client.get("/api/co-qa/records")
    assert response.status_code == 403
    assert response.get_json()["code"] == "co_qa_product_entry_view_required"


def test_co_qa_projection_maps_exactly_31_valid_product_entry_blocks():
    from tfi_backend.product_entry_contract import PRODUCT_ENTRY_BLOCKS

    assert len(CO_QA_PROJECTION_BLOCKS) == 31
    assert len({item["block_key"] for item in CO_QA_PROJECTION_BLOCKS}) == 31
    for item in CO_QA_PROJECTION_BLOCKS:
        block = PRODUCT_ENTRY_BLOCKS[item["block_key"]]
        first, last = item["source_range"].split(":")
        def number(column):
            result = 0
            for char in column:
                result = result * 26 + ord(char) - 64
            return result
        columns = []
        for value in range(number(first), number(last) + 1):
            letters = ""
            while value:
                value, remainder = divmod(value - 1, 26)
                letters = chr(65 + remainder) + letters
            columns.append(letters)
        assert len(columns) == 18
        assert set(item["formula_only_columns"]).issubset(set(columns) & set(block["formula_columns"]))
        assert set(item.get("manual_input_columns", [])).issubset(set(columns) & set(block["editable_columns"]))
        assert set(columns).issubset(set(block["editable_columns"]) | set(block["formula_columns"]))


def test_co_qa_projection_calculates_dynamic_product_entry_fields_and_preserves_mixed_manual_inputs():
    source_columns = [
        "CA", "CB", "CC", "CD", "CE", "CF", "CH", "CI",
        "CJ", "CK", "CL", "CM", "CN", "CO", "CP", "CQ", "CR",
    ]
    record_data = {column: "1" for column in source_columns}
    record_data.update({"A": "2026-11-22", "CH": "7", "CR": "45"})
    projected = project_co_qa_product_entry_record({
        "block_key": "BLK_01",
        "record_data": record_data,
    })
    assert projected["source_range"] == "CA:CR"
    assert projected["status"] == "complete"
    assert projected["available_count"] == 18
    assert projected["formula_pending_count"] == 0
    assert projected["missing_count"] == 0
    assert projected["fields"][0]["column"] == "G"
    assert projected["fields"][0]["source_column"] == "CA"
    assert projected["fields"][0]["value"] == "1"
    assert projected["fields"][6]["source_column"] == "CG"
    assert projected["fields"][6]["formula_pending"] is False
    assert projected["fields"][6]["value"] == "14"
    assert projected["fields"][-1]["source_column"] == "CR"
    assert projected["fields"][-1]["value"] == "45"
    assert projected["fields"][-1]["formula_pending"] is False


def test_co_qa_dynamic_source_formula_respects_blank_date_guard():
    projected = project_co_qa_product_entry_record({
        "block_key": "BLK_01",
        "record_data": {"CH": "7", "CR": "45"},
    })
    assert projected["fields"][6]["value"] is None
    assert projected["fields"][6]["formula_pending"] is True


def test_co_qa_projection_marks_non_source_blocks_outside_the_original_spill():
    projected = project_co_qa_product_entry_record({
        "block_key": "BLK_04",
        "record_data": {"A": "2026-11-22", "B": "OTHER"},
    })
    assert projected["status"] == "not_in_co_qa_projection"
    assert projected["fields"] == []


def test_co_qa_default_record_list_is_restricted_to_the_31_source_blocks():
    gateway = FakeGateway()
    client = build_app(gateway).test_client()
    assert login(client).status_code == 200
    response = client.get("/api/co-qa/records")
    assert response.status_code == 200
    assert gateway.record_filters[-1]["block_key"] is None
    assert len(gateway.record_filters[-1]["block_keys"]) == 31
    assert set(gateway.record_filters[-1]["block_keys"]) == {
        item["block_key"] for item in CO_QA_PROJECTION_BLOCKS
    }


def test_co_qa_rejects_product_entry_blocks_not_in_original_co_qa_formula():
    client = build_app().test_client()
    assert login(client).status_code == 200
    response = client.get("/api/co-qa/records?block_key=BLK_04")
    assert response.status_code == 400
    assert response.get_json()["code"] == "co_qa_block_not_projected"


def test_co_qa_calculations_match_the_exact_ae_through_ah_source_formulas():
    from decimal import Decimal
    from tfi_backend.co_qa_contract import calculate_co_qa_formula_outputs

    values = {
        "G": "10", "H": "5", "I": "3", "J": "4", "K": "1", "L": "2", "M": "6",
        "N": "7", "O": "2", "P": "1", "Q": "3", "R": "4", "S": "5", "T": "6",
        "U": "7", "V": "8", "W": "9", "X": "10",
    }
    projection = {
        "status": "complete",
        "fields": [
            {"column": column, "value": value, "formula_pending": False}
            for column, value in values.items()
        ],
    }
    result = calculate_co_qa_formula_outputs(projection, {"AA": "1.50", "AB": "0.25"})
    total = sum(Decimal(value) for value in values.values())
    expected_cans = total - sum(Decimal(values[column]) for column in "NOPQ")
    expected_lids = expected_cans - sum(Decimal(values[column]) for column in "OPQRS")
    assert result["AE"]["value"] == str(expected_cans)
    assert result["AF"]["value"] == str(expected_cans * Decimal("1.50"))
    assert result["AG"]["value"] == str(expected_lids)
    assert result["AH"]["value"] == str(expected_lids * Decimal("0.25"))
    assert all(result[column]["status"] == "calculated" for column in ("AE", "AF", "AG", "AH"))


def test_co_qa_calculations_wait_for_formula_derived_source_fields_and_missing_unit_costs():
    from tfi_backend.co_qa_contract import calculate_co_qa_formula_outputs

    projection = {
        "fields": [
            {"column": column, "value": "1", "formula_pending": column == "M"}
            for column in "GHIJKLMNOPQRSTUVWX"
        ],
    }
    result = calculate_co_qa_formula_outputs(projection, {"AA": None, "AB": None})
    assert result["AE"]["status"] == "pending"
    assert result["AF"]["status"] == "pending"
    assert result["AG"]["status"] == "pending"
    assert result["AH"]["status"] == "pending"
    assert "M" in result["AE"]["reason"]
    assert "AE" in result["AF"]["reason"]


def test_co_qa_formula_outputs_match_spreadsheet_zero_cost_semantics():
    from tfi_backend.co_qa_contract import calculate_co_qa_formula_outputs

    projection = {
        "fields": [
            {"column": column, "value": "1", "formula_pending": False}
            for column in "GHIJKLMNOPQRSTUVWX"
        ],
    }
    result = calculate_co_qa_formula_outputs(projection, {"AA": None, "AB": None})
    assert result["AE"]["status"] == "calculated"
    assert result["AF"]["value"] == "0"
    assert result["AG"]["status"] == "calculated"
    assert result["AH"]["value"] == "0"


def test_co_qa_projection_formula_rules_cover_all_23_dynamic_source_fields_and_nine_manual_mixed_fields():
    dynamic_count = 0
    manual_count = 0
    for block in CO_QA_PROJECTION_BLOCKS:
        rules = block.get("formula_rules") or {}
        dynamic_count += len(rules)
        manual_count += len(block.get("manual_input_columns") or [])
        assert set(rules) == set(block["formula_only_columns"])
        for target, rule in rules.items():
            assert rule["operation"] == "multiply"
            assert rule["factor"] == "2"
            assert rule["source"]
            assert rule["blank_guard"] == "A"
        for column in block.get("manual_input_columns") or []:
            assert column not in block["formula_only_columns"]
    assert dynamic_count == 31
    assert manual_count == 9


def test_co_qa_manual_mixed_source_field_is_preserved_as_an_input_value():
    projected = project_co_qa_product_entry_record({
        "block_key": "BLK_03",
        "record_data": {
            "A": "2026-11-22",
            "CT": "1", "CU": "1", "CV": "1", "CW": "1", "CX": "1",
            "CY": "1", "CZ": "1", "DA": "2", "DB": "1", "DC": "1",
            "DD": "1", "DE": "1", "DF": "1", "DG": "1", "DH": "1",
            "DI": "1", "DJ": "1", "DK": "28",
        },
    })
    assert projected["fields"][6]["source_column"] == "CZ"
    assert projected["fields"][6]["value"] == "4"
    assert projected["fields"][-1]["source_column"] == "DK"
    assert projected["fields"][-1]["value"] == "28"
    assert projected["fields"][-1]["missing"] is False
