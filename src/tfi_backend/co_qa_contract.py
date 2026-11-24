"""Source projection and Product Entry-linked cost contract for CO QA.

Historical worksheet rows remain on business-rule hold because the array
formula does not preserve their source-row identity. New cost inputs are
versioned child records linked to stable Product Entry UUIDs.
"""
from __future__ import annotations

from copy import deepcopy
from typing import Any

SOURCE = {
    "workbook": "Copy of TFI - Production Monitoring Sheet 1",
    "spreadsheet_id": "1rCbQ16wj7MRjQCFF3tA-WEMkudraJK0RkwcqayUlz7k",
    "sheet": "co QA",
    "sheet_id": 1359678099,
    "grid_rows": 2745,
    "grid_columns": 40,
    "group_heading_row": 1,
    "header_row": 2,
    "first_data_row": 3,
    "array_formula_cell": "A3",
    "read_only_audit": True,
}

SOURCE_COLUMNS = [
    {"column": "A", "key": "production_date_text", "label": "Date produce", "origin": "Product Entry"},
    {"column": "B", "key": "product_code", "label": "Product code", "origin": "Product Entry"},
    {"column": "C", "key": "can_size", "label": "Can Size", "origin": "Product Entry"},
    {"column": "D", "key": "pr_number", "label": "PR No", "origin": "Product Entry"},
    {"column": "E", "key": "batch_count", "label": "No. of Batches", "origin": "Product Entry"},
    {"column": "F", "key": "total_finished_goods", "label": "Total FG", "origin": "Product Entry"},
    {"column": "G", "key": "dented", "label": "Dented", "origin": "Product Entry"},
    {"column": "H", "key": "false_seam", "label": "False seam", "origin": "Product Entry"},
    {"column": "I", "key": "flipper", "label": "Flipper", "origin": "Product Entry"},
    {"column": "J", "key": "bulged", "label": "Bulged", "origin": "Product Entry"},
    {"column": "K", "key": "panel", "label": "Panel", "origin": "Product Entry"},
    {"column": "L", "key": "buckling", "label": "Buckling", "origin": "Product Entry"},
    {"column": "M", "key": "retention", "label": "Retention", "origin": "Product Entry"},
    {"column": "N", "key": "qa_samples", "label": "Q.A Samples", "origin": "Product Entry"},
    {"column": "O", "key": "dented_curl", "label": "Dented / Curl", "origin": "Product Entry"},
    {"column": "P", "key": "lid_teardown", "label": "Teardown", "origin": "Product Entry"},
    {"column": "Q", "key": "from_underweight", "label": "From Underweight", "origin": "Product Entry"},
    {"column": "R", "key": "rusty_lids", "label": "Rusty", "origin": "Product Entry"},
    {"column": "S", "key": "can_lid_teardown", "label": "Teardown", "origin": "Product Entry"},
    {"column": "T", "key": "dented_from_seamer", "label": "Dented from seamer", "origin": "Product Entry"},
    {"column": "U", "key": "dented_from_filler", "label": "Dented from filler", "origin": "Product Entry"},
    {"column": "V", "key": "underweight", "label": "Underweight", "origin": "Product Entry"},
    {"column": "W", "key": "dented_flange_sd", "label": "Dented flange (SD)", "origin": "Product Entry"},
    {"column": "X", "key": "can_washer_palletizer_defects", "label": "Can wshr/ Palletizer (SD)/ Dented Body/Rusty", "origin": "Product Entry"},
]

MANUAL_COST_INPUTS = [
    {"column": "Y", "key": "labels_cost_per_piece", "label": "Labels (cost pr piece)"},
    {"column": "Z", "key": "box_cost_per_piece_legacy", "label": "Box (Cost per piece)"},
    {"column": "AA", "key": "can_cost_per_piece", "label": "CAN (Cost per piece)"},
    {"column": "AB", "key": "lid_cover_cost_per_piece", "label": "LIDS/COVER (Cost per piece"},
    {"column": "AC", "key": "labels_cost_per_piece_legacy", "label": "LABELS (Cost per piece)"},
    {"column": "AD", "key": "box_cost_per_piece", "label": "BOX (Cost per piece)"},
]

