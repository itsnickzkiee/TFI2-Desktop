from tfi_backend.co_qa_contract import (
    BUSINESS_RULE_HOLD,
    FORMULA_OUTPUTS,
    MANUAL_COST_INPUTS,
    SOURCE,
    SOURCE_COLUMNS,
    UNRESOLVED_OUTPUTS,
    classify_co_qa_row,
    get_co_qa_source_contract,
)


def test_co_qa_source_identity_and_layout_match_official_worksheet():
    contract = get_co_qa_source_contract()
    assert SOURCE["spreadsheet_id"] == "1rCbQ16wj7MRjQCFF3tA-WEMkudraJK0RkwcqayUlz7k"
    assert SOURCE["sheet"] == "co QA"
    assert SOURCE["sheet_id"] == 1359678099
    assert SOURCE["grid_rows"] == 2745
    assert SOURCE["grid_columns"] == 40
    assert SOURCE["header_row"] == 2
    assert SOURCE["first_data_row"] == 3
    assert SOURCE["array_formula_cell"] == "A3"
    assert len(SOURCE_COLUMNS) == 24
    assert [column["column"] for column in SOURCE_COLUMNS] == [
        chr(code) for code in range(ord("A"), ord("Y"))
    ]
    assert contract["capabilities"]["create"] is False
    assert contract["capabilities"]["import_promote"] is False


def test_co_qa_separates_product_entry_spill_manual_costs_and_formula_outputs():
    contract = get_co_qa_source_contract()
    assert [field["column"] for field in MANUAL_COST_INPUTS] == ["Y", "Z", "AA", "AB", "AC", "AD"]
    assert [field["column"] for field in FORMULA_OUTPUTS] == ["AE", "AF", "AG", "AH"]
    assert [field["column"] for field in UNRESOLVED_OUTPUTS] == ["AI", "AJ", "AK", "AL"]
    assert contract["dependencies"]["identity_preserved_in_spill"] is False
    assert contract["dependencies"]["product_entry_blocks"] == 39


def test_co_qa_hold_now_covers_unmapped_qa_projection_and_unresolved_outputs():
    contract = get_co_qa_source_contract()
    assert BUSINESS_RULE_HOLD["status"] == "hold_pending_business_rule"
    assert any("record UUID or block_key" in reason for reason in BUSINESS_RULE_HOLD["reasons"])
    assert any("39 Product Entry blocks" in reason for reason in BUSINESS_RULE_HOLD["reasons"])
    assert any("AI:AL" in reason for reason in BUSINESS_RULE_HOLD["reasons"])
    assert contract["cost_storage"]["key"] == "product_entry_record_id"
    assert len(BUSINESS_RULE_HOLD["safe_next_design"]) == 5


def test_co_qa_row_classifier_keeps_spill_rows_in_review_without_source_identity():
    values = ["March 9", "MDP-100-155", "202 X 306", "001", 66, 101191] + [0] * 34
    values[24] = 1.25
    values[30] = 586
    result = classify_co_qa_row(values)
    assert result["classification"] == "review_required"
    assert result["manual_cost_present"] is True
    assert result["formula_output_present"] is True
    assert result["promotable"] is False


def test_co_qa_row_remains_blocked_even_after_identity_is_supplied_until_rules_are_approved():
    values = ["March 9", "MDP-100-155", "202 X 306", "001", 66, 101191] + [0] * 34
    result = classify_co_qa_row(values, has_product_entry_record_id=True)
    assert result["classification"] == "blocked_pending_business_rules"
    assert result["promotable"] is False


def test_co_qa_blank_row_is_not_an_operational_record():
    assert classify_co_qa_row([None] * 40)["classification"] == "blank"


def test_co_qa_classifier_rejects_wide_or_malformed_source_rows():
    import pytest
    with pytest.raises(ValueError):
        classify_co_qa_row(["x"] * 41)
    with pytest.raises(ValueError):
        classify_co_qa_row("not-a-row")
