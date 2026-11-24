# TFI2 Direct Google Sheets Import — Priority Workstream v0.1

**Date:** 21 November 2026  
**Project:** TFI_NEW / TFI2  
**Owner decision:** Direct Google Sheets URL is the primary import method; XLSX upload remains a backup.  
**Roadmap alignment:** Early Phase 6 workstream only. The official seven-phase order is unchanged, and Phase 5 remains active.

## 1. User workflow

1. Sign in to the local TFI application.
2. Connect the Google Account that can access the source workbook.
3. Paste a canonical Google Sheets URL.
4. Select one approved operational destination module.
5. TFI checks spreadsheet metadata and confirms the module's exact registered worksheet title and sheetId.
6. TFI scans only that worksheet and stages eligible non-empty source rows.
7. Continue through Import Inbox, Duplicate Review, and Final Import Approval.
8. Keep test batches in review until the owner approves the acceptance results.

The source workbook is read only. This is a one-time controlled scan, not continuous synchronization.

## 2. Implemented architecture

### Google authorization

- OAuth 2.0 authorization-code flow with PKCE (S256).
- Requests openid, email, and https://www.googleapis.com/auth/spreadsheets.readonly.
- Requires the Google Sheets API to be enabled in the Google Cloud project.
- Verifies the Google account email before saving a connection.
- Uses state bound to the currently signed-in TFI user.
- Refresh tokens are encrypted with Windows DPAPI for the current Windows user and stored under local application data, outside the source tree.
- Google access tokens remain in process memory; they are not sent to browser JavaScript or stored in the connection file.
- Disconnect removes the local encrypted connection and requests Google token revocation.

### Spreadsheet reading

- Accepts canonical HTTPS docs.google.com/spreadsheets/d/<spreadsheetId>/... links.
- Reads workbook metadata first, without loading worksheet cell data.
- Requires both the registered worksheet title and exact registered sheetId to match the selected module.
- Reads the approved worksheet in bounded 2,000-row ranges, capped by the module's registered grid dimensions and the 100,000-row scanner ceiling.
- Preserves source row numbers, source values, formula expressions, and source fingerprints.
- Does not execute formulas or modify the source workbook.
- Captures source spreadsheet ID and approved sheetId in the existing TFI2 import provenance.

### Existing TFI2 workflow

The existing import foundation already supports source_type='google_sheets', source_spreadsheet_id, and the google:<spreadsheetId> source identity. No new Supabase schema migration was needed for this increment.

The existing safeguards remain in force:

- One operational destination module per batch.
- No Import All action.
- Reports & Reconciliation and Master Data are not import destinations.
- Exact source duplicates are skipped by the database workflow.
- Possible duplicates require authorized review.
- Existing operational records cannot be updated, merged, replaced, or overwritten by import.
- Derived, helper, summary, unmapped, and invalid rows are not promoted.
- CO QA remains blocked pending its business rules.
- The 14 raw-capture destinations still require approved module-specific contracts before canonical operational-table promotion.

## 3. Local setup required before live Google authorization

The implementation is present, but the local .env currently has no Google OAuth client credentials. The live Google Account connection and client-workbook acceptance therefore remain pending.

1. Open Google Cloud Console and select or create the project that will own the TFI OAuth client.
2. Enable Google Sheets API.
3. Configure the OAuth consent screen and add the intended testing users if the app is still in testing mode.
4. Create an OAuth client with application type Web application.
5. Add this exact authorized redirect URI:

   http://127.0.0.1:5100/api/google-sheets/callback

6. Copy the client ID and client secret into the local TFI .env file:

   TFI_GOOGLE_CLIENT_ID=...  
   TFI_GOOGLE_CLIENT_SECRET=...

7. Restart the local TFI application.
8. Sign in to TFI, click Connect Google Account, and authorize the account that can open the source workbook.
9. Paste the sanitized client workbook link and test one approved module.

Never paste the OAuth client secret, Google refresh token, or TFI administrator password into chat or source control.

Google's spreadsheets.readonly scope is a sensitive scope. Before a public or broad external rollout, review Google's current OAuth verification and user-data policy requirements.