FORMULA_OUTPUTS = [
    {"column": "AE", "key": "total_cans", "label": "total cans", "formula": "=SUM(G3:X3)-SUM(N3:Q3)"},
    {"column": "AF", "key": "cost_of_cans", "label": "Cost of cans", "formula": "=AE3*AA3"},
    {"column": "AG", "key": "total_lids", "label": "total lids", "formula": "=AE3-SUM(O3:S3)"},
    {"column": "AH", "key": "cost_of_lids", "label": "Cost of lids", "formula": "=AG3*AB3"},
]

UNRESOLVED_OUTPUTS = [
    {"column": "AI", "label": "total Labels", "issue": "Header exists; formula not present in inspected source rows."},
    {"column": "AJ", "label": "Cost of Labels", "issue": "Header exists; formula not present in inspected source rows."},
    {"column": "AK", "label": "total Box", "issue": "Header exists; formula not present in inspected source rows."},
    {"column": "AL", "label": "Cost of box", "issue": "Header exists; formula not present in inspected source rows."},
]

SOURCE_DEPENDENCIES = {
    "A3": "One ARRAY_CONSTRAIN(ARRAYFORMULA(SORT(...))) spills 24 columns from many non-contiguous Product Entry blocks.",
    "product_entry_blocks": 39,
    "co_qa_projection_blocks": 31,
    "co_qa_spill_columns": "A:X",
    "sort": "First spill column, descending",
    "identity_preserved_in_spill": False,
    "manual_cost_columns": "Y:AD",
    "formula_columns": "AE:AH",
    "unresolved_columns": "AI:AL",
    "blank_columns_after_outputs": "AM:AN",
}

BUSINESS_RULE_HOLD = {
    "status": "hold_pending_business_rule",
    "reasons": [
        "A:X are a sorted formula spill from Product Entry; the spill does not carry Product Entry record UUID or block_key.",
        "The A3 source formula projects 31 of the 39 Product Entry blocks. Product-specific QA source columns are now mapped, but formula-derived fields still need their original calculations reproduced and verified.",
        "AE:AH calculations now mirror the exact source formulas and are read-only; any formula-derived Product Entry source fields remain pending until their source calculations are implemented and live-verified.",
        "AI:AL have output headers but no formulas in the inspected rows; their calculation rules are unresolved.",
        "Historical CO QA spill rows do not contain stable source-row provenance, so they must not be promoted as standalone operational QA transactions.",
    ],
    "safe_next_design": [
        "Keep Y:AD in a separate versioned child record keyed to Product Entry record UUID; this cost-storage foundation is implemented.",
        "Validate the 31-block A:X projection against live Product Entry records, keeping formula-derived source fields explicitly pending.",
        "Verify the guarded read-only AE:AH calculations against live Product Entry records; formula-derived source fields must remain pending until their source formulas are reproduced and tested.",
        "Obtain approved formulas or an explicit decision to leave AI:AL unavailable.",
        "Keep historical import promotion disabled until source provenance, incomplete-row handling, and duplicate/replay rules are tested.",
    ],
}

def get_co_qa_source_contract() -> dict[str, Any]:
    """Return the audited CO QA mapping and stable Product Entry-linked cost capability."""
    return {
        "source": deepcopy(SOURCE),
        "source_columns": deepcopy(SOURCE_COLUMNS),
        "manual_cost_inputs": deepcopy(MANUAL_COST_INPUTS),
        "formula_outputs": deepcopy(FORMULA_OUTPUTS),
        "unresolved_outputs": deepcopy(UNRESOLVED_OUTPUTS),
        "dependencies": deepcopy(SOURCE_DEPENDENCIES),
        "business_rule_hold": deepcopy(BUSINESS_RULE_HOLD),
        "cost_fields": deepcopy(CO_QA_COST_FIELDS),
        "projection_blocks": deepcopy(CO_QA_PROJECTION_BLOCKS),
        "projection_block_keys": [item["block_key"] for item in CO_QA_PROJECTION_BLOCKS],
        "cost_storage": {
            "table": "tfi_co_qa_cost_records",
            "key": "product_entry_record_id",
            "linkage": "Product Entry record UUID",
            "revision_table": "tfi_co_qa_cost_revisions",
            "versioned": True,
            "source_columns": "Y:AD",
        },
        "capabilities": {
            "source_profile": True,
            "read_only_preview": True,
            "qa_projection_preview": True,
            "create": False,
            "edit": False,
            "save_cost_inputs": True,
            "cost_history": True,
            "calculate": True,
            "import_promote": False,
            "export_operational_records": False,
        },
    }


