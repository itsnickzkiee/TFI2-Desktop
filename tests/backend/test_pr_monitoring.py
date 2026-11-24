from __future__ import annotations

import csv
import io

from tfi_backend.pr_monitoring_contract import (
    COLUMNS,
    ROW_CLASSIFICATION,
    SNAPSHOT_SUMMARY,
    SOURCE,
    STATUS_VALUES,
    PrMonitoringValidationError,
    classify_pr_monitoring_source_row,
    get_pr_monitoring_catalog,
)
from test_app import FakeGateway, authenticated_client


def test_pr_monitoring_contract_preserves_official_source_identity_and_headers():
    catalog = get_pr_monitoring_catalog()
    assert catalog["source"]["spreadsheet_id"] == "1rCbQ16wj7MRjQCFF3tA-WEMkudraJK0RkwcqayUlz7k"
    assert catalog["source"]["sheet_id"] == 867256143
    assert catalog["source"]["sheet"] == "PR MONITORING"
    assert catalog["source"]["header_row"] == 3
    assert catalog["source"]["first_data_row"] == 4
    assert [column["source_column"] for column in COLUMNS] == list("ABCDEFG")
    assert COLUMNS[0]["label"] == ""
    assert COLUMNS[2]["label"] == "Date PR Recieved"
    assert COLUMNS[1]["preserve_leading_zeros"] is True
    assert catalog["status_values"] == list(STATUS_VALUES)
    assert catalog["capabilities"]["create"] is False
    assert catalog["capabilities"]["edit"] is False


def test_pr_monitoring_summary_is_explicitly_a_source_snapshot():
    catalog = get_pr_monitoring_catalog()
    assert SNAPSHOT_SUMMARY["total_tins_to_produce"]["value"] == 16182629
    assert SNAPSHOT_SUMMARY["total_tins_produced"]["value"] == 15648348
    assert SNAPSHOT_SUMMARY["completion"]["formatted_value"] == "96.70%"
    assert catalog["snapshot_summary"]["completion"]["formula"] == "=D2/B2"
    assert ROW_CLASSIFICATION["populated_source_rows"] == 78
    assert ROW_CLASSIFICATION["pr_number_rows"] == 64
    assert len(ROW_CLASSIFICATION["product_total_rows"]) == 12


def test_pr_monitoring_source_row_classification_keeps_non_transactions_out_of_register():
    assert classify_pr_monitoring_source_row([None, None, None, "0", "0", "0", "Complete"], 4)["classification"] == "template"
    assert classify_pr_monitoring_source_row(["ISWK-24-425 Total", None, None, "12014", "12014", "0", "Complete"], 6)["classification"] == "summary"
    incomplete = classify_pr_monitoring_source_row([None, None, "February 1, 2025", "40993", "1708", "39285", "Pending for Production"], 79)
    assert incomplete["classification"] == "incomplete"
    assert incomplete["review_reasons"] == ["missing_pr_no"]
    operational = classify_pr_monitoring_source_row(["Product A", "001", "January 5, 2025", "42111", "42111", "0", "Complete"], 5)
    assert operational["classification"] == "operational"
    assert operational["record_data"]["pr_no"] == "001"


def test_pr_monitoring_source_row_classifier_rejects_invalid_row_references():
    try:
        classify_pr_monitoring_source_row(["A", "001"], 3)
    except PrMonitoringValidationError as exc:
        assert "data range" in str(exc)
    else:
        raise AssertionError("Rows before the first source data row must be rejected.")


class PrMonitoringGateway(FakeGateway):
    def __init__(self, permissions=None, records=None):
        super().__init__(permissions=permissions or ["dashboard.view", "pr_monitoring.view", "pr_monitoring.export"])
        self.pr_records = records or []
        self.pr_calls = []

    def get_pr_monitoring_records(self, access_token, **kwargs):
        self.pr_calls.append((access_token, dict(kwargs)))
        records = list(self.pr_records)
        return {
            "records": records,
            "total_count": len(records),
            "page": kwargs["page"],
            "page_size": kwargs["page_size"],
            "has_more": False,
        }


def sample_record():
    return {
        "id": "00000000-0000-0000-0000-000000000123",
        "source_row_number": 5,
        "column_a": "Product A",
        "pr_no": "001",
        "date_pr_received": "2025-01-05",
        "pr_required_quantity_tins": 42111,
        "production_produced_tins": 42111,
        "for_production_quantity_tins": 0,
        "status": "Complete",
    }


