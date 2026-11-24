"""Source-aligned Yield Log projection and safe evaluator for Product Entry formulas.

The Yield Log is a read-only projection. It reads the live Yield Map master-data
rows and the formula definitions captured from the original Product Entry sheet.
It never writes calculated values back to operational records.
"""
from __future__ import annotations

import re
from math import isfinite
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from decimal import Decimal, InvalidOperation
from typing import Any

from .product_entry_contract import PRODUCT_ENTRY_BLOCKS


class YieldCalculationError(ValueError):
    """Raised when a source-mapped Yield Log formula cannot be evaluated."""


def column_number(column: str) -> int:
    result = 0
    for character in str(column).upper():
        if not ("A" <= character <= "Z"):
            raise YieldCalculationError("The Yield Map contains an invalid column letter.")
        result = result * 26 + ord(character) - 64
    return result


def _column_letters(number: int) -> str:
    result = ""
    while number:
        number, remainder = divmod(number - 1, 26)
        result = chr(65 + remainder) + result
    return result


def _clean_column(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip().upper()
    if not text:
        return None
    if not re.fullmatch(r"[A-Z]{1,3}", text):
        raise YieldCalculationError(f"Invalid Yield Map column: {text}.")
    if column_number(text) > 164:
        raise YieldCalculationError(f"Yield Map column {text} is outside the Product Entry source range.")
    return text


def _parse_target(value: Any) -> float | None:
    if value in (None, ""):
        return None
    text = str(value).strip()
    try:
        if text.endswith("%"):
            return float(Decimal(text[:-1].strip()) / Decimal(100))
        number = Decimal(text)
        return float(number / Decimal(100) if number > 1 else number)
    except (InvalidOperation, ValueError):
        return None


def build_yield_map(master_rows: list[dict]) -> dict[str, dict]:
    """Build the 39 product mappings from the current TFI2 Yield Map snapshot."""
    blocks_by_product = {
        str(block["product_key"]).strip(): block
        for block in PRODUCT_ENTRY_BLOCKS.values()
    }
    mapped: dict[str, dict] = {}
    for row in sorted(master_rows or [], key=lambda item: int(item.get("source_row_number") or 0)):
        if row.get("record_status", "active") != "active" or row.get("row_kind") != "data":
            continue
        values = row.get("current_values")
        if not isinstance(values, list) or len(values) < 14:
            continue
        product_key = str(values[0] or "").strip()
        if not product_key:
            continue
        block = blocks_by_product.get(product_key)
        if not block:
            raise YieldCalculationError(
                f"Yield Map product {product_key} does not match a Product Entry block."
            )
        if product_key in mapped:
            raise YieldCalculationError(f"Yield Map contains duplicate product mapping: {product_key}.")
        mapped[product_key] = {
            "source_row_number": row.get("source_row_number"),
            "product_key": product_key,
            "block_key": block["block_key"],
            "display_title": block["display_title"],
            "main_yield_column": _clean_column(values[1]),
            "main_yield_label": str(values[2] or "").strip() or "Main % Yield",
            "stage2_yield_column": _clean_column(values[3]),
            "stage2_yield_label": str(values[4] or "").strip() or "Stage 2 % Yield",
            "stage3_yield_column": _clean_column(values[5]),
            "stage3_yield_label": str(values[6] or "").strip() or "Stage 3 % Yield",
            "bloom_rate_column": _clean_column(values[7]),
            "lid_reject_column": _clean_column(values[8]),
            "can_reject_column": _clean_column(values[9]),
            "box_reject_column": _clean_column(values[10]),
            "label_reject_column": _clean_column(values[11]),
            "yield_target": _parse_target(values[12]),
            "yield_target_source": str(values[12]).strip() if values[12] not in (None, "") else None,
            "yield_target_is_placeholder": str(values[12] or "").strip() == "95%",
            "last_data_row_info": values[13],
        }
    return mapped


def get_yield_map_note(master_rows: list[dict]) -> str | None:
    """Return the Yield Map's source instruction row without rewriting its wording."""
    for row in master_rows or []:
        if row.get("record_status", "active") != "active" or row.get("row_kind") != "instruction":
            continue
        if int(row.get("source_row_number") or 0) != 2:
            continue
        values = row.get("current_values")
        if isinstance(values, list) and values and values[0] not in (None, ""):
            return str(values[0]).strip()
    return None


def get_yield_year(kpi_setup_rows: list[dict]) -> int | None:
    """Read the workbook's KPI Setup!M2 year used by Yield Log date formulas."""
    for row in kpi_setup_rows or []:
        if row.get("record_status", "active") != "active":
            continue
        if int(row.get("source_row_number") or 0) != 2:
            continue
        values = row.get("current_values")
        if not isinstance(values, list) or len(values) <= 12:
            return None
        try:
            year = int(str(values[12]).strip())
            return year if 1900 <= year <= 2200 else None
        except (TypeError, ValueError):
            return None
    return None


def parse_yield_date(value: Any, year: int | None) -> date | None:
    """Match Yield Log's ISO-date or month/day text conversion."""
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if value in (None, ""):
        return None
    text = str(value).strip()
    if not text:
        return None
    try:
        return date.fromisoformat(text[:10])
    except ValueError:
        pass
    for pattern in ("%m/%d/%Y", "%m/%d/%y", "%b %d, %Y", "%B %d, %Y"):
        try:
            return datetime.strptime(text, pattern).date()
        except ValueError:
            continue
    if year and re.fullmatch(r"[A-Za-z]{3}\s+\d{1,2}", text):
        try:
            return datetime.strptime(f"{text} {year}", "%b %d %Y").date()
        except ValueError:
            return None
    if re.fullmatch(r"\d+(?:\.\d+)?", text):
        try:
            serial = Decimal(text)
            if Decimal(1) <= serial <= Decimal(100000):
                return date(1899, 12, 30) + timedelta(days=int(serial))
        except (InvalidOperation, OverflowError):
            return None
    return None


@dataclass(frozen=True)
class _RangeRef:
    sheet: str | None
    start_column: str
    start_row: int | None
    end_column: str
    end_row: int | None


_TOKEN_RE = re.compile(
    r"""\s*(?:
    (?P<EXTERNAL>'[^']+'!\$?[A-Z]{1,3}:\$?[A-Z]{1,3})
    |(?P<RANGE>\$?[A-Z]{1,3}\$?\d+:\$?[A-Z]{1,3}\$?\d+)
    |(?P<CELL>\$?[A-Z]{1,3}\$?\d+)
    |(?P<STRING>"(?:[^"]|"")*")
    |(?P<NUMBER>(?:\d+(?:\.\d*)?|\.\d+)(?:[Ee][+-]?\d+)?)
    |(?P<IDENT>[A-Z][A-Z0-9_]*)
    |(?P<OP><=|>=|<>|[+\-*/=<>(),:])
    )""",
    re.IGNORECASE | re.VERBOSE,
)


class _FormulaParser:
    def __init__(self, formula: str):
        expression = str(formula or "").strip()
        if expression.startswith("="):
            expression = expression[1:]
        self.tokens: list[tuple[str, str]] = []
        position = 0
        while position < len(expression):
            match = _TOKEN_RE.match(expression, position)
            if not match:
                raise YieldCalculationError(
                    f"Unsupported syntax in source formula near: {expression[position:position + 24]}"
                )
            kind = match.lastgroup
            self.tokens.append((kind or "", match.group(kind or "") or ""))
            position = match.end()
        self.tokens.append(("EOF", ""))
        self.index = 0

    def _peek(self) -> tuple[str, str]:
        return self.tokens[self.index]

    def _take(self, expected: str | None = None) -> tuple[str, str]:
        token = self._peek()
        if expected is not None and token[1] != expected:
            raise YieldCalculationError(f"Expected {expected} in source formula.")
        self.index += 1
        return token

    def parse(self):
        node = self._comparison()
        if self._peek()[0] != "EOF":
            raise YieldCalculationError("The source formula contains unsupported trailing syntax.")
        return node

    def _comparison(self):
        node = self._additive()
        if self._peek()[1] in ("=", "<>", ">", "<", ">=", "<="):
            operator = self._take()[1]
            node = ("binary", operator, node, self._additive())
        return node

    def _additive(self):
        node = self._multiplicative()
        while self._peek()[1] in ("+", "-"):
            operator = self._take()[1]
            node = ("binary", operator, node, self._multiplicative())
        return node

    def _multiplicative(self):
        node = self._unary()
        while self._peek()[1] in ("*", "/"):
            operator = self._take()[1]
            node = ("binary", operator, node, self._unary())
        return node

    def _unary(self):
        if self._peek()[1] in ("+", "-"):
            operator = self._take()[1]
            return ("unary", operator, self._unary())
        return self._primary()

    def _primary(self):
        kind, value = self._peek()
        if value == "(":
            self._take("(")
            node = self._comparison()
            self._take(")")
            return node
        if kind == "NUMBER":
            self._take()
            return ("number", Decimal(value))
        if kind == "STRING":
            self._take()
            return ("string", value[1:-1].replace('""', '"'))
        if kind == "EXTERNAL":
            self._take()
            sheet, columns = value.split("!", 1)
            start_column, end_column = columns.split(":", 1)
            return ("range", _RangeRef(
                sheet=sheet[1:-1],
                start_column=start_column.replace("$", "").upper(),
                start_row=None,
                end_column=end_column.replace("$", "").upper(),
                end_row=None,
            ))
        if kind == "RANGE":
            self._take()
            start_ref, end_ref = value.split(":", 1)
            start_column, start_row = _parse_cell_reference(start_ref)
            end_column, end_row = _parse_cell_reference(end_ref)
            return ("range", _RangeRef(None, start_column, start_row, end_column, end_row))
        if kind == "CELL":
            self._take()
            column, row = _parse_cell_reference(value)
            return ("cell", column, row)
        if kind == "IDENT":
            self._take()
            name = value.upper()
            if name in ("TRUE", "FALSE") and self._peek()[1] != "(":
                return ("boolean", name == "TRUE")
            if self._peek()[1] != "(":
                raise YieldCalculationError(f"Unsupported identifier in source formula: {name}.")
            self._take("(")
            arguments = []
            if self._peek()[1] != ")":
                arguments.append(self._comparison())
                while self._peek()[1] == ",":
                    self._take(",")
                    arguments.append(self._comparison())
            self._take(")")
            return ("call", name, arguments)
        raise YieldCalculationError("The source formula contains an unsupported expression.")


def _parse_cell_reference(value: str) -> tuple[str, int]:
    match = re.fullmatch(r"\$?([A-Z]{1,3})\$?(\d+)", str(value).upper())
    if not match:
        raise YieldCalculationError("The source formula contains an invalid cell reference.")
    return match.group(1), int(match.group(2))


def _decimal(value: Any) -> Decimal:
    if value is None or value == "":
        return Decimal(0)
    if isinstance(value, bool):
        return Decimal(1 if value else 0)
    if isinstance(value, Decimal):
        return value
    if isinstance(value, (int, float)):
        return Decimal(str(value))
    text = str(value).strip().replace(",", "")
    if not text:
        return Decimal(0)
    if text.endswith("%"):
        return Decimal(text[:-1].strip()) / Decimal(100)
    try:
        return Decimal(text)
    except InvalidOperation as exc:
        raise YieldCalculationError(f"Expected a numeric source cell, received {text!r}.") from exc


def _numeric_or_none(value: Any) -> float | None:
    if value in (None, "") or isinstance(value, bool):
        return None
    try:
        return float(_decimal(value))
    except (YieldCalculationError, InvalidOperation, ValueError):
        return None


def _is_blank(value: Any) -> bool:
    return value is None or value == ""


def _truthy(value: Any) -> bool:
    if _is_blank(value):
        return False
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float, Decimal)):
        return value != 0
    if isinstance(value, str):
        return value.strip().casefold() not in ("", "false")
    return True


