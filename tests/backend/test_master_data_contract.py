import pytest

from tfi_backend.master_data_contract import (
    MASTER_DATA_CATEGORIES,
    MasterDataValidationError,
    column_to_index,
    validate_master_data_changes,
)


def test_exactly_nine_verified_master_data_categories_are_registered():
    assert len(MASTER_DATA_CATEGORIES) == 9
    assert len({item.sheet_id for item in MASTER_DATA_CATEGORIES.values()}) == 9
    assert {
        "product_standard",
        "code_map",
        "yield_map",
        "entry_map",
        "kpi_setup",
        "dpr_legend",
        "dmp_legend",
        "manpower",
        "schedule_lists",
    } == set(MASTER_DATA_CATEGORIES)


def test_category_sheet_ids_and_source_ranges_match_approved_ui_spec():
    expected = {
        "product_standard": (2138697021, "A1:U110", 21),
        "code_map": (2098561343, "A1:B72", 2),
        "yield_map": (854969610, "A1:W43", 23),
        "entry_map": (1628314566, "A1:E43", 5),
        "kpi_setup": (1955006742, "A1:T129", 20),
        "dpr_legend": (508797580, "A1:AN119", 40),
        "dmp_legend": (1070169465, "A1:D70", 4),
        "manpower": (583741906, "A1:E448", 5),
        "schedule_lists": (156467196, "A1:L101", 12),
    }
    for key, (sheet_id, source_range, column_count) in expected.items():
        category = MASTER_DATA_CATEGORIES[key]
        assert category.sheet_id == sheet_id
        assert category.source_range == source_range
        assert category.source_column_count == column_count


def test_product_standard_allows_only_the_approved_editable_columns():
    changes = {"B": "New Product Name", "E": "14", "U": "10"}
    assert validate_master_data_changes(
        "product_standard", changes, source_row_number=10, row_kind="data"
    ) == changes

    for column in ("A", "F", "G", "S"):
        with pytest.raises(MasterDataValidationError):
            validate_master_data_changes(
                "product_standard",
                {column: "attempted change"},
                source_row_number=10,
            )


def test_code_map_only_allows_product_name_mapping_to_change():
    assert validate_master_data_changes(
        "code_map", {"B": "Verified Product Name"}, source_row_number=5
    ) == {"B": "Verified Product Name"}
    with pytest.raises(MasterDataValidationError):
        validate_master_data_changes("code_map", {"A": "NEW-CODE"}, source_row_number=5)


def test_yield_map_allows_only_columns_b_through_m():
    assert validate_master_data_changes(
        "yield_map", {"B": "S", "M": "97%"}, source_row_number=5
    ) == {"B": "S", "M": "97%"}
    for column in ("A", "N", "P", "W"):
        with pytest.raises(MasterDataValidationError):
            validate_master_data_changes(
                "yield_map", {column: "attempted change"}, source_row_number=5
            )


@pytest.mark.parametrize("category", ["entry_map", "kpi_setup", "dpr_legend", "schedule_lists"])
def test_read_only_categories_reject_all_edits(category):
    with pytest.raises(MasterDataValidationError, match="read-only"):
        validate_master_data_changes(category, {"A": "change"}, source_row_number=5)


def test_dmp_legend_source_note_rows_are_locked():
    locked_rows = (5, 9, 14, 17, 20, 23, 31, 33, 36, 39)
    for source_row in locked_rows:
        with pytest.raises(MasterDataValidationError, match="protected"):
            validate_master_data_changes(
                "dmp_legend",
                {"B": "attempted change"},
                source_row_number=source_row,
            )

    assert validate_master_data_changes(
        "dmp_legend", {"B": "Verified Role"}, source_row_number=6
    ) == {"B": "Verified Role"}


def test_dpr_legend_read_only_columns_use_excel_column_labels():
    columns = MASTER_DATA_CATEGORIES["dpr_legend"].read_only_columns
    assert len(columns) == 40
    assert columns[25] == "Z"
    assert columns[26] == "AA"
    assert columns[-1] == "AN"


def test_manpower_preserves_row_identity_and_allows_controlled_field_edits():
    category = MASTER_DATA_CATEGORIES["manpower"]
    assert category.source_record_count == 445
    assert category.editable_columns == ("A", "B", "C", "D", "E")
    assert validate_master_data_changes(
        "manpower", {"A": "Verified Source Name"}, source_row_number=4
    ) == {"A": "Verified Source Name"}


def test_non_data_rows_and_protected_rows_cannot_be_edited():
    with pytest.raises(MasterDataValidationError, match="populated data rows"):
        validate_master_data_changes(
            "product_standard",
            {"B": "not allowed"},
            source_row_number=2,
            row_kind="group_header",
        )

    with pytest.raises(MasterDataValidationError, match="protected"):
        validate_master_data_changes(
            "product_standard",
            {"B": "not allowed"},
            source_row_number=3,
            row_editable=False,
        )


def test_edit_payload_must_be_nonempty_and_string_valued():
    with pytest.raises(MasterDataValidationError, match="at least one"):
        validate_master_data_changes("manpower", {}, source_row_number=4)

    with pytest.raises(MasterDataValidationError, match="source text"):
        validate_master_data_changes("manpower", {"A": 123}, source_row_number=4)


def test_column_letter_conversion_handles_multi_letter_columns():
    assert column_to_index("A") == 0
    assert column_to_index("Z") == 25
    assert column_to_index("AA") == 26
    assert column_to_index("AN") == 39
    with pytest.raises(MasterDataValidationError):
        column_to_index("A1")


def test_category_and_column_keys_are_normalized_safely():
    assert validate_master_data_changes(
        "manpower", {"a": "Name"}, source_row_number=4
    ) == {"A": "Name"}
    with pytest.raises(MasterDataValidationError):
        validate_master_data_changes("not_a_category", {"A": "x"}, source_row_number=4)
