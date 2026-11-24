"""Source-aligned DMR Production manual-entry contract."""
from __future__ import annotations

import json
from datetime import date, time
from decimal import Decimal
from pathlib import Path
from typing import Any

MANIFEST_PATH = Path(__file__).with_name("dmr_production_manifest.json")
DMR_PRODUCTION_MANIFEST = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))

INPUT_COLUMNS = ("A", "B", "C", "D", "E", "H", "I", "J", "K")
REQUIRED_COLUMNS = ("A", "B", "C", "D", "E", "H")
TEXT_LIMITS = {
    "B": ("Product Code", 100),
    "C": ("Line", 120),
    "H": ("Category", 120),
    "I": ("Source column I", 120),
    "J": ("Source column J", 120),
    "K": ("Remarks", 1000),
}
MAX_BATCH_ROWS = 50


class DmrProductionValidationError(ValueError):
    """Raised when a DMR Production request violates the approved source contract."""


def get_dmr_production_catalog(reference_data: dict | None = None) -> dict:
    """Return source suggestions plus current TFI2 Code Map / DPR LEGEND values."""
    reference_data = reference_data or {}
    return {
        "product_codes": list(DMR_PRODUCTION_MANIFEST["productCodes"]),
        "product_names": dict(reference_data.get("product_names") or DMR_PRODUCTION_MANIFEST["productNames"]),
        "lines": list(DMR_PRODUCTION_MANIFEST["lines"]),
        "categories": list(reference_data.get("categories") or DMR_PRODUCTION_MANIFEST["categories"]),
        "additional_options": list(reference_data.get("additional_options") or DMR_PRODUCTION_MANIFEST["additionalOptions"]),
        "source": {
            "worksheet": DMR_PRODUCTION_MANIFEST["sourceSheet"],
            "sheet_id": DMR_PRODUCTION_MANIFEST["sourceSheetId"],
            "range": DMR_PRODUCTION_MANIFEST["sourceRange"],
            "header_row": 3,
            "first_data_row": 4,
        },
        "product_code_note": (
            "Suggestions are observed values from the source worksheet. "
            "The original source validation is broken; this list is not a canonical product catalog."
        ),
    }


def _text(value: Any, field: str, maximum: int, *, preserve_whitespace: bool = False) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        raise DmrProductionValidationError(f"{field} must be text.")
    if not value.strip():
        return None
    result = value if preserve_whitespace else value.strip()
    if len(result) > maximum:
        raise DmrProductionValidationError(f"{field} must be {maximum:,} characters or fewer.")
    return result


def _date(value: Any) -> str:
    if not isinstance(value, str) or not value.strip():
        raise DmrProductionValidationError("Date is required and must use YYYY-MM-DD format.")
    try:
        return date.fromisoformat(value.strip()).isoformat()
    except ValueError as exc:
        raise DmrProductionValidationError("Date must use YYYY-MM-DD format.") from exc


