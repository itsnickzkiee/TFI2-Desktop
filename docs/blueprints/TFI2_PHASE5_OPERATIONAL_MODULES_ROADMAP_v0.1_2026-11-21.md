# TFI2 Phase 5 — Operational Modules Backend Roadmap

Date: 22 November 2026
Project: TFI_NEW / TFI2
Phase status: IN PROGRESS

## 1. Phase 5 objective

Connect the approved operational module UIs to TFI2 so new records can be created, viewed, and edited under module permissions. Each module must have a verified source contract, server-side validation, duplicate protection, audit history, and a tested API before it is considered complete.

Phase 5 follows the official sequence in TFI2_PHASE_ALIGNMENT_TRACKER_v1.1_2026-11-21.md. Phase 4 Master Data is implemented and Phase 5 is the current active development phase.

Phase 5 does not import the historical workbook. Historical migration remains part of the separately controlled Phase 6 Import Center workflow. The Phase 6 screens/API and owner-approved direct Google Sheets URL/OAuth priority workstream were started early, but this does not reorder the project. Module-specific import promotion remains gated by Phase 5 contracts and the official Phase 6/7 acceptance boundaries.

Module-level developer checks and controlled verification may occur during Phase 5. Comprehensive system-wide end-to-end testing and final acceptance remain reserved for Phase 7.

## 2. Global Phase 5 rules

- TFI2 is the only live operational database.
- No Google Sheets runtime dependency is allowed for ordinary save, edit, view, or calculation operations.
- No historical source rows are copied during Phase 5 CRUD implementation.
- New incomplete records may be saved when the module contract has no approved mandatory-field rule; they remain marked unassessed until the owner approves completeness rules.
- Exact duplicate new entries are blocked using a module-specific fingerprint. A broader business key must not be invented without source/business-owner validation.
- Existing records must never be overwritten by a new entry or an import.
- Direct client insert/update/delete is revoked. Writes go through permission-checked database functions.
- Updates require optimistic version checks and append-only revision history.
- Every create/update operation writes an audit event in the same database transaction.
- Derived fields are calculated or looked up on the server and are not trusted from client-submitted values.
- No hard-delete action is introduced. Archive/restore requires its own approved workflow and permission.

## 3. Module implementation order

| Order | Module | Dependency / reason | Status |
|---:|---|---|---|
| 1 | DMP Production | Upstream manpower source used by Productivity Manpower Hours | Backend foundation and UI wiring implemented; authenticated browser acceptance deferred by owner |
| 2 | Product Entry | Core production record source; upstream for Yield Monitoring and CO QA | Backend deployed; UI integrated; 39-block mock-API browser verification passed; authenticated live browser acceptance pending |
| 3 | Production Entry + Production Summary | Daily production entry and saved-run history; duplicate identity must be reconciled | Backend/UI implemented; authenticated live acceptance pending |
| 4 | Production Schedule | Planning inputs and downstream reporting context | Backend/UI implemented; authenticated live acceptance pending |
| 5 | DMR Production | Downtime source used by Product Entry derived monitoring fields | Manual CRUD backend/UI implemented; authenticated live acceptance pending |
| 6 | DMR Coding | Downtime/coding source with unresolved historical product-code references | Manual CRUD backend/UI implemented; authenticated live acceptance pending |
| 7 | Hourly Meat, Hourly Coding, Hourly Agri | Shared 12-column source structure; implement a shared contract with separate module permissions | Shared backend/UI implemented; authenticated live acceptance pending; approval workflow pending |
| 8 | OEE | Operational input records plus approved OEE calculations | Backend/API/UI implementation present; focused tests 17 passed; full backend regression 239 passed; authenticated live browser acceptance pending |
| 9 | Productivity | Depends on DMP Production, Product Standard, Code Map, and approved source formula decisions | TFI2 schema/RPC/API/UI implemented; 20 focused tests and 259 full backend tests passed; live authenticated browser acceptance pending |
| 10 | Coding DPR | Seven batch groups; preserve source formula behavior until owner approval | TFI2 schema/RPC/API/UI implemented; 19 focused tests and 278 full backend tests passed; authenticated live browser acceptance pending |
| 11 | PR Monitoring | Preserve incomplete identifiable PR candidates; exclude totals and template rows | TFI2 read-only schema/RPC/API/UI implemented; 9 focused tests and 287 full backend tests passed; desktop/mobile browser mock passed; authenticated live acceptance pending; Phase 6 promotion remains raw-capture-only |
| 12 | CO QA | Depends on Product Entry; source QA projection A:X, formula outputs AE:AH, unresolved AI:AL and source-row identity rules | Product Entry UUID-linked Y:AD cost schema/RPC/API/UI implemented; exact 31-of-39 source-block mapping; 31 dynamic source formulas reproduced and 9 mixed formula/manual fields correctly made editable; AE:AH exact read-only formulas matched against 6 source worksheet rows (AE/AG); full backend 317 passed; mocked browser PASS with 0 console errors; authenticated live acceptance pending; AI:AL and historical import remain on business-rule hold |
| 13 | NON-PROD | Two source header rows; working-hours field is derived | Pending |

