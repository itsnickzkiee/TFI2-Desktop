# TFI2 — Official Phase Alignment Tracker
**Version:** 1.1  
**As-of date:** 22 November 2026  
**Project:** TFI_NEW / TFI2  
**Project folder:** C:\Users\Rominick\Desktop\TFI_NEW  
**Status:** Official seven-phase sequence preserved; owner-priority Google Sheets workstream implemented early under Phase 6

## 1. Governing decision

This document is the single status tracker for the original seven-phase TFI2 backend roadmap.

The phase order is fixed:

1. System Foundation
2. Authentication & Authorization
3. Audit Trail & Security
4. Master Data Backend
5. Operational Modules Backend
6. Import Center
7. Dashboard, Reports & Final System-wide Testing

Do not renumber, merge, skip, or reorder these phases without the project owner's explicit approval.

The separate eight-stage lifecycle in Section 11 of TFI_NEW_MASTER_BLUEPRINT_v0.1_2026-11-18.md remains a high-level project lifecycle (requirements, UI/UX, database, foundation, module development, calculations/reporting, acceptance, and release packaging). It is not a replacement numbering scheme for this seven-phase backend tracker. Use this seven-phase sequence when tracking TFI2 backend progress.

Some Phase 6 Import Center implementation was started before Phase 5 was completed. This is early implementation only; it does not change the official phase order. Phase 5 remains the current active phase. Complete the operational module backends before finalizing module-specific import promotion in Phase 6.

Owner-approved priority workstream: direct Google Sheets URL import is being implemented as early Phase 6 work while Phase 5 remains active. It is a parallel priority track, not a new phase, and does not authorize skipping Phase 5 module contracts or Phase 7 final acceptance.

## 2. Testing policy

Testing has two different levels:

- **Development checks during each phase:** unit tests, API contract tests, syntax checks, permission checks, database function checks, and focused module verification. These are necessary engineering gates and do not mean the final system has been accepted.
- **Final system-wide testing in Phase 7:** end-to-end workflow testing across all completed modules, roles and permissions, import safeguards, calculations, dashboards, reports, data integrity, security, recovery, performance, and release readiness.

The owner-requested comprehensive testing and final acceptance are reserved for Phase 7. Do not present the project as fully tested, production-ready, or released before that phase passes.

## 3. Phase status summary

| Phase | Official scope | Status | Completion boundary |
|---|---|---|---|
| 1 | System Foundation | COMPLETED | Local TFI_NEW host, TFI2 database foundation, source registry, shared app foundation, and core database security structures are established. |
| 2 | Authentication & Authorization | CORE IMPLEMENTED | Supabase Auth, active administrator profile, System Administrator role, permission catalogue, and server-side permission checks are in place. Full cross-role acceptance remains part of Phase 7. |
| 3 | Audit Trail & Security | FOUNDATION IMPLEMENTED / PARTIAL | Append-only audit store, RLS, access checks, server-side session handling, and audit hooks exist. Live security monitoring, complete failed-login history, server-side session revocation, and security hardening remain outstanding. |
| 4 | Master Data Backend | IMPLEMENTED | Nine categories, source snapshots, API/UI integration, field-level permissions, protected source values, and revision-capable update workflow are implemented. Final cross-role and end-to-end acceptance is reserved for Phase 7. |
| 5 | Operational Modules Backend | IN PROGRESS | Eleven of thirteen module work items now have backend foundations implemented (including Productivity, Coding DPR, and PR Monitoring); module-specific authenticated browser acceptance and two remaining module implementations are still outstanding. |
| 6 | Import Center | PARTIALLY IMPLEMENTED EARLY — XLSX + GOOGLE SHEETS LINK SCANNING | Six import workflow screens and backend routes are connected. Direct Google Sheets OAuth/read-only worksheet scanning is implemented locally; OAuth credentials and live client-workbook acceptance remain pending. Module-specific destination contracts and canonical operational-table promotion remain after Phase 5. |
| 7 | Dashboard, Reports & Final System-wide Testing | PENDING | Connect approved calculations and reporting sources, then run comprehensive end-to-end acceptance, security, integrity, recovery, and release checks. |

## 4. Detailed status and evidence

### Phase 1 — System Foundation
**Status: COMPLETED**

Implemented:
- TFI2 Supabase project is the only database target for TFI_NEW.
- Local Windows Flask/Waitress application host is configured.
- Official 35-tab source workbook registry is stored as metadata.
- Initial schema, RLS, private permission helpers, and migration tracking are established.
- Application health endpoint reports the TFI2 connection.

No historical operational workbook rows were copied as part of the foundation.

### Phase 2 — Authentication & Authorization
**Status: CORE IMPLEMENTED**

Implemented:
- Supabase Auth sign-in integration.
- TFI user profile linked to Supabase Auth.
- Active first administrator and System Administrator role.
- 360 catalogued permission entries and approved administrator grants.
- Server-side access-context and module permission checks.
- New users default to pending with no automatic application role.

The final multi-role, least-privilege, denied-action, session-expiry, and account-lifecycle acceptance matrix remains part of Phase 7.

### Phase 3 — Audit Trail & Security
**Status: FOUNDATION IMPLEMENTED; LIVE MONITORING PARTIAL**

