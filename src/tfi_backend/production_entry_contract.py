"""Source-aligned Production Entry and Production Summary contract."""
from __future__ import annotations

import json
from datetime import date, time
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any


class ProductionEntryValidationError(ValueError):
    """Raised when a Production Entry request violates the verified source contract."""


MANIFEST_PATH = Path(__file__).with_name("production_entry_manifest.json")
with MANIFEST_PATH.open("r", encoding="utf-8") as _file:
    PRODUCTION_ENTRY_MANIFEST = json.load(_file)

MAX_ROWS_PER_FORM = 12
MAX_TEXT_LENGTH = 1000
INPUT_COLUMNS = tuple(PRODUCTION_ENTRY_MANIFEST["input_columns"])
HAS_DATA_COLUMNS = tuple(PRODUCTION_ENTRY_MANIFEST["has_data_columns"])
PRODUCT_NAMES = tuple(PRODUCTION_ENTRY_MANIFEST["product_names"])
PRODUCT_CODES = PRODUCTION_ENTRY_MANIFEST["product_codes"]
UOM_OPTIONS = tuple(PRODUCTION_ENTRY_MANIFEST["uom"])
SLOTS = {
    int(item["source_row_number"]): item
    for item in PRODUCTION_ENTRY_MANIFEST["form"]["slots"]
}


def get_production_entry_catalog() -> dict:
    """Return the verified 12-slot form and 24-column summary source contract."""
    return PRODUCTION_ENTRY_MANIFEST


def _text(value: Any, field: str, *, maximum: int = MAX_TEXT_LENGTH) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        raise ProductionEntryValidationError(f"{field} must be text.")
    normalized = value.strip() or None
    if normalized and len(normalized) > maximum:
        raise ProductionEntryValidationError(
            f"{field} must be {maximum:,} characters or fewer."
        )
    return normalized


def _date(value: Any) -> str | None:
    if value is None or value == "":
        return None
    if not isinstance(value, str):
        raise ProductionEntryValidationError("Production date must use YYYY-MM-DD format.")
    try:
        return date.fromisoformat(value.strip()).isoformat()
    except ValueError as exc:
        raise ProductionEntryValidationError(
            "Production date must use YYYY-MM-DD format."
        ) from exc


def _time(value: Any, field: str) -> str | None:
    if value is None or value == "":
        return None
    if not isinstance(value, str):
        raise ProductionEntryValidationError(f"{field} must use a valid time.")
    try:
        parsed = time.fromisoformat(value.strip())
    except ValueError as exc:
        raise ProductionEntryValidationError(f"{field} must use a valid time.") from exc
    if parsed.tzinfo is not None:
        raise ProductionEntryValidationError(f"{field} must not include a timezone.")
    return parsed.isoformat(timespec="seconds" if parsed.second or parsed.microsecond else "minutes")


def _number(value: Any, field: str) -> str | None:
    if value is None or value == "":
        return None
    if isinstance(value, bool) or isinstance(value, (dict, list)):
        raise ProductionEntryValidationError(f"{field} must be a nonnegative number.")
    try:
        parsed = Decimal(str(value).strip())
    except (InvalidOperation, ValueError) as exc:
        raise ProductionEntryValidationError(f"{field} must be a nonnegative number.") from exc
    if not parsed.is_finite() or parsed < 0:
        raise ProductionEntryValidationError(f"{field} must be a nonnegative number.")
    if len(parsed.as_tuple().digits) > 30 or len(format(parsed, "f")) > 80:
        raise ProductionEntryValidationError(f"{field} exceeds the supported numeric length.")
    return format(parsed, "f")


def _fraction(numerator: str | None, denominator: str | None) -> str | None:
    if numerator is None or denominator is None:
        return None
    bottom = Decimal(denominator)
    if bottom <= 0:
        return None
    return format(Decimal(numerator) / bottom, "f")


def _normalize_input_data(data: Any, row_number: int) -> dict[str, str]:
    if not isinstance(data, dict):
        raise ProductionEntryValidationError(
            f"Production Entry source slot {row_number} must contain a record_data object."
        )
    unknown = set(data) - set(INPUT_COLUMNS)
    if unknown:
        columns = ", ".join(sorted(str(column) for column in unknown))
        raise ProductionEntryValidationError(
            f"Source slot {row_number} contains calculated, trace, or unsupported columns: {columns}."
        )

    normalized: dict[str, str] = {}
    for column, value in data.items():
        if column == "A":
            result = _date(value)
        elif column in {"E", "F", "G", "O", "P", "S"}:
            result = _number(value, {
                "E": "No. of Batches",
                "F": "Target",
                "G": "Produced",
                "O": "Manpower Requirement",
                "P": "Present",
                "S": "OT Hours",
            }[column])
        elif column in {"J", "K", "L", "M", "N"}:
            result = _time(value, {
                "J": "Plan Start",
                "K": "Actual Start",
                "L": "Plan End",
                "M": "Actual End (Production)",
                "N": "Actual End (Cleaning)",
            }[column])
        elif column == "C":
            result = _text(value, "Product Name", maximum=200)
        elif column == "D":
            result = _text(value, "Product Code", maximum=100)
        elif column == "H":
            result = _text(value, "UOM", maximum=30)
        elif column == "T":
            result = _text(value, "Remarks")
        else:
            raise ProductionEntryValidationError(
                f"Source slot {row_number} contains an unsupported input column."
            )
        if result is not None:
            normalized[column] = result

    product_name = normalized.get("C")
    product_code = normalized.get("D")
    if product_name and product_name not in PRODUCT_NAMES:
        raise ProductionEntryValidationError(
            f"Source slot {row_number}: select a Product Name from the verified DPR LEGEND list."
        )
    if product_code:
        if not product_name or product_code not in PRODUCT_CODES.get(product_name, []):
            raise ProductionEntryValidationError(
                f"Source slot {row_number}: Product Code is not valid for the selected Product Name."
            )
    if normalized.get("H") and normalized["H"] not in UOM_OPTIONS:
        raise ProductionEntryValidationError(
            f"Source slot {row_number}: select a valid UOM."
        )
    return normalized


