"""Safe, source-traceable XLSX scanning for the TFI2 selective import workflow."""
from __future__ import annotations

import hashlib
import json
import math
from datetime import date, datetime, time
from io import BytesIO
from typing import Iterator

from openpyxl import load_workbook
from openpyxl.utils import get_column_letter
from openpyxl.utils.exceptions import InvalidFileException


MAX_IMPORT_FILE_BYTES = 100 * 1024 * 1024
MAX_IMPORT_ROWS = 100_000


class ImportScanError(ValueError):
    """Raised when an uploaded workbook does not match the approved source map."""


def _json_value(value):
    if value is None or isinstance(value, (str, int, bool)):
        return value
    if isinstance(value, float):
        return value if math.isfinite(value) else None
    if isinstance(value, (datetime, date, time)):
        return value.isoformat()
    if hasattr(value, "isoformat"):
        try:
            return value.isoformat()
        except (TypeError, ValueError):
            pass
    return str(value)


def _column_index(value: str) -> int:
    result = 0
    for char in str(value or "").upper():
        if not ("A" <= char <= "Z"):
            raise ImportScanError("The approved source mapping contains an invalid column reference.")
        result = result * 26 + ord(char) - 64
    return result


def _empty(value) -> bool:
    return value is None or (isinstance(value, str) and not value.strip())