## 4. Current verification

- 149 automated backend tests passed across tests/backend.
- Google Sheets scanner tests cover selected-sheet-only reading, row traceability, formulas, blank rows, and helper/derived/invalid classification.
- Google OAuth tests cover PKCE, authorization state, verified account email, and refresh-token-only persistence.
- Windows DPAPI encrypt/decrypt round-trip passed on the TFI host.
- Python compile checks passed.
- Node syntax checks passed for the Spreadsheet Import Center and Scan Progress scripts.
- No live Google OAuth connection has been completed because client credentials have not yet been configured.
- No production workbook has been imported. Current TFI2 import batch, staged-row, and imported-record counts remain zero.

## 5. Acceptance gate

The first live acceptance run must use a sanitized copy of the authoritative 35-tab workbook. Select one module only, verify the exact mapped worksheet, inspect the staged rows and formulas, review duplicate behavior and incomplete-row handling, and keep the batch in review. Do not finalize or promote rows until the owner explicitly approves the test.

The Google Sheets priority workstream does not close Phase 5, does not reorder the seven phases, and does not replace Phase 7 system-wide acceptance.


## OAuth readiness re-check — 22 November 2026

A fresh read-only audit of the active TFI_NEW source confirms that the Google OAuth authorization-code flow with PKCE, verified-email check, Windows DPAPI refresh-token storage, and read-only Sheets scope are already implemented. The callback URI is generated from the current local app port; for port 5100 it is exactly:

http://127.0.0.1:5100/api/google-sheets/callback

The local .env was checked without displaying any values. TFI_GOOGLE_CLIENT_ID and TFI_GOOGLE_CLIENT_SECRET are both absent. No OAuth credentials were created, changed, or exposed during this audit.

The local TFI_NEW backend was started and its health endpoint returned status=ok, application=TFI_NEW, connected=true, database_project=TFI2. The protected Google Sheets status endpoint returned HTTP 401 without an authenticated TFI session, which is expected; it does not indicate an OAuth defect.

Focused tests passed on the Windows host:
- tests/backend/test_google_sheets.py
- tests/backend/test_config.py
- Result: 16 passed.

The remaining setup action is owner-side Google Cloud configuration: enable Google Sheets API, configure the OAuth consent screen/test users, create a Web application OAuth client with the exact callback URI above, and enter the generated Client ID and Client Secret locally in TFI_NEW/.env. Never send the Client Secret in chat or commit it.

Detailed steps are recorded in:
docs/blueprints/TFI_NEW_GOOGLE_OAUTH_SETUP_CHECKLIST_2026-11-22.md

After credentials are configured and the backend restarted, perform a live OAuth connection, then a one-module controlled scan using a sanitized workbook copy. Keep the batch in review; do not finalize or promote until the owner approves the acceptance results.


### Owner progress update — Google OAuth setup completed; live scan deferred (22 November 2026)

- The owner configured the Google Auth Platform in the FieldPro project: External audience in Testing status, owner account added as a test user, Google Sheets API enabled, and the spreadsheets.readonly scope saved.
- A Web application OAuth client was created with the exact redirect URI http://127.0.0.1:5100/api/google-sheets/callback.
- A local-only configuration check confirmed both TFI_GOOGLE_CLIENT_ID and TFI_GOOGLE_CLIENT_SECRET are set in TFI_NEW/.env; secret values were not displayed or recorded.
- TFI_NEW backend was restarted after configuration and callback compatibility changes. Health returned HTTP 200 with application=TFI_NEW, connected=true, database_project=TFI2.
- The Import Center UI subsequently displayed Google Account connected for the owner's test account. This is UI evidence of a connected account; a controlled source workbook scan and batch creation have deliberately not been performed.
- OAuth callback was hardened to complete using the one-time server-side OAuth state and PKCE verifier while preserving the TFI login cookie's SameSite=Strict policy.
- Full backend suite after callback changes: 167 passed.
- Owner explicitly deferred live scan/import testing. No batch was created, no source workbook rows were read in this session, and no production data was imported.

