"""Shared source-aligned contract for Hourly Meat, Hourly Coding, and Hourly Agri."""
from __future__ import annotations

from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Any

HOURLY_MODULES = {
    "hourly_meat": {
        "name": "Hourly Meat", "line": "Meat Line", "sheet_id": 428082343,
        "source_range": "A1:L5004", "first_data_row": 5,
    },
    "hourly_coding": {
        "name": "Hourly Coding", "line": "Coding Line", "sheet_id": 1916766220,
        "source_range": "A5:L5004", "first_data_row": 5,
    },
    "hourly_agri": {
        "name": "Hourly Agri", "line": "Agri Line", "sheet_id": 534145404,
        "source_range": "A5:L5004", "first_data_row": 5,
    },
}
INPUT_FIELDS = ("production_date", "hour", "product_code", "target_tins", "actual_tins", "remarks")
TEXT_LIMITS = {"product_code": 100, "remarks": 400}
MAX_BATCH_ROWS = 100


class HourlyProductionValidationError(ValueError):
    """Raised when an Hourly Production request violates the source contract."""


def validate_hourly_module(module_key: Any) -> str:
    if not isinstance(module_key, str) or module_key not in HOURLY_MODULES:
        raise HourlyProductionValidationError("Choose Hourly Meat, Hourly Coding, or Hourly Agri.")
    return module_key


def get_hourly_production_catalog(module_key: str, reference_data: dict | None = None) -> dict:
    module_key = validate_hourly_module(module_key)
    reference_data = reference_data or {}
    products = reference_data.get("products") or []
    product_names = {
        str(item.get("code")): str(item.get("name"))
        for item in products
        if isinstance(item, dict) and item.get("code") and item.get("name")
    }
    source = HOURLY_MODULES[module_key]
    return {
        "module_key": module_key,
        "module_name": source["name"],
        "line": source["line"],
        "products": products,
        "product_code_count": len(products),
        "product_names": product_names,
        "source": {
            "sheet_name": source["name"],
            "sheet_id": source["sheet_id"],
            "range": source["source_range"],
            "input_columns": ["Date", "Hour", "Product Code", "Target (tins)", "Actual (tins)", "Remarks"],
            "calculated_columns": [
                "Product Name", "Time Slot", "Variance", "Cumulative Target",
                "Cumulative Actual", "Hour Attainment",
            ],
        },
        "validation": {
            "date_after": "2000-01-01", "hour_min": 0, "hour_max": 23,
            "product_code_reference": "Code Map A5:B400",
            "target_min": 0, "actual_min": 0,
        },
        "formula_rules": {
            "product_name": "Current Code Map lookup; fallback Other",
            "time_slot": "Selected hour to the next hour, wrapping at midnight",
            "variance": "Actual output minus target for the hour",
            "cumulative_target": "Sum of target tins for the same date and product code through the current hour",
            "cumulative_actual": "Sum of actual tins for the same date and product code through the current hour; blank if current actual is blank",
            "hour_attainment": "Actual output divided by target for the hour; blank when target is blank or zero",
        },
    }


def _text(value: Any, label: str, maximum: int) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        raise HourlyProductionValidationError(f"{label} must be text.")
    value = value.strip()
    if not value:
        return None
    if len(value) > maximum:
        raise HourlyProductionValidationError(f"{label} must be {maximum:,} characters or fewer.")
    return value


def _date(value: Any) -> str | None:
    if value in (None, ""):
        return None
    if not isinstance(value, str):
        raise HourlyProductionValidationError("Date must use YYYY-MM-DD format.")
    try:
        parsed = date.fromisoformat(value.strip())
    except ValueError as exc:
        raise HourlyProductionValidationError("Date must use YYYY-MM-DD format.") from exc
    if parsed <= date(2000, 1, 1):
        raise HourlyProductionValidationError("Date must be later than 01 January 2000.")
    return parsed.isoformat()


def _hour(value: Any) -> int | None:
    if value in (None, ""):
        return None
    if isinstance(value, bool):
        raise HourlyProductionValidationError("Hour must be a whole number from 0 to 23.")
    try:
        number = int(str(value).strip())
    except (TypeError, ValueError) as exc:
        raise HourlyProductionValidationError("Hour must be a whole number from 0 to 23.") from exc
    if str(value).strip() not in (str(number), f"{number}.0") or not 0 <= number <= 23:
        raise HourlyProductionValidationError("Hour must be a whole number from 0 to 23.")
    return number