def test_pr_monitoring_catalog_and_records_use_permission_gated_tfi2_gateway():
    gateway = PrMonitoringGateway(records=[sample_record()])
    client, _ = authenticated_client(gateway)
    catalog_response = client.get("/api/pr-monitoring/catalog")
    assert catalog_response.status_code == 200
    assert catalog_response.get_json()["permissions"] == {"view": True, "export": True}
    records_response = client.get(
        "/api/pr-monitoring/records?page=1&page_size=1000&date_from=2025-01-01&date_to=2025-12-31&pr_no=00&status=Complete&search=Product&sort_key=pr_no&sort_direction=asc"
    )
    assert records_response.status_code == 200
    payload = records_response.get_json()
    assert payload["total_count"] == 1
    assert payload["records"][0]["pr_no"] == "001"
    assert gateway.pr_calls[-1][1] == {
        "date_from": "2025-01-01",
        "date_to": "2025-12-31",
        "pr_no": "00",
        "status": "Complete",
        "search": "Product",
        "sort_key": "pr_no",
        "sort_direction": "asc",
        "page": 1,
        "page_size": 1000,
    }


def test_pr_monitoring_rejects_invalid_date_status_and_sort_filters():
    client, gateway = authenticated_client(PrMonitoringGateway())
    for query in (
        "?date_from=2025-12-31&date_to=2025-01-01",
        "?date_from=not-a-date",
        "?status=Finished",
        "?sort_key=source_import_row_id",
        "?sort_direction=sideways",
    ):
        response = client.get("/api/pr-monitoring/records" + query)
        assert response.status_code == 400
    assert gateway.pr_calls == []


def test_pr_monitoring_csv_export_is_permission_gated_and_source_ordered():
    gateway = PrMonitoringGateway(records=[sample_record()])
    client, _ = authenticated_client(gateway)
    response = client.get("/api/pr-monitoring/export.csv?status=Complete")
    assert response.status_code == 200
    assert response.mimetype == "text/csv"
    assert "attachment" in response.headers["Content-Disposition"]
    content = response.get_data(as_text=True)
    assert content.startswith("\ufeff")
    assert "\r\n" in content
    parsed = list(csv.reader(io.StringIO(content.lstrip("\ufeff"))))
    assert parsed[0] == ["", "PR No.", "Date PR Recieved", "PR Required Quantity (tins)", "Production Produced (tins)", "For Production Quantity (tins)", "Status"]
    assert parsed[1][1] == "001"


def test_pr_monitoring_export_requires_export_permission_and_has_no_write_routes():
    client, gateway = authenticated_client(PrMonitoringGateway(permissions=["dashboard.view", "pr_monitoring.view"]))
    response = client.get("/api/pr-monitoring/export.csv")
    assert response.status_code == 403
    assert gateway.pr_calls == []
    assert client.post("/api/pr-monitoring/records", json={"records": []}, headers={"Origin": "http://localhost"}).status_code == 405
    assert client.patch("/api/pr-monitoring/records/00000000-0000-0000-0000-000000000123", json={}, headers={"Origin": "http://localhost"}).status_code == 404

class GatewayResponse:
    status_code = 200
    ok = True
    content = b"{}"

    def json(self):
        return {"records": [], "total_count": 0, "page": 1, "page_size": 100, "has_more": False}


class GatewayTransport:
    def __init__(self):
        self.calls = []

    def request(self, method, url, **kwargs):
        self.calls.append((method, url, kwargs))
        return GatewayResponse()


def test_pr_monitoring_gateway_uses_authenticated_tfi2_read_rpc():
    from tfi_backend.config import Settings
    from tfi_backend.supabase_gateway import SupabaseGateway

    transport = GatewayTransport()
    settings = Settings(
        supabase_url="https://slfjqrkxnsgdaturaguw.supabase.co",
        publishable_key="sb_publishable_test",
    )
    gateway = SupabaseGateway(settings, transport)
    result = gateway.get_pr_monitoring_records(
        "user-jwt", date_from="2025-01-01", pr_no="001",
        status="Complete", page=2, page_size=50,
    )
    assert result["total_count"] == 0
    method, url, kwargs = transport.calls[0]
    assert method == "POST"
    assert url.endswith("/rest/v1/rpc/tfi_get_pr_monitoring_records")
    assert kwargs["headers"]["Authorization"] == "Bearer user-jwt"
    assert kwargs["json"]["p_pr_no"] == "001"
    assert kwargs["json"]["p_status"] == "Complete"
    assert kwargs["json"]["p_page"] == 2
    assert kwargs["json"]["p_page_size"] == 50