def classify_co_qa_row(values: Any, *, has_product_entry_record_id: bool = False) -> dict[str, Any]:
    """Classify a source row for audit; never promote it as a CO QA transaction."""
    if not isinstance(values, (list, tuple)) or len(values) > 40:
        raise ValueError("CO QA source rows must contain at most 40 A:AN values.")
    row = list(values) + [None] * (40 - len(values))
    populated = [index for index, value in enumerate(row) if value not in (None, "")]
    if not populated:
        return {"classification": "blank", "review_reasons": []}

    manual_cost_present = any(row[index] not in (None, "") for index in range(24, 30))
    formula_output_present = any(row[index] not in (None, "") for index in range(30, 34))
    unresolved_output_present = any(row[index] not in (None, "") for index in range(34, 38))
    if not has_product_entry_record_id:
        return {
            "classification": "review_required",
            "review_reasons": ["missing_product_entry_record_identity"],
            "manual_cost_present": manual_cost_present,
            "formula_output_present": formula_output_present,
            "unresolved_output_present": unresolved_output_present,
            "promotable": False,
        }
    return {
        "classification": "blocked_pending_business_rules",
        "review_reasons": ["co_qa_business_rule_hold"],
        "manual_cost_present": manual_cost_present,
        "formula_output_present": formula_output_present,
        "unresolved_output_present": unresolved_output_present,
        "promotable": False,
    }


CO_QA_COST_FIELDS = [
    {"column": "Y", "key": "labels_cost_per_piece_y", "label": "Labels (cost pr piece)"},
    {"column": "Z", "key": "box_cost_per_piece_z", "label": "Box (Cost per piece)"},
    {"column": "AA", "key": "can_cost_per_piece_aa", "label": "CAN (Cost per piece)"},
    {"column": "AB", "key": "lid_cover_cost_per_piece_ab", "label": "LIDS/COVER (Cost per piece)"},
    {"column": "AC", "key": "labels_cost_per_piece_ac", "label": "LABELS (Cost per piece)"},
    {"column": "AD", "key": "box_cost_per_piece_ad", "label": "BOX (Cost per piece)"},
]


def normalize_co_qa_cost_changes(changes: Any) -> dict[str, str | None]:
    """Validate partial Y:AD unit-cost edits without merging similar source columns."""
    from decimal import Decimal, InvalidOperation

    if not isinstance(changes, dict) or not changes:
        raise ValueError("Provide at least one CO QA unit-cost field.")

    allowed = {field["column"] for field in CO_QA_COST_FIELDS}
    unknown = set(changes) - allowed
    if unknown:
        raise ValueError(
            "Unsupported CO QA cost fields: " + ", ".join(sorted(str(key) for key in unknown))
        )

    maximum = Decimal("99999999.999999")
    result: dict[str, str | None] = {}
    for column, raw_value in changes.items():
        if raw_value is None or (isinstance(raw_value, str) and not raw_value.strip()):
            result[column] = None
            continue
        if isinstance(raw_value, bool) or isinstance(raw_value, (dict, list)):
            raise ValueError(f"CO QA column {column}: enter a non-negative numeric unit cost.")
        try:
            value = Decimal(str(raw_value).strip())
        except (InvalidOperation, ValueError):
            raise ValueError(f"CO QA column {column}: enter a valid numeric unit cost.") from None
        if not value.is_finite() or value < 0:
            raise ValueError(f"CO QA column {column}: unit costs must be finite and non-negative.")
        try:
            quantized = value.quantize(Decimal("0.000001"))
        except InvalidOperation:
            raise ValueError(f"CO QA column {column}: unit cost exceeds the supported precision.") from None
        if value != quantized or quantized > maximum:
            raise ValueError(
                f"CO QA column {column}: use up to 8 whole digits and 6 decimal places."
            )
        result[column] = format(quantized, "f")
    return result

