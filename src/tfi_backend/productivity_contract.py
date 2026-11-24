"""Source-backed validation and calculations for Productivity rows."""
from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal, InvalidOperation

INPUT_FIELDS = (
    "production_date", "product_code", "line", "planned_run_hours",
    "actual_output_tins", "dented", "false_seam", "flipper",
    "bulged", "panel", "buckling",
)
REJECT_FIELDS = ("dented", "false_seam", "flipper", "bulged", "panel", "buckling")
SHEETS_EPOCH = date(1899, 12, 30)


class ProductivityValidationError(ValueError):
    """Raised when a Productivity row violates the approved source contract."""


def _number(value, field):
    if isinstance(value, bool) or isinstance(value, (dict, list)):
        raise ProductivityValidationError(f"{field.replace('_', ' ').title()} must be a nonnegative number.")
    try:
        parsed = Decimal(str(value).strip())
    except (InvalidOperation, ValueError, AttributeError):
        raise ProductivityValidationError(f"{field.replace('_', ' ').title()} must be a nonnegative number.")
    if not parsed.is_finite() or parsed < 0 or len(parsed.as_tuple().digits) > 16 or max(0, -parsed.as_tuple().exponent) > 4:
        raise ProductivityValidationError(f"{field.replace('_', ' ').title()} must be a finite, nonnegative number with up to 4 decimal places.")
    return parsed


def _date(value):
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        try:
            return date.fromisoformat(value.strip())
        except ValueError:
            pass
    if isinstance(value, (int, float, Decimal)) and not isinstance(value, bool):
        serial = _number(value, "production_date")
        if serial != serial.to_integral_value() or serial > (date.max - SHEETS_EPOCH).days:
            raise ProductivityValidationError("Production date must be a valid date.")
        return SHEETS_EPOCH + timedelta(days=int(serial))
    raise ProductivityValidationError("Production date must use YYYY-MM-DD format.")


def inspect_productivity_row(data):
    if not isinstance(data, dict):
        raise ProductivityValidationError("Each Productivity row must be an object.")
    unknown = set(data) - set(INPUT_FIELDS)
    if unknown:
        raise ProductivityValidationError("Calculated fields are server-generated and cannot be submitted: " + ", ".join(sorted(unknown)))
    missing = [field for field in ("production_date", "product_code", "line", "planned_run_hours", "actual_output_tins") if data.get(field) is None or (isinstance(data.get(field), str) and not data[field].strip())]
    if missing:
        return {"status": "incomplete", "missing_fields": missing, "errors": {}}
    try:
        day = _date(data["production_date"])
        text = {}
        for field in ("product_code", "line"):
            value = data[field]
            if not isinstance(value, str) or not value.strip():
                raise ProductivityValidationError(f"{field.replace('_', ' ').title()} must be nonblank text.")
            text[field] = value.strip()
        numbers = {field: _number(data.get(field) if data.get(field) not in (None, "") else 0, field) for field in ("planned_run_hours", "actual_output_tins", *REJECT_FIELDS)}
    except ProductivityValidationError as exc:
        return {"status": "invalid", "missing_fields": [], "errors": {"row": str(exc)}}
    rejects = sum((numbers[field] for field in REJECT_FIELDS), Decimal(0))
    return {
        "status": "valid", "missing_fields": [], "errors": {},
        "business_key": (day.isoformat(), text["product_code"].casefold()),
        "inputs": {
            "production_date": day.isoformat(), **text,
            **{field: format(value, "f") for field, value in numbers.items()},
        },
        "calculated": {
            "total_fg_rejects": rejects,
            "week": day.isocalendar().week,
            "month": day.month,
        },
    }


