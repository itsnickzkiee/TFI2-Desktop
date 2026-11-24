"""Source-backed validation and calculations for an OEE worksheet row."""
from __future__ import annotations

from datetime import date, datetime, timedelta
from decimal import Decimal, InvalidOperation


INPUT_FIELDS = (
    "production_date", "machine", "line", "product_code", "planned_hours",
    "downtime_hours", "ideal_rate", "total_count", "reject_count", "include_in_overall",
)
COUNT_FIELDS = {"total_count", "reject_count"}
SHEETS_EPOCH = date(1899, 12, 30)


def _number(value):
    number = Decimal(str(value).strip())
    if not number.is_finite() or number < 0:
        raise ValueError("Use a finite, nonnegative number.")
    return number


def _input(field, value):
    if field == "production_date":
        if isinstance(value, datetime):
            if value.time() != datetime.min.time() or value.tzinfo is not None:
                raise ValueError("Use a date without a time or timezone.")
            return value.date()
        if isinstance(value, date):
            return value
        if isinstance(value, str):
            return date.fromisoformat(value.strip())
        serial = _number(value)
        if serial != serial.to_integral_value():
            raise ValueError("Use a whole-number spreadsheet date.")
        if serial > (date.max - SHEETS_EPOCH).days:
            raise ValueError("Spreadsheet date is out of range.")
        return SHEETS_EPOCH + timedelta(days=int(serial))
    if field in {"machine", "line", "product_code", "include_in_overall"}:
        if not isinstance(value, str):
            raise ValueError("Use text.")
        value = value.strip()
        if not value:
            raise ValueError("Enter a nonblank value.")
        if field == "include_in_overall":
            value = value.upper()
            if value not in {"Y", "N"}:
                raise ValueError("Use Y or N.")
        return value
    number = _number(value)
    if field in COUNT_FIELDS and number != number.to_integral_value():
        raise ValueError("Use a whole-number count.")
    return number


def inspect_oee_row(source_values):
    """Validate A:J and compute K:T when the row is complete.

    Column U is resolved using the approved Code Map at the destination.
    Use the returned business key to compare records within and across batches.
    """
    inputs = {}
    missing = []
    errors = {}
    for index, field in enumerate(INPUT_FIELDS):
        value = source_values[index] if index < len(source_values) else None
        if value is None or (isinstance(value, str) and not value.strip()):
            missing.append(field)
            continue
        try:
            inputs[field] = _input(field, value)
        except (ValueError, InvalidOperation, OverflowError) as exc:
            errors[field] = str(exc)

    for field, limit in (("downtime_hours", "planned_hours"), ("reject_count", "total_count")):
        if field in inputs and limit in inputs and inputs[field] > inputs[limit]:
            errors[field] = f"Must not exceed {limit.replace('_', ' ')}."

    if errors or missing:
        return {
            "status": "invalid" if errors else "incomplete",
            "inputs": inputs, "missing_fields": missing, "errors": errors,
        }

    day = inputs["production_date"]
    planned = inputs["planned_hours"]
    total = inputs["total_count"]
    run_time = planned - inputs["downtime_hours"]
    good = total - inputs["reject_count"]
    ideal = run_time * inputs["ideal_rate"]
    capped = min(total, ideal)
    availability = run_time / planned if planned > 0 else None
    performance = capped / ideal if ideal > 0 else None
    quality = good / total if total > 0 else None
    oee = None
    if availability is not None and performance is not None and quality is not None:
        oee = availability * performance * quality

    return {
        "status": "valid", "inputs": inputs, "missing_fields": [], "errors": {},
        "business_key": (day.isoformat(), inputs["machine"].casefold(), inputs["product_code"].casefold()),
        "calculated": {
            "run_time_hours": run_time, "good_count": good, "availability": availability,
            "performance": performance, "quality": quality, "oee": oee,
            "ideal_output": ideal, "capped_count": capped,
            "week": day.isocalendar().week, "month": day.month,
        },
    }


class OeeValidationError(ValueError):
    """Raised when a manual OEE entry does not match the approved A:J contract."""