def _time(value: Any, field: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise DmrProductionValidationError(f"{field} time is required.")
    raw = value.strip()
    try:
        parsed = time.fromisoformat(raw)
    except ValueError as exc:
        raise DmrProductionValidationError(f"{field} must be a valid time.") from exc
    if parsed.tzinfo is not None:
        raise DmrProductionValidationError(f"{field} must be a local time without a timezone.")
    return parsed.replace(tzinfo=None).isoformat(timespec="seconds")


def _option(value: str | None, options: list[str], field: str) -> str | None:
    if value is None:
        return None
    match = next((item for item in options if item.strip().casefold() == value.strip().casefold()), None)
    if match is None:
        raise DmrProductionValidationError(f"Choose a valid {field} from the current source options.")
    return match


def _normalize_record_data(data: Any, *, catalog: dict | None = None, partial: bool = False) -> dict:
    if not isinstance(data, dict):
        raise DmrProductionValidationError("Each DMR row must contain a record_data object.")
    unknown = set(data) - set(INPUT_COLUMNS)
    if unknown:
        columns = ", ".join(sorted(str(item) for item in unknown))
        raise DmrProductionValidationError(
            f"Calculated, lookup, or unsupported source columns cannot be submitted: {columns}."
        )

    normalized: dict[str, str | None] = {}
    for column, value in data.items():
        if column == "A":
            normalized[column] = _date(value) if value not in (None, "") else None
        elif column in ("D", "E"):
            normalized[column] = _time(value, "Stop" if column == "D" else "Resume") if value not in (None, "") else None
        else:
            label, maximum = TEXT_LIMITS[column]
            normalized[column] = _text(value, label, maximum, preserve_whitespace=column in ("I", "J"))

    catalog = catalog or get_dmr_production_catalog()
    if normalized.get("H") is not None:
        allowed_categories = [str(item["code"]) for item in catalog["categories"]]
        normalized["H"] = _option(normalized["H"], allowed_categories, "Category")
    for column in ("I", "J"):
        if normalized.get(column) is not None:
            normalized[column] = _option(normalized[column], catalog["additional_options"], f"column {column}")

    if partial:
        return {key: value for key, value in normalized.items() if key in data}

    missing = [column for column in REQUIRED_COLUMNS if not normalized.get(column)]
    if missing:
        labels = {"A": "Date", "B": "Product Code", "C": "Line", "D": "Stop", "E": "Resume", "H": "Category"}
        raise DmrProductionValidationError("Complete the required fields: " + ", ".join(labels[item] for item in missing) + ".")

    return {key: value for key, value in normalized.items() if value is not None}


def calculate_downtime(stop_time: str, resume_time: str) -> dict[str, str]:
    """Match the worksheet MOD(Resume-Stop, 1) duration, including overnight events."""
    stop = time.fromisoformat(stop_time)
    resume = time.fromisoformat(resume_time)
    start_minutes = Decimal(stop.hour * 60 + stop.minute) + Decimal(stop.second) / Decimal(60)
    end_minutes = Decimal(resume.hour * 60 + resume.minute) + Decimal(resume.second) / Decimal(60)
    minutes = end_minutes - start_minutes
    if minutes < 0:
        minutes += Decimal(1440)
    hours = minutes / Decimal(60)
    return {
        "downtime_minutes": format(minutes.quantize(Decimal("0.0001")), "f"),
        "downtime_hours": format(hours.quantize(Decimal("0.0001")), "f"),
    }


def normalize_dmr_production_records(records: Any, catalog: dict | None = None) -> list[dict]:
    if not isinstance(records, list) or not 1 <= len(records) <= MAX_BATCH_ROWS:
        raise DmrProductionValidationError(f"Submit between 1 and {MAX_BATCH_ROWS} DMR rows.")
    normalized_rows: list[dict] = []
    for index, item in enumerate(records, start=1):
        if not isinstance(item, dict) or set(item) - {"row_index", "record_data"}:
            raise DmrProductionValidationError(f"DMR row {index} must contain only row_index and record_data.")
        row_index = item.get("row_index", index)
        if isinstance(row_index, bool) or not isinstance(row_index, int) or row_index < 1 or row_index > 1000:
            raise DmrProductionValidationError(f"DMR row {index} has an invalid row index.")
        data = item.get("record_data", {})
        if not isinstance(data, dict):
            raise DmrProductionValidationError(f"DMR row {row_index} must contain record_data.")
        if not any(value not in (None, "") and (not isinstance(value, str) or value.strip()) for value in data.values()):
            continue
        values = _normalize_record_data(data, catalog=catalog)
        normalized_rows.append({
            "row_index": row_index,
            "record_data": {
                "production_date": values["A"],
                "product_code": values["B"],
                "line": values["C"],
                "stop_time": values["D"],
                "resume_time": values["E"],
                "category": values["H"],
                "source_column_i": values.get("I"),
                "source_column_j": values.get("J"),
                "remarks": values.get("K"),
            },
            "derived": calculate_downtime(values["D"], values["E"]),
            "product_name": (catalog or get_dmr_production_catalog())["product_names"].get(values["B"], "Other"),
        })
    if not normalized_rows:
        raise DmrProductionValidationError("Enter at least one complete DMR downtime record before saving.")
    return normalized_rows


def normalize_dmr_production_changes(current: dict, changes: Any, catalog: dict | None = None) -> dict:
    if not isinstance(changes, dict) or not changes:
        raise DmrProductionValidationError("Provide at least one DMR field change.")
    if set(changes) - set(INPUT_COLUMNS):
        raise DmrProductionValidationError("Calculated, lookup, and unsupported DMR fields cannot be edited.")
    existing = {
        "A": current.get("production_date"),
        "B": current.get("product_code"),
        "C": current.get("line"),
        "D": current.get("stop_time"),
        "E": current.get("resume_time"),
        "H": current.get("category"),
        "I": current.get("source_column_i"),
        "J": current.get("source_column_j"),
        "K": current.get("remarks"),
    }
    merged = {**existing, **changes}
    normalized = _normalize_record_data(merged, catalog=catalog)
    output = {
        "production_date": normalized["A"],
        "product_code": normalized["B"],
        "line": normalized["C"],
        "stop_time": normalized["D"],
        "resume_time": normalized["E"],
        "category": normalized["H"],
        "source_column_i": normalized.get("I"),
        "source_column_j": normalized.get("J"),
        "remarks": normalized.get("K"),
    }
    changed = {}
    mapping = {
        "A": "production_date", "B": "product_code", "C": "line", "D": "stop_time",
        "E": "resume_time", "H": "category", "I": "source_column_i",
        "J": "source_column_j", "K": "remarks",
    }
    for column in changes:
        field = mapping[column]
        if output[field] != current.get(field):
            changed[field] = output[field]
    if not changed:
        return {"changes": {}, "derived": calculate_downtime(normalized["D"], normalized["E"])}
    return {"changes": changed, "derived": calculate_downtime(normalized["D"], normalized["E"])}
