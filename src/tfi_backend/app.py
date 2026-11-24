"""Localhost-only Flask host for the TFI_NEW UI and TFI2 authentication."""
from __future__ import annotations

import csv
import io
import re
import secrets
import time
import uuid
from datetime import date
from decimal import Decimal, InvalidOperation
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from threading import RLock
from urllib.parse import urlparse

from flask import Flask, abort, jsonify, make_response, redirect, request, send_from_directory
from werkzeug.exceptions import RequestEntityTooLarge

from .config import ConfigurationError, PROJECT_ROOT, Settings
from .master_data_contract import (
    MASTER_DATA_CATEGORIES,
    MasterDataValidationError,
    validate_master_data_changes,
)
from .dmp_production_contract import (
    DmpProductionValidationError,
    normalize_dmp_production_changes,
    normalize_dmp_production_records,
)
from .product_entry_contract import (
    ProductEntryValidationError,
    get_product_entry_block,
    normalize_product_entry_changes,
    normalize_product_entry_records,
)
from .dashboard_comparison import compare_metrics, previous_period
from .product_entry_summary import project_summary_record
from .yield_contract import (
    YieldCalculationError,
    build_yield_map,
    build_yield_log_record,
    calculate_main_yield,
    get_yield_map_note,
    get_yield_year,
    parse_yield_date,
)
from .production_entry_contract import (
    PRODUCTION_ENTRY_MANIFEST,
    ProductionEntryValidationError,
    get_production_entry_catalog,
    normalize_production_entry_changes,
    normalize_production_entry_records,
)
from .oee_contract import (
    OeeValidationError,
    get_oee_catalog,
    normalize_oee_changes,
    normalize_oee_records,
)
from .productivity_contract import (
    ProductivityValidationError,
    normalize_productivity_changes,
    normalize_productivity_preview,
    normalize_productivity_records,
)
from .hourly_production_contract import (
    HOURLY_MODULES,
    HourlyProductionValidationError,
    get_hourly_production_catalog,
    normalize_hourly_production_changes,
    normalize_hourly_production_records,
    validate_hourly_module,
)
from .dmr_coding_contract import (
    DmrCodingValidationError,
    get_dmr_coding_catalog,
    normalize_dmr_coding_changes,
    normalize_dmr_coding_records,
)
from .coding_dpr_contract import (
    CodingDprValidationError,
    get_coding_dpr_catalog,
    normalize_coding_dpr_changes,
    normalize_coding_dpr_records,
)
from .co_qa_contract import (
    get_co_qa_source_contract,
    normalize_co_qa_cost_changes,
    project_co_qa_product_entry_record,
    calculate_co_qa_formula_outputs,
)
from .pr_monitoring_contract import (
    COLUMNS as PR_MONITORING_COLUMNS,
    SORT_KEYS as PR_MONITORING_SORT_KEYS,
    STATUS_VALUES as PR_MONITORING_STATUS_VALUES,
    PrMonitoringValidationError,
    get_pr_monitoring_catalog,
)
from .dmr_production_contract import (
    DmrProductionValidationError,
    get_dmr_production_catalog,
    normalize_dmr_production_changes,
    normalize_dmr_production_records,
)
from .production_schedule_contract import (
    ProductionScheduleValidationError,
    normalize_production_schedule_form,
)
from .nonprod_contract import (
    NonProdValidationError,
    normalize_nonprod_changes,
    normalize_nonprod_records,
)
from .import_service import (
    ImportScanError,
    MAX_IMPORT_FILE_BYTES,
    iter_xlsx_import_rows,
    scan_file_sha256,
)
from .google_sheets import (
    GoogleSheetsError,
    GoogleSheetsService,
    parse_google_spreadsheet_id,
)
from .session_store import RecoveryVault, SessionVault
from .supabase_gateway import SupabaseError, SupabaseGateway

DESIGN_DIR = PROJECT_ROOT / "design"
PUBLIC_DESIGN_FILES = {
    "admin-login-preview.html",
    "admin-login.css",
    "admin-login-ui.js",
    "assets/tosen-foods-logo.webp",
    "password-recovery-request.html",
    "password-recovery-request.js",
    "password-reset.html",
    "password-reset.js",
}


def _is_loopback_request() -> bool:
    remote = (request.remote_addr or "").lower()
    host = (request.host.split(":", 1)[0] or "").lower()
    return remote in ("127.0.0.1", "::1") and host in ("127.0.0.1", "localhost")


def _same_origin_write() -> bool:
    origin = request.headers.get("Origin")
    if origin:
        parsed = urlparse(origin)
        if parsed.scheme not in ("http", "https") or parsed.netloc.lower() != request.host.lower():
            return False
    return request.headers.get("Sec-Fetch-Site", "").lower() not in ("cross-site",)


def _safe_sign_out(gateway: SupabaseGateway, access_token: str | None) -> None:
    if not access_token:
        return
    try:
        gateway.sign_out(access_token)
    except SupabaseError:
        # Local session is still removed even if the remote revoke request fails.
        pass


def _valid_access_context(context: dict) -> tuple[bool, str]:
    profile = context.get("profile")
    if not isinstance(profile, dict):
        return False, "No TFI application profile is linked to this account."
    status = profile.get("account_status")
    if status == "pending":
        return False, "Your account is awaiting administrator activation."
    if status != "active":
        return False, "Your TFI account is disabled."
    if not context.get("roles"):
        return False, "Your account is active but has no assigned role."
    if not context.get("permissions"):
        return False, "Your account has no assigned permissions."
    return True, ""


