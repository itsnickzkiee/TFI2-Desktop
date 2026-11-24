"""Source-aligned, read-only contract for the PR Monitoring register."""
from __future__ import annotations

from copy import deepcopy
from typing import Any

SOURCE = {
    "workbook": "Copy of TFI - Production Monitoring Sheet 1",
    "spreadsheet_id": "1rCbQ16wj7MRjQCFF3tA-WEMkudraJK0RkwcqayUlz7k",
    "sheet": "PR MONITORING",
    "sheet_id": 867256143,
    "title": "TOSEN FOODS INC. 2025 -  PR MONITORING",
    "grid_rows": 1000,
    "grid_columns": 27,
    "source_columns": "A:G",
    "summary_row": 2,
    "header_row": 3,
    "first_data_row": 4,
    "frozen_rows": 3,
    "frozen_columns": 0,
    "read_only": True,
}

SNAPSHOT_SUMMARY = {
    "total_tins_to_produce": {
        "value": 16182629,
        "formatted_value": "16,182,629",
        "source_cell": "B2",
        "formula": "=sum(D4:D1002)",
    },
    "total_tins_produced": {
        "value": 15648348,
        "formatted_value": "15,648,348",
        "source_cell": "D2",
        "formula": "=sum(E4:E1002)",
    },
    "completion": {
        "value": 0.9669842891411525,
        "formatted_value": "96.70%",
        "source_cell": "F2",
        "formula": "=D2/B2",
    },
}

ROW_CLASSIFICATION = {
    "populated_source_rows": 78,
    "pr_number_rows": 64,
    "product_total_rows": [6, 11, 15, 19, 25, 34, 41, 45, 57, 65, 71, 77],
    "incomplete_candidate_rows": [79],
    "template_rows": [4],
    "quantity_columns_are_stored_values": True,
}

COLUMNS = [
    {"source_column": "A", "key": "column_a", "label": "", "type": "text", "source_header_blank": True},
    {"source_column": "B", "key": "pr_no", "label": "PR No.", "type": "text", "preserve_leading_zeros": True},
    {"source_column": "C", "key": "date_pr_received", "label": "Date PR Recieved", "type": "date"},
    {"source_column": "D", "key": "pr_required_quantity_tins", "label": "PR Required Quantity (tins)", "type": "number", "stored_value": True},
    {"source_column": "E", "key": "production_produced_tins", "label": "Production Produced (tins)", "type": "number", "stored_value": True},
    {"source_column": "F", "key": "for_production_quantity_tins", "label": "For Production Quantity (tins)", "type": "number", "stored_value": True},
    {"source_column": "G", "key": "status", "label": "Status", "type": "status", "read_only": True},
]

STATUS_VALUES = ("Pending for Production", "Complete", "Over Produce")
STATUS_FORMULA = '=if(D4="","",if(F4>0,"Pending for Production",if(F4=0,"Complete","Over Produce")))'
SORT_KEYS = frozenset(column["key"] for column in COLUMNS)
MAX_PAGE_SIZE = 1000


class PrMonitoringValidationError(ValueError):
    """Raised when a PR Monitoring filter or source row is invalid."""


def get_pr_monitoring_catalog() -> dict[str, Any]:
    """Return the approved source metadata and the explicitly static row-2 snapshot."""
    return {
        "source": deepcopy(SOURCE),
        "snapshot_summary": deepcopy(SNAPSHOT_SUMMARY),
        "row_classification": deepcopy(ROW_CLASSIFICATION),
        "columns": deepcopy(COLUMNS),
        "status_values": list(STATUS_VALUES),
        "status_formula": STATUS_FORMULA,
        "capabilities": {
            "view": True,
            "export": True,
            "create": False,
            "edit": False,
            "submit": False,
            "approve": False,
        },
        "import_policy": {
            "product_total_rows": "exclude_from_operational_register; retain in import review",
            "template_rows": "exclude_from_operational_register",
            "incomplete_candidates": "retain_in_import_inbox; do_not_auto_complete",
            "status": "capture_formula_result_as_read_only_source_value",
            "quantity_columns": "preserve_D_E_F_source_values_without_recalculation",
        },
    }


def classify_pr_monitoring_source_row(
    values: Any, source_row_number: int
) -> dict[str, Any]:
    """Classify A:G without converting summaries/templates/incomplete rows into PRs."""
    if isinstance(source_row_number, bool) or not isinstance(source_row_number, int):
        raise PrMonitoringValidationError("Source row number must be a whole number.")
    if source_row_number < SOURCE["first_data_row"] or source_row_number > SOURCE["grid_rows"]:
        raise PrMonitoringValidationError("Source row number is outside the PR MONITORING data range.")
    if not isinstance(values, (list, tuple)) or len(values) > 7:
        raise PrMonitoringValidationError("PR Monitoring source rows must contain at most seven A:G values.")

    row = list(values) + [None] * (7 - len(values))
    normalized = ["" if value is None else str(value).strip() for value in row]
    if not any(normalized):
        return {"classification": "blank", "source_row_number": source_row_number, "review_reasons": []}

    column_a, pr_no, date_received, required, produced, remaining, status = normalized
    if source_row_number in ROW_CLASSIFICATION["template_rows"] and not pr_no and not date_received:
        return {"classification": "template", "source_row_number": source_row_number, "review_reasons": ["zero_value_template_row"]}
    if column_a.lower().endswith(" total"):
        return {"classification": "summary", "source_row_number": source_row_number, "review_reasons": ["product_group_total"]}
    if not pr_no:
        return {"classification": "incomplete", "source_row_number": source_row_number, "review_reasons": ["missing_pr_no"]}
    if status and status not in STATUS_VALUES:
        return {"classification": "invalid", "source_row_number": source_row_number, "review_reasons": ["unrecognized_source_status"]}
    return {
        "classification": "operational",
        "source_row_number": source_row_number,
        "review_reasons": [],
        "record_data": {
            "column_a": row[0],
            "pr_no": row[1],
            "date_pr_received": row[2],
            "pr_required_quantity_tins": row[3],
            "production_produced_tins": row[4],
            "for_production_quantity_tins": row[5],
            "status": row[6],
        },
    }
