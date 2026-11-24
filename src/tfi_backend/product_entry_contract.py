"""Source-aligned Product Entry contract for all 39 Entry Map blocks."""
from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any


class ProductEntryValidationError(ValueError):
    """Raised when a Product Entry request violates the source-backed block contract."""


MANIFEST_PATH = Path(__file__).with_name("product_entry_manifest.json")
with MANIFEST_PATH.open("r", encoding="utf-8") as _manifest_file:
    PRODUCT_ENTRY_MANIFEST = json.load(_manifest_file)

PRODUCT_ENTRY_BLOCKS = {
    block["block_key"]: block for block in PRODUCT_ENTRY_MANIFEST["blocks"]
}
MAX_PRODUCT_ENTRY_BATCH_ROWS = 40
MAX_PRODUCT_ENTRY_CELL_LENGTH = 1000


def get_product_entry_block(block_key: Any) -> dict:
    if not isinstance(block_key, str):
        raise ProductEntryValidationError("Select a valid Product Entry product block.")
    block = PRODUCT_ENTRY_BLOCKS.get(block_key.strip())
    if not block:
        raise ProductEntryValidationError("The selected Product Entry product block is not recognized.")
    return block


def get_product_entry_catalog() -> dict:
    """Return the source manifest with block-specific options and column contracts."""
    return {
        "manifest_version": PRODUCT_ENTRY_MANIFEST["manifest_version"],
        "source": PRODUCT_ENTRY_MANIFEST["source"],
        "review_options": PRODUCT_ENTRY_MANIFEST["review_options"],
        "blocks": PRODUCT_ENTRY_MANIFEST["blocks"],
    }


def _cell_text(value: Any, column: str, row_number: int) -> str | None:
    if value is None:
        return None
    if isinstance(value, bool) or isinstance(value, (dict, list)):
        raise ProductEntryValidationError(
            f"Row {row_number}, column {column}: enter a text or numeric cell value."
        )
    if isinstance(value, float) and not math.isfinite(value):
        raise ProductEntryValidationError(
            f"Row {row_number}, column {column}: enter a finite value."
        )
    if not isinstance(value, (str, int, float)):
        raise ProductEntryValidationError(
            f"Row {row_number}, column {column}: enter a text or numeric cell value."
        )
    normalized = str(value).strip()
    if not normalized:
        return None
    if len(normalized) > MAX_PRODUCT_ENTRY_CELL_LENGTH:
        raise ProductEntryValidationError(
            f"Row {row_number}, column {column}: values must be 1,000 characters or fewer."
        )
    return normalized


def normalize_product_entry_row(block: dict, row: Any, row_number: int) -> dict:
    if not isinstance(row, dict):
        raise ProductEntryValidationError(f"Product Entry row {row_number} must be an object.")

    editable_columns = set(block["editable_columns"])
    unknown = set(row) - editable_columns
    if unknown:
        bad = ", ".join(sorted(str(column) for column in unknown))
        raise ProductEntryValidationError(
            f"Row {row_number} contains hidden, calculated, or unsupported columns: {bad}."
        )

    data: dict[str, str] = {}
    for column, value in row.items():
        normalized = _cell_text(value, column, row_number)
        if normalized is not None:
            data[column] = normalized

    product_code = data.get("B")
    if product_code and product_code not in block["product_codes"]:
        raise ProductEntryValidationError(
            f"Row {row_number}: Product Code is not valid for {block['product_key']} ({block['block_key']})."
        )

    review_status = data.get(block["review_column"])
    if review_status and review_status not in block["review_options"]:
        raise ProductEntryValidationError(
            f"Row {row_number}: choose a valid Production Supervisor review status."
        )

    blank_fields = [
        column for column in block["editable_columns"] if column not in data
    ]

    return {
        "block_key": block["block_key"],
        "product_key": block["product_key"],
        "production_date_text": data.get("A"),
        "product_code": product_code,
        "pr_number": data.get("D"),
        "review_status": review_status,
        "record_data": data,
        "blank_fields": blank_fields,
        "completeness_status": "unassessed",
    }


def normalize_product_entry_records(block_key: Any, records: Any) -> list[dict]:
    block = get_product_entry_block(block_key)
    if (
        not isinstance(records, list)
        or not 1 <= len(records) <= MAX_PRODUCT_ENTRY_BATCH_ROWS
    ):
        raise ProductEntryValidationError(
            f"Submit between 1 and {MAX_PRODUCT_ENTRY_BATCH_ROWS} Product Entry rows per batch."
        )
    return [
        normalize_product_entry_row(block, row, index)
        for index, row in enumerate(records, start=1)
    ]


def normalize_product_entry_changes(block_key: Any, changes: Any) -> dict:
    block = get_product_entry_block(block_key)
    if not isinstance(changes, dict) or not changes:
        raise ProductEntryValidationError("Provide at least one Product Entry field to update.")

    unknown = set(changes) - set(block["editable_columns"])
    if unknown:
        bad = ", ".join(sorted(str(column) for column in unknown))
        raise ProductEntryValidationError(
            f"Product Entry update contains hidden, calculated, or unsupported columns: {bad}."
        )

    normalized_changes: dict[str, str | None] = {}
    for column, value in changes.items():
        if value is None:
            normalized_changes[column] = None
            continue
        normalized = _cell_text(value, column, 1)
        normalized_changes[column] = normalized

    product_code = normalized_changes.get("B")
    if product_code and product_code not in block["product_codes"]:
        raise ProductEntryValidationError(
            f"Product Code is not valid for {block['product_key']} ({block['block_key']})."
        )

    review_status = normalized_changes.get(block["review_column"])
    if review_status and review_status not in block["review_options"]:
        raise ProductEntryValidationError(
            "Choose a valid Production Supervisor review status."
        )

    return {
        "changes": normalized_changes,
        "product_code": product_code,
        "production_date_text": normalized_changes.get("A"),
        "pr_number": normalized_changes.get("D"),
        "review_status": review_status,
    }
