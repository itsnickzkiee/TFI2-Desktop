"""Compare worksheet headers with the verified source registry."""
from __future__ import annotations

import json
import re
from pathlib import Path


REGISTERED_HEADERS = json.loads(
    Path(__file__).with_name("import_header_manifest.json").read_text(encoding="utf-8")
)
OEE_INPUT_HEADERS = tuple(REGISTERED_HEADERS["oee"]["headers"][0][:10])


def _normalize_header(value):
    return re.sub(r"[^a-z0-9]+", "", str(value or "").casefold())


def detect_registered_header(rows, expected_headers):
    """Return the one matching single header row, or None when review is needed."""
    return detect_header_block(rows, [expected_headers])


def detect_header_block(rows, expected_rows):
    """Return the starting row of a unique, ordered header block."""
    def matches(row, expected):
        return all(
            _normalize_header(row[index] if index < len(row) else None) == _normalize_header(value)
            for index, value in enumerate(expected)
        )

    height = len(expected_rows)
    candidates = [
        start + 1
        for start in range(len(rows) - height + 1)
        if all(matches(rows[start + index], expected) for index, expected in enumerate(expected_rows))
    ]
    return candidates[0] if len(candidates) == 1 else None