def normalize_productivity_records(records):
    if not isinstance(records, list) or not 1 <= len(records) <= 100:
        raise ProductivityValidationError("Submit between 1 and 100 Productivity rows.")
    normalized, seen = [], set()
    for index, item in enumerate(records, start=1):
        if not isinstance(item, dict) or set(item) - {"row_index", "record_data"}:
            raise ProductivityValidationError(f"Productivity row {index} has an invalid structure.")
        row_index = item.get("row_index", index)
        if isinstance(row_index, bool) or not isinstance(row_index, int) or not 1 <= row_index <= 1000:
            raise ProductivityValidationError(f"Productivity row {index} has an invalid row number.")
        data = item.get("record_data", {})
        if not isinstance(data, dict):
            raise ProductivityValidationError(f"Productivity row {row_index} must contain record_data.")
        if not any(value is not None and (not isinstance(value, str) or value.strip()) for value in data.values()):
            continue
        result = inspect_productivity_row(data)
        if result["status"] == "incomplete":
            raise ProductivityValidationError(f"Complete the required Productivity fields in row {row_index}: {', '.join(result['missing_fields'])}.")
        if result["status"] != "valid":
            raise ProductivityValidationError(f"Check Productivity row {row_index}: " + "; ".join(result["errors"].values()))
        key = result["business_key"]
        if key in seen:
            raise ProductivityValidationError(f"Rows contain a duplicate Production Date and Product Code in row {row_index}.")
        seen.add(key)
        normalized.append({"row_index": row_index, "record_data": result["inputs"]})
    if not normalized:
        raise ProductivityValidationError("Enter at least one Productivity row before saving.")
    return normalized


def normalize_productivity_changes(current, changes):
    if not isinstance(changes, dict) or not changes:
        raise ProductivityValidationError("Provide at least one Productivity field to update.")
    unknown = set(changes) - set(INPUT_FIELDS)
    if unknown:
        raise ProductivityValidationError(
            "Calculated fields are read-only: " + ", ".join(sorted(unknown))
        )
    merged = {field: current.get(field) for field in INPUT_FIELDS}
    merged.update(changes)
    inspected = inspect_productivity_row(merged)
    if inspected["status"] != "valid":
        if inspected["status"] == "incomplete":
            raise ProductivityValidationError(
                "Required fields are missing: " + ", ".join(inspected["missing_fields"])
            )
        raise ProductivityValidationError("; ".join(inspected["errors"].values()))
    normalized = inspected["inputs"]
    changed = {}
    for field in changes:
        old = current.get(field)
        new = normalized.get(field)
        if field == "production_date":
            old = str(old)[:10] if old is not None else None
        elif field in ("planned_run_hours", "actual_output_tins", *REJECT_FIELDS):
            try:
                old = format(_number(old, field), "f")
            except ProductivityValidationError:
                old = str(old) if old is not None else None
        elif isinstance(old, str):
            old = old.strip()
        if old != new:
            changed[field] = new
    return {"changes": changed, "record_data": normalized}


def normalize_productivity_preview(data):
    if not isinstance(data, dict):
        raise ProductivityValidationError("A Productivity preview row is required.")
    unknown = set(data) - set(INPUT_FIELDS)
    if unknown:
        raise ProductivityValidationError(
            "Calculated fields are server-generated: " + ", ".join(sorted(unknown))
        )
    if not data.get("production_date") or not data.get("product_code"):
        raise ProductivityValidationError("Enter a production date and product code to calculate source-linked values.")
    preview = {
        "production_date": data.get("production_date"),
        "product_code": data.get("product_code"),
        "line": data.get("line") or "AGRILINE",
        "planned_run_hours": data.get("planned_run_hours") or 0,
        "actual_output_tins": data.get("actual_output_tins") or 0,
        **{field: data.get(field) or 0 for field in REJECT_FIELDS},
    }
    inspected = inspect_productivity_row(preview)
    if inspected["status"] != "valid":
        raise ProductivityValidationError("; ".join(inspected.get("errors", {}).values()) or "Invalid Productivity preview values.")
    return inspected["inputs"]