def _compare(left: Any, right: Any, operator: str) -> bool:
    if operator in ("=", "<>"):
        if _is_blank(left) or _is_blank(right):
            equal = _is_blank(left) and _is_blank(right)
        elif isinstance(left, (int, float, Decimal)) or isinstance(right, (int, float, Decimal)):
            try:
                equal = _decimal(left) == _decimal(right)
            except YieldCalculationError:
                equal = str(left).casefold() == str(right).casefold()
        else:
            equal = str(left).strip().casefold() == str(right).strip().casefold()
        return equal if operator == "=" else not equal
    try:
        a, b = _decimal(left), _decimal(right)
    except YieldCalculationError:
        a, b = str(left or "").casefold(), str(right or "").casefold()
    if operator == ">":
        return a > b
    if operator == "<":
        return a < b
    if operator == ">=":
        return a >= b
    return a <= b


class _MissingRowValue(YieldCalculationError):
    """A historical first-row literal has no saved value for this record."""


def _has_cell_reference(node):
    kind = node[0]
    if kind in ("cell", "range"):
        return True
    if kind == "binary":
        return _has_cell_reference(node[2]) or _has_cell_reference(node[3])
    if kind == "unary":
        return _has_cell_reference(node[2])
    if kind == "call":
        return any(_has_cell_reference(argument) for argument in node[2])
    return False