Yield Monitoring remains a read-only derived view, not an independent transaction-entry module. Reports & Reconciliation remains a reporting surface. Master Data is already handled by Phase 4.

## 4. Standard module delivery gates

1. Source-to-UI field mapping: exact source sheet ID, headers, inputs, formulas, lookup fields, and hidden/helper columns.
2. Business contract: nullable/incomplete behavior, validations, duplicate key, editable fields, calculated fields, and workflow states.
3. Database model: canonical records, indexes, foreign keys, RLS, revisions, audit events, and safe write RPCs.
4. API layer: permission checks, validation, pagination, filters, error mapping, and optimistic concurrency.
5. UI integration: load options from TFI2, save/read/update against TFI2, display saved records, and show revision history.
6. Automated tests: validation, permissions, duplicate behavior, incomplete records, update conflict, audit/revision behavior, and API routes.
7. Acceptance test: sign in through the local app, create a controlled test record, inspect it, edit it, verify history, then archive or remove nothing unless separately approved.

## 5. First module — DMP Production

### Source contract
- Workbook: Copy of TFI - Production Monitoring Sheet 1
- Spreadsheet ID: 1rCbQ16wj7MRjQCFF3tA-WEMkudraJK0RkwcqayUlz7k
- Worksheet: DMP - Production
- sheetId: 1312335050
- Source range: A1:I7629
- Header row: 1; first data row: 2

### Fields

| Source column | Field | Handling |
|---|---|---|
| A | Production Date0 | Nullable date input |
| B | Product Code | Nullable text input; source validation is broken and the observed list is not a canonical catalog |
| C | Process | Nullable selection validated against DMP LEGEND |
| D | Regular's Name/Casual | Nullable selection validated against DMP LEGEND |
| E | Count | Nullable nonnegative numeric input |
| F | Start | Nullable time input |
| G | End | Nullable time input |
| H | Total Time | Nullable nonnegative numeric input; source-entered value, not calculated from Start/End |
| I | Position | Server-derived snapshot from DMP LEGEND; not client-editable |

All input fields are nullable. Blank form rows are ignored. Partially filled rows can be saved and are marked unassessed; no unapproved mandatory-field rules are invented.

### Backend/API
- GET /api/dmp-production/options
- GET /api/dmp-production/records
- POST /api/dmp-production/records
- PATCH /api/dmp-production/records/<record_id>
- GET /api/dmp-production/records/<record_id>/revisions

Database tables:
- public.tfi_dmp_production_records
- public.tfi_dmp_production_revisions

Database functions:
- public.tfi_get_dmp_production_options
- public.tfi_create_dmp_production_records
- public.tfi_update_dmp_production_record

### Applied migrations
- 20261121043254 — tfi2_dmp_production_backend
- 20261121043319 — tfi2_dmp_production_fk_index

### Current verification
- Local Python compile checks passed.
- 97 automated backend tests passed.
- DMP Production UI and source-data JavaScript syntax checks passed.
- Static UI contract check confirms Product Code is a nullable text input (maximum 100 characters), while Process and Worker remain live TFI2 dropdowns.
- All 20 referenced UI element IDs were found in the HTML.
- Live DMP LEGEND options RPC was exercised under an authenticated TFI2 context: 42 workers and 69 processes returned.
- Live create/duplicate/incomplete/update RPC test passed inside a rolled-back transaction.
- Supabase Performance Advisor has no remaining unindexed-foreign-key finding for the DMP Production tables.
- Local application health endpoint returns HTTP 200 and reports database_project=TFI2.
- Unauthenticated DMP Production API requests return HTTP 401.
- Live DMP Production records, revisions, and audit event counts remain zero. No production/test records were persisted.

### Acceptance still required
DMP Production browser acceptance is deferred at the owner's request so development can continue. When resumed, sign in through the local TFI_NEW app, open DMP Production, verify the live dropdowns and saved-record list, save one owner-approved controlled test entry, edit it, inspect its revision history, then remove the test record only through a separately approved archive/cleanup process. Do not import historical rows during this test.

## 6. Second module — Product Entry

Product Entry backend work was started before DMP Production browser acceptance at the owner's direction. This is a scheduling exception only; it does not close the DMP Production acceptance gate or change the approved Phase 5 module order.

### Source contract
- Workbook: Copy of TFI - Production Monitoring Sheet 1
- Spreadsheet ID: 1rCbQ16wj7MRjQCFF3tA-WEMkudraJK0RkwcqayUlz7k
- Worksheet: Product Entry; sheetId 545274882
- Source range: Product Entry!A1:FH39160 (164 columns)
- Entry Map: sheetId 1628314566; range Entry Map!A2:F40
- 39 blocks: BLK_01 through BLK_39

