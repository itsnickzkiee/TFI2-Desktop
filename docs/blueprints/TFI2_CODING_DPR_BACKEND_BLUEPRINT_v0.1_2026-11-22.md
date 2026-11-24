# TFI2 Phase 5 — Coding DPR Backend Blueprint

**Date:** 22 November 2026  
**Module order:** 10 of 13  
**Status:** Backend/API/UI implemented; authenticated live browser acceptance pending  
**Database:** TFI2 Supabase project only

## 1. Approved source contract

- Workbook: Copy of TFI - Production Monitoring Sheet 1
- Spreadsheet ID: `1rCbQ16wj7MRjQCFF3tA-WEMkudraJK0RkwcqayUlz7k`
- Worksheet: Coding DPR
- sheetId: `1266086431`
- Source grid: A1:X1000; header row 2; first data row 3
- Source audit baseline: 414 source rows, 857 lot items; 370 valid rows and 44 needs_review rows.
- Source counts are audit control totals, not rows imported in this Phase 5 implementation.

| Columns | Field | Contract |
|---|---|---|
| A | Coding / Labelling Date | Nullable date input |
| B | Line Number | Nullable selection from current DMP LEGEND values 1, 2, 3 |
| C:E | Batch 1 | Production Date, Product Code, Quantity |
| F:H | Batch 2 | Production Date, Product Code, Quantity |
| I:K | Batch 3 | Production Date, Product Code, Quantity |
| L:N | Batch 4 | Production Date, Product Code, Quantity |
| O:Q | Batch 5 | Production Date, Product Code, Quantity |
| R:T | Batch 6 | Production Date, Product Code, Quantity |
| U:W | Batch 7 | Production Date, Product Code, Quantity |
| X | Total Quantity | Derived; never accepted from the client |

## 2. Formula and lookup rules

- Preserve all seven lot indexes separately. A source row is one parent Coding DPR entry with up to seven child lot items.
- The existing source Total Quantity formula sums only the quantity cells for lot slots 1–6 (E, H, K, N, Q, T). Batch 7 quantity (W) is preserved and shown separately; it is excluded from X until the owner approves a source-rule change.
- Product Code suggestions are read live from the 116 current DPR LEGEND options in TFI2. The source sheet's Product Code validation is broken (#REF!). Unmatched entered values are preserved and flagged; the backend does not invent or substitute codes.
- Line Number choices are read live from DMP LEGEND column D.
- Blank input rows are ignored. Partial lot triplets are saved without inventing mandatory-field rules and appear in the Coding DPR Inbox filter. Missing line identity and unmatched product codes are also flagged for review.
- New manual records remain unassessed unless the explicit source-contract review flags are present. No unapproved completeness or approval workflow is inferred.

## 3. Database model and safeguards

- `public.tfi_coding_dpr_entries`: one parent entry per source row, with exact-content fingerprint, source link placeholder, version, status and actor fields.
- `public.tfi_coding_dpr_items`: one child row per populated lot slot, unique by parent + lot number 1–7.
- `public.tfi_coding_dpr_revisions`: append-only before/after snapshots, changed fields, version, reason and actor.
- RLS restricts reads to `coding_dpr.view`. Direct client insert/update/delete is revoked; writes use permission-checked SECURITY DEFINER functions behind SECURITY INVOKER public wrappers.
- Exact duplicate protection uses the full normalized parent + all seven slot positions. A broader business key such as date + line is not invented.
- Updates require expected version, replace the seven-slot child payload transactionally, append a revision, and write an audit event in the same transaction.
- No hard delete or automatic archive/restore action is added.
- The calculated total is generated server-side from lot slots 1–6. The API rejects X or other unsupported columns.

## 4. API

- `GET /api/coding-dpr/catalog`
- `GET /api/coding-dpr/records` — pagination, date, line, product-code and review filters
- `GET /api/coding-dpr/records/<record_id>`
- `POST /api/coding-dpr/records`
- `PATCH /api/coding-dpr/records/<record_id>` — optimistic version check
- `GET /api/coding-dpr/records/<record_id>/revisions`

## 5. UI

- Live TFI2 catalog (116 product-code suggestions; line options 1, 2, 3)
- 12 blank entry rows initially; add-row action capped at 50 rows per save batch
- Seven repeating lot groups; source total X excludes batch 7 quantity
- Save submits only A:W input columns; X is not sent
- Lazy-loaded saved-record register with date/line/product-code filters and pagination
- Coding DPR Inbox tab shows records flagged for missing line identity, partial lot triplets, or unmatched product code
- Version-controlled edit and revision history
- Save and edit controls follow module permissions

## 6. Applied migrations

- `20261122095344_tfi2_coding_dpr_backend` — parent/child/revision tables, indexes, RLS, catalog/list/get/create/update functions
- `20261122101201_tfi2_coding_dpr_revision_fields_fix` — precise changed-field audit for parent-only versus lot-slot edits
- `20261122102002_tfi2_coding_dpr_shape_guard` — rejects missing/non-array lot payloads and requires all seven correctly numbered lot slots at the database boundary

## 7. Verification evidence

- Focused Coding DPR contract/API tests: 19 passed.
- Full backend regression suite: 278 passed.
- Python compilation and Coding DPR JavaScript syntax checks passed.
- Mocked browser workflow passed: live catalog rendering, 12 initial rows, 116 product-code options, three line options, batch-7 exclusion from X, A:W-only save payload, saved register, Coding DPR Inbox filter, versioned edit, revision history, mobile layout, and zero browser errors.
- Authenticated TFI2 SQL smoke test ran inside a rolled-back transaction: catalog count, insert, exact duplicate skip, incomplete-row Inbox visibility, source total (1,000) vs Batch 7 (700), versioned line-only and lot edits, precise revision fields, and audit-event counts passed.
- Post-rollback live table counts: 0 entries, 0 lot items, 0 revisions, 0 Coding DPR audit events. No historical Coding DPR rows were imported or persisted.
- Supabase Security Advisor: no new Coding DPR SECURITY DEFINER finding. Existing warnings remain limited to Production Entry RPCs and project-wide leaked-password protection.
- Supabase Performance Advisor: no unindexed foreign-key finding for the new Coding DPR tables. Unused-index notices are informational before production usage.

## 8. Acceptance still required

Sign in through the local TFI_NEW app, open Coding DPR, verify the live green TFI2 connection, create one owner-approved controlled record, inspect its seven lots and source total, edit one field, and inspect revision history. Do not import the 414 historical source rows as part of this manual CRUD acceptance. Historical migration remains in Phase 6 and requires the approved source-ledger and module Import Inbox workflow.

**Next approved Phase 5 module:** PR Monitoring (order 11). Official seven-phase roadmap unchanged.