def iter_xlsx_import_rows(
    file_bytes: bytes,
    destination: dict,
    stats: dict,
) -> Iterator[dict]:
    """Yield staged row payloads from exactly one registered worksheet."""
    if not isinstance(file_bytes, bytes) or not file_bytes:
        raise ImportScanError("The selected Excel workbook is empty.")
    if len(file_bytes) > MAX_IMPORT_FILE_BYTES:
        raise ImportScanError("The selected Excel workbook exceeds the 100 MB limit.")
    if not file_bytes.startswith(b"PK"):
        raise ImportScanError("The selected file is not a valid .xlsx workbook.")

    try:
        workbook = load_workbook(
            BytesIO(file_bytes),
            read_only=True,
            data_only=False,
            keep_links=False,
        )
    except (InvalidFileException, OSError, ValueError, KeyError) as exc:
        raise ImportScanError("The selected file could not be opened as an Excel .xlsx workbook.") from exc

    try:
        expected_title = str(destination.get("source_sheet_title") or "").strip()
        if not expected_title:
            raise ImportScanError("The selected destination has no approved source worksheet.")
        actual_title = next(
            (name for name in workbook.sheetnames if name.casefold() == expected_title.casefold()),
            None,
        )
        if actual_title is None:
            raise ImportScanError(
                f"The workbook does not contain the approved worksheet '{expected_title}'."
            )

        worksheet = workbook[actual_title]
        first_data_row = int(destination.get("first_data_row") or 1)
        grid_rows = int(destination.get("grid_rows") or 0)
        grid_columns = int(destination.get("grid_columns") or 0)
        if first_data_row < 1 or grid_rows < first_data_row or not 1 <= grid_columns <= 200:
            raise ImportScanError("The approved worksheet dimensions are invalid.")

        actual_max_row = int(worksheet.max_row or grid_rows)
        actual_max_column = int(worksheet.max_column or grid_columns)
        last_row = min(actual_max_row, grid_rows, first_data_row + MAX_IMPORT_ROWS - 1)
        last_column = min(actual_max_column, grid_columns)
        if last_row < first_data_row:
            stats.update(rows_inspected=0, blank_rows=0, formula_cells=0, derived_rows=0, unmapped_rows=0)
            return

        input_columns = {
            _column_index(column)
            for column in (destination.get("input_columns") or [])
        }
        formula_columns = {
            _column_index(column)
            for column in (destination.get("formula_columns") or [])
        }
        stats.update(
            rows_inspected=0,
            blank_rows=0,
            formula_cells=0,
            derived_rows=0,
            unmapped_rows=0,
            rows_staged=0,
        )

        for row_number, cells in enumerate(
            worksheet.iter_rows(
                min_row=first_data_row,
                max_row=last_row,
                min_col=1,
                max_col=last_column,
            ),
            start=first_data_row,
        ):
            stats["rows_inspected"] += 1
            raw_values = []
            formulas = {}
            populated_columns = set()
            input_populated = False
            formula_populated = False
            has_error = False

            for index, cell in enumerate(cells, start=1):
                value = cell.value
                normalized = _json_value(value)
                raw_values.append(normalized)
                if not _empty(normalized):
                    populated_columns.add(index)
                if cell.data_type == "f" or (
                    isinstance(value, str) and value.startswith("=")
                ):
                    formulas[get_column_letter(index)] = str(value)
                    stats["formula_cells"] += 1
                    formula_populated = True
                if cell.data_type == "e":
                    has_error = True
                if index in input_columns and not _empty(normalized):
                    input_populated = True

            if not populated_columns:
                stats["blank_rows"] += 1
                continue

            if has_error:
                classification = "invalid"
            elif input_columns:
                if input_populated:
                    classification = "operational"
                elif formula_populated:
                    classification = "derived"
                else:
                    classification = "helper"
            elif formula_populated and populated_columns.issubset(
                {_column_index(column) for column in formulas}
            ):
                classification = "derived"
            else:
                # No approved field-level map exists yet. Preserve the source row
                # as raw capture for human review; do not infer business columns.
                classification = "operational"

            if classification == "derived":
                stats["derived_rows"] += 1
            elif classification in ("helper", "unmapped"):
                stats["unmapped_rows"] += 1

            last_populated = max(populated_columns | {
                _column_index(column) for column in formulas
            })
            values = raw_values[:last_populated]
            fingerprint_payload = json.dumps(
                {"values": values, "formulas": formulas},
                ensure_ascii=False,
                sort_keys=True,
                separators=(",", ":"),
            ).encode("utf-8")
            fingerprint = hashlib.sha256(fingerprint_payload).hexdigest()

            completeness_status = "unassessed"
            missing_fields = []
            if destination.get("module_key") in {"hourly_meat", "hourly_coding", "hourly_agri"} and classification == "operational":
                hourly_fields = ("production_date", "hour", "product_code", "target_tins", "actual_tins")
                for index, field in enumerate(hourly_fields):
                    if _empty(values[index] if len(values) > index else None):
                        missing_fields.append(field)
                for column in formulas:
                    column_number = _column_index(column)
                    if 1 <= column_number <= 6:
                        missing_fields.append(f"formula_input_{column}")
                if missing_fields:
                    completeness_status = "incomplete"

            if destination.get("module_key") == "coding_dpr" and classification == "operational":
                # Mirror the Coding DPR manual-entry review contract: a missing
                # line or a partially populated three-cell lot is retained as
                # an incomplete draft, never silently discarded.
                if _empty(values[1] if len(values) > 1 else None):
                    missing_fields.append("line_number")
                lot_columns = (
                    (2, 3, 4), (5, 6, 7), (8, 9, 10), (11, 12, 13),
                    (14, 15, 16), (17, 18, 19), (20, 21, 22),
                )
                for lot_number, indexes in enumerate(lot_columns, start=1):
                    present = [_empty(values[index] if len(values) > index else None) is False for index in indexes]
                    if any(present) and not all(present):
                        labels = ("production_date", "product_code", "quantity")
                        missing_fields.extend(
                            f"lot_{lot_number}.{labels[position]}"
                            for position, is_present in enumerate(present) if not is_present
                        )
                for column in formulas:
                    column_number = _column_index(column)
                    if column_number in input_columns and column_number not in formula_columns:
                        missing_fields.append(f"formula_input_{column}")
                if missing_fields:
                    completeness_status = "incomplete"

            yield {
                "source_row_number": int(row_number),
                "source_locator": f"row:{row_number}",
                "source_values": values,
                "source_formulas": formulas,
                "source_fingerprint": fingerprint,
                "classification": classification,
                "completeness_status": completeness_status,
                "missing_fields": missing_fields,
            }
    finally:
        workbook.close()


def scan_file_sha256(file_bytes: bytes) -> str:
    return hashlib.sha256(file_bytes).hexdigest()