Implemented:
- Append-only audit event table and read controls.
- RLS and permission-gated access.
- Server-side session vault and authentication/access checks.
- Audit event hooks in implemented trusted database workflows.

Outstanding:
- Connect the Audit Trail UI to verified live events.
- Connect Security & Activity to live sign-in, failed-login, session, and security-event data.
- Complete trusted server-side session revocation.
- Complete security-alert rule/notification backend behavior.
- Resolve the Supabase Auth leaked-password-protection warning.
- Approve retention, privacy, backup, and recovery policies.

Current live audit event count is one bootstrap event. No DMP Production or import transaction has been persisted, so no corresponding operational audit event exists yet.

### Phase 4 — Master Data Backend
**Status: IMPLEMENTED; FINAL ACCEPTANCE DEFERRED TO PHASE 7**

Live TFI2 evidence:
- 9 Master Data categories.
- 1,135 stored source rows.
- 1,063 active data rows.
- Master Data category, row, revision, and update workflow tables/functions exist.
- API routes exist for category list, row list, row revisions, and version-checked updates.
- Master Data UI calls the local API.
- Field-level category/column rules, protected source values, and row-specific locks are enforced.
- DMP LEGEND is already consumed by DMP Production options.

Focused Master Data contract tests: 16 passed.

Current revision count is zero because no Master Data edits have been made. This is not a failed revision workflow; it means no live edit has yet generated a revision.

### Phase 5 — Operational Modules Backend
**Status: IN PROGRESS — ELEVEN OF THIRTEEN MODULE WORK ITEMS IMPLEMENTED; ACCEPTANCE OPEN**

DMP Production implemented:
- TFI2 current-record and append-only revision tables.
- Permission-checked create, read, update, options, and revision-history routes.
- Exact duplicate protection, incomplete-row capture, version-checked updates, and audit events.
- DMP LEGEND Process and Worker options from live TFI2 Master Data.
- Server-derived, read-only Position mapping.
- Entry UI, saved-record list, filters, edit, and history controls.

DMP Production browser verification observed live Process and Worker options and the matching Operator Position when Gonzaga, Julius was selected. Full create/read/update/revision browser acceptance is deferred at the owner's request; no DMP Production records or revisions are persisted.

Product Entry backend foundation implemented:
- Source-backed catalog for all 39 Entry Map product-family blocks, preserving the 164-column A:FH source layout.
- Per-block Product Code options and per-block Production Supervisor review columns; product-code lists are not flattened.
- Source column-letter record payloads; formula, hidden, and trailing out-of-contract columns are rejected.
- TFI2 catalog, current-record, and append-only revision tables.
- Permission-checked catalog, list, create, update, and revision-history API routes/RPCs.
- Exact duplicate protection, incomplete-row capture, version-checked updates, and audit events.
- Formula templates and hidden-column metadata are retained; formula execution is not implemented in this increment.

Product Entry verification:
- 111 automated backend tests passed across the backend suite.
- Local TFI_NEW backend restarted with the Product Entry routes; health returns HTTP 200 and database_project=TFI2.
- Unauthenticated Product Entry catalog API request returns HTTP 401.
- Authenticated catalog RPC returned all 39 blocks.
- Live create/update/revision/audit smoke test succeeded inside a rolled-back transaction.
- Live SQL validation rejected formula, cross-block Product Code, and invalid review-status inputs; exact duplicate detection inserted one row and skipped the repeated row, all within rolled-back transactions.
- Persisted Product Entry records, revisions, and Product Entry audit events remain zero.
- Product Entry UI integration is complete: New Entry, Saved Records, block-specific filters, Save, Edit, and History are connected to the TFI2 APIs.
- Automated browser verification passed for all 39 blocks, Save payloads, saved-record filtering, version-checked edits, and revision history using a mocked API; no browser console errors.
- Authenticated live browser acceptance remains pending.

Phase 5 module order is maintained in:
TFI2_PHASE5_OPERATIONAL_MODULES_ROADMAP_v0.1_2026-11-21.md

DMP Production acceptance remains open. Product Entry backend development was started before that browser acceptance at the owner's direction; this does not change the official module order or close either acceptance gate. Do not declare Phase 5 complete after these two modules alone.

### Phase 6 — Import Center
**Status: PARTIALLY IMPLEMENTED EARLY; FINAL MODULE INTEGRATION PENDING**

Implemented:
- Spreadsheet Import Center.
- Scan Progress.
- Central Import Inbox.
- Duplicate Review.
- Final Import Approval.
- Import History.
- Local API and TFI2 import workflow functions.
- One module per batch and exact-source duplicate protection.
- XLSX upload remains available as a backup source.
- Direct Google Sheets URL ingestion through a read-only Google OAuth authorization-code flow with PKCE.
- Google refresh tokens are stored encrypted with Windows DPAPI for the current Windows user; Google access tokens are not persisted in the connection file or exposed to browser JavaScript.
- Spreadsheet metadata is checked against the approved module worksheet title and exact source sheetId before a batch is created.
- The scanner reads only the selected registered worksheet in bounded row ranges, preserves source row numbers and formula expressions, and does not execute formulas.
- The existing TFI2 import ledger accepts source_type='google_sheets' and stores the spreadsheet ID as source provenance; no new database schema migration was required for this increment.

