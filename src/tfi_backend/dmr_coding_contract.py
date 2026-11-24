"""Source-aligned DMR Coding manual-entry contract."""
from __future__ import annotations

import json
from datetime import date, time
from decimal import Decimal
from pathlib import Path
from typing import Any

MANIFEST_PATH = Path(__file__).with_name("dmr_coding_manifest.json")
DMR_CODING_MANIFEST = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))

INPUT_COLUMNS = ("A", "B", "C", "D", "E", "H", "I", "J")
TEXT_LIMITS = {
    "B": ("Product Code", 100),
    "C": ("Line", 80),
    "H": ("Category", 80),
    "I": ("Factor", 120),
    "J": ("Reason", 1000),
}
MAX_BATCH_ROWS = 50


class DmrCodingValidationError(ValueError):
    """Raised when a DMR Coding request violates the approved source contract."""


def get_dmr_coding_catalog(reference_data: dict | None = None) -> dict:
    reference_data = reference_data or {}
    return {
        "product_codes": list(reference_data.get("product_codes") or DMR_CODING_MANIFEST["productCodes"]),
        "product_names": dict(reference_data.get("product_names") or DMR_CODING_MANIFEST["productNames"]),
        "lines": list(DMR_CODING_MANIFEST["lines"]),
        "categories": list(reference_data.get("categories") or DMR_CODING_MANIFEST["categories"]),
        "factors": list(reference_data.get("factors") or DMR_CODING_MANIFEST["factors"]),
        "historical_codes_not_in_master_list": list(DMR_CODING_MANIFEST.get("sourceNotes", {}).get("historicalCodesNotInMasterList", [])),
        "source": {
            "worksheet": DMR_CODING_MANIFEST["sourceSheet"],
            "sheet_id": DMR_CODING_MANIFEST["sourceSheetId"],
            "range": DMR_CODING_MANIFEST["sourceRange"],
            "header_row": 3,
            "first_data_row": DMR_CODING_MANIFEST["sourceDataRows"]["first"],
            "blank_template_first_row": DMR_CODING_MANIFEST["blankTemplate"]["firstSourceRow"],
        },
        "product_code_note": (
            "Use current DPR LEGEND suggestions when available. Unmatched historical codes are preserved as entered; "
            "do not substitute or invent a replacement code."
        ),
    }


def _text(value: Any, label: str, maximum: int) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        raise DmrCodingValidationError(f"{label} must be text.")
    if not value.strip():
        return None
    result = value.strip()
    if len(result) > maximum:
        raise DmrCodingValidationError(f"{label} must be {maximum:,} characters or fewer.")
    return result


def _date(value: Any) -> str | None:
    if value in (None, ""):
        return None
    if not isinstance(value, str):
        raise DmrCodingValidationError("Date must use YYYY-MM-DD format.")
    try:
        return date.fromisoformat(value.strip()).isoformat()
    except ValueError as exc:
        raise DmrCodingValidationError("Date must use YYYY-MM-DD format.") from exc


def _time(value: Any, label: str) -> str | None:
    if value in (None, ""):
        return None
    if not isinstance(value, str):
        raise DmrCodingValidationError(f"{label} must be a valid local time.")
    try:
        parsed = time.fromisoformat(value.strip())
    except ValueError as exc:
        raise DmrCodingValidationError(f"{label} must be a valid local time.") from exc
    if parsed.tzinfo is not None:
        raise DmrCodingValidationError(f"{label} must not include a timezone.")
    return parsed.replace(tzinfo=None).isoformat(timespec="seconds")


def _choice(value: str | None, choices: list[str], label: str) -> str | None:
    if value is None:
        return None
    match = next((item for item in choices if item.strip().casefold() == value.strip().casefold()), None)
    if match is None:
        raise DmrCodingValidationError(f"Choose {label} from the current TFI2 reference options.")
    return match


def _normalize(data: Any, catalog: dict | None = None) -> dict:
    if not isinstance(data, dict):
        raise DmrCodingValidationError("Each DMR Coding row must contain a record_data object.")
    unknown = set(data) - set(INPUT_COLUMNS)
    if unknown:
        columns = ", ".join(sorted(str(item) for item in unknown))
        raise DmrCodingValidationError(f"Calculated or unsupported source columns cannot be submitted: {columns}.")

    normalized: dict[str, Any] = {}
    for column, value in data.items():
        if column == "A":
            normalized[column] = _date(value)
        elif column in ("D", "E"):
            normalized[column] = _time(value, "Stop" if column == "D" else "Resume")
        else:
            label, maximum = TEXT_LIMITS[column]
            normalized[column] = _text(value, label, maximum)

    catalog = catalog or get_dmr_coding_catalog()
    if normalized.get("H") is not None:
        normalized["H"] = _choice(normalized["H"], catalog["categories"], "Category")
    if normalized.get("I") is not None:
        normalized["I"] = _choice(normalized["I"], catalog["factors"], "Factor")
    return {key: value for key, value in normalized.items() if key in data}