CO_QA_PROJECTION_BLOCKS = [
    {"block_key":"BLK_01","source_range":"CA:CR","formula_only_columns":["CG"],"manual_input_columns":["CR"],"formula_rules":{"CG":{"source":"CH","operation":"multiply","factor":"2","blank_guard":"A"}}},
    {"block_key":"BLK_02","source_range":"CM:DD","formula_only_columns":["CS"],"manual_input_columns":["CZ"],"formula_rules":{"CS":{"source":"CT","operation":"multiply","factor":"2","blank_guard":"A"}}},
    {"block_key":"BLK_03","source_range":"CT:DK","formula_only_columns":["CZ"],"manual_input_columns":["DK"],"formula_rules":{"CZ":{"source":"DA","operation":"multiply","factor":"2","blank_guard":"A"}}},
    {"block_key":"BLK_07","source_range":"CR:DI","formula_only_columns":["CX"],"formula_rules":{"CX":{"source":"CY","operation":"multiply","factor":"2","blank_guard":"A"}}},
    {"block_key":"BLK_13","source_range":"CN:DE","formula_only_columns":["CT"],"manual_input_columns":["DE"],"formula_rules":{"CT":{"source":"CU","operation":"multiply","factor":"2","blank_guard":"A"}}},
    {"block_key":"BLK_09","source_range":"CZ:DQ","formula_only_columns":["DF"],"manual_input_columns":["DQ"],"formula_rules":{"DF":{"source":"DG","operation":"multiply","factor":"2","blank_guard":"A"}}},
    {"block_key":"BLK_11","source_range":"CM:DD","formula_only_columns":["CS"],"formula_rules":{"CS":{"source":"CT","operation":"multiply","factor":"2","blank_guard":"A"}}},
    {"block_key":"BLK_10","source_range":"CN:DE","formula_only_columns":["CT"],"manual_input_columns":["DE"],"formula_rules":{"CT":{"source":"CU","operation":"multiply","factor":"2","blank_guard":"A"}}},
    {"block_key":"BLK_18","source_range":"CM:DD","formula_only_columns":["CS"],"formula_rules":{"CS":{"source":"CT","operation":"multiply","factor":"2","blank_guard":"A"}}},
    {"block_key":"BLK_15","source_range":"CN:DE","formula_only_columns":["CT"],"formula_rules":{"CT":{"source":"CU","operation":"multiply","factor":"2","blank_guard":"A"}}},
    {"block_key":"BLK_17","source_range":"CO:DF","formula_only_columns":["CU"],"formula_rules":{"CU":{"source":"CV","operation":"multiply","factor":"2","blank_guard":"A"}}},
    {"block_key":"BLK_20","source_range":"CM:DD","formula_only_columns":["CS"],"formula_rules":{"CS":{"source":"CT","operation":"multiply","factor":"2","blank_guard":"A"}}},
    {"block_key":"BLK_23","source_range":"CM:DD","formula_only_columns":["CS"],"formula_rules":{"CS":{"source":"CT","operation":"multiply","factor":"2","blank_guard":"A"}}},
    {"block_key":"BLK_16","source_range":"CS:DJ","formula_only_columns":["CY"],"formula_rules":{"CY":{"source":"CZ","operation":"multiply","factor":"2","blank_guard":"A"}}},
    {"block_key":"BLK_25","source_range":"CQ:DH","formula_only_columns":["CW"],"formula_rules":{"CW":{"source":"CX","operation":"multiply","factor":"2","blank_guard":"A"}}},
    {"block_key":"BLK_28","source_range":"CQ:DH","formula_only_columns":["CW"],"formula_rules":{"CW":{"source":"CX","operation":"multiply","factor":"2","blank_guard":"A"}}},
    {"block_key":"BLK_22","source_range":"CM:DD","formula_only_columns":["CS"],"formula_rules":{"CS":{"source":"CT","operation":"multiply","factor":"2","blank_guard":"A"}}},
    {"block_key":"BLK_38","source_range":"DF:DW","formula_only_columns":["DL"],"formula_rules":{"DL":{"source":"DM","operation":"multiply","factor":"2","blank_guard":"A"}}},
    {"block_key":"BLK_27","source_range":"CQ:DH","formula_only_columns":["CW"],"manual_input_columns":["DH"],"formula_rules":{"CW":{"source":"CX","operation":"multiply","factor":"2","blank_guard":"A"}}},
    {"block_key":"BLK_26","source_range":"CO:DF","formula_only_columns":["CU"],"manual_input_columns":["DF"],"formula_rules":{"CU":{"source":"CV","operation":"multiply","factor":"2","blank_guard":"A"}}},
    {"block_key":"BLK_08","source_range":"CM:DD","formula_only_columns":["CS"],"formula_rules":{"CS":{"source":"CT","operation":"multiply","factor":"2","blank_guard":"A"}}},
    {"block_key":"BLK_29","source_range":"CO:DF","formula_only_columns":["CU"],"manual_input_columns":["DF"],"formula_rules":{"CU":{"source":"CV","operation":"multiply","factor":"2","blank_guard":"A"}}},
    {"block_key":"BLK_32","source_range":"CR:DI","formula_only_columns":["CX"],"formula_rules":{"CX":{"source":"CY","operation":"multiply","factor":"2","blank_guard":"A"}}},
    {"block_key":"BLK_33","source_range":"CR:DI","formula_only_columns":["CX"],"formula_rules":{"CX":{"source":"CY","operation":"multiply","factor":"2","blank_guard":"A"}}},
    {"block_key":"BLK_30","source_range":"CM:DD","formula_only_columns":["CS"],"formula_rules":{"CS":{"source":"CT","operation":"multiply","factor":"2","blank_guard":"A"}}},
    {"block_key":"BLK_37","source_range":"CN:DE","formula_only_columns":["CT"],"formula_rules":{"CT":{"source":"CU","operation":"multiply","factor":"2","blank_guard":"A"}}},
    {"block_key":"BLK_12","source_range":"CN:DE","formula_only_columns":["CT"],"formula_rules":{"CT":{"source":"CU","operation":"multiply","factor":"2","blank_guard":"A"}}},
    {"block_key":"BLK_34","source_range":"BV:CM","formula_only_columns":["CB"],"formula_rules":{"CB":{"source":"CC","operation":"multiply","factor":"2","blank_guard":"A"}}},
    {"block_key":"BLK_24","source_range":"CJ:DA","formula_only_columns":["CP"],"formula_rules":{"CP":{"source":"CQ","operation":"multiply","factor":"2","blank_guard":"A"}}},
    {"block_key":"BLK_19","source_range":"CP:DG","formula_only_columns":["CV"],"formula_rules":{"CV":{"source":"CW","operation":"multiply","factor":"2","blank_guard":"A"}}},
    {"block_key":"BLK_35","source_range":"DA:DR","formula_only_columns":["DG"],"formula_rules":{"DG":{"source":"DH","operation":"multiply","factor":"2","blank_guard":"A"}}},
]