Outstanding:
- Add the Google OAuth Web application client ID and secret to the local TFI .env file; do not share the secret in chat or commit it to source control.
- Complete a real Google OAuth connect/refresh/revoke test and a controlled sanitized client-workbook scan.
- Complete Phase 5 operational module destinations first.
- Replace raw-capture-only destinations with reviewed module-specific field contracts.
- Connect approved import promotion to each canonical module table, not only the generic import ledger.
- Complete business-key duplicate/review rules and formula/derived-field handling.
- Resolve CO QA business rules before enabling it.
- Perform controlled workbook acceptance only after destination contracts are ready; keep any test batch in review until the owner approves.

Current live counts: 0 import batches, 0 staged rows, and 0 generic imported operational records. No production workbook has been imported.

The local backend now supports both XLSX upload and direct Google Sheets URL scanning. The direct link path is implemented but is not live-accepted until the Google OAuth client credentials are configured and a sanitized client workbook passes the controlled acceptance gate. Technical details and setup steps are documented in TFI2_GOOGLE_SHEETS_PRIORITY_WORKSTREAM_v0.1_2026-11-21.md.

### Phase 7 — Dashboard, Reports & Final System-wide Testing
**Status: PENDING**

Existing UI work:
- Main Dashboard / KPI Dashboard preview.
- Reports & Reconciliation preview.
- Monitoring and reporting page designs.

Outstanding implementation:
- Connect dashboard metrics to approved canonical operational records.
- Implement and validate calculation services and formula dependencies.
- Connect reports and reconciliation to verified database records.
- Preserve source traceability for displayed metrics and totals.
- Implement empty, loading, error, and permission states using real data.

Final acceptance scope:
1. End-to-end workflows across all operational modules.
2. Authentication, all approved roles, and least-privilege permission matrix.
3. Audit events, revisions, and history traceability.
4. Incomplete rows, exact duplicates, possible duplicates, and no-overwrite guarantees.
5. Phase 6 scan, review, approval, and canonical module promotion.
6. Formula parity and KPI/report reconciliation against approved source rules.
7. Security, session expiry/revocation, privacy, and retention.
8. Backup and restore verification.
9. Performance and responsive UI checks.
10. Owner acceptance and release readiness.

Only after Phase 7 acceptance should the application be packaged as the final Windows release ZIP, following the separate release-packaging requirements in the master blueprint.

## 5. Live TFI2 snapshot — 21 November 2026

| Data object | Current count |
|---|---:|
| Master Data categories | 9 |
| Master Data source rows | 1,135 |
| Active Master Data data rows | 1,063 |
| Master Data revisions | 0 |
| DMP Production records | 0 |
| DMP Production revisions | 0 |
| Product Entry catalog blocks | 39 |
| Product Entry records | 0 |
| Product Entry revisions | 0 |
| Product Entry audit events | 0 |
| Import batches | 0 |
| Import staged rows | 0 |
| Generic imported operational records | 0 |
| Audit events | 1 |

The zero operational transaction counts confirm that no production or historical transaction rows have been added through these workflows. The Product Entry catalog contains source metadata only, not historical transaction data.

Latest recorded local verification:
- 149 automated backend tests passed across the backend suite after the Google Sheets priority-workstream increment.
- Python compile checks passed.
- DMP Production UI and source-data JavaScript syntax checks passed.
- DMP Product Code UI source-contract check passed: nullable text input, not an unapproved historical dropdown.
- DMP Production UI element-ID check passed.
- Product Entry manifest preserves 39 blocks, 152 per-block Product Code options, and 1,578 editable source fields.
- Product Entry API and contract tests cover block-specific validation, formula/hidden-column protection, incomplete rows, permissions, create, list, and update.
- Authenticated Product Entry catalog RPC returned 39 blocks.
- Product Entry create/update/revision/audit smoke test was run inside a rolled-back transaction; persisted Product Entry records/revisions/audit counts remain zero.
- Focused Master Data contract tests: 16 passed.

Supabase Security Advisor still reports leaked-password protection disabled. The Product Entry Performance Advisor foreign-key finding for archived_by was addressed by migration 20261121055925; unused-index notices remain informational.

## 6. Immediate next work

Continue Phase 5 only.

1. Complete authenticated live browser acceptance for PR Monitoring: verify the TFI2 read-only connection, empty register before approved import, exact A:G fields, source snapshot labels, filters, and export permission. Do not import historical rows during this check.
2. Continue with CO QA (module order 12) and NON-PROD (13), preserving the CO QA business-rule hold and NON-PROD source-specific formula rules.
3. Resume deferred authenticated browser acceptance for Coding DPR, Productivity, Product Entry, DMP Production, and the other completed modules when the owner is ready; coordinate these checks alongside remaining Phase 5 implementation.
4. Complete every operational module and its approved calculations/dependencies before returning to Phase 6 for module-specific import contracts and canonical destination integration.
5. Build live Dashboard and Reports in Phase 7, then perform all comprehensive system-wide testing as the final acceptance gate.

**Owner instruction:** Keep the original phase sequence. Do not move the project to the next phase merely because an early implementation exists. Do not conduct or claim final system-wide acceptance before Phase 7.


### Phase 6 audit update (22 November 2026)