Roadmap remains unchanged: Phase 5 Operational Modules Backend is the official active phase. Direct Google Sheets/OAuth remains an early Phase 6 priority workstream and does not close Phase 5 or constitute Phase 7 acceptance. Continue Phase 5 development; keep the live Google Sheets scan and comprehensive testing deferred until the owner requests them.


## Owner resumed Phase 6 priority — current checkpoint (22 November 2026)

The owner has directed that the Direct Google Sheets Import workstream be prioritized now, without changing the official seven-phase roadmap. Phase 5 remains active in parallel; Phase 6 early work is being resumed.

### Confirmed current local state
- Active project path: `C:\Users\Rominick\Desktop\TFI_NEW`.
- TFI_NEW local backend was started and `GET /api/health` returned HTTP 200: `application=TFI_NEW`, `connected=true`, `database_project=TFI2`.
- Local `.env` contains both `TFI_GOOGLE_CLIENT_ID` and `TFI_GOOGLE_CLIENT_SECRET`; only presence was checked. Values were not displayed or copied.
- Direct Google Sheets OAuth and read-only scanner implementation already exist.
- Focused Google Sheets/import backend tests: 29 passed.
- Existing Google Sheets Import Center browser test passed all mocked UI checks (Google link primary, connected status fixture, request payload, scan context, responsive mobile layout, no browser errors). This test uses mocked APIs; it does not prove a live Google OAuth session or a live source scan.
- Import Center opened at `http://127.0.0.1:5100/design/spreadsheet-import-center-preview.html`.

### Important source/roadmap clarification
- The approved design is **one operational destination module per batch**, not an Import All operation across every worksheet. The workbook's 35 tabs include non-destination/helper/report tabs; only registered operational worksheets are eligible.
- Each batch reads only the exact approved worksheet title + sheetId for the selected module, then stages source-traceable rows for review. This is intentional and is not a defect.
- The UI and server-side routes already support this one-module workflow. The preview's inline fallback navigation is overridden by `tfi-import-center-live.js` for the real API call.
- CO QA remains disabled until its business-rule contract is approved. Other raw-capture-only destinations remain staged for review and cannot be promoted into canonical module tables until their Phase 5 contracts are complete.
- No import batch was created in this checkpoint. No spreadsheet rows were read by the TFI local OAuth scanner, staged, approved, or promoted. No production data was changed.

### Immediate live acceptance sequence
1. Owner signs in to the local TFI application in the opened browser.
2. Confirm the Google Account status in Import Center; if disconnected, use Connect Google Account and approve read-only Sheets access.
3. Use the official workbook link and select one currently approved module with a completed destination contract (recommend Product Entry for first controlled scan).
4. Verify exact worksheet title/sheetId, detected header, source row numbers, formula preservation, staged row counts, and duplicate/incomplete classifications.
5. Keep the batch in review. Do not approve/finalize/promote until the owner inspects and explicitly approves the scan results.
6. Repeat module-by-module for the remaining approved destinations; do not attempt to import helper/report tabs as operational records.

Phase 6 remains PARTIALLY IMPLEMENTED EARLY; controlled live acceptance and canonical promotion coverage remain outstanding. Official seven-phase order is unchanged.


## Phase 6 continuation — Google Sheets source identity handoff fix (22 November 2026)

- Audited the existing Import Center, scan-progress, Import Inbox, duplicate-review, and final-approval flow. Existing Google OAuth, read-only scanner, batch staging, row review, and approval endpoints were retained; no rebuild was performed.
- Found a source identity handoff defect: the scan-progress, Import Inbox, duplicate-review, and final-approval return paths hard-coded the source type as XLSX even for Google Sheets batches.
- Updated the scan-progress handoff to prefer the persisted batch source_type; updated Import Inbox to preserve source_type and display GOOGLE SHEETS vs XLSX correctly; updated both duplicate-review navigation paths and final-approval return-to-inbox navigation to preserve the original source type.
- Added design/test-google-sheets-source-type-handoff.js to assert source type propagation across the four screens and correct Import Inbox labeling.
- Existing Google Sheets Import Center mocked browser test: 8/8 checks passed (primary link flow, connected state, payload, scan context, responsive layout, no browser errors).
- Focused scanner/header/OAuth backend tests: 34 passed.
- Syntax checks passed for all four modified live workflow scripts.
- Live Google workbook scanning, row staging, and promotion were not run; TFI2 import counts remain unchanged at zero.

