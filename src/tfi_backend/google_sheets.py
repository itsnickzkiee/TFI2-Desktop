"""Read-only Google Sheets OAuth and selective worksheet scanning for TFI2."""
from __future__ import annotations

import base64
import ctypes
import hashlib
import json
import os
import re
import secrets
import threading
import time
from ctypes import wintypes
from pathlib import Path
from typing import Iterator
from urllib.parse import quote, urlencode, urlparse

import requests
from openpyxl.utils import get_column_letter

from .import_service import MAX_IMPORT_ROWS, _column_index, _empty


GOOGLE_SCOPES = (
    "openid email https://www.googleapis.com/auth/spreadsheets.readonly"
)
GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo"
GOOGLE_SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets"
GOOGLE_SHEETS_CHUNK_ROWS = 2000
SPREADSHEET_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{20,200}$")


class GoogleSheetsError(ValueError):
    """A safe, user-displayable Google Sheets integration error."""

    def __init__(self, message: str, status_code: int = 400, code: str = "google_sheets_error"):
        super().__init__(message)
        self.status_code = status_code
        self.code = code


def parse_google_spreadsheet_id(value: str) -> str:
    """Accept only canonical HTTPS Google Sheets URLs and return their file ID."""
    raw = str(value or "").strip()
    try:
        parsed = urlparse(raw)
    except ValueError as exc:
        raise GoogleSheetsError("Enter a valid Google Sheets URL.", 400, "invalid_google_sheets_url") from exc
    match = re.fullmatch(r"/spreadsheets/(?:u/\d+/)?d/([A-Za-z0-9_-]{20,200})(?:/.*)?", parsed.path or "")
    if (
        parsed.scheme != "https"
        or (parsed.hostname or "").lower() != "docs.google.com"
        or parsed.username
        or parsed.password
        or not match
        or parsed.fragment and len(parsed.fragment) > 200
    ):
        raise GoogleSheetsError(
            "Use the full HTTPS link from docs.google.com/spreadsheets/d/…",
            400,
            "invalid_google_sheets_url",
        )
    spreadsheet_id = match.group(1)
    if not SPREADSHEET_ID_PATTERN.fullmatch(spreadsheet_id):
        raise GoogleSheetsError("The Google Sheets file ID is invalid.", 400, "invalid_google_sheets_id")
    return spreadsheet_id


def _dpapi_transform(payload: bytes, *, protect: bool) -> bytes:
    """Encrypt/decrypt bytes for the current Windows user using Windows DPAPI."""
    if os.name != "nt":
        raise GoogleSheetsError(
            "Secure Google connection storage is available only on the Windows TFI host.",
            503,
            "google_secure_store_unavailable",
        )

    class DATA_BLOB(ctypes.Structure):
        _fields_ = [
            ("cbData", wintypes.DWORD),
            ("pbData", ctypes.POINTER(ctypes.c_byte)),
        ]

    crypt32 = ctypes.WinDLL("crypt32", use_last_error=True)
    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    source_buffer = ctypes.create_string_buffer(payload)
    source_blob = DATA_BLOB(
        len(payload),
        ctypes.cast(source_buffer, ctypes.POINTER(ctypes.c_byte)),
    )
    result_blob = DATA_BLOB()
    kernel32.LocalFree.argtypes = [ctypes.c_void_p]
    kernel32.LocalFree.restype = ctypes.c_void_p

    if protect:
        function = crypt32.CryptProtectData
        function.argtypes = [
            ctypes.POINTER(DATA_BLOB), wintypes.LPCWSTR,
            ctypes.c_void_p, ctypes.c_void_p, ctypes.c_void_p,
            wintypes.DWORD, ctypes.POINTER(DATA_BLOB),
        ]
        function.restype = wintypes.BOOL
        ok = function(
            ctypes.byref(source_blob),
            "TFI Google Sheets OAuth",
            None, None, None, 0,
            ctypes.byref(result_blob),
        )
    else:
        function = crypt32.CryptUnprotectData
        function.argtypes = [
            ctypes.POINTER(DATA_BLOB), ctypes.c_void_p,
            ctypes.c_void_p, ctypes.c_void_p, ctypes.c_void_p,
            wintypes.DWORD, ctypes.POINTER(DATA_BLOB),
        ]
        function.restype = wintypes.BOOL
        ok = function(
            ctypes.byref(source_blob),
            None, None, None, None, 0,
            ctypes.byref(result_blob),
        )

    if not ok:
        raise GoogleSheetsError(
            "The saved Google connection could not be opened securely. Reconnect the Google account.",
            503,
            "google_secure_store_error",
        )
    try:
        return ctypes.string_at(result_blob.pbData, result_blob.cbData)
    finally:
        kernel32.LocalFree(result_blob.pbData)