- The live TFI2 registry contains 14 raw-capture destinations and one destination on business-rule hold (co QA). The import ledger has zero batches and zero staged rows.
- The official workbook contains 35 tabs. Initial spans were sampled for every tab. OEE uses grouped headings on row 3 and field labels on row 4. Product Entry needs review across its full multi-block header and formula layout.
- Existing code and mocked browser checks confirm that Google Sheets is the primary input and the selected module identifies its registered worksheet. The Windows backend suite passed 149 existing tests. The browser check passed on desktop and mobile with a mocked backend.
- Live Google OAuth requires a configured web client ID, client secret and an authorized account. The TFI_NEW local configuration did not show these credentials during the audit.
- The scanner uses fixed registry bounds and marks captured records unassessed. Header detection, mapping review, required-field classification, business-key comparison, and canonical operational writes require implementation and module contract verification.
- Implementation should reuse google_sheets.py for source access, import_service.py for row normalization, app.py and supabase_gateway.py for orchestration, and the existing Import Center screens for mapping and review. Verify SQL dependencies, replay semantics, and canonical write permissions before adding a migration.
- Phase 6 remains in progress. This audit used read-only database queries and synthetic test fixtures.


### OEE pilot audit (22 November 2026)

- The Phase 5 roadmap lists OEE operational persistence and calculations as pending. The Windows OEE UI calculates values in the form. TFI2 has a raw-capture OEE destination, with no OEE-specific public relation or RPC found. The existing generic import ledger is not the canonical OEE destination.
- The official OEE tab has field labels on row 4 and data starting on row 5. A:J are source inputs. K:U contain calculated fields, including Performance based on the count capped at Ideal Output and Product Name from Code Map. Dates are numeric serials in an unformatted Sheets response.
- A read-only scan of A5:J4000 found 3,700 populated rows. Every input column was populated on those rows. A normalized Date + Machine + Product Code key had zero repeated occurrences, consistent with the worksheet instruction of one row per machine, day and product. Treat the key and required-field rules as candidates until the OEE contract is defined. Synthetic data is needed to test incomplete records and conflicts.
- Implement the canonical OEE record contract before wiring operational import. Preserve partial rows in the Import Inbox. Keep Phase 6 workbook acceptance separate from a production import.


### OEE validation contract increment

- Added the OEE A:J input validator and K:T calculations. The pilot treats all A:J fields as required for an operational record. Missing fields and invalid values have separate diagnostics.
- The candidate comparison key normalizes Date, Machine and Product Code. The contract calculates Performance from the count capped at Ideal Output. Resolve Product Name through the canonical Code Map integration.
- The existing finalization RPC still writes to the generic ledger. Integrating OEE validation into live scans requires a canonical destination, database-enforced duplicate protection and a finalization path that retains incomplete rows in the Import Inbox. No live import path or schema was changed in this increment.

### OEE operational storage increment

- TFI2 migration 20261121171937 adds OEE input storage, permission-checked reads and saves, and a unique key over date, normalized machine and normalized product code. The save RPC emits an audit event for new records.
- Rolled-back SQL smoke tests verified an authorized insert, duplicate suppression without overwrite, rejection of incomplete and invalid inputs, and denial of an unauthenticated save. The persisted OEE record count is zero.
- Import Center routing, source provenance and retention of incomplete rows in the Import Inbox remain pending.

### OEE Import Center integration

- TFI2 migration 20261121172519 validates OEE inputs during staging and approval, saves valid records to the OEE table with staged-row provenance, retains incomplete rows in the Inbox, and skips existing business keys. Other destinations retain their existing finalization path.
- Synthetic scan, approval, and repeat import passed inside rolled-back TFI2 transactions. Zero OEE records and OEE batches remained. The sample covered an invalid row, an incomplete row, and duplicates within and across batches.
- Live Google sign-in and worksheet acceptance remain pending. No production workbook rows were imported.

### Full Phase 6 scope and header verification

- Registry status in TFI2 is one approved canonical import (OEE), 13 raw-capture destinations and one business-rule hold (co QA). Reuse the canonical Phase 5 APIs and tables where available. Keep unknown fields and uncertain duplicate rules in review.
- For direct OEE Google Sheets scans, detect the registered A:J header in the first 20 rows before creating a batch. Normalize punctuation, whitespace and casing. A changed column order or ambiguous match returns a review error. Workbook row provenance uses the detected starting row.
- The shared detector can be reused after the remaining module layouts are verified. Manual mapping, multi-row header contracts, remaining canonical routes, and live OAuth acceptance are open. No production workbook records were imported.

### Cross-module Google Sheets header validation

- Verified the registered headers against the first 20 rows of all 15 source worksheets. Each layout had exactly one matching header location. The import API uses these verified header blocks before creating a direct-link batch. NON-PROD uses two rows, and Production Entry and Production Schedule retain their respective gaps before data begins.
- Spreadsheet layout validation is available for modules that allow scanning. CO QA retains its existing hold. Suggested remapping and manual mapping correction remain open.
- DMP Production source profiling found 6,360 rows with input values, 144 with at least one of A:H blank, and 5,458 with a redundant AM/PM suffix on at least one 24-hour clock value. The populated worker and process values matched current DMP Legend values by exact trimmed text. Canonical promotion still requires a verified historical time parser and repeat-import rules.
- Live Google OAuth acceptance is pending. No production imports or schema changes were made for this increment.