def _column_number(column: str) -> int:
    number = 0
    for char in column.upper():
        if not "A" <= char <= "Z":
            raise ValueError(f"Invalid spreadsheet column: {column}")
        number = number * 26 + ord(char) - 64
    return number


def _column_letters(number: int) -> str:
    if number < 1:
        raise ValueError("Spreadsheet column numbers start at one.")
    letters = ""
    while number:
        number, remainder = divmod(number - 1, 26)
        letters = chr(65 + remainder) + letters
    return letters


def _expand_column_range(source_range: str) -> list[str]:
    first, last = source_range.split(":", 1)
    return [_column_letters(number) for number in range(_column_number(first), _column_number(last) + 1)]


def project_co_qa_product_entry_record(record: dict[str, Any]) -> dict[str, Any]:
    """Project the source QA fields without inventing formula-derived values."""
    block_key = str(record.get("block_key") or "")
    projection = next((item for item in CO_QA_PROJECTION_BLOCKS if item["block_key"] == block_key), None)
    if projection is None:
        return {
            "status": "not_in_co_qa_projection",
            "source_range": None,
            "available_count": 0,
            "formula_pending_count": 0,
            "missing_count": 0,
            "fields": [],
        }

    record_data = record.get("record_data") if isinstance(record.get("record_data"), dict) else {}
    source_columns = _expand_column_range(projection["source_range"])
    formula_columns = set(projection["formula_only_columns"])
    formula_rules = projection.get("formula_rules") or {}
    output_fields = SOURCE_COLUMNS[6:24]
    fields: list[dict[str, Any]] = []
    formula_pending: list[str] = []
    missing: list[str] = []
    available = 0

    def numeric_source(value: Any) -> Any:
        from decimal import Decimal, InvalidOperation
        if value in (None, ""):
            return Decimal(0)
        try:
            number = Decimal(str(value).strip())
        except (InvalidOperation, ValueError):
            return Decimal(0)
        return number if number.is_finite() else Decimal(0)

    for output, source_column in zip(output_fields, source_columns, strict=True):
        is_formula = source_column in formula_columns
        value = record_data.get(source_column)
        pending = False
        if is_formula:
            rule = formula_rules.get(source_column) or {}
            guard_column = rule.get("blank_guard")
            if guard_column and record_data.get(guard_column) in (None, ""):
                value = None
                pending = True
            elif rule.get("operation") == "multiply":
                calculated = numeric_source(record_data.get(rule.get("source"))) * numeric_source(rule.get("factor"))
                value = format(calculated, "f")
            else:
                value = None
                pending = True
        has_value = value not in (None, "")
        if pending:
            formula_pending.append(source_column)
        elif not has_value:
            missing.append(source_column)
        else:
            available += 1
        fields.append({
            "column": output["column"],
            "key": output["key"],
            "label": output["label"],
            "source_column": source_column,
            "value": value,
            "formula_pending": pending,
            "missing": not pending and not has_value,
        })

    return {
        "status": "formula_pending" if formula_pending else ("complete" if not missing else "incomplete"),
        "source_range": projection["source_range"],
        "available_count": available,
        "formula_pending_count": len(formula_pending),
        "missing_count": len(missing),
        "formula_pending_columns": formula_pending,
        "missing_columns": missing,
        "fields": fields,
    }


