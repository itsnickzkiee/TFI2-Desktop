"""Previous-period dates and deltas from KPI Calc and Dash Calc."""
from calendar import monthrange
from datetime import date, timedelta
from math import isfinite


METRICS = {
    "total_output_tins": ("productivity", "relative"),
    "output_attainment": ("productivity", "points"),
    "productivity_tins_per_mhr": ("productivity", "relative"),
    "oee": ("oee", "points"),
    "fg_reject_pct": ("productivity", "points"),
    "total_downtime_hours": ("downtime", "relative"),
    "downtime_pct": ("combined", "points"),
    "machine_downtime_hours": ("downtime", "relative"),
    "manpower_downtime_hours": ("downtime", "relative"),
    "mtbf_hours": ("combined", "relative"),
    "total_manpower_hours": ("productivity", "relative"),
}


def previous_period(period: str, start: date, end: date) -> tuple[date, date]:
    if period == "daily" and start == end:
        prior_day = start - timedelta(days=1)
        return prior_day, prior_day
    if period == "weekly" and start.weekday() == 0 and end - start == timedelta(days=6):
        return start - timedelta(days=7), start - timedelta(days=1)
    if period == "monthly" and start.day == 1 and end == start.replace(day=monthrange(start.year, start.month)[1]):
        last_day = start - timedelta(days=1)
        return last_day.replace(day=1), last_day
    raise ValueError("Comparison requires a complete Daily, ISO Weekly, or Monthly period.")


def _available_values(payload: dict) -> dict:
    modules = payload.get("modules") or {}

    def status(module):
        return (modules.get(module) or {}).get("status")

    productivity = status("productivity") == "available"
    downtime = status("dmr_production") == "available" or (
        status("dmr_production") == "empty" and productivity
    )
    return {
        "productivity": productivity,
        "downtime": downtime,
        "combined": productivity and downtime,
        "oee": status("oee") == "available",
    }


def _metric_value(payload: dict, key: str, allowed: bool):
    value = (payload.get("metrics") or {}).get(key)
    if allowed and isinstance(value, (int, float)) and not isinstance(value, bool) and isfinite(value):
        return value
    return None


def compare_metrics(current: dict, previous: dict) -> dict:
    current_available = _available_values(current)
    previous_available = _available_values(previous)
    result = {}
    for key, (source, kind) in METRICS.items():
        value = _metric_value(current, key, current_available[source])
        prior_value = _metric_value(previous, key, previous_available[source])
        change = None
        if value is not None and prior_value is not None:
            if kind == "points":
                change = (value - prior_value) * 100
            elif prior_value > 0:
                change = (value / prior_value - 1) * 100
        result[key] = {"current": value, "previous": prior_value, "change": change, "unit": kind}
    return result