### Preserved block rules
- Keep each product-family block separate; do not flatten Product Code options across blocks.
- Preserve each block's source header/group headers, formula templates, hidden columns, validation metadata, review column, and source row mapping.
- Column B Product Code is validated against that block's exact source-derived option list.
- Each block has its own Production Supervisor review column; valid statuses are Reviewed, Incomplete Data, For Verification of Data, and Cancelled.
- Only visible, non-formula, non-hidden columns within the block's defined header width are editable.
- Other field-level numeric/date rules and mandatory-field rules remain pending source-format/business-owner review. Incomplete records remain unassessed.
- Formula templates are preserved as metadata; no spreadsheet formulas are executed by this backend increment.

### Backend/API
- GET /api/product-entry/catalog
- GET /api/product-entry/records?block_key=BLK_01
- POST /api/product-entry/records
- PATCH /api/product-entry/records/<record_id>
- GET /api/product-entry/records/<record_id>/revisions

Database tables:
- public.tfi_product_entry_block_catalog
- public.tfi_product_entry_records
- public.tfi_product_entry_revisions

Database functions:
- public.tfi_get_product_entry_catalog
- public.tfi_create_product_entry_records
- public.tfi_update_product_entry_record

### Applied migrations
- 20261121055418 — tfi2_product_entry_backend (migration ledger placeholder; no schema changes)
- 20261121055459 — tfi2_product_entry_backend_schema
- 20261121055925 — tfi2_product_entry_fk_index

### Current verification
- Python compile checks passed.
- 111 automated backend tests passed across the backend suite.
- Live authenticated TFI2 catalog RPC returned all 39 blocks, from BLK_01 through BLK_39.
- Live create/update/revision/audit smoke test passed inside a rolled-back transaction.
- Live SQL checks rejected formula, hidden/cross-block Product Code, and invalid review-status inputs; exact duplicate detection inserted one row and skipped the repeated row. All checks were rolled back.
- Post-rollback persisted Product Entry records, revisions, and audit events remain zero.
- Product Entry UI is connected through design/product-entry-ui.js and design/product-entry-ui.css.
- Automated browser test passed for all 39 blocks, source-matched product codes/review fields, Save, filters, version-checked Edit, and revision History; browser console errors: 0. The browser test uses a mocked API and does not persist production data.
- Verified screenshot: design/product-entry-backend-verified-desktop.png.

### Acceptance still required
Complete authenticated live browser acceptance through the signed-in local TFI_NEW application using one owner-approved controlled test entry, then edit it and inspect its revision history. Do not import historical worksheet rows during this test.

## 7. Phase exit criteria

Phase 5 is complete only when every operational module in the approved scope has a tested TFI2 CRUD backend, module-specific validation, duplicate handling, audit/revision history, and a completed acceptance test. The current DMP Production increment is the first module implementation, not completion of Phase 5.

### Phase 5 development checkpoint — Production Entry/Summary and Production Schedule (22 November 2026)

Production Entry + Production Summary implementation was already present in TFI_NEW and TFI2; this checkpoint verified the actual files and deployed objects rather than duplicating them.

Production Entry + Production Summary implementation evidence:
- Source contract and manifest: src/tfi_backend/production_entry_contract.py and production_entry_manifest.json. The form maps the 12 source slots (rows 8–19) and the Production Summary 24-column saved-run register (sheetId 1846667474, header row 6, first data row 7).
- TFI2 migration 20261121091916 is present in the live migration ledger. The canonical tfi_production_entry_records, tfi_production_entry_revisions, and tfi_production_entry_catalog tables exist with RLS enabled. Current records/revisions count: zero.
- TFI_NEW routes exist for catalog, summary metrics, paginated/filterable saved runs, create, version-checked update, and revision history. The Reports & Reconciliation Production Summary view calls the saved-run APIs, supports filters/sort/page/export, edit, and revision history.
- Focused backend tests: 17 passed. Existing browser test passed with a mocked API, covering the 12-row form, derived attainment/absence/attendance, save payload, summary register, filters, version-checked update, and history call. Browser console errors: none. JavaScript syntax checks passed.
- This was local automated/mock-API verification only. No live user-entered test record or historical source rows were created.

Production Schedule implementation evidence:
- Source contract is present in src/tfi_backend/production_schedule_contract.py; TFI_NEW API and gateway methods, Production Schedule UI, and Schedule Summary live register UI are present.
- TFI2 migrations 20261121101704, 20261121101806, 20261121104549, and 20261121175615 are present in the live migration ledger. Canonical daily schedule form and revision tables exist in TFI2 with RLS enabled.
- Focused backend tests: 13 passed. Production Schedule and Schedule Summary JavaScript syntax checks passed.
- No live schedule form or historical workbook rows were created.

Acceptance status for both modules remains pending. Do not treat mocked browser checks as authenticated live acceptance. No destructive database changes, historical imports, or production transaction writes were performed in this checkpoint.

Next Phase 5 development module, preserving the approved order: DMR Production. Its current source UI/worksheet and existing import-only database foundation must be inspected before adding the missing manual CRUD workflow. Phase 5 remains ACTIVE; official seven-phase roadmap unchanged.


### Phase 5 development checkpoint — DMR Production manual CRUD implemented (22 November 2026)