### Updated Phase 6 remaining workstreams
1. Expand/approve module-specific source-to-operational contracts for the raw-capture-only destinations; preserve CO QA hold until its business rules are approved.
2. Complete operational promotion coverage beyond the four currently approved destinations (DMP Production, DMR Production, OEE, Production Schedule).
3. Run controlled live Google Sheets scan and verify Import Inbox completeness, duplicate handling, and source traceability; keep batch in review until owner approval.
4. Verify import history, reconciliation, permissions, and repeat-import/idempotency behavior with live batches.

Official seven-phase roadmap remains unchanged. Phase 5 stays open for owner acceptance; Phase 6 early implementation continues in parallel.


## Phase 6 continuation — DMR Coding operational import mapping (22 November 2026)

- Added the dedicated Supabase RPC `private.tfi_finalize_dmr_coding_import(uuid,uuid[])` and granted execution to authenticated users.
- Activated the DMR Coding destination contract after matching the official worksheet columns to the existing operational module: A Date, B Product Code, C Line, D Stop, E Resume, H Category, I Factor, J Reason. F/G downtime minutes/hours and K product name remain derived/look-up fields and are not imported as editable inputs.
- The promotion RPC preserves partial DMR Coding records as `unassessed`, parses spreadsheet date serials and time values, computes generated downtime fields in the destination table, validates Category and Factor against current DPR LEGEND master data, and preserves unmatched historical product codes with an unmatched reference status.
- Formula-bearing input cells and invalid date/time/text values are held/excluded for review; possible duplicates require a recorded decision; identical operational records are excluded by the destination fingerprint uniqueness constraint.
- Successful inserts are linked to their staged import row through `source_import_row_id`, use `entry_source='import'`, and create row-level and batch-level audit events. Existing operational rows are not overwritten.
- Added gateway method `finalize_dmr_coding_import`; the final-approval API now routes DMR Coding batches to this dedicated RPC while leaving all other module finalization paths unchanged.
- Verification: 91 focused Python tests passed across DMR Coding, import service, header detection, Google Sheets, app routes, and Supabase gateway. Python compile passed.
- No live import batch was finalized and no DMR Coding operational records were created during this implementation.

### Remaining Phase 6 implementation / acceptance
1. Continue source-to-operational mapping for the other raw-capture-only modules; DMR Coding is now approved, while CO QA remains on hold pending its business rule.
2. Complete operational promotion coverage for the remaining modules.
3. Run controlled live Google Sheets scans and verify Inbox completeness, duplicate handling, and source traceability; keep batches in review until owner approval.
4. Verify Import History, reconciliation, permissions, and repeat-import/idempotency using controlled live batches.

Official seven-phase roadmap unchanged. Phase 5 owner acceptance remains separate from Phase 6 import integration.


## Phase 6 continuation — Coding DPR import integration (22 November 2026)