class DPAPIConnectionStore:
    """Persist Google refresh tokens only as current-Windows-user DPAPI ciphertext."""

    def __init__(self, path: str | Path | None = None):
        if path is None:
            root = Path(os.getenv("LOCALAPPDATA") or (Path.home() / "AppData" / "Local"))
            path = root / "TFI_NEW" / "google_sheets_connections.dat"
        self.path = Path(path)
        self._lock = threading.RLock()
        self._connections = self._load()

    def _load(self) -> dict:
        if not self.path.exists():
            return {}
        try:
            clear = _dpapi_transform(self.path.read_bytes(), protect=False)
            value = json.loads(clear.decode("utf-8"))
            return value if isinstance(value, dict) else {}
        except GoogleSheetsError:
            raise
        except Exception as exc:
            raise GoogleSheetsError(
                "The saved Google connection store is unreadable. Reconnect after checking the local app data.",
                503,
                "google_secure_store_error",
            ) from exc

    def _save(self) -> None:
        encrypted = _dpapi_transform(
            json.dumps(self._connections, ensure_ascii=False, separators=(",", ":")).encode("utf-8"),
            protect=True,
        )
        self.path.parent.mkdir(parents=True, exist_ok=True)
        temporary = self.path.with_suffix(self.path.suffix + ".tmp")
        temporary.write_bytes(encrypted)
        temporary.replace(self.path)

    def get(self, user_id: str) -> dict | None:
        with self._lock:
            value = self._connections.get(str(user_id))
            return dict(value) if isinstance(value, dict) else None

    def put(self, user_id: str, value: dict) -> None:
        with self._lock:
            self._connections[str(user_id)] = dict(value)
            self._save()

    def delete(self, user_id: str) -> None:
        with self._lock:
            self._connections.pop(str(user_id), None)
            self._save()