def calculate_co_qa_formula_outputs(
    projection: dict[str, Any],
    costs: dict[str, Any] | None = None,
) -> dict[str, dict[str, Any]]:
    """Apply the exact AE:AH worksheet formulas to mapped QA values and Y:AD costs."""
    from decimal import Decimal, InvalidOperation

    costs = costs if isinstance(costs, dict) else {}
    fields = {
        item["column"]: item
        for item in (projection.get("fields") or [])
        if isinstance(item, dict) and item.get("column")
    }
    formula_pending = {
        item.get("column")
        for item in fields.values()
        if item.get("formula_pending")
    }

    def number(value: Any) -> Decimal:
        if value in (None, "") or isinstance(value, bool):
            return Decimal(0)
        try:
            parsed = Decimal(str(value).strip())
        except (InvalidOperation, ValueError):
            return Decimal(0)
        return parsed if parsed.is_finite() else Decimal(0)

    def result(column: str, label: str, value: Decimal | None, reason: str | None = None):
        return {
            "column": column,
            "label": label,
            "value": format(value, "f") if value is not None else None,
            "status": "calculated" if value is not None else "pending",
            "reason": reason,
        }

    all_qa_columns = list("GHIJKLM") + list("NOPQRSTUVWX")
    ae_dependencies = set(all_qa_columns)
    ae_blockers = sorted(ae_dependencies & formula_pending)
    if ae_blockers:
        ae = result("AE", "Total cans", None, "Formula-derived Product Entry inputs pending: " + ", ".join(ae_blockers))
    else:
        total_cans = sum((number(fields.get(column, {}).get("value")) for column in all_qa_columns), Decimal(0))
        excluded_samples = sum((number(fields.get(column, {}).get("value")) for column in "NOPQ"), Decimal(0))
        ae_value = total_cans - excluded_samples
        ae = result("AE", "Total cans", ae_value)

    if ae["value"] is None:
        af = result("AF", "Cost of cans", None, "Depends on AE total cans.")
    else:
        af = result("AF", "Cost of cans", Decimal(ae["value"]) * number(costs.get("AA")))

    ag_blockers = sorted((set("OPQRS") & formula_pending) | (set(ae_blockers)))
    if ag_blockers:
        ag = result("AG", "Total lids", None, "Formula-derived Product Entry inputs pending: " + ", ".join(ag_blockers))
    else:
        ag_value = (Decimal(ae["value"]) if ae["value"] is not None else Decimal(0)) - sum(
            (number(fields.get(column, {}).get("value")) for column in "OPQRS"), Decimal(0)
        )
        ag = result("AG", "Total lids", ag_value) if ae["value"] is not None else result("AG", "Total lids", None, "Depends on AE total cans.")

    if ag["value"] is None:
        ah = result("AH", "Cost of lids", None, "Depends on AG total lids.")
    else:
        ah = result("AH", "Cost of lids", Decimal(ag["value"]) * number(costs.get("AB")))

    return {item["column"]: item for item in (ae, af, ag, ah)}