- Approved the Coding DPR source-to-operational contract for sheet ID 1266086431, worksheet Coding DPR, header row 2, first data row 3, grid width 26.
- Mapped A = Coding/Labelling Date, B = Line Number, C:W = seven Production Date / Product Code / Quantity lot triplets. X = derived Total Quantity and is explicitly excluded from imported input columns.
- Preserved the source calculation exactly: Total Quantity sums lot slots 1–6; lot slot 7 is retained and shown separately.
- The scanner now identifies Coding DPR partial lots and missing line number as incomplete drafts in Import Inbox. Formula cells in A:W are flagged for review; the derived formula in X is allowed and not imported as an input.
- Added dedicated Supabase RPC `private.tfi_finalize_coding_dpr_import(uuid,uuid[])` and public invoker wrapper `public.tfi_finalize_coding_dpr_import(uuid,uuid[])`. The final-approval route now sends Coding DPR batches to this RPC.
- Operational promotion creates one Coding DPR entry with up to seven child lot rows, retains partial lots, checks Line Number against DMP LEGEND, and relies on the existing payload review logic to flag incomplete lots and unmatched Product Codes without replacing historical codes.
- Source traceability is preserved through the unique `source_import_row_id` on the operational Coding DPR entry. Row-level and batch-level audit events are written. Duplicate fingerprints prevent identical entries from being inserted again. The derived Total Quantity remains governed by the operational module's existing calculation (lots 1–6 only).
- Database migration applied: `phase6_coding_dpr_import_integration`. Destination contract is now approved with A:W as input columns and X as a formula column.
- Verification: full backend test suite passed, 325 tests. Python compilation passed. Supabase security advisor showed no new findings for this RPC; existing findings relate to two Production Entry functions and leaked-password protection settings.
- No live import batch was finalized and no Coding DPR operational entries or lots were created during this implementation. The live import tables and Coding DPR operational tables remain empty after the work.

### Next Phase 6 targets
1. Continue module-by-module source mapping and operational promotion for remaining destinations.
2. Run controlled live Google Sheets scans only after owner selection; verify header matching, formula handling, completeness, and duplicate review in Import Inbox.
3. Test selected-row approval, Import History, traceability, and repeat-import protection with controlled batches. Preserve the seven-phase roadmap and keep final all-system testing as the last phase.


## Phase 6 continuation — Combined Hourly Meat / Hourly Coding / Hourly Agri import integration (22 November 2026)

- Approved all three source destination contracts using the registered worksheet IDs and row positions: Hourly Meat (sheetId 428082343), Hourly Coding (1916766220), Hourly Agri (534145404); header row 4, first data row 5, grid width 12, rows through 5004.
- Approved input columns A:F only: Date, Hour (0–23), Product Code, Target for the hour (tins), Actual output (tins), Remarks. Columns G:L are formula/read-only outputs: Product Name, Time Slot, Variance, Cumulative Target, Cumulative Actual, Hour Attainment.
- Added a shared source-aligned Hourly Production staging RPC, selected by module key from both XLSX and Google Sheets import scanners. Existing generic import staging remains unchanged for all other modules.
- Added a dedicated final-approval RPC that writes only to the shared Hourly Production operational table while preserving the distinct module_key values; the existing module-specific read filters, formulas, CRUD, version history and permissions continue to isolate the three modules.
- Added input validation for dates, integer hours 0–23, non-negative targets/actuals, text limits, formula-bearing input cells, duplicate date/hour/product slots, exact repeat-source rows, and unmatched product codes. Unmatched historical codes are retained and marked unmatched; derived formulas in G:L are preserved in staging but are not written as inputs.
- Missing date/hour/product code/target/actual values are marked incomplete in Import Inbox. Partial source rows are retained and may be approved as incomplete operational drafts; they are not silently discarded. Formula-bearing input cells are held for review.
- Added gateway routing and finalization routing for all three modules. Hardened private RPC execute grants (authenticated only; no anon/public execution) and added public invoker wrappers for the application API.
- Verification: full backend suite passed, 329 tests; Python compilation passed for app.py, supabase_gateway.py, import_service.py, and google_sheets.py. Supabase function permissions verified (authenticated yes, anon no). Security advisor shows no new findings from these Hourly RPCs; remaining findings are pre-existing Production Entry definer wrappers and leaked-password protection.
- No live import batch was scanned or approved. Database counts remain zero for import batches, staged import rows, Hourly operational records, and Hourly revisions. No operational records were created or modified during this integration.

### Next Phase 6 work
1. Continue remaining module source-to-operational mappings and dedicated promotion paths.
2. Perform controlled live Google Sheets scans for each approved source, check completeness/formula/duplicate review in Import Inbox, and only then approve selected rows.
3. Complete Import History, reconciliation, permissions, and repeat-import/idempotency verification. Keep the official seven-phase roadmap and Phase 7 final all-system testing unchanged.