class _YieldFormulaEvaluator:
    def __init__(self, block: dict, record_data: dict, dmr_records: list[dict] | None = None, *, use_saved_values=False):
        self.use_saved_values = use_saved_values
        self.block = block
        self.record_data = record_data or {}
        self.dmr_records = dmr_records or []
        self.base_row = int(block["source_first_data_row"])
        self.formulas = block.get("schema_metadata", {}).get("formulas", {})
        self.metadata = block.get("schema_metadata", {})
        self.memo: dict[str, Any] = {}
        self.active: set[str] = set()

    def cell(self, column: str, row: int | None = None):
        column = str(column).upper()
        row = self.base_row if row is None else int(row)
        if row == self.base_row:
            if column in self.formulas:
                return self.formula(column)
            return self.record_data.get(column)
        offset = self.base_row - row
        index = column_number(column) - 1
        metadata_key = {1: "headers", 2: "group2", 3: "group1"}.get(offset)
        if metadata_key:
            values = self.metadata.get(metadata_key) or []
            return values[index] if index < len(values) else None
        raise YieldCalculationError(
            f"Formula in {self.block['block_key']} references unsupported source row {row}."
        )

    def formula(self, column: str):
        if column in self.memo:
            return self.memo[column]
        if column in self.active:
            raise YieldCalculationError(f"Circular formula dependency at {self.block['block_key']}!{column}.")
        expression = self.formulas.get(column)
        if expression is None:
            return self.record_data.get(column)
        self.active.add(column)
        try:
            if self.use_saved_values and not _is_blank(self.record_data.get(column)):
                return self.record_data[column]
            node = _FormulaParser(str(expression)).parse()
            if self.use_saved_values and not _has_cell_reference(node):
                raise _MissingRowValue(f"Missing saved value for Product Entry column {column}.")
            value = self._evaluate(node)
            self.memo[column] = value
            return value
        finally:
            self.active.discard(column)

    def _range_values(self, reference: _RangeRef) -> list[Any]:
        if reference.sheet:
            if self.use_saved_values:
                raise _MissingRowValue("This period average requires a saved value for external-sheet inputs.")
            if reference.sheet.strip().casefold() != "dmr production":
                raise YieldCalculationError(f"Unsupported external formula sheet: {reference.sheet}.")
            source_fields = {
                "A": "production_date",
                "B": "product_code",
                "G": "downtime_minutes",
                "H": "category",
            }
            if reference.start_column != reference.end_column:
                raise YieldCalculationError("Unsupported multi-column DMR Production range.")
            field = source_fields.get(reference.start_column)
            if not field:
                raise YieldCalculationError(
                    f"DMR Production source column {reference.start_column} is not mapped."
                )
            return [record.get(field) for record in self.dmr_records]
        if reference.start_row is None or reference.end_row is None:
            raise YieldCalculationError("A local formula range must include row numbers.")
        first_column = column_number(reference.start_column)
        last_column = column_number(reference.end_column)
        first_row = min(reference.start_row, reference.end_row)
        last_row = max(reference.start_row, reference.end_row)
        values = []
        for row in range(first_row, last_row + 1):
            for column_number_value in range(min(first_column, last_column), max(first_column, last_column) + 1):
                values.append(self.cell(_column_letters(column_number_value), row))
        return values

    def _evaluate(self, node):
        kind = node[0]
        if kind == "number":
            return node[1]
        if kind == "string":
            return node[1]
        if kind == "boolean":
            return node[1]
        if kind == "cell":
            return self.cell(node[1], node[2])
        if kind == "range":
            return node[1]
        if kind == "unary":
            value = _decimal(self._evaluate(node[2]))
            return value if node[1] == "+" else -value
        if kind == "binary":
            operator, left_node, right_node = node[1], node[2], node[3]
            left = self._evaluate(left_node)
            right = self._evaluate(right_node)
            if operator in ("=", "<>", ">", "<", ">=", "<="):
                return _compare(left, right, operator)
            a, b = _decimal(left), _decimal(right)
            if operator == "+":
                return a + b
            if operator == "-":
                return a - b
            if operator == "*":
                return a * b
            if b == 0:
                raise ZeroDivisionError("division by zero")
            return a / b
        if kind == "call":
            name, arguments = node[1], node[2]
            if name == "IF":
                if len(arguments) not in (2, 3):
                    raise YieldCalculationError("IF requires two or three arguments.")
                condition = self._evaluate(arguments[0])
                if _truthy(condition):
                    return self._evaluate(arguments[1])
                return self._evaluate(arguments[2]) if len(arguments) == 3 else False
            if name == "IFERROR":
                if not 1 <= len(arguments) <= 2:
                    raise YieldCalculationError("IFERROR requires one or two arguments.")
                try:
                    return self._evaluate(arguments[0])
                except _MissingRowValue:
                    raise
                except (ZeroDivisionError, YieldCalculationError, InvalidOperation):
                    return self._evaluate(arguments[1]) if len(arguments) == 2 else ""
            if name == "SUM":
                total = Decimal(0)
                for argument in arguments:
                    value = self._evaluate(argument)
                    values = self._range_values(value) if isinstance(value, _RangeRef) else [value]
                    for item in values:
                        if _numeric_or_none(item) is not None:
                            total += _decimal(item)
                return total
            if name == "SUMIFS":
                if len(arguments) < 3 or len(arguments) % 2 == 0:
                    raise YieldCalculationError("SUMIFS requires a sum range and criteria range/value pairs.")
                sum_range = self._evaluate(arguments[0])
                if not isinstance(sum_range, _RangeRef):
                    raise YieldCalculationError("SUMIFS sum range must be a source range.")
                sum_values = self._range_values(sum_range)
                criteria = []
                for index in range(1, len(arguments), 2):
                    criteria_range = self._evaluate(arguments[index])
                    if not isinstance(criteria_range, _RangeRef):
                        raise YieldCalculationError("SUMIFS criteria ranges must be source ranges.")
                    criteria.append((self._range_values(criteria_range), self._evaluate(arguments[index + 1])))
                if any(len(values) != len(sum_values) for values, _ in criteria):
                    raise YieldCalculationError("SUMIFS source ranges do not have matching lengths.")
                total = Decimal(0)
                for row_index, sum_value in enumerate(sum_values):
                    if all(_compare(values[row_index], criterion, "=") for values, criterion in criteria):
                        if _numeric_or_none(sum_value) is not None:
                            total += _decimal(sum_value)
                return total
            raise YieldCalculationError(f"Unsupported source formula function: {name}.")
        raise YieldCalculationError("Unsupported source formula expression.")


