# TFI2 — Master Data Backend Blueprint v0.1

**Date:** 21 November 2026  
**Project:** TFI_NEW / TFI2  
**Supabase project:** slfjqrkxnsgdaturaguw  
**Official reference workbook:** Copy of TFI - Production Monitoring Sheet 1  
**Spreadsheet ID:** 1rCbQ16wj7MRjQCFF3tA-WEMkudraJK0RkwcqayUlz7k  
**Current status (21 November 2026):** Phase 4 Master Data schema and source snapshot are live in TFI2; nine categories and 1,135 source rows are stored; API and UI integration are implemented. Final cross-role and end-to-end acceptance is reserved for Phase 7.

## 1. Scope and governing decisions

Phase 4 covers the nine Master Data categories already specified in TFI_MASTER_DATA_UI_SPEC_v0.2_2026-11-20.md.

The Master Data source worksheets are registered in TFI2 as reference / reference_only. They are reference sources, not operational transaction sheets and not a runtime Google Sheets dependency.

The live TFI2 tables hold a controlled snapshot of the verified reference rows. The original source snapshot remains immutable. Approved edits are stored in TFI2 as a separate current value, with append-only revision and audit history.

The original draft review gate was completed. The reviewed schema was applied through the two recorded Phase 4 migrations listed in Section 8. The historical SQL draft may remain in supabase/drafts/ as design evidence; it is not the active deployment source.

## 2. Verified source categories

| Category key | Exact source worksheet | sheetId | Source range | Source count / handling |
|---|---|---:|---|---|
| product_standard | Product Standard and Specificat | 2138697021 | A1:U110 | 58 variants, 26 family headers, 25 reserved slots |
| code_map | Code Map | 2098561343 | A1:B72 | 68 mappings |
| yield_map | Yield Map | 854969610 | A1:W43 | 39 mapped product families |
| entry_map | Entry Map | 1628314566 | A1:E43 | 39 populated mappings |
| kpi_setup | KPI Setup | 1955006742 | A1:T129 | 127 product codes plus protected All; separate reference groups |
| dpr_legend | DPR LEGEND | 508797580 | A1:AN119 | 116 unique codes across 119 family-list entries |
| dmp_legend | DMP LEGEND | 1070169465 | A1:D70 | 69 source rows; 10 source cell notes |
| manpower | MANPOWER | 583741906 | A1:E448 | 445 source rows; 430 distinct names |
| schedule_lists | Schedule Lists | 156467196 | A1:L101 | 100 production-code rows |

All sheet IDs and ranges above are taken from the approved Master Data UI specification and the official 35-tab source registry. No source workbook cells were edited.

## 3. Field-level edit contract

### 3.1 Product Standard and Specificat
- Editable columns: B, C, D, E, H, I, J, K, L, M, N, O, P, Q, R, T, U.
- Immutable source key: A.
- Formula/read-only: F, G, S.
- Source notes identify E as edited by Production and F/G as edited by Plant IE.
- Only populated product-variant rows may be edited. Family headers and reserved new-variant slots remain non-editable.
- New family creation is not part of this first CRUD increment. It requires a verified Entry Map and complete Product Entry block.

### 3.2 Code Map
- A is the immutable product-code key.
- B is the editable product-name mapping.
- Preserve all 68 mappings, including 36 unmatched Code Map codes and 26 Product Standard variants without a Code Map mapping.
- No automatic mapping, deletion, or normalization.

### 3.3 Yield Map
- B:M are editable source input fields.
- A and N are reference/information fields.
- P:W are formula-generated helper outputs and read-only.
- Placeholder 95% targets are not approved business thresholds and must not be silently promoted to approved targets.

### 3.4 Entry Map
- A:E are read-only.
- A new family requires a verified BLK_xx named range and complete Product Entry block.

### 3.5 KPI Setup
- Read-only in the approved UI.
- Preserve grouped and paired reference lists rather than flattening them into one fictitious table.
- View Daily and Product Code All remain protected.
- No delete or clear action.

### 3.6 DPR LEGEND
- Read-only in the approved UI.
- B:F are independent reference lists.
- G:H are formula/helper outputs.
- I:AN are product-family code lists.
- Preserve the documented helper formula omission of TMRMB-24-380; do not change source formulas.

### 3.7 DMP LEGEND
- A:D are controlled fields.
- Preserve ten source notes on worker-name cells at source rows 5, 9, 14, 17, 20, 23, 31, 33, 36 and 39.
- Note-bearing rows are locked against edits in the approved UI.
- RESIGNED/AWOL are source note labels only, not verified live HR status.
- Blank worker names remain blank.

### 3.8 MANPOWER
- A:E are controlled fields.
- Preserve all 445 source rows and 430 distinct employee names.
- Repeated names remain separate rows in original source order. Do not deduplicate or merge automatically.

### 3.9 Schedule Lists
- Read-only and auto-refreshed from Product Standard in the source workbook.
- The source explicitly protects A, B, K and L. The approved UI currently keeps the entire category read-only.
- TFI2 must derive its application values from the TFI2 Product Standard records after migration; the Google workbook is not a runtime dependency.

## 4. Proposed database model

