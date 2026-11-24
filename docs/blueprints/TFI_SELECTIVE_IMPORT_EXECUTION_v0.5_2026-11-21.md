# TFI2 Selective Spreadsheet Import Execution — v0.5

Date: 2026-11-21  
Project: TFI_NEW / Supabase TFI2  
Status: XLSX backup and direct Google Sheets URL scanning implemented locally. Google OAuth client credentials and controlled client-workbook acceptance are still pending. No production workbook has been imported.

This is an owner-approved early Phase 6 priority workstream. The official seven-phase sequence remains unchanged and Phase 5 remains the active phase.

## 1. Completed implementation

The following six UI screens are connected to the local Flask backend and TFI2:

- Spreadsheet Import Center
- Scan Progress
- Central Import Inbox
- Duplicate Review
- Final Import Approval
- Import History

Backend routes:

- GET /api/google-sheets/status
- GET /api/google-sheets/connect
- GET /api/google-sheets/callback
- POST /api/google-sheets/disconnect
- POST /api/google-sheets/inspect
- GET /api/import/destinations
- POST /api/import/batches (XLSX multipart or Google Sheets JSON source)
- GET /api/import/batches
- GET /api/import/batches/<batch_id>
- GET /api/import/batches/<batch_id>/rows
- POST /api/import/batches/<batch_id>/rows/<row_id>/decision
- POST /api/import/batches/<batch_id>/finalize

Primary source: direct Google Sheets URL with a read-only Google OAuth connection. XLSX upload remains available as a backup source with a 100 MB application limit.

Google OAuth uses the authorization-code flow with PKCE and requests only openid, email, and spreadsheets.readonly. Refresh tokens are encrypted with Windows DPAPI for the current Windows user and stored outside the source tree under the local TFI app data folder. Google access tokens are held in memory only and are never sent to browser JavaScript.

Before a Google batch is created, the backend checks the spreadsheet metadata and requires the selected module's registered worksheet title and exact sheetId to match. The scanner then reads only that approved worksheet in bounded row ranges. Other workbook tabs are not scanned or staged.

## 2. Data-safety rules

- One operational destination module per import batch.
- Reports & Reconciliation and Master Data are not import destinations.
- No Import All action is provided.
- Source values and formula expressions are retained as raw source evidence for both XLSX and Google Sheets; formulas are not executed.
- Google Sheets imports retain the spreadsheet ID and approved sheetId as source provenance.
- Google OAuth uses read-only spreadsheet scope; TFI does not modify the source workbook.
- Existing operational records have no update, merge, replace, or overwrite path.
- Exact source duplicates are skipped by the database workflow.
- Possible duplicates require an authorized review decision.
- Incomplete operational rows remain eligible for controlled capture; no unapproved required-field rules are invented.
- Derived, helper, summary, unmapped, and invalid rows are not promoted as operational records.
- CO QA remains blocked while its business rule is pending.

## 3. Destination readiness

The live registry contains 15 approved module destinations:

- 14 destinations are marked raw_capture_only.
- CO QA is marked hold_pending_business_rule and is blocked before upload.
- The registry currently has zero required-column contracts. The current workflow therefore captures source rows but does not claim full business-field validation or calculation parity.

## 4. Database hardening

Applied live migration:

- Version: 20261121041306
- Name: tfi2_import_foreign_key_indexes

Seven indexes were added for foreign keys on the import batch, staged-row, and operational-record tables.

Post-change Supabase Performance Advisor: no remaining unindexed-foreign-key findings. Unused-index notices are informational while the import tables remain empty.

Supabase Security Advisor still reports one warning: leaked-password protection is disabled. Enable it in Supabase Auth before production use.

## 5. Verification

- Latest full backend test run passed: 149 automated tests.
- Google Sheets scanner unit tests verify selected-sheet-only reads, row-number traceability, formula preservation, blank-row handling, helper/derived/invalid classification, and source fingerprints.
- Google OAuth unit test verifies PKCE parameters, state-bound completion, verified account email, and refresh-token-only persistence.
- Windows DPAPI encrypt/decrypt round-trip passed on the TFI host.
- Python compile checks and Node syntax checks for the import center and scan-progress scripts passed.
- HTML script-reference check passed for the six import workflow pages.
- Controlled TFI2 SQL test exercised batch creation, row staging, scan completion, duplicate decision, and finalization inside a transaction that was rolled back.
- Local application health endpoint returned HTTP 200 and confirmed database_project=TFI2.
- Unauthenticated request to GET /api/import/destinations returned HTTP 401 as expected.
- Current live data counts: 0 import batches, 0 staged import rows, 0 operational records.

## 6. Migration tracking note

The local file supabase/migrations/20261121022314_tfi2_operational_import_foundation.sql exists and its database objects are present in TFI2, but version 20261121022314 is not listed in the live Supabase migration history. Do not run a blanket migration push or reapply that non-idempotent file until migration history is reconciled. The new index migration version 20261121041306 is recorded in the live history and mirrored locally.

## 7. Next acceptance gate

Before live Google Sheets acceptance:

1. In Google Cloud, enable the Google Sheets API and configure the OAuth consent screen.
2. Create an OAuth client of type Web application.
3. Add this exact authorized redirect URI: http://127.0.0.1:5100/api/google-sheets/callback
4. Add TFI_GOOGLE_CLIENT_ID and TFI_GOOGLE_CLIENT_SECRET to the local .env file on the Windows TFI host. Never send the client secret in chat or commit it to source control.
5. Restart the local TFI application, sign in, and connect the Google Account that can access the source workbook.
6. Prepare a sanitized copy of the authoritative 35-tab workbook in Google Sheets.
7. Select one module only and paste its Google Sheets URL.
8. Verify the workbook metadata, exact registered worksheet title and sheetId, selected-sheet-only scan, row traceability, formulas, duplicate classifications, and incomplete-row behavior.
9. Keep the batch in review; do not finalize or promote records until the owner explicitly approves the test results. XLSX remains available as a backup source.

After acceptance, define and approve module-specific field contracts, business keys, and calculation rules before changing any destination from raw_capture_only to approved. CO QA remains blocked pending its business rules.