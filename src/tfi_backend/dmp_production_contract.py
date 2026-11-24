"""Verified DMP Production entry contract for the first Phase 5 module."""
from __future__ import annotations

from datetime import date, time
from decimal import Decimal, InvalidOperation
from typing import Any


class DmpProductionValidationError(ValueError):
    """Raised when a DMP Production request violates the source-backed field contract."""


ALLOWED_DMP_FIELDS = (
    'production_date', 'product_code', 'process', 'worker_name',
    'worker_count', 'start_time', 'end_time', 'total_time_hours',
)
TEXT_LIMITS = {'product_code': 100, 'process': 300, 'worker_name': 200}
NUMERIC_LIMITS = {'worker_count': 3, 'total_time_hours': 4}


def _text(value: Any, field: str) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        raise DmpProductionValidationError(f'{field.replace("_", " ").title()} must be text.')
    normalized = value.strip() or None
    if normalized and len(normalized) > TEXT_LIMITS[field]:
        raise DmpProductionValidationError(f'{field.replace("_", " ").title()} is too long.')
    return normalized


def _date(value: Any) -> str | None:
    if value is None or value == '':
        return None
    if not isinstance(value, str):
        raise DmpProductionValidationError('Production date must use YYYY-MM-DD format.')
    try:
        return date.fromisoformat(value.strip()).isoformat()
    except ValueError as exc:
        raise DmpProductionValidationError('Production date must use YYYY-MM-DD format.') from exc


def _time(value: Any, field: str) -> str | None:
    if value is None or value == '':
        return None
    if not isinstance(value, str):
        raise DmpProductionValidationError(f'{field.replace("_", " ").title()} must use a valid time.')
    try:
        parsed = time.fromisoformat(value.strip())
    except ValueError as exc:
        raise DmpProductionValidationError(f'{field.replace("_", " ").title()} must use a valid time.') from exc
    if parsed.tzinfo is not None:
        raise DmpProductionValidationError(f'{field.replace("_", " ").title()} must not include a timezone.')
    return parsed.isoformat(timespec='seconds' if parsed.second or parsed.microsecond else 'minutes')


def _number(value: Any, field: str) -> str | None:
    if value is None or value == '':
        return None
    if isinstance(value, bool) or isinstance(value, (dict, list)):
        raise DmpProductionValidationError(f'{field.replace("_", " ").title()} must be a nonnegative number.')
    try:
        parsed = Decimal(str(value).strip())
    except (InvalidOperation, ValueError) as exc:
        raise DmpProductionValidationError(f'{field.replace("_", " ").title()} must be a nonnegative number.') from exc
    if not parsed.is_finite() or parsed < 0:
        raise DmpProductionValidationError(f'{field.replace("_", " ").title()} must be a nonnegative number.')
    decimal_places = max(0, -parsed.as_tuple().exponent)
    if decimal_places > NUMERIC_LIMITS[field] or len(parsed.as_tuple().digits) > 14:
        raise DmpProductionValidationError(f'{field.replace("_", " ").title()} has too many decimal places or digits.')
    return format(parsed, 'f')


def normalize_dmp_production_records(records: Any) -> list[dict[str, Any]]:
    if not isinstance(records, list) or not 1 <= len(records) <= 12:
        raise DmpProductionValidationError('Submit between 1 and 12 DMP entry rows.')
    normalized: list[dict[str, Any]] = []
    for index, row in enumerate(records, start=1):
        if not isinstance(row, dict):
            raise DmpProductionValidationError(f'Entry row {index} must be an object.')
        unknown = set(row) - set(ALLOWED_DMP_FIELDS)
        if unknown:
            raise DmpProductionValidationError('Position is calculated from Master Data and cannot be submitted. Remove unsupported fields.')
        normalized.append({
            'production_date': _date(row.get('production_date')),
            'product_code': _text(row.get('product_code'), 'product_code'),
            'process': _text(row.get('process'), 'process'),
            'worker_name': _text(row.get('worker_name'), 'worker_name'),
            'worker_count': _number(row.get('worker_count'), 'worker_count'),
            'start_time': _time(row.get('start_time'), 'start_time'),
            'end_time': _time(row.get('end_time'), 'end_time'),
            'total_time_hours': _number(row.get('total_time_hours'), 'total_time_hours'),
        })
    return normalized


def normalize_dmp_production_changes(changes: Any) -> dict[str, Any]:
    if not isinstance(changes, dict) or not changes:
        raise DmpProductionValidationError('Provide at least one DMP field to update.')
    normalized = normalize_dmp_production_records([changes])[0]
    if set(changes) - set(ALLOWED_DMP_FIELDS):
        raise DmpProductionValidationError('Position is calculated from Master Data and cannot be edited.')
    return {key: normalized[key] for key in changes}