### 4.1 public.tfi_master_data_categories
One registry row per category. It references the existing verified tfi_source_sheets metadata and stores:
- stable category key and display name;
- exact source worksheet reference and source range;
- source row count, reference count and source column count;
- header rows and first data row;
- edit policy (controlled_fields, read_only, auto_refreshed);
- editable/read-only column lists;
- row-specific source-row locks;
- field-rule metadata and display order.

The nine category registry rows are seeded from the existing authoritative 35-tab workbook registry. The seed uses ON CONFLICT DO NOTHING; it does not rewrite existing source metadata.

### 4.2 public.tfi_master_data_rows
One stored row per original source row, keyed by (category_key, source_row_number). It stores:
- exact source row number and row kind (title, instruction, header, group_header, data, reserved_slot, helper, blank);
- immutable source_values array;
- editable TFI2 current_values array, initially identical to the source snapshot;
- source_notes array for cell-note provenance;
- SHA-256 source fingerprint;
- record status, row editability and optimistic-lock version;
- created/updated actor and timestamps;
- archive metadata for a future permission-controlled archive workflow.

The source fingerprint is indexed but intentionally not unique. Identical/repeated rows may be legitimate (notably MANPOWER); source-row identity and the business-specific duplicate rules are separate concerns.

### 4.3 public.tfi_master_data_row_revisions
Append-only before/after snapshots for every successful edit:
- row ID and resulting version;
- before and after values;
- changed source columns;
- optional change reason;
- actor and timestamp.

No hard-delete workflow is included.

## 5. Write and security model

- RLS is enabled on all three tables.
- Read access requires private.tfi_has_permission('master_data','view').
- Direct client insert/update/delete privileges are revoked.
- Edits use a single SECURITY DEFINER RPC: public.tfi_update_master_data_row.
- The RPC independently checks auth.uid(), master_data.edit, category policy, row status, row-specific locks, and allowed column letters.
- The RPC requires an expected version to prevent silent overwrites from stale screens.
- The RPC updates only current_values; it never changes source_values, source row identity, or source fingerprint.
- Each successful edit appends a revision and a tfi_audit_events entry in the same transaction.
- No service-role key is introduced into the Windows application.
- No direct database delete is granted.

## 6. Proposed local API contract

These endpoints are planned for the next implementation increment after the schema is approved and applied:

| Method | Endpoint | Required permission | Purpose |
|---|---|---|---|
| GET | /api/master-data/categories | master_data.view | Return the nine category definitions and counts |
| GET | /api/master-data/<category_key>/rows | master_data.view | Search, filter and paginate stored source rows |
| GET | /api/master-data/rows/<row_id>/revisions | master_data.view | Return revision history |
| PATCH | /api/master-data/rows/<row_id> | master_data.edit | Update allowed fields using expected version and change reason |

The existing UI has no active Add Record or Delete action. Those endpoints will not be invented in this increment. The existing Import Spreadsheet modal remains disabled; initial source capture is a separately controlled operation and must not be confused with the Phase 6 Import Center workflow.

## 7. Source capture and duplicate protection

The first reference snapshot must be loaded from the approved workbook using its exact sheet IDs, ranges and row numbers.

- Preserve source row positions and all source values, including blank cells in retained rows.
- Preserve DMP LEGEND cell notes separately from worker-name values.
- Preserve repeated MANPOWER rows and source order.
- Do not treat source fingerprint alone as a business duplicate key.
- Do not auto-update an existing TFI2 row when the same source row later changes. A changed fingerprint must be reported for review.
- Do not import historical production transactions as part of Master Data.
- Do not write to the Google Spreadsheet.

## 8. Implementation and live deployment completed

Applied live TFI2 migrations:
- 20261121010907 — tfi2_master_data_backend.
- 20261121013255 — tfi2_master_data_fk_indexes.

Implemented:
- public.tfi_master_data_categories — nine category definitions.
- public.tfi_master_data_rows — immutable source snapshots and controlled current values.
- public.tfi_master_data_row_revisions — append-only edit history.
- RLS and permission-gated read access.
- Version-checked update RPC with field-level/category-level rules, row locks, and audit event generation.
- Flask API routes for categories, rows, revisions, and edits.
- Master Data UI integration with the local API.
- DMP LEGEND live lookup used by DMP Production.

Live TFI2 snapshot on 21 November 2026:
- 9 Master Data categories.
- 1,135 stored source rows.
- 1,063 active data rows.
- 0 Master Data revisions (no live reference edits have been made).

Focused Master Data contract tests: **16 passed**. The full backend suite was recorded at 97 passing tests.

## 9. Current boundaries

- The nine-category source snapshot is present in TFI2.
- No source workbook cells were changed.
- No historical operational transaction rows were imported as part of Phase 4.
- No Master Data edit has been made in the live application; therefore the revision table remains empty.
- No hard-delete workflow is exposed.
- Final cross-role and end-to-end acceptance remains reserved for Phase 7.

## 10. Completion and acceptance status

Phase 4 implementation is complete: schema, source snapshot, RLS, permission checks, update/revision workflow, API, and UI integration are in place.

The final acceptance matrix for roles, denied actions, source immutability, revision traceability, and end-to-end interaction will be executed during Phase 7, not treated as a reason to reorder the development phases.

The next implementation phase is Phase 5 — Operational Modules Backend.