def get_oee_catalog(reference_data=None):
    reference_data = reference_data or {}
    products = reference_data.get("products") or []
    product_names = {
        str(item.get("code")): str(item.get("name") or "Other")
        for item in products if isinstance(item, dict) and item.get("code")
    }
    return {
        "machines": reference_data.get("machines") or [],
        "lines": reference_data.get("lines") or ["AGRILINE", "MEATLINE", "CODINGLINE"],
        "products": products,
        "product_names": product_names,
        "source": reference_data.get("source") or {},
        "validation": {
            "required_fields": list(INPUT_FIELDS),
            "machine_options_source": "KPI Setup!F3:F54; All excluded",
            "product_code_options_source": "KPI Setup!E3:E129; All excluded",
            "line_options_source": "OEE!C5 source validation list",
            "product_name_source": "Code Map!A5:B400; fallback Other",
        },
    }


def _normalize_oee_record_data(data):
    if not isinstance(data, dict):
        raise OeeValidationError("Each OEE row must contain a record_data object.")
    unknown = set(data) - set(INPUT_FIELDS)
    if unknown:
        raise OeeValidationError("Calculated or unsupported OEE fields cannot be submitted or edited: " + ", ".join(sorted(unknown)))
    values = [data.get(field) for field in INPUT_FIELDS]
    result = inspect_oee_row(values)
    if result["status"] == "incomplete":
        missing = ", ".join(result["missing_fields"])
        raise OeeValidationError("Complete all 10 OEE input fields before saving. Missing: " + missing + ".")
    if result["status"] == "invalid":
        errors = "; ".join(f"{field}: {message}" for field, message in result["errors"].items())
        raise OeeValidationError("Check the OEE inputs. " + errors)
    inputs = result["inputs"]
    normalized = {
        "production_date": inputs["production_date"].isoformat(),
        "machine": inputs["machine"],
        "line": inputs["line"],
        "product_code": inputs["product_code"],
        "planned_hours": format(inputs["planned_hours"], "f"),
        "downtime_hours": format(inputs["downtime_hours"], "f"),
        "ideal_rate": format(inputs["ideal_rate"], "f"),
        "total_count": int(inputs["total_count"]),
        "reject_count": int(inputs["reject_count"]),
        "include_in_overall": inputs["include_in_overall"],
    }
    return normalized, result


def normalize_oee_records(records, catalog=None):
    if not isinstance(records, list) or not 1 <= len(records) <= 100:
        raise OeeValidationError("Submit between 1 and 100 OEE rows.")
    normalized = []
    for index, item in enumerate(records, start=1):
        if not isinstance(item, dict) or set(item) - {"row_index", "record_data"}:
            raise OeeValidationError(f"OEE row {index} has an invalid structure.")
        row_index = item.get("row_index", index)
        if isinstance(row_index, bool) or not isinstance(row_index, int) or not 1 <= row_index <= 1000:
            raise OeeValidationError(f"OEE row {index} has an invalid row number.")
        data = item.get("record_data", {})
        if not isinstance(data, dict):
            raise OeeValidationError(f"OEE row {row_index} must contain record_data.")
        if not any(value is not None and (not isinstance(value, str) or value.strip()) for value in data.values()):
            continue
        normalized_data, inspected = _normalize_oee_record_data(data)
        normalized.append({
            "row_index": row_index,
            "record_data": normalized_data,
            "business_key": [
                inspected["business_key"][0],
                inspected["business_key"][1],
                inspected["business_key"][2],
            ],
            "calculated": {
                key: (format(value, "f") if isinstance(value, Decimal) else value)
                for key, value in inspected["calculated"].items()
            },
        })
    if not normalized:
        raise OeeValidationError("Enter at least one OEE input row before saving.")
    return normalized


def normalize_oee_changes(current, changes, catalog=None):
    if not isinstance(changes, dict) or not changes:
        raise OeeValidationError("Provide at least one OEE field change.")
    unknown = set(changes) - set(INPUT_FIELDS)
    if unknown:
        raise OeeValidationError("Calculated or unsupported OEE fields cannot be edited.")
    existing = {field: current.get(field) for field in INPUT_FIELDS}
    existing_data, _ = _normalize_oee_record_data(existing)
    merged_data = dict(existing_data)
    merged_data.update(changes)
    normalized_data, inspected = _normalize_oee_record_data(merged_data)
    changed = {
        field: normalized_data[field]
        for field in changes
        if normalized_data[field] != existing_data[field]
    }
    return {
        "changes": changed,
        "business_key": list(inspected["business_key"]),
        "calculated": {
            key: (format(value, "f") if isinstance(value, Decimal) else value)
            for key, value in inspected["calculated"].items()
        },
    }
