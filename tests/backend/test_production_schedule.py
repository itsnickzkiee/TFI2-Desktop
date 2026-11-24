from __future__ import annotations

import time
from datetime import date

import pytest

from tfi_backend.app import create_app
from tfi_backend.config import Settings
from tfi_backend.production_schedule_contract import (
    ProductionScheduleValidationError,
    normalize_production_schedule_form,
)
from tfi_backend.session_store import SessionVault


GROUP = "MAYON DRY PEAS"
CODE = "MDP-100-155"


def sample_row(source_row_number=8, **values):
    data = {
        "B": GROUP,
        "C": CODE,
        "D": "2",
        "E": "Agri Line",
        "F": "Halal",
        "G": "PS-TEST-001",
        "K": "5000",
        "L": "PCS",
        "M": "1000",
        "O": "FC/IDC TEST",
        "P": "Acceptance test schedule row",
        "R": "12",
    }
    data.update(values)
    return {"source_row_number": source_row_number, "record_data": data}


def make_catalog():
    groups = [GROUP] + [f"PRODUCT GROUP {i:02d}" for i in range(2, 44)]
    products = [{"code": CODE, "product_group": GROUP, "default_shift": 10}]
    return {
        "product_groups": groups,
        "group_codes": {GROUP: [CODE], **{name: [] for name in groups[1:]}},
        "products": products,
        "line_options": ["Meat Line", "Agri Line", "Finishing Line"],
        "area_options": ["Halal", "Non-Halal"],
        "uom": ["PCS", "BXS"],
        "form": {"source_rows": list(range(8, 18))},
        "source": {"schedule_summary": {"source_range": "Schedule Summary!A1:S11000"}},
    }


def test_production_schedule_contract_accepts_source_aligned_inputs_and_ignores_blank_slots():
    normalized = normalize_production_schedule_form(
        {
            "production_date": "2026-11-23",
            "available_pax_total": "50",
            "rows": [
                sample_row(),
                {"source_row_number": 9, "record_data": {"B": "", "C": "", "M": ""}},
            ],
        },
        make_catalog(),
    )
    assert normalized["production_date"] == "2026-11-23"
    assert normalized["available_pax_total"] == "50"
    assert normalized["rows"] == [
        {
            "source_row_number": 8,
            "record_data": {
                "B": GROUP,
                "C": CODE,
                "D": "2",
                "E": "Agri Line",
                "F": "Halal",
                "G": "PS-TEST-001",
                "K": "5000",
                "L": "PCS",
                "M": "1000",
                "O": "FC/IDC TEST",
                "P": "Acceptance test schedule row",
                "R": "12",
            },
        }
    ]


def test_production_schedule_contract_rejects_code_from_another_product_group():
    with pytest.raises(ProductionScheduleValidationError, match="does not belong"):
        normalize_production_schedule_form(
            {
                "production_date": "2026-11-23",
                "rows": [sample_row(B="PRODUCT GROUP 02")],
            },
            make_catalog(),
        )


def test_production_schedule_contract_rejects_derived_and_helper_columns():
    with pytest.raises(ProductionScheduleValidationError, match="calculated|helper|unsupported"):
        normalize_production_schedule_form(
            {
                "production_date": "2026-11-23",
                "rows": [sample_row(H="202x306")],
            },
            make_catalog(),
        )


def test_production_schedule_contract_rejects_negative_or_invalid_numbers():
    with pytest.raises(ProductionScheduleValidationError, match="zero or greater|nonnegative"):
        normalize_production_schedule_form(
            {
                "production_date": "2026-11-23",
                "rows": [sample_row(M="-1")],
            },
            make_catalog(),
        )
    with pytest.raises(ProductionScheduleValidationError, match="nonnegative"):
        normalize_production_schedule_form(
            {
                "production_date": "2026-11-23",
                "available_pax_total": "-5",
                "rows": [sample_row()],
            },
            make_catalog(),
        )
    with pytest.raises(ProductionScheduleValidationError, match="nonnegative"):
        normalize_production_schedule_form(
            {
                "production_date": "2026-11-23",
                "rows": [sample_row(D="not-a-number")],
            },
            make_catalog(),
        )