def _has_data(data: dict[str, str]) -> bool:
    return any(data.get(column) for column in HAS_DATA_COLUMNS)


def _build_record_data(data: dict[str, str], line: str) -> dict[str, Any]:
    target = data.get("F")
    produced = data.get("G")
    manpower = data.get("O")
    present = data.get("P")
    attainment = _fraction(produced, target) if target is not None and Decimal(target) > 0 else None
    absent = (
        format(Decimal(manpower) - Decimal(present), "f")
        if manpower is not None and present is not None else None
    )
    attendance = _fraction(present, manpower) if manpower is not None and Decimal(manpower) > 0 else None

    result: dict[str, Any] = {column: data.get(column) for column in "ABCDEFGHIJKLMNOPQRST"}
    result.update({
        "B": line,
        "I": attainment,
        "Q": absent,
        "R": attendance,
        "U": None,
        "V": None,
        "W": _has_data(data),
        "X": None,
    })
    return result


def normalize_production_entry_row(row: Any, index: int) -> dict:
    if not isinstance(row, dict):
        raise ProductionEntryValidationError(f"Production Entry row {index} must be an object.")
    unknown = set(row) - {"source_row_number", "record_data"}
    if unknown:
        raise ProductionEntryValidationError(
            "Production Entry rows may only contain source_row_number and record_data."
        )
    source_row = row.get("source_row_number")
    if isinstance(source_row, bool) or not isinstance(source_row, int) or source_row not in SLOTS:
        raise ProductionEntryValidationError(
            f"Production Entry row {index} must map to one of source rows 8 through 19."
        )
    slot = SLOTS[source_row]
    data = _normalize_input_data(row.get("record_data", {}), source_row)
    has_data = _has_data(data)
    record_data = _build_record_data(data, slot["line"])
    blank_fields = [column for column in INPUT_COLUMNS if column not in data]
    return {
        "source_row_number": source_row,
        "line": slot["line"],
        "input_data": data,
        "record_data": record_data,
        "has_data": has_data,
        "blank_fields": blank_fields,
        "completeness_status": "unassessed",
    }


def normalize_production_entry_records(records: Any) -> list[dict]:
    if not isinstance(records, list) or not 1 <= len(records) <= MAX_ROWS_PER_FORM:
        raise ProductionEntryValidationError(
            f"Submit between 1 and {MAX_ROWS_PER_FORM} Production Entry source rows."
        )
    normalized = [
        normalize_production_entry_row(row, index)
        for index, row in enumerate(records, start=1)
    ]
    source_rows = [row["source_row_number"] for row in normalized]
    if len(source_rows) != len(set(source_rows)):
        raise ProductionEntryValidationError(
            "A Production Entry form cannot submit the same source row slot more than once."
        )
    return normalized


def normalize_production_entry_changes(
    current_record_data: Any, source_row_number: int, changes: Any
) -> dict:
    if not isinstance(changes, dict) or not changes:
        raise ProductionEntryValidationError("Provide at least one Production Entry field to update.")
    unknown = set(changes) - set(INPUT_COLUMNS)
    if unknown:
        columns = ", ".join(sorted(str(column) for column in unknown))
        raise ProductionEntryValidationError(
            f"Production Entry update contains calculated, trace, or unsupported columns: {columns}."
        )
    if not isinstance(current_record_data, dict):
        raise ProductionEntryValidationError("The current Production Entry record is invalid.")

    combined = {
        column: current_record_data.get(column)
        for column in INPUT_COLUMNS
        if current_record_data.get(column) is not None
    }
    for column, value in changes.items():
        if value is None or value == "":
            combined.pop(column, None)
        else:
            combined[column] = value

    normalized = normalize_production_entry_row(
        {"source_row_number": source_row_number, "record_data": combined}, 1
    )
    if not normalized["has_data"]:
        raise ProductionEntryValidationError(
            "A saved Production Entry run must retain at least one source Has data field."
        )

    changed: dict[str, str | None] = {}
    for column in changes:
        changed[column] = normalized["input_data"].get(column)
    return {"changes": changed, "record": normalized}