### DMP Production Import Center integration

- TFI2 migration 20261121173645 connects the DMP worksheet to its operational table. A:H are required for promotion. Column I is preserved in staged source data and the operational position is resolved from DMP Legend.
- Spreadsheet time fractions and consistent legacy clock strings are converted deterministically. Conflicting AM/PM values are classified as invalid for inspection. Missing values and unresolved DMP Legend references remain in the Inbox.
- The existing normalized DMP fingerprint protects against exact repeats across manual and imported records. The import links saved records to their staged row and writes an audit event. The official source notes still identify unresolved Product Code reference validation, so historical codes are preserved as captured text.
- Synthetic DMP staging, approval and repeat import passed in rolled-back TFI2 transactions. No production rows were imported. Live Google OAuth and browser acceptance remain open.

### Product Entry source review

- TFI2 migration 20261121174024 assigns a review-only source block using the official workbook ID and registered row ranges. Incomplete dates or codes, unrecognized block codes, dates without a year, and source section headers now carry distinct review reasons. Product codes shared by multiple blocks are not used as a unique block identifier.
- The Product Entry route remains raw-capture-only. The database and API prevent operational approval until the import contract is defined. Manual Product Entry workflows remain independent.
- A rolled-back SQL fixture checked shared-code rows in BLK_02 and BLK_04, historical dates without a year, missing codes, section headers, and approval denial. No production workbook rows were imported.

### Production Summary saved-run source reconciliation

- A read-only profile found 893 Production Summary rows with substantive input values and saved trace. Of these, 138 lacked at least one of Date, Line, or Product Code. There were 23 repeated occurrences of the candidate Date/Line/Product Code key even after adding planned and actual start. No exact repeats were found across the examined literal business values for rows with all three core fields. The daily Production Entry form had no substantive input rows at audit time, so overlap could not be validated on real runs.
- TFI2 migration 20261121174612 selects registered Production Summary sheet 1846667474 as the historical import source for the Production Entry module. The daily form is rejected as a second import source. Staging distinguishes missing identity fields and helper rows, and operational approval remains disabled pending a historical write and identity contract. Manual Production Entry remains independent.
- The Google Sheets header contract now uses the Production Summary saved-log headers. 163 automated backend tests and the rolled-back TFI2 staging and approval-gate fixture passed. No production rows were imported.

### Production Schedule source and staging

- Production Schedule is a ten-slot daily form. The source showed zero input slots populated and Schedule Summary had zero saved rows in A3:S11000. The latter is registered as a reporting companion. TFI2 manual saves use a unique production date and a whole-form fingerprint.
- Migration 20261121175244 registers B:C, D:G, K:M, O:P and R as the editable schedule columns and records the calculated columns separately. Staging preserves incomplete rows and excludes derived rows and recognized manpower footers from operational approval.
- Approval remains review-only until the formula-backed production date and manpower totals can be assembled and validated as a complete daily form. Synthetic SQL staging and denial passed in a rolled-back transaction. No production rows were imported.

### Production Schedule operational form import

- Migration 20261121175615 saves a Google Sheets schedule in one transaction using the existing daily-form builder. Google Sheets scanning preserves source formulas and stores their numeric date and manpower values for the schedule. Available manpower uses the TOTAL PAX footer at R18 when supplied.
- All populated slots must be selected and valid. Incomplete forms, incompatible dates, or a different existing form on the same production date remain in review. Exact repeats are skipped, same-batch retries return the saved result and the form retains its source batch reference. Excel imports remain review-only for schedule approval.
- Rolled-back TFI2 tests covered form creation, same-batch retry, cross-batch duplicate, same-date conflict, and incomplete rows. No production schedules were imported. Live Google OAuth and browser acceptance remain open.

### DMR Production operational import

- The official workbook had 1,797 populated source rows, 55 missing at least one core field, two with unlabeled I:J values, and one overnight event among complete rows. Date, Product Code, Line, Stop, and Resume had no repeats in the inspected complete rows and serve as the pilot event key.
- Migration 20261121175858 adds canonical downtime storage, a unique event key, RLS, source-row provenance, audit logging, and a generated downtime duration that handles midnight. F, G and L remain formula outputs. Unlabeled values and conflicting same-key records are held for review. Existing rows are preserved.
- Rolled-back TFI2 tests passed for overnight duration, exact repeats, same-key conflicts, incomplete rows, unlabeled inputs, and invalid times. No production rows were imported. The manual DMR form and downstream Product Entry metrics are separate integration work.


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


### Phase 5 next-module handoff (22 November 2026)

The Hourly Meat / Hourly Coding / Hourly Agri shared backend/UI increment is implemented and verified (225 full backend tests passed; three-module browser mock-API acceptance passed). The next approved Phase 5 module in the unchanged order is OEE. Inspect the existing OEE source contract, operational storage, Phase 6 import integration, and UI before adding or changing CRUD so no duplicate storage or import path is created. Hourly submit/review/approve/return remains a separate follow-up. Authenticated live acceptance for completed modules remains pending; comprehensive final acceptance remains Phase 7.


### Owner-directed Phase 5 progress update — Productivity implemented (22 November 2026)

The Phase 5 implementation count advances from 8/13 to **9/13 module work items implemented**. This is an implementation count only, not a module acceptance or phase-completion claim.

