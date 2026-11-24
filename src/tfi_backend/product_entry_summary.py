"""Read-only projection of Summary!A:AF from canonical Product Entry records."""
from __future__ import annotations

from decimal import Decimal, InvalidOperation

from .product_entry_contract import PRODUCT_ENTRY_BLOCKS
from .yield_contract import parse_yield_date

# Summary!A4 stacks A:F and these 18 fields in Product Entry block order.
# A dash represents an intentionally empty array column.
QUALITY_COLUMNS = {
    "BLK_01": "CA CB CC CD CE CF CG CH CI CJ CK CL CM CN CO CP CQ CR".split(),
    "BLK_02": "CM CN CO CP CQ CR CS CT CU CV CW CX CY CZ DA DB DC DD".split(),
    "BLK_03": "CT CU CV CW CX CY CZ DA DB DC DD DE DF DG DH DI DJ DK".split(),
    "BLK_04": "CN CO CP CQ CR CS CT CU CV CW CX CY CZ DA DB DC DD DE".split(),
    "BLK_05": "CN CO CP CQ CR CS CT CU CV CW CX CY CZ DA DB DC DD DE".split(),
    "BLK_06": "CN CO CP CQ CR CS CT CU CV CW CX CY CZ DA DB DC DD DE".split(),
    "BLK_07": "CR CS CT CU CV CW CX CY CZ DA DB DC DD DE DF DG DH DI".split(),
    "BLK_08": "CM CN CO CP CQ CR CS CT CU CV CX CW CY CZ DA DB DC DD".split(),
    "BLK_09": "CZ DA DB DC DD DE DF DG DH DI DJ DK DL DM DN DO DP DQ".split(),
    "BLK_10": "CN CO CP CQ CR CS CT CU CV CW CX CY CZ DA DB DC DD DE".split(),
    "BLK_11": "CM CN CO CP CQ CR CS CT CU CV CX CW CY CZ DA DB DC DD".split(),
    "BLK_12": "CN CO CP CQ CR CS CT CU CV CW CY CX CZ DA DB DC DD DE".split(),
    "BLK_13": "CN CO CP CQ CR CS CT CU CV CW CX CY CZ DA DB DC DD DE".split(),
    "BLK_14": "CM CN CO CP CQ CR CS CT CU CV CW CX CY CZ DA DB DC DD".split(),
    "BLK_15": "CN CO CP CQ CR CS CT CU CV CW CX CY CZ DA DB DC DD DE".split(),
    "BLK_16": "CS CT CU CV CW CX CY CZ DA DB DD DC DE DF DG DH DI DJ".split(),
    "BLK_17": "CO CP CQ CR CS CT CU CV CW CX CY CZ DA DB DC DD DE DF".split(),
    "BLK_18": "CM CN CO CP CQ CR CS CT CU CV CW CX CY CZ DA DB DC DD".split(),
    "BLK_19": "CP CQ CR CS CT CU CV CW CX CY CZ DA DB DC DD DE DF DG".split(),
    "BLK_20": "CM CN CO CP CQ CR CS CT CU CV CW CX CY CZ DA DB DC DD".split(),
    "BLK_21": "CN CO CP CQ CR CS CT CU CV CW CX CY CZ DA DB DC DD DE".split(),
    "BLK_22": "CM CN CO CP CQ CR CS CT CU CV CW CX CY CZ DA DB DC DD".split(),
    "BLK_23": "CM CN CO CP CQ CR CS CT CU CV - CW CX CY CZ DA DB DC".split(),
    "BLK_24": "CJ CK CL CM CN CO CP CQ CR CS CT CU CV CW CX CY CZ DA".split(),
    "BLK_25": "CQ CR CS CT CU CV CW CX CY CZ DA DB DC DD DE DF DG DH".split(),
    "BLK_26": "CO CP CQ CR CS CT CU CV CW CX CY CZ DA DB DC DD DE DF".split(),
    "BLK_27": "CQ CR CS CT CU CV CW CX CY CZ DA DB DC DD DE DF DG DH".split(),
    "BLK_28": "CQ CR CS CT CU CV CW CX CY CZ DA DB DC DD DE DF DG DH".split(),
    "BLK_29": "CO CP CQ CR CS CT CU CV CW CX CY CZ DA DB DC DD DE DF".split(),
    "BLK_30": "CM CN CO CP CQ CR CS CT CU CV CW CX CY CZ DA DB DC DD".split(),
    "BLK_31": "CT CU CV CW CX CY CZ DA DB DC DE DD DF DG DH DI DJ DK".split(),
    "BLK_32": "CR CS CT CU CV CW CX CY CZ DA DC DB DD DE DF DG DH DI".split(),
    "BLK_33": "CR CS CT CU CV CW CX CY CZ DA DB DC DD DE DF DG DH DI".split(),
    "BLK_34": "BV BW BX BY BZ CA CB CC CD CE CF CG CH CI CJ CK CL CM".split(),
    "BLK_35": "DA DB DC DD DE DF DG DH DI DJ DK DL DM DN DO DP DQ DR".split(),
    "BLK_36": "CN CO CP CQ CR CS CT CU CV CW CX CY CZ DA DB DC DD DE".split(),
    "BLK_37": "CN CO CP CQ CR CS CT CU CV CW - CX CY CZ DA DB DC DD".split(),
    "BLK_38": "DF DG DH DI DJ DK DL DM DN DO - DP DQ DR DS DT DU DV".split(),
    "BLK_39": "AT AU AV AW AX AY AZ BA BB BC - BD BE BF BG BH BI BJ+BK".split(),
}