def calculate_dmr_coding_downtime(stop_time: str | None, resume_time: str | None) -> dict:
    if not stop_time or not resume_time:
        return {"downtime_minutes": None, "downtime_hours": None}
    stop = time.fromisoformat(stop_time)
    resume = time.fromisoformat(resume_time)
    start_minutes = Decimal(stop.hour * 60 + stop.minute) + Decimal(stop.second) / Decimal(60)
    end_minutes = Decimal(resume.hour * 60 + resume.minute) + Decimal(resume.second) / Decimal(60)
    minutes = end_minutes - start_minutes
    if minutes < 0:
        minutes += Decimal(1440)
    return {
        "downtime_minutes": format(minutes.quantize(Decimal("0.0001")), "f"),
        "downtime_hours": format((minutes / Decimal(60)).quantize(Decimal("0.0001")), "f"),
    }


def normalize_dmr_coding_records(records: Any, catalog: dict | None = None) -> list[dict]:
    if not isinstance(records, list) or not 1 <= len(records) <= MAX_BATCH_ROWS:
        raise DmrCodingValidationError(f"Submit between 1 and {MAX_BATCH_ROWS} DMR Coding rows.")
    normalized_rows = []
    catalog = catalog or get_dmr_coding_catalog()
    for index, item in enumerate(records, start=1):
        if not isinstance(item, dict) or set(item) - {"row_index", "record_data"}:
            raise DmrCodingValidationError(f"DMR Coding row {index} has an invalid structure.")
        row_index = item.get("row_index", index)
        if isinstance(row_index, bool) or not isinstance(row_index, int) or row_index < 1 or row_index > 1000:
            raise DmrCodingValidationError(f"DMR Coding row {index} has an invalid row index.")
        data = item.get("record_data", {})
        if not isinstance(data, dict):
            raise DmrCodingValidationError(f"DMR Coding row {row_index} must contain record_data.")
        if not any(value not in (None, "") and (not isinstance(value, str) or value.strip()) for value in data.values()):
            continue
        values = _normalize(data, catalog)
        product_code = values.get("B")
        code_status = (
            "not_entered" if not product_code else
            "matched" if product_code in catalog["product_codes"] else
            "unmatched"
        )
        record_data = {
            "production_date": values.get("A"),
            "product_code": product_code,
            "line": values.get("C"),
            "stop_time": values.get("D"),
            "resume_time": values.get("E"),
            "category": values.get("H"),
            "factor": values.get("I"),
            "reason": values.get("J"),
            "product_code_reference_status": code_status,
            "completeness_status": "unassessed",
        }
        derived = calculate_dmr_coding_downtime(values.get("D"), values.get("E"))
        normalized_rows.append({
            "row_index": row_index,
            "source_row_number": DMR_CODING_MANIFEST["blankTemplate"]["firstSourceRow"] + row_index - 1,
            "record_data": record_data,
            "derived": derived,
            "product_name": catalog["product_names"].get(product_code, "Other") if product_code else "",
        })
    if not normalized_rows:
        raise DmrCodingValidationError("Enter at least one DMR Coding field before saving.")
    return normalized_rows


def normalize_dmr_coding_changes(current: dict, changes: Any, catalog: dict | None = None) -> dict:
    if not isinstance(changes, dict) or not changes:
        raise DmrCodingValidationError("Provide at least one DMR Coding field change.")
    if set(changes) - set(INPUT_COLUMNS):
        raise DmrCodingValidationError("Calculated, lookup, and unsupported DMR Coding fields cannot be edited.")
    existing = {
        "A": current.get("production_date"), "B": current.get("product_code"),
        "C": current.get("line"), "D": current.get("stop_time"), "E": current.get("resume_time"),
        "H": current.get("category"), "I": current.get("factor"), "J": current.get("reason"),
    }
    normalized = _normalize({**existing, **changes}, catalog)
    mapping = {
        "A": "production_date", "B": "product_code", "C": "line", "D": "stop_time",
        "E": "resume_time", "H": "category", "I": "factor", "J": "reason",
    }
    output = {mapping[key]: value for key, value in normalized.items()}
    code = output.get("product_code")
    catalog = catalog or get_dmr_coding_catalog()
    output["product_code_reference_status"] = (
        "not_entered" if not code else "matched" if code in catalog["product_codes"] else "unmatched"
    )
    output["completeness_status"] = "unassessed"
    changed = {}
    for column in changes:
        field = mapping[column]
        if output[field] != current.get(field):
            changed[field] = output[field]
    return {
        "changes": changed,
        "derived": calculate_dmr_coding_downtime(output.get("stop_time"), output.get("resume_time")),
    }
