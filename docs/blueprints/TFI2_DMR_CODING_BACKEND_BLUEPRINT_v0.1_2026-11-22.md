# TFI2 — DMR Coding Manual Backend Blueprint

**Date:** 22 November 2026  
**Project:** TFI_NEW / TFI2  
**Phase:** Phase 5 — Operational Modules Backend  
**Status:** Backend, database workflow, API, and UI integration implemented; authenticated live acceptance pending.

## 1. Approved source contract

- Workbook ID: `1rCbQ16wj7MRjQCFF3tA-WEMkudraJK0RkwcqayUlz7k`
- Worksheet: `DMR Coding`
- sheetId: `675328096`
- Source range: `DMR Coding!A1:K12317`
- Group headers: Details spans A:E; Downtime spans F:K.
- Header row: 3
- Historical data rows: 4:4774 (4,771 populated rows)
- Blank manual-entry template starts at source row 4775; initial form has 12 rows.

| Column | Source field | Manual-entry handling |
|---|---|---|
| A | Date | Optional date; no approved mandatory-field rule yet |
| B | Product Code | Optional text; 116 current suggestions from DPR LEGEND H3:H119 plus L3. Unmatched historical codes are preserved as entered, not replaced. |
| C | Line | Optional text; AGRILINE and MEATLINE are suggestions only because source column C has no validation rule. |
| D | Stop | Optional local time |
| E | Resume | Optional local time |
| F | Time in Mins | Derived; read-only |
| G | Time in Hours | Derived; read-only |
| H | Category | Optional; if supplied, validated against current DPR LEGEND B3:B10 |
| I | Factor | Optional; if supplied, validated against current DPR LEGEND D3:D15 |
| J | Reason | Optional text |
| K | Product Name | Derived from current TFI2 Code Map A5:B400; fallback is Other |

Source formula parity:
- F = G × 60.
- G = MOD(Resume − Stop, 1) × 24.
- Overnight events wrap across midnight; equal Stop and Resume times produce zero duration.
- Product Name uses the current Code Map lookup; fallback is Other.

Source findings retained:
- Product Code source validation is broken (#REF!) in sampled rows.
- The H3 helper list excludes DPR LEGEND column L; TMRMB-24-380 from L3 is included as a supplemental current option.
- TMWKC-6-2950 appears in historical source data but is not in the current Product Code master list. It remains available as free text and is flagged unmatched; the system never substitutes a different code.
- Source column C has no validation rule; the two observed line values are suggestions only.
- No mandatory-field/completeness rules were approved in the source audit. Nonblank partial manual records are saved as `unassessed`; completely blank form rows are ignored.

## 2. TFI2 reference data

The catalog endpoint reads current TFI2 Master Data:
- Product Codes from DPR LEGEND H and supplemental L.
- Categories from DPR LEGEND B.
- Factors from DPR LEGEND D.
- Product Names from Code Map A:B.
- Lines remain source-observed suggestions only.

The catalog currently returns 116 Product Code options, 8 categories, 13 factors, and 68 Product Name mappings.

## 3. Database implementation

Applied TFI2 migrations:
- `20261122061143` — `tfi2_dmr_coding_schema`
- `20261122061236` — `tfi2_dmr_coding_rpcs`

Local migration files:
- `supabase/migrations/20261122061143_tfi2_dmr_coding_schema.sql`
- `supabase/migrations/20261122061236_tfi2_dmr_coding_rpcs.sql`

Canonical tables:
- `public.tfi_dmr_coding_records`
- `public.tfi_dmr_coding_revisions`

Database behavior:
- Optional source inputs are stored as nullable values; partial rows remain `unassessed`.
- Formula outputs are generated/read-only.
- Product Code reference status is computed as `matched`, `unmatched`, or `not_entered`.
- A generated exact-input fingerprint covers Date, Product Code, Line, Stop, Resume, Category, Factor, and Reason. Only exact full-input repeats are blocked; no unverified event/business key was invented.
- Manual rows have null `source_import_row_id`; the nullable provenance link is retained for a future approved import contract.
- Version-checked updates append a before/after revision and an audit event in the same transaction.
- RLS protects reads. Private permission-checked SECURITY DEFINER functions perform writes; public RPC wrappers are SECURITY INVOKER.
- No hard-delete endpoint was introduced.

## 4. API and UI integration

TFI_NEW API:
- GET `/api/dmr-coding/catalog`
- GET `/api/dmr-coding/records`
- POST `/api/dmr-coding/records`
- PATCH `/api/dmr-coding/records/<record_id>`
- GET `/api/dmr-coding/records/<record_id>/revisions`

The DMR Coding UI now includes:
- Source-aligned 12-row blank template beginning at source row 4775.
- Product Code text input with 116 current suggestions; unmatched codes are preserved and flagged.
- Current TFI2 Category and Factor options.
- Read-only duration and Product Name fields.
- Save partial entries as unassessed.
- Saved-record register and date/product/line/category/factor filters.
- Version-checked Edit dialog and revision-history dialog.

## 5. Verification evidence

- DMR Coding contract/API tests: 15 passed.
- DMR Coding browser test with mocked API: PASS; 12-row form, source row mapping, Product Code suggestions, category/factor lists, overnight calculation, save, edit, and revision history verified; browser runtime errors: 0.
- Full TFI_NEW backend regression suite: 200 passed.
- Python compile checks: passed.
- DMR Production and DMR Coding frontend/browser JavaScript syntax checks: passed.
- Authenticated TFI2 reference-data call returned 116 Product Codes, 8 categories, 13 factors, and 68 Product Name mappings.
- Rolled-back TFI2 SQL smoke test: inserted two synthetic rows (including an unmatched historical code), skipped one exact duplicate, updated one record to version 2, created one revision and audit events; transaction rolled back.
- Post-rollback DMR Coding records/revisions/audit counts remain zero.
- Security Advisor shows no new DMR Coding finding. Existing findings remain the two Production Entry SECURITY DEFINER RPCs and disabled leaked-password protection.
- No production or historical workbook rows were imported or persisted.

## 6. Remaining acceptance and import gates

Authenticated live browser acceptance remains pending. When the owner requests testing, use one explicitly approved controlled manual entry and verify save/edit/history through the signed-in TFI_NEW application.

The DMR Coding import destination remains raw-capture-only. Do not promote historical rows until the Phase 6 module-specific import contract, historical-code review behavior, and canonical promotion rules are separately approved and implemented.