def create_app(
    settings: Settings | None = None,
    gateway: SupabaseGateway | None = None,
    vault: SessionVault | None = None,
    import_executor: ThreadPoolExecutor | None = None,
    google_sheets: GoogleSheetsService | None = None,
) -> Flask:
    settings = settings or Settings.from_env()
    gateway = gateway or SupabaseGateway(settings)
    vault = vault or SessionVault(settings.idle_timeout_seconds)
    recovery_vault = RecoveryVault(ttl_seconds=600)
    import_executor = import_executor or ThreadPoolExecutor(max_workers=2, thread_name_prefix="tfi-import")
    import_jobs: dict[str, dict] = {}
    import_jobs_lock = RLock()
    google_sheets = google_sheets or GoogleSheetsService(
        settings.google_client_id,
        settings.google_client_secret,
        f"http://127.0.0.1:{settings.port}/api/google-sheets/callback",
    )

    app = Flask(__name__)
    app.config.update(
        MAX_CONTENT_LENGTH=MAX_IMPORT_FILE_BYTES,
        TFI_SETTINGS=settings,
        TFI_GATEWAY=gateway,
        TFI_SESSION_VAULT=vault,
        TFI_RECOVERY_VAULT=recovery_vault,
        TFI_IMPORT_EXECUTOR=import_executor,
        TFI_IMPORT_JOBS=import_jobs,
        TFI_GOOGLE_SHEETS=google_sheets,
        JSON_SORT_KEYS=False,
    )

    @app.before_request
    def local_only_and_csrf_guard():
        if not _is_loopback_request():
            abort(403)
        if request.method in ("POST", "PUT", "PATCH", "DELETE") and not _same_origin_write():
            abort(403)

    @app.after_request
    def security_headers(response):
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "SAMEORIGIN"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Cache-Control"] = "no-store"
        response.headers["Cross-Origin-Resource-Policy"] = "same-origin"
        return response

    @app.errorhandler(SupabaseError)
    def handle_supabase_error(error: SupabaseError):
        return jsonify(error=error.message, code=error.code), error.status_code

    @app.errorhandler(ConfigurationError)
    def handle_configuration_error(error: ConfigurationError):
        return jsonify(error=str(error), code="configuration_error"), 500

    def require_master_data_permission(permission: str = "view") -> tuple[dict, dict]:
        session_id = request.cookies.get("tfi_sid")
        auth = vault.get(session_id, gateway)
        context = gateway.get_access_context(auth["access_token"])
        allowed, reason = _valid_access_context(context)
        if not allowed:
            vault.remove(session_id)
            raise SupabaseError(reason, 403, "master_data_access_denied")

        permissions = set(context.get("permissions") or [])
        required = {"master_data.view"}
        if permission == "edit":
            required.add("master_data.edit")
        missing = required - permissions
        if missing:
            raise SupabaseError(
                "Your TFI role does not have the required Master Data permission.",
                403,
                "master_data_permission_denied",
            )
        return auth, context

    def require_operational_permission(module_key: str, action: str = "view") -> tuple[dict, dict]:
        if action not in {"view", "create", "edit", "export", "approve"}:
            raise SupabaseError("The requested operational action is invalid.", 400, "invalid_operational_action")
        session_id = request.cookies.get("tfi_sid")
        auth = vault.get(session_id, gateway)
        context = gateway.get_access_context(auth["access_token"])
        allowed, reason = _valid_access_context(context)
        if not allowed:
            vault.remove(session_id)
            raise SupabaseError(reason, 403, "operational_access_denied")
        permissions = set(context.get("permissions") or [])
        required = {f"{module_key}.view"}
        if action != "view":
            required.add(f"{module_key}.{action}")
        if not required.issubset(permissions):
            raise SupabaseError(
                f"Your TFI role does not have permission to {action} {module_key.replace('_',' ').title()} records.",
                403,
                "operational_permission_denied",
            )
        return auth, context

    def require_dashboard_permission() -> tuple[dict, dict]:
        session_id = request.cookies.get("tfi_sid")
        auth = vault.get(session_id, gateway)
        context = gateway.get_access_context(auth["access_token"])
        allowed, reason = _valid_access_context(context)
        if not allowed:
            vault.remove(session_id)
            raise SupabaseError(reason, 403, "dashboard_access_denied")
        permissions = set(context.get("permissions") or [])
        if "dashboard.view" not in permissions:
            raise SupabaseError(
                "Your TFI role does not have Dashboard view permission.",
                403,
                "dashboard_permission_denied",
            )
        return auth, context


    @app.errorhandler(RequestEntityTooLarge)
    def handle_upload_too_large(_error):
        return jsonify(
            error="The selected workbook exceeds the 100 MB upload limit.",
            code="import_file_too_large",
        ), 413

    def require_import_permission(permission: str = "view", module_key: str | None = None) -> tuple[dict, dict]:
        session_id = request.cookies.get("tfi_sid")
        auth = vault.get(session_id, gateway)
        context = gateway.get_access_context(auth["access_token"])
        allowed, reason = _valid_access_context(context)
        if not allowed:
            vault.remove(session_id)
            raise SupabaseError(reason, 403, "import_access_denied")

        required = {
            "view": {"spreadsheet_import.view"},
            "create": {"spreadsheet_import.create"},
            "review": {"spreadsheet_import.review", "duplicate_review.review"},
            "import": {"spreadsheet_import.import", "import_confirmation.import"},
        }.get(permission)
        if required is None:
            raise SupabaseError("The requested import action is invalid.", 400, "invalid_import_action")
        if module_key:
            module_action = "review" if permission == "review" else "import"
            required.add(f"{module_key}.{module_action}")

        permissions = set(context.get("permissions") or [])
        missing = required - permissions
        if missing:
            raise SupabaseError(
                "Your TFI role does not have the required spreadsheet and module permissions.",
                403,
                "import_permission_denied",
            )
        return auth, context

    def _validated_uuid(value: str, label: str) -> str:
        try:
            return str(uuid.UUID(str(value)))
        except (TypeError, ValueError, AttributeError) as exc:
            raise SupabaseError(f"The selected {label} ID is invalid.", 400, "invalid_import_id") from exc

    def _import_batch_or_404(access_token: str, batch_id: str) -> dict:
        batch = gateway.get_import_batch(access_token, batch_id)
        if not batch:
            raise SupabaseError("The import batch was not found or is not available to this account.", 404, "import_batch_not_found")
        return batch

    def _run_import_scan(batch_id: str, file_bytes: bytes, destination: dict, auth_snapshot: dict) -> None:
        auth_state = dict(auth_snapshot)
        stats: dict = {}
        chunk: list[dict] = []

        def access_token() -> str:
            if time.time() >= float(auth_state.get("expires_at", 0)) - 120:
                auth_state.update(gateway.refresh_session(auth_state["refresh_token"]))
            return auth_state["access_token"]

        def stage_chunk() -> None:
            if not chunk:
                return
            gateway.stage_import_rows(
                access_token(), batch_id, list(chunk), module_key=destination.get("module_key")
            )
            stats["rows_staged"] = int(stats.get("rows_staged", 0)) + len(chunk)
            chunk.clear()
            with import_jobs_lock:
                import_jobs[batch_id] = {
                    "status": "scanning",
                    "rows_staged": stats["rows_staged"],
                    "rows_inspected": stats.get("rows_inspected", 0),
                }

        try:
            for row in iter_xlsx_import_rows(file_bytes, destination, stats):
                chunk.append(row)
                if len(chunk) >= 100:
                    stage_chunk()
            stage_chunk()
            result = gateway.complete_import_scan(
                access_token(),
                batch_id,
                {
                    "rows_inspected": int(stats.get("rows_inspected", 0)),
                    "blank_rows": int(stats.get("blank_rows", 0)),
                    "formula_cells": int(stats.get("formula_cells", 0)),
                    "derived_rows": int(stats.get("derived_rows", 0)),
                    "unmapped_rows": int(stats.get("unmapped_rows", 0)),
                },
            )
            with import_jobs_lock:
                import_jobs[batch_id] = {
                    "status": "review",
                    "rows_staged": int(result.get("rows_staged", stats.get("rows_staged", 0))),
                    "rows_inspected": int(result.get("rows_inspected", stats.get("rows_inspected", 0))),
                }
        except Exception as exc:
            message = str(exc) if isinstance(exc, (ImportScanError, SupabaseError)) else "The selected workbook could not be scanned. Check the file and try again."
            try:
                gateway.fail_import_batch(access_token(), batch_id, message[:500])
            except Exception:
                pass
            with import_jobs_lock:
                import_jobs[batch_id] = {
                    "status": "failed",
                    "error": message[:500],
                    "rows_staged": int(stats.get("rows_staged", 0)),
                    "rows_inspected": int(stats.get("rows_inspected", 0)),
                }

    def _run_google_sheet_scan(
        batch_id: str,
        spreadsheet_id: str,
        destination: dict,
        auth_snapshot: dict,
        tfi_user_id: str,
    ) -> None:
        auth_state = dict(auth_snapshot)
        stats: dict = {}
        chunk: list[dict] = []
        google_token_state: dict = {}

        def tfi_access_token() -> str:
            if time.time() >= float(auth_state.get("expires_at", 0)) - 120:
                auth_state.update(gateway.refresh_session(auth_state["refresh_token"]))
            return auth_state["access_token"]

        def google_access_token() -> str:
            if time.time() >= float(google_token_state.get("expires_at", 0)) - 90:
                token = google_sheets.get_access_token(tfi_user_id)
                google_token_state["access_token"] = token
                google_token_state["expires_at"] = time.time() + 3300
            return str(google_token_state["access_token"])

        def stage_chunk() -> None:
            if not chunk:
                return
            gateway.stage_import_rows(
                tfi_access_token(), batch_id, list(chunk), module_key=destination.get("module_key")
            )
            stats["rows_staged"] = int(stats.get("rows_staged", 0)) + len(chunk)
            chunk.clear()
            with import_jobs_lock:
                import_jobs[batch_id] = {
                    "status": "scanning",
                    "rows_staged": stats["rows_staged"],
                    "rows_inspected": stats.get("rows_inspected", 0),
                }

        try:
            for row in google_sheets.iter_import_rows(
                google_access_token(), spreadsheet_id, destination, stats
            ):
                chunk.append(row)
                if len(chunk) >= 100:
                    stage_chunk()
            stage_chunk()
            result = gateway.complete_import_scan(
                tfi_access_token(),
                batch_id,
                {
                    "rows_inspected": int(stats.get("rows_inspected", 0)),
                    "blank_rows": int(stats.get("blank_rows", 0)),
                    "formula_cells": int(stats.get("formula_cells", 0)),
                    "derived_rows": int(stats.get("derived_rows", 0)),
                    "unmapped_rows": int(stats.get("unmapped_rows", 0)),
                },
            )
            with import_jobs_lock:
                import_jobs[batch_id] = {
                    "status": "review",
                    "rows_staged": int(result.get("rows_staged", stats.get("rows_staged", 0))),
                    "rows_inspected": int(result.get("rows_inspected", stats.get("rows_inspected", 0))),
                }
        except Exception as exc:
            message = str(exc) if isinstance(exc, (GoogleSheetsError, SupabaseError, ImportScanError)) else "The selected Google worksheet could not be scanned. Check access and try again."
            try:
                gateway.fail_import_batch(tfi_access_token(), batch_id, message[:500])
            except Exception:
                pass
            with import_jobs_lock:
                import_jobs[batch_id] = {
                    "status": "failed",
                    "error": message[:500],
                    "rows_staged": int(stats.get("rows_staged", 0)),
                    "rows_inspected": int(stats.get("rows_inspected", 0)),
                }

    @app.get("/api/google-sheets/status")
    def google_sheets_status():
        auth, _context = require_import_permission("view")
        try:
            return jsonify(google_sheets.status(auth["user_id"]))
        except GoogleSheetsError as exc:
            return jsonify(error=str(exc), code=exc.code), exc.status_code

    @app.get("/api/google-sheets/connect")
    def google_sheets_connect():
        auth, _context = require_import_permission("view")
        try:
            authorization_url = google_sheets.start_authorization(auth["user_id"])
        except GoogleSheetsError as exc:
            return jsonify(error=str(exc), code=exc.code), exc.status_code
        return redirect(authorization_url, code=302)

    @app.get("/api/google-sheets/callback")
    def google_sheets_callback():
        if request.args.get("error"):
            return redirect("/design/spreadsheet-import-center-preview.html?googleError=access_denied", code=302)
        try:
            # Google returns through a cross-site redirect. The normal TFI
            # session cookie is SameSite=Strict, so it is not sent here.
            # The one-time server-side OAuth state is bound to the initiating
            # TFI user and PKCE verifier and is the callback authorization.
            google_sheets.complete_authorization_for_state(
                str(request.args.get("state") or ""),
                str(request.args.get("code") or ""),
            )
        except GoogleSheetsError as exc:
            app.logger.warning("Google Sheets OAuth callback rejected: %s", exc.code)
            return redirect(
                "/design/spreadsheet-import-center-preview.html?googleError=" + exc.code,
                code=302,
            )
        return redirect("/design/spreadsheet-import-center-preview.html?googleConnected=1", code=302)

    @app.post("/api/google-sheets/disconnect")
    def google_sheets_disconnect():
        auth, _context = require_import_permission("view")
        try:
            return jsonify(google_sheets.disconnect(auth["user_id"]))
        except GoogleSheetsError as exc:
            return jsonify(error=str(exc), code=exc.code), exc.status_code

    @app.post("/api/google-sheets/inspect")
    def google_sheets_inspect():
        auth, _context = require_import_permission("view")
        body = request.get_json(silent=True)
        if not isinstance(body, dict):
            return jsonify(error="A Google Sheets URL is required.", code="invalid_google_sheets_request"), 400
        try:
            spreadsheet_id = parse_google_spreadsheet_id(body.get("spreadsheet_url"))
            access_token = google_sheets.get_access_token(auth["user_id"])
            metadata = google_sheets.get_spreadsheet_metadata(access_token, spreadsheet_id)
        except GoogleSheetsError as exc:
            return jsonify(error=str(exc), code=exc.code), exc.status_code
        return jsonify(metadata=metadata)

    @app.get("/api/import/destinations")
    def import_destinations():
        auth, _context = require_import_permission("view")
        return jsonify(destinations=gateway.get_import_destinations(auth["access_token"]))

    @app.post("/api/import/batches")
    def create_import_batch():
        body = request.get_json(silent=True) if request.is_json else {}
        if not isinstance(body, dict):
            body = {}
        module_key = str(body.get("module_key") or request.form.get("module_key") or "").strip()
        source_type = str(body.get("source_type") or request.form.get("source_type") or "xlsx").strip()
        if not re.fullmatch(r"[a-z][a-z0-9_]{1,63}", module_key):
            return jsonify(error="Choose one approved destination module.", code="import_module_required"), 400
        if source_type not in {"xlsx", "google_sheets"}:
            return jsonify(error="Choose Google Sheets or an Excel workbook as the source.", code="invalid_import_source_type"), 400

        auth, _context = require_import_permission("create", module_key)
        destination = gateway.get_import_destination(auth["access_token"], module_key)
        if destination.get("contract_status") == "hold_pending_business_rule":
            return jsonify(
                error="This destination is not open for final import yet. Its business-rule mapping must be approved first.",
                code="import_mapping_pending_business_rule",
            ), 409

        if source_type == "google_sheets":
            try:
                spreadsheet_id = parse_google_spreadsheet_id(
                    body.get("spreadsheet_url") or request.form.get("spreadsheet_url") or request.form.get("source_url")
                )
                google_access_token = google_sheets.get_access_token(auth["user_id"])
                metadata = google_sheets.get_spreadsheet_metadata(google_access_token, spreadsheet_id)
            except GoogleSheetsError as exc:
                return jsonify(error=str(exc), code=exc.code), exc.status_code

            expected_sheet_id = int(destination["source_sheet_id"])
            expected_title = str(destination["source_sheet_title"])
            selected_sheet = next(
                (
                    item for item in metadata.get("sheets") or []
                    if int(item.get("sheet_id") or -1) == expected_sheet_id
                    and str(item.get("title") or "").casefold() == expected_title.casefold()
                ),
                None,
            )
            if selected_sheet is None:
                title_match = next(
                    (item for item in metadata.get("sheets") or []
                     if str(item.get("title") or "").casefold() == expected_title.casefold()),
                    None,
                )
                if title_match:
                    message = (
                        f"The worksheet name matches '{expected_title}', but its sheetId is "
                        f"{title_match.get('sheet_id')} instead of the approved {expected_sheet_id}. "
                        "Confirm that the client workbook is an unchanged copy of the approved source."
                    )
                    code = "google_sheet_id_mismatch"
                else:
                    message = f"The Google workbook does not contain the approved worksheet '{expected_title}'."
                    code = "google_approved_worksheet_missing"
                return jsonify(error=message, code=code), 409

            actual_columns = int(selected_sheet.get("column_count") or 0)
            required_columns = int(destination.get("grid_columns") or 0)
            if actual_columns and required_columns and actual_columns < required_columns:
                return jsonify(
                    error=f"The approved worksheet has {actual_columns} columns, but this module mapping requires {required_columns}.",
                    code="google_sheet_grid_too_small",
                ), 409

            scan_destination = dict(destination)
            actual_rows = int(selected_sheet.get("row_count") or 0)
            if actual_rows:
                scan_destination["grid_rows"] = min(
                    int(destination.get("grid_rows") or actual_rows), actual_rows
                )
            try:
                scan_destination["first_data_row"] = google_sheets.verify_import_header(
                    google_access_token, spreadsheet_id, expected_title, actual_rows, module_key
                )
            except GoogleSheetsError as exc:
                return jsonify(error=str(exc), code=exc.code), exc.status_code
            if scan_destination["first_data_row"] > scan_destination["grid_rows"]:
                return jsonify(error="The worksheet has no rows below its headers.",
                               code="google_sheet_has_no_data_rows"), 409
            source_name = str(metadata.get("title") or "Google Sheets workbook")[:255]
            batch = gateway.create_import_batch(
                auth["access_token"],
                module_key=module_key,
                source_name=source_name,
                source_workbook_key=f"google:{spreadsheet_id}",
                source_file_sha256=None,
                source_file_size=None,
                source_sheet_id=expected_sheet_id,
                source_type="google_sheets",
                source_spreadsheet_id=spreadsheet_id,
            )
            batch_id = str(batch["id"])
            with import_jobs_lock:
                import_jobs[batch_id] = {
                    "status": "scanning",
                    "rows_staged": 0,
                    "rows_inspected": 0,
                }
            try:
                import_executor.submit(
                    _run_google_sheet_scan,
                    batch_id,
                    spreadsheet_id,
                    scan_destination,
                    auth,
                    str(auth["user_id"]),
                )
            except Exception as exc:
                try:
                    gateway.fail_import_batch(auth["access_token"], batch_id, "The local scan worker could not be started.")
                except Exception:
                    pass
                raise SupabaseError("The local Google Sheets scanner could not be started. Try again.", 503, "import_worker_unavailable") from exc

            return jsonify(
                batch=batch,
                source={
                    "name": source_name,
                    "type": "google_sheets",
                    "spreadsheet_id": spreadsheet_id,
                    "sheet_count": len(metadata.get("sheets") or []),
                    "size": None,
                },
                message="The approved Google worksheet scan has started.",
            ), 202

        uploaded = request.files.get("file")
        if uploaded is None or not uploaded.filename:
            return jsonify(error="Select an .xlsx workbook to continue.", code="import_file_required"), 400

        source_name = uploaded.filename.replace("\\", "/").split("/")[-1].strip()[:255]
        if not source_name.lower().endswith(".xlsx"):
            return jsonify(error="Only .xlsx workbooks are accepted in this import phase.", code="import_xlsx_only"), 400

        file_bytes = uploaded.stream.read(MAX_IMPORT_FILE_BYTES + 1)
        if not file_bytes:
            return jsonify(error="The selected Excel workbook is empty.", code="import_file_empty"), 400
        if len(file_bytes) > MAX_IMPORT_FILE_BYTES:
            return jsonify(error="The selected workbook exceeds the 100 MB upload limit.", code="import_file_too_large"), 413
        if not file_bytes.startswith(b"PK"):
            return jsonify(error="The selected file is not a valid .xlsx workbook.", code="import_invalid_xlsx"), 400

        digest = scan_file_sha256(file_bytes)
        batch = gateway.create_import_batch(
            auth["access_token"],
            module_key=module_key,
            source_name=source_name,
            source_workbook_key=f"sha256:{digest}",
            source_file_sha256=digest,
            source_file_size=len(file_bytes),
            source_sheet_id=int(destination["source_sheet_id"]),
            source_type="xlsx",
        )
        batch_id = str(batch["id"])
        with import_jobs_lock:
            import_jobs[batch_id] = {
                "status": "scanning",
                "rows_staged": 0,
                "rows_inspected": 0,
            }
        try:
            import_executor.submit(_run_import_scan, batch_id, file_bytes, destination, auth)
        except Exception as exc:
            try:
                gateway.fail_import_batch(auth["access_token"], batch_id, "The local scan worker could not be started.")
            except Exception:
                pass
            raise SupabaseError("The local import scanner could not be started. Try again.", 503, "import_worker_unavailable") from exc

        return jsonify(
            batch=batch,
            source={"name": source_name, "type": "xlsx", "size": len(file_bytes)},
            message="The selected worksheet scan has started.",
        ), 202

    @app.get("/api/import/batches")
    def import_batch_history():
        auth, _context = require_import_permission("view")
        module_key = str(request.args.get("module_key") or "").strip() or None
        if module_key and not re.fullmatch(r"[a-z][a-z0-9_]{1,63}", module_key):
            return jsonify(error="The selected destination module is invalid.", code="invalid_import_module"), 400
        try:
            limit = min(200, max(1, int(request.args.get("limit", "100"))))
        except (TypeError, ValueError):
            return jsonify(error="The history limit must be a whole number.", code="invalid_import_limit"), 400
        batches = gateway.get_import_batches(auth["access_token"], module_key=module_key, limit=limit)
        return jsonify(batches=batches, total=len(batches))

    @app.get("/api/import/batches/<batch_id>")
    def import_batch_detail(batch_id: str):
        normalized_id = _validated_uuid(batch_id, "import batch")
        auth, _context = require_import_permission("view")
        batch = _import_batch_or_404(auth["access_token"], normalized_id)
        require_import_permission("view", batch["module_key"])
        with import_jobs_lock:
            progress = dict(import_jobs.get(normalized_id) or {})
        return jsonify(batch=batch, progress=progress)

    @app.get("/api/import/batches/<batch_id>/rows")
    def import_batch_rows(batch_id: str):
        normalized_id = _validated_uuid(batch_id, "import batch")
        auth, _context = require_import_permission("view")
        batch = _import_batch_or_404(auth["access_token"], normalized_id)
        require_import_permission("view", batch["module_key"])
        try:
            page = max(1, int(request.args.get("page", "1")))
            page_size = min(200, max(1, int(request.args.get("page_size", "100"))))
        except (TypeError, ValueError):
            return jsonify(error="Page and page size must be whole numbers.", code="invalid_import_pagination"), 400
        raw_ids = str(request.args.get("ids") or "").strip()
        row_ids = None
        if raw_ids:
            parts = [part.strip() for part in raw_ids.split(",") if part.strip()]
            if not parts or len(parts) > 1000:
                return jsonify(error="Select no more than 1,000 import rows per lookup.", code="invalid_import_row_ids"), 400
            try:
                row_ids = list(dict.fromkeys(str(uuid.UUID(part)) for part in parts))
            except (TypeError, ValueError, AttributeError):
                return jsonify(error="One or more selected import row IDs are invalid.", code="invalid_import_row_id"), 400
        rows = gateway.get_import_rows(
            auth["access_token"],
            normalized_id,
            limit=page_size,
            offset=(page - 1) * page_size,
            classification=request.args.get("classification"),
            import_status=request.args.get("import_status"),
            duplicate_status=request.args.get("duplicate_status"),
            row_ids=row_ids,
        )
        return jsonify(batch_id=normalized_id, rows=rows, page=page, page_size=page_size, has_more=len(rows) == page_size)

    @app.post("/api/import/batches/<batch_id>/rows/<row_id>/decision")
    def decide_import_row(batch_id: str, row_id: str):
        normalized_batch = _validated_uuid(batch_id, "import batch")
        normalized_row = _validated_uuid(row_id, "import row")
        body = request.get_json(silent=True)
        if not isinstance(body, dict):
            return jsonify(error="A JSON duplicate-review decision is required.", code="invalid_import_decision"), 400
        decision = body.get("decision")
        reason = body.get("reason")
        if decision not in {"import_as_new", "skip_duplicate", "hold"}:
            return jsonify(error="Choose Import as new, Skip duplicate, or Hold for review.", code="invalid_import_decision"), 400
        if reason is not None and (not isinstance(reason, str) or len(reason) > 500):
            return jsonify(error="The review reason must be 500 characters or fewer.", code="invalid_import_reason"), 400

        auth, _context = require_import_permission("review")
        batch = _import_batch_or_404(auth["access_token"], normalized_batch)
        require_import_permission("review", batch["module_key"])
        result = gateway.set_import_row_decision(
            auth["access_token"], normalized_batch, normalized_row, decision, reason
        )
        return jsonify(result)

    @app.post("/api/import/batches/<batch_id>/finalize")
    def finalize_import_batch(batch_id: str):
        normalized_batch = _validated_uuid(batch_id, "import batch")
        body = request.get_json(silent=True)
        row_ids = body.get("row_ids") if isinstance(body, dict) else None
        if not isinstance(row_ids, list) or not row_ids or len(row_ids) > 1000:
            return jsonify(error="Select between 1 and 1,000 reviewed rows for final import approval.", code="import_rows_required"), 400
        try:
            normalized_rows = list(dict.fromkeys(str(uuid.UUID(str(value))) for value in row_ids))
        except (TypeError, ValueError, AttributeError) as exc:
            return jsonify(error="One or more selected import row IDs are invalid.", code="invalid_import_row_id"), 400

        auth, _context = require_import_permission("import")
        batch = _import_batch_or_404(auth["access_token"], normalized_batch)
        require_import_permission("import", batch["module_key"])
        review_only_sources = {
            "product_entry": ("Product Entry", "product_entry_import_review_only"),
            "production_entry": ("Production Summary", "production_summary_import_review_only"),
        }
        module_key = batch["module_key"]
        destination = gateway.get_import_destination(auth["access_token"], module_key)
        contract_status = destination.get("contract_status")
        if contract_status == "hold_pending_business_rule":
            return jsonify(
                error="This destination is not open for final import yet. Its business-rule mapping must be approved first.",
                code="import_mapping_pending_business_rule",
            ), 409
        if contract_status != "approved":
            if module_key in review_only_sources:
                title, code = review_only_sources[module_key]
            else:
                title = destination.get("source_sheet_title") or module_key.replace("_", " ").title()
                code = "import_destination_review_only"
            return jsonify(
                error=f"{title} is available for source review in the Import Inbox. Operational approval is pending.",
                code=code,
            ), 409
        result = {}
        for start in range(0, len(normalized_rows), 1000):
            selected_ids = normalized_rows[start:start + 1000]
            if module_key == "dmr_coding":
                result = gateway.finalize_dmr_coding_import(
                    auth["access_token"], normalized_batch, selected_ids
                )
            elif module_key == "coding_dpr":
                result = gateway.finalize_coding_dpr_import(
                    auth["access_token"], normalized_batch, selected_ids
                )
            elif module_key in {"hourly_meat", "hourly_coding", "hourly_agri"}:
                result = gateway.finalize_hourly_production_import(
                    auth["access_token"], normalized_batch, selected_ids
                )
            else:
                result = gateway.finalize_import_batch(
                    auth["access_token"], normalized_batch, selected_ids
                )
        return jsonify(result)

    @app.get("/")
    def home():
        return redirect("/design/admin-login-preview.html", code=302)

    @app.get("/favicon.ico")
    def favicon():
        return ("", 204)

    @app.get("/app")
    def app_home():
        session_id = request.cookies.get("tfi_sid")
        try:
            auth = vault.get(session_id, gateway)
            context = gateway.get_access_context(auth["access_token"])
            allowed, _ = _valid_access_context(context)
            if allowed:
                return redirect("/design/dashboard-preview.html", code=302)
        except SupabaseError:
            pass
        return redirect("/design/admin-login-preview.html", code=302)

    @app.get("/auth/recovery")
    def password_recovery_callback():
        return send_from_directory(DESIGN_DIR, "password-reset.html")

    @app.get("/api/health")
    def health():
        result = gateway.health()
        return jsonify(
            status="ok",
            application="TFI_NEW",
            database_project=result["project"],
            connected=result["connected"],
        )

    @app.get("/api/dashboard/coverage")
    def dashboard_coverage():
        auth, context = require_dashboard_permission()
        summary = gateway.get_dashboard_coverage_summary(
            auth["access_token"],
            set(context.get("permissions") or []),
        )
        return jsonify(summary)

    @app.get("/api/dashboard/filter-catalog")
    def dashboard_filter_catalog():
        auth, context = require_dashboard_permission()
        permissions = set(context.get("permissions") or [])
        if "master_data.view" not in permissions:
            return jsonify(
                source="TFI2",
                status="restricted",
                options={},
                message="Dashboard filter lists require Master Data view permission.",
            )

        setup_rows = gateway.get_master_data_rows(auth["access_token"], "kpi_setup")
        code_rows = gateway.get_master_data_rows(auth["access_token"], "code_map")

        def source_values(rows, column_index, first_row, last_row=None):
            collected = []
            for row in sorted(rows, key=lambda item: int(item.get("source_row_number") or 0)):
                if row.get("record_status", "active") != "active" or row.get("row_kind") != "data":
                    continue
                try:
                    row_number = int(row.get("source_row_number") or 0)
                except (TypeError, ValueError):
                    continue
                if row_number < first_row or (last_row is not None and row_number > last_row):
                    continue
                values = row.get("current_values")
                if not isinstance(values, list) or column_index >= len(values):
                    continue
                value = values[column_index]
                if value is None:
                    continue
                text_value = str(value).strip()
                if text_value:
                    collected.append(text_value)
            return collected

        def unique_source_values(rows, column_index, first_row, last_row=None, include_all=False):
            result = []
            seen = set()
            for value in source_values(rows, column_index, first_row, last_row):
                key = value.casefold()
                if key == "all" and not include_all:
                    continue
                if key in seen:
                    continue
                seen.add(key)
                result.append(value)
            return result

        years = unique_source_values(setup_rows, 18, 2, 5)
        views = unique_source_values(setup_rows, 0, 2, 4)
        months = unique_source_values(setup_rows, 1, 2, 13)
        weeks = unique_source_values(setup_rows, 3, 2, 54)
        product_codes = unique_source_values(setup_rows, 4, 2, 129)
        machines = unique_source_values(setup_rows, 5, 3, 54)
        product_names = unique_source_values(setup_rows, 17, 2, 129)
        if not product_names:
            product_names = unique_source_values(code_rows, 1, 1)

        product_map = {}
        for row in code_rows:
            if row.get("record_status", "active") != "active" or row.get("row_kind") != "data":
                continue
            values = row.get("current_values")
            if not isinstance(values, list) or len(values) < 2:
                continue
            code = str(values[0] or "").strip()
            name = str(values[1] or "").strip()
            if code and name:
                product_map.setdefault(code, name)

        return jsonify(
            source="TFI2",
            status="available",
            options={
                "year": years,
                "view": views,
                "month": months,
                "week": weeks,
                "product_name": ["All", *product_names],
                "product_code": ["All", *product_codes],
                "machine": ["All", *machines],
            },
            product_map=product_map,
            source_reference={
                "sheet": "KPI Setup",
                "view": "A2:A4",
                "month": "B2:B13",
                "week": "D2:D54",
                "product_code": "E2:E129",
                "machine": "F3:F54",
                "product_name": "R2:R129",
                "year": "S2:S5",
            },
        )

    @app.get("/api/yield/log")
    def yield_log_records():
        auth, context = require_dashboard_permission()
        permissions = set(context.get("permissions") or [])
        if "product_entry.view" not in permissions:
            return jsonify(
                error="Product Entry view permission is required for the Yield Log.",
                code="yield_product_entry_view_required",
            ), 403
        if "master_data.view" not in permissions:
            return jsonify(
                error="Master Data view permission is required for the Yield Map.",
                code="yield_master_data_view_required",
            ), 403

        raw_from = str(request.args.get("date_from") or "").strip()
        raw_to = str(request.args.get("date_to") or "").strip()
        try:
            date_from = date.fromisoformat(raw_from).isoformat() if raw_from else None
            date_to = date.fromisoformat(raw_to).isoformat() if raw_to else None
        except ValueError:
            return jsonify(error="Yield Log dates must use YYYY-MM-DD format.", code="yield_date_invalid"), 400
        if date_from and date_to and date_from > date_to:
            return jsonify(error="Date From cannot be later than Date To.", code="yield_date_range_invalid"), 400

        try:
            limit = min(1000, max(1, int(request.args.get("limit", "100"))))
            offset = max(0, int(request.args.get("offset", "0")))
        except (TypeError, ValueError):
            return jsonify(error="Yield Log limit and offset must be whole numbers.", code="yield_pagination_invalid"), 400

        product_key = str(request.args.get("product_key") or "").strip() or None
        product_name = str(request.args.get("product_name") or "").strip() or None
        product_code = str(request.args.get("product_code") or "").strip() or None
        if product_key and len(product_key) > 120:
            return jsonify(error="Product selection is too long.", code="yield_product_invalid"), 400
        if product_name and len(product_name) > 160:
            return jsonify(error="Product selection is too long.", code="yield_product_invalid"), 400
        if product_code and len(product_code) > 100:
            return jsonify(error="Product Code is too long.", code="yield_product_code_invalid"), 400

        yield_map_rows = gateway.get_master_data_rows(auth["access_token"], "yield_map")
        setup_rows = gateway.get_master_data_rows(auth["access_token"], "kpi_setup")
        code_map_rows = gateway.get_master_data_rows(auth["access_token"], "code_map")
        try:
            yield_map = build_yield_map(yield_map_rows)
        except YieldCalculationError as exc:
            return jsonify(error=str(exc), code="yield_map_invalid"), 409
        if not yield_map:
            return jsonify(error="The Yield Map has no active product mappings.", code="yield_map_unavailable"), 409
        if product_name:
            mapped_codes = {
                str(row.get("current_values", [None])[0] or "").strip()
                for row in code_map_rows
                if row.get("record_status", "active") == "active"
                and row.get("row_kind") == "data"
                and isinstance(row.get("current_values"), list)
                and len(row["current_values"]) >= 2
                and str(row["current_values"][1] or "").strip().casefold() == product_name.casefold()
            }
            matching_keys = [
                key for key, item in yield_map.items()
                if mapped_codes.intersection(get_product_entry_block(item["block_key"])["product_codes"])
            ]
            if not matching_keys:
                matching_keys = [
                    key for key, item in yield_map.items()
                    if product_name.casefold() in (key.casefold(), item["display_title"].casefold())
                ]
            if len(matching_keys) != 1:
                return jsonify(error="Choose a product available in the current Yield Map.", code="yield_product_invalid"), 400
            if product_key and product_key != matching_keys[0]:
                return jsonify(error="Product Name and Product selection do not match.", code="yield_product_invalid"), 400
            product_key = matching_keys[0]
        if product_key and product_key not in yield_map:
            return jsonify(error="Choose a product available in the current Yield Map.", code="yield_product_invalid"), 400

        if product_key and product_code:
            block = get_product_entry_block(yield_map[product_key]["block_key"])
            if product_code not in block["product_codes"]:
                return jsonify(error="Product Code is not valid for the selected Yield Log product.", code="yield_product_code_invalid"), 400

        year = get_yield_year(setup_rows)
        if request.args.get("main_average") == "1":
            if not date_from or not date_to:
                return jsonify(error="Select a complete date range for the Yield average."), 400
            count = 0
            total = 0.0
            offset = 0
            page_size = 500
            while True:
                page = gateway.get_yield_log_source_records(
                    auth["access_token"], limit=page_size, offset=offset,
                    date_from=date_from, date_to=date_to, product_key=product_key, product_code=product_code,
                )
                for record in page:
                    average_input = calculate_main_yield(record, yield_map, date_from, date_to, year)
                    if average_input is not None:
                        total += average_input
                        count += 1
                if len(page) < page_size:
                    break
                offset += len(page)
            return jsonify(main_yield=total / count if count else None, eligible_rows=count, read_only=True)

        source_records = gateway.get_yield_log_source_records(
            auth["access_token"],
            limit=limit,
            offset=offset,
            date_from=date_from,
            date_to=date_to,
            product_key=product_key,
            product_code=product_code,
        )

        projected = []
        mayon_kaong_dates = []
        mayon_kaong_codes = set()
        for source_record in source_records:
            if source_record.get("block_key") == "BLK_36":
                record_data = source_record.get("record_data") or {}
                raw_date = source_record.get("production_date") or source_record.get("production_date_text") or record_data.get("A")
                parsed_date = parse_yield_date(raw_date, year)
                if parsed_date:
                    mayon_kaong_dates.append(parsed_date.isoformat())
                code = str(source_record.get("product_code") or record_data.get("B") or "").strip()
                if code:
                    mayon_kaong_codes.add(code)

        dmr_records = []
        if mayon_kaong_codes and mayon_kaong_dates:
            if "dmr_production.view" not in permissions:
                return jsonify(
                    error="DMR Production view permission is required for this Yield Log calculation.",
                    code="yield_dmr_view_required",
                ), 403
            dmr_from = date_from or min(mayon_kaong_dates)
            dmr_to = date_to or max(mayon_kaong_dates)
            for code in sorted(mayon_kaong_codes):
                dmr_offset = 0
                while dmr_offset < 5000:
                    dmr_page = gateway.get_dmr_production_records(
                        auth["access_token"],
                        limit=100,
                        offset=dmr_offset,
                        date_from=dmr_from,
                        date_to=dmr_to,
                        product_code=code,
                    )
                    dmr_records.extend(dmr_page)
                    if len(dmr_page) < 100:
                        break
                    dmr_offset += len(dmr_page)

        try:
            for source_record in source_records:
                item = build_yield_log_record(
                    source_record,
                    yield_map,
                    dmr_records=dmr_records,
                    year=year,
                )
                if item is None:
                    continue
                if date_from and item["production_date"] < date_from:
                    continue
                if date_to and item["production_date"] > date_to:
                    continue
                projected.append(item)
        except YieldCalculationError as exc:
            return jsonify(
                error="A source-mapped Yield Log formula could not be calculated.",
                code="yield_formula_error",
                detail=str(exc),
            ), 502

        projected.sort(key=lambda item: (item["production_date"], item.get("id") or ""), reverse=True)
        return jsonify(
            source="TFI2",
            calculation="source_yield_map_and_product_entry_formulas",
            records=projected,
            count=len(projected),
            limit=limit,
            offset=offset,
            has_more=len(source_records) == limit,
            mapped_products=len(yield_map),
            yield_map_note=get_yield_map_note(yield_map_rows),
            workbook_year=year,
            dmr_source_rows=len(dmr_records),
            read_only=True,
        )

    @app.get("/api/reports/removed-rows")
    def removed_rows_archive():
        auth, _context = require_operational_permission("production_entry")
        rows = gateway.get_removed_rows_archive(auth["access_token"])
        return jsonify(
            records=rows,
            captured_at=max((row["captured_at"] for row in rows), default=None),
            read_only=True,
        )

    @app.get("/api/reports/summary")
    def product_entry_summary():
        auth, context = require_operational_permission("production_entry")
        if "product_entry.view" not in (context.get("permissions") or []):
            return jsonify(error="Product Entry view permission is required for Summary."), 403
        try:
            offset = int(request.args.get("offset", "0"))
            if offset < 0:
                raise ValueError
        except ValueError:
            return jsonify(error="Summary offset must be a nonnegative whole number."), 400

        page_size = 250
        source_rows = gateway.get_yield_log_source_records(
            auth["access_token"], limit=page_size, offset=offset,
        )
        records = []
        for source in source_rows:
            row = project_summary_record(source)
            if row is not None:
                records.append(row)
        return jsonify(
            records=records,
            read_only=True,
            next_offset=offset + len(source_rows) if len(source_rows) == page_size else None,
        )

    @app.get("/api/dashboard/analytics")
    def dashboard_analytics():
        auth, _context = require_dashboard_permission()

        def optional_date(name: str):
            raw = str(request.args.get(name) or "").strip()
            if not raw:
                return None
            try:
                return date.fromisoformat(raw).isoformat()
            except ValueError:
                return None

        date_from = optional_date("date_from")
        date_to = optional_date("date_to")
        if request.args.get("date_from") and not date_from:
            return jsonify(error="Date From must use YYYY-MM-DD format.", code="dashboard_date_invalid"), 400
        if request.args.get("date_to") and not date_to:
            return jsonify(error="Date To must use YYYY-MM-DD format.", code="dashboard_date_invalid"), 400
        if date_from and date_to and date_from > date_to:
            return jsonify(error="Date From cannot be later than Date To.", code="dashboard_date_range_invalid"), 400

        def optional_filter(name: str, maximum: int):
            value = str(request.args.get(name) or "").strip()
            if not value or value.casefold() == "all":
                return None
            if len(value) > maximum:
                raise ValueError(name)
            return value

        try:
            filters = {
                "date_from": date_from,
                "date_to": date_to,
                "product_code": optional_filter("product_code", 100),
                "product_name": optional_filter("product_name", 160),
                "machine": optional_filter("machine", 200),
            }
        except ValueError:
            return jsonify(error="One or more dashboard filters are too long.", code="dashboard_filter_invalid"), 400

        period = str(request.args.get("period") or "").strip().lower()
        if period:
            try:
                prior_start, prior_end = previous_period(
                    period, date.fromisoformat(date_from or ""), date.fromisoformat(date_to or ""),
                )
            except (ValueError, OverflowError):
                return jsonify(error="Comparison requires a complete Daily, ISO Weekly, or Monthly period.",
                               code="dashboard_comparison_period_invalid"), 400

        analytics = gateway.get_dashboard_analytics(auth["access_token"], **filters)
        if period:
            comparison = {"date_from": prior_start.isoformat(), "date_to": prior_end.isoformat()}
            try:
                previous = gateway.get_dashboard_analytics(
                    auth["access_token"], **{**filters, **comparison},
                )
            except SupabaseError as exc:
                if exc.status_code in (401, 403):
                    raise
                comparison["status"] = "unavailable"
            else:
                comparison.update(status="available", metrics=compare_metrics(analytics, previous))
            analytics["previous_period"] = comparison
        permissions = set(_context.get("permissions") or [])
        summary_available = {"production_entry.view", "product_entry.view"}.issubset(permissions)
        summary = analytics.setdefault("reports", {}).setdefault("product_entry_summary", {})
        summary.update(status="implemented_read_only_projection" if summary_available else "restricted", read_only=True)
        summary["reason"] = (
            "Summary reads saved Product Entry records and calculates rejection percentages."
            if summary_available else "Summary requires permission to view Reports and Product Entry."
        )
        archive_available = "production_entry.view" in permissions
        analytics["reports"]["removed_rows"] = {
            "status": "available_read_only_archive" if archive_available else "restricted",
            "read_only": True,
        }
        readiness = analytics.get("readiness", {})
        if "pending_kpi_groups" in readiness:
            readiness["pending_kpi_groups"] = [
                name for name in readiness["pending_kpi_groups"]
                if name not in {"Product Entry Summary projection", "Removed Rows archive integration"}
            ]
        return jsonify(analytics)

    @app.post("/api/auth/recover")
    def request_password_recovery():
        body = request.get_json(silent=True) or {}
        email = str(body.get("email") or "").strip()
        if not email or "@" not in email or len(email) > 254:
            return jsonify(
                error="Enter the work email associated with your TFI account.",
                code="email_required",
            ), 400

        redirect_to = f"http://127.0.0.1:{settings.port}/auth/recovery"
        gateway.request_password_recovery(email, redirect_to)
        # Keep the response identical whether or not the address belongs to an account.
        return jsonify(
            message="If an active TFI account matches that email, password-reset instructions will be sent."
        ), 200

    @app.post("/api/auth/recovery/consume")
    def consume_password_recovery():
        body = request.get_json(silent=True) or {}
        access_token = body.get("access_token")
        flow_type = body.get("type")
        if flow_type != "recovery" or not isinstance(access_token, str) or len(access_token) < 20:
            return jsonify(
                error="This password-reset link is invalid. Request a new link.",
                code="recovery_invalid",
            ), 400

        user = gateway.get_auth_user(access_token)
        context = gateway.get_access_context(access_token)
        allowed, reason = _valid_access_context(context)
        profile = context.get("profile") if isinstance(context.get("profile"), dict) else {}
        if not allowed or str(profile.get("user_id") or "") != user["user_id"]:
            return jsonify(
                error=reason or "This account is not authorized to reset a TFI password.",
                code="recovery_not_authorized",
            ), 403

        recovery_id = secrets.token_urlsafe(32)
        recovery_vault.add(
            recovery_id,
            {
                "user_id": user["user_id"],
                "email": user["email"],
                "access_token": access_token,
            },
        )
        response = make_response(jsonify(email=user["email"], ready=True))
        response.set_cookie(
            "tfi_recovery",
            recovery_id,
            httponly=True,
            secure=False,
            samesite="Strict",
            max_age=600,
            path="/",
        )
        return response

    @app.post("/api/auth/recovery/update")
    def update_recovered_password():
        recovery_id = request.cookies.get("tfi_recovery")
        recovery = recovery_vault.get(recovery_id)
        body = request.get_json(silent=True) or {}
        new_password = body.get("new_password")
        if not isinstance(new_password, str) or len(new_password) < 12 or len(new_password) > 128:
            return jsonify(
                error="Use a password with 12 to 128 characters.",
                code="password_policy",
            ), 400

        gateway.update_password(recovery["access_token"], new_password)
        _safe_sign_out(gateway, recovery["access_token"])
        recovery_vault.remove(recovery_id)
        response = make_response(jsonify(password_updated=True))
        response.delete_cookie("tfi_recovery", path="/")
        return response

    @app.post("/api/auth/login")
    def login():
        body = request.get_json(silent=True) or {}
        email = str(body.get("email") or "").strip()
        password = body.get("password")
        if not email or "@" not in email or not isinstance(password, str) or not password:
            return jsonify(
                error="Enter your registered work email and password.",
                code="credentials_required",
            ), 400

        auth = gateway.sign_in_with_password(email, password)
        try:
            context = gateway.get_access_context(auth["access_token"])
        except SupabaseError:
            _safe_sign_out(gateway, auth.get("access_token"))
            raise

        allowed, reason = _valid_access_context(context)
        if not allowed:
            _safe_sign_out(gateway, auth.get("access_token"))
            status = context.get("profile", {}).get("account_status") if isinstance(context.get("profile"), dict) else None
            code = {
                "pending": "account_pending",
                "disabled": "account_disabled",
            }.get(status, "access_not_provisioned")
            return jsonify(error=reason, code=code), 403

        session_id = secrets.token_urlsafe(32)
        vault.add(session_id, auth)

        response = make_response(jsonify(
            profile=context["profile"],
            roles=context.get("roles", []),
            permissions=context.get("permissions", []),
        ))
        response.set_cookie(
            "tfi_sid",
            session_id,
            httponly=True,
            secure=False,  # Localhost desktop host uses loopback HTTP.
            samesite="Strict",
            path="/",
        )
        return response

    @app.get("/api/auth/me")
    def current_user():
        session_id = request.cookies.get("tfi_sid")
        auth = vault.get(session_id, gateway)
        context = gateway.get_access_context(auth["access_token"])
        allowed, reason = _valid_access_context(context)
        if not allowed:
            vault.remove(session_id)
            response = make_response(jsonify(error=reason, code="access_revoked"), 403)
            response.delete_cookie("tfi_sid", path="/")
            return response
        return jsonify(
            profile=context["profile"],
            roles=context.get("roles", []),
            permissions=context.get("permissions", []),
        )

    @app.post("/api/auth/logout")
    def logout():
        session_id = request.cookies.get("tfi_sid")
        try:
            auth = vault.get(session_id, gateway) if session_id else None
            if auth:
                _safe_sign_out(gateway, auth.get("access_token"))
        except SupabaseError:
            pass
        finally:
            vault.remove(session_id)
        response = make_response(jsonify(signed_out=True))
        response.delete_cookie("tfi_sid", path="/")
        return response

    @app.get("/api/master-data/categories")
    def master_data_categories():
        auth, context = require_master_data_permission("view")
        categories = gateway.get_master_data_categories(auth["access_token"])
        permissions = set(context.get("permissions") or [])
        return jsonify(
            categories=categories,
            permissions={
                "view": "master_data.view" in permissions,
                "edit": "master_data.edit" in permissions,
            },
        )

    @app.get("/api/master-data/<category_key>/rows")
    def master_data_rows(category_key: str):
        auth, _ = require_master_data_permission("view")
        if category_key not in MASTER_DATA_CATEGORIES:
            return jsonify(error="Unknown Master Data category.", code="invalid_category"), 404

        try:
            page = max(1, int(request.args.get("page", "1")))
            page_size = min(500, max(1, int(request.args.get("page_size", "100"))))
        except (TypeError, ValueError):
            return jsonify(error="Page and page size must be whole numbers.", code="invalid_pagination"), 400

        search = str(request.args.get("search") or "").strip().casefold()[:120]
        row_kind = str(request.args.get("row_kind") or "").strip()
        rows = gateway.get_master_data_rows(auth["access_token"], category_key)
        if row_kind:
            rows = [row for row in rows if row.get("row_kind") == row_kind]
        if search:
            rows = [
                row for row in rows
                if search in str(row.get("current_values") or []).casefold()
                or search in str(row.get("source_notes") or []).casefold()
            ]

        total = len(rows)
        pages = max(1, (total + page_size - 1) // page_size)
        page = min(page, pages)
        start = (page - 1) * page_size
        return jsonify(
            category_key=category_key,
            rows=rows[start:start + page_size],
            page=page,
            page_size=page_size,
            total=total,
            pages=pages,
        )

    @app.get("/api/master-data/rows/<row_id>/revisions")
    def master_data_row_revisions(row_id: str):
        auth, _ = require_master_data_permission("view")
        revisions = gateway.get_master_data_revisions(auth["access_token"], row_id)
        return jsonify(row_id=row_id, revisions=revisions)

    @app.patch("/api/master-data/rows/<row_id>")
    def update_master_data_row(row_id: str):
        auth, _ = require_master_data_permission("edit")
        body = request.get_json(silent=True)
        if not isinstance(body, dict):
            return jsonify(error="A JSON edit request is required.", code="invalid_request"), 400

        expected_version = body.get("expected_version")
        if isinstance(expected_version, bool) or not isinstance(expected_version, int) or expected_version < 1:
            return jsonify(error="The current record version is required.", code="expected_version_required"), 400

        changes = body.get("changes")
        if not isinstance(changes, dict) or not changes:
            return jsonify(error="Provide at least one field change.", code="changes_required"), 400

        change_reason = body.get("change_reason")
        if change_reason is not None and (not isinstance(change_reason, str) or len(change_reason) > 500):
            return jsonify(error="The change reason must be 500 characters or fewer.", code="invalid_change_reason"), 400

        row = gateway.get_master_data_row(auth["access_token"], row_id)
        try:
            normalized_changes = validate_master_data_changes(
                row["category_key"],
                changes,
                source_row_number=int(row["source_row_number"]),
                row_kind=str(row.get("row_kind") or ""),
                row_editable=bool(row.get("row_editable")),
            )
        except (MasterDataValidationError, KeyError, TypeError, ValueError) as exc:
            return jsonify(error=str(exc), code="master_data_invalid_change"), 400

        result = gateway.update_master_data_row(
            auth["access_token"],
            row_id,
            expected_version,
            normalized_changes,
            change_reason,
        )
        return jsonify(result)

    # Phase 5 — CO QA cost records, linked to stable Product Entry UUIDs ----
    @app.get("/api/co-qa/catalog")
    def co_qa_catalog():
        auth, context = require_operational_permission("co_qa", "view")
        source_catalog = get_co_qa_source_contract()
        product_entry_catalog = gateway.get_product_entry_catalog(auth["access_token"])
        projection_keys = set(source_catalog["projection_block_keys"])
        product_entry_catalog["blocks"] = [
            block for block in product_entry_catalog.get("blocks", [])
            if block.get("block_key") in projection_keys
        ]
        permissions = set(context.get("permissions") or [])
        return jsonify(
            catalog=source_catalog,
            product_entry_catalog=product_entry_catalog,
            permissions={
                "view": "co_qa.view" in permissions,
                "create": "co_qa.create" in permissions,
                "edit": "co_qa.edit" in permissions,
            },
        )

    @app.get("/api/co-qa/records")
    def co_qa_records():
        auth, context = require_operational_permission("co_qa", "view")
        if "product_entry.view" not in set(context.get("permissions") or []):
            return jsonify(error="Product Entry view permission is required for CO QA source records.", code="co_qa_product_entry_view_required"), 403
        block_key = str(request.args.get("block_key") or "").strip() or None
        block = None
        source_catalog = get_co_qa_source_contract()
        projection_keys = set(source_catalog["projection_block_keys"])
        if block_key:
            try:
                block = get_product_entry_block(block_key)
            except ProductEntryValidationError as exc:
                return jsonify(error=str(exc), code="co_qa_invalid_block"), 400
            if block_key not in projection_keys:
                return jsonify(error="The selected Product Entry block is not part of the original CO QA source formula.", code="co_qa_block_not_projected"), 400

        try:
            page = max(1, int(request.args.get("page", "1")))
            page_size = min(100, max(1, int(request.args.get("page_size", "50"))))
        except (TypeError, ValueError):
            return jsonify(error="Page and page size must be whole numbers.", code="invalid_pagination"), 400

        date_from = str(request.args.get("date_from") or "").strip() or None
        date_to = str(request.args.get("date_to") or "").strip() or None
        try:
            parsed_from = date.fromisoformat(date_from) if date_from else None
            parsed_to = date.fromisoformat(date_to) if date_to else None
        except ValueError:
            return jsonify(error="Date filters must use YYYY-MM-DD format.", code="invalid_date_filter"), 400
        if parsed_from and parsed_to and parsed_from > parsed_to:
            return jsonify(error="The start date cannot be later than the end date.", code="invalid_date_filter"), 400

        product_code = str(request.args.get("product_code") or "").strip() or None
        if block and product_code and product_code not in block["product_codes"]:
            return jsonify(error="Product Code is not valid for the selected block.", code="co_qa_invalid_product_code"), 400
        pr_number = str(request.args.get("pr_number") or "").strip() or None

        records = gateway.get_co_qa_records(
            auth["access_token"],
            block_key=block_key,
            block_keys=sorted(projection_keys) if not block_key else None,
            limit=page_size,
            offset=(page - 1) * page_size,
            date_from=parsed_from.isoformat() if parsed_from else None,
            date_to=parsed_to.isoformat() if parsed_to else None,
            product_code=product_code,
            pr_number=pr_number,
        )
        for record in records:
            record["qa_projection"] = project_co_qa_product_entry_record(record)
            record["qa_calculations"] = calculate_co_qa_formula_outputs(
                record["qa_projection"], record.get("costs")
            )
        return jsonify(
            records=records,
            page=page,
            page_size=page_size,
            has_more=len(records) == page_size,
        )

    @app.put("/api/co-qa/records/<record_id>/costs")
    def save_co_qa_costs(record_id: str):
        auth, _context = require_operational_permission("co_qa", "view")
        try:
            normalized_id = str(uuid.UUID(str(record_id)))
        except (TypeError, ValueError, AttributeError):
            return jsonify(error="The selected Product Entry record ID is invalid.", code="invalid_record_id"), 400

        body = request.get_json(silent=True)
        if not isinstance(body, dict):
            return jsonify(error="A JSON CO QA cost save request is required.", code="invalid_request"), 400
        expected_version = body.get("expected_version")
        if expected_version is not None and (
            isinstance(expected_version, bool)
            or not isinstance(expected_version, int)
            or expected_version < 0
        ):
            return jsonify(error="Expected version must be a non-negative whole number.", code="invalid_expected_version"), 400
        try:
            normalized_costs = normalize_co_qa_cost_changes(body.get("costs"))
        except ValueError as exc:
            return jsonify(error=str(exc), code="co_qa_invalid_costs"), 400

        change_reason = body.get("change_reason")
        if change_reason is not None and (
            not isinstance(change_reason, str) or len(change_reason) > 500
        ):
            return jsonify(error="The change reason must be 500 characters or fewer.", code="invalid_change_reason"), 400

        result = gateway.upsert_co_qa_cost_record(
            auth["access_token"],
            normalized_id,
            expected_version,
            normalized_costs,
            change_reason,
        )
        return jsonify(result), 201 if result.get("created") else 200

    @app.get("/api/co-qa/records/<record_id>/cost-revisions")
    def co_qa_cost_revisions(record_id: str):
        auth, context = require_operational_permission("co_qa", "view")
        if "product_entry.view" not in set(context.get("permissions") or []):
            return jsonify(error="Product Entry view permission is required for CO QA source records.", code="co_qa_product_entry_view_required"), 403
        try:
            normalized_id = str(uuid.UUID(str(record_id)))
        except (TypeError, ValueError, AttributeError):
            return jsonify(error="The selected Product Entry record ID is invalid.", code="invalid_record_id"), 400
        revisions = gateway.get_co_qa_cost_revisions(auth["access_token"], normalized_id)
        return jsonify(product_entry_record_id=normalized_id, revisions=revisions)

    # Phase 5 — Product Entry operational module ----------------------------
    @app.get("/api/product-entry/catalog")
    def product_entry_catalog():
        auth, context = require_operational_permission("product_entry", "view")
        catalog = gateway.get_product_entry_catalog(auth["access_token"])
        permissions = set(context.get("permissions") or [])
        return jsonify(
            catalog=catalog,
            permissions={
                "view": "product_entry.view" in permissions,
                "create": "product_entry.create" in permissions,
                "edit": "product_entry.edit" in permissions,
            },
        )

    @app.get("/api/product-entry/records")
    def product_entry_records():
        auth, _context = require_operational_permission("product_entry", "view")
        block_key = str(request.args.get("block_key") or "").strip()
        try:
            block = get_product_entry_block(block_key)
        except ProductEntryValidationError as exc:
            return jsonify(error=str(exc), code="product_entry_invalid_block"), 400

        try:
            page = max(1, int(request.args.get("page", "1")))
            page_size = min(100, max(1, int(request.args.get("page_size", "50"))))
        except (TypeError, ValueError):
            return jsonify(error="Page and page size must be whole numbers.", code="invalid_pagination"), 400

        date_from = str(request.args.get("date_from") or "").strip() or None
        date_to = str(request.args.get("date_to") or "").strip() or None
        try:
            parsed_from = date.fromisoformat(date_from) if date_from else None
            parsed_to = date.fromisoformat(date_to) if date_to else None
        except ValueError:
            return jsonify(error="Date filters must use YYYY-MM-DD format.", code="invalid_date_filter"), 400
        if parsed_from and parsed_to and parsed_from > parsed_to:
            return jsonify(error="The start date cannot be later than the end date.", code="invalid_date_filter"), 400

        product_code = str(request.args.get("product_code") or "").strip() or None
        if product_code and product_code not in block["product_codes"]:
            return jsonify(error="Product Code is not valid for the selected block.", code="product_entry_invalid_product_code"), 400
        pr_number = str(request.args.get("pr_number") or "").strip() or None
        review_status = str(request.args.get("review_status") or "").strip() or None
        if review_status and review_status not in block["review_options"]:
            return jsonify(error="Choose a valid review status.", code="product_entry_invalid_review_status"), 400

        records = gateway.get_product_entry_records(
            auth["access_token"],
            block_key=block_key,
            limit=page_size,
            offset=(page - 1) * page_size,
            date_from=parsed_from.isoformat() if parsed_from else None,
            date_to=parsed_to.isoformat() if parsed_to else None,
            product_code=product_code,
            pr_number=pr_number,
            review_status=review_status,
        )
        return jsonify(
            block_key=block_key,
            records=records,
            page=page,
            page_size=page_size,
            has_more=len(records) == page_size,
        )

    @app.post("/api/product-entry/records")
    def create_product_entry_records():
        auth, _context = require_operational_permission("product_entry", "create")
        body = request.get_json(silent=True)
        if not isinstance(body, dict):
            return jsonify(error="A JSON Product Entry save request is required.", code="invalid_request"), 400
        block_key = body.get("block_key")
        try:
            normalized = normalize_product_entry_records(block_key, body.get("records"))
        except ProductEntryValidationError as exc:
            return jsonify(error=str(exc), code="product_entry_invalid_request"), 400

        result = gateway.create_product_entry_records(
            auth["access_token"],
            str(block_key).strip(),
            [row["record_data"] for row in normalized],
        )
        status = 201 if int(result.get("inserted", 0)) > 0 else 200
        return jsonify(result), status

    @app.patch("/api/product-entry/records/<record_id>")
    def update_product_entry_record(record_id: str):
        auth, _context = require_operational_permission("product_entry", "edit")
        try:
            normalized_id = str(uuid.UUID(str(record_id)))
        except (TypeError, ValueError, AttributeError):
            return jsonify(error="The selected Product Entry record ID is invalid.", code="invalid_record_id"), 400

        body = request.get_json(silent=True)
        if not isinstance(body, dict):
            return jsonify(error="A JSON Product Entry edit request is required.", code="invalid_request"), 400
        expected_version = body.get("expected_version")
        if isinstance(expected_version, bool) or not isinstance(expected_version, int) or expected_version < 1:
            return jsonify(error="The current record version is required.", code="expected_version_required"), 400

        record = gateway.get_product_entry_record(auth["access_token"], normalized_id)
        if not record or record.get("record_status") != "active":
            return jsonify(error="The selected Product Entry record was not found.", code="product_entry_record_not_found"), 404

        try:
            normalized = normalize_product_entry_changes(record["block_key"], body.get("changes"))
        except (ProductEntryValidationError, KeyError, TypeError) as exc:
            return jsonify(error=str(exc), code="product_entry_invalid_request"), 400

        change_reason = body.get("change_reason")
        if change_reason is not None and (not isinstance(change_reason, str) or len(change_reason) > 500):
            return jsonify(error="The change reason must be 500 characters or fewer.", code="invalid_change_reason"), 400

        result = gateway.update_product_entry_record(
            auth["access_token"],
            normalized_id,
            expected_version,
            normalized["changes"],
            change_reason,
        )
        return jsonify(result)

    @app.get("/api/product-entry/records/<record_id>/revisions")
    def product_entry_record_revisions(record_id: str):
        auth, _context = require_operational_permission("product_entry", "view")
        try:
            normalized_id = str(uuid.UUID(str(record_id)))
        except (TypeError, ValueError, AttributeError):
            return jsonify(error="The selected Product Entry record ID is invalid.", code="invalid_record_id"), 400
        revisions = gateway.get_product_entry_revisions(auth["access_token"], normalized_id)
        return jsonify(record_id=normalized_id, revisions=revisions)

    # Phase 5 — Production Entry + Production Summary -----------------------
    @app.get("/api/production-entry/catalog")
    def production_entry_catalog():
        auth, context = require_operational_permission("production_entry", "view")
        catalog = gateway.get_production_entry_catalog(auth["access_token"])
        permissions = set(context.get("permissions") or [])
        return jsonify(
            catalog=catalog,
            permissions={
                "view": "production_entry.view" in permissions,
                "create": "production_entry.create" in permissions,
                "edit": "production_entry.edit" in permissions,
            },
        )

    @app.get("/api/production-entry/summary")
    def production_entry_summary():
        auth, _context = require_operational_permission("production_entry", "view")
        return jsonify(summary=gateway.get_production_entry_summary(auth["access_token"]))

    @app.get("/api/production-entry/records")
    def production_entry_records():
        auth, _context = require_operational_permission("production_entry", "view")
        try:
            page = max(1, int(request.args.get("page", "1")))
            page_size = min(100, max(1, int(request.args.get("page_size", "10"))))
        except (TypeError, ValueError):
            return jsonify(error="Page and page size must be whole numbers.", code="invalid_pagination"), 400

        date_from = str(request.args.get("date_from") or "").strip() or None
        date_to = str(request.args.get("date_to") or "").strip() or None
        try:
            parsed_from = date.fromisoformat(date_from) if date_from else None
            parsed_to = date.fromisoformat(date_to) if date_to else None
        except ValueError:
            return jsonify(error="Date filters must use YYYY-MM-DD format.", code="invalid_date_filter"), 400
        if parsed_from and parsed_to and parsed_from > parsed_to:
            return jsonify(error="The start date cannot be later than the end date.", code="invalid_date_filter"), 400

        line = str(request.args.get("line") or "").strip() or None
        if line and line not in {"Agri", "Meat", "Finishing"}:
            return jsonify(error="Choose a valid Production Entry line.", code="production_entry_invalid_line"), 400

        product_name = str(request.args.get("product_name") or "").strip()[:200] or None
        product_code = str(request.args.get("product_code") or "").strip()[:100] or None

        sort_key = str(request.args.get("sort") or "date").strip()
        sort_direction = str(request.args.get("direction") or "desc").strip().lower()
        allowed_sort_keys = {
            "date", "line", "productName", "productCode", "batches", "target",
            "produced", "uom", "attainment", "planStart", "actualStart", "planEnd",
            "actualEndProd", "actualEndCleaning", "manReqmt", "present", "absent",
            "attendance", "otHrs", "remarks", "savedOn", "check", "hasData", "dayHasData",
        }
        if sort_key not in allowed_sort_keys:
            sort_key = "date"
        if sort_direction not in {"asc", "desc"}:
            sort_direction = "desc"

        result = gateway.get_production_entry_records(
            auth["access_token"],
            date_from=parsed_from.isoformat() if parsed_from else None,
            date_to=parsed_to.isoformat() if parsed_to else None,
            line=line,
            product_name=product_name,
            product_code=product_code,
            search=str(request.args.get("search") or "").strip()[:120] or None,
            page=page,
            page_size=page_size,
            sort_key=sort_key,
            sort_direction=sort_direction,
        )
        total = int(result.get("total", 0))
        pages = max(1, (total + page_size - 1) // page_size)
        return jsonify(
            records=result.get("records") or [],
            total=total,
            page=page,
            page_size=page_size,
            pages=pages,
            has_more=page < pages,
        )

    @app.post("/api/production-entry/records")
    def create_production_entry_records():
        auth, _context = require_operational_permission("production_entry", "create")
        body = request.get_json(silent=True)
        if not isinstance(body, dict):
            return jsonify(error="A JSON Production Entry save request is required.", code="invalid_request"), 400
        try:
            normalized = normalize_production_entry_records(body.get("records"))
        except ProductionEntryValidationError as exc:
            return jsonify(error=str(exc), code="production_entry_invalid_request"), 400

        result = gateway.create_production_entry_records(
            auth["access_token"],
            [
                {"source_row_number": row["source_row_number"], "record_data": row["input_data"]}
                for row in normalized
            ],
        )
        status = 201 if int(result.get("inserted", 0)) > 0 else 200
        return jsonify(result), status

    @app.patch("/api/production-entry/records/<record_id>")
    def update_production_entry_record(record_id: str):
        auth, _context = require_operational_permission("production_entry", "edit")
        try:
            normalized_id = str(uuid.UUID(str(record_id)))
        except (TypeError, ValueError, AttributeError):
            return jsonify(error="The selected Production Entry record ID is invalid.", code="invalid_record_id"), 400

        body = request.get_json(silent=True)
        if not isinstance(body, dict):
            return jsonify(error="A JSON Production Entry edit request is required.", code="invalid_request"), 400
        expected_version = body.get("expected_version")
        if isinstance(expected_version, bool) or not isinstance(expected_version, int) or expected_version < 1:
            return jsonify(error="The current record version is required.", code="expected_version_required"), 400

        record = gateway.get_production_entry_record(auth["access_token"], normalized_id)
        if not record or record.get("record_status") != "active":
            return jsonify(error="The selected Production Entry record was not found.", code="production_entry_record_not_found"), 404

        try:
            normalized = normalize_production_entry_changes(
                record["record_data"],
                int(record["source_row_number"]),
                body.get("changes"),
            )
        except (ProductionEntryValidationError, KeyError, TypeError, ValueError) as exc:
            return jsonify(error=str(exc), code="production_entry_invalid_request"), 400

        change_reason = body.get("change_reason")
        if change_reason is not None and (not isinstance(change_reason, str) or len(change_reason) > 500):
            return jsonify(error="The change reason must be 500 characters or fewer.", code="invalid_change_reason"), 400

        result = gateway.update_production_entry_record(
            auth["access_token"],
            normalized_id,
            expected_version,
            normalized["changes"],
            change_reason,
        )
        return jsonify(result)

    @app.get("/api/production-entry/records/<record_id>/revisions")
    def production_entry_record_revisions(record_id: str):
        auth, _context = require_operational_permission("production_entry", "view")
        try:
            normalized_id = str(uuid.UUID(str(record_id)))
        except (TypeError, ValueError, AttributeError):
            return jsonify(error="The selected Production Entry record ID is invalid.", code="invalid_record_id"), 400
        revisions = gateway.get_production_entry_revisions(auth["access_token"], normalized_id)
        return jsonify(record_id=normalized_id, revisions=revisions)

    # Phase 5 — Production Schedule + Schedule Summary ----------------------
    @app.get("/api/production-schedule/catalog")
    def production_schedule_catalog():
        auth, context = require_operational_permission("production_schedule", "view")
        catalog = gateway.get_production_schedule_catalog(auth["access_token"])
        permissions = set(context.get("permissions") or [])
        return jsonify(
            catalog=catalog,
            permissions={
                "view": "production_schedule.view" in permissions,
                "create": "production_schedule.create" in permissions,
                "edit": "production_schedule.edit" in permissions,
            },
        )

    @app.get("/api/production-schedule/summary")
    def production_schedule_summary():
        auth, _context = require_operational_permission("production_schedule", "view")
        return jsonify(summary=gateway.get_production_schedule_summary(auth["access_token"]))

    @app.get("/api/production-schedule/forms")
    def production_schedule_form_by_date():
        auth, _context = require_operational_permission("production_schedule", "view")
        raw_date = str(request.args.get("date") or "").strip()
        try:
            production_date = date.fromisoformat(raw_date)
        except ValueError:
            return jsonify(
                error="A production date in YYYY-MM-DD format is required.",
                code="invalid_production_date",
            ), 400
        result = gateway.get_production_schedule_form_by_date(
            auth["access_token"], production_date.isoformat()
        )
        return jsonify(form=result.get("form"))

    @app.get("/api/production-schedule/records")
    def production_schedule_records():
        auth, _context = require_operational_permission("production_schedule", "view")
        try:
            page = max(1, int(request.args.get("page", "1")))
            page_size = min(100, max(1, int(request.args.get("page_size", "10"))))
        except (TypeError, ValueError):
            return jsonify(
                error="Page and page size must be whole numbers.",
                code="invalid_pagination",
            ), 400

        date_from = str(request.args.get("date_from") or "").strip() or None
        date_to = str(request.args.get("date_to") or "").strip() or None
        try:
            parsed_from = date.fromisoformat(date_from) if date_from else None
            parsed_to = date.fromisoformat(date_to) if date_to else None
        except ValueError:
            return jsonify(
                error="Date filters must use YYYY-MM-DD format.",
                code="invalid_date_filter",
            ), 400
        if parsed_from and parsed_to and parsed_from > parsed_to:
            return jsonify(
                error="The start date cannot be later than the end date.",
                code="invalid_date_filter",
            ), 400

        sort_key = str(request.args.get("sort") or "date").strip()
        allowed_sort_keys = {
            "date", "day", "line", "area", "product_name", "production_code",
            "batches", "target", "revised_target", "um", "quantity_tins",
            "quantity_box", "required_pax", "pr_number", "remarks", "fc_idc_ref",
            "shift_hours", "available_pax_day", "saved_on",
        }
        if sort_key not in allowed_sort_keys:
            sort_key = "date"
        sort_direction = str(request.args.get("direction") or "desc").strip().lower()
        if sort_direction not in {"asc", "desc"}:
            sort_direction = "desc"

        result = gateway.get_production_schedule_records(
            auth["access_token"],
            date_from=parsed_from.isoformat() if parsed_from else None,
            date_to=parsed_to.isoformat() if parsed_to else None,
            day=str(request.args.get("day") or "").strip()[:20] or None,
            line=str(request.args.get("line") or "").strip() or None,
            area=str(request.args.get("area") or "").strip() or None,
            product_name=str(request.args.get("product_name") or "").strip()[:200] or None,
            production_code=str(request.args.get("production_code") or "").strip()[:100] or None,
            pr_number=str(request.args.get("pr_number") or "").strip()[:120] or None,
            search=str(request.args.get("search") or "").strip()[:120] or None,
            page=page,
            page_size=page_size,
            sort_key=sort_key,
            sort_direction=sort_direction,
        )
        total = int(result.get("total", 0))
        pages = max(1, (total + page_size - 1) // page_size)
        return jsonify(
            records=result.get("records") or [],
            total=total,
            page=page,
            page_size=page_size,
            pages=pages,
            has_more=page < pages,
        )

    @app.post("/api/production-schedule/forms")
    def create_production_schedule_form():
        auth, _context = require_operational_permission("production_schedule", "create")
        body = request.get_json(silent=True)
        if not isinstance(body, dict):
            return jsonify(
                error="A JSON Production Schedule save request is required.",
                code="invalid_request",
            ), 400
        try:
            catalog = gateway.get_production_schedule_catalog(auth["access_token"])
            normalized = normalize_production_schedule_form(body, catalog)
        except ProductionScheduleValidationError as exc:
            return jsonify(error=str(exc), code="production_schedule_invalid_request"), 400

        result = gateway.create_production_schedule_form(
            auth["access_token"],
            normalized["production_date"],
            normalized["available_pax_total"],
            normalized["rows"],
        )
        return jsonify(result), 201

    @app.patch("/api/production-schedule/forms/<form_id>")
    def update_production_schedule_form(form_id: str):
        auth, _context = require_operational_permission("production_schedule", "edit")
        try:
            normalized_id = str(uuid.UUID(str(form_id)))
        except (TypeError, ValueError, AttributeError):
            return jsonify(
                error="The selected Production Schedule form ID is invalid.",
                code="invalid_form_id",
            ), 400

        body = request.get_json(silent=True)
        if not isinstance(body, dict):
            return jsonify(
                error="A JSON Production Schedule edit request is required.",
                code="invalid_request",
            ), 400
        if set(body) - {
            "expected_version", "production_date", "available_pax_total", "rows", "change_reason"
        }:
            return jsonify(
                error="The Production Schedule edit request contains unsupported fields.",
                code="production_schedule_invalid_request",
            ), 400
        expected_version = body.get("expected_version")
        if isinstance(expected_version, bool) or not isinstance(expected_version, int) or expected_version < 1:
            return jsonify(
                error="The current form version is required.",
                code="expected_version_required",
            ), 400
        change_reason = body.get("change_reason")
        if change_reason is not None and (
            not isinstance(change_reason, str) or len(change_reason) > 500
        ):
            return jsonify(
                error="The change reason must be 500 characters or fewer.",
                code="invalid_change_reason",
            ), 400

        form_body = {
            key: body[key]
            for key in ("production_date", "available_pax_total", "rows")
            if key in body
        }
        try:
            catalog = gateway.get_production_schedule_catalog(auth["access_token"])
            normalized = normalize_production_schedule_form(form_body, catalog)
        except ProductionScheduleValidationError as exc:
            return jsonify(error=str(exc), code="production_schedule_invalid_request"), 400

        result = gateway.update_production_schedule_form(
            auth["access_token"],
            normalized_id,
            expected_version,
            normalized["production_date"],
            normalized["available_pax_total"],
            normalized["rows"],
            change_reason,
        )
        return jsonify(result)

    @app.get("/api/production-schedule/forms/<form_id>/revisions")
    def production_schedule_form_revisions(form_id: str):
        auth, _context = require_operational_permission("production_schedule", "view")
        try:
            normalized_id = str(uuid.UUID(str(form_id)))
        except (TypeError, ValueError, AttributeError):
            return jsonify(
                error="The selected Production Schedule form ID is invalid.",
                code="invalid_form_id",
            ), 400
        revisions = gateway.get_production_schedule_revisions(
            auth["access_token"], normalized_id
        )
        return jsonify(form_id=normalized_id, revisions=revisions)

    # Phase 5 — first operational module: DMP Production -------------------
    # DMP import: save every eligible operational row directly to the live module
    @app.post("/api/dmp-production/import-batches/<batch_id>/save-all")
    def save_all_dmp_import_batch(batch_id: str):
        normalized_batch = _validated_uuid(batch_id, "DMP import batch")
        auth, _context = require_import_permission("import", "dmp_production")
        batch = _import_batch_or_404(auth["access_token"], normalized_batch)
        if batch.get("module_key") != "dmp_production":
            return jsonify(error="The selected batch is not mapped to DMP Production.", code="wrong_import_destination"), 409
        destination = gateway.get_import_destination(auth["access_token"], "dmp_production")
        if destination.get("contract_status") != "approved":
            return jsonify(
                error="DMP Production is not approved for operational imports. Review the source mapping first.",
                code="import_destination_not_approved",
            ), 409
        result = gateway.save_all_dmp_import_batch(auth["access_token"], normalized_batch)
        return jsonify(result)

    # DMP import Draft -> Review -> Approval workflow (for rows needing classification review)
    @app.post("/api/dmp-production/import-drafts/prepare")
    def prepare_dmp_import_drafts():
        body = request.get_json(silent=True)
        row_ids = body.get("row_ids") if isinstance(body, dict) else None
        if not isinstance(row_ids, list) or not row_ids or len(row_ids) > 1000:
            return jsonify(error="Select between 1 and 1,000 eligible DMP rows.", code="dmp_draft_rows_required"), 400
        try:
            normalized_ids = list(dict.fromkeys(str(uuid.UUID(str(value))) for value in row_ids))
        except (TypeError, ValueError, AttributeError):
            return jsonify(error="One or more selected import row IDs are invalid.", code="invalid_import_row_id"), 400
        auth, _context = require_import_permission("create", "dmp_production")
        result = gateway.prepare_dmp_import_drafts(auth["access_token"], normalized_ids)
        return jsonify(result), 201

    @app.get("/api/dmp-production/import-drafts")
    def get_dmp_import_drafts():
        auth, _context = require_operational_permission("dmp_production", "view")
        status = str(request.args.get("status") or "").strip() or None
        try:
            limit = min(500, max(1, int(request.args.get("limit", "100"))))
            offset = max(0, int(request.args.get("offset", "0")))
        except (TypeError, ValueError):
            return jsonify(error="Draft limit and offset must be whole numbers.", code="invalid_dmp_draft_pagination"), 400
        result = gateway.get_dmp_import_drafts(auth["access_token"], status=status, limit=limit, offset=offset)
        return jsonify(result)

    @app.patch("/api/dmp-production/import-drafts/<draft_id>")
    def update_dmp_import_draft(draft_id: str):
        try:
            normalized_id = str(uuid.UUID(str(draft_id)))
        except (TypeError, ValueError, AttributeError):
            return jsonify(error="The selected DMP draft ID is invalid.", code="invalid_dmp_draft_id"), 400
        body = request.get_json(silent=True)
        if not isinstance(body, dict):
            return jsonify(error="A JSON DMP draft update is required.", code="invalid_dmp_draft_request"), 400
        expected_version = body.get("expected_version")
        if isinstance(expected_version, bool) or not isinstance(expected_version, int) or expected_version < 1:
            return jsonify(error="The current draft version is required.", code="expected_version_required"), 400
        values = body.get("values")
        if not isinstance(values, dict) or not values:
            return jsonify(error="Provide at least one DMP field to update.", code="dmp_draft_values_required"), 400
        classification = body.get("classification")
        if classification is not None and not isinstance(classification, str):
            return jsonify(error="Draft classification must be text.", code="invalid_dmp_draft_classification"), 400
        auth, _context = require_operational_permission("dmp_production", "edit")
        result = gateway.update_dmp_import_draft(
            auth["access_token"], normalized_id, expected_version, values, classification
        )
        return jsonify(result)

    @app.post("/api/dmp-production/import-drafts/<draft_id>/approve")
    def approve_dmp_import_draft(draft_id: str):
        try:
            normalized_id = str(uuid.UUID(str(draft_id)))
        except (TypeError, ValueError, AttributeError):
            return jsonify(error="The selected DMP draft ID is invalid.", code="invalid_dmp_draft_id"), 400
        body = request.get_json(silent=True)
        if not isinstance(body, dict):
            return jsonify(error="A JSON DMP draft approval is required.", code="invalid_dmp_draft_request"), 400
        expected_version = body.get("expected_version")
        if isinstance(expected_version, bool) or not isinstance(expected_version, int) or expected_version < 1:
            return jsonify(error="The current draft version is required.", code="expected_version_required"), 400
        auth, _context = require_operational_permission("dmp_production", "approve")
        result = gateway.approve_dmp_import_draft(auth["access_token"], normalized_id, expected_version)
        return jsonify(result)

    @app.get("/api/dmp-production/options")
    def dmp_production_options():
        auth, _context = require_operational_permission("dmp_production", "view")
        return jsonify(options=gateway.get_dmp_production_options(auth["access_token"]))

    @app.get("/api/dmp-production/summary")
    def dmp_production_summary():
        auth, _context = require_operational_permission("dmp_production", "view")
        date_from = str(request.args.get("date_from") or "").strip() or None
        date_to = str(request.args.get("date_to") or "").strip() or None
        try:
            parsed_from = date.fromisoformat(date_from) if date_from else None
            parsed_to = date.fromisoformat(date_to) if date_to else None
        except ValueError:
            return jsonify(error="Date filters must use YYYY-MM-DD format.", code="invalid_date_filter"), 400
        if parsed_from and parsed_to and parsed_from > parsed_to:
            return jsonify(error="The start date cannot be later than the end date.", code="invalid_date_filter"), 400
        summary = gateway.get_dmp_production_summary(
            auth["access_token"],
            date_from=parsed_from.isoformat() if parsed_from else None,
            date_to=parsed_to.isoformat() if parsed_to else None,
        )
        return jsonify(summary=summary)
    @app.get("/api/dmp-production/records")
    def dmp_production_records():
        auth, _context = require_operational_permission("dmp_production", "view")
        try:
            page = max(1, int(request.args.get("page", "1")))
            page_size = min(100, max(1, int(request.args.get("page_size", "50"))))
        except (TypeError, ValueError):
            return jsonify(error="Page and page size must be whole numbers.", code="invalid_pagination"), 400

        date_from = str(request.args.get("date_from") or "").strip() or None
        date_to = str(request.args.get("date_to") or "").strip() or None
        try:
            parsed_from = date.fromisoformat(date_from) if date_from else None
            parsed_to = date.fromisoformat(date_to) if date_to else None
        except ValueError:
            return jsonify(error="Date filters must use YYYY-MM-DD format.", code="invalid_date_filter"), 400
        if parsed_from and parsed_to and parsed_from > parsed_to:
            return jsonify(error="The start date cannot be later than the end date.", code="invalid_date_filter"), 400

        records = gateway.get_dmp_production_records(
            auth["access_token"],
            limit=page_size,
            offset=(page - 1) * page_size,
            date_from=parsed_from.isoformat() if parsed_from else None,
            date_to=parsed_to.isoformat() if parsed_to else None,
        )
        return jsonify(
            records=records,
            page=page,
            page_size=page_size,
            has_more=len(records) == page_size,
        )

    @app.post("/api/dmp-production/records")
    def create_dmp_production_records():
        auth, _context = require_operational_permission("dmp_production", "create")
        body = request.get_json(silent=True)
        if not isinstance(body, dict):
            return jsonify(error="A JSON DMP Production save request is required.", code="invalid_request"), 400
        try:
            records = normalize_dmp_production_records(body.get("records"))
        except DmpProductionValidationError as exc:
            return jsonify(error=str(exc), code="dmp_production_invalid_request"), 400
        result = gateway.create_dmp_production_records(auth["access_token"], records)
        status = 201 if int(result.get("inserted", 0)) > 0 else 200
        return jsonify(result), status

    @app.patch("/api/dmp-production/records/<record_id>")
    def update_dmp_production_record(record_id: str):
        auth, _context = require_operational_permission("dmp_production", "edit")
        try:
            normalized_id = str(uuid.UUID(str(record_id)))
        except (TypeError, ValueError, AttributeError):
            return jsonify(error="The selected DMP Production record ID is invalid.", code="invalid_record_id"), 400
        body = request.get_json(silent=True)
        if not isinstance(body, dict):
            return jsonify(error="A JSON DMP Production edit request is required.", code="invalid_request"), 400
        expected_version = body.get("expected_version")
        if isinstance(expected_version, bool) or not isinstance(expected_version, int) or expected_version < 1:
            return jsonify(error="The current record version is required.", code="expected_version_required"), 400
        try:
            changes = normalize_dmp_production_changes(body.get("changes"))
        except DmpProductionValidationError as exc:
            return jsonify(error=str(exc), code="dmp_production_invalid_request"), 400
        change_reason = body.get("change_reason")
        if change_reason is not None and (not isinstance(change_reason, str) or len(change_reason) > 500):
            return jsonify(error="The change reason must be 500 characters or fewer.", code="invalid_change_reason"), 400
        result = gateway.update_dmp_production_record(
            auth["access_token"], normalized_id, expected_version, changes, change_reason
        )
        return jsonify(result)

    @app.get("/api/dmp-production/records/<record_id>/revisions")
    def dmp_production_record_revisions(record_id: str):
        auth, _context = require_operational_permission("dmp_production", "view")
        try:
            normalized_id = str(uuid.UUID(str(record_id)))
        except (TypeError, ValueError, AttributeError):
            return jsonify(error="The selected DMP Production record ID is invalid.", code="invalid_record_id"), 400
        revisions = gateway.get_dmp_production_revisions(auth["access_token"], normalized_id)
        return jsonify(record_id=normalized_id, revisions=revisions)









    # Phase 5 ? OEE manual operational CRUD on existing import-aware table --
    @app.get("/api/oee/catalog")
    def oee_catalog():
        auth, context = require_operational_permission("oee", "view")
        reference_data = gateway.get_oee_catalog(auth["access_token"])
        catalog = get_oee_catalog(reference_data)
        permissions = set(context.get("permissions") or [])
        return jsonify(
            catalog=catalog,
            permissions={
                "view": "oee.view" in permissions,
                "create": "oee.create" in permissions,
                "edit": "oee.edit" in permissions,
                "submit": "oee.submit" in permissions,
                "approve": "oee.approve" in permissions,
                "review": "oee.review" in permissions,
            },
        )

    @app.get("/api/oee/records")
    def oee_records():
        auth, _context = require_operational_permission("oee", "view")
        try:
            page = max(1, int(request.args.get("page", "1")))
            page_size = min(100, max(1, int(request.args.get("page_size", "100"))))
        except (TypeError, ValueError):
            return jsonify(error="Page and page size must be whole numbers.", code="invalid_pagination"), 400
        date_from = str(request.args.get("date_from") or "").strip() or None
        date_to = str(request.args.get("date_to") or "").strip() or None
        try:
            parsed_from = date.fromisoformat(date_from) if date_from else None
            parsed_to = date.fromisoformat(date_to) if date_to else None
        except ValueError:
            return jsonify(error="Date filters must use YYYY-MM-DD format.", code="invalid_date_filter"), 400
        if parsed_from and parsed_to and parsed_from > parsed_to:
            return jsonify(error="The start date cannot be later than the end date.", code="invalid_date_filter"), 400
        result = gateway.get_oee_records(
            auth["access_token"],
            date_from=parsed_from.isoformat() if parsed_from else None,
            date_to=parsed_to.isoformat() if parsed_to else None,
            machine=str(request.args.get("machine") or "").strip() or None,
            line=str(request.args.get("line") or "").strip() or None,
            product_code=str(request.args.get("product_code") or "").strip() or None,
            search=str(request.args.get("search") or "").strip() or None,
            page=page, page_size=page_size,
        )
        return jsonify(result)

    @app.post("/api/oee/records")
    def create_oee_records():
        auth, _context = require_operational_permission("oee", "create")
        body = request.get_json(silent=True)
        if not isinstance(body, dict):
            return jsonify(error="A JSON OEE save request is required.", code="invalid_request"), 400
        reference_data = gateway.get_oee_catalog(auth["access_token"])
        catalog = get_oee_catalog(reference_data)
        try:
            records = normalize_oee_records(body.get("records"), catalog)
        except OeeValidationError as exc:
            return jsonify(error=str(exc), code="oee_invalid_request"), 400
        result = gateway.create_oee_records(
            auth["access_token"],
            [{"row_index": row["row_index"], "record_data": row["record_data"]} for row in records],
        )
        return jsonify(result), 201 if int(result.get("inserted", 0)) > 0 else 200

    @app.patch("/api/oee/records/<record_id>")
    def update_oee_record(record_id: str):
        auth, _context = require_operational_permission("oee", "edit")
        try:
            normalized_id = str(uuid.UUID(str(record_id)))
        except (TypeError, ValueError, AttributeError):
            return jsonify(error="The selected OEE record ID is invalid.", code="invalid_record_id"), 400
        body = request.get_json(silent=True)
        if not isinstance(body, dict):
            return jsonify(error="A JSON OEE edit request is required.", code="invalid_request"), 400
        expected_version = body.get("expected_version")
        if isinstance(expected_version, bool) or not isinstance(expected_version, int) or expected_version < 1:
            return jsonify(error="The current record version is required.", code="expected_version_required"), 400
        record = gateway.get_oee_record(auth["access_token"], normalized_id)
        if not record or record.get("record_status") != "active":
            return jsonify(error="The selected OEE record was not found.", code="oee_record_not_found"), 404
        reference_data = gateway.get_oee_catalog(auth["access_token"])
        catalog = get_oee_catalog(reference_data)
        try:
            normalized = normalize_oee_changes(record, body.get("changes"), catalog)
        except OeeValidationError as exc:
            return jsonify(error=str(exc), code="oee_invalid_request"), 400
        if not normalized["changes"]:
            return jsonify(changed=False, id=normalized_id, version=expected_version)
        change_reason = body.get("change_reason")
        if change_reason is not None and (not isinstance(change_reason, str) or len(change_reason) > 500):
            return jsonify(error="The change reason must be 500 characters or fewer.", code="invalid_change_reason"), 400
        result = gateway.update_oee_record(
            auth["access_token"], normalized_id, expected_version, normalized["changes"], change_reason
        )
        return jsonify(result)

    @app.get("/api/oee/records/<record_id>/revisions")
    def oee_record_revisions(record_id: str):
        auth, _context = require_operational_permission("oee", "view")
        try:
            normalized_id = str(uuid.UUID(str(record_id)))
        except (TypeError, ValueError, AttributeError):
            return jsonify(error="The selected OEE record ID is invalid.", code="invalid_record_id"), 400
        record = gateway.get_oee_record(auth["access_token"], normalized_id)
        if not record:
            return jsonify(error="The selected OEE record was not found.", code="oee_record_not_found"), 404
        revisions = gateway.get_oee_revisions(auth["access_token"], normalized_id)
        return jsonify(record_id=normalized_id, revisions=revisions)

    # Phase 5 — Productivity source-aligned operational workflow ------------
    @app.get("/api/productivity/catalog")
    def productivity_catalog():
        auth, context = require_operational_permission("productivity", "view")
        catalog = gateway.get_productivity_catalog(auth["access_token"])
        permissions = set(context.get("permissions") or [])
        return jsonify(
            catalog=catalog,
            permissions={
                "view": "productivity.view" in permissions,
                "create": "productivity.create" in permissions,
                "edit": "productivity.edit" in permissions,
            },
        )

    @app.post("/api/productivity/preview")
    def productivity_preview():
        auth, _context = require_operational_permission("productivity", "view")
        body = request.get_json(silent=True)
        if not isinstance(body, dict):
            return jsonify(error="A JSON Productivity preview request is required.", code="invalid_request"), 400
        try:
            record_data = normalize_productivity_preview(body.get("record_data"))
        except ProductivityValidationError as exc:
            return jsonify(error=str(exc), code="productivity_invalid_request"), 400
        return jsonify(calculated=gateway.preview_productivity_row(auth["access_token"], record_data))

    @app.get("/api/productivity/records")
    def productivity_records():
        auth, _context = require_operational_permission("productivity", "view")
        try:
            page = max(1, int(request.args.get("page", "1")))
            page_size = min(100, max(1, int(request.args.get("page_size", "100"))))
        except (TypeError, ValueError):
            return jsonify(error="Page and page size must be whole numbers.", code="invalid_pagination"), 400
        date_from = str(request.args.get("date_from") or "").strip() or None
        date_to = str(request.args.get("date_to") or "").strip() or None
        try:
            parsed_from = date.fromisoformat(date_from) if date_from else None
            parsed_to = date.fromisoformat(date_to) if date_to else None
        except ValueError:
            return jsonify(error="Date filters must use YYYY-MM-DD format.", code="invalid_date_filter"), 400
        if parsed_from and parsed_to and parsed_from > parsed_to:
            return jsonify(error="The start date cannot be later than the end date.", code="invalid_date_filter"), 400
        result = gateway.get_productivity_records(
            auth["access_token"],
            date_from=parsed_from.isoformat() if parsed_from else None,
            date_to=parsed_to.isoformat() if parsed_to else None,
            line=str(request.args.get("line") or "").strip() or None,
            product_code=str(request.args.get("product_code") or "").strip() or None,
            search=str(request.args.get("search") or "").strip() or None,
            page=page, page_size=page_size,
        )
        return jsonify(result)

    @app.post("/api/productivity/records")
    def create_productivity_records():
        auth, _context = require_operational_permission("productivity", "create")
        body = request.get_json(silent=True)
        if not isinstance(body, dict):
            return jsonify(error="A JSON Productivity save request is required.", code="invalid_request"), 400
        try:
            records = normalize_productivity_records(body.get("records"))
        except ProductivityValidationError as exc:
            return jsonify(error=str(exc), code="productivity_invalid_request"), 400
        result = gateway.create_productivity_records(
            auth["access_token"],
            [{"row_index": row["row_index"], "record_data": row["record_data"]} for row in records],
        )
        return jsonify(result), 201 if int(result.get("inserted", 0)) > 0 else 200

    @app.get("/api/productivity/records/<record_id>")
    def productivity_record(record_id: str):
        auth, _context = require_operational_permission("productivity", "view")
        try:
            normalized_id = str(uuid.UUID(str(record_id)))
        except (TypeError, ValueError, AttributeError):
            return jsonify(error="The selected Productivity record ID is invalid.", code="invalid_record_id"), 400
        record = gateway.get_productivity_record(auth["access_token"], normalized_id)
        if not record:
            return jsonify(error="The selected Productivity record was not found.", code="productivity_record_not_found"), 404
        return jsonify(record=record)

    @app.patch("/api/productivity/records/<record_id>")
    def update_productivity_record(record_id: str):
        auth, _context = require_operational_permission("productivity", "edit")
        try:
            normalized_id = str(uuid.UUID(str(record_id)))
        except (TypeError, ValueError, AttributeError):
            return jsonify(error="The selected Productivity record ID is invalid.", code="invalid_record_id"), 400
        body = request.get_json(silent=True)
        if not isinstance(body, dict):
            return jsonify(error="A JSON Productivity edit request is required.", code="invalid_request"), 400
        expected_version = body.get("expected_version")
        if isinstance(expected_version, bool) or not isinstance(expected_version, int) or expected_version < 1:
            return jsonify(error="The current record version is required.", code="expected_version_required"), 400
        record = gateway.get_productivity_record(auth["access_token"], normalized_id)
        if not record or record.get("record_status") != "active":
            return jsonify(error="The selected Productivity record was not found.", code="productivity_record_not_found"), 404
        try:
            normalized = normalize_productivity_changes(record, body.get("changes"))
        except ProductivityValidationError as exc:
            return jsonify(error=str(exc), code="productivity_invalid_request"), 400
        if not normalized["changes"]:
            return jsonify(changed=False, id=normalized_id, version=expected_version)
        change_reason = body.get("change_reason")
        if change_reason is not None and (not isinstance(change_reason, str) or len(change_reason) > 500):
            return jsonify(error="The change reason must be 500 characters or fewer.", code="invalid_change_reason"), 400
        result = gateway.update_productivity_record(
            auth["access_token"], normalized_id, expected_version, normalized["changes"], change_reason
        )
        return jsonify(result)

    @app.get("/api/productivity/records/<record_id>/revisions")
    def productivity_record_revisions(record_id: str):
        auth, _context = require_operational_permission("productivity", "view")
        try:
            normalized_id = str(uuid.UUID(str(record_id)))
        except (TypeError, ValueError, AttributeError):
            return jsonify(error="The selected Productivity record ID is invalid.", code="invalid_record_id"), 400
        record = gateway.get_productivity_record(auth["access_token"], normalized_id)
        if not record:
            return jsonify(error="The selected Productivity record was not found.", code="productivity_record_not_found"), 404
        revisions = gateway.get_productivity_revisions(auth["access_token"], normalized_id)
        return jsonify(record_id=normalized_id, revisions=revisions)

    # Phase 5 ? Hourly Meat / Coding / Agri shared operational workflow -----
    @app.get("/api/hourly/<module_key>/catalog")
    def hourly_production_catalog(module_key: str):
        try:
            module_key = validate_hourly_module(module_key)
        except HourlyProductionValidationError as exc:
            return jsonify(error=str(exc), code="invalid_hourly_module"), 404
        auth, context = require_operational_permission(module_key, "view")
        reference_data = gateway.get_hourly_production_catalog(auth["access_token"], module_key)
        catalog = get_hourly_production_catalog(module_key, reference_data)
        permissions = set(context.get("permissions") or [])
        return jsonify(
            catalog=catalog,
            permissions={
                "view": f"{module_key}.view" in permissions,
                "create": f"{module_key}.create" in permissions,
                "edit": f"{module_key}.edit" in permissions,
                "submit": f"{module_key}.submit" in permissions,
                "approve": f"{module_key}.approve" in permissions,
                "review": f"{module_key}.review" in permissions,
            },
        )

    @app.get("/api/hourly/<module_key>/records")
    def hourly_production_records(module_key: str):
        try:
            module_key = validate_hourly_module(module_key)
        except HourlyProductionValidationError as exc:
            return jsonify(error=str(exc), code="invalid_hourly_module"), 404
        auth, _context = require_operational_permission(module_key, "view")
        try:
            page = max(1, int(request.args.get("page", "1")))
            page_size = min(100, max(1, int(request.args.get("page_size", "100"))))
        except (TypeError, ValueError):
            return jsonify(error="Page and page size must be whole numbers.", code="invalid_pagination"), 400
        date_from = str(request.args.get("date_from") or "").strip() or None
        date_to = str(request.args.get("date_to") or "").strip() or None
        try:
            parsed_from = date.fromisoformat(date_from) if date_from else None
            parsed_to = date.fromisoformat(date_to) if date_to else None
        except ValueError:
            return jsonify(error="Date filters must use YYYY-MM-DD format.", code="invalid_date_filter"), 400
        if parsed_from and parsed_to and parsed_from > parsed_to:
            return jsonify(error="The start date cannot be later than the end date.", code="invalid_date_filter"), 400
        result = gateway.get_hourly_production_records(
            auth["access_token"], module_key,
            date_from=parsed_from.isoformat() if parsed_from else None,
            date_to=parsed_to.isoformat() if parsed_to else None,
            product_code=str(request.args.get("product_code") or "").strip() or None,
            search=str(request.args.get("search") or "").strip() or None,
            page=page, page_size=page_size,
        )
        return jsonify(result)

    @app.post("/api/hourly/<module_key>/records")
    def create_hourly_production_records(module_key: str):
        try:
            module_key = validate_hourly_module(module_key)
        except HourlyProductionValidationError as exc:
            return jsonify(error=str(exc), code="invalid_hourly_module"), 404
        auth, _context = require_operational_permission(module_key, "create")
        body = request.get_json(silent=True)
        if not isinstance(body, dict):
            return jsonify(error="A JSON Hourly Production save request is required.", code="invalid_request"), 400
        reference_data = gateway.get_hourly_production_catalog(auth["access_token"], module_key)
        catalog = get_hourly_production_catalog(module_key, reference_data)
        try:
            records = normalize_hourly_production_records(body.get("records"), catalog)
        except HourlyProductionValidationError as exc:
            return jsonify(error=str(exc), code="hourly_invalid_request"), 400
        result = gateway.create_hourly_production_records(
            auth["access_token"], module_key,
            [{"row_index": row["row_index"], "record_data": row["record_data"]} for row in records],
        )
        return jsonify(result), 201 if int(result.get("inserted", 0)) > 0 else 200

    @app.patch("/api/hourly/<module_key>/records/<record_id>")
    def update_hourly_production_record(module_key: str, record_id: str):
        try:
            module_key = validate_hourly_module(module_key)
        except HourlyProductionValidationError as exc:
            return jsonify(error=str(exc), code="invalid_hourly_module"), 404
        auth, _context = require_operational_permission(module_key, "edit")
        try:
            normalized_id = str(uuid.UUID(str(record_id)))
        except (TypeError, ValueError, AttributeError):
            return jsonify(error="The selected Hourly Production record ID is invalid.", code="invalid_record_id"), 400
        body = request.get_json(silent=True)
        if not isinstance(body, dict):
            return jsonify(error="A JSON Hourly Production edit request is required.", code="invalid_request"), 400
        expected_version = body.get("expected_version")
        if isinstance(expected_version, bool) or not isinstance(expected_version, int) or expected_version < 1:
            return jsonify(error="The current record version is required.", code="expected_version_required"), 400
        record = gateway.get_hourly_production_record(auth["access_token"], module_key, normalized_id)
        if not record or record.get("record_status") != "active":
            return jsonify(error="The selected Hourly Production record was not found.", code="hourly_record_not_found"), 404
        reference_data = gateway.get_hourly_production_catalog(auth["access_token"], module_key)
        catalog = get_hourly_production_catalog(module_key, reference_data)
        try:
            normalized = normalize_hourly_production_changes(record, body.get("changes"), catalog)
        except HourlyProductionValidationError as exc:
            return jsonify(error=str(exc), code="hourly_invalid_request"), 400
        if not normalized["changes"]:
            return jsonify(changed=False, id=normalized_id, version=expected_version)
        change_reason = body.get("change_reason")
        if change_reason is not None and (not isinstance(change_reason, str) or len(change_reason) > 500):
            return jsonify(error="The change reason must be 500 characters or fewer.", code="invalid_change_reason"), 400
        result = gateway.update_hourly_production_record(
            auth["access_token"], module_key, normalized_id, expected_version,
            normalized["changes"], change_reason,
        )
        return jsonify(result)

    @app.get("/api/hourly/<module_key>/records/<record_id>/revisions")
    def hourly_production_record_revisions(module_key: str, record_id: str):
        try:
            module_key = validate_hourly_module(module_key)
        except HourlyProductionValidationError as exc:
            return jsonify(error=str(exc), code="invalid_hourly_module"), 404
        auth, _context = require_operational_permission(module_key, "view")
        try:
            normalized_id = str(uuid.UUID(str(record_id)))
        except (TypeError, ValueError, AttributeError):
            return jsonify(error="The selected Hourly Production record ID is invalid.", code="invalid_record_id"), 400
        record = gateway.get_hourly_production_record(auth["access_token"], module_key, normalized_id)
        if not record:
            return jsonify(error="The selected Hourly Production record was not found.", code="hourly_record_not_found"), 404
        revisions = gateway.get_hourly_production_revisions(auth["access_token"], normalized_id)
        return jsonify(record_id=normalized_id, revisions=revisions)

    # Phase 5 ? DMR Coding manual operational workflow ---------------------
    @app.get("/api/dmr-coding/catalog")
    def dmr_coding_catalog():
        auth, context = require_operational_permission("dmr_coding", "view")
        reference_data = gateway.get_dmr_coding_reference_data(auth["access_token"])
        catalog = get_dmr_coding_catalog(reference_data)
        permissions = set(context.get("permissions") or [])
        return jsonify(
            catalog=catalog,
            permissions={
                "view": "dmr_coding.view" in permissions,
                "create": "dmr_coding.create" in permissions,
                "edit": "dmr_coding.edit" in permissions,
            },
        )

    @app.get("/api/dmr-coding/records")
    def dmr_coding_records():
        auth, _context = require_operational_permission("dmr_coding", "view")
        try:
            page = max(1, int(request.args.get("page", "1")))
            page_size = min(100, max(1, int(request.args.get("page_size", "25"))))
        except (TypeError, ValueError):
            return jsonify(error="Page and page size must be whole numbers.", code="invalid_pagination"), 400
        date_from = str(request.args.get("date_from") or "").strip() or None
        date_to = str(request.args.get("date_to") or "").strip() or None
        try:
            parsed_from = date.fromisoformat(date_from) if date_from else None
            parsed_to = date.fromisoformat(date_to) if date_to else None
        except ValueError:
            return jsonify(error="Date filters must use YYYY-MM-DD format.", code="invalid_date_filter"), 400
        if parsed_from and parsed_to and parsed_from > parsed_to:
            return jsonify(error="The start date cannot be later than the end date.", code="invalid_date_filter"), 400
        filters = {
            "product_code": str(request.args.get("product_code") or "").strip() or None,
            "line": str(request.args.get("line") or "").strip() or None,
            "category": str(request.args.get("category") or "").strip() or None,
            "factor": str(request.args.get("factor") or "").strip() or None,
        }
        records = gateway.get_dmr_coding_records(
            auth["access_token"],
            limit=page_size,
            offset=(page - 1) * page_size,
            date_from=parsed_from.isoformat() if parsed_from else None,
            date_to=parsed_to.isoformat() if parsed_to else None,
            **filters,
        )
        return jsonify(records=records, page=page, page_size=page_size, has_more=len(records) == page_size)

    @app.post("/api/dmr-coding/records")
    def create_dmr_coding_records():
        auth, _context = require_operational_permission("dmr_coding", "create")
        body = request.get_json(silent=True)
        if not isinstance(body, dict):
            return jsonify(error="A JSON DMR Coding save request is required.", code="invalid_request"), 400
        reference_data = gateway.get_dmr_coding_reference_data(auth["access_token"])
        catalog = get_dmr_coding_catalog(reference_data)
        try:
            records = normalize_dmr_coding_records(body.get("records"), catalog)
        except DmrCodingValidationError as exc:
            return jsonify(error=str(exc), code="dmr_coding_invalid_request"), 400
        result = gateway.create_dmr_coding_records(
            auth["access_token"],
            [{"row_index": row["row_index"], "record_data": row["record_data"]} for row in records],
        )
        status = 201 if int(result.get("inserted", 0)) > 0 else 200
        return jsonify(result), status

    @app.patch("/api/dmr-coding/records/<record_id>")
    def update_dmr_coding_record(record_id: str):
        auth, _context = require_operational_permission("dmr_coding", "edit")
        try:
            normalized_id = str(uuid.UUID(str(record_id)))
        except (TypeError, ValueError, AttributeError):
            return jsonify(error="The selected DMR Coding record ID is invalid.", code="invalid_record_id"), 400
        body = request.get_json(silent=True)
        if not isinstance(body, dict):
            return jsonify(error="A JSON DMR Coding edit request is required.", code="invalid_request"), 400
        expected_version = body.get("expected_version")
        if isinstance(expected_version, bool) or not isinstance(expected_version, int) or expected_version < 1:
            return jsonify(error="The current record version is required.", code="expected_version_required"), 400
        record = gateway.get_dmr_coding_record(auth["access_token"], normalized_id)
        if not record or record.get("record_status") != "active":
            return jsonify(error="The selected DMR Coding record was not found.", code="dmr_coding_record_not_found"), 404
        reference_data = gateway.get_dmr_coding_reference_data(auth["access_token"])
        catalog = get_dmr_coding_catalog(reference_data)
        try:
            normalized = normalize_dmr_coding_changes(record, body.get("changes"), catalog)
        except DmrCodingValidationError as exc:
            return jsonify(error=str(exc), code="dmr_coding_invalid_request"), 400
        if not normalized["changes"]:
            return jsonify(changed=False, id=normalized_id, version=expected_version)
        change_reason = body.get("change_reason")
        if change_reason is not None and (not isinstance(change_reason, str) or len(change_reason) > 500):
            return jsonify(error="The change reason must be 500 characters or fewer.", code="invalid_change_reason"), 400
        result = gateway.update_dmr_coding_record(
            auth["access_token"], normalized_id, expected_version, normalized["changes"], change_reason
        )
        return jsonify(result)

    @app.get("/api/dmr-coding/records/<record_id>/revisions")
    def dmr_coding_record_revisions(record_id: str):
        auth, _context = require_operational_permission("dmr_coding", "view")
        try:
            normalized_id = str(uuid.UUID(str(record_id)))
        except (TypeError, ValueError, AttributeError):
            return jsonify(error="The selected DMR Coding record ID is invalid.", code="invalid_record_id"), 400
        revisions = gateway.get_dmr_coding_revisions(auth["access_token"], normalized_id)
        return jsonify(record_id=normalized_id, revisions=revisions)

    # Phase 5 — Coding DPR manual operational workflow -------------------
    @app.get("/api/coding-dpr/catalog")
    def coding_dpr_catalog():
        auth, context = require_operational_permission("coding_dpr", "view")
        catalog = get_coding_dpr_catalog(gateway.get_coding_dpr_catalog(auth["access_token"]))
        permissions = set(context.get("permissions") or [])
        return jsonify(
            catalog=catalog,
            permissions={
                "view": "coding_dpr.view" in permissions,
                "create": "coding_dpr.create" in permissions,
                "edit": "coding_dpr.edit" in permissions,
            },
        )

    @app.get("/api/coding-dpr/records")
    def coding_dpr_records():
        auth, _context = require_operational_permission("coding_dpr", "view")
        try:
            page = max(1, int(request.args.get("page", "1")))
            page_size = min(100, max(1, int(request.args.get("page_size", "25"))))
        except (TypeError, ValueError):
            return jsonify(error="Page and page size must be whole numbers.", code="invalid_pagination"), 400
        date_from = str(request.args.get("date_from") or "").strip() or None
        date_to = str(request.args.get("date_to") or "").strip() or None
        try:
            parsed_from = date.fromisoformat(date_from) if date_from else None
            parsed_to = date.fromisoformat(date_to) if date_to else None
        except ValueError:
            return jsonify(error="Date filters must use YYYY-MM-DD format.", code="invalid_date_filter"), 400
        if parsed_from and parsed_to and parsed_from > parsed_to:
            return jsonify(error="The start date cannot be later than the end date.", code="invalid_date_filter"), 400
        line_number = str(request.args.get("line_number") or "").strip() or None
        product_code = str(request.args.get("product_code") or "").strip() or None
        review_status = str(request.args.get("review_status") or "").strip() or None
        if review_status not in (None, "needs_review", "unassessed"):
            return jsonify(error="Choose a valid Coding DPR review filter.", code="invalid_review_filter"), 400
        result = gateway.get_coding_dpr_records(
            auth["access_token"], limit=page_size, offset=(page - 1) * page_size,
            date_from=parsed_from.isoformat() if parsed_from else None,
            date_to=parsed_to.isoformat() if parsed_to else None,
            line_number=line_number, product_code=product_code, review_status=review_status,
        )
        return jsonify(
            records=result.get("records", []), total_count=int(result.get("total_count", 0)),
            page=page, page_size=page_size, has_more=page * page_size < int(result.get("total_count", 0)),
        )

    @app.post("/api/coding-dpr/records")
    def create_coding_dpr_records():
        auth, _context = require_operational_permission("coding_dpr", "create")
        body = request.get_json(silent=True)
        if not isinstance(body, dict):
            return jsonify(error="A JSON Coding DPR save request is required.", code="invalid_request"), 400
        catalog = get_coding_dpr_catalog(gateway.get_coding_dpr_catalog(auth["access_token"]))
        try:
            records = normalize_coding_dpr_records(body.get("records"), catalog)
        except CodingDprValidationError as exc:
            return jsonify(error=str(exc), code="coding_dpr_invalid_request"), 400
        result = gateway.create_coding_dpr_records(
            auth["access_token"],
            [{"row_index": row["row_index"], "record_data": row["record_data"]} for row in records],
        )
        return jsonify(result), 201 if int(result.get("inserted", 0)) > 0 else 200

    @app.get("/api/coding-dpr/records/<record_id>")
    def coding_dpr_record(record_id: str):
        auth, _context = require_operational_permission("coding_dpr", "view")
        try:
            normalized_id = str(uuid.UUID(str(record_id)))
        except (TypeError, ValueError, AttributeError):
            return jsonify(error="The selected Coding DPR record ID is invalid.", code="invalid_record_id"), 400
        record = gateway.get_coding_dpr_record(auth["access_token"], normalized_id)
        if not record or record.get("record_status") != "active":
            return jsonify(error="The selected Coding DPR record was not found.", code="coding_dpr_record_not_found"), 404
        return jsonify(record=record)

    @app.patch("/api/coding-dpr/records/<record_id>")
    def update_coding_dpr_record(record_id: str):
        auth, _context = require_operational_permission("coding_dpr", "edit")
        try:
            normalized_id = str(uuid.UUID(str(record_id)))
        except (TypeError, ValueError, AttributeError):
            return jsonify(error="The selected Coding DPR record ID is invalid.", code="invalid_record_id"), 400
        body = request.get_json(silent=True)
        if not isinstance(body, dict):
            return jsonify(error="A JSON Coding DPR edit request is required.", code="invalid_request"), 400
        expected_version = body.get("expected_version")
        if isinstance(expected_version, bool) or not isinstance(expected_version, int) or expected_version < 1:
            return jsonify(error="The current record version is required.", code="expected_version_required"), 400
        record = gateway.get_coding_dpr_record(auth["access_token"], normalized_id)
        if not record or record.get("record_status") != "active":
            return jsonify(error="The selected Coding DPR record was not found.", code="coding_dpr_record_not_found"), 404
        catalog = get_coding_dpr_catalog(gateway.get_coding_dpr_catalog(auth["access_token"]))
        try:
            normalized = normalize_coding_dpr_changes(record, body.get("changes"), catalog)
        except CodingDprValidationError as exc:
            return jsonify(error=str(exc), code="coding_dpr_invalid_request"), 400
        if not normalized["changed_fields"]:
            return jsonify(changed=False, id=normalized_id, version=expected_version)
        change_reason = body.get("change_reason")
        if change_reason is not None and (not isinstance(change_reason, str) or len(change_reason) > 500):
            return jsonify(error="The change reason must be 500 characters or fewer.", code="invalid_change_reason"), 400
        result = gateway.update_coding_dpr_record(
            auth["access_token"], normalized_id, expected_version, normalized["record_data"], change_reason
        )
        return jsonify(result)

    @app.get("/api/coding-dpr/records/<record_id>/revisions")
    def coding_dpr_record_revisions(record_id: str):
        auth, _context = require_operational_permission("coding_dpr", "view")
        try:
            normalized_id = str(uuid.UUID(str(record_id)))
        except (TypeError, ValueError, AttributeError):
            return jsonify(error="The selected Coding DPR record ID is invalid.", code="invalid_record_id"), 400
        revisions = gateway.get_coding_dpr_revisions(auth["access_token"], normalized_id)
        return jsonify(record_id=normalized_id, revisions=revisions)

    # Phase 5 ? DMR Production manual operational workflow ----------------
    @app.get("/api/dmr-production/catalog")
    def dmr_production_catalog():
        auth, context = require_operational_permission("dmr_production", "view")
        reference_data = gateway.get_dmr_production_reference_data(auth["access_token"])
        catalog = get_dmr_production_catalog(reference_data)
        permissions = set(context.get("permissions") or [])
        return jsonify(
            catalog=catalog,
            permissions={
                "view": "dmr_production.view" in permissions,
                "create": "dmr_production.create" in permissions,
                "edit": "dmr_production.edit" in permissions,
            },
        )

    @app.get("/api/dmr-production/records")
    def dmr_production_records():
        auth, _context = require_operational_permission("dmr_production", "view")
        try:
            page = max(1, int(request.args.get("page", "1")))
            page_size = min(100, max(1, int(request.args.get("page_size", "25"))))
        except (TypeError, ValueError):
            return jsonify(error="Page and page size must be whole numbers.", code="invalid_pagination"), 400

        date_from = str(request.args.get("date_from") or "").strip() or None
        date_to = str(request.args.get("date_to") or "").strip() or None
        try:
            parsed_from = date.fromisoformat(date_from) if date_from else None
            parsed_to = date.fromisoformat(date_to) if date_to else None
        except ValueError:
            return jsonify(error="Date filters must use YYYY-MM-DD format.", code="invalid_date_filter"), 400
        if parsed_from and parsed_to and parsed_from > parsed_to:
            return jsonify(error="The start date cannot be later than the end date.", code="invalid_date_filter"), 400

        filters = {
            "product_code": str(request.args.get("product_code") or "").strip() or None,
            "line": str(request.args.get("line") or "").strip() or None,
            "category": str(request.args.get("category") or "").strip() or None,
            "search": str(request.args.get("search") or "").strip()[:120] or None,
        }
        records = gateway.get_dmr_production_records(
            auth["access_token"],
            limit=page_size,
            offset=(page - 1) * page_size,
            date_from=parsed_from.isoformat() if parsed_from else None,
            date_to=parsed_to.isoformat() if parsed_to else None,
            **filters,
        )
        return jsonify(
            records=records,
            page=page,
            page_size=page_size,
            has_more=len(records) == page_size,
        )

    @app.post("/api/dmr-production/records")
    def create_dmr_production_records():
        auth, _context = require_operational_permission("dmr_production", "create")
        body = request.get_json(silent=True)
        if not isinstance(body, dict):
            return jsonify(error="A JSON DMR Production save request is required.", code="invalid_request"), 400
        reference_data = gateway.get_dmr_production_reference_data(auth["access_token"])
        catalog = get_dmr_production_catalog(reference_data)
        try:
            records = normalize_dmr_production_records(body.get("records"), catalog)
        except DmrProductionValidationError as exc:
            return jsonify(error=str(exc), code="dmr_production_invalid_request"), 400
        result = gateway.create_dmr_production_records(
            auth["access_token"],
            [{"row_index": row["row_index"], "record_data": row["record_data"]} for row in records],
        )
        status = 201 if int(result.get("inserted", 0)) > 0 else 200
        return jsonify(result), status

    @app.patch("/api/dmr-production/records/<record_id>")
    def update_dmr_production_record(record_id: str):
        auth, _context = require_operational_permission("dmr_production", "edit")
        try:
            normalized_id = str(uuid.UUID(str(record_id)))
        except (TypeError, ValueError, AttributeError):
            return jsonify(error="The selected DMR Production record ID is invalid.", code="invalid_record_id"), 400
        body = request.get_json(silent=True)
        if not isinstance(body, dict):
            return jsonify(error="A JSON DMR Production edit request is required.", code="invalid_request"), 400
        expected_version = body.get("expected_version")
        if isinstance(expected_version, bool) or not isinstance(expected_version, int) or expected_version < 1:
            return jsonify(error="The current record version is required.", code="expected_version_required"), 400
        record = gateway.get_dmr_production_record(auth["access_token"], normalized_id)
        if not record or record.get("record_status") != "active":
            return jsonify(error="The selected DMR Production record was not found.", code="dmr_production_record_not_found"), 404
        reference_data = gateway.get_dmr_production_reference_data(auth["access_token"])
        catalog = get_dmr_production_catalog(reference_data)
        try:
            normalized = normalize_dmr_production_changes(record, body.get("changes"), catalog)
        except DmrProductionValidationError as exc:
            return jsonify(error=str(exc), code="dmr_production_invalid_request"), 400
        change_reason = body.get("change_reason")
        if change_reason is not None and (not isinstance(change_reason, str) or len(change_reason) > 500):
            return jsonify(error="The change reason must be 500 characters or fewer.", code="invalid_change_reason"), 400
        result = gateway.update_dmr_production_record(
            auth["access_token"], normalized_id, expected_version, normalized["changes"], change_reason
        )
        return jsonify(result)

    @app.get("/api/dmr-production/records/<record_id>/revisions")
    def dmr_production_record_revisions(record_id: str):
        auth, _context = require_operational_permission("dmr_production", "view")
        try:
            normalized_id = str(uuid.UUID(str(record_id)))
        except (TypeError, ValueError, AttributeError):
            return jsonify(error="The selected DMR Production record ID is invalid.", code="invalid_record_id"), 400
        revisions = gateway.get_dmr_production_revisions(auth["access_token"], normalized_id)
        return jsonify(record_id=normalized_id, revisions=revisions)

    # Phase 5 — PR Monitoring is a read-only, import-fed register ------------
    def parse_pr_monitoring_filters() -> dict:
        try:
            page = max(1, int(request.args.get("page", "1")))
            page_size = min(1000, max(1, int(request.args.get("page_size", "100"))))
        except (TypeError, ValueError):
            raise PrMonitoringValidationError("Page and page size must be whole numbers.")

        date_from = str(request.args.get("date_from") or "").strip() or None
        date_to = str(request.args.get("date_to") or "").strip() or None
        try:
            parsed_from = date.fromisoformat(date_from) if date_from else None
            parsed_to = date.fromisoformat(date_to) if date_to else None
        except ValueError as exc:
            raise PrMonitoringValidationError("Date filters must use YYYY-MM-DD format.") from exc
        if parsed_from and parsed_to and parsed_from > parsed_to:
            raise PrMonitoringValidationError("The start date cannot be later than the end date.")

        pr_no = str(request.args.get("pr_no") or "").strip() or None
        status = str(request.args.get("status") or "").strip() or None
        search = str(request.args.get("search") or "").strip() or None
        sort_key = str(request.args.get("sort_key") or "").strip() or None
        sort_direction = str(request.args.get("sort_direction") or "asc").strip().lower()
        if pr_no and len(pr_no) > 100:
            raise PrMonitoringValidationError("PR No. search must be 100 characters or fewer.")
        if search and len(search) > 200:
            raise PrMonitoringValidationError("General search must be 200 characters or fewer.")
        if status and status not in PR_MONITORING_STATUS_VALUES:
            raise PrMonitoringValidationError("Choose one of the exact source Status values.")
        if sort_key and sort_key not in PR_MONITORING_SORT_KEYS:
            raise PrMonitoringValidationError("Choose a valid PR Monitoring source column to sort.")
        if sort_direction not in {"asc", "desc"}:
            raise PrMonitoringValidationError("Sort direction must be ascending or descending.")

        return {
            "date_from": parsed_from.isoformat() if parsed_from else None,
            "date_to": parsed_to.isoformat() if parsed_to else None,
            "pr_no": pr_no,
            "status": status,
            "search": search,
            "sort_key": sort_key,
            "sort_direction": sort_direction,
            "page": page,
            "page_size": page_size,
        }

    @app.get("/api/pr-monitoring/catalog")
    def pr_monitoring_catalog():
        _auth, context = require_operational_permission("pr_monitoring", "view")
        permissions = set(context.get("permissions") or [])
        return jsonify(
            catalog=get_pr_monitoring_catalog(),
            permissions={
                "view": "pr_monitoring.view" in permissions,
                "export": "pr_monitoring.export" in permissions,
            },
        )

    @app.get("/api/pr-monitoring/records")
    def pr_monitoring_records():
        auth, _context = require_operational_permission("pr_monitoring", "view")
        try:
            filters = parse_pr_monitoring_filters()
        except PrMonitoringValidationError as exc:
            return jsonify(error=str(exc), code="pr_monitoring_invalid_filter"), 400
        return jsonify(gateway.get_pr_monitoring_records(auth["access_token"], **filters))

    @app.get("/api/pr-monitoring/export.csv")
    def export_pr_monitoring_records():
        auth, _context = require_operational_permission("pr_monitoring", "export")
        try:
            filters = parse_pr_monitoring_filters()
        except PrMonitoringValidationError as exc:
            return jsonify(error=str(exc), code="pr_monitoring_invalid_filter"), 400
        filters["page"] = 1
        filters["page_size"] = 1000
        result = gateway.get_pr_monitoring_records(auth["access_token"], **filters)

        def csv_value(key: str, value):
            if value is None or value == "":
                return ""
            if key == "date_pr_received":
                try:
                    return date.fromisoformat(str(value)[:10]).strftime("%B %d, %Y").replace(" 0", " ")
                except ValueError:
                    return str(value)
            if key in {
                "pr_required_quantity_tins",
                "production_produced_tins",
                "for_production_quantity_tins",
            }:
                try:
                    number = Decimal(str(value))
                    return f"{int(number):,}" if number == number.to_integral_value() else f"{number:,.4f}".rstrip("0").rstrip(".")
                except (InvalidOperation, ValueError):
                    return str(value)
            return str(value)

        buffer = io.StringIO(newline="")
        writer = csv.writer(buffer, lineterminator="\r\n")
        writer.writerow([column["label"] for column in PR_MONITORING_COLUMNS])
        for record in result.get("records", []):
            writer.writerow([
                csv_value(column["key"], record.get(column["key"]))
                for column in PR_MONITORING_COLUMNS
            ])
        response = make_response("\ufeff" + buffer.getvalue())
        response.headers["Content-Type"] = "text/csv; charset=utf-8"
        response.headers["Content-Disposition"] = 'attachment; filename="TFI-PR-Monitoring-Export.csv"'
        response.headers["X-Content-Type-Options"] = "nosniff"
        return response


    # Phase 5 — NON-PROD source-aligned operational workflow -----------------
    @app.get("/api/nonprod/catalog")
    def nonprod_catalog():
        auth, context = require_operational_permission("nonprod", "view")
        permissions = set(context.get("permissions") or [])
        return jsonify(catalog=gateway.get_nonprod_catalog(auth["access_token"]),
            permissions={"view":"nonprod.view" in permissions,"create":"nonprod.create" in permissions,
                         "edit":"nonprod.edit" in permissions,"export":"nonprod.export" in permissions})

    @app.get("/api/nonprod/records")
    def nonprod_records():
        auth, _context = require_operational_permission("nonprod", "view")
        try:
            page=max(1,int(request.args.get("page","1")))
            page_size=min(100,max(1,int(request.args.get("page_size","100"))))
        except (TypeError,ValueError):
            return jsonify(error="Page and page size must be whole numbers.",code="invalid_pagination"),400
        date_from=str(request.args.get("date_from") or "").strip() or None
        date_to=str(request.args.get("date_to") or "").strip() or None
        try:
            parsed_from=date.fromisoformat(date_from) if date_from else None
            parsed_to=date.fromisoformat(date_to) if date_to else None
        except ValueError:
            return jsonify(error="Date filters must use YYYY-MM-DD format.",code="invalid_date_filter"),400
        if parsed_from and parsed_to and parsed_from>parsed_to:
            return jsonify(error="The start date cannot be later than the end date.",code="invalid_date_filter"),400
        return jsonify(gateway.get_nonprod_records(auth["access_token"],
            date_from=parsed_from.isoformat() if parsed_from else None,
            date_to=parsed_to.isoformat() if parsed_to else None,
            employee_name=str(request.args.get("employee_name") or "").strip() or None,
            search=str(request.args.get("search") or "").strip() or None,page=page,page_size=page_size))

    @app.post("/api/nonprod/records")
    def create_nonprod_records():
        auth, _context = require_operational_permission("nonprod","create")
        body=request.get_json(silent=True)
        if not isinstance(body,dict):
            return jsonify(error="A JSON NON-PROD save request is required.",code="invalid_request"),400
        try: records=normalize_nonprod_records(body.get("records"))
        except NonProdValidationError as exc:
            return jsonify(error=str(exc),code="nonprod_invalid_request"),400
        result=gateway.create_nonprod_records(auth["access_token"],records)
        return jsonify(result),201 if int(result.get("inserted",0))>0 else 200

    @app.get("/api/nonprod/records/<record_id>")
    def nonprod_record(record_id: str):
        auth,_context=require_operational_permission("nonprod","view")
        try: normalized_id=str(uuid.UUID(str(record_id)))
        except (TypeError,ValueError,AttributeError):
            return jsonify(error="The selected NON-PROD record ID is invalid.",code="invalid_record_id"),400
        record=gateway.get_nonprod_record(auth["access_token"],normalized_id)
        if not record or record.get("record_status")!="active":
            return jsonify(error="The selected NON-PROD record was not found.",code="nonprod_record_not_found"),404
        return jsonify(record=record)

    @app.patch("/api/nonprod/records/<record_id>")
    def update_nonprod_record(record_id: str):
        auth,_context=require_operational_permission("nonprod","edit")
        try: normalized_id=str(uuid.UUID(str(record_id)))
        except (TypeError,ValueError,AttributeError):
            return jsonify(error="The selected NON-PROD record ID is invalid.",code="invalid_record_id"),400
        body=request.get_json(silent=True)
        if not isinstance(body,dict):
            return jsonify(error="A JSON NON-PROD edit request is required.",code="invalid_request"),400
        expected_version=body.get("expected_version")
        if isinstance(expected_version,bool) or not isinstance(expected_version,int) or expected_version<1:
            return jsonify(error="The current record version is required.",code="expected_version_required"),400
        record=gateway.get_nonprod_record(auth["access_token"],normalized_id)
        if not record or record.get("record_status")!="active":
            return jsonify(error="The selected NON-PROD record was not found.",code="nonprod_record_not_found"),404
        try: changes=normalize_nonprod_changes(record,body.get("changes"))
        except NonProdValidationError as exc:
            return jsonify(error=str(exc),code="nonprod_invalid_request"),400
        if not changes: return jsonify(changed=False,id=normalized_id,version=expected_version)
        reason=body.get("change_reason")
        if reason is not None and (not isinstance(reason,str) or len(reason)>500):
            return jsonify(error="The change reason must be 500 characters or fewer.",code="invalid_change_reason"),400
        return jsonify(gateway.update_nonprod_record(auth["access_token"],normalized_id,expected_version,changes,reason))

    @app.get("/api/nonprod/records/<record_id>/revisions")
    def nonprod_record_revisions(record_id: str):
        auth,_context=require_operational_permission("nonprod","view")
        try: normalized_id=str(uuid.UUID(str(record_id)))
        except (TypeError,ValueError,AttributeError):
            return jsonify(error="The selected NON-PROD record ID is invalid.",code="invalid_record_id"),400
        record=gateway.get_nonprod_record(auth["access_token"],normalized_id)
        if not record: return jsonify(error="The selected NON-PROD record was not found.",code="nonprod_record_not_found"),404
        return jsonify(record_id=normalized_id,revisions=gateway.get_nonprod_revisions(auth["access_token"],normalized_id))

    @app.get("/design/<path:filename>")
    def design_file(filename: str):
        path = (DESIGN_DIR / filename).resolve()
        if not path.is_relative_to(DESIGN_DIR.resolve()) or not path.is_file():
            abort(404)

        if filename not in PUBLIC_DESIGN_FILES:
            session_id = request.cookies.get("tfi_sid")
            try:
                auth = vault.get(session_id, gateway)
                context = gateway.get_access_context(auth["access_token"])
                allowed, _ = _valid_access_context(context)
                if not allowed:
                    vault.remove(session_id)
                    return redirect("/design/admin-login-preview.html", code=302)
            except SupabaseError:
                return redirect("/design/admin-login-preview.html", code=302)

        return send_from_directory(DESIGN_DIR, filename)

    return app


def main() -> None:
    from waitress import serve

    settings = Settings.from_env()
    app = create_app(settings=settings)
    serve(app, host=settings.host, port=settings.port, threads=8, ident="TFI_NEW")


if __name__ == "__main__":
    main()
