# TFI2 Selective Spreadsheet Import Execution — v0.3

Date: 2026-11-21  
Project: TFI_NEW  
Status: Local backend and UI integration implemented; controlled validation completed. No production workbook has been imported.

## 1. Scope

This phase connects the Spreadsheet Import Center, Scan Progress, Central Import Inbox, Duplicate Review, Final Import Approval, and Import History screens to the existing TFI2 import registry and RPC functions.

The current source method is **Excel .xlsx upload only**. Direct Google Sheets authorization and link-based reading are not enabled in this phase.

The scanner reads only the worksheet registered for the selected destination module. Other workbook tabs are not scanned or staged.

## 2. Implemented flow

1. Load active destinations from `tfi_import_destinations` using the authenticated user's permissions.
2. Upload an .xlsx file (maximum 100 MB) to the local Flask backend.
3. Create a TFI2 import batch using the workbook SHA-256 digest and registered worksheet ID.
4. Scan the registered worksheet in a background worker with read-only OpenPyXL mode.
5. Preserve source row number, cell values, formulas, source locator, and row fingerprint.
6. Stage records in chunks of at most 100 rows through `tfi_stage_import_rows`.
7. Complete the scan and make the batch available for review.
8. Load staged rows into the Central Import Inbox. The user selects which rows to continue.
9. Review actual possible-duplicate rows. The only decisions are:
   - Confirm duplicate: skip the incoming row.
   - Not a duplicate: mark as a distinct new row; a reason is required.
   - Hold: keep the incoming row excluded pending follow-up.
10. Final Import Approval submits only the selected staged row IDs to `tfi_finalize_import_batch`.
11. Import History reads batch-level outcomes without modifying operational data.

## 3. Backend routes

- `GET /api/import/destinations`
- `POST /api/import/batches`
- `GET /api/import/batches`
- `GET /api/import/batches/<batch_id>`
- `GET /api/import/batches/<batch_id>/rows`
- `POST /api/import/batches/<batch_id>/rows/<row_id>/decision`
- `POST /api/import/batches/<batch_id>/finalize`

The backend uses the authenticated Supabase access token held in the server-side session vault. No service-role key is placed in browser code.

## 4. Data handling and safeguards

- Source values and formulas are preserved as raw source data; formula expressions are not executed.
- Exact source duplicates are automatically skipped by the database import functions.
- Potential duplicates are held until an authorized reviewer chooses a decision.
- Existing operational records are read-only. The workflow does not expose update, merge, replace, or overwrite actions.
- Derived, helper, summary, unmapped, and invalid classifications are not inserted as operational records by finalization.
- Incomplete operational rows remain eligible for import. Their completeness is marked as unassessed where no approved required-field contract exists; the workflow does not invent missing business rules.
- Every row retains source workbook, worksheet, row locator, source fingerprint, and batch traceability.
- Import actions require central spreadsheet permissions and module-specific permissions. Duplicate review additionally requires `duplicate_review.review`; final approval additionally requires `import_confirmation.import`.
- Read access to batch and row data is checked against the module's import permission and the TFI2 RLS policies.

## 5. Destination readiness

The active registry currently contains 15 destination mappings.

- Fourteen destinations have `raw_capture_only` status and can proceed through the current raw-capture workflow, subject to the user's permissions.
- CO QA has `hold_pending_business_rule` status. It is shown as unavailable in the module selector and the backend rejects upload for this destination until its business-rule mapping is approved.

The registry currently has no required-column contracts for these destinations. Accordingly, the UI must not claim that all business fields have been validated.

## 6. Connected UI files

- `design/tfi-import-center-live.js`
- `design/tfi-scan-progress-live.js`
- `design/tfi-import-inbox-live.js`
- `design/tfi-duplicate-review-live.js`
- `design/tfi-final-import-live.js`
- `design/tfi-import-history-live.js`

These scripts are loaded by their corresponding existing preview pages. The original visual layouts are retained while the data actions are connected to the backend.

## 7. Validation performed

- Python compile check passed for backend and tests.
- Automated test suite: **87 passed**.
- Node syntax check passed for all six live import scripts.
- HTML script-reference check passed for the six import workflow pages.
- A TFI2 SQL transaction exercised batch creation, row staging, scan completion, duplicate resolution, finalization, and raw-record insertion. The transaction was rolled back; no validation rows remain in production tables.
- Authenticated System Administrator permission check confirmed visibility of all 15 registered destinations and the required spreadsheet, duplicate-review, confirmation, and module import permissions.

## 8. Known limits / next gates

- Direct Google Sheets OAuth and live spreadsheet URL reading are not connected.
- Business-rule mapping and required-field contracts still need approval for each destination before completeness can be asserted.
- CO QA remains blocked until its business rule is approved.
- Duplicate review currently displays the incoming source values and the existing-record reference; existing record field values are not exposed in this phase.
- A real client workbook should be tested in a controlled review session before operational use. No production data has been imported during this implementation.
