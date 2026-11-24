# TFI2 — DMR Production Manual Backend Blueprint

**Date:** 22 November 2026  
**Project:** TFI_NEW / TFI2  
**Phase:** Phase 5 — Operational Modules Backend  
**Status:** Backend, database workflow, API, and UI integration implemented; authenticated live acceptance pending.

## 1. Approved source contract

- Workbook ID: `1rCbQ16wj7MRjQCFF3tA-WEMkudraJK0RkwcqayUlz7k`
- Worksheet: `DMR Production`
- sheetId: `2048043346`
- Source range: `DMR Production!A1:L12004`
- Header row: 3
- First data row: 4
- Observed populated source records during source audit: 1,783

| Column | Source field | Manual-entry handling |
|---|---|---|
| A | Date | Required date |
| B | Product Code | Required text; source validation is broken (#REF!), so 58 observed values are suggestions, not a canonical master list. New codes may be entered as text. |
| C | Line | Required text with source-observed suggestions |
| D | Stop | Required local time |
| E | Resume | Required local time |
| F | Total in Min. | Derived; read-only |
| G | Total in Hrs. | Derived; read-only |
| H | Category | Required; validated against current DPR LEGEND values |
| I | Original blank row-3 header | Optional source dropdown; value retained as source_column_i |
| J | Original blank row-3 header | Optional source dropdown; value retained as source_column_j |
| K | Remarks | Optional text |
| L | Product Name | Derived from the current TFI2 Code Map; fallback is Other |

Source formula parity:
- F = G × 60.
- G = MOD(Resume − Stop, 1) × 24.
- Overnight events wrap across midnight; equal Stop and Resume times produce zero duration.
- Product Name looks up Product Code in Code Map A5:B400; fallback is Other.

The two blank-header inputs I and J are preserved by their original source column identities. No unsupported business labels were invented for them.

## 2. TFI2 reference data

The DMR catalog endpoint combines the source-observed Product Code suggestions and Line suggestions with current TFI2 reference data:
- Product Name mappings from Master Data category `code_map`.
- Category codes/descriptions from Master Data category `dpr_legend`.
- Additional I/J options from DPR LEGEND source column C.

The Product Code suggestion list is explicitly not treated as a canonical catalog because the original workbook validation points to #REF!.

## 3. Database implementation

Applied TFI2 migration:
- Version: `20261122055131`
- Name: `tfi2_dmr_production_manual_crud`
- Local migration source: `supabase/migrations/20261122055131_tfi2_dmr_production_manual_crud.sql`

The existing canonical `public.tfi_dmr_production_records` table is reused; no duplicate DMR transaction table was created.

Schema additions:
- `source_column_i`, `source_column_j` to retain the original blank-header inputs.
- Nullable `source_import_row_id` so manual records do not receive fabricated import provenance. Imported rows continue to carry their actual staged-row reference.
- `version`, `record_status`, `updated_at`, and `updated_by`.
- `public.tfi_dmr_production_revisions` append-only revision history with before/after snapshots, changed fields, reason, actor, and timestamp.
- Date/line indexes for saved-register filters.

The existing DMR event identity is retained: normalized Date + Product Code + Line + Stop + Resume. Exact repeats are skipped without overwrite; same-key records with different details are returned as conflicts for review.

Database functions:
- Private SECURITY DEFINER functions perform permission checks and trusted writes.
- Public RPC wrappers are SECURITY INVOKER and restricted to authenticated execution.
- Create/update write audit events in the same transaction.
- Updates require an expected version and create an append-only revision.
- No hard-delete endpoint was introduced.

## 4. API and UI integration

TFI_NEW API:
- GET `/api/dmr-production/catalog`
- GET `/api/dmr-production/records`
- POST `/api/dmr-production/records`
- PATCH `/api/dmr-production/records/<record_id>`
- GET `/api/dmr-production/records/<record_id>/revisions`

The DMR Production UI now includes:
- Source-aligned 12-row entry form.
- Read-only duration and Product Name fields.
- Save to TFI2 with exact duplicate and conflict feedback.
- Saved-record register and date/product/line/category filters.
- Version-checked Edit dialog.
- Revision-history dialog.
- Permission-aware create/edit controls.

## 5. Verification evidence

- DMR contract/API tests: 18 passed.
- DMR browser test with mocked API: PASS; 12-row form, source fields I/J, overnight duration, save, edit, and revision history verified; browser runtime errors: 0.
- Full TFI_NEW backend regression suite: 185 passed.
- Python compile checks: passed.
- DMR UI and browser-test JavaScript syntax checks: passed.
- TFI2 reference data endpoint under an authenticated context returned 68 Product Name mappings, 8 categories, and 21 additional options.
- Rolled-back TFI2 SQL smoke test: inserted one synthetic event, skipped its exact repeat, updated to version 2, created one revision and two audit events; transaction rolled back.
- Post-rollback live TFI2 counts: DMR records 0, DMR revisions 0, DMR audit events 0.
- No production or historical workbook rows were imported or persisted.

## 6. Remaining acceptance gate

Authenticated live browser acceptance remains pending. When the owner requests testing, use one explicitly approved controlled manual entry, verify saved list/edit/history through the signed-in TFI_NEW application, and clean up only through a separately approved archive process. Do not use the official historical workbook as a live CRUD smoke test.

## 7. Phase 5 position

DMR Production manual CRUD development is implemented. Its authenticated live acceptance is still open. The next approved Phase 5 module in sequence is DMR Coding. The official seven-phase roadmap is unchanged.
