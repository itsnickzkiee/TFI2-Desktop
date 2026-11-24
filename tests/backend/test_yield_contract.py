from __future__ import annotations

import time

from tfi_backend.app import create_app
from tfi_backend.config import Settings
from tfi_backend.product_entry_contract import PRODUCT_ENTRY_BLOCKS
from tfi_backend.session_store import SessionVault
from tfi_backend.yield_contract import (
    YieldCalculationError,
    _YieldFormulaEvaluator,
    build_yield_log_record,
    build_yield_map,
    get_yield_year,
    parse_yield_date,
)


def _yield_map_row(
    product="DPGP",
    main="S",
    stage2="V",
    stage3=None,
    bloom="Y",
    lid="BS",
    can="BU",
    box="CT",
    label="CV",
    target="97%",
):
    values = [None] * 23
    values[0] = product
    values[1] = main
    values[2] = "Green Peas % Yield"
    values[3] = stage2
    values[4] = "Brine % Yield"
    values[5] = stage3
    values[6] = "Stage 3 % Yield"
    values[7] = bloom
    values[8] = lid
    values[9] = can
    values[10] = box
    values[11] = label
    values[12] = target
    values[13] = "145"
    return {
        "source_row_number": 5,
        "row_kind": "data",
        "record_status": "active",
        "current_values": values,
    }


def _dpgp_record():
    return {
        "id": "00000000-0000-0000-0000-000000000123",
        "block_key": "BLK_01",
        "product_key": "DPGP",
        "production_date": "2026-11-23",
        "production_date_text": "2026-11-23",
        "product_code": "MDP-100-155",
        "review_status": "Reviewed",
        "version": 1,
        "record_data": {
            "A": "2026-11-23",
            "B": "MDP-100-155",
            "E": "2",
            "G": "100",
            "BV": "100",
            "CA": "1",
            "CB": "2",
            "CD": "3",
            "CE": "4",
            "CF": "8",
            "CG": "5",
            "CH": "6",
            "CI": "2",
            "CJ": "3",
            "CL": "1",
            "CM": "1",
            "CN": "7",
            "CO": "2",
            "CP": "3",
            "CQ": "4",
            "CR": "5",
            "CS": "10",
            "CV": "4",
            "DF": "0.5",
            "DG": "0.8",
        },
    }


def test_yield_map_reads_live_master_data_rows_and_preserves_source_columns():
    mapped = build_yield_map([_yield_map_row()])
    assert mapped["DPGP"]["block_key"] == "BLK_01"
    assert mapped["DPGP"]["main_yield_column"] == "S"
    assert mapped["DPGP"]["stage2_yield_column"] == "V"
    assert mapped["DPGP"]["bloom_rate_column"] == "Y"
    assert mapped["DPGP"]["label_reject_column"] == "CV"
    assert mapped["DPGP"]["yield_target"] == 0.97
    assert mapped["DPGP"]["yield_target_is_placeholder"] is False
    assert build_yield_map([_yield_map_row(target="95%")])["DPGP"]["yield_target_is_placeholder"] is True
    assert mapped["DPGP"]["source_row_number"] == 5


def test_yield_log_calculates_dpgp_metrics_from_source_formula_columns():
    mapped = build_yield_map([_yield_map_row()])
    result = build_yield_log_record(_dpgp_record(), mapped, year=2026)

    assert result["production_date"] == "2026-11-23"
    assert result["product_code"] == "MDP-100-155"
    assert result["total_fg_tins"] == 86788.0
    assert result["main_yield"] == 43515.5 / 180
    assert result["stage2_yield"] == 69453.6 / 9715.2
    assert result["bloom_rate"] == 43515.5 / 90
    assert result["lid_reject"] == 6 / 86822
    assert result["can_reject"] == 22 / 86838
    assert result["box_reject"] == 10 / 877.88
    assert result["label_reject"] == 4.0
    assert result["yield_target"] == 0.97
    assert result["calculation_status"] == "calculated"