class GoogleSheetsService:
    """OAuth connection manager and read-only Sheets API client."""

    def __init__(
        self,
        client_id: str | None,
        client_secret: str | None,
        redirect_uri: str,
        *,
        connection_store: DPAPIConnectionStore | None = None,
        http=None,
        clock=time.time,
        sleeper=time.sleep,
    ):
        self.client_id = str(client_id or "").strip()
        self.client_secret = str(client_secret or "").strip()
        self.redirect_uri = str(redirect_uri or "").strip()
        self.store = connection_store or DPAPIConnectionStore()
        self.http = http or requests
        self.clock = clock
        self.sleeper = sleeper
        self._pending: dict[str, dict] = {}
        self._pending_lock = threading.RLock()
        self._token_cache: dict[str, dict] = {}

    @property
    def configured(self) -> bool:
        return bool(self.client_id and self.client_secret and self.redirect_uri)

    def status(self, user_id: str) -> dict:
        connection = self.store.get(user_id)
        return {
            "configured": self.configured,
            "connected": bool(connection and connection.get("refresh_token")),
            "email": connection.get("email") if connection else None,
            "redirect_uri": self.redirect_uri,
            "scope": GOOGLE_SCOPES,
        }

    def start_authorization(self, user_id: str) -> str:
        if not self.configured:
            raise GoogleSheetsError(
                "Google OAuth is not configured on this TFI computer. Add the Google OAuth client ID and secret to the local .env file first.",
                503,
                "google_oauth_not_configured",
            )
        state = secrets.token_urlsafe(32)
        verifier = secrets.token_urlsafe(64)
        challenge = base64.urlsafe_b64encode(
            hashlib.sha256(verifier.encode("ascii")).digest()
        ).rstrip(b"=").decode("ascii")
        with self._pending_lock:
            now = self.clock()
            self._pending = {
                key: value for key, value in self._pending.items()
                if float(value.get("expires_at", 0)) > now
            }
            self._pending[state] = {
                "user_id": str(user_id),
                "code_verifier": verifier,
                "expires_at": now + 600,
            }
        params = {
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "response_type": "code",
            "scope": GOOGLE_SCOPES,
            "access_type": "offline",
            "prompt": "consent select_account",
            "include_granted_scopes": "true",
            "state": state,
            "code_challenge": challenge,
            "code_challenge_method": "S256",
        }
        return GOOGLE_AUTH_ENDPOINT + "?" + urlencode(params)

    def complete_authorization_for_state(self, state: str, code: str) -> dict:
        """Complete the callback using the one-time server-side OAuth state.

        Google returns through a cross-site top-level redirect, where the TFI
        SameSite=Strict session cookie is intentionally not sent. The state is
        unguessable, expires after ten minutes, is consumed once, and is bound
        to the initiating TFI user and PKCE verifier in this process.
        """
        normalized_state = str(state or "")
        with self._pending_lock:
            pending = self._pending.get(normalized_state)
            user_id = str((pending or {}).get("user_id") or "")
        return self.complete_authorization(user_id, normalized_state, code)

    def complete_authorization(self, user_id: str, state: str, code: str) -> dict:
        with self._pending_lock:
            pending = self._pending.pop(str(state or ""), None)
        if (
            not pending
            or pending.get("user_id") != str(user_id)
            or float(pending.get("expires_at", 0)) <= self.clock()
        ):
            raise GoogleSheetsError(
                "The Google authorization session expired or did not match this TFI account. Start the connection again.",
                400,
                "google_oauth_state_invalid",
            )
        if not code or len(code) > 4096:
            raise GoogleSheetsError("Google did not return a valid authorization code.", 400, "google_oauth_code_missing")

        token = self._post_token({
            "code": code,
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "redirect_uri": self.redirect_uri,
            "grant_type": "authorization_code",
            "code_verifier": pending["code_verifier"],
        })
        access_token = str(token.get("access_token") or "")
        if not access_token:
            raise GoogleSheetsError("Google did not issue an access token.", 502, "google_oauth_token_invalid")

        refresh_token = str(token.get("refresh_token") or "")
        if not refresh_token:
            raise GoogleSheetsError(
                "Google did not issue a refresh token. Disconnect the app in your Google Account permissions and connect again.",
                502,
                "google_oauth_refresh_token_missing",
            )

        profile = self._get_user_profile(access_token)
        email = str(profile.get("email") or "").strip()
        if not email or profile.get("email_verified") is not True:
            raise GoogleSheetsError("Google did not return a verified account email.", 502, "google_oauth_profile_missing")

        self.store.put(user_id, {
            "user_id": str(user_id),
            "refresh_token": refresh_token,
            "email": email[:320],
            "scopes": GOOGLE_SCOPES,
            "connected_at": int(self.clock()),
        })
        self._token_cache[str(user_id)] = {
            "access_token": access_token,
            "expires_at": self.clock() + max(60, int(token.get("expires_in") or 3600)),
        }
        return self.status(user_id)

    def disconnect(self, user_id: str) -> dict:
        connection = self.store.get(user_id)
        self.store.delete(user_id)
        self._token_cache.pop(str(user_id), None)
        if connection and connection.get("refresh_token"):
            try:
                self.http.post(
                    "https://oauth2.googleapis.com/revoke",
                    data={"token": connection["refresh_token"]},
                    timeout=15,
                )
            except requests.RequestException:
                pass
        return self.status(user_id)

    def get_access_token(self, user_id: str) -> str:
        if not self.configured:
            raise GoogleSheetsError(
                "Google OAuth is not configured on this TFI computer. Add the client ID and secret to the local .env file first.",
                503,
                "google_oauth_not_configured",
            )
        key = str(user_id)
        cached = self._token_cache.get(key)
        if cached and float(cached.get("expires_at", 0)) > self.clock() + 90:
            return str(cached["access_token"])

        connection = self.store.get(user_id)
        refresh_token = str((connection or {}).get("refresh_token") or "")
        if not refresh_token:
            raise GoogleSheetsError(
                "Connect an authorized Google Account before importing a Google Sheet.",
                409,
                "google_account_not_connected",
            )
        token = self._post_token({
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
        })
        access_token = str(token.get("access_token") or "")
        if not access_token:
            raise GoogleSheetsError("Google could not refresh the connection. Reconnect the account.", 502, "google_token_refresh_failed")
        if token.get("refresh_token"):
            connection["refresh_token"] = str(token["refresh_token"])
            self.store.put(user_id, connection)
        self._token_cache[key] = {
            "access_token": access_token,
            "expires_at": self.clock() + max(60, int(token.get("expires_in") or 3600)),
        }
        return access_token

    def _post_token(self, data: dict) -> dict:
        if not self.configured:
            raise GoogleSheetsError("Google OAuth is not configured on this TFI computer.", 503, "google_oauth_not_configured")
        try:
            response = self.http.post(GOOGLE_TOKEN_ENDPOINT, data=data, timeout=25)
        except requests.RequestException as exc:
            raise GoogleSheetsError("Google authorization could not be reached. Check the internet connection and try again.", 502, "google_oauth_network_error") from exc
        payload = self._response_json(response, "Google authorization failed.")
        if getattr(response, "status_code", 200) >= 400:
            code = str(payload.get("error") or "")
            message = str(payload.get("error_description") or "Google authorization failed.")
            if code == "invalid_grant":
                raise GoogleSheetsError("The Google authorization expired or was revoked. Reconnect the Google Account.", 401, "google_reauth_required")
            raise GoogleSheetsError(message[:300], 502, "google_oauth_exchange_failed")
        return payload

    def _get_user_profile(self, access_token: str) -> dict:
        try:
            response = self.http.get(
                GOOGLE_USERINFO_ENDPOINT,
                headers={"Authorization": "Bearer " + access_token, "Accept": "application/json"},
                timeout=20,
            )
        except requests.RequestException as exc:
            raise GoogleSheetsError("The connected Google Account could not be verified.", 502, "google_profile_network_error") from exc
        payload = self._response_json(response, "The connected Google Account could not be verified.")
        if getattr(response, "status_code", 200) >= 400:
            raise GoogleSheetsError("The connected Google Account could not be verified. Reconnect and try again.", 502, "google_profile_failed")
        return payload

    @staticmethod
    def _response_json(response, fallback: str) -> dict:
        try:
            payload = response.json()
        except (ValueError, AttributeError):
            payload = {}
        if not isinstance(payload, dict):
            raise GoogleSheetsError(fallback, 502, "google_invalid_response")
        return payload

    def _api_get(self, url: str, access_token: str, params: dict, *, timeout: int = 45) -> dict:
        try:
            response = self.http.get(
                url,
                params=params,
                headers={"Authorization": "Bearer " + access_token, "Accept": "application/json"},
                timeout=timeout,
            )
        except requests.RequestException as exc:
            raise GoogleSheetsError("Google Sheets could not be reached. Check the connection and try again.", 502, "google_sheets_network_error") from exc
        payload = self._response_json(response, "Google Sheets returned an unreadable response.")
        status = int(getattr(response, "status_code", 200))
        if status >= 400:
            if status == 401:
                raise GoogleSheetsError("The Google connection expired. Reconnect the Google Account.", 401, "google_reauth_required")
            if status == 403:
                raise GoogleSheetsError("This Google Account does not have permission to read the selected spreadsheet, or the Google Sheets API is not enabled.", 403, "google_sheets_access_denied")
            if status == 404:
                raise GoogleSheetsError("The spreadsheet was not found. Check the link and confirm it is shared with the connected Google Account.", 404, "google_spreadsheet_not_found")
            if status == 429:
                raise GoogleSheetsError("Google Sheets rate limit reached. Wait a moment and retry the scan.", 429, "google_sheets_rate_limited")
            error = payload.get("error") if isinstance(payload.get("error"), dict) else {}
            message = str(error.get("message") or "Google Sheets could not read the requested data.")
            raise GoogleSheetsError(message[:300], 502, "google_sheets_api_error")
        return payload

    def get_spreadsheet_metadata(self, access_token: str, spreadsheet_id: str) -> dict:
        payload = self._api_get(
            f"{GOOGLE_SHEETS_API}/{spreadsheet_id}",
            access_token,
            {
                "includeGridData": "false",
                "fields": "spreadsheetId,properties(title),sheets(properties(sheetId,title,gridProperties(rowCount,columnCount)))",
            },
            timeout=30,
        )
        properties = payload.get("properties") or {}
        sheets = []
        for item in payload.get("sheets") or []:
            sheet = item.get("properties") or {}
            grid = sheet.get("gridProperties") or {}
            sheets.append({
                "sheet_id": sheet.get("sheetId"),
                "title": sheet.get("title"),
                "row_count": grid.get("rowCount"),
                "column_count": grid.get("columnCount"),
            })
        return {
            "spreadsheet_id": str(payload.get("spreadsheetId") or spreadsheet_id),
            "title": str(properties.get("title") or "Google Sheets workbook"),
            "sheets": sheets,
        }

    def verify_import_header(self, access_token, spreadsheet_id, title, row_count, module_key):
        from .import_headers import REGISTERED_HEADERS, detect_header_block

        contract = REGISTERED_HEADERS.get(module_key)
        if contract is None:
            raise GoogleSheetsError("This module has no registered header layout.", 409, "google_sheet_mapping_missing")
        expected_rows = contract["headers"]
        last_column = get_column_letter(max(map(len, expected_rows)))
        escaped_title = title.replace("'", "''")
        last_row = min(row_count or 20, 20)
        range_a1 = f"'{escaped_title}'!A1:{last_column}{last_row}"
        payload = self._api_get(
            f"{GOOGLE_SHEETS_API}/{spreadsheet_id}/values/{quote(range_a1, safe='')}",
            access_token,
            {"valueRenderOption": "UNFORMATTED_VALUE"},
            timeout=30,
        )
        header = detect_header_block(payload.get("values") or [], expected_rows)
        if header is None:
            raise GoogleSheetsError(
                f"Headers for '{title}' need review. Check that the worksheet uses the approved column order and labels.",
                409,
                "google_sheet_header_needs_review",
            )
        return header + contract["data_offset"]

    def iter_import_rows(
        self,
        access_token: str,
        spreadsheet_id: str,
        destination: dict,
        stats: dict,
    ) -> Iterator[dict]:
        """Read only the registered worksheet in bounded ranges, preserving formulas."""
        expected_title = str(destination.get("source_sheet_title") or "").strip()
        expected_sheet_id = int(destination.get("source_sheet_id") or 0)
        first_data_row = int(destination.get("first_data_row") or 1)
        grid_rows = int(destination.get("grid_rows") or 0)
        grid_columns = int(destination.get("grid_columns") or 0)
        if not expected_title or expected_sheet_id <= 0:
            raise GoogleSheetsError("The selected TFI module has no approved Google worksheet mapping.", 409, "google_sheet_mapping_missing")
        if first_data_row < 1 or grid_rows < first_data_row or not 1 <= grid_columns <= 200:
            raise GoogleSheetsError("The approved worksheet dimensions are invalid.", 409, "google_sheet_mapping_invalid")

        input_columns = {
            _column_index(column) for column in (destination.get("input_columns") or [])
        }
        formula_columns = {
            _column_index(column) for column in (destination.get("formula_columns") or [])
        }
        del formula_columns  # Formula detection is based on actual Google cell metadata.

        stats.update(
            rows_inspected=0,
            blank_rows=0,
            formula_cells=0,
            derived_rows=0,
            unmapped_rows=0,
            rows_staged=0,
        )

        last_row = min(grid_rows, first_data_row + MAX_IMPORT_ROWS - 1)
        if last_row < first_data_row:
            return

        for chunk_start in range(first_data_row, last_row + 1, GOOGLE_SHEETS_CHUNK_ROWS):
            chunk_end = min(last_row, chunk_start + GOOGLE_SHEETS_CHUNK_ROWS - 1)
            escaped_title = expected_title.replace("'", "''")
            range_a1 = f"'{escaped_title}'!A{chunk_start}:{get_column_letter(grid_columns)}{chunk_end}"
            payload = self._api_get(
                f"{GOOGLE_SHEETS_API}/{spreadsheet_id}",
                access_token,
                {
                    "ranges": range_a1,
                    "includeGridData": "true",
                    "fields": "sheets(properties(sheetId,title),data(startRow,rowData(values(userEnteredValue,effectiveValue))))",
                },
                timeout=60,
            )
            sheet = next(
                (
                    item for item in (payload.get("sheets") or [])
                    if int((item.get("properties") or {}).get("sheetId") or -1) == expected_sheet_id
                    and str((item.get("properties") or {}).get("title") or "").casefold() == expected_title.casefold()
                ),
                None,
            )
            if sheet is None:
                raise GoogleSheetsError(
                    f"The approved worksheet '{expected_title}' (sheetId {expected_sheet_id}) was not returned by Google Sheets.",
                    409,
                    "google_approved_worksheet_missing",
                )
            data_blocks = sheet.get("data") or []
            data = data_blocks[0] if data_blocks else {}
            row_data = data.get("rowData") or []
            response_start = int(data.get("startRow", chunk_start - 1)) + 1

            for row_number in range(chunk_start, chunk_end + 1):
                row_index = row_number - response_start
                row = row_data[row_index] if 0 <= row_index < len(row_data) else {}
                cells = row.get("values") or []
                stats["rows_inspected"] += 1

                raw_values = []
                formulas = {}
                populated_columns = set()
                input_populated = False
                formula_populated = False
                has_error = False

                for column_index in range(1, grid_columns + 1):
                    cell = cells[column_index - 1] if column_index <= len(cells) else {}
                    entered = cell.get("userEnteredValue") or {}
                    effective = cell.get("effectiveValue") or {}
                    formula = entered.get("formulaValue")
                    if formula is not None:
                        value = str(formula)
                        formulas[get_column_letter(column_index)] = value
                        if expected_sheet_id == 1538651320 and column_index in (1, 18):
                            value = effective.get("numberValue", value)
                        stats["formula_cells"] += 1
                        formula_populated = True
                    elif "stringValue" in entered:
                        value = entered.get("stringValue")
                    elif "numberValue" in entered:
                        value = entered.get("numberValue")
                    elif "boolValue" in entered:
                        value = entered.get("boolValue")
                    elif "errorValue" in effective:
                        error_value = effective.get("errorValue") or {}
                        value = error_value.get("message") or error_value.get("type") or "#ERROR!"
                        has_error = True
                    else:
                        value = None

                    if "errorValue" in effective:
                        has_error = True
                    raw_values.append(value)
                    if not _empty(value):
                        populated_columns.add(column_index)
                    if column_index in input_columns and not _empty(value):
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

            if chunk_end < last_row:
                self.sleeper(1.05)


__all__ = [
    "DPAPIConnectionStore",
    "GOOGLE_SCOPES",
    "GoogleSheetsError",
    "GoogleSheetsService",
    "parse_google_spreadsheet_id",
]
