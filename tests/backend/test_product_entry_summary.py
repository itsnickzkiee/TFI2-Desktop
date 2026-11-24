from tfi_backend.product_entry_contract import PRODUCT_ENTRY_BLOCKS
from tfi_backend.product_entry_summary import QUALITY_COLUMNS, project_summary_record

from test_yield_contract import FakeYieldGateway, _login, _test_app


def test_summary_projects_each_product_block():
    assert QUALITY_COLUMNS.keys() == PRODUCT_ENTRY_BLOCKS.keys()
    for block_key, columns in QUALITY_COLUMNS.items():
        source_data = {
            "A": "2026-11-22", "B": "PRODUCT", "D": "0001", "E": "4.5", "F": "100",
            columns[0]: "5", columns[7]: "7",
        }
        row = project_summary_record({"block_key": block_key, "record_data": source_data})
        assert len(row) == 32
        assert row["batches"] == 4.5
        assert row["totalFg"] == 100
        assert row["dentedPct"] == 0.05
        assert row["retention"] == 14
        assert row["pr"] == "0001"

        # Arithmetic from a historical workbook row must never fill a missing input.
        del source_data["F"]
        row = project_summary_record({"block_key": block_key, "record_data": source_data})
        assert row["totalFg"] is None
        assert row["dentedPct"] is None


def test_summary_preserves_exceptional_mappings_and_reject_denominators():
    row = project_summary_record({
        "block_key": "BLK_39",
        "record_data": {"A": "2026-11-22", "B": "PRODUCT", "F": "100",
                        "BB": "5", "BD": "20", "BI": "5", "BJ": "3", "BK": "4"},
    })
    assert row["underweightCan"] is None
    assert row["canWasherPalletizer"] == 7
    assert row["lidsReject"] == 5 / 105
    assert row["emptyCanReject"] == 25 / 125
    assert row["flipperPct"] is None
    assert project_summary_record({"block_key": "BLK_39", "record_data": {"F": "100"}}) is None


def test_summary_endpoint_requires_both_source_permissions_and_tracks_source_offset():
    gateway = FakeYieldGateway(permissions=["production_entry.view"])
    client = _test_app(gateway).test_client()
    assert client.get("/api/reports/summary").status_code == 401
    assert _login(client).status_code == 200
    assert client.get("/api/reports/summary").status_code == 403

    gateway.permissions.append("product_entry.view")
    assert client.get("/api/reports/summary?offset=-1").status_code == 400
    gateway.source_records = [{"block_key": "BLK_01", "record_data": {}}] * 250
    response = client.get("/api/reports/summary")
    assert response.get_json() == {"records": [], "read_only": True, "next_offset": 250}
    assert gateway.source_filters == [{"limit": 250, "offset": 0}]

    gateway.source_records = [{"block_key": "BLK_01", "record_data": {"B": "PRODUCT", "F": 100}}]
    response = client.get("/api/reports/summary?offset=250")
    assert response.get_json()["records"][0]["totalFg"] == 100
    assert response.get_json()["next_offset"] is None