- Reused the existing canonical TFI2 DMR Production table; no duplicate transaction table was created.
- Applied migration 20261122055131_tfi2_dmr_production_manual_crud. Added manual-entry support with nullable source_import_row_id, preserved original blank-header source columns I/J, version/status metadata, append-only revisions, and filter indexes.
- Added private permission-checked create/update/reference-data functions and public SECURITY INVOKER RPC wrappers. Manual create/update write audit events; updates require expected_version. Exact Date + Product Code + Line + Stop + Resume repeats are skipped without overwrite; same-key records with differing details are conflicts.
- Added TFI_NEW catalog/list/create/update/revision APIs and a saved-record register with filters, edit dialog, and revision-history dialog.
- Reference lists come from current TFI2 Code Map and DPR LEGEND; the 58 Product Code values are suggestions only because source validation is #REF!. The original blank headers I/J are retained as source_column_i/source_column_j rather than assigned invented labels.
- Focused DMR contract/API tests: 18 passed. Mocked browser test: PASS, no browser errors. Full backend regression suite: 185 passed. Python compile and frontend syntax checks passed.
- Rolled-back TFI2 SQL smoke test verified one insert, exact duplicate skip, version-2 update, one revision, and two audit events. Post-rollback DMR records/revisions/audit counts remain zero.
- Authenticated live browser acceptance remains pending. No production or historical workbook records were imported.

Next approved Phase 5 module: DMR Coding. Phase 5 remains ACTIVE; official seven-phase sequence unchanged. See docs/blueprints/TFI2_DMR_PRODUCTION_BACKEND_BLUEPRINT_v0.1_2026-11-22.md.


### Phase 5 development checkpoint — DMR Coding manual CRUD implemented (22 November 2026)

- Source contract verified from the approved workbook manifest: DMR Coding, sheetId 675328096, source data rows 4:4774 (4,771 rows), blank manual template starts at row 4775.
- Applied TFI2 migrations 20261122061143 (schema) and 20261122061236 (RPCs). Added canonical tfi_dmr_coding_records and append-only tfi_dmr_coding_revisions. No historical rows were copied.
- Current DPR LEGEND/Code Map reference data supplies 116 Product Code suggestions, 8 categories, 13 factors, and 68 Product Name mappings. AGRILINE/MEATLINE remain suggestions because source column C has no validation rule.
- Product Code remains text-entry capable because the source validation contains #REF! and one historical code (TMWKC-6-2950) is not in the current master list. Unmatched codes are preserved and flagged; no replacement is invented.
- No approved required-field/completeness rules were found. Nonblank partial entries are saved as unassessed; blank rows are ignored. Exact full-input fingerprints prevent exact repeats without inventing an event key.
- Added TFI_NEW catalog/list/create/versioned-update/revision APIs, saved-record register, filters, edit dialog, and revision-history dialog. Import destination remains raw-capture-only; Phase 6 promotion is not enabled.
- Focused DMR Coding contract/API tests: 15 passed. Mocked browser test: PASS, no browser errors. Full backend regression suite: 200 passed. Python compile and frontend syntax checks passed.
- Rolled-back TFI2 SQL smoke test verified two inserts, one exact duplicate skip, unmatched code preservation, version-2 update, revision and audit events. Post-rollback DMR Coding records/revisions/audit counts remain zero.
- Authenticated live browser acceptance remains pending. No production or historical workbook rows were imported.

Next approved Phase 5 module group: Hourly Meat, Hourly Coding, and Hourly Agri, using a shared source contract with separate module permissions. Phase 5 remains ACTIVE; official seven-phase sequence unchanged. See docs/blueprints/TFI2_DMR_CODING_BACKEND_BLUEPRINT_v0.1_2026-11-22.md.


### Phase 5 development checkpoint — Hourly Meat / Coding / Agri shared backend (22 November 2026)

- Implemented shared, module-isolated TFI2 backend for Hourly Meat, Hourly Coding, and Hourly Agri. Each retains separate module permissions and records.
- Source sheets verified: Hourly Meat sheetId 428082343 (A1:L5004), Hourly Coding sheetId 1916766220 (A5:L5004), Hourly Agri sheetId 534145404 (A5:L5004). Code Map catalog returned 68 product-code options.
- Applied migrations 20261122063710, 20261122064148, and 20261122064749. Added shared records/revisions tables, RLS, security-invoker RPC wrappers, read view, derived calculations, duplicate-slot protection, versioned updates, revisions, and audit events.
- Added catalog/list/create/update/revision APIs and integrated all three module UIs with TFI2. Each now supports live saved records, filters, save, edit, and revision history.
- Hourly contract/API tests: 25 passed. Full backend regression suite: 225 passed. Browser create/list/edit/history: 3/3 modules passed with zero runtime errors. Python compile and JavaScript syntax checks passed.
- Rolled-back SQL smoke tests covered all three modules and verified formulas, duplicate protection, updates, revisions, and list RPC. Post-test database counts remain zero; no historical/sample rows were imported.
- No new Hourly Production Security Advisor findings. Existing Production Entry SECURITY DEFINER warnings and leaked-password protection setting remain unchanged.
- Authenticated live acceptance pending. Submit/review/approve/return workflow is not yet implemented; current work covers save/list/edit/history. Phase 6 import/promotion remains separate. See docs/blueprints/TFI2_HOURLY_PRODUCTION_BACKEND_BLUEPRINT_v0.1_2026-11-22.md.