Productivity evidence:
- TFI2 migrations applied: 20261122090838 (schema and calculated view), 20261122091235 and 20261122091546 (RPCs), 20261122091932 (server-side calculation preview), 20261122093144 (foreign-key indexes), 20261122093607 (finite/nonnegative numeric validation), and 20261122093647 (numeric constraints).
- TFI_NEW API and UI are implemented for live catalog, source formula preview, batch save, saved-record filters/pagination, versioned edit, and revision history.
- Product Standard (68 source-backed product codes), Code Map, and DMP Production are read from TFI2. Formula MHR is SUMIFS-equivalent by production date + product code over DMP Total Time.
- Authenticated SQL smoke tests, run in rolled-back transactions, verified create, duplicate skip, versioned edit, revision, audit, and 8.5-hour MHR calculation. No records persisted.
- Focused Productivity tests: 20 passed; full backend regression: 259 passed; mocked browser test passed with zero browser errors.
- Productivity records and revisions remain zero. No historical spreadsheet rows have been imported.
- Authenticated live browser acceptance is still pending; do not count this module as fully accepted.

The next approved Phase 5 module is Coding DPR (order 10). The official seven-phase sequence is unchanged. Phase 5 remains ACTIVE; Phase 6 Direct Google Sheets Import remains an owner priority workstream that can proceed in parallel where destination contracts are ready.


### Owner-directed Phase 5 progress update — Coding DPR implemented (22 November 2026)

The Phase 5 implementation count advances from 9/13 to **10/13 module work items implemented**. This is an implementation count only; it does not mean Coding DPR or Phase 5 has passed authenticated acceptance.

- Current authoritative source: workbook `Copy of TFI - Production Monitoring Sheet 1`, Coding DPR sheetId `1266086431`, source range A1:X1000. Source manifest control totals are 414 parent rows and 857 lot items, with 370 valid and 44 needs_review. These historical source rows were not imported.
- TFI2 schema/RPC/API/UI implemented for parent entries and seven child lot slots. A:W are inputs; X is derived and never accepted from the client.
- Live catalog returns 116 product codes and line numbers 1, 2, 3. Incomplete triplets, missing line identity, and unmatched product codes are visible in the Coding DPR Inbox filter.
- Source formula preserved: total quantity sums only slots 1–6; batch 7 is displayed separately.
- Migrations applied: 20261122095344, 20261122101201, and 20261122102002 (seven-slot RPC shape hardening).
- Focused tests: 19 passed. Full backend regression: 278 passed. Mocked browser workflow passed with zero browser errors. Authenticated SQL smoke test passed in a rolled-back transaction, including duplicate protection, versioned parent/lot updates, precise revision fields and audit events.
- Post-rollback live counts: 0 entries, 0 lot items, 0 revisions, 0 Coding DPR audit events. No historical rows were imported.
- Authenticated live browser acceptance remains pending. See `docs/blueprints/TFI2_CODING_DPR_BACKEND_BLUEPRINT_v0.1_2026-11-22.md`.

The next approved Phase 5 module is **PR Monitoring (order 11)**. Phase 5 remains ACTIVE; Phase 6 direct Google Sheets import remains a parallel owner-priority workstream where destination contracts are ready. The official seven-phase order is unchanged.


### Owner-directed Phase 5 progress update — PR Monitoring implemented (22 November 2026)

The Phase 5 implementation count advances from 10/13 to **11/13 module work items implemented**. This is an implementation count only; it does not mean PR Monitoring or Phase 5 has passed authenticated live acceptance.

- Verified the live source workbook and sheet: `Copy of TFI - Production Monitoring Sheet 1`, PR MONITORING sheetId `867256143`, displayed source fields A:G, summary row 2, header row 3, first data row 4, and three frozen rows.
- Source audit: 78 populated rows, 64 rows with PR Numbers, 12 group totals, row 4 template, and row 79 incomplete candidate with no PR Number. PR Number is preserved as text.
- TFI2 read-only canonical table, RLS SELECT policy, source-row identity constraints, permission-checked read RPC, filters/pagination, catalog API, records API, and permission-checked CSV export API implemented.
- Source summary row values remain labelled as a static source snapshot (16,182,629 required; 15,648,348 produced; 96.70% completion). D/E/F source quantities and G formula result are not recalculated.
- PR Monitoring UI is connected to TFI2, retains exact A:G layout, shows connection state, refreshes saved rows, and disables export until approved records exist and export permission is granted. No manual create/edit/save workflow is exposed.
- Import Center destination remains `raw_capture_only`: A:F input values and G formula result. Group totals/template rows are excluded from operational records; row 79 remains an incomplete Import Inbox candidate. No historical rows were imported.
- Migrations applied: 20261122103759 and 20261122104722.
- Focused PR Monitoring tests: 9 passed. Full backend regression: 287 passed. Mocked desktop/mobile browser workflow passed with zero browser errors. Authenticated SQL smoke test verified read/filter behavior, invalid-status rejection, RLS, and direct-write denial in a rolled-back transaction.
- Current PR Monitoring canonical record count remains zero. Supabase Security Advisor reports no new PR Monitoring security finding; Performance Advisor reports no unindexed PR Monitoring foreign keys after the follow-up index migration.
- Authenticated live browser acceptance remains pending. See `docs/blueprints/TFI2_PR_MONITORING_BACKEND_BLUEPRINT_v0.1_2026-11-22.md`.