FIELD_NAMES = (
    "dateProduce", "productCode", "canSize", "pr",
    "batches", "totalFg", "dented", "falseSeam", "flipper", "bulged", "panel",
    "buckling", "retention", "qaSamples", "dentedCurl", "canTeardown",
    "underweightCan", "rusty", "emptyCanTeardown", "seamerDented", "fillerDented",
    "underweight", "dentedFlange", "canWasherPalletizer",
)
REJECT_FIELDS = ("dented", "falseSeam", "flipper", "bulged", "panel", "buckling")


def _number(value):
    if value is None or isinstance(value, bool) or not str(value).strip():
        return None
    try:
        number = Decimal(str(value).strip().replace(",", ""))
    except InvalidOperation:
        return None
    return number if number.is_finite() and abs(number) <= Decimal("1e100") else None


def _ratio(numerator, denominator):
    return float(numerator / denominator) if denominator else None


def project_summary_record(source: dict) -> dict | None:
    columns = QUALITY_COLUMNS.get(source.get("block_key"))
    if not columns or source.get("record_status", "active") != "active":
        return None
    data = source.get("record_data") or {}
    product_code = str(data.get("B") or source.get("product_code") or "").strip()
    if not product_code:
        return None
    raw_date = data.get("A") or source.get("production_date_text")
    parsed_date = parse_yield_date(source.get("production_date") or raw_date, None)
    values = {
        "dateProduce": parsed_date.isoformat() if parsed_date else raw_date,
        "productCode": product_code,
        "canSize": data.get("C"),
        "pr": data.get("D"),
    }
    block = PRODUCT_ENTRY_BLOCKS[source["block_key"]]
    retention_column = columns[6]
    sample_column = columns[7]
    retention_formula = block["schema_metadata"]["formulas"].get(retention_column, "")
    expected_formula = f"={sample_column}{block['source_first_data_row']}*2"

    numbers = {}
    for name, column in zip(FIELD_NAMES[4:], ("E", "F", *columns), strict=True):
        cell = data.get(column)
        if column == "BJ+BK":
            parts = (data.get("BJ"), data.get("BK"))
            number = sum(_number(part) or 0 for part in parts) if any(part not in (None, "") for part in parts) else None
        elif name == "retention" and cell in (None, "") and retention_formula == expected_formula:
            samples = _number(data.get(sample_column))
            number = samples * 2 if samples is not None else None
        else:
            # First-row arithmetic literals are examples of historical entries.
            # A saved row's own numeric values are the source for these fields.
            number = _number(cell)
        numbers[name] = number
        values[name] = float(number) if number is not None else None

    fg = numbers["totalFg"]
    has_date = bool(values["dateProduce"])
    # Summary!Z uses R:W exactly, including Rusty and excluding column X.
    lid_count = sum(numbers[name] or 0 for name in FIELD_NAMES[14:17])
    can_count = sum(numbers[name] or 0 for name in FIELD_NAMES[17:23])
    values["lidsReject"] = _ratio(lid_count, lid_count + fg) if has_date and fg is not None else None
    values["emptyCanReject"] = _ratio(can_count, can_count + fg) if has_date and fg is not None else None
    for name in REJECT_FIELDS:
        guard = values["pr"] if name == "flipper" else has_date or name == "buckling"
        values[name + "Pct"] = _ratio(numbers[name] or 0, fg) if guard else None
    return values
