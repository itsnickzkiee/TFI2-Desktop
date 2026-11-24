"""Verified Master Data source contract for TFI2.

This module describes the nine source-backed categories and their current
field-edit rules. It does not load, fabricate, or persist source records.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any


class MasterDataValidationError(ValueError):
    """Raised when a requested edit violates the verified source contract."""


@dataclass(frozen=True)
class MasterDataCategory:
    key: str
    display_name: str
    sheet_title: str
    sheet_id: int
    source_range: str
    source_row_count: int
    source_record_count: int
    source_column_count: int
    header_rows: tuple[int, ...]
    first_data_row: int
    edit_policy: str
    editable_columns: tuple[str, ...] = ()
    read_only_columns: tuple[str, ...] = ()
    locked_source_rows: tuple[int, ...] = ()
    field_notes: tuple[str, ...] = ()


MASTER_DATA_CATEGORIES: dict[str, MasterDataCategory] = {
    "product_standard": MasterDataCategory(
        key="product_standard",
        display_name="Product Standard and Specificat",
        sheet_title="Product Standard and Specificat",
        sheet_id=2138697021,
        source_range="A1:U110",
        source_row_count=110,
        source_record_count=58,
        source_column_count=21,
        header_rows=(1, 2),
        first_data_row=3,
        edit_policy="controlled_fields",
        editable_columns=("B", "C", "D", "E", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "T", "U"),
        read_only_columns=("A", "F", "G", "S"),
        field_notes=(
            "Column E is identified in the source as edited by Production.",
            "Columns F and G are identified in the source as edited by Plant IE and are formula/read-only in the UI contract.",
            "Columns F, G and S are formula/read-only.",
            "Column A is the source product-code key and is immutable.",
            "Family-header and reserved-slot rows are not editable records.",
        ),
    ),
    "code_map": MasterDataCategory(
        key="code_map",
        display_name="Code Map",
        sheet_title="Code Map",
        sheet_id=2098561343,
        source_range="A1:B72",
        source_row_count=72,
        source_record_count=68,
        source_column_count=2,
        header_rows=(4,),
        first_data_row=5,
        edit_policy="controlled_fields",
        editable_columns=("B",),
        read_only_columns=("A",),
        field_notes=(
            "Column A is the product-code key and is immutable.",
            "Preserve all 68 mappings, including 36 codes without a matching Product Standard variant.",
            "Do not auto-create or delete unmatched mappings.",
        ),
    ),
    "yield_map": MasterDataCategory(
        key="yield_map",
        display_name="Yield Map",
        sheet_title="Yield Map",
        sheet_id=854969610,
        source_range="A1:W43",
        source_row_count=43,
        source_record_count=39,
        source_column_count=23,
        header_rows=(4,),
        first_data_row=5,
        edit_policy="controlled_fields",
        editable_columns=("B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M"),
        read_only_columns=("A", "N", "P", "Q", "R", "S", "T", "U", "V", "W"),
        field_notes=(
            "Columns B:M are source input fields.",
            "Column A and N are reference/information fields.",
            "Columns P:W are formula-generated helper outputs.",
            "95% targets identified as placeholders are not approved business thresholds.",
        ),
    ),
    "entry_map": MasterDataCategory(
        key="entry_map",
        display_name="Entry Map",
        sheet_title="Entry Map",
        sheet_id=1628314566,
        source_range="A1:E43",
        source_row_count=43,
        source_record_count=39,
        source_column_count=5,
        header_rows=(1,),
        first_data_row=2,
        edit_policy="read_only",
        read_only_columns=("A", "B", "C", "D", "E"),
        field_notes=(
            "Read-only Product Entry family/block mapping.",
            "A new family requires a verified BLK_xx named range and complete Product Entry block.",
        ),
    ),
    "kpi_setup": MasterDataCategory(
        key="kpi_setup",
        display_name="KPI Setup",
        sheet_title="KPI Setup",
        sheet_id=1955006742,
        source_range="A1:T129",
        source_row_count=129,
        source_record_count=128,
        source_column_count=20,
        header_rows=(1,),
        first_data_row=2,
        edit_policy="read_only",
        read_only_columns=tuple("ABCDEFGHIJKLMNOPQRST"),
        field_notes=(
            "Preserve grouped and paired source lists; do not flatten unrelated lists into one fictitious table.",
            "View Daily and Product Code All are protected source values.",
            "No delete or clear action is provided by the approved UI specification.",
        ),
    ),
    "dpr_legend": MasterDataCategory(
        key="dpr_legend",
        display_name="DPR LEGEND",
        sheet_title="DPR LEGEND",
        sheet_id=508797580,
        source_range="A1:AN119",
        source_row_count=119,
        source_record_count=116,
        source_column_count=40,
        header_rows=(2,),
        first_data_row=3,
        edit_policy="read_only",
        read_only_columns=(
            "A", "B", "C", "D", "E", "F", "G", "H", "I", "J",
            "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T",
            "U", "V", "W", "X", "Y", "Z", "AA", "AB", "AC", "AD",
            "AE", "AF", "AG", "AH", "AI", "AJ", "AK", "AL", "AM", "AN",
        ),
        field_notes=(
            "B:F are independent reference lists.",
            "G:H are formula/helper outputs and remain read-only.",
            "I:AN contain product-family code lists.",
            "Preserve the documented helper-formula omission of TMRMB-24-380; do not alter the source formula.",
        ),
    ),
    "dmp_legend": MasterDataCategory(
        key="dmp_legend",
        display_name="DMP LEGEND",
        sheet_title="DMP LEGEND",
        sheet_id=1070169465,
        source_range="A1:D70",
        source_row_count=70,
        source_record_count=69,
        source_column_count=4,
        header_rows=(1,),
        first_data_row=2,
        edit_policy="controlled_fields",
        editable_columns=("A", "B", "C", "D"),
        locked_source_rows=(5, 9, 14, 17, 20, 23, 31, 33, 36, 39),
        field_notes=(
            "Ten source cell notes are preserved separately from worker-name values.",
            "Rows with source notes are locked against editing in the approved preview.",
            "RESIGNED/AWOL note labels are source signals only, not verified live HR status.",
            "Blank source worker names remain blank; no person is inferred or substituted.",
        ),
    ),
    "manpower": MasterDataCategory(
        key="manpower",
        display_name="MANPOWER",
        sheet_title="MANPOWER",
        sheet_id=583741906,
        source_range="A1:E448",
        source_row_count=448,
        source_record_count=445,
        source_column_count=5,
        header_rows=(3,),
        first_data_row=4,
        edit_policy="controlled_fields",
        editable_columns=("A", "B", "C", "D", "E"),
        field_notes=(
            "Preserve all 445 source rows in original order.",
            "Preserve 430 distinct employee names and repeated source rows.",
            "No automatic merge, deduplication, or deletion.",
        ),
    ),
    "schedule_lists": MasterDataCategory(
        key="schedule_lists",
        display_name="Schedule Lists",
        sheet_title="Schedule Lists",
        sheet_id=156467196,
        source_range="A1:L101",
        source_row_count=101,
        source_record_count=100,
        source_column_count=12,
        header_rows=(1,),
        first_data_row=2,
        edit_policy="auto_refreshed",
        read_only_columns=tuple("ABCDEFGHIJKL"),
        field_notes=(
            "Columns A:B are refreshed from Product Standard.",
            "Columns K:L are source helper/configuration fields.",
            "The source explicitly says not to edit A, B, K or L.",
            "The approved UI currently exposes Schedule Lists as read-only.",
        ),
    ),
}


def column_to_index(column: str) -> int:
    """Convert an Excel-style column letter to a zero-based index."""
    if not isinstance(column, str) or not column or not column.isalpha() or not column.isascii():
        raise MasterDataValidationError("Use a valid source column letter.")
    value = 0
    for char in column.upper():
        if not ("A" <= char <= "Z"):
            raise MasterDataValidationError("Use a valid source column letter.")
        value = value * 26 + ord(char) - ord("A") + 1
    return value - 1


def validate_master_data_changes(
    category_key: str,
    changes: dict[str, Any],
    *,
    source_row_number: int,
    row_kind: str = "data",
    row_editable: bool = True,
) -> dict[str, str]:
    """Validate a proposed edit against the approved source field contract.

    This is an application guard only. The database RPC must independently
    enforce the same rules using the authenticated user's permission.
    """
    category = MASTER_DATA_CATEGORIES.get(category_key)
    if category is None:
        raise MasterDataValidationError("Unknown Master Data category.")
    if category.edit_policy != "controlled_fields" or not category.editable_columns:
        raise MasterDataValidationError("This Master Data category is read-only.")
    if not row_editable or source_row_number in category.locked_source_rows:
        raise MasterDataValidationError("This source row is protected from editing.")
    if row_kind != "data":
        raise MasterDataValidationError("Only populated data rows can be edited.")
    if not isinstance(changes, dict) or not changes:
        raise MasterDataValidationError("Provide at least one field change.")

    normalized: dict[str, str] = {}
    allowed = set(category.editable_columns)
    for raw_column, value in changes.items():
        if not isinstance(raw_column, str):
            raise MasterDataValidationError("Invalid source column.")
        column = raw_column.upper()
        if column not in allowed:
            raise MasterDataValidationError(
                f"Column {column} is protected or not editable for this category."
            )
        if not isinstance(value, str):
            raise MasterDataValidationError(
                f"Column {column} must be submitted as source text."
            )
        if len(value) > 10000:
            raise MasterDataValidationError(
                f"Column {column} exceeds the supported field length."
            )
        normalized[column] = value

    return normalized