The next approved Phase 5 module is **CO QA (order 12)**, subject to its existing business-rule hold. NON-PROD remains order 13. Phase 5 remains ACTIVE and the official seven-phase sequence is unchanged.


### Phase 5 development checkpoint — CO QA source audit and guarded contract (22 November 2026)

- Verified the official source workbook: `Copy of TFI - Production Monitoring Sheet 1`, worksheet `co QA`, sheetId `1359678099`, grid 2745 × 40 (A:AN), grouped headings row 1, field headers row 2, first output row 3.
- Confirmed the Import Center registry keeps `co_qa` as `mixed_transaction` and `hold_pending_business_rule`; no change was made to that hold.
- A3 contains a sorted ARRAYFORMULA spill that assembles A:X from multiple Product Entry blocks. The resulting visible CO QA rows do not carry the originating Product Entry record UUID or block_key.
- Y:AD are manual cost inputs; AE:AH are formula outputs; AI:AL have headers but no formulas in the inspected source rows. This confirms the existing hold is necessary: manual costs could become attached to the wrong source transaction if the sorted Product Entry spill changes.
- Added `src/tfi_backend/co_qa_contract.py` with source identity, A:X mapping, Y:AD manual cost fields, AE:AH formula outputs, AI:AL unresolved outputs, explicit business-rule hold reasons, and a non-promoting classifier.
- Added `tests/backend/test_co_qa_contract.py`. Python compilation passed; focused CO QA contract tests: **7 passed**.
- No CO QA database migration, canonical table, CRUD API, cost-save workflow, or import-promotion path was created. No Google Sheet values were changed and no production rows were imported.
- Blueprint: `docs/blueprints/TFI2_CO_QA_SOURCE_AUDIT_BLUEPRINT_v0.1_2026-11-22.md`.

CO QA is now source-audited, but it is **not yet an implemented operational backend module**. Required owner decisions: stable Product Entry UUID/block linkage; whether the six Y:AD cost inputs are separate/intentional; confirmation of AE:AH formula meaning and units; formulas or explicit retirement of AI:AL; and repeat-batch identity rules. Keep the import destination on hold until those rules are approved.

The Phase 5 implementation count remains **11/13**; the CO QA audit does not advance the completed-module count. Next in approved order is NON-PROD (order 13), while CO QA business rules remain open. Official seven-phase roadmap unchanged.

### Phase 5 development checkpoint — CO QA Product Entry-linked cost backend (22 November 2026)

CO QA owner decision received: Y:AD cost inputs are stored per individual Product Entry record UUID, never by the sorted CO QA worksheet row.

- Applied TFI2 migration `20261122121228_tfi2_co_qa_cost_records`. Added one-to-one `tfi_co_qa_cost_records` and append-only `tfi_co_qa_cost_revisions`.
- Preserved all six source cost fields Y:AD as separate numeric values. Added non-negative and precision validation, optimistic version checks, create/edit permissions, RLS read policies, audit events, and no direct authenticated table writes.
- Added TFI_NEW CO QA catalog, record-list, cost-save, and revision-history APIs. Record lists join saved Product Entry records to the cost child table by UUID.
- Updated CO QA screen: block/date filters, paged loading, six-field cost editor, and version history. No historical CO QA rows or Product Entry rows were imported or created.
- Rolled-back SQL smoke test passed for synthetic Product Entry parent, cost create, partial version-2 update, revision, two audit events, stale-version rejection, negative value rejection, and unknown-field rejection. Post-rollback Product Entry, cost, revision and CO QA audit counts remain zero.
- Focused CO QA contract/API tests: 16 passed. Mocked browser workflow: PASS with zero console errors. Full backend regression suite: **306 passed**. Python compile and JS syntax checks passed.
- TFI_NEW health returned HTTP 200 and connected to TFI2. Supabase advisors show no new CO QA security finding and no unindexed CO QA foreign-key finding.
- Authenticated live browser acceptance remains pending; the browser workflow used a mocked API. The CO QA Import Center destination remains `hold_pending_business_rule`.

CO QA is a **partial implementation**, not a completed Phase 5 module. Remaining work: map the A:X QA projection across all 39 Product Entry blocks, validate AE:AH source formulas/units, resolve AI:AL formulas, and confirm whether Y/Z and AC/AD are intentionally distinct values. Phase 5 remains ACTIVE; the official seven-phase roadmap is unchanged. The implementation count remains **11/13** until the full CO QA contract is complete.

### Phase 5 development checkpoint — CO QA 31-block source projection (22 November 2026)

