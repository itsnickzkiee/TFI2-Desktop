"""Source-aligned Production Schedule and Schedule Summary contract."""
from __future__ import annotations

from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Any


class ProductionScheduleValidationError(ValueError):
    """Raised when a daily Production Schedule request violates its source contract."""


SOURCE_ROW_NUMBERS = tuple(range(8, 18))
INPUT_COLUMNS = ("B", "C", "D", "E", "F", "G", "K", "L", "M", "O", "P", "R")
NUMERIC_COLUMNS = {
    "D": "No. of Batches",
    "K": "Revised Target",
    "M": "Quantity (tins/ends)",
    "R": "Available Pax",
}
TEXT_LIMITS = {
    "B": ("Product Name", 200),
    "C": ("Production Code", 100),
    "E": ("Line", 60),
    "F": ("Area", 60),
    "G": ("PR#", 120),
    "L": ("UM", 30),
    "O": ("FC/IDC Ref", 120),
    "P": ("Remarks", 1000),
}
MAX_ROWS = 10


def _text(value: Any, field: str, maximum: int) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        raise ProductionScheduleValidationError(f"{field} must be text.")
    result = value.strip() or None
    if result and len(result) > maximum:
        raise ProductionScheduleValidationError(
            f"{field} must be {maximum:,} characters or fewer."
        )
    return result


def _number(value: Any, field: str) -> str | None:
    if value is None or value == "":
        return None
    if isinstance(value, bool) or isinstance(value, (dict, list)):
        raise ProductionScheduleValidationError(f"{field} must be a nonnegative number.")
    raw = str(value).strip().replace(",", "")
    if not raw:
        return None
    try:
        parsed = Decimal(raw)
    except (InvalidOperation, ValueError) as exc:
        raise ProductionScheduleValidationError(
            f"{field} must be a nonnegative number."
        ) from exc
    if not parsed.is_finite() or parsed < 0:
        raise ProductionScheduleValidationError(f"{field} must be a nonnegative number.")
    if len(parsed.as_tuple().digits) > 30 or len(format(parsed, "f")) > 80:
        raise ProductionScheduleValidationError(
            f"{field} exceeds the supported numeric length."
        )
    return format(parsed, "f")


def _date(value: Any) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ProductionScheduleValidationError(
            "Production date is required and must use YYYY-MM-DD format."
        )
    try:
        return date.fromisoformat(value.strip()).isoformat()
    except ValueError as exc:
        raise ProductionScheduleValidationError(
            "Production date must use YYYY-MM-DD format."
        ) from exc


def _normalize_row(row: Any, index: int, catalog: dict) -> dict | None:
    if not isinstance(row, dict):
        raise ProductionScheduleValidationError(
            f"Production Schedule row {index} must be an object."
        )
    if set(row) - {"source_row_number", "record_data"}:
        raise ProductionScheduleValidationError(
            "Production Schedule rows may only contain source_row_number and record_data."
        )

    source_row = row.get("source_row_number")
    if (
        isinstance(source_row, bool)
        or not isinstance(source_row, int)
        or source_row not in SOURCE_ROW_NUMBERS
    ):
        raise ProductionScheduleValidationError(
            f"Production Schedule row {index} must map to one of source rows 8 through 17."
        )

    data = row.get("record_data", {})
    if not isinstance(data, dict):
        raise ProductionScheduleValidationError(
            f"Source row {source_row} must contain a record_data object."
        )
    unknown = set(data) - set(INPUT_COLUMNS)
    if unknown:
        columns = ", ".join(sorted(str(column) for column in unknown))
        raise ProductionScheduleValidationError(
            f"Source row {source_row} contains calculated, helper, or unsupported columns: {columns}."
        )

    normalized: dict[str, str] = {}
    for column, value in data.items():
        if column in NUMERIC_COLUMNS:
            result = _number(value, NUMERIC_COLUMNS[column])
        else:
            label, maximum = TEXT_LIMITS[column]
            result = _text(value, label, maximum)
        if result is not None:
            normalized[column] = result

    product_group = normalized.get("B")
    product_code = normalized.get("C")
    has_any_input = bool(normalized)

    if not product_code:
        if has_any_input:
            raise ProductionScheduleValidationError(
                f"Source row {source_row}: select a Production Code before saving this row; "
                "the source Has Data rule uses Production Code as its key."
            )
        return None

    if not product_group:
        raise ProductionScheduleValidationError(
            f"Source row {source_row}: select a Product Name before selecting a Production Code."
        )

    product_groups = catalog.get("product_groups") or []
    if product_group not in product_groups:
        raise ProductionScheduleValidationError(
            f"Source row {source_row}: choose a Product Name from the current Schedule Lists."
        )

    group_codes = catalog.get("group_codes") or {}
    if product_code not in (group_codes.get(product_group) or []):
        raise ProductionScheduleValidationError(
            f"Source row {source_row}: the Production Code does not belong to the selected Product Name."
        )

    choices = {
        "E": ("Line", catalog.get("line_options") or []),
        "F": ("Area", catalog.get("area_options") or []),
        "L": ("UM", catalog.get("uom") or []),
    }
    for column, (label, options) in choices.items():
        selected = normalized.get(column)
        if selected and selected not in options:
            raise ProductionScheduleValidationError(
                f"Source row {source_row}: choose a valid {label} from the current Schedule Lists."
            )

    return {
        "source_row_number": source_row,
        "record_data": normalized,
    }


def normalize_production_schedule_form(body: Any, catalog: dict) -> dict:
    """Normalize only editable source columns; TFI2 derives A/H/I/J/N/Q and S:U."""
    if not isinstance(body, dict):
        raise ProductionScheduleValidationError("Production Schedule request must be an object.")
    unknown = set(body) - {"production_date", "available_pax_total", "rows"}
    if unknown:
        raise ProductionScheduleValidationError(
            "Production Schedule request contains unsupported fields."
        )

    production_date = _date(body.get("production_date"))
    available_pax_total = _number(
        body.get("available_pax_total"), "Available Pax (day)"
    )

    rows = body.get("rows")
    if not isinstance(rows, list) or not 1 <= len(rows) <= MAX_ROWS:
        raise ProductionScheduleValidationError(
            "A Production Schedule form must contain between 1 and 10 source row slots."
        )

    seen: set[int] = set()
    normalized_rows: list[dict] = []
    for index, row in enumerate(rows, start=1):
        if not isinstance(row, dict):
            raise ProductionScheduleValidationError(
                f"Production Schedule row {index} must be an object."
            )
        source_row = row.get("source_row_number")
        if isinstance(source_row, bool) or not isinstance(source_row, int):
            raise ProductionScheduleValidationError(
                f"Production Schedule row {index} must map to one of source rows 8 through 17."
            )
        if source_row in seen:
            raise ProductionScheduleValidationError(
                f"Production Schedule source row {source_row} was submitted more than once."
            )
        seen.add(source_row)
        normalized = _normalize_row(row, index, catalog)
        if normalized:
            normalized_rows.append(normalized)

    if not normalized_rows:
        raise ProductionScheduleValidationError(
            "Add at least one Product Name and Production Code before saving the daily schedule."
        )

    return {
        "production_date": production_date,
        "available_pax_total": available_pax_total,
        "rows": normalized_rows,
    }
