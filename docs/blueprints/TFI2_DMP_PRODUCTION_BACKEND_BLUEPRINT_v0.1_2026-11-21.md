# TFI2 DMP Production Backend Blueprint

Version: 0.1  
Date: 21 November 2026  
Status: Implemented foundation; authenticated browser acceptance pending.

## 1. Purpose and scope

Provide TFI2-native create, read, update, and revision history for new DMP Production manpower entries. This increment does not import historical workbook rows and does not replace the source workbook.

## 2. Verified source

- Authoritative workbook: Copy of TFI - Production Monitoring Sheet 1
- Spreadsheet ID: 1rCbQ16wj7MRjQCFF3tA-WEMkudraJK0RkwcqayUlz7k
- Worksheet: DMP - Production
- sheetId: 1312335050
- Grid: 7,629 rows × 9 columns
- Header row: 1
- First data row: 2
- Import classification: selective transaction source

## 3. Field contract

| Source | UI field | Database field | Rule |
|---|---|---|---|
| A | Production Date0 | production_date | Nullable date |
| B | Product Code | product_code | Nullable text, maximum 100 chars; historical product-code dropdown is observed source data, not an approved canonical catalog |
| C | Process | process | Nullable text, maximum 300 chars; nonblank values must match active DMP LEGEND process options |
| D | Regular's Name/Casual | worker_name | Nullable text, maximum 200 chars; nonblank values must match active DMP LEGEND worker options |
| E | Count | worker_count | Nullable nonnegative numeric, up to 3 decimal places |
| F | Start | start_time | Nullable time without timezone |
| G | End | end_time | Nullable time without timezone |
| H | Total Time | total_time_hours | Nullable nonnegative numeric, up to 4 decimal places; entered source value, not derived from Start/End |
| I | Position | worker_position | Server-derived snapshot from DMP LEGEND; client cannot submit or edit |

All eight user-input fields are nullable because no approved required-field list was provided. A row with at least one value can be saved; blank rows are skipped. Saved records are marked completeness_status=unassessed and list blank_fields. This does not imply that blank fields are approved or complete.

## 4. Master Data dependency

Worker and process options come from active data rows in Master Data category dmp_legend. Position is looked up on the server by worker name and stored as a snapshot with worker_reference_row_id. Users do not need direct Master Data view permission to read the DMP-specific options; the narrow options RPC checks dmp_production.view.

Product Code is not server-rejected against an unverified historical list. The source workbook contains unresolved product-code validation signals, so a canonical product-code rule must be approved separately.

## 5. Database objects

### Tables
- public.tfi_dmp_production_records — current operational record, version, fingerprint, source-derived position, completeness note, actor metadata, and archive state.
- public.tfi_dmp_production_revisions — append-only before/after snapshots for edits.

### RPC functions
- public.tfi_get_dmp_production_options()
- public.tfi_create_dmp_production_records(p_records jsonb)
- public.tfi_update_dmp_production_record(p_record_id uuid, p_expected_version integer, p_changes jsonb, p_change_reason text)

### Security
- RLS is enabled on both tables.
- Direct client writes are revoked; authenticated users receive SELECT only, gated by dmp_production.view.
- Create and update functions verify auth.uid() and the matching module permission.
- Create requires dmp_production.view + dmp_production.create.
- Update requires dmp_production.view + dmp_production.edit.
- Exact duplicate fingerprints are unique across the DMP Production table, including archived records.
- Update uses expected_version and writes a revision and audit event in the same transaction.
- There is no hard-delete RPC or client write grant.

## 6. Local API routes

- GET /api/dmp-production/options
- GET /api/dmp-production/records?page=1&page_size=50&date_from=YYYY-MM-DD&date_to=YYYY-MM-DD
- POST /api/dmp-production/records
- PATCH /api/dmp-production/records/<record_id>
- GET /api/dmp-production/records/<record_id>/revisions

## 7. UI behavior

- Loads worker and process options from the authenticated TFI2 options RPC.
- Product Code is a nullable text input (maximum 100 characters); the observed historical values remain reference evidence only because the source validation is #REF! and no canonical catalog has been approved.
- Keeps the existing 12-row DMP entry grid.
- Allows incomplete new rows and skips completely blank rows.
- Displays server-derived Position as read-only.
- Displays saved records from TFI2 with date filters and pagination.
- Allows edit only when the current profile has dmp_production.edit.
- Shows revision history.
- Does not offer delete, overwrite, merge, or historical workbook import.

## 8. Files changed

- supabase/migrations/20261121043254_tfi2_dmp_production_backend.sql
- supabase/migrations/20261121043319_tfi2_dmp_production_fk_index.sql
- src/tfi_backend/dmp_production_contract.py
- src/tfi_backend/supabase_gateway.py
- src/tfi_backend/app.py
- tests/backend/test_dmp_production.py
- design/dmp-production-preview.html
- design/dmp-production-ui.js
- design/dmp-production.css

## 9. Verification

- 97 automated backend tests passed.
- Python compile check passed.
- DMP Production UI JavaScript and source-data JavaScript syntax checks passed.
- UI source-contract check confirms Product Code is a nullable text input (maximum 100 characters), not a dropdown; Process and Worker remain live TFI2 dropdowns.
- 20 UI element IDs referenced by the script were confirmed in the HTML.
- Live options RPC returned 42 worker options and 69 process options under an authenticated TFI2 context.
- Live create RPC test saved one test row, skipped one exact duplicate, and ignored one blank row inside a rolled-back transaction.
- Live update RPC test incremented the version and wrote revision/audit data inside a rolled-back transaction.
- Supabase Performance Advisor has no unindexed foreign-key finding for the new DMP Production tables.
- Local app health returns HTTP 200 and database_project=TFI2.
- Unauthenticated requests to the DMP Production options and records APIs return HTTP 401.
- Current persisted DMP Production counts: 0 records, 0 revisions, 0 DMP Production audit events.

## 10. Acceptance and known limitations

Authenticated browser acceptance is still required. Sign in to the local application, open DMP Production, verify options and the saved-record list, create one owner-approved test record, edit it, and inspect the revision history. Do not create a test record without the owner's approval.

Historical rows are not loaded into this module table. The Phase 6 Import Center currently stages/finalizes generic operational import records and must be integrated with module-specific operational tables before historical DMP imports are considered complete.

Productivity calculations are not yet connected to this DMP table. Phase 5 must implement and approve the Productivity dependency before any KPI or report is treated as production-ready.