from decimal import Decimal
import pytest

from tfi_backend.productivity_contract import (
    INPUT_FIELDS, ProductivityValidationError, inspect_productivity_row,
    normalize_productivity_records,
)


def row(**changes):
    data = {
        "production_date": "2026-01-06", "product_code": "MDP-100-155",
        "line": "AGRILINE", "planned_run_hours": "10",
        "actual_output_tins": "85847", "dented": "151", "false_seam": "1",
        "flipper": "0", "bulged": "0", "panel": "0", "buckling": "0",
    }
    data.update(changes)
    return data


def test_productivity_source_inputs_are_a_to_k_only():
    assert INPUT_FIELDS == (
        "production_date", "product_code", "line", "planned_run_hours",
        "actual_output_tins", "dented", "false_seam", "flipper",
        "bulged", "panel", "buckling",
    )


def test_productivity_calculates_rejects_and_iso_week_month():
    result = inspect_productivity_row(row())
    assert result["status"] == "valid"
    assert result["calculated"]["total_fg_rejects"] == Decimal("152")
    assert result["calculated"]["week"] == 2
    assert result["calculated"]["month"] == 1
    assert result["business_key"] == ("2026-01-06", "mdp-100-155")


def test_productivity_converts_google_sheets_date_serial():
    result = inspect_productivity_row(row(production_date=46028))
    assert result["inputs"]["production_date"] == "2026-01-06"


def test_productivity_rejects_calculated_fields():
    with pytest.raises(ProductivityValidationError, match="server-generated"):
        normalize_productivity_records([{"row_index": 1, "record_data": row(total_fg_rejects=152)}])


def test_productivity_skips_empty_rows_and_normalizes_inputs():
    result = normalize_productivity_records([
        {"row_index": 1, "record_data": {field: "" for field in INPUT_FIELDS}},
        {"row_index": 2, "record_data": row()},
    ])
    assert len(result) == 1
    assert result[0]["row_index"] == 2
    assert result[0]["record_data"]["actual_output_tins"] == "85847"


def test_productivity_rejects_duplicate_date_product_pair():
    with pytest.raises(ProductivityValidationError, match="duplicate"):
        normalize_productivity_records([
            {"row_index": 1, "record_data": row()},
            {"row_index": 2, "record_data": row(line="MEATLINE")},
        ])


@pytest.mark.parametrize("field,value", [
    ("actual_output_tins", "-1"), ("dented", "NaN"),
    ("planned_run_hours", "Infinity"), ("false_seam", "1.23456"),
])
def test_productivity_rejects_invalid_numeric_inputs(field, value):
    assert inspect_productivity_row(row(**{field: value}))["status"] == "invalid"


def test_productivity_rejects_missing_required_fields():
    result = inspect_productivity_row(row(product_code=""))
    assert result["status"] == "incomplete"
    assert "product_code" in result["missing_fields"]