- Reopened the original CO QA source formula and compared its 31 included Product Entry source ranges with the 39-block Product Entry manifest. The source formula does **not** include all 39 blocks; CO QA is restricted to its exact 31 source blocks.
- Added a per-block mapping for the 18 source QA fields that feed CO QA columns G:X. Each mapping retains the original Product Entry `block_key` and source column range. Formula-only source fields are explicitly marked pending; they are not replaced with blanks or fabricated values.
- CO QA catalog now exposes only the 31 applicable Product Entry blocks. Record-list queries are restricted to those 31 blocks even when no block filter is selected. A Product Entry block outside the original source formula is rejected by the CO QA API.
- CO QA record responses now include a mapped A:X QA projection with captured, missing, and formula-pending counts. Added a View QA details modal showing each CO QA output column and its original Product Entry source column.
- Added tests validating all 31 block keys against the Product Entry manifest, 18-column range length, formula-only columns, projection values, formula-pending flags, non-projected block rejection, and default API filtering to the 31 source blocks.
- Focused CO QA API/contract tests: **17 passed**. Full backend regression: **311 passed**. Python compilation and JavaScript syntax checks passed.
- Mocked browser workflow: **PASS**. Verified the 31-block selector (31 options plus All), Product Entry record display, 16/18 captured + 2 formula-pending QA projection, View QA modal, Y:AD cost update, revision history, and zero browser console errors.
- TFI_NEW health: HTTP 200, connected to TFI2. Live Product Entry, CO QA cost, revision, and CO QA audit counts remain zero; no production or historical rows were created or imported.

CO QA remains a **partial Phase 5 implementation**, not complete. The Import Center destination remains `hold_pending_business_rule`. Remaining work: verify the 31-block projection against actual saved Product Entry records; reproduce and validate AE:AH formulas with approved source units; obtain owner decision on Y/Z and AC/AD distinctions and AI:AL; then complete live authenticated acceptance. The seven-phase roadmap and implementation count (**11/13**) are unchanged. NON-PROD remains the next approved Phase 5 module (order 13).

### Phase 5 development checkpoint — CO QA AE:AH source calculations (22 November 2026)

- Reopened the native Google Sheet `Copy of TFI - Production Monitoring Sheet 1`, tab `co QA`, and read the original formulas in AE3:AH8.
- Confirmed the exact formulas:
  - AE: `=SUM(G3:X3)-SUM(N3:Q3)`
  - AF: `=AE3*AA3`
  - AG: `=AE3-SUM(O3:S3)`
  - AH: `=AG3*AB3`
- Implemented these formulas as read-only TFI2-derived outputs. Google Sheets blank-cost semantics are preserved: blank AA/AB multiply as zero, not a fabricated missing cost. If a required QA source value is formula-derived and still pending in Product Entry, dependent AE:AH outputs remain pending rather than displaying a misleading result.
- API record responses now include `qa_calculations` with output value, status, label and pending reason for AE, AF, AG and AH.
- CO QA table now displays all four calculated columns. The formula outputs are not editable and are separate from the six versioned Y:AD manual cost inputs.
- Cross-checked the source worksheet's A3:X8 sample rows against AE3 and AG3: all six source rows matched exactly:
  - AE: 353, 586, 602, 888, 453, 89
  - AG: 309, 546, 554, 822, 419, 81
- Focused CO QA tests: 20 passed (included exact formula arithmetic, blank-cost zero behavior and formula-pending guards). Full backend regression: **314 passed**. Python compilation and JS syntax checks passed.
- Mocked browser workflow: **PASS**; verified displayed outputs AE=586.00, AF=879.00, AG=546.00 and AH=0.00 for the fixture; Y:AD save/history still pass; zero browser console errors.
- The browser workflow is a mock acceptance only. The TFI_NEW app process must be restarted to load the new API code; authenticated live browser acceptance is still pending.

CO QA remains partial and is **not counted complete**. Formula-derived Product Entry source columns (within the 31 mapped blocks) still need their source calculations reproduced and live-verified. AI:AL remain unresolved because the source sheet has headers but no formulas. Owner confirmation is still needed on whether Y/Z and AC/AD are intentionally distinct. Historical CO QA import/promotion remains blocked until source-row provenance and repeat-batch identity rules are approved. Phase 5 count remains **11/13**; NON-PROD is still the next module (13). The seven-phase roadmap is unchanged.

### Phase 5 checkpoint — CO QA source formula classification (22 November 2026)

- Audited the exact source formulas in the original Product Entry tab for all 31 CO QA blocks.
- Implemented 31 dynamic source-field rules (input × 2, blank-date guard) and separated nine mixed formula/manual fields from true calculated fields.
- Updated local Product Entry manifest to `2026-11-22-v2`; nine mixed fields are editable in the TFI2 UI/API and no longer formula-only. Applied matching Supabase catalog migration `tfi2_product_entry_mixed_co_qa_fields`.
- Verified all nine DB catalog updates; original Google Sheet remains unchanged.
- CO QA formula/projection tests cover 31 dynamic formulas, nine manual inputs, and blank-date handling.
- Full backend regression: **317 passed**. CO QA mocked browser: PASS, zero console errors.
- TFI_NEW restart and authenticated live browser acceptance are still required. Historical CO QA import/promotion remains blocked; AI:AL are unresolved. Phase 5 count remains 11/13; NON-PROD remains next. Seven-phase roadmap unchanged.

- Controlled TFI_NEW restart completed using the project virtual environment. Live `/api/health` returned HTTP 200 with `connected=true` and `database_project=TFI2`. Authenticated browser acceptance is the next gate; no operational records were changed.

- Refreshed CO QA browser fixture to validate the corrected 18/18 complete projection, dynamic CG calculation and manual CR input; Puppeteer workflow PASS, cost save/revision history PASS, zero console errors. Authenticated live TFI2 acceptance still pending.
