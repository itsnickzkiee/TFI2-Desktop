"""Source-aligned Coding DPR manual-entry contract.

The source has A:B entry identity, seven C:W date/code/quantity lots, and
X as a derived total that intentionally sums only lot slots 1-6.
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Any

LOT_COLUMNS = (
    ("C", "D", "E"),
    ("F", "G", "H"),
    ("I", "J", "K"),
    ("L", "M", "N"),
    ("O", "P", "Q"),
    ("R", "S", "T"),
    ("U", "V", "W"),
)
INPUT_COLUMNS = frozenset({"A", "B"} | {col for batch in LOT_COLUMNS for col in batch})
MAX_BATCH_ROWS = 50
MAX_PRODUCT_CODE_LENGTH = 100
MAX_LINE_NUMBER_LENGTH = 20
MAX_QUANTITY_SCALE = 4


class CodingDprValidationError(ValueError):
    """Raised when a Coding DPR request violates the approved source contract."""


def get_coding_dpr_catalog(reference_data: dict | None = None) -> dict:
    reference_data = reference_data or {}
    return {
        "product_codes": list(reference_data.get("product_codes") or []),
        "line_numbers": list(reference_data.get("line_numbers") or []),
        "source": {
            "spreadsheet_id": "1rCbQ16wj7MRjQCFF3tA-WEMkudraJK0RkwcqayUlz7k",
            "worksheet": "Coding DPR",
            "sheet_id": 1266086431,
            "range": "Coding DPR!A1:X1000",
            "coding_date_column": "A",
            "line_number_column": "B",
            "batch_slots": 7,
            "input_columns": "A:W",
            "derived_column": "X",
            "source_total_batch_slots": [1, 2, 3, 4, 5, 6],
            "batch_7_included_in_source_total": False,
        },
        "source_formula_note": (
            "The source Total Quantity formula sums batch slots 1-6 only. "
            "Batch 7 quantity is retained and displayed separately; it is not included in column X."
        ),
        "product_code_note": (
            "Use the 116 current DPR LEGEND suggestions. Product Code is not restricted to the list; "
            "unmatched values are preserved and flagged for review. Never substitute another code."
        ),
    }


def _date(value: Any, label: str) -> str | None:
    if value in (None, ""):
        return None
    if not isinstance(value, str):
        raise CodingDprValidationError(f"{label} must use YYYY-MM-DD format.")
    try:
        return date.fromisoformat(value.strip()).isoformat()
    except ValueError as exc:
        raise CodingDprValidationError(f"{label} must use YYYY-MM-DD format.") from exc


def _text(value: Any, label: str, maximum: int) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        raise CodingDprValidationError(f"{label} must be text.")
    result = value.strip()
    if not result:
        return None
    if len(result) > maximum:
        raise CodingDprValidationError(f"{label} must be {maximum:,} characters or fewer.")
    return result


def _line_number(value: Any, catalog: dict) -> str | None:
    line = _text(value, "Line Number", MAX_LINE_NUMBER_LENGTH)
    if line is None:
        return None
    choices = [str(item).strip() for item in catalog.get("line_numbers", [])]
    match = next((item for item in choices if item.casefold() == line.casefold()), None)
    if match is None:
        raise CodingDprValidationError("Choose Line Number from the current DMP LEGEND options.")
    return match


def _quantity(value: Any) -> str | None:
    if value in (None, ""):
        return None
    if isinstance(value, bool) or isinstance(value, (dict, list)):
        raise CodingDprValidationError("Batch Quantity must be a nonnegative number.")
    raw = str(value).strip().replace(",", "")
    if not raw:
        return None
    try:
        number = Decimal(raw)
    except (InvalidOperation, ValueError) as exc:
        raise CodingDprValidationError("Batch Quantity must be a nonnegative number.") from exc
    if not number.is_finite() or number < 0:
        raise CodingDprValidationError("Batch Quantity must be a finite, nonnegative number.")
    if max(0, -number.as_tuple().exponent) > MAX_QUANTITY_SCALE:
        raise CodingDprValidationError("Batch Quantity supports up to four decimal places.")
    return format(number, "f")


def _normalize_record_data(data: Any, catalog: dict | None = None) -> dict:
    if not isinstance(data, dict):
        raise CodingDprValidationError("Each Coding DPR row must contain a record_data object.")
    unknown = set(data) - INPUT_COLUMNS
    if unknown:
        columns = ", ".join(sorted(str(item) for item in unknown))
        raise CodingDprValidationError(f"Calculated or unsupported source columns cannot be submitted: {columns}.")
    catalog = catalog or get_coding_dpr_catalog()
    coding_date = _date(data.get("A"), "Coding / Labelling Date")
    line_number = _line_number(data.get("B"), catalog)
    lots = []
    for index, columns in enumerate(LOT_COLUMNS, start=1):
        production_date_col, product_code_col, quantity_col = columns
        production_date = _date(data.get(production_date_col), f"Batch {index} Production Date")
        product_code = _text(data.get(product_code_col), f"Batch {index} Product Code", MAX_PRODUCT_CODE_LENGTH)
        quantity = _quantity(data.get(quantity_col))
        lots.append({
            "lot_number": index,
            "production_date": production_date,
            "product_code": product_code,
            "quantity": quantity,
        })
    return {"coding_date": coding_date, "line_number": line_number, "lots": lots}


def _has_record_input(record_data: dict) -> bool:
    return bool(
        record_data.get("coding_date")
        or record_data.get("line_number")
        or any(lot.get("production_date") or lot.get("product_code") or lot.get("quantity") is not None
               for lot in record_data.get("lots", []))
    )


def coding_dpr_review_reasons(record_data: dict, catalog: dict | None = None) -> list[str]:
    catalog = catalog or get_coding_dpr_catalog()
    reasons = []
    if not record_data.get("line_number"):
        reasons.append("missing_line_number")
    known_codes = {str(code).strip().casefold() for code in catalog.get("product_codes", [])}
    for lot in record_data.get("lots", []):
        present = sum(value not in (None, "") for value in (
            lot.get("production_date"), lot.get("product_code"), lot.get("quantity")
        ))
        if present and present < 3:
            reasons.append(f"incomplete_lot_{lot['lot_number']}")
        code = lot.get("product_code")
        if code and code.strip().casefold() not in known_codes:
            reasons.append(f"unmatched_product_code_lot_{lot['lot_number']}")
    return reasons


def coding_dpr_calculations(record_data: dict) -> dict:
    lots = record_data.get("lots", [])
    total = sum((Decimal(lot["quantity"]) for lot in lots[:6] if lot.get("quantity") is not None), Decimal(0))
    batch7 = Decimal(lots[6]["quantity"]) if len(lots) >= 7 and lots[6].get("quantity") is not None else Decimal(0)
    return {
        "total_quantity": format(total, "f"),
        "batch7_quantity": format(batch7, "f"),
        "lot_count": sum(1 for lot in lots if lot.get("production_date") or lot.get("product_code") or lot.get("quantity") is not None),
        "review_reasons": coding_dpr_review_reasons(record_data),
        "review_status": "needs_review" if coding_dpr_review_reasons(record_data) else "unassessed",
    }


def normalize_coding_dpr_records(records: Any, catalog: dict | None = None) -> list[dict]:
    if not isinstance(records, list) or not 1 <= len(records) <= MAX_BATCH_ROWS:
        raise CodingDprValidationError(f"Submit between 1 and {MAX_BATCH_ROWS} Coding DPR rows.")
    catalog = catalog or get_coding_dpr_catalog()
    normalized_rows = []
    for index, item in enumerate(records, start=1):
        if not isinstance(item, dict) or set(item) - {"row_index", "record_data"}:
            raise CodingDprValidationError(f"Coding DPR row {index} has an invalid structure.")
        row_index = item.get("row_index", index)
        if isinstance(row_index, bool) or not isinstance(row_index, int) or not 1 <= row_index <= 1000:
            raise CodingDprValidationError(f"Coding DPR row {index} has an invalid row index.")
        record_data = _normalize_record_data(item.get("record_data", {}), catalog)
        if not _has_record_input(record_data):
            continue
        normalized_rows.append({
            "row_index": row_index,
            "record_data": record_data,
            "derived": coding_dpr_calculations(record_data),
        })
    if not normalized_rows:
        raise CodingDprValidationError("Enter at least one Coding DPR field before saving.")
    return normalized_rows


def _current_as_columns(current: dict) -> dict:
    data = {"A": current.get("coding_date") or "", "B": current.get("line_number") or ""}
    lots = {int(lot.get("lot_number", 0)): lot for lot in current.get("lots", [])}
    for index, columns in enumerate(LOT_COLUMNS, start=1):
        lot = lots.get(index, {})
        data[columns[0]] = lot.get("production_date") or ""
        data[columns[1]] = lot.get("product_code") or ""
        data[columns[2]] = "" if lot.get("quantity") is None else str(lot.get("quantity"))
    return data


def normalize_coding_dpr_changes(current: dict, changes: Any, catalog: dict | None = None) -> dict:
    if not isinstance(changes, dict) or not changes:
        raise CodingDprValidationError("Provide at least one Coding DPR field change.")
    if set(changes) - INPUT_COLUMNS:
        raise CodingDprValidationError("Calculated, lookup, and unsupported Coding DPR fields cannot be edited.")
    merged = _current_as_columns(current)
    merged.update(changes)
    record_data = _normalize_record_data(merged, catalog)
    changed_fields = []
    if record_data["coding_date"] != current.get("coding_date"):
        changed_fields.append("coding_date")
    if record_data["line_number"] != current.get("line_number"):
        changed_fields.append("line_number")
    current_data = _normalize_record_data(_current_as_columns(current), catalog)
    if current_data["lots"] != record_data["lots"]:
        changed_fields.append("lots")
    return {"record_data": record_data, "changed_fields": changed_fields}