def test_production_schedule_contract_rejects_populated_rows_without_source_code():
    with pytest.raises(ProductionScheduleValidationError, match="select a Production Code"):
        normalize_production_schedule_form(
            {
                "production_date": "2026-11-23",
                "rows": [
                    {"source_row_number": 8, "record_data": {"G": "PR-ONLY"}},
                ],
            },
            make_catalog(),
        )


def test_production_schedule_contract_rejects_duplicate_or_out_of_range_source_slots():
    with pytest.raises(ProductionScheduleValidationError, match="submitted more than once"):
        normalize_production_schedule_form(
            {
                "production_date": "2026-11-23",
                "rows": [sample_row(8), sample_row(8)],
            },
            make_catalog(),
        )
    with pytest.raises(ProductionScheduleValidationError, match="source rows 8 through 17"):
        normalize_production_schedule_form(
            {
                "production_date": "2026-11-23",
                "rows": [sample_row(18)],
            },
            make_catalog(),
        )


class FakeGateway:
    def __init__(self, permissions=None):
        self.permissions = permissions or [
            "production_schedule.view",
            "production_schedule.create",
            "production_schedule.edit",
        ]
        self.catalog = make_catalog()
        self.created = []
        self.updated = []
        self.filters = []
        self.form = {
            "id": "00000000-0000-0000-0000-000000000654",
            "production_date": "2026-11-23",
            "available_pax_total": 50,
            "form_data": {"available_pax_total": 50, "rows": []},
            "version": 1,
            "created_at": "2026-11-21T10:00:00Z",
            "updated_at": "2026-11-21T10:00:00Z",
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

    def get_production_schedule_catalog(self, access_token):
        return self.catalog

    def get_production_schedule_summary(self, access_token):
        return {
            "saved_rows": 1,
            "days_saved": 1,
            "target_total": 85500,
            "required_manpower_total": 12,
            "last_saved": "2026-11-21T10:00:00Z",
        }

    def get_production_schedule_form_by_date(self, access_token, production_date):
        return {"form": self.form if production_date == self.form["production_date"] else None}

    def get_production_schedule_records(self, access_token, **kwargs):
        self.filters.append(kwargs)
        return {"total": 1, "records": [{"date": "2026-11-23", "line": "Agri Line"}]}

    def create_production_schedule_form(self, access_token, production_date, available_pax_total, rows):
        self.created.append(
            {
                "production_date": production_date,
                "available_pax_total": available_pax_total,
                "rows": rows,
            }
        )
        return {
            "id": "00000000-0000-0000-0000-000000000654",
            "production_date": production_date,
            "version": 1,
            "entry_count": len(rows),
            "changed": True,
        }

    def update_production_schedule_form(
        self, access_token, form_id, expected_version, production_date,
        available_pax_total, rows, change_reason=None
    ):
        self.updated.append(
            (form_id, expected_version, production_date, available_pax_total, rows, change_reason)
        )
        return {
            "id": form_id,
            "production_date": production_date,
            "version": expected_version + 1,
            "changed": True,
        }

    def get_production_schedule_revisions(self, access_token, form_id):
        return [{"version": 2, "changed_columns": ["rows"]}]


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


def test_production_schedule_catalog_returns_all_source_groups_and_variants():
    client = build_app().test_client()
    assert login(client).status_code == 200
    response = client.get("/api/production-schedule/catalog")
    assert response.status_code == 200
    payload = response.get_json()
    assert len(payload["catalog"]["product_groups"]) == 43
    assert len(payload["catalog"]["products"]) == 1
    assert payload["permissions"] == {"view": True, "create": True, "edit": True}


def test_production_schedule_summary_and_form_lookup_are_live_api_routes():
    client = build_app().test_client()
    assert login(client).status_code == 200
    summary = client.get("/api/production-schedule/summary")
    assert summary.status_code == 200
    assert summary.get_json()["summary"]["saved_rows"] == 1
    form = client.get("/api/production-schedule/forms?date=2026-11-23")
    assert form.status_code == 200
    assert form.get_json()["form"]["version"] == 1
    invalid = client.get("/api/production-schedule/forms?date=not-a-date")
    assert invalid.status_code == 400


def test_production_schedule_records_pass_server_filters_sort_and_pagination():
    gateway = FakeGateway()
    client = build_app(gateway).test_client()
    assert login(client).status_code == 200
    response = client.get(
        "/api/production-schedule/records?page=2&page_size=25"
        "&date_from=2026-11-01&date_to=2026-11-30&day=Monday&line=Agri%20Line"
        "&area=Halal&product_name=MAYON&production_code=MDP-100-155"
        "&pr_number=PS-001&sort=target&direction=asc"
    )
    assert response.status_code == 200
    assert gateway.filters[-1] == {
        "date_from": "2026-11-01",
        "date_to": "2026-11-30",
        "day": "Monday",
        "line": "Agri Line",
        "area": "Halal",
        "product_name": "MAYON",
        "production_code": "MDP-100-155",
        "pr_number": "PS-001",
        "search": None,
        "page": 2,
        "page_size": 25,
        "sort_key": "target",
        "sort_direction": "asc",
    }


def test_production_schedule_create_sends_only_validated_source_input_columns():
    gateway = FakeGateway()
    client = build_app(gateway).test_client()
    assert login(client).status_code == 200
    response = client.post(
        "/api/production-schedule/forms",
        json={
            "production_date": "2026-11-23",
            "available_pax_total": "50",
            "rows": [sample_row()],
        },
        headers={"Origin": "http://localhost"},
    )
    assert response.status_code == 201
    assert gateway.created == [{
        "production_date": "2026-11-23",
        "available_pax_total": "50",
        "rows": [{
            "source_row_number": 8,
            "record_data": {
                "B": GROUP,
                "C": CODE,
                "D": "2",
                "E": "Agri Line",
                "F": "Halal",
                "G": "PS-TEST-001",
                "K": "5000",
                "L": "PCS",
                "M": "1000",
                "O": "FC/IDC TEST",
                "P": "Acceptance test schedule row",
                "R": "12",
            },
        }],
    }]


def test_production_schedule_create_rejects_mismatched_code_before_database_write():
    gateway = FakeGateway()
    client = build_app(gateway).test_client()
    assert login(client).status_code == 200
    response = client.post(
        "/api/production-schedule/forms",
        json={
            "production_date": "2026-11-23",
            "rows": [sample_row(B="OTHER GROUP")],
        },
        headers={"Origin": "http://localhost"},
    )
    assert response.status_code == 400
    assert gateway.created == []


def test_production_schedule_update_is_version_checked_and_keeps_reason():
    gateway = FakeGateway()
    client = build_app(gateway).test_client()
    assert login(client).status_code == 200
    response = client.patch(
        f"/api/production-schedule/forms/{gateway.form['id']}",
        json={
            "expected_version": 1,
            "production_date": "2026-11-23",
            "available_pax_total": "50",
            "rows": [sample_row(M="1200")],
            "change_reason": "Corrected planned quantity",
        },
        headers={"Origin": "http://localhost"},
    )
    assert response.status_code == 200
    assert gateway.updated[-1][1] == 1
    assert gateway.updated[-1][4][0]["record_data"]["M"] == "1200"
    assert gateway.updated[-1][5] == "Corrected planned quantity"


def test_production_schedule_edit_is_denied_without_permission():
    gateway = FakeGateway(permissions=["production_schedule.view"])
    client = build_app(gateway).test_client()
    assert login(client).status_code == 200
    response = client.post(
        "/api/production-schedule/forms",
        json={
            "production_date": "2026-11-23",
            "rows": [sample_row()],
        },
        headers={"Origin": "http://localhost"},
    )
    assert response.status_code == 403
    assert response.get_json()["code"] == "operational_permission_denied"