def _quantity(value: Any, label: str) -> str | None:
    if value in (None, ""):
        return None
    if isinstance(value, bool):
        raise HourlyProductionValidationError(f"{label} must be a non-negative number.")
    try:
        number = Decimal(str(value).strip())
    except (InvalidOperation, ValueError) as exc:
        raise HourlyProductionValidationError(f"{label} must be a non-negative number.") from exc
    if not number.is_finite() or number < 0 or number > Decimal("999999999999.99"):
        raise HourlyProductionValidationError(f"{label} must be a non-negative number within the supported range.")
    return format(number.quantize(Decimal("0.01")), "f")


def _normalize(data: Any) -> dict:
    if not isinstance(data, dict):
        raise HourlyProductionValidationError("Each Hourly Production row must contain a record_data object.")
    unknown = set(data) - set(INPUT_FIELDS)
    if unknown:
        names = ", ".join(sorted(str(item) for item in unknown))
        raise HourlyProductionValidationError(f"Calculated or unsupported Hourly Production fields cannot be submitted: {names}.")
    output: dict[str, Any] = {}
    for field, value in data.items():
        if field == "production_date":
            output[field] = _date(value)
        elif field == "hour":
            output[field] = _hour(value)
        elif field == "target_tins":
            output[field] = _quantity(value, "Target")
        elif field == "actual_tins":
            output[field] = _quantity(value, "Actual output")
        else:
            maximum = TEXT_LIMITS[field]
            label = "Product Code" if field == "product_code" else "Remarks"
            output[field] = _text(value, label, maximum)
    if output.get("product_code"):
        output["product_code"] = output["product_code"].upper()
    return output


def _reference_status(product_code: str | None, catalog: dict) -> str:
    if not product_code:
        return "not_entered"
    known = {str(item.get("code", "")).upper() for item in catalog.get("products", []) if isinstance(item, dict)}
    return "matched" if product_code.upper() in known else "unmatched"


def normalize_hourly_production_records(records: Any, catalog: dict) -> list[dict]:
    if not isinstance(records, list) or not 1 <= len(records) <= MAX_BATCH_ROWS:
        raise HourlyProductionValidationError(f"Submit between 1 and {MAX_BATCH_ROWS} Hourly Production rows.")
    normalized = []
    for index, item in enumerate(records, start=1):
        if not isinstance(item, dict) or set(item) - {"row_index", "record_data"}:
            raise HourlyProductionValidationError(f"Hourly Production row {index} has an invalid structure.")
        row_index = item.get("row_index", index)
        if isinstance(row_index, bool) or not isinstance(row_index, int) or not 1 <= row_index <= 1000:
            raise HourlyProductionValidationError(f"Hourly Production row {index} has an invalid row number.")
        data = item.get("record_data", {})
        if not isinstance(data, dict):
            raise HourlyProductionValidationError(f"Hourly Production row {row_index} must contain record_data.")
        if not any(value not in (None, "") and (not isinstance(value, str) or value.strip()) for value in data.values()):
            continue
        values = _normalize(data)
        code = values.get("product_code")
        normalized.append({
            "row_index": row_index,
            "record_data": {
                "production_date": values.get("production_date"),
                "hour": values.get("hour"),
                "product_code": code,
                "target_tins": values.get("target_tins"),
                "actual_tins": values.get("actual_tins"),
                "remarks": values.get("remarks"),
            },
            "product_code_reference_status": _reference_status(code, catalog),
        })
    if not normalized:
        raise HourlyProductionValidationError("Enter at least one Hourly Production field before saving.")
    return normalized


def normalize_hourly_production_changes(current: dict, changes: Any, catalog: dict) -> dict:
    if not isinstance(changes, dict) or not changes:
        raise HourlyProductionValidationError("Provide at least one Hourly Production field change.")
    unknown = set(changes) - set(INPUT_FIELDS)
    if unknown:
        raise HourlyProductionValidationError("Calculated and unsupported Hourly Production fields cannot be edited.")
    existing = _normalize({field: current.get(field) for field in INPUT_FIELDS})
    normalized = _normalize({**existing, **changes})
    changed = {field: normalized.get(field) for field in changes if normalized.get(field) != existing.get(field)}
    return {
        "changes": changed,
        "product_code_reference_status": _reference_status(normalized.get("product_code"), catalog),
    }
