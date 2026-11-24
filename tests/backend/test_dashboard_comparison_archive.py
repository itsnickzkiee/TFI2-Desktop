from datetime import date

import pytest

from tfi_backend.dashboard_comparison import compare_metrics, previous_period
from test_yield_contract import FakeYieldGateway, _login, _test_app


@pytest.mark.parametrize(("period", "first", "last", "expected"), [
    ("daily", "2026-01-01", "2026-01-01", ("2025-12-31", "2025-12-31")),
    ("weekly", "2026-01-05", "2026-01-11", ("2025-12-29", "2026-01-04")),
    ("monthly", "2024-03-01", "2024-03-31", ("2024-02-01", "2024-02-29")),
])
def test_previous_period_matches_workbook_bounds(period, first, last, expected):
    bounds = previous_period(period, date.fromisoformat(first), date.fromisoformat(last))
    assert tuple(day.isoformat() for day in bounds) == expected


def test_compare_metrics_distinguishes_relative_change_points_and_missing_data():
    current = {"modules": {"productivity": {"status": "available"}, "oee": {"status": "available"}},
               "metrics": {"total_output_tins": 80, "output_attainment": .88, "oee": .91, "total_manpower_hours": 20}}
    prior = {"modules": {"productivity": {"status": "available"}, "oee": {"status": "restricted"}},
             "metrics": {"total_output_tins": 100, "output_attainment": .80, "oee": .90, "total_manpower_hours": 0}}
    comparison = compare_metrics(current, prior)
    assert comparison["total_output_tins"]["change"] == pytest.approx(-20)
    assert comparison["output_attainment"]["change"] == pytest.approx(8)
    assert comparison["oee"]["previous"] is None
    assert comparison["total_manpower_hours"]["previous"] == 0
    assert comparison["total_manpower_hours"]["change"] is None


def test_dashboard_comparison_queries_both_periods_with_same_filters():
    gateway = FakeYieldGateway(permissions=["dashboard.view", "production_entry.view"])
    requests = []
    def analytics(access_token, **filters):
        requests.append(filters)
        return {"metrics": {"total_output_tins": 120 if len(requests) == 1 else 100},
                "modules": {"productivity": {"status": "available"}}}
    gateway.get_dashboard_analytics = analytics
    client = _test_app(gateway).test_client()
    assert _login(client).status_code == 200
    assert client.get("/api/dashboard/analytics?period=monthly&date_from=2026-11-02&date_to=2026-11-30").status_code == 400
    response = client.get("/api/dashboard/analytics?period=Monthly&date_from=2026-11-01&date_to=2026-11-30&product_name=Test&product_code=CODE&machine=A")
    assert response.status_code == 200
    comparison = response.get_json()["previous_period"]
    assert comparison["date_from"] == "2026-10-01"
    assert comparison["date_to"] == "2026-10-31"
    assert comparison["metrics"]["total_output_tins"]["change"] == pytest.approx(20)
    assert requests[1] == {**requests[0], "date_from": "2026-10-01", "date_to": "2026-10-31"}


def test_removed_rows_requires_reports_permission_and_is_read_only():
    gateway = FakeYieldGateway(permissions=["dashboard.view"])
    gateway.get_removed_rows_archive = lambda token: [
        {"source_row": 4, "oldProductCode": "001", "captured_at": "2026-11-22T18:24:32Z"},
    ]
    client = _test_app(gateway).test_client()
    path = "/api/reports/removed-rows"
    assert client.get(path).status_code == 401
    assert _login(client).status_code == 200
    assert client.get(path).status_code == 403
    gateway.permissions.append("production_entry.view")
    response = client.get(path).get_json()
    assert response["read_only"] is True
    assert response["records"][0]["oldProductCode"] == "001"


def test_period_yield_does_not_reuse_first_row_historical_output():
    gateway = FakeYieldGateway()
    record = gateway.source_records[0]
    record["record_data"].pop("F", None)
    client = _test_app(gateway).test_client()
    assert _login(client).status_code == 200
    url = "/api/yield/log?main_average=1&date_from=2026-11-01&date_to=2026-11-30"
    response = client.get(url).get_json()
    assert response == {"eligible_rows": 0, "main_yield": None, "read_only": True}
    record["record_data"]["F"] = "200"
    response = client.get(url).get_json()
    assert response["eligible_rows"] == 1
    assert response["main_yield"] != pytest.approx(43515.5 / 180)
