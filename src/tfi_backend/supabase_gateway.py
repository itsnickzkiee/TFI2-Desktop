"""Small Supabase Auth/PostgREST gateway.

The Windows client uses only the public publishable key and the signed-in user's JWT.
No service-role key, database password, or privileged server credential is accepted.
"""
from __future__ import annotations

import time
from typing import Any
from urllib.parse import urlencode
import requests

from .config import Settings
from .removed_rows_contract import REMOVED_ROWS_FIELDS, REMOVED_ROWS_SHEET_ID, REMOVED_ROWS_WORKBOOK_ID


class SupabaseError(RuntimeError):
    def __init__(self, message: str, status_code: int = 502, code: str | None = None):
        self.message = message
        self.status_code = status_code
        self.code = code
        super().__init__(message)


class SupabaseGateway:
    def __init__(self, settings: Settings, transport: Any = requests):
        self.base_url = settings.supabase_url.rstrip("/")
        self.publishable_key = settings.publishable_key
        self.transport = transport

    def _request(
        self,
        method: str,
        path: str,
        *,
        access_token: str | None = None,
        body: dict | None = None,
        timeout: int = 15,
    ) -> Any:
        headers = {
            "apikey": self.publishable_key,
            "Accept": "application/json",
        }
        if access_token:
            headers["Authorization"] = f"Bearer {access_token}"
        if body is not None:
            headers["Content-Type"] = "application/json"

        try:
            response = self.transport.request(
                method,
                self.base_url + path,
                headers=headers,
                json=body,
                timeout=timeout,
                allow_redirects=False,
            )
        except requests.Timeout as exc:
            raise SupabaseError(
                "The TFI2 connection timed out. No save or sign-in result was confirmed.",
                504,
                "tfi2_timeout",
            ) from exc
        except requests.RequestException as exc:
            raise SupabaseError(
                "Could not connect to TFI2. Check the internet connection and try again.",
                503,
                "tfi2_connection_error",
            ) from exc

        if 300 <= response.status_code < 400:
            raise SupabaseError("An unexpected redirect from TFI2 was blocked.", 502)

        try:
            payload = response.json() if response.content else None
        except ValueError:
            payload = None

        if not response.ok:
            if response.status_code in (401, 403):
                error_code = payload.get("code") if isinstance(payload, dict) else None
                error_message = payload.get("message") if isinstance(payload, dict) else None
                if error_code == "42501":
                    if "/rest/v1/rpc/tfi_" in path and "import" in path:
                        raise SupabaseError(
                            "Your TFI role does not have the required spreadsheet or module import permission.",
                            403,
                            "import_permission_denied",
                        )
                    if "/rest/v1/rpc/tfi_" in path and "dmp_production" in path:
                        raise SupabaseError(
                            "Your TFI role does not have the required DMP Production permission.",
                            403,
                            "dmp_production_permission_denied",
                        )
                    if "/rest/v1/rpc/tfi_" in path and "production_entry" in path:
                        raise SupabaseError(
                            "Your TFI role does not have the required Production Entry permission.",
                            403,
                            "production_entry_permission_denied",
                        )
                    if "/rest/v1/rpc/tfi_" in path and "production_schedule" in path:
                        raise SupabaseError(
                            "Your TFI role does not have the required Production Schedule permission.",
                            403,
                            "production_schedule_permission_denied",
                        )
                    if "/rest/v1/rpc/tfi_" in path and "dmr_production" in path:
                        raise SupabaseError(
                            "Your TFI role does not have the required DMR Production permission.",
                            403,
                            "dmr_production_permission_denied",
                        )
                    if "/rest/v1/rpc/tfi_" in path and "dmr_coding" in path:
                        raise SupabaseError(
                            "Your TFI role does not have the required DMR Coding permission.",
                            403,
                            "dmr_coding_permission_denied",
                        )
                    if "/rest/v1/rpc/tfi_" in path and "coding_dpr" in path:
                        raise SupabaseError(
                            "Your TFI role does not have the required Coding DPR permission.",
                            403,
                            "coding_dpr_permission_denied",
                        )
                    if "/rest/v1/rpc/tfi_" in path and "pr_monitoring" in path:
                        raise SupabaseError(
                            "Your TFI role does not have the required PR Monitoring permission.",
                            403,
                            "pr_monitoring_permission_denied",
                        )
                    if "/rest/v1/rpc/tfi_" in path and "productivity" in path:
                        raise SupabaseError(
                            "Your TFI role does not have the required Productivity permission.",
                            403,
                            "productivity_permission_denied",
                        )
                    protected_errors = {
                        "master_data_non_data_row_protected",
                        "master_data_source_row_protected",
                        "master_data_category_read_only",
                        "master_data_column_protected",
                    }
                    if error_message in protected_errors:
                        raise SupabaseError(
                            "This Master Data record or field is protected by the approved source rules.",
                            403,
                            "master_data_protected",
                        )
                    raise SupabaseError(
                        "Your TFI account does not have permission to perform this Master Data action.",
                        403,
                        "master_data_permission_denied",
                    )
                raise SupabaseError(
                    "The credentials are invalid or the account is not authorized.",
                    response.status_code,
                    "not_authorized",
                )
            if response.status_code == 429:
                error_code = (
                    (payload.get("code") or payload.get("error_code"))
                    if isinstance(payload, dict)
                    else None
                )
                if error_code == "over_email_send_rate_limit" or path.split("?", 1)[0] == "/auth/v1/recover":
                    raise SupabaseError(
                        "TFI2 has reached its email-sending quota. Password-reset and invitation emails share the built-in email allowance. Wait for the hourly allowance to reset before requesting another link; repeated clicks will not send an email.",
                        429,
                        "email_rate_limited",
                    )
                raise SupabaseError(
                    "Too many attempts. Wait a moment before trying again.",
                    429,
                    "rate_limited",
                )
            error_code = payload.get("code") if isinstance(payload, dict) else None
            if error_code == "40001":
                if "/rest/v1/rpc/tfi_" in path and "dmp_production" in path:
                    raise SupabaseError("This DMP Production record changed in another session. Reload it before saving.", 409, "dmp_production_version_conflict")
                if "/rest/v1/rpc/tfi_" in path and "production_entry" in path:
                    raise SupabaseError("This Production Entry record changed in another session. Reload it before saving.", 409, "production_entry_version_conflict")
                if "/rest/v1/rpc/tfi_" in path and "production_schedule" in path:
                    raise SupabaseError("This Production Schedule form changed in another session. Reload it before saving.", 409, "production_schedule_version_conflict")
                if "/rest/v1/rpc/tfi_" in path and "dmr_production" in path:
                    raise SupabaseError("This DMR Production record changed in another session. Reload it before saving.", 409, "dmr_production_version_conflict")
                if "/rest/v1/rpc/tfi_" in path and "dmr_coding" in path:
                    raise SupabaseError("This DMR Coding record changed in another session. Reload it before saving.", 409, "dmr_coding_version_conflict")
                if "/rest/v1/rpc/tfi_" in path and "hourly_production" in path:
                    raise SupabaseError("This Hourly Production record changed in another session. Reload it before saving.", 409, "hourly_version_conflict")
                if "/rest/v1/rpc/tfi_" in path and "oee" in path:
                    raise SupabaseError("This OEE record changed in another session. Reload it before saving.", 409, "oee_version_conflict")
                raise SupabaseError(
                    "This Master Data record was changed by another user. Reload it before saving again.",
                    409,
                    "master_data_version_conflict",
                )
            if error_code == "23505" and "/rest/v1/rpc/tfi_" in path and "dmp_production" in path:
                raise SupabaseError("An identical DMP Production record already exists. Check the saved records before submitting it again.", 409, "dmp_production_duplicate")
            if error_code == "23505" and "/rest/v1/rpc/tfi_" in path and "production_entry" in path:
                raise SupabaseError("An identical Production Entry run already exists in this source row slot. Check the saved Production Summary before submitting it again.", 409, "production_entry_duplicate")
            if error_code == "23505" and "/rest/v1/rpc/tfi_" in path and "production_schedule" in path:
                raise SupabaseError("A Production Schedule form already exists for this date. Load the saved date to make a versioned update instead of creating another form.", 409, "production_schedule_duplicate_date")
            if error_code == "23505" and "/rest/v1/rpc/tfi_" in path and "dmr_production" in path:
                raise SupabaseError("A DMR downtime event with the same date, product, line, and times already exists. Review the saved register instead of overwriting it.", 409, "dmr_production_duplicate_event")
            if error_code == "23505" and "/rest/v1/rpc/tfi_" in path and "dmr_coding" in path:
                raise SupabaseError("An exact DMR Coding entry already exists. Review the saved register instead of overwriting it.", 409, "dmr_coding_duplicate_record")
            if error_code == "23505" and "/rest/v1/rpc/tfi_" in path and "hourly_production" in path:
                raise SupabaseError("A record already exists for this module, date, hour, and product code. Open the saved record to make a versioned edit.", 409, "hourly_duplicate_slot")
            if error_code == "23505" and "/rest/v1/rpc/tfi_" in path and "oee" in path:
                raise SupabaseError("An OEE record already exists for this date, machine, and product code. Open the saved record to make a versioned edit.", 409, "oee_duplicate_record")
            if error_code == "P0002":
                if "/rest/v1/rpc/tfi_" in path and "import" in path:
                    raise SupabaseError("The import batch or row could not be found.", 404, "import_resource_not_found")
                if "/rest/v1/rpc/tfi_" in path and "dmp_production" in path:
                    raise SupabaseError("The DMP Production record no longer exists.", 404, "dmp_production_record_not_found")
                if "/rest/v1/rpc/tfi_" in path and "production_entry" in path:
                    raise SupabaseError("The Production Entry record no longer exists.", 404, "production_entry_record_not_found")
                if "/rest/v1/rpc/tfi_" in path and "production_schedule" in path:
                    raise SupabaseError("The Production Schedule form no longer exists.", 404, "production_schedule_form_not_found")
                if "/rest/v1/rpc/tfi_" in path and "dmr_production" in path:
                    raise SupabaseError("The DMR Production record no longer exists.", 404, "dmr_production_record_not_found")
                if "/rest/v1/rpc/tfi_" in path and "dmr_coding" in path:
                    raise SupabaseError("The DMR Coding record no longer exists.", 404, "dmr_coding_record_not_found")
                if "/rest/v1/rpc/tfi_" in path and "hourly_production" in path:
                    raise SupabaseError("The Hourly Production record no longer exists.", 404, "hourly_record_not_found")
                if "/rest/v1/rpc/tfi_" in path and "oee" in path:
                    raise SupabaseError("The OEE record no longer exists.", 404, "oee_record_not_found")
                raise SupabaseError("The Master Data record no longer exists.", 404, "master_data_row_not_found")
            if error_code == "22023":
                if "/rest/v1/rpc/tfi_" in path and "import" in path:
                    raise SupabaseError(
                        "The import request is invalid or the batch is no longer in the required state.",
                        400,
                        "import_invalid_request",
                    )
                if "/rest/v1/rpc/tfi_" in path and "dmp_production" in path:
                    messages = {
                        "dmp_production_process_not_in_master_data": "The selected process is not in the current DMP LEGEND reference list.",
                        "dmp_production_worker_not_in_master_data": "The selected worker is not in the current DMP LEGEND reference list.",
                        "dmp_production_numeric_values_must_be_nonnegative": "Count and Total Time must be zero or greater.",
                        "dmp_production_invalid_field_value": "One or more DMP fields contain an invalid date, time, or number.",
                        "dmp_production_unknown_or_derived_field": "Position is calculated from DMP LEGEND and cannot be submitted or edited.",
                    }
                    message = payload.get("message") if isinstance(payload, dict) else None
                    raise SupabaseError(messages.get(message, "The DMP Production request is invalid. Check the fields and try again."), 400, "dmp_production_invalid_request")
                if "/rest/v1/rpc/tfi_" in path and "production_entry" in path:
                    messages = {
                        "production_entry_invalid_product_name": "Choose a Product Name from the verified DPR LEGEND list.",
                        "production_entry_product_code_mismatch": "The selected Product Code does not belong to the selected Product Name.",
                        "production_entry_invalid_uom": "Choose a valid UOM.",
                        "production_entry_negative_number": "Production quantities, manpower, and overtime values must be zero or greater.",
                        "production_entry_invalid_field_value": "One or more Production Entry fields contain an invalid date, time, or number.",
                        "production_entry_unknown_or_derived_field": "Calculated and trace fields are read-only and cannot be submitted or edited.",
                        "production_entry_invalid_or_repeated_source_row": "Each of the 12 source row slots can be submitted only once per form.",
                        "production_entry_saved_run_must_retain_data": "A saved Production Entry run must retain at least one source Has data field.",
                    }
                    message = payload.get("message") if isinstance(payload, dict) else None
                    raise SupabaseError(messages.get(message, "The Production Entry request is invalid. Check the source fields and try again."), 400, "production_entry_invalid_request")
                if "/rest/v1/rpc/tfi_" in path and "dmr_coding" in path:
                    messages = {
                        "dmr_coding_rows_required": "Submit between 1 and 50 DMR Coding rows.",
                        "dmr_coding_row_shape_invalid": "A DMR Coding row has an invalid structure.",
                        "dmr_coding_unknown_or_derived_field": "Calculated downtime and Product Name fields cannot be submitted or edited.",
                        "dmr_coding_invalid_field_value": "One or more DMR Coding fields contain an invalid date, time, or text value.",
                        "dmr_coding_text_value_too_long": "One or more DMR Coding text fields exceed the allowed length.",
                        "dmr_coding_invalid_category": "Choose a Category from the current DPR LEGEND.",
                        "dmr_coding_invalid_factor": "Choose a Factor from the current DPR LEGEND.",
                        "dmr_coding_update_request_invalid": "The DMR Coding edit request is invalid.",
                    }
                    message = payload.get("message") if isinstance(payload, dict) else None
                    raise SupabaseError(messages.get(message, "The DMR Coding request is invalid. Check the source fields and try again."), 400, "dmr_coding_invalid_request")
                if "/rest/v1/rpc/tfi_" in path and "oee" in path:
                    messages = {
                        "oee_rows_required": "Submit between 1 and 100 OEE rows.",
                        "oee_row_shape_invalid": "An OEE row has an invalid structure.",
                        "oee_unknown_or_derived_field": "Calculated OEE columns cannot be submitted or edited.",
                        "oee_update_request_invalid": "The OEE edit request is invalid.",
                        "oee_invalid_field_value": "Check the required OEE inputs, date, hours, counts, and Y/N selection.",
                        "oee_pagination_invalid": "The page or page size is invalid.",
                        "oee_date_range_invalid": "The start date cannot be later than the end date.",
                        "oee_record_must_be_object": "Each OEE record must be a source-input object.",
                        "oee_record_fields_invalid": "All ten OEE source input fields are required; calculated fields are excluded.",
                        "oee_record_field_type_invalid": "Check the OEE date, text, whole-number counts, and Y/N values.",
                    }
                    message = payload.get("message") if isinstance(payload, dict) else None
                    raise SupabaseError(messages.get(message, "The OEE request is invalid. Check all ten source input fields and try again."), 400, "oee_invalid_request")
                if "/rest/v1/rpc/tfi_" in path and "hourly_production" in path:
                    messages = {
                        "hourly_module_invalid": "Choose Hourly Meat, Hourly Coding, or Hourly Agri.",
                        "hourly_rows_required": "Submit between 1 and 100 hourly rows.",
                        "hourly_row_shape_invalid": "An hourly row has an invalid structure.",
                        "hourly_unknown_or_derived_field": "Calculated hourly columns cannot be submitted or edited.",
                        "hourly_invalid_field_value": "One or more hourly fields contain an invalid date, hour, or quantity.",
                        "hourly_date_out_of_range": "Date must be later than 01 January 2000.",
                        "hourly_hour_out_of_range": "Hour must be a whole number from 0 to 23.",
                        "hourly_target_invalid": "Target must be a non-negative number.",
                        "hourly_actual_invalid": "Actual output must be a non-negative number.",
                        "hourly_text_too_long": "Product Code or Remarks exceeds the allowed length.",
                        "hourly_update_request_invalid": "The Hourly Production edit request is invalid.",
                        "hourly_pagination_invalid": "The page or page size is invalid.",
                        "hourly_date_range_invalid": "The start date cannot be later than the end date.",
                    }
                    message = payload.get("message") if isinstance(payload, dict) else None
                    raise SupabaseError(messages.get(message, "The Hourly Production request is invalid. Check the source fields and try again."), 400, "hourly_invalid_request")
                if "/rest/v1/rpc/tfi_" in path and "dmr_production" in path:
                    messages = {
                        "dmr_production_rows_required": "Submit between 1 and 50 DMR rows.",
                        "dmr_production_row_shape_invalid": "A DMR row has an invalid structure.",
                        "dmr_production_unknown_or_derived_field": "Calculated downtime and Product Name fields cannot be submitted or edited.",
                        "dmr_production_invalid_field_value": "One or more DMR fields contain an invalid date, time, or text value.",
                        "dmr_production_required_fields_missing": "Date, Product Code, Line, Stop, Resume, and Category are required.",
                        "dmr_production_text_value_too_long": "One or more DMR text fields exceed the allowed length.",
                        "dmr_production_invalid_category": "Choose a Category from the current DPR LEGEND.",
                        "dmr_production_invalid_source_column_i": "Choose a valid value for source column I from DPR LEGEND.",
                        "dmr_production_invalid_source_column_j": "Choose a valid value for source column J from DPR LEGEND.",
                        "dmr_production_update_request_invalid": "The DMR edit request is invalid.",
                    }
                    message = payload.get("message") if isinstance(payload, dict) else None
                    raise SupabaseError(messages.get(message, "The DMR Production request is invalid. Check the source fields and try again."), 400, "dmr_production_invalid_request")
                if "/rest/v1/rpc/tfi_" in path and "production_schedule" in path:
                    messages = {
                        "production_schedule_catalog_incomplete": "The Product Standard or Schedule Lists reference data is incomplete. Refresh Master Data before using Production Schedule.",
                        "production_schedule_product_group_mapping_incomplete": "The current Product Standard product-group mapping is incomplete.",
                        "production_schedule_date_required": "Choose a valid production date.",
                        "production_schedule_negative_number": "Batch counts, revised targets, quantities, and manpower values must be zero or greater.",
                        "production_schedule_rows_must_be_between_1_and_10": "A daily Production Schedule supports up to 10 source rows.",
                        "production_schedule_invalid_row": "One of the Production Schedule rows is invalid.",
                        "production_schedule_invalid_source_row": "A Production Schedule row does not match one of the 10 source slots.",
                        "production_schedule_duplicate_source_row": "A source row slot was submitted more than once.",
                        "production_schedule_invalid_row_data": "A Production Schedule row is missing its source input fields.",
                        "production_schedule_unknown_or_derived_field": "Calculated, helper, and trace columns are read-only.",
                        "production_schedule_field_values_must_be_text": "Production Schedule input values must be text before server validation.",
                        "production_schedule_field_too_long": "One or more Production Schedule text fields exceed the allowed length.",
                        "production_schedule_code_required_for_populated_row": "Select a Production Code for every populated source row.",
                        "production_schedule_product_group_required": "Select a Product Name before selecting a Production Code.",
                        "production_schedule_invalid_product_group": "Choose a Product Name from the current Schedule Lists.",
                        "production_schedule_product_code_mismatch": "The Production Code does not belong to the selected Product Name.",
                        "production_schedule_invalid_line": "Choose a valid production line.",
                        "production_schedule_invalid_area": "Choose a valid production area.",
                        "production_schedule_invalid_uom": "Choose a valid unit of measure.",
                        "production_schedule_invalid_numeric_value": "One or more numeric fields contain an invalid value.",
                        "production_schedule_at_least_one_product_code_required": "Add at least one Product Name and Production Code before saving.",
                        "production_schedule_invalid_date_range": "The start date cannot be later than the end date.",
                        "production_schedule_change_reason_too_long": "The change reason must be 500 characters or fewer.",
                    }
                    message = payload.get("message") if isinstance(payload, dict) else None
                    raise SupabaseError(messages.get(message, "The Production Schedule request is invalid. Check the source fields and try again."), 400, "production_schedule_invalid_request")
                raise SupabaseError(
                    "The Master Data change was invalid. Check the selected fields and try again.",
                    400,
                    "master_data_invalid_change",
                )
            if response.status_code >= 500:
                raise SupabaseError(
                    "TFI2 is temporarily unavailable. Try again later.",
                    502,
                    "tfi2_server_error",
                )
            error_code = payload.get("code") if isinstance(payload, dict) else None
            if error_code in ("PGRST202", "PGRST204"):
                raise SupabaseError(
                    "The TFI2 database API needs a schema refresh. Contact the system administrator.",
                    409,
                    "schema_refresh_required",
                )
            raise SupabaseError(
                "TFI2 rejected the request. Check the account, permissions, and current schema.",
                response.status_code,
                "request_rejected",
            )
        return payload

    def health(self) -> dict:
        self._request("GET", "/auth/v1/health")
        return {"connected": True, "project": "TFI2"}

    def get_dashboard_coverage_summary(self, access_token: str, permissions: set[str] | list[str]) -> dict:
        """Return exact, permission-scoped operational record counts for the dashboard.

        Only IDs are selected. PostgREST RLS remains active for every count query.
        KPI calculations are intentionally not performed here; those are a separate
        Phase 7C calculation-contract gate.
        """
        granted = set(permissions or [])
        if "dashboard.view" not in granted:
            raise SupabaseError("Your TFI role does not have Dashboard view permission.", 403, "dashboard_permission_denied")

        module_specs = (
            ("product_entry", "Product Entry", "tfi_product_entry_records", {"record_status": "eq.active"}),
            ("production_entry", "Production Entry", "tfi_production_entry_records", {"record_status": "eq.active"}),
            ("production_schedule", "Production Schedule", "tfi_production_schedule_forms", {"record_status": "eq.active"}),
            ("dmp_production", "DMP Production", "tfi_dmp_production_records", {"record_status": "eq.active"}),
            ("dmr_production", "DMR Production", "tfi_dmr_production_records", {"record_status": "eq.active"}),
            ("dmr_coding", "DMR Coding", "tfi_dmr_coding_records", {"record_status": "eq.active"}),
            ("hourly_meat", "Hourly Meat", "tfi_hourly_production_records", {"record_status": "eq.active", "module_key": "eq.hourly_meat"}),
            ("hourly_coding", "Hourly Coding", "tfi_hourly_production_records", {"record_status": "eq.active", "module_key": "eq.hourly_coding"}),
            ("hourly_agri", "Hourly Agri", "tfi_hourly_production_records", {"record_status": "eq.active", "module_key": "eq.hourly_agri"}),
            ("oee", "OEE", "tfi_oee_records", {"record_status": "eq.active"}),
            ("productivity", "Productivity", "tfi_productivity_records", {"record_status": "eq.active"}),
            ("coding_dpr", "Coding DPR", "tfi_coding_dpr_entries", {"record_status": "eq.active"}),
            ("pr_monitoring", "PR Monitoring", "tfi_pr_monitoring_records", {}),
            ("co_qa", "CO QA Cost Records", "tfi_co_qa_cost_records", {}),
            ("nonprod", "NON-PROD", "tfi_nonprod_records", {"record_status": "eq.active"}),
        )

        def exact_count(
            table: str,
            filters: dict[str, str] | None = None,
            select_column: str = "id",
        ) -> int:
            params = [("select", select_column), ("limit", "1")]
            params.extend((filters or {}).items())
            path = f"/rest/v1/{table}?{urlencode(params)}"
            headers = {
                "apikey": self.publishable_key,
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/json",
                "Prefer": "count=exact",
                "Range": "0-0",
            }
            try:
                response = self.transport.request(
                    "GET", self.base_url + path, headers=headers, timeout=15, allow_redirects=False
                )
            except requests.Timeout as exc:
                raise SupabaseError("The TFI2 dashboard data request timed out.", 504, "dashboard_timeout") from exc
            except requests.RequestException as exc:
                raise SupabaseError("Could not retrieve dashboard data from TFI2.", 503, "dashboard_connection_error") from exc
            if 300 <= response.status_code < 400:
                raise SupabaseError("An unexpected redirect from TFI2 was blocked.", 502, "dashboard_redirect_blocked")
            if not response.ok:
                if response.status_code in (401, 403):
                    raise SupabaseError("Your TFI role cannot read one or more dashboard data sources.", 403, "dashboard_source_permission_denied")
                raise SupabaseError("TFI2 could not return an exact dashboard record count.", response.status_code, "dashboard_count_failed")
            content_range = str(getattr(response, "headers", {}).get("Content-Range") or "")
            total = content_range.rsplit("/", 1)[-1] if "/" in content_range else ""
            if not total.isdigit():
                raise SupabaseError("TFI2 did not confirm an exact dashboard record count.", 502, "dashboard_count_unconfirmed")
            return int(total)

        modules = []
        for module_key, label, table, filters in module_specs:
            required_permissions = {f"{module_key}.view"}
            if module_key == "co_qa":
                required_permissions.add("product_entry.view")
            if not required_permissions.issubset(granted):
                continue
            select_column = "product_entry_record_id" if module_key == "co_qa" else "id"
            modules.append({
                "module_key": module_key,
                "label": label,
                "record_count": exact_count(table, filters, select_column),
            })

        imports = None
        if "spreadsheet_import.view" in granted:
            imports = {
                "batches_total": exact_count("tfi_import_batches"),
                "batches_in_review": exact_count("tfi_import_batches", {"status": "eq.review"}),
                "staged_rows": exact_count("tfi_import_rows"),
            }

        audit_events = None
        if "audit_trail.view" in granted:
            audit_events = exact_count("tfi_audit_events")

        total_records = sum(item["record_count"] for item in modules)
        modules_with_records = sum(1 for item in modules if item["record_count"] > 0)
        return {
            "source": "TFI2",
            "checked_at": int(time.time()),
            "total_operational_records": total_records,
            "visible_module_count": len(modules),
            "modules_with_records": modules_with_records,
            "modules": modules,
            "imports": imports,
            "audit_events": audit_events,
            "kpi_calculations_ready": False,
            "kpi_calculation_note": "Yield Log and Product Entry Summary are read-only source formula projections.",
        }

    def get_removed_rows_archive(self, access_token: str) -> list[dict]:
        params = urlencode({
            "select": "source_row,cells,captured_at",
            "workbook_id": f"eq.{REMOVED_ROWS_WORKBOOK_ID}",
            "sheet_id": f"eq.{REMOVED_ROWS_SHEET_ID}",
            "order": "source_row.asc",
            "limit": "997",
        })
        payload = self._request(
            "GET", f"/rest/v1/tfi_removed_rows_archive?{params}", access_token=access_token,
        )
        if not isinstance(payload, list):
            raise SupabaseError("The archive could not be read.", 502, "removed_rows_invalid")
        return [
            {"source_row": row["source_row"], "captured_at": row["captured_at"],
             **dict(zip(REMOVED_ROWS_FIELDS, row["cells"], strict=True))}
            for row in payload
        ]

    def get_dashboard_analytics(
        self,
        access_token: str,
        *,
        date_from: str | None = None,
        date_to: str | None = None,
        product_code: str | None = None,
        product_name: str | None = None,
        machine: str | None = None,
    ) -> dict:
        """Fetch source-workbook KPI calculations and report summaries from TFI2."""
        payload = self._request(
            "POST",
            "/rest/v1/rpc/tfi_get_dashboard_analytics",
            access_token=access_token,
            body={
                "p_date_from": date_from,
                "p_date_to": date_to,
                "p_product_code": product_code,
                "p_product_name": product_name,
                "p_machine": machine,
            },
            timeout=30,
        )
        if not isinstance(payload, dict) or payload.get("source") != "TFI2":
            raise SupabaseError(
                "TFI2 did not return a valid dashboard analytics response.",
                502,
                "dashboard_analytics_invalid",
            )
        return payload

    def sign_in_with_password(self, email: str, password: str) -> dict:
        payload = self._request(
            "POST",
            "/auth/v1/token?grant_type=password",
            body={"email": email, "password": password},
        )
        return self._validate_session(payload)

    def refresh_session(self, refresh_token: str) -> dict:
        payload = self._request(
            "POST",
            "/auth/v1/token?grant_type=refresh_token",
            body={"refresh_token": refresh_token},
        )
        return self._validate_session(payload)

    @staticmethod
    def _validate_session(payload: Any) -> dict:
        if not isinstance(payload, dict):
            raise SupabaseError("TFI2 did not return a valid authentication session.", 502)
        user = payload.get("user")
        access_token = payload.get("access_token")
        refresh_token = payload.get("refresh_token")
        if not isinstance(user, dict) or not user.get("id") or not access_token or not refresh_token:
            raise SupabaseError("TFI2 did not return a complete authentication session.", 502)
        try:
            expires_in = max(60, int(payload.get("expires_in", 3600)))
        except (TypeError, ValueError):
            expires_in = 3600
        return {
            "user_id": str(user["id"]),
            "email": str(user.get("email") or ""),
            "access_token": str(access_token),
            "refresh_token": str(refresh_token),
            "expires_at": time.time() + expires_in,
        }

    def get_access_context(self, access_token: str) -> dict:
        payload = self._request(
            "POST",
            "/rest/v1/rpc/tfi_get_my_access_context",
            access_token=access_token,
            body={},
        )
        if not isinstance(payload, dict):
            raise SupabaseError("TFI2 returned an invalid account-access response.", 502)
        return payload

    def get_master_data_categories(self, access_token: str) -> list[dict]:
        query = urlencode({
            "select": (
                "category_key,source_sheet_ref,display_name,source_range,source_row_count,"
                "reference_count,source_column_count,source_header_rows,first_data_row,"
                "edit_policy,editable_columns,read_only_columns,locked_source_rows,"
                "field_rules,source_count_note,sort_order,is_active"
            ),
            "is_active": "eq.true",
            "order": "sort_order.asc",
        })
        payload = self._request(
            "GET",
            f"/rest/v1/tfi_master_data_categories?{query}",
            access_token=access_token,
        )
        if not isinstance(payload, list):
            raise SupabaseError("TFI2 returned an invalid Master Data category list.", 502)
        return payload

    def get_master_data_rows(self, access_token: str, category_key: str) -> list[dict]:
        import re

        if not re.fullmatch(r"[a-z][a-z0-9_]{1,63}", str(category_key or "")):
            raise SupabaseError("The selected Master Data category is invalid.", 400, "invalid_category")
        query = urlencode({
            "select": (
                "id,category_key,source_row_number,row_kind,source_values,current_values,"
                "source_notes,source_fingerprint,record_status,row_editable,version,"
                "source_captured_at,created_at,updated_at,created_by,updated_by"
            ),
            "category_key": f"eq.{category_key}",
            "record_status": "eq.active",
            "order": "source_row_number.asc",
            "limit": "1000",
        })
        payload = self._request(
            "GET",
            f"/rest/v1/tfi_master_data_rows?{query}",
            access_token=access_token,
        )
        if not isinstance(payload, list):
            raise SupabaseError("TFI2 returned an invalid Master Data row list.", 502)
        return payload

    def get_master_data_row(self, access_token: str, row_id: str) -> dict:
        import uuid

        try:
            normalized_id = str(uuid.UUID(str(row_id)))
        except (TypeError, ValueError, AttributeError) as exc:
            raise SupabaseError("The selected Master Data record ID is invalid.", 400, "invalid_row_id") from exc
        query = urlencode({
            "select": (
                "id,category_key,source_row_number,row_kind,source_values,current_values,"
                "source_notes,source_fingerprint,record_status,row_editable,version"
            ),
            "id": f"eq.{normalized_id}",
            "limit": "1",
        })
        payload = self._request(
            "GET",
            f"/rest/v1/tfi_master_data_rows?{query}",
            access_token=access_token,
        )
        if not isinstance(payload, list) or not payload:
            raise SupabaseError("The Master Data record was not found.", 404, "master_data_row_not_found")
        return payload[0]

    def get_master_data_revisions(self, access_token: str, row_id: str) -> list[dict]:
        import uuid

        try:
            normalized_id = str(uuid.UUID(str(row_id)))
        except (TypeError, ValueError, AttributeError) as exc:
            raise SupabaseError("The selected Master Data record ID is invalid.", 400, "invalid_row_id") from exc
        query = urlencode({
            "select": "id,version,before_values,after_values,changed_columns,change_reason,changed_by,changed_at",
            "master_data_row_id": f"eq.{normalized_id}",
            "order": "version.desc",
            "limit": "100",
        })
        payload = self._request(
            "GET",
            f"/rest/v1/tfi_master_data_row_revisions?{query}",
            access_token=access_token,
        )
        if not isinstance(payload, list):
            raise SupabaseError("TFI2 returned an invalid Master Data revision list.", 502)
        return payload

    def update_master_data_row(
        self,
        access_token: str,
        row_id: str,
        expected_version: int,
        changes: dict[str, str],
        change_reason: str | None = None,
    ) -> dict:
        payload = self._request(
            "POST",
            "/rest/v1/rpc/tfi_update_master_data_row",
            access_token=access_token,
            body={
                "p_row_id": row_id,
                "p_expected_version": expected_version,
                "p_changes": changes,
                "p_change_reason": change_reason,
            },
        )
        if not isinstance(payload, dict):
            raise SupabaseError("TFI2 returned an invalid Master Data save response.", 502)
        return payload

    def request_password_recovery(self, email: str, redirect_to: str) -> None:
        query = urlencode({"redirect_to": redirect_to})
        self._request(
            "POST",
            f"/auth/v1/recover?{query}",
            body={"email": email},
        )

    def get_auth_user(self, access_token: str) -> dict:
        payload = self._request("GET", "/auth/v1/user", access_token=access_token)
        if not isinstance(payload, dict) or not payload.get("id") or not payload.get("email"):
            raise SupabaseError("The recovery link did not identify a valid TFI2 account.", 401, "recovery_invalid")
        return {"user_id": str(payload["id"]), "email": str(payload["email"])}

    def update_password(self, access_token: str, password: str) -> None:
        self._request(
            "PUT",
            "/auth/v1/user",
            access_token=access_token,
            body={"password": password},
        )

    def sign_out(self, access_token: str) -> None:
        self._request("POST", "/auth/v1/logout", access_token=access_token)


    # DMP Production operational API ---------------------------------------
    def get_dmp_production_options(self, access_token: str) -> dict:
        payload = self._request(
            "POST",
            "/rest/v1/rpc/tfi_get_dmp_production_options",
            access_token=access_token,
            body={},
        )
        if not isinstance(payload, dict) or not isinstance(payload.get("workers"), list) or not isinstance(payload.get("processes"), list):
            raise SupabaseError("TFI2 returned invalid DMP Production reference options.", 502, "invalid_dmp_production_options")
        return payload

    def get_dmp_production_summary(
        self,
        access_token: str,
        *,
        date_from: str | None = None,
        date_to: str | None = None,
    ) -> dict:
        payload = self._request(
            "POST",
            "/rest/v1/rpc/tfi_get_dmp_production_summary",
            access_token=access_token,
            body={"p_date_from": date_from, "p_date_to": date_to},
        )
        if not isinstance(payload, dict):
            raise SupabaseError("TFI2 returned an invalid DMP Production summary.", 502, "invalid_dmp_production_summary")
        return payload
    def get_dmp_production_records(
        self,
        access_token: str,
        *,
        limit: int = 100,
        offset: int = 0,
        date_from: str | None = None,
        date_to: str | None = None,
    ) -> list[dict]:
        payload = self._request(
            "POST",
            "/rest/v1/rpc/tfi_list_dmp_production_records",
            access_token=access_token,
            body={
                "p_limit": min(100, max(1, int(limit))),
                "p_offset": max(0, int(offset)),
                "p_date_from": date_from,
                "p_date_to": date_to,
            },
        )
        if not isinstance(payload, list):
            raise SupabaseError("TFI2 returned an invalid DMP Production record list.", 502, "invalid_dmp_production_records")
        return payload
    def get_dmp_production_revisions(self, access_token: str, record_id: str) -> list[dict]:
        params = {
            "select": "id,dmp_production_record_id,version,before_data,after_data,changed_fields,change_reason,changed_by,changed_at",
            "dmp_production_record_id": f"eq.{record_id}",
            "order": "version.desc",
            "limit": "100",
        }
        payload = self._request(
            "GET",
            f"/rest/v1/tfi_dmp_production_revisions?{urlencode(params)}",
            access_token=access_token,
        )
        if not isinstance(payload, list):
            raise SupabaseError("TFI2 returned an invalid DMP Production revision list.", 502, "invalid_dmp_production_revisions")
        return payload

    def create_dmp_production_records(self, access_token: str, records: list[dict]) -> dict:
        payload = self._request(
            "POST",
            "/rest/v1/rpc/tfi_create_dmp_production_records",
            access_token=access_token,
            body={"p_records": records},
            timeout=45,
        )
        if not isinstance(payload, dict):
            raise SupabaseError("TFI2 returned an invalid DMP Production save result.", 502, "invalid_dmp_production_save")
        return payload

    def update_dmp_production_record(
        self,
        access_token: str,
        record_id: str,
        expected_version: int,
        changes: dict,
        change_reason: str | None = None,
    ) -> dict:
        payload = self._request(
            "POST",
            "/rest/v1/rpc/tfi_update_dmp_production_record",
            access_token=access_token,
            body={
                "p_record_id": record_id,
                "p_expected_version": expected_version,
                "p_changes": changes,
                "p_change_reason": change_reason,
            },
        )
        if not isinstance(payload, dict):
            raise SupabaseError("TFI2 returned an invalid DMP Production update result.", 502, "invalid_dmp_production_update")
        return payload



    # DMR Coding manual operational API -------------------------------------
    def get_dmr_coding_reference_data(self, access_token: str) -> dict:
        payload = self._request(
            "POST", "/rest/v1/rpc/tfi_get_dmr_coding_reference_data",
            access_token=access_token, body={}
        )
        if not isinstance(payload, dict):
            raise SupabaseError("TFI2 returned invalid DMR Coding reference data.", 502, "invalid_dmr_coding_reference_data")
        return payload

    def get_dmr_coding_records(
        self, access_token: str, *, limit: int = 25, offset: int = 0,
        date_from: str | None = None, date_to: str | None = None,
        product_code: str | None = None, line: str | None = None,
        category: str | None = None, factor: str | None = None,
    ) -> list[dict]:
        params = {
            "select": "id,production_date,product_code,line,stop_time,resume_time,downtime_minutes,downtime_hours,category,factor,reason,product_code_reference_status,completeness_status,source_import_row_id,entry_source,version,record_status,created_at,updated_at,created_by,updated_by",
            "record_status": "eq.active",
            "order": "created_at.desc,id.desc",
            "limit": str(min(100, max(1, int(limit)))),
            "offset": str(max(0, int(offset))),
        }
        date_filters = []
        if date_from:
            date_filters.append(f"production_date.gte.{date_from}")
        if date_to:
            date_filters.append(f"production_date.lte.{date_to}")
        if date_filters:
            params["and"] = "(" + ",".join(date_filters) + ")"
        if product_code:
            params["product_code"] = f"eq.{product_code}"
        if line:
            params["line"] = f"eq.{line}"
        if category:
            params["category"] = f"eq.{category}"
        if factor:
            params["factor"] = f"eq.{factor}"
        payload = self._request(
            "GET", f"/rest/v1/tfi_dmr_coding_records?{urlencode(params)}",
            access_token=access_token
        )
        if not isinstance(payload, list):
            raise SupabaseError("TFI2 returned an invalid DMR Coding record list.", 502, "invalid_dmr_coding_records")
        return payload

    def get_dmr_coding_record(self, access_token: str, record_id: str) -> dict | None:
        params = {
            "select": "id,production_date,product_code,line,stop_time,resume_time,downtime_minutes,downtime_hours,category,factor,reason,product_code_reference_status,completeness_status,version,record_status",
            "id": f"eq.{record_id}", "limit": "1",
        }
        payload = self._request(
            "GET", f"/rest/v1/tfi_dmr_coding_records?{urlencode(params)}",
            access_token=access_token
        )
        if not isinstance(payload, list):
            raise SupabaseError("TFI2 returned an invalid DMR Coding record.", 502, "invalid_dmr_coding_record")
        return payload[0] if payload else None

    def get_dmr_coding_revisions(self, access_token: str, record_id: str) -> list[dict]:
        params = {
            "select": "id,dmr_coding_record_id,version,before_data,after_data,changed_fields,change_reason,changed_by,changed_at",
            "dmr_coding_record_id": f"eq.{record_id}", "order": "version.desc", "limit": "100",
        }
        payload = self._request(
            "GET", f"/rest/v1/tfi_dmr_coding_revisions?{urlencode(params)}",
            access_token=access_token
        )
        if not isinstance(payload, list):
            raise SupabaseError("TFI2 returned an invalid DMR Coding revision list.", 502, "invalid_dmr_coding_revisions")
        return payload

    def create_dmr_coding_records(self, access_token: str, records: list[dict]) -> dict:
        payload = self._request(
            "POST", "/rest/v1/rpc/tfi_create_dmr_coding_records",
            access_token=access_token, body={"p_records": records}, timeout=45
        )
        if not isinstance(payload, dict):
            raise SupabaseError("TFI2 returned an invalid DMR Coding save result.", 502, "invalid_dmr_coding_save")
        return payload

    def update_dmr_coding_record(
        self, access_token: str, record_id: str, expected_version: int,
        changes: dict, change_reason: str | None = None
    ) -> dict:
        payload = self._request(
            "POST", "/rest/v1/rpc/tfi_update_dmr_coding_record",
            access_token=access_token,
            body={
                "p_record_id": record_id, "p_expected_version": expected_version,
                "p_changes": changes, "p_change_reason": change_reason,
            }
        )
        if not isinstance(payload, dict):
            raise SupabaseError("TFI2 returned an invalid DMR Coding update result.", 502, "invalid_dmr_coding_update")
        return payload

    # DMR Production manual operational API ---------------------------------
    def get_dmr_production_reference_data(self, access_token: str) -> dict:
        payload = self._request(
            "POST",
            "/rest/v1/rpc/tfi_get_dmr_production_reference_data",
            access_token=access_token,
            body={},
        )
        if not isinstance(payload, dict):
            raise SupabaseError("TFI2 returned invalid DMR Production reference data.", 502, "invalid_dmr_production_reference_data")
        return payload

    def get_dmr_production_records(
        self,
        access_token: str,
        *,
        limit: int = 25,
        offset: int = 0,
        date_from: str | None = None,
        date_to: str | None = None,
        product_code: str | None = None,
        line: str | None = None,
        category: str | None = None,
    ) -> list[dict]:
        params = {
            "select": "id,production_date,product_code,line,stop_time,resume_time,category,source_column_i,source_column_j,remarks,downtime_minutes,source_import_row_id,version,record_status,created_at,updated_at,created_by,updated_by",
            "record_status": "eq.active",
            "order": "production_date.desc,created_at.desc",
            "limit": str(min(100, max(1, int(limit)))),
            "offset": str(max(0, int(offset))),
        }
        date_filters = []
        if date_from:
            date_filters.append(f"production_date.gte.{date_from}")
        if date_to:
            date_filters.append(f"production_date.lte.{date_to}")
        if date_filters:
            params["and"] = "(" + ",".join(date_filters) + ")"
        if product_code:
            params["product_code"] = f"eq.{product_code}"
        if line:
            params["line"] = f"eq.{line}"
        if category:
            params["category"] = f"eq.{category}"
        payload = self._request(
            "GET",
            f"/rest/v1/tfi_dmr_production_records?{urlencode(params)}",
            access_token=access_token,
        )
        if not isinstance(payload, list):
            raise SupabaseError("TFI2 returned an invalid DMR Production record list.", 502, "invalid_dmr_production_records")
        return payload

    def get_dmr_production_record(self, access_token: str, record_id: str) -> dict | None:
        params = {
            "select": "id,production_date,product_code,line,stop_time,resume_time,category,source_column_i,source_column_j,remarks,downtime_minutes,source_import_row_id,version,record_status",
            "id": f"eq.{record_id}",
            "limit": "1",
        }
        payload = self._request(
            "GET",
            f"/rest/v1/tfi_dmr_production_records?{urlencode(params)}",
            access_token=access_token,
        )
        if not isinstance(payload, list):
            raise SupabaseError("TFI2 returned an invalid DMR Production record.", 502, "invalid_dmr_production_record")
        return payload[0] if payload else None

    def get_dmr_production_revisions(self, access_token: str, record_id: str) -> list[dict]:
        params = {
            "select": "id,dmr_production_record_id,version,before_data,after_data,changed_fields,change_reason,changed_by,changed_at",
            "dmr_production_record_id": f"eq.{record_id}",
            "order": "version.desc",
            "limit": "100",
        }
        payload = self._request(
            "GET",
            f"/rest/v1/tfi_dmr_production_revisions?{urlencode(params)}",
            access_token=access_token,
        )
        if not isinstance(payload, list):
            raise SupabaseError("TFI2 returned an invalid DMR Production revision list.", 502, "invalid_dmr_production_revisions")
        return payload

    def create_dmr_production_records(self, access_token: str, records: list[dict]) -> dict:
        payload = self._request(
            "POST",
            "/rest/v1/rpc/tfi_create_dmr_production_records",
            access_token=access_token,
            body={"p_records": records},
            timeout=45,
        )
        if not isinstance(payload, dict):
            raise SupabaseError("TFI2 returned an invalid DMR Production save result.", 502, "invalid_dmr_production_save")
        return payload

    def update_dmr_production_record(
        self,
        access_token: str,
        record_id: str,
        expected_version: int,
        changes: dict,
        change_reason: str | None = None,
    ) -> dict:
        payload = self._request(
            "POST",
            "/rest/v1/rpc/tfi_update_dmr_production_record",
            access_token=access_token,
            body={
                "p_record_id": record_id,
                "p_expected_version": expected_version,
                "p_changes": changes,
                "p_change_reason": change_reason,
            },
        )
        if not isinstance(payload, dict):
            raise SupabaseError("TFI2 returned an invalid DMR Production update result.", 502, "invalid_dmr_production_update")
        return payload

    # Production Entry + Production Summary operational API ----------------
    def get_production_entry_catalog(self, access_token: str) -> dict:
        payload = self._request(
            "POST",
            "/rest/v1/rpc/tfi_get_production_entry_catalog",
            access_token=access_token,
            body={},
        )
        if (
            not isinstance(payload, dict)
            or len(payload.get("product_names") or []) != 32
            or len(payload.get("form", {}).get("slots") or []) != 12
            or len(payload.get("summary", {}).get("headers") or []) != 24
        ):
            raise SupabaseError(
                "TFI2 returned an incomplete Production Entry source catalog.",
                502,
                "invalid_production_entry_catalog",
            )
        return payload

    def get_production_entry_summary(self, access_token: str) -> dict:
        payload = self._request(
            "POST",
            "/rest/v1/rpc/tfi_get_production_entry_summary",
            access_token=access_token,
            body={},
        )
        if not isinstance(payload, dict):
            raise SupabaseError(
                "TFI2 returned an invalid Production Summary metric response.",
                502,
                "invalid_production_entry_summary",
            )
        return payload

    def get_production_entry_records(
        self,
        access_token: str,
        *,
        date_from: str | None = None,
        date_to: str | None = None,
        line: str | None = None,
        product_name: str | None = None,
        product_code: str | None = None,
        search: str | None = None,
        page: int = 1,
        page_size: int = 10,
        sort_key: str = "date",
        sort_direction: str = "desc",
    ) -> dict:
        payload = self._request(
            "POST",
            "/rest/v1/rpc/tfi_get_production_entry_records",
            access_token=access_token,
            body={
                "p_date_from": date_from,
                "p_date_to": date_to,
                "p_line": line,
                "p_product_name": product_name,
                "p_product_code": product_code,
                "p_search": search,
                "p_page": page,
                "p_page_size": page_size,
                "p_sort_key": sort_key,
                "p_sort_direction": sort_direction,
            },
            timeout=30,
        )
        if not isinstance(payload, dict) or not isinstance(payload.get("records"), list):
            raise SupabaseError(
                "TFI2 returned an invalid Production Summary record list.",
                502,
                "invalid_production_entry_records",
            )
        return payload

    def get_production_entry_record(self, access_token: str, record_id: str) -> dict | None:
        params = {
            "select": "id,source_row_number,record_data,version,record_status",
            "id": f"eq.{record_id}",
            "limit": "1",
        }
        payload = self._request(
            "GET",
            f"/rest/v1/tfi_production_entry_records?{urlencode(params)}",
            access_token=access_token,
        )
        if not isinstance(payload, list):
            raise SupabaseError(
                "TFI2 returned an invalid Production Entry record.",
                502,
                "invalid_production_entry_record",
            )
        return payload[0] if payload else None

    def get_production_entry_revisions(self, access_token: str, record_id: str) -> list[dict]:
        params = {
            "select": "id,production_entry_record_id,version,before_data,after_data,changed_columns,change_reason,changed_by,changed_at",
            "production_entry_record_id": f"eq.{record_id}",
            "order": "version.desc",
            "limit": "100",
        }
        payload = self._request(
            "GET",
            f"/rest/v1/tfi_production_entry_revisions?{urlencode(params)}",
            access_token=access_token,
        )
        if not isinstance(payload, list):
            raise SupabaseError(
                "TFI2 returned an invalid Production Entry revision list.",
                502,
                "invalid_production_entry_revisions",
            )
        return payload

    def create_production_entry_records(self, access_token: str, records: list[dict]) -> dict:
        payload = self._request(
            "POST",
            "/rest/v1/rpc/tfi_create_production_entry_records",
            access_token=access_token,
            body={"p_records": records},
            timeout=45,
        )
        if not isinstance(payload, dict):
            raise SupabaseError(
                "TFI2 returned an invalid Production Entry save result.",
                502,
                "invalid_production_entry_save",
            )
        return payload

    def update_production_entry_record(
        self,
        access_token: str,
        record_id: str,
        expected_version: int,
        changes: dict,
        change_reason: str | None = None,
    ) -> dict:
        payload = self._request(
            "POST",
            "/rest/v1/rpc/tfi_update_production_entry_record",
            access_token=access_token,
            body={
                "p_record_id": record_id,
                "p_expected_version": expected_version,
                "p_changes": changes,
                "p_change_reason": change_reason,
            },
        )
        if not isinstance(payload, dict):
            raise SupabaseError(
                "TFI2 returned an invalid Production Entry update result.",
                502,
                "invalid_production_entry_update",
            )
        return payload

    # Production Schedule + Schedule Summary operational API --------------
    def get_production_schedule_catalog(self, access_token: str) -> dict:
        payload = self._request(
            "POST",
            "/rest/v1/rpc/tfi_get_production_schedule_catalog",
            access_token=access_token,
            body={},
            timeout=45,
        )
        if (
            not isinstance(payload, dict)
            or len(payload.get("product_groups") or []) != 43
            or len(payload.get("products") or []) != 100
            or len(payload.get("form", {}).get("source_rows") or []) != 10
            or len(payload.get("source", {}).get("schedule_summary", {}).get("source_range", "")) == 0
        ):
            raise SupabaseError(
                "TFI2 returned an incomplete Production Schedule source catalog.",
                502,
                "invalid_production_schedule_catalog",
            )
        code_count = sum(
            len(codes)
            for codes in (payload.get("group_codes") or {}).values()
            if isinstance(codes, list)
        )
        if code_count != 100:
            raise SupabaseError(
                "TFI2 Production Schedule product-group mapping is incomplete.",
                502,
                "incomplete_production_schedule_product_mapping",
            )
        return payload

    def get_production_schedule_summary(self, access_token: str) -> dict:
        payload = self._request(
            "POST",
            "/rest/v1/rpc/tfi_get_production_schedule_summary",
            access_token=access_token,
            body={},
        )
        if not isinstance(payload, dict):
            raise SupabaseError(
                "TFI2 returned an invalid Schedule Summary metric response.",
                502,
                "invalid_production_schedule_summary",
            )
        return payload

    def get_production_schedule_form_by_date(
        self, access_token: str, production_date: str
    ) -> dict:
        payload = self._request(
            "POST",
            "/rest/v1/rpc/tfi_get_production_schedule_form_by_date",
            access_token=access_token,
            body={"p_production_date": production_date},
        )
        if not isinstance(payload, dict) or "form" not in payload:
            raise SupabaseError(
                "TFI2 returned an invalid Production Schedule form response.",
                502,
                "invalid_production_schedule_form",
            )
        return payload

    def get_production_schedule_records(
        self,
        access_token: str,
        *,
        date_from: str | None = None,
        date_to: str | None = None,
        day: str | None = None,
        line: str | None = None,
        area: str | None = None,
        product_name: str | None = None,
        production_code: str | None = None,
        pr_number: str | None = None,
        search: str | None = None,
        page: int = 1,
        page_size: int = 10,
        sort_key: str = "date",
        sort_direction: str = "desc",
    ) -> dict:
        payload = self._request(
            "POST",
            "/rest/v1/rpc/tfi_get_production_schedule_records",
            access_token=access_token,
            body={
                "p_date_from": date_from,
                "p_date_to": date_to,
                "p_day": day,
                "p_line": line,
                "p_area": area,
                "p_product_name": product_name,
                "p_production_code": production_code,
                "p_pr_number": pr_number,
                "p_search": search,
                "p_page": page,
                "p_page_size": page_size,
                "p_sort_key": sort_key,
                "p_sort_direction": sort_direction,
            },
            timeout=30,
        )
        if not isinstance(payload, dict) or not isinstance(payload.get("records"), list):
            raise SupabaseError(
                "TFI2 returned an invalid Schedule Summary record list.",
                502,
                "invalid_production_schedule_records",
            )
        return payload

    def create_production_schedule_form(
        self,
        access_token: str,
        production_date: str,
        available_pax_total: str | None,
        rows: list[dict],
    ) -> dict:
        payload = self._request(
            "POST",
            "/rest/v1/rpc/tfi_create_production_schedule_form",
            access_token=access_token,
            body={
                "p_production_date": production_date,
                "p_available_pax_total": available_pax_total,
                "p_rows": rows,
            },
            timeout=45,
        )
        if not isinstance(payload, dict) or not payload.get("id"):
            raise SupabaseError(
                "TFI2 returned an invalid Production Schedule save result.",
                502,
                "invalid_production_schedule_save",
            )
        return payload

    def update_production_schedule_form(
        self,
        access_token: str,
        form_id: str,
        expected_version: int,
        production_date: str,
        available_pax_total: str | None,
        rows: list[dict],
        change_reason: str | None = None,
    ) -> dict:
        payload = self._request(
            "POST",
            "/rest/v1/rpc/tfi_update_production_schedule_form",
            access_token=access_token,
            body={
                "p_form_id": form_id,
                "p_expected_version": expected_version,
                "p_production_date": production_date,
                "p_available_pax_total": available_pax_total,
                "p_rows": rows,
                "p_change_reason": change_reason,
            },
            timeout=45,
        )
        if not isinstance(payload, dict) or not payload.get("id"):
            raise SupabaseError(
                "TFI2 returned an invalid Production Schedule update result.",
                502,
                "invalid_production_schedule_update",
            )
        return payload

    def get_production_schedule_revisions(
        self, access_token: str, form_id: str
    ) -> list[dict]:
        payload = self._request(
            "POST",
            "/rest/v1/rpc/tfi_get_production_schedule_revisions",
            access_token=access_token,
            body={"p_form_id": form_id},
        )
        if not isinstance(payload, dict) or not isinstance(payload.get("revisions"), list):
            raise SupabaseError(
                "TFI2 returned an invalid Production Schedule revision list.",
                502,
                "invalid_production_schedule_revisions",
            )
        return payload["revisions"]

    # Product Entry operational API ----------------------------------------
    def get_product_entry_catalog(self, access_token: str) -> dict:
        payload = self._request(
            "POST",
            "/rest/v1/rpc/tfi_get_product_entry_catalog",
            access_token=access_token,
            body={},
            timeout=45,
        )
        if not isinstance(payload, dict) or not isinstance(payload.get("blocks"), list):
            raise SupabaseError("TFI2 returned an invalid Product Entry block catalog.", 502, "invalid_product_entry_catalog")
        if len(payload["blocks"]) != 39:
            raise SupabaseError("TFI2 Product Entry catalog does not contain all 39 source blocks.", 502, "incomplete_product_entry_catalog")
        return payload

    def get_yield_log_source_records(
        self,
        access_token: str,
        *,
        limit: int = 100,
        offset: int = 0,
        date_from: str | None = None,
        date_to: str | None = None,
        product_key: str | None = None,
        product_code: str | None = None,
    ) -> list[dict]:
        """Fetch active Product Entry source rows for the read-only Yield Log projection."""
        params = {
            "select": (
                "id,block_key,product_key,production_date,production_date_text,product_code,"
                "review_status,record_data,record_status,version,created_at,updated_at"
            ),
            "record_status": "eq.active",
            "order": "production_date.desc.nullslast,created_at.desc,id.desc",
            "limit": str(min(1000, max(1, int(limit)))),
            "offset": str(max(0, int(offset))),
        }
        if product_key:
            params["product_key"] = f"eq.{product_key}"
        if product_code:
            params["product_code"] = f"eq.{product_code}"
        if date_from or date_to:
            date_filters = []
            if date_from:
                date_filters.append(f"production_date.gte.{date_from}")
            if date_to:
                date_filters.append(f"production_date.lte.{date_to}")
            date_clause = "and(" + ",".join(date_filters) + ")" if len(date_filters) > 1 else date_filters[0]
            params["or"] = f"({date_clause},production_date.is.null)"
        payload = self._request(
            "GET",
            f"/rest/v1/tfi_product_entry_records?{urlencode(params)}",
            access_token=access_token,
        )
        if not isinstance(payload, list):
            raise SupabaseError("TFI2 returned an invalid Yield Log source record list.", 502, "invalid_yield_log_source_records")
        return payload

    def get_product_entry_records(
        self,
        access_token: str,
        *,
        block_key: str,
        limit: int = 50,
        offset: int = 0,
        date_from: str | None = None,
        date_to: str | None = None,
        product_code: str | None = None,
        pr_number: str | None = None,
        review_status: str | None = None,
    ) -> list[dict]:
        params = {
            "select": (
                "id,block_key,product_key,production_date,production_date_text,product_code,"
                "pr_number,review_status,record_data,completeness_status,blank_fields,"
                "record_status,version,created_at,updated_at,created_by,updated_by"
            ),
            "block_key": f"eq.{block_key}",
            "record_status": "eq.active",
            "order": "production_date.desc.nullslast,created_at.desc",
            "limit": str(min(100, max(1, int(limit)))),
            "offset": str(max(0, int(offset))),
        }
        date_filters = []
        if date_from:
            date_filters.append(f"production_date.gte.{date_from}")
        if date_to:
            date_filters.append(f"production_date.lte.{date_to}")
        if date_filters:
            params["and"] = "(" + ",".join(date_filters) + ")"
        if product_code:
            params["product_code"] = f"eq.{product_code}"
        if pr_number:
            params["pr_number"] = f"eq.{pr_number}"
        if review_status:
            params["review_status"] = f"eq.{review_status}"
        payload = self._request(
            "GET",
            f"/rest/v1/tfi_product_entry_records?{urlencode(params)}",
            access_token=access_token,
        )
        if not isinstance(payload, list):
            raise SupabaseError("TFI2 returned an invalid Product Entry record list.", 502, "invalid_product_entry_records")
        return payload

    def get_product_entry_record(self, access_token: str, record_id: str) -> dict | None:
        params = {
            "select": "id,block_key,product_key,record_data,version,record_status",
            "id": f"eq.{record_id}",
            "limit": "1",
        }
        payload = self._request(
            "GET",
            f"/rest/v1/tfi_product_entry_records?{urlencode(params)}",
            access_token=access_token,
        )
        if not isinstance(payload, list):
            raise SupabaseError("TFI2 returned an invalid Product Entry record.", 502, "invalid_product_entry_record")
        return payload[0] if payload else None

    def get_product_entry_revisions(self, access_token: str, record_id: str) -> list[dict]:
        params = {
            "select": "id,product_entry_record_id,version,before_data,after_data,changed_columns,change_reason,changed_by,changed_at",
            "product_entry_record_id": f"eq.{record_id}",
            "order": "version.desc",
            "limit": "100",
        }
        payload = self._request(
            "GET",
            f"/rest/v1/tfi_product_entry_revisions?{urlencode(params)}",
            access_token=access_token,
        )
        if not isinstance(payload, list):
            raise SupabaseError("TFI2 returned an invalid Product Entry revision list.", 502, "invalid_product_entry_revisions")
        return payload

    def create_product_entry_records(
        self, access_token: str, block_key: str, records: list[dict]
    ) -> dict:
        payload = self._request(
            "POST",
            "/rest/v1/rpc/tfi_create_product_entry_records",
            access_token=access_token,
            body={"p_block_key": block_key, "p_records": records},
            timeout=45,
        )
        if not isinstance(payload, dict):
            raise SupabaseError("TFI2 returned an invalid Product Entry save result.", 502, "invalid_product_entry_save")
        return payload

    def update_product_entry_record(
        self,
        access_token: str,
        record_id: str,
        expected_version: int,
        changes: dict,
        change_reason: str | None = None,
    ) -> dict:
        payload = self._request(
            "POST",
            "/rest/v1/rpc/tfi_update_product_entry_record",
            access_token=access_token,
            body={
                "p_record_id": record_id,
                "p_expected_version": expected_version,
                "p_changes": changes,
                "p_change_reason": change_reason,
            },
        )
        if not isinstance(payload, dict):
            raise SupabaseError("TFI2 returned an invalid Product Entry update result.", 502, "invalid_product_entry_update")
        return payload

    # CO QA cost extension — every cost row is linked to one Product Entry UUID.
    def get_co_qa_records(
        self,
        access_token: str,
        *,
        block_key: str | None = None,
        block_keys: list[str] | None = None,
        limit: int = 50,
        offset: int = 0,
        date_from: str | None = None,
        date_to: str | None = None,
        product_code: str | None = None,
        pr_number: str | None = None,
    ) -> list[dict]:
        params = {
            "select": (
                "id,block_key,product_key,production_date,production_date_text,"
                "product_code,pr_number,record_data,completeness_status,blank_fields,"
                "record_status,version,created_at,updated_at"
            ),
            "record_status": "eq.active",
            "order": "production_date.desc.nullslast,created_at.desc",
            "limit": str(min(100, max(1, int(limit)))),
            "offset": str(max(0, int(offset))),
        }
        if block_key:
            params["block_key"] = f"eq.{block_key}"
        elif block_keys:
            params["block_key"] = "in.(" + ",".join(block_keys) + ")"
        date_filters = []
        if date_from:
            date_filters.append(f"production_date.gte.{date_from}")
        if date_to:
            date_filters.append(f"production_date.lte.{date_to}")
        if date_filters:
            params["and"] = "(" + ",".join(date_filters) + ")"
        if product_code:
            params["product_code"] = f"eq.{product_code}"
        if pr_number:
            params["pr_number"] = f"eq.{pr_number}"

        records = self._request(
            "GET",
            f"/rest/v1/tfi_product_entry_records?{urlencode(params)}",
            access_token=access_token,
        )
        if not isinstance(records, list):
            raise SupabaseError("TFI2 returned an invalid CO QA Product Entry list.", 502, "invalid_co_qa_records")
        if not records:
            return []

        record_ids = [str(row.get("id")) for row in records if row.get("id")]
        cost_params = {
            "select": (
                "product_entry_record_id,labels_cost_per_piece_y,box_cost_per_piece_z,"
                "can_cost_per_piece_aa,lid_cover_cost_per_piece_ab,labels_cost_per_piece_ac,"
                "box_cost_per_piece_ad,version,created_at,updated_at"
            ),
            "product_entry_record_id": "in.(" + ",".join(record_ids) + ")",
        }
        cost_rows = self._request(
            "GET",
            f"/rest/v1/tfi_co_qa_cost_records?{urlencode(cost_params)}",
            access_token=access_token,
        )
        if not isinstance(cost_rows, list):
            raise SupabaseError("TFI2 returned an invalid CO QA cost list.", 502, "invalid_co_qa_cost_records")

        cost_by_record = {str(row["product_entry_record_id"]): row for row in cost_rows}
        for record in records:
            cost = cost_by_record.get(str(record.get("id")))
            record["costs"] = (
                {
                    "Y": cost.get("labels_cost_per_piece_y"),
                    "Z": cost.get("box_cost_per_piece_z"),
                    "AA": cost.get("can_cost_per_piece_aa"),
                    "AB": cost.get("lid_cover_cost_per_piece_ab"),
                    "AC": cost.get("labels_cost_per_piece_ac"),
                    "AD": cost.get("box_cost_per_piece_ad"),
                }
                if cost else None
            )
            record["cost_version"] = int(cost.get("version", 0)) if cost else 0
            record["cost_updated_at"] = cost.get("updated_at") if cost else None
        return records

    def upsert_co_qa_cost_record(
        self,
        access_token: str,
        record_id: str,
        expected_version: int | None,
        costs: dict,
        change_reason: str | None = None,
    ) -> dict:
        payload = self._request(
            "POST",
            "/rest/v1/rpc/tfi_upsert_co_qa_cost_record",
            access_token=access_token,
            body={
                "p_product_entry_record_id": record_id,
                "p_expected_version": expected_version,
                "p_costs": costs,
                "p_change_reason": change_reason,
            },
        )
        if not isinstance(payload, dict):
            raise SupabaseError("TFI2 returned an invalid CO QA cost save result.", 502, "invalid_co_qa_cost_save")
        return payload

    def get_co_qa_cost_revisions(self, access_token: str, record_id: str) -> list[dict]:
        params = {
            "select": "id,product_entry_record_id,version,before_data,after_data,changed_columns,change_reason,changed_by,changed_at",
            "product_entry_record_id": f"eq.{record_id}",
            "order": "version.desc",
            "limit": "100",
        }
        payload = self._request(
            "GET",
            f"/rest/v1/tfi_co_qa_cost_revisions?{urlencode(params)}",
            access_token=access_token,
        )
        if not isinstance(payload, list):
            raise SupabaseError("TFI2 returned an invalid CO QA cost revision list.", 502, "invalid_co_qa_cost_revisions")
        return payload

    # Selective operational import API -------------------------------------
    def get_import_destinations(self, access_token: str) -> list[dict]:
        query = urlencode({
            "select": (
                "module_key,source_sheet_id,source_sheet_title,grid_rows,grid_columns,"
                "header_rows,first_data_row,source_kind,contract_status,required_columns,"
                "input_columns,formula_columns,source_notes,is_active"
            ),
            "is_active": "eq.true",
            "order": "module_key.asc",
        })
        payload = self._request(
            "GET",
            f"/rest/v1/tfi_import_destinations?{query}",
            access_token=access_token,
        )
        if not isinstance(payload, list):
            raise SupabaseError("TFI2 returned an invalid import destination list.", 502, "invalid_import_destinations")
        return payload

    def get_import_destination(self, access_token: str, module_key: str) -> dict:
        destinations = self.get_import_destinations(access_token)
        destination = next((item for item in destinations if item.get("module_key") == module_key), None)
        if not destination:
            raise SupabaseError(
                "This module is not an approved import destination for your TFI account.",
                403,
                "import_destination_not_allowed",
            )
        return destination

    def create_import_batch(
        self,
        access_token: str,
        *,
        module_key: str,
        source_name: str,
        source_workbook_key: str,
        source_file_sha256: str | None,
        source_file_size: int | None,
        source_sheet_id: int,
        source_type: str = "xlsx",
        source_spreadsheet_id: str | None = None,
    ) -> dict:
        if source_type not in {"xlsx", "google_sheets"}:
            raise SupabaseError("The selected import source type is not supported.", 400, "invalid_import_source_type")
        payload = self._request(
            "POST",
            "/rest/v1/rpc/tfi_create_import_batch",
            access_token=access_token,
            body={
                "p_module_key": module_key,
                "p_source_type": source_type,
                "p_source_name": source_name,
                "p_source_workbook_key": source_workbook_key,
                "p_source_file_sha256": source_file_sha256,
                "p_source_file_size": source_file_size,
                "p_source_spreadsheet_id": source_spreadsheet_id,
                "p_source_sheet_id": source_sheet_id,
            },
        )
        if not isinstance(payload, dict) or not payload.get("id"):
            raise SupabaseError("TFI2 did not return a valid import batch.", 502, "invalid_import_batch")
        return payload

    def stage_import_rows(
        self, access_token: str, batch_id: str, rows: list[dict], module_key: str | None = None
    ) -> dict:
        rpc = (
            "tfi_stage_hourly_production_import_rows"
            if module_key in {"hourly_meat", "hourly_coding", "hourly_agri"}
            else "tfi_stage_import_rows"
        )
        payload = self._request(
            "POST",
            f"/rest/v1/rpc/{rpc}",
            access_token=access_token,
            body={"p_batch_id": batch_id, "p_rows": rows},
            timeout=45,
        )
        if not isinstance(payload, dict):
            raise SupabaseError("TFI2 returned an invalid import staging response.", 502, "invalid_import_stage")
        return payload

    def finalize_hourly_production_import(
        self, access_token: str, batch_id: str, row_ids: list[str]
    ) -> dict:
        payload = self._request(
            "POST",
            "/rest/v1/rpc/tfi_finalize_hourly_production_import",
            access_token=access_token,
            body={"p_batch_id": batch_id, "p_row_ids": row_ids},
            timeout=45,
        )
        if not isinstance(payload, dict):
            raise SupabaseError("TFI2 returned an invalid Hourly Production import response.", 502, "invalid_hourly_import")
        return payload

    def complete_import_scan(self, access_token: str, batch_id: str, stats: dict) -> dict:
        payload = self._request(
            "POST",
            "/rest/v1/rpc/tfi_complete_import_scan",
            access_token=access_token,
            body={"p_batch_id": batch_id, "p_scan_stats": stats},
        )
        if not isinstance(payload, dict):
            raise SupabaseError("TFI2 returned an invalid import scan result.", 502, "invalid_import_scan")
        return payload

    def fail_import_batch(self, access_token: str, batch_id: str, message: str) -> dict:
        payload = self._request(
            "POST",
            "/rest/v1/rpc/tfi_fail_import_batch",
            access_token=access_token,
            body={"p_batch_id": batch_id, "p_error_message": str(message)[:500]},
        )
        return payload if isinstance(payload, dict) else {}

    def get_import_batches(
        self,
        access_token: str,
        *,
        module_key: str | None = None,
        limit: int = 100,
    ) -> list[dict]:
        params = {
            "select": (
                "id,batch_ref,module_key,source_sheet_id,source_sheet_title,source_type,"
                "source_name,status,rows_inspected,rows_staged,blank_rows,formula_cells,"
                "derived_rows,unmapped_rows,rows_inserted,rows_incomplete,rows_duplicates,"
                "rows_held,rows_failed,created_by,created_at,scanned_at,completed_at,error_message"
            ),
            "order": "created_at.desc",
            "limit": str(min(200, max(1, int(limit)))),
        }
        if module_key:
            params["module_key"] = f"eq.{module_key}"
        payload = self._request(
            "GET",
            f"/rest/v1/tfi_import_batches?{urlencode(params)}",
            access_token=access_token,
        )
        if not isinstance(payload, list):
            raise SupabaseError("TFI2 returned an invalid import history list.", 502, "invalid_import_history")
        return payload

    def get_import_batch(self, access_token: str, batch_id: str) -> dict | None:
        params = {
            "select": (
                "id,batch_ref,module_key,source_sheet_id,source_sheet_title,source_type,"
                "source_name,status,rows_inspected,rows_staged,blank_rows,formula_cells,"
                "derived_rows,unmapped_rows,rows_inserted,rows_incomplete,rows_duplicates,"
                "rows_held,rows_failed,created_by,created_at,scanned_at,completed_at,error_message"
            ),
            "id": f"eq.{batch_id}",
            "limit": "1",
        }
        payload = self._request(
            "GET",
            f"/rest/v1/tfi_import_batches?{urlencode(params)}",
            access_token=access_token,
        )
        if not isinstance(payload, list):
            raise SupabaseError("TFI2 returned an invalid import batch response.", 502, "invalid_import_batch")
        return payload[0] if payload else None

    def get_import_rows(
        self,
        access_token: str,
        batch_id: str,
        *,
        limit: int = 100,
        offset: int = 0,
        classification: str | None = None,
        import_status: str | None = None,
        duplicate_status: str | None = None,
        row_ids: list[str] | None = None,
    ) -> list[dict]:
        params = {
            "select": (
                "id,batch_id,source_row_number,source_locator,source_values,source_formulas,source_fingerprint,"
                "classification,completeness_status,missing_fields,duplicate_status,"
                "review_decision,review_reason,import_status,duplicate_record_id,"
                "destination_record_id,error_code,error_message,created_at"
            ),
            "batch_id": f"eq.{batch_id}",
            "order": "source_row_number.asc",
            "limit": str(min(200, max(1, int(limit)))),
            "offset": str(max(0, int(offset))),
        }
        if classification in {"operational", "derived", "helper", "summary", "unmapped", "invalid"}:
            params["classification"] = f"eq.{classification}"
        if import_status in {"pending", "inserted", "skipped_existing", "held", "failed", "excluded"}:
            params["import_status"] = f"eq.{import_status}"
        if duplicate_status in {"none", "exact_source_duplicate", "possible_duplicate", "confirmed_duplicate", "distinct_new"}:
            params["duplicate_status"] = f"eq.{duplicate_status}"
        if row_ids:
            params["id"] = "in.(" + ",".join(row_ids) + ")"
        payload = self._request(
            "GET",
            f"/rest/v1/tfi_import_rows?{urlencode(params)}",
            access_token=access_token,
        )
        if not isinstance(payload, list):
            raise SupabaseError("TFI2 returned an invalid import row list.", 502, "invalid_import_rows")
        return payload

    def set_import_row_decision(
        self,
        access_token: str,
        batch_id: str,
        row_id: str,
        decision: str,
        reason: str | None = None,
    ) -> dict:
        payload = self._request(
            "POST",
            "/rest/v1/rpc/tfi_set_import_row_decision",
            access_token=access_token,
            body={
                "p_batch_id": batch_id,
                "p_row_id": row_id,
                "p_decision": decision,
                "p_reason": reason,
            },
        )
        if not isinstance(payload, dict):
            raise SupabaseError("TFI2 returned an invalid duplicate-review response.", 502, "invalid_import_decision")
        return payload

    def finalize_import_batch(
        self,
        access_token: str,
        batch_id: str,
        row_ids: list[str],
    ) -> dict:
        payload = self._request(
            "POST",
            "/rest/v1/rpc/tfi_finalize_import_batch",
            access_token=access_token,
            body={"p_batch_id": batch_id, "p_row_ids": row_ids},
            timeout=45,
        )
        if not isinstance(payload, dict):
            raise SupabaseError("TFI2 returned an invalid final import response.", 502, "invalid_import_finalization")
        return payload

    def save_all_dmp_import_batch(self, access_token: str, batch_id: str) -> dict:
        payload = self._request(
            "POST", "/rest/v1/rpc/tfi_save_all_dmp_import_batch",
            access_token=access_token, body={"p_batch_id": batch_id}, timeout=120,
        )
        if not isinstance(payload, dict):
            raise SupabaseError("TFI2 returned an invalid DMP import result.", 502, "invalid_dmp_import_result")
        return payload

    def prepare_dmp_import_drafts(self, access_token: str, row_ids: list[str]) -> dict:
        payload = self._request(
            "POST", "/rest/v1/rpc/tfi_prepare_dmp_import_drafts",
            access_token=access_token, body={"p_row_ids": row_ids}, timeout=45,
        )
        if not isinstance(payload, dict):
            raise SupabaseError("TFI2 returned an invalid DMP draft preparation response.", 502, "invalid_dmp_draft_preparation")
        return payload

    def get_dmp_import_drafts(
        self, access_token: str, *, status: str | None = None, limit: int = 100, offset: int = 0
    ) -> dict:
        payload = self._request(
            "POST", "/rest/v1/rpc/tfi_get_dmp_import_drafts",
            access_token=access_token,
            body={"p_status": status, "p_limit": min(500, max(1, int(limit))), "p_offset": max(0, int(offset))},
        )
        if not isinstance(payload, dict) or not isinstance(payload.get("drafts"), list):
            raise SupabaseError("TFI2 returned an invalid DMP draft list.", 502, "invalid_dmp_drafts")
        return payload

    def update_dmp_import_draft(
        self, access_token: str, draft_id: str, expected_version: int,
        values: dict, classification: str | None = None,
    ) -> dict:
        payload = self._request(
            "POST", "/rest/v1/rpc/tfi_update_dmp_import_draft",
            access_token=access_token,
            body={"p_draft_id": draft_id, "p_expected_version": expected_version,
                  "p_values": values, "p_classification": classification},
        )
        if not isinstance(payload, dict):
            raise SupabaseError("TFI2 returned an invalid DMP draft update.", 502, "invalid_dmp_draft_update")
        return payload

    def approve_dmp_import_draft(self, access_token: str, draft_id: str, expected_version: int) -> dict:
        payload = self._request(
            "POST", "/rest/v1/rpc/tfi_approve_dmp_import_draft",
            access_token=access_token,
            body={"p_draft_id": draft_id, "p_expected_version": expected_version},
            timeout=45,
        )
        if not isinstance(payload, dict):
            raise SupabaseError("TFI2 returned an invalid DMP draft approval response.", 502, "invalid_dmp_draft_approval")
        return payload

    def finalize_coding_dpr_import(
        self,
        access_token: str,
        batch_id: str,
        row_ids: list[str],
    ) -> dict:
        payload = self._request(
            "POST",
            "/rest/v1/rpc/tfi_finalize_coding_dpr_import",
            access_token=access_token,
            body={"p_batch_id": batch_id, "p_row_ids": row_ids},
            timeout=45,
        )
        if not isinstance(payload, dict):
            raise SupabaseError("TFI2 returned an invalid Coding DPR import response.", 502, "invalid_coding_dpr_import")
        return payload

    def finalize_dmr_coding_import(
        self,
        access_token: str,
        batch_id: str,
        row_ids: list[str],
    ) -> dict:
        payload = self._request(
            "POST",
            "/rest/v1/rpc/tfi_finalize_dmr_coding_import",
            access_token=access_token,
            body={"p_batch_id": batch_id, "p_row_ids": row_ids},
            timeout=45,
        )
        if not isinstance(payload, dict):
            raise SupabaseError("TFI2 returned an invalid DMR Coding import response.", 502, "invalid_dmr_coding_import")
        return payload

    # Hourly Production — shared backend API for three independent modules ----
    def get_hourly_production_catalog(self, access_token: str, module_key: str) -> dict:
        payload = self._request(
            "POST", "/rest/v1/rpc/tfi_get_hourly_production_catalog",
            access_token=access_token, body={"p_module_key": module_key}
        )
        if not isinstance(payload, dict) or not isinstance(payload.get("products"), list):
            raise SupabaseError("TFI2 returned invalid Hourly Production reference data.", 502, "invalid_hourly_catalog")
        return payload

    def get_hourly_production_records(
        self, access_token: str, module_key: str, *, date_from: str | None = None,
        date_to: str | None = None, product_code: str | None = None,
        search: str | None = None, page: int = 1, page_size: int = 100
    ) -> dict:
        payload = self._request(
            "POST", "/rest/v1/rpc/tfi_get_hourly_production_records",
            access_token=access_token,
            body={
                "p_module_key": module_key, "p_date_from": date_from, "p_date_to": date_to,
                "p_product_code": product_code, "p_search": search,
                "p_page": page, "p_page_size": page_size,
            }, timeout=30
        )
        if not isinstance(payload, dict) or not isinstance(payload.get("records"), list):
            raise SupabaseError("TFI2 returned an invalid Hourly Production record list.", 502, "invalid_hourly_records")
        return payload

    def get_hourly_production_record(self, access_token: str, module_key: str, record_id: str) -> dict | None:
        params = {
            "select": "id,module_key,production_date,hour,product_code,target_tins,actual_tins,remarks,product_code_reference_status,version,record_status",
            "id": f"eq.{record_id}", "module_key": f"eq.{module_key}", "limit": "1",
        }
        payload = self._request(
            "GET", f"/rest/v1/tfi_hourly_production_records?{urlencode(params)}",
            access_token=access_token
        )
        if not isinstance(payload, list):
            raise SupabaseError("TFI2 returned an invalid Hourly Production record.", 502, "invalid_hourly_record")
        return payload[0] if payload else None

    def get_hourly_production_revisions(self, access_token: str, record_id: str) -> list[dict]:
        params = {
            "select": "id,hourly_production_record_id,version,before_data,after_data,changed_fields,change_reason,changed_by,changed_at",
            "hourly_production_record_id": f"eq.{record_id}", "order": "version.desc", "limit": "100",
        }
        payload = self._request(
            "GET", f"/rest/v1/tfi_hourly_production_revisions?{urlencode(params)}",
            access_token=access_token
        )
        if not isinstance(payload, list):
            raise SupabaseError("TFI2 returned an invalid Hourly Production revision list.", 502, "invalid_hourly_revisions")
        return payload

    def create_hourly_production_records(self, access_token: str, module_key: str, records: list[dict]) -> dict:
        payload = self._request(
            "POST", "/rest/v1/rpc/tfi_create_hourly_production_records",
            access_token=access_token,
            body={"p_module_key": module_key, "p_records": records}, timeout=45
        )
        if not isinstance(payload, dict):
            raise SupabaseError("TFI2 returned an invalid Hourly Production save result.", 502, "invalid_hourly_save")
        return payload

    def update_hourly_production_record(
        self, access_token: str, module_key: str, record_id: str,
        expected_version: int, changes: dict, change_reason: str | None = None
    ) -> dict:
        payload = self._request(
            "POST", "/rest/v1/rpc/tfi_update_hourly_production_record",
            access_token=access_token,
            body={
                "p_module_key": module_key, "p_record_id": record_id,
                "p_expected_version": expected_version, "p_changes": changes,
                "p_change_reason": change_reason,
            }
        )
        if not isinstance(payload, dict):
            raise SupabaseError("TFI2 returned an invalid Hourly Production update result.", 502, "invalid_hourly_update")
        return payload


    # OEE — manual operational CRUD on the existing import-aware table ------
    def get_oee_catalog(self, access_token: str) -> dict:
        payload = self._request(
            "POST", "/rest/v1/rpc/tfi_get_oee_catalog",
            access_token=access_token, body={}
        )
        if not isinstance(payload, dict) or not isinstance(payload.get("machines"), list) or not isinstance(payload.get("products"), list):
            raise SupabaseError("TFI2 returned invalid OEE reference data.", 502, "invalid_oee_catalog")
        return payload

    def get_oee_records(
        self, access_token: str, *, date_from: str | None = None, date_to: str | None = None,
        machine: str | None = None, line: str | None = None, product_code: str | None = None,
        search: str | None = None, page: int = 1, page_size: int = 100
    ) -> dict:
        payload = self._request(
            "POST", "/rest/v1/rpc/tfi_get_oee_records",
            access_token=access_token,
            body={
                "p_date_from": date_from, "p_date_to": date_to, "p_machine": machine,
                "p_line": line, "p_product_code": product_code, "p_search": search,
                "p_page": page, "p_page_size": page_size,
            }, timeout=30
        )
        if not isinstance(payload, dict) or not isinstance(payload.get("records"), list):
            raise SupabaseError("TFI2 returned an invalid OEE record list.", 502, "invalid_oee_records")
        return payload

    def get_oee_record(self, access_token: str, record_id: str) -> dict | None:
        params = {
            "select": "id,production_date,machine,line,product_code,planned_hours,downtime_hours,ideal_rate,total_count,reject_count,include_in_overall,version,record_status",
            "id": f"eq.{record_id}", "limit": "1",
        }
        payload = self._request(
            "GET", f"/rest/v1/tfi_oee_records?{urlencode(params)}",
            access_token=access_token
        )
        if not isinstance(payload, list):
            raise SupabaseError("TFI2 returned an invalid OEE record.", 502, "invalid_oee_record")
        return payload[0] if payload else None

    def get_oee_revisions(self, access_token: str, record_id: str) -> list[dict]:
        params = {
            "select": "id,oee_record_id,version,before_data,after_data,changed_fields,change_reason,changed_by,changed_at",
            "oee_record_id": f"eq.{record_id}", "order": "version.desc", "limit": "100",
        }
        payload = self._request(
            "GET", f"/rest/v1/tfi_oee_revisions?{urlencode(params)}",
            access_token=access_token
        )
        if not isinstance(payload, list):
            raise SupabaseError("TFI2 returned an invalid OEE revision list.", 502, "invalid_oee_revisions")
        return payload

    def create_oee_records(self, access_token: str, records: list[dict]) -> dict:
        payload = self._request(
            "POST", "/rest/v1/rpc/tfi_create_oee_records",
            access_token=access_token, body={"p_records": records}, timeout=45
        )
        if not isinstance(payload, dict):
            raise SupabaseError("TFI2 returned an invalid OEE save result.", 502, "invalid_oee_save")
        return payload

    def update_oee_record(
        self, access_token: str, record_id: str, expected_version: int,
        changes: dict, change_reason: str | None = None
    ) -> dict:
        payload = self._request(
            "POST", "/rest/v1/rpc/tfi_update_oee_record",
            access_token=access_token,
            body={
                "p_record_id": record_id, "p_expected_version": expected_version,
                "p_changes": changes, "p_change_reason": change_reason,
            }
        )
        if not isinstance(payload, dict):
            raise SupabaseError("TFI2 returned an invalid OEE update result.", 502, "invalid_oee_update")
        return payload



    # Productivity — source-aligned operational CRUD -----------------------
    def get_productivity_catalog(self, access_token: str) -> dict:
        payload = self._request(
            "POST", "/rest/v1/rpc/tfi_get_productivity_catalog",
            access_token=access_token, body={}
        )
        if not isinstance(payload, dict) or not isinstance(payload.get("products"), list) or not isinstance(payload.get("lines"), list):
            raise SupabaseError("TFI2 returned invalid Productivity reference data.", 502, "invalid_productivity_catalog")
        return payload

    def get_productivity_records(
        self, access_token: str, *, date_from: str | None = None, date_to: str | None = None,
        line: str | None = None, product_code: str | None = None, search: str | None = None,
        page: int = 1, page_size: int = 100
    ) -> dict:
        payload = self._request(
            "POST", "/rest/v1/rpc/tfi_get_productivity_records",
            access_token=access_token,
            body={
                "p_date_from": date_from, "p_date_to": date_to, "p_line": line,
                "p_product_code": product_code, "p_search": search,
                "p_page": page, "p_page_size": page_size,
            }, timeout=30
        )
        if not isinstance(payload, dict) or not isinstance(payload.get("records"), list):
            raise SupabaseError("TFI2 returned an invalid Productivity record list.", 502, "invalid_productivity_records")
        return payload

    def get_productivity_record(self, access_token: str, record_id: str) -> dict | None:
        payload = self._request(
            "POST", "/rest/v1/rpc/tfi_get_productivity_record",
            access_token=access_token, body={"p_record_id": record_id}
        )
        if payload is not None and not isinstance(payload, dict):
            raise SupabaseError("TFI2 returned an invalid Productivity record.", 502, "invalid_productivity_record")
        return payload

    def get_productivity_revisions(self, access_token: str, record_id: str) -> list[dict]:
        params = {
            "select": "id,productivity_record_id,version,before_data,after_data,changed_fields,change_reason,changed_by,changed_at",
            "productivity_record_id": f"eq.{record_id}", "order": "version.desc", "limit": "100",
        }
        payload = self._request(
            "GET", f"/rest/v1/tfi_productivity_revisions?{urlencode(params)}",
            access_token=access_token
        )
        if not isinstance(payload, list):
            raise SupabaseError("TFI2 returned an invalid Productivity revision list.", 502, "invalid_productivity_revisions")
        return payload

    def create_productivity_records(self, access_token: str, records: list[dict]) -> dict:
        payload = self._request(
            "POST", "/rest/v1/rpc/tfi_create_productivity_records",
            access_token=access_token, body={"p_records": records}, timeout=45
        )
        if not isinstance(payload, dict):
            raise SupabaseError("TFI2 returned an invalid Productivity save result.", 502, "invalid_productivity_save")
        return payload

    def update_productivity_record(
        self, access_token: str, record_id: str, expected_version: int,
        changes: dict, change_reason: str | None = None
    ) -> dict:
        payload = self._request(
            "POST", "/rest/v1/rpc/tfi_update_productivity_record",
            access_token=access_token,
            body={
                "p_record_id": record_id, "p_expected_version": expected_version,
                "p_changes": changes, "p_change_reason": change_reason,
            }
        )
        if not isinstance(payload, dict):
            raise SupabaseError("TFI2 returned an invalid Productivity update result.", 502, "invalid_productivity_update")
        return payload


    def preview_productivity_row(self, access_token: str, record_data: dict) -> dict:
        payload = self._request(
            "POST", "/rest/v1/rpc/tfi_get_productivity_preview",
            access_token=access_token, body={"p_record_data": record_data}
        )
        if not isinstance(payload, dict):
            raise SupabaseError("TFI2 returned invalid Productivity calculation preview.", 502, "invalid_productivity_preview")
        return payload


    # Coding DPR manual operational API -------------------------------------
    def get_coding_dpr_catalog(self, access_token: str) -> dict:
        payload = self._request(
            "POST", "/rest/v1/rpc/tfi_get_coding_dpr_catalog",
            access_token=access_token, body={}
        )
        if not isinstance(payload, dict):
            raise SupabaseError("TFI2 returned invalid Coding DPR catalog data.", 502, "invalid_coding_dpr_catalog")
        return payload

    def get_coding_dpr_records(
        self, access_token: str, *, limit: int = 25, offset: int = 0,
        date_from: str | None = None, date_to: str | None = None,
        line_number: str | None = None, product_code: str | None = None,
        review_status: str | None = None,
    ) -> dict:
        payload = self._request(
            "POST", "/rest/v1/rpc/tfi_get_coding_dpr_records",
            access_token=access_token,
            body={
                "p_limit": limit, "p_offset": offset,
                "p_date_from": date_from, "p_date_to": date_to,
                "p_line_number": line_number, "p_product_code": product_code,
                "p_review_status": review_status,
            }
        )
        if not isinstance(payload, dict) or not isinstance(payload.get("records"), list):
            raise SupabaseError("TFI2 returned an invalid Coding DPR record list.", 502, "invalid_coding_dpr_records")
        return payload

    def get_coding_dpr_record(self, access_token: str, record_id: str) -> dict | None:
        payload = self._request(
            "POST", "/rest/v1/rpc/tfi_get_coding_dpr_record",
            access_token=access_token, body={"p_record_id": record_id}
        )
        if payload is not None and not isinstance(payload, dict):
            raise SupabaseError("TFI2 returned an invalid Coding DPR record.", 502, "invalid_coding_dpr_record")
        return payload

    def get_coding_dpr_revisions(self, access_token: str, record_id: str) -> list[dict]:
        params = {
            "select": "id,coding_dpr_entry_id,version,before_data,after_data,changed_fields,change_reason,changed_by,changed_at",
            "coding_dpr_entry_id": f"eq.{record_id}", "order": "version.desc", "limit": "100",
        }
        payload = self._request(
            "GET", f"/rest/v1/tfi_coding_dpr_revisions?{urlencode(params)}",
            access_token=access_token
        )
        if not isinstance(payload, list):
            raise SupabaseError("TFI2 returned an invalid Coding DPR revision list.", 502, "invalid_coding_dpr_revisions")
        return payload

    def create_coding_dpr_records(self, access_token: str, records: list[dict]) -> dict:
        payload = self._request(
            "POST", "/rest/v1/rpc/tfi_create_coding_dpr_records",
            access_token=access_token, body={"p_records": records}, timeout=45
        )
        if not isinstance(payload, dict):
            raise SupabaseError("TFI2 returned an invalid Coding DPR save result.", 502, "invalid_coding_dpr_save")
        return payload

    def update_coding_dpr_record(
        self, access_token: str, record_id: str, expected_version: int,
        changes: dict, change_reason: str | None = None
    ) -> dict:
        payload = self._request(
            "POST", "/rest/v1/rpc/tfi_update_coding_dpr_record",
            access_token=access_token,
            body={
                "p_record_id": record_id, "p_expected_version": expected_version,
                "p_changes": changes, "p_change_reason": change_reason,
            }
        )
        if not isinstance(payload, dict):
            raise SupabaseError("TFI2 returned an invalid Coding DPR update result.", 502, "invalid_coding_dpr_update")
        return payload

    # PR Monitoring — read-only register populated only by approved imports ---
    def get_pr_monitoring_records(
        self,
        access_token: str,
        *,
        date_from: str | None = None,
        date_to: str | None = None,
        pr_no: str | None = None,
        status: str | None = None,
        search: str | None = None,
        sort_key: str | None = None,
        sort_direction: str = "asc",
        page: int = 1,
        page_size: int = 100,
    ) -> dict:
        payload = self._request(
            "POST",
            "/rest/v1/rpc/tfi_get_pr_monitoring_records",
            access_token=access_token,
            body={
                "p_date_from": date_from,
                "p_date_to": date_to,
                "p_pr_no": pr_no,
                "p_status": status,
                "p_search": search,
                "p_sort_key": sort_key,
                "p_sort_direction": sort_direction,
                "p_page": page,
                "p_page_size": page_size,
            },
            timeout=30,
        )
        if not isinstance(payload, dict) or not isinstance(payload.get("records"), list):
            raise SupabaseError(
                "TFI2 returned an invalid PR Monitoring register response.",
                502,
                "invalid_pr_monitoring_records",
            )
        return payload

    # NON-PROD — source-aligned operational CRUD ----------------------------
    def get_nonprod_catalog(self, access_token: str) -> dict:
        payload = self._request("POST", "/rest/v1/rpc/tfi_get_nonprod_catalog", access_token=access_token, body={})
        if not isinstance(payload, dict) or not all(isinstance(payload.get(k), list) for k in ("names","positions","activities","locations")):
            raise SupabaseError("TFI2 returned invalid NON-PROD reference data.", 502, "invalid_nonprod_catalog")
        return payload

    def get_nonprod_records(self, access_token: str, *, date_from: str | None = None,
        date_to: str | None = None, employee_name: str | None = None, search: str | None = None,
        page: int = 1, page_size: int = 100) -> dict:
        payload = self._request("POST", "/rest/v1/rpc/tfi_get_nonprod_records", access_token=access_token,
            body={"p_date_from":date_from,"p_date_to":date_to,"p_employee_name":employee_name,
                  "p_search":search,"p_page":page,"p_page_size":page_size}, timeout=30)
        if not isinstance(payload,dict) or not isinstance(payload.get("records"),list):
            raise SupabaseError("TFI2 returned an invalid NON-PROD record list.",502,"invalid_nonprod_records")
        return payload

    def get_nonprod_record(self, access_token: str, record_id: str) -> dict | None:
        params={"select":"id,work_date,employee_name,employee_position,time_start,time_end,total_minutes,working_hours,activity,location,remarks,version,record_status,created_at,updated_at,created_by,updated_by",
                "id":f"eq.{record_id}","limit":"1"}
        payload=self._request("GET",f"/rest/v1/tfi_nonprod_records?{urlencode(params)}",access_token=access_token)
        if not isinstance(payload,list): raise SupabaseError("TFI2 returned an invalid NON-PROD record.",502,"invalid_nonprod_record")
        return payload[0] if payload else None

    def get_nonprod_revisions(self, access_token: str, record_id: str) -> list[dict]:
        params={"select":"id,nonprod_record_id,version,before_data,after_data,changed_fields,change_reason,changed_by,changed_at",
                "nonprod_record_id":f"eq.{record_id}","order":"version.desc","limit":"100"}
        payload=self._request("GET",f"/rest/v1/tfi_nonprod_revisions?{urlencode(params)}",access_token=access_token)
        if not isinstance(payload,list): raise SupabaseError("TFI2 returned invalid NON-PROD revision history.",502,"invalid_nonprod_revisions")
        return payload

    def create_nonprod_records(self, access_token: str, records: list[dict]) -> dict:
        payload=self._request("POST","/rest/v1/rpc/tfi_create_nonprod_records",access_token=access_token,
            body={"p_records":records},timeout=45)
        if not isinstance(payload,dict): raise SupabaseError("TFI2 returned an invalid NON-PROD save result.",502,"invalid_nonprod_save")
        return payload

    def update_nonprod_record(self, access_token: str, record_id: str, expected_version: int,
        changes: dict, change_reason: str | None = None) -> dict:
        payload=self._request("POST","/rest/v1/rpc/tfi_update_nonprod_record",access_token=access_token,
            body={"p_record_id":record_id,"p_expected_version":expected_version,"p_changes":changes,"p_change_reason":change_reason})
        if not isinstance(payload,dict): raise SupabaseError("TFI2 returned an invalid NON-PROD update result.",502,"invalid_nonprod_update")
        return payload