### Current Phase 5 handoff ? OEE is next in the approved module order (22 November 2026)

The Hourly Meat/Coding/Agri group is now implemented at the shared backend/UI level. The next approved Phase 5 module is OEE (order 8 in the unchanged sequence). Before adding manual CRUD, inspect the existing OEE source contract, OEE table, Phase 6 import integration, and UI to avoid duplicating the existing operational storage. Keep submit/review/approval for the Hourly modules as a separately scoped follow-up. Authenticated live acceptance remains pending for the modules already implemented. Comprehensive final acceptance remains Phase 7.


### Phase 5 development checkpoint — OEE implementation audit (22 November 2026)

- Audited the existing OEE implementation before creating anything new, per the Phase 5 handoff. Manual CRUD was already present; no duplicate OEE tables or APIs were added.
- Existing source contract: `src/tfi_backend/oee_contract.py`; the approved ten source inputs are validated server-side and the derived OEE fields are calculated server-side. Client submissions of derived fields are rejected.
- Existing TFI_NEW API routes: `GET /api/oee/catalog`, `GET /api/oee/records`, `POST /api/oee/records`, `PATCH /api/oee/records/<record_id>`, and `GET /api/oee/records/<record_id>/revisions`. Routes use module-specific view/create/edit permissions.
- Existing Supabase migration files found locally: `20261121171937_tfi2_oee_operational_foundation.sql`, `20261121172519_tfi2_oee_import_center_integration.sql`, and `20261122065832_tfi2_oee_manual_crud_and_revision_history.sql`. This file audit does not by itself assert remote migration deployment.
- Existing OEE UI includes live TFI2 catalog loading, manual entry, saved-record filters/pagination, versioned edit, and revision-history display. The preview loads `oee-backend-ui.js` after the source UI scripts.
- Focused OEE contract/API tests: 17 passed. Full backend regression suite: 239 passed. Python compile checks and OEE frontend JavaScript syntax checks passed.
- No authenticated live browser acceptance was performed in this checkpoint. No OEE records, revisions, or audit events were created; no historical records were imported.
- Next approved Phase 5 module: Productivity (order 9). Inspect and reconcile its existing source mapping and backend/UI foundation before adding or changing CRUD. Preserve the approved formula dependencies on DMP Production, Product Standard, and Code Map; do not infer unresolved source formulas.
- Phase 5 remains ACTIVE; the official seven-phase roadmap and module order are unchanged. Comprehensive final acceptance remains Phase 7.


### Phase 5 next-module audit — Productivity readiness (22 November 2026)

The next module (order 9) was inspected before implementation to avoid assuming the preview's embedded calculations are production-ready.

- Official source mapping from the 35-tab audit: Productivity sheetId 1688444278; source range A1:V1500; header row 4; first data row 5; source records previously counted as 626.
- Source input fields A:K: Date, Product Code, Line, Planned Run Hrs, Actual Output, and six FG reject categories (Dented, False Seam, Flipper, Bulged, Panel, Buckling).
- Formula/lookup fields L:V: Total FG Rejects, Manpower Hrs (DMP), Target Output 12H, Std Productivity, Std Output @ Actual MHR, Productivity, Output Attainment %, Reject %, Week, Month, and Product Name.
- Current preview files exist (`design/productivity-preview.html`, `design/productivity-ui.js`, `design/productivity-data.js`, `design/productivity.css`). The entry table supports 12 blank rows and additional rows, but Save is disabled in the current preview and no saved-record register/revision-history UI was found in this audit.
- No Productivity-specific API routes, gateway methods, backend contract/manifest, or dedicated Productivity database migration were found in the active source tree. Existing DMP Production storage and Product Standard/Code Map master data are upstream dependencies, not substitutes for a Productivity transaction table.
- The current preview data file embeds product capacity/standard values and line/product lists. The UI derives Target Output using capacity divided by 10 multiplied by Planned Run Hrs; Standard Productivity is taken from embedded standard values; Manpower Hrs is displayed as read-only pending DMP integration. These embedded values must be replaced by current TFI2 master-data lookups and a server-side DMP Production aggregation before live use.
- The source UI states that Productivity source columns A:K are input fields and L:V are formula/lookup fields. The backend must accept only A:K inputs, derive L:V server-side, and reject client-supplied derived fields.
- No Productivity migration, record, revision, or audit write was performed in this audit. Historical source rows remain outside Phase 5 and are reserved for the Phase 6 import workflow.
- Next implementation work: verify the exact Product Standard fields and DMP Production aggregation against the official workbook and current TFI2 schema; then define the source-aligned contract, exact duplicate fingerprint, incomplete-row behavior, indexes/RLS/revisions/audit RPCs, API routes, saved-record UI, and focused tests. Do not assume a broader business key than the source owner approves.