def test_yield_formula_iferror_returns_blank_for_division_by_zero():
    block = PRODUCT_ENTRY_BLOCKS["BLK_38"]
    evaluator = _YieldFormulaEvaluator(block, {"T": "0", "U": "5"})
    assert evaluator.cell("V") == ""


def test_yield_formula_sumifs_reads_dmr_production_rows_by_date_code_and_category():
    block = PRODUCT_ENTRY_BLOCKS["BLK_36"]
    evaluator = _YieldFormulaEvaluator(
        block,
        {"A": "2026-11-23", "B": "MAYON-KAONG-001"},
        [
            {
                "production_date": "2026-11-23",
                "product_code": "MAYON-KAONG-001",
                "category": "%",
                "downtime_minutes": "7",
            },
            {
                "production_date": "2026-11-23",
                "product_code": "MAYON-KAONG-001",
                "category": "%",
                "downtime_minutes": "5",
            },
            {
                "production_date": "2026-11-23",
                "product_code": "MAYON-KAONG-001",
                "category": "OTHER",
                "downtime_minutes": "20",
            },
            {
                "production_date": "2026-11-22",
                "product_code": "MAYON-KAONG-001",
                "category": "%",
                "downtime_minutes": "4",
            },
            {
                "production_date": "2026-11-23",
                "product_code": "OTHER",
                "category": "%",
                "downtime_minutes": "9",
            },
        ],
    )
    assert evaluator.cell("DI") == 12


def test_yield_log_month_day_date_uses_kpi_setup_m2_year():
    setup = [{
        "source_row_number": 2,
        "record_status": "active",
        "current_values": ["Daily", "Jan", "1", "1", "All", "All", "AGRILINE", "BD", "Breakdown", "Y", None, "Year", "2026"],
    }]
    assert get_yield_year(setup) == 2026
    assert parse_yield_date("Nov 23", get_yield_year(setup)).isoformat() == "2026-11-23"


class FakeYieldGateway:
    def __init__(self, permissions=None):
        self.permissions = permissions or ["dashboard.view", "master_data.view", "product_entry.view"]
        self.master_rows = {
            "yield_map": [
                {
                    "source_row_number": 2,
                    "row_kind": "instruction",
                    "record_status": "active",
                    "current_values": ["Other 95% targets are placeholders; change or clear them."],
                },
                _yield_map_row(),
            ],
            "kpi_setup": [{
                "source_row_number": 2,
                "row_kind": "data",
                "record_status": "active",
                "current_values": ["Daily", "Jan", "1", "1", "All", "All", "AGRILINE", "BD", "Breakdown", "Y", None, "Year", "2026"],
            }],
        }
        self.source_records = [_dpgp_record()]
        self.source_filters = []
        self.dmr_filters = []

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

    def get_master_data_rows(self, access_token, category_key):
        return list(self.master_rows.get(category_key, []))

    def get_yield_log_source_records(self, access_token, **kwargs):
        self.source_filters.append(kwargs)
        return list(self.source_records)

    def get_dmr_production_records(self, access_token, **kwargs):
        self.dmr_filters.append(kwargs)
        return []


def _test_app(gateway):
    settings = Settings(
        supabase_url="https://slfjqrkxnsgdaturaguw.supabase.co",
        publishable_key="sb_publishable_test",
        host="127.0.0.1",
        port=5100,
        idle_timeout_seconds=0,
    )
    return create_app(settings, gateway, SessionVault())


def _login(client):
    return client.post(
        "/api/auth/login",
        json={"email": "admin@example.test", "password": "correct"},
        headers={"Origin": "http://localhost"},
    )


