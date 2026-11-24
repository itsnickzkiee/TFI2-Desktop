from tfi_backend.import_headers import OEE_INPUT_HEADERS, detect_registered_header


def test_header_detector_finds_oee_labels_after_blank_and_grouped_rows():
    header = list(OEE_INPUT_HEADERS)
    header[4] = "planned time - HRS"
    assert detect_registered_header([[], ["RUN DETAILS"], [], header], OEE_INPUT_HEADERS) == 4


def test_header_detector_requires_review_for_changed_column_order():
    header = list(OEE_INPUT_HEADERS)
    header[1], header[2] = header[2], header[1]
    assert detect_registered_header([header], OEE_INPUT_HEADERS) is None


def test_header_detector_requires_review_for_multiple_identical_headers():
    assert detect_registered_header([OEE_INPUT_HEADERS, [], OEE_INPUT_HEADERS], OEE_INPUT_HEADERS) is None


def test_google_oee_header_preflight_reads_only_candidate_rows(monkeypatch):
    from tfi_backend.google_sheets import GoogleSheetsService

    service = GoogleSheetsService(None, None, "", connection_store=object())

    from tfi_backend.import_headers import REGISTERED_HEADERS

    def read_values(url, token, params, *, timeout):
        assert url.endswith("/values/%27OEE%27%21A1%3AU20")
        assert params == {"valueRenderOption": "UNFORMATTED_VALUE"}
        return {"values": [[], [], [], *REGISTERED_HEADERS["oee"]["headers"]]}

    monkeypatch.setattr(service, "_api_get", read_values)
    assert service.verify_import_header("test-token", "test-sheet", "OEE", 4000, "oee") == 5


def test_multirow_nonprod_header_keeps_merged_cells_and_detects_offset():
    from tfi_backend.import_headers import REGISTERED_HEADERS, detect_header_block

    headers = REGISTERED_HEADERS["nonprod"]["headers"]
    assert detect_header_block([[], ["Title"], *headers], headers) == 3
    assert detect_header_block([headers[1], headers[0]], headers) is None