### Phase 5 progress — Productivity source dependency verification (22 November 2026)

- Reopened the Productivity preview and Product Standard seed SQL. Product Standard fields are stored in `tfi_master_data_rows.current_values` by category `product_standard`; source positions: code 0, product name 1, production line 2, line/variant 3, manpower allocation 4, capacity 12H 5, capacity 10H 6, Productivity TMS 7, output per hour 18, default shift 19, manual output override 20.
- Productivity inputs remain source A:K. Formula/lookup outputs L:V remain server-owned.
- Preview logic currently uses capacity 10H / 10 * planned hours for Target Output; Product Standard source currently exposes both Productivity TMS and Output per Hour, and some rows have blanks/overrides. Do not silently choose or normalize a different standard when source cells are blank.
- DMP Production canonical rows contain production_date, product_code, process, worker_name, worker_count, start_time, end_time, and source-entered total_time_hours. No approved Productivity-specific aggregation rule was found in the checked contract/source. Therefore MHR aggregation must not be guessed (for example, do not assume sum(worker_count * total_time_hours) grouped by date/product without confirming the source formula).
- The six reject categories and Total FG Rejects are source-defined. Productivity = Actual Output / Manpower Hours; Output Attainment = Actual Output / Target Output; Reject % = Total FG Rejects / (Actual Output + Total FG Rejects), as represented by the current preview calculations. Division-by-zero returns blank.
- Implementation gate: before finalizing Productivity transaction calculations, verify the exact workbook formulas for MHR aggregation, standard selection (TMS vs Output per Hour vs override), and any product-line match behavior. Keep the save contract limited to A:K and reject client-provided L:V.
- No new migration, API, or transaction data was written during this source verification. Phase 5 remains ACTIVE.


### Productivity — original Google Sheets formula verification (22 November 2026)

Source: user-provided native Google Sheet, tab `Productivity`, rows 4–30; exact formula strings retrieved from the live sheet using FORMULA render mode.

Confirmed formulas:
- L Total FG Rejects: `=IF($A5="","",SUM(F5:K5))`
- M Manpower Hrs (DMP): `=IF($A5="","",SUMIFS('DMP - Production'!$H$2:$H$1000000,'DMP - Production'!$A$2:$A$1000000,$A5,'DMP - Production'!$B$2:$B$1000000,$B5))`
  - Aggregate source DMP Production column H (Total Time) where column A (Production Date) equals Productivity A and column B (Product Code) equals Productivity B.
  - This is a SUMIFS of entered Total Time values; do not multiply by Count or by another factor.
- N Target Output 12H: lookup Product Standard and Specification column F by Product Code in column A, divide capacity by 10, multiply by Productivity planned run hours D; blank date yields blank; lookup error yields 0.
- O Standard Productivity: lookup Product Standard and Specification column H by Product Code in column A; blank date yields blank; lookup error yields 0.
- P Std Output @ Actual MHR: O*M only when both O and M are >0, otherwise 0.
- Q Productivity: E/M when M>0, otherwise blank.
- R Output Attainment: E/N when N>0, otherwise blank.
- S Reject %: L/(E+L) when E+L>0, otherwise blank.
- T Week: WEEKNUM(A,21); U Month: MONTH(A).
- V Product Name: Code Map column B lookup by Product Code in Code Map column A, fallback "Other".
- Inputs A:K only; L:V remain derived/read-only server values.
- Product Standard lookup source is specifically the workbook tab `Product Standard and Specificat` (the exact truncated tab title exposed by metadata), not a guessed alternative tab.
- This resolves the previously open MHR aggregation question. Implement these exact source semantics in the Productivity server contract; preserve blank-vs-zero behavior as above.


### Productivity backend — contract foundation started (22 November 2026)

- Added `src/tfi_backend/productivity_contract.py` with the approved A:K input-only contract.
- Accepted inputs: production date, product code, line, planned run hours, actual output tins, and six reject categories (dented, false seam, flipper, bulged, panel, buckling).
- Server-derived fields are explicitly rejected from client submissions.
- Contract handles Google Sheets date serials, nonnegative numeric validation, blank-row skipping, ISO week/month, and duplicate date + product-code checks.
- Added `tests/backend/test_productivity_contract.py`.
- Focused test result: 11 passed.
- Source formulas for L:V were verified against the live source sheet; database calculation design must preserve the exact spreadsheet semantics, including MHR from DMP Production Total Time, standard capacity from Product Standard column F, standard productivity from column H, and product name from Code Map.
- This is a local code foundation only. No Supabase migration has been applied and no operational data has been changed.


### Productivity database foundation drafted (22 November 2026)

