# TFI2 Selective Spreadsheet Import Execution — v0.4

> Superseded on 21 November 2026 by TFI_SELECTIVE_IMPORT_EXECUTION_v0.5_2026-11-21.md. Use version 0.5 for the current Google Sheets priority-workstream status.

Date: 2026-11-21  
Project: TFI_NEW / Supabase TFI2  
Status: Phase 5B backend API integration completed; import-ledger index hardening applied. Controlled client-workbook acceptance test is still pending. No production workbook has been imported.

## 1. Completed implementation

The following six UI screens are connected to the local Flask backend and TFI2:

- Spreadsheet Import Center
- Scan Progress
- Central Import Inbox
- Duplicate Review
- Final Import Approval
- Import History

Backend routes:

- GET /api/import/destinations
- POST /api/import/batches
- GET /api/import/batches
- GET /api/import/batches/<batch_id>
- GET /api/import/batches/<batch_id>/rows
- POST /api/import/batches/<batch_id>/rows/<row_id>/decision
- POST /api/import/batches/<batch_id>/finalize

The current file-ingestion method is Excel .xlsx upload only, with a 100 MB application limit. Direct Google Sheets OAuth and URL-based live reading are not connected.

The scanner reads only the worksheet registered for the selected destination module. It does not scan or stage other workbook tabs.

## 2. Data-safety rules

- One operational destination module per import batch.
- Reports & Reconciliation and Master Data are not import destinations.
- No Import All action is provided.
- Source values and formula expressions are retained as raw source evidence; formulas are not executed.
- Exact source duplicates are skipped by the database workflow.
- Possible duplicates require an authorized review decision.
- Incomplete operational rows remain eligible for controlled capture; no unapproved required-field rules are invented.
- Existing operational records have no update, merge, replace, or overwrite path.
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

- Latest local backend compile and test run passed: 87 automated tests in 2.77s.
- All six live import JavaScript files passed Node syntax checks.
- HTML script-reference check passed for the six import workflow pages.
- Controlled TFI2 SQL test exercised batch creation, row staging, scan completion, duplicate decision, and finalization inside a transaction that was rolled back.
- Local application health endpoint returned HTTP 200 and confirmed database_project=TFI2.
- Unauthenticated request to GET /api/import/destinations returned HTTP 401 as expected.
- Current live data counts: 0 import batches, 0 staged import rows, 0 operational records.

## 6. Migration tracking note

The local file supabase/migrations/20261121022314_tfi2_operational_import_foundation.sql exists and its database objects are present in TFI2, but version 20261121022314 is not listed in the live Supabase migration history. Do not run a blanket migration push or reapply that non-idempotent file until migration history is reconciled. The new index migration version 20261121041306 is recorded in the live history and mirrored locally.

## 7. Next acceptance gate

Before operational use:

1. Sign in through the local TFI_NEW application. Do not share the administrator password in chat.
2. Prepare a sanitized .xlsx copy of the authoritative 35-tab source workbook.
3. Select one module only and upload the workbook.
4. Verify that only the selected registered worksheet is scanned.
5. Review the staged rows, source traceability, duplicate classifications, and incomplete-row behavior.
6. Keep the batch in review. Do not finalize or promote records until the owner explicitly approves the test results.

After the acceptance test, define and approve module-specific field contracts, business keys, and calculation rules before changing any destination from raw_capture_only to approved.