def _yield_metric(evaluator: _YieldFormulaEvaluator, column: str | None) -> float | None:
    if not column:
        return None
    try:
        return _numeric_or_none(evaluator.cell(column))
    except (ZeroDivisionError, InvalidOperation) as exc:
        raise YieldCalculationError(f"Could not calculate Yield Map column {column}.") from exc


def calculate_main_yield(record, yield_map, date_from, date_to, year):
    block = PRODUCT_ENTRY_BLOCKS.get(record.get("block_key"))
    if block is None:
        return None
    mapping = yield_map.get(str(record.get("product_key") or block["product_key"]).strip())
    column = mapping and mapping.get("main_yield_column")
    if not column:
        return None
    data = record.get("record_data") or {}
    code = str(record.get("product_code") or data.get("B") or "").strip()
    parsed = parse_yield_date(record.get("production_date") or record.get("production_date_text") or data.get("A"), year)
    if not code or not parsed or not date_from <= parsed.isoformat() <= date_to:
        return None
    evaluator = _YieldFormulaEvaluator(block, {**data, "A": parsed.isoformat(), "B": code}, use_saved_values=True)
    try:
        value = _yield_metric(evaluator, column)
    except YieldCalculationError:
        return None
    return value if value is not None and isfinite(value) else None


def build_yield_log_record(
    record: dict,
    yield_map: dict[str, dict],
    *,
    dmr_records: list[dict] | None = None,
    year: int | None = None,
) -> dict | None:
    """Project one Product Entry record using the source Yield Map and formulas."""
    block_key = str(record.get("block_key") or "").strip()
    block = PRODUCT_ENTRY_BLOCKS.get(block_key)
    if not block:
        return None
    mapping = yield_map.get(str(record.get("product_key") or block["product_key"]).strip())
    if not mapping:
        return None

    record_data = record.get("record_data")
    if not isinstance(record_data, dict):
        record_data = {}
    product_code = str(record.get("product_code") or record_data.get("B") or "").strip()
    raw_date = record.get("production_date") or record.get("production_date_text") or record_data.get("A")
    production_date = parse_yield_date(raw_date, year)
    if not product_code or production_date is None:
        return None

    calculation_data = dict(record_data)
    calculation_data["A"] = production_date.isoformat()
    calculation_data["B"] = product_code
    evaluator = _YieldFormulaEvaluator(block, calculation_data, dmr_records)

    return {
        "id": record.get("id"),
        "block_key": block_key,
        "product_key": block["product_key"],
        "product_name": mapping["display_title"],
        "production_date": production_date.isoformat(),
        "product_code": product_code,
        "total_fg_tins": _yield_metric(evaluator, "F"),
        "main_yield": _yield_metric(evaluator, mapping["main_yield_column"]),
        "main_yield_label": mapping["main_yield_label"],
        "stage2_yield": _yield_metric(evaluator, mapping["stage2_yield_column"]),
        "stage2_yield_label": mapping["stage2_yield_label"],
        "stage3_yield": _yield_metric(evaluator, mapping["stage3_yield_column"]),
        "stage3_yield_label": mapping["stage3_yield_label"],
        "bloom_rate": _yield_metric(evaluator, mapping["bloom_rate_column"]),
        "lid_reject": _yield_metric(evaluator, mapping["lid_reject_column"]),
        "can_reject": _yield_metric(evaluator, mapping["can_reject_column"]),
        "box_reject": _yield_metric(evaluator, mapping["box_reject_column"]),
        "label_reject": _yield_metric(evaluator, mapping["label_reject_column"]),
        "yield_target": mapping["yield_target"],
        "yield_target_source": mapping["yield_target_source"],
        "yield_target_is_placeholder": mapping["yield_target_is_placeholder"],
        "review_status": record.get("review_status"),
        "record_version": record.get("version"),
        "source_map_row": mapping["source_row_number"],
        "calculation_status": "calculated",
    }