- Added migration draft `20261122100000_tfi2_productivity_operational_foundation.sql`.
- Defines additive operational record and append-only revision tables; unique active business key is Production Date + Product Code, matching the preview's duplicate warning.
- Defines an internal computed view for L:V. L sums six reject fields; M sums active DMP Production Total Time for exact Date + Product Code; N uses Product Standard column F / 10 × planned hours; O uses Product Standard column H; P:V follow the verified source formulas and Code Map fallback.
- Product Standard capacity parsing handles source-formatted thousands separators (e.g. 102,600); attainment is blank when the target is zero, matching the spreadsheet IF guard.
- Computed view has no direct authenticated grant; future API must expose it only behind Productivity permission checks.
- This initial draft was superseded by the deployed schema/RPC migrations recorded in the Phase 5 implementation checkpoint below.
- Contract test suite remains green: 11 passed.


### Phase 5 development checkpoint — Productivity backend/API/UI implemented (22 November 2026)

- Applied TFI2 migration `20261122090838_tfi2_productivity_operational_foundation`: additive Productivity records and append-only revision tables, active unique key (Production Date + Product Code), RLS, read policies, and internal calculated view.
- Applied TFI2 migrations `20261122091235_tfi2_productivity_rpcs` and `20261122091546_tfi2_productivity_rpcs`: permission-checked catalog, list, get, create-batch, and versioned update RPCs. Create blocks client-supplied derived columns, skips exact Date + Product Code duplicates without overwrite, and writes audit events. Update checks expected version, appends before/after revision, and writes audit event.
- Applied TFI2 migration `20261122091932_tfi2_productivity_calculation_preview` and `20261122093144_tfi2_productivity_fk_indexes`: read-only source calculation preview RPC.
- Exact source formulas verified against the user's live Google Sheet. L = six reject categories sum; M = DMP Production Total Time SUMIFS by date and product code; N = Product Standard F / 10 × planned run hours; O = Product Standard H; P = O × M when both positive; Q = actual / M when M positive; R = actual / N when N positive; S = rejects / (actual + rejects); T = ISO week; U = month; V = Code Map product name fallback Other.
- TFI_NEW routes added: GET catalog, POST preview, GET paginated/filtered records, GET single record, POST batch save, PATCH version-checked update, GET revision history. Permission checks are enforced in app and database RPCs.
- Productivity UI now loads live product codes/lines from TFI2, previews server calculations, saves A:K only, lists saved records with filters/pagination, supports versioned editing and revision history. Save remains disabled without create permission.
- Automated browser test passed with mocked API: live-catalog UI, server calculation display, A:K-only save payload, saved register, edit, history, mobile layout, and zero browser errors. This is a mocked UI contract test, not authenticated live browser acceptance.
- Focused Productivity backend tests: 20 passed. Full backend regression: 259 passed. Python compile and JavaScript syntax checks passed.
- TFI2 authenticated SQL smoke tests (transaction rolled back) verified catalog returns 68 products and two line options; create inserted one row; exact Date + Product Code duplicate was skipped; versioned update advanced to version 2; one revision was written; formula preview returned 8.5 MHR from a temporary DMP source row, target 102,600, standard productivity 712.5, and 152 FG rejects. No smoke-test records were persisted.
- No historical Productivity rows imported. No existing operational data was modified. Authenticated live browser acceptance with the owner's actual TFI login remains pending.
- Next approved Phase 5 module: Coding DPR (order 10). Phase 5 remains ACTIVE; official seven-phase roadmap unchanged.


### Productivity database hardening follow-up (22 November 2026)

- Applied migrations 20261122093607 and 20261122093647 to enforce finite, nonnegative numeric values at the database layer and index the remaining Productivity foreign keys (updated_by, archived_by, revision changed_by).
- Supabase Performance Advisor no longer reports unindexed foreign keys for Productivity.
- Numeric guard verified: valid nonnegative decimals accepted; negative, NaN, and Infinity rejected.
- Security Advisor reports no new Productivity SECURITY DEFINER warning. Remaining SECURITY DEFINER warnings are pre-existing Production Entry public RPCs; leaked-password protection is a project-wide Auth setting.
- Live Productivity records and revisions remain zero.


### Phase 5 development checkpoint — Coding DPR backend/UI implemented (22 November 2026)