def test_yield_log_api_returns_calculated_read_only_projection():
    gateway = FakeYieldGateway()
    client = _test_app(gateway).test_client()
    assert _login(client).status_code == 200

    response = client.get("/api/yield/log?limit=50&offset=0&date_from=2026-11-01&date_to=2026-11-30")

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["source"] == "TFI2"
    assert payload["read_only"] is True
    assert payload["mapped_products"] == 1
    assert payload["yield_map_note"] == "Other 95% targets are placeholders; change or clear them."
    assert payload["workbook_year"] == 2026
    assert payload["count"] == 1
    assert payload["records"][0]["main_yield"] == 43515.5 / 180
    assert gateway.source_filters == [{
        "limit": 50,
        "offset": 0,
        "date_from": "2026-11-01",
        "date_to": "2026-11-30",
        "product_key": None,
        "product_code": None,
    }]


def test_yield_log_api_enforces_dashboard_product_entry_and_master_data_permissions():
    gateway = FakeYieldGateway(permissions=["dashboard.view", "master_data.view"])
    client = _test_app(gateway).test_client()
    assert _login(client).status_code == 200

    response = client.get("/api/yield/log")

    assert response.status_code == 403
    assert response.get_json()["code"] == "yield_product_entry_view_required"


def test_yield_log_api_rejects_invalid_date_and_product_mapping():
    gateway = FakeYieldGateway()
    client = _test_app(gateway).test_client()
    assert _login(client).status_code == 200

    invalid_date = client.get("/api/yield/log?date_from=11-23-2026")
    invalid_product = client.get("/api/yield/log?product_key=Unknown")

    assert invalid_date.status_code == 400
    assert invalid_product.status_code == 400

def test_yield_log_api_requires_dmr_view_for_the_source_mapped_dmr_formula():
    gateway = FakeYieldGateway()
    gateway.permissions = ["dashboard.view", "master_data.view", "product_entry.view"]
    gateway.master_rows["yield_map"] = [
        _yield_map_row(
            product="Mayon Kaong",
            main="AW",
            stage2="AQ",
            stage3=None,
            bloom=None,
            lid="CF",
            can="CH",
            box="DG",
            label="DI",
            target=None,
        )
    ]
    block = PRODUCT_ENTRY_BLOCKS["BLK_36"]
    gateway.source_records = [{
        "id": "mayon-kaong-record",
        "block_key": "BLK_36",
        "product_key": "Mayon Kaong",
        "production_date": "2026-11-23",
        "production_date_text": "2026-11-23",
        "product_code": block["product_codes"][0],
        "record_data": {
            "A": "2026-11-23",
            "B": block["product_codes"][0],
        },
    }]
    client = _test_app(gateway).test_client()
    assert _login(client).status_code == 200

    response = client.get("/api/yield/log")

    assert response.status_code == 403
    assert response.get_json()["code"] == "yield_dmr_view_required"
    assert gateway.dmr_filters == []

def test_yield_log_api_accepts_dashboard_product_name_filter():
    gateway = FakeYieldGateway()
    client = _test_app(gateway).test_client()
    assert _login(client).status_code == 200

    response = client.get("/api/yield/log?product_name=DPGP")

    assert response.status_code == 200
    assert gateway.source_filters[0]["product_key"] == "DPGP"
    assert gateway.source_filters[0]["product_code"] is None


def test_yield_log_api_rejects_unknown_dashboard_product_name_filter():
    gateway = FakeYieldGateway()
    client = _test_app(gateway).test_client()
    assert _login(client).status_code == 200

    response = client.get("/api/yield/log?product_name=Unknown%20Product")

    assert response.status_code == 400
    assert response.get_json()["code"] == "yield_product_invalid"
    assert gateway.source_filters == []

def test_yield_log_api_resolves_dashboard_product_name_through_live_code_map():
    gateway = FakeYieldGateway()
    source_block = PRODUCT_ENTRY_BLOCKS["BLK_01"]
    gateway.master_rows["code_map"] = [{
        "source_row_number": 1,
        "row_kind": "data",
        "record_status": "active",
        "current_values": [source_block["product_codes"][0], "Source Catalog Product"],
    }]
    client = _test_app(gateway).test_client()
    assert _login(client).status_code == 200

    response = client.get("/api/yield/log?product_name=Source%20Catalog%20Product")

    assert response.status_code == 200
    assert gateway.source_filters[0]["product_key"] == "DPGP"
