from decimal import Decimal

from tfi_backend.oee_contract import inspect_oee_row


def test_oee_calculates_from_inputs_and_caps_performance():
    result = inspect_oee_row([46024, " Machine 1 ", "Line A", "SKU-A", 10, 2, 100, 1000, 100, "y"])
    assert result["status"] == "valid"
    assert result["business_key"] == ("2026-01-02", "machine 1", "sku-a")
    assert result["calculated"]["capped_count"] == 800
    assert result["calculated"]["week"] == 1
    assert result["calculated"]["oee"] == Decimal("0.72")


def test_oee_preserves_zero_and_leaves_undefined_ratios_blank():
    result = inspect_oee_row(["2026-01-02", "Machine 1", "Line A", "SKU-A", 0, 0, 0, 0, 0, "N"])
    assert result["status"] == "valid"
    assert result["calculated"]["oee"] is None
    assert result["calculated"]["good_count"] == 0


def test_oee_partial_and_invalid_rows_have_field_diagnostics():
    partial = inspect_oee_row(["2026-01-02", "Machine 1"])
    assert partial["status"] == "incomplete"
    assert "product_code" in partial["missing_fields"]
    invalid = inspect_oee_row([46024.5, "Machine 1", "Line A", "SKU-A", 1, 2, 100, 10, 12, "maybe"])
    assert invalid["status"] == "invalid"
    assert set(invalid["errors"]) == {"production_date", "downtime_hours", "reject_count", "include_in_overall"}