- Verified the current authoritative workbook and source registry: Copy of TFI - Production Monitoring Sheet 1; spreadsheet ID `1rCbQ16wj7MRjQCFF3tA-WEMkudraJK0RkwcqayUlz7k`; Coding DPR sheetId `1266086431`; source range A1:X1000; header row 2; first data row 3.
- Source manifest control totals: 414 source parent rows, 857 lot items; 370 valid and 44 needs_review. These are historical source-audit totals only; none were imported by this Phase 5 CRUD work.
- Exact field mapping implemented: A coding date, B line number, C:W seven repeating production-date/product-code/quantity triplets, X derived total.
- Preserved source formula behavior: X sums lot slots 1–6 only (E, H, K, N, Q, T). Batch 7 quantity W is retained and displayed separately; no formula correction was silently applied.
- Live TFI2 catalog returns 116 product-code suggestions from DPR LEGEND and line numbers 1, 2, 3 from DMP LEGEND. Unmatched product codes are retained and flagged; no substitution is performed.
- Applied migration `20261122095344_tfi2_coding_dpr_backend`: parent entries, seven-slot child lot items, append-only revisions, foreign-key/search indexes, RLS, catalog/list/get/create/update functions, exact full-row duplicate fingerprint, version-checked updates, and audit events.
- Applied migration `20261122101201_tfi2_coding_dpr_revision_fields_fix`: revision changed_fields now distinguishes parent-only changes from actual lot-slot changes.
- Applied migration `20261122102002_tfi2_coding_dpr_shape_guard`: direct RPC callers cannot bypass the seven-slot array or lot-number ordering contract; missing or malformed lot arrays are rejected.
- Added Coding DPR contract, TFI2 gateway methods, permission-gated API routes, and UI integration: live catalog, 12 initial rows (up to 50 per batch), A:W-only saves, lazy saved-record register, filters/pagination, Coding DPR Inbox review filter, versioned edit, and revision history.
- Incomplete lot triplets, missing line identity, and unmatched product codes are visibly flagged in the module's Coding DPR Inbox. No mandatory-field or approval rules were invented beyond the explicit source review flags.
- Focused Coding DPR contract/API tests: 19 passed. Full backend regression: 278 passed. Python compile and JavaScript syntax checks passed.
- Mocked browser workflow passed: 12 initial rows, 116 product-code options, three line options, X excludes batch 7, A:W-only save payload, saved register, Inbox filter, edit, revision history, responsive mobile width, and zero browser errors.
- Authenticated TFI2 SQL smoke test passed inside a rolled-back transaction: catalog, create, exact duplicate skip, partial-row Inbox visibility, source total vs batch 7, parent-only and lot edits, revision changed fields, and audit events.
- Post-rollback counts remain zero: Coding DPR entries 0, lot items 0, revisions 0, Coding DPR audit events 0. No historical records were imported.
- Supabase Security Advisor has no new Coding DPR SECURITY DEFINER finding. Performance Advisor has no unindexed-FK finding for the new Coding DPR tables. Existing project-wide warnings are documented separately.
- Authenticated live browser acceptance remains pending; do not count Coding DPR as accepted until the owner signs in and completes the controlled test-record/edit/history check.

Next approved Phase 5 module: PR Monitoring (order 11). Official seven-phase roadmap remains unchanged.


### Phase 5 development checkpoint — PR Monitoring read-only backend implemented (22 November 2026)

- Verified the live workbook and exact source: `Copy of TFI - Production Monitoring Sheet 1`, spreadsheet ID `1rCbQ16wj7MRjQCFF3tA-WEMkudraJK0RkwcqayUlz7k`, worksheet `PR MONITORING`, sheetId `867256143`, grid A1:AA1000, displayed source fields A:G, summary row 2, header row 3, first data row 4, three frozen rows.
- Source audit: 78 populated rows; 64 rows with PR Numbers; 12 product-group total rows; row 4 template; row 79 incomplete candidate without PR Number. PR Number remains text to preserve leading zeros.
- Preserved source formula behavior: summary row 2 remains a labelled source snapshot (16,182,629 required, 15,648,348 produced, 96.70% completion). D/E/F remain source values; G status is captured as a read-only formula result. No TFI2 formula is substituted.
- Added read-only canonical table `tfi_pr_monitoring_records`, RLS SELECT policy, source identity/row/fingerprint constraints, and filterable/paginated SECURITY INVOKER read RPC. Authenticated direct INSERT/UPDATE/DELETE are revoked.
- Added permission-checked catalog, records, and CSV export API routes. The PR Monitoring module has no manual create/edit/save/submit/approve endpoints.
- Integrated the PR Monitoring UI with TFI2: visible connection state, exact A:G columns, source snapshot cards, refresh, filters/sorting, and CSV export disabled until approved records exist and export permission is granted.
- Import Center destination remains `raw_capture_only` with A:F inputs and G formula column. Group totals and row 4 template are excluded from the canonical register; row 79 remains an incomplete Import Inbox candidate. No historical rows were imported.
- Applied migrations: `20261122103759_tfi2_pr_monitoring_readonly_backend` and `20261122104722_tfi2_pr_monitoring_fk_indexes`.
- Focused PR Monitoring tests: 9 passed. Full backend regression: 287 passed. Python compile, JavaScript syntax, and mocked desktop/mobile browser checks passed with zero browser errors.
- Authenticated SQL smoke test passed in a rolled-back transaction: read RPC/filtering, invalid status rejection, RLS, and direct-write denial. Current PR Monitoring table count remains zero.
- Security Advisor shows no new PR Monitoring security finding. Performance Advisor shows no unindexed PR Monitoring foreign key after the follow-up index migration. Existing project-wide warnings are documented in the PR Monitoring blueprint.
- Authenticated live browser acceptance remains pending. Do not import source history during that acceptance.

The Phase 5 implementation count advances from 10/13 to **11/13 module work items implemented**. The next approved Phase 5 module is **CO QA (order 12)**, subject to its existing business-rule hold; NON-PROD remains order 13. Official seven-phase roadmap unchanged. See `docs/blueprints/TFI2_PR_MONITORING_BACKEND_BLUEPRINT_v0.1_2026-11-22.md`.
