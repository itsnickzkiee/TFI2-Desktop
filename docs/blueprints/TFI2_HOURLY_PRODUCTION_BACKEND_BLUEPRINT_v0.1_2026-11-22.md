# TFI2 — Hourly Production Shared Backend Blueprint

**Date:** 22 November 2026  
**Project:** TFI_NEW / TFI2  
**Phase:** Phase 5 — Operational Modules Backend  
**Status:** Shared backend, database, APIs, and three-module UI integration implemented; authenticated live acceptance pending.

## 1. Scope and source mapping

The implementation covers three distinct operational modules sharing the same source field layout and calculation rules. Each module has its own permission key and records remain separated by `module_key`.

| Module | Source worksheet | sheetId | Source range |
|---|---|---:|---|
| Hourly Meat | Hourly Meat | 428082343 | A1:L5004 |
| Hourly Coding | Hourly Coding | 1916766220 | A5:L5004 |
| Hourly Agri | Hourly Agri | 534145404 | A5:L5004 |

Workbook ID: `1rCbQ16wj7MRjQCFF3tA-WEMkudraJK0RkwcqayUlz7k`

Input fields:
1. Date
2. Hour (0–23)
3. Product Code
4. Target (tins)
5. Actual (tins)
6. Remarks

Calculated fields:
1. Product Name
2. Time Slot
3. Variance
4. Cumulative Target
5. Cumulative Actual
6. Hour Attainment

## 2. Source-aligned validation and calculations

- Date must be later than 01 January 2000.
- Hour must be a whole number from 0 through 23.
- Target and Actual cannot be negative.
- Product Code suggestions and Product Name lookup use current TFI2 Code Map A5:B400 (68 current options at verification).
- Unmatched product codes are preserved as entered and flagged; the system does not silently substitute another code.
- Remarks are optional.
- No mandatory-field rule was approved by the source audit. Nonblank partial rows can be saved; completely blank rows are ignored.

Calculation rules:
- Product Name: current Code Map lookup, with `Other` fallback for an unmatched entered code.
- Time Slot: selected hour to the next hour, wrapping at midnight.
- Variance: Actual output − Target for the hour.
- Cumulative Target: sum of target tins for the same module, date, and product code through the current hour.
- Cumulative Actual: sum of actual tins for the same module, date, and product code through the current hour; blank when the current row's Actual is blank.
- Hour Attainment: Actual ÷ Target for the hour; blank when Actual or Target is blank, or Target is zero.

## 3. TFI2 database implementation

Applied migrations:
- `20261122063710` — `tfi2_hourly_production_shared_backend`
- `20261122064148` — `tfi2_hourly_production_active_view_fix`
- `20261122064749` — `tfi2_hourly_production_record_date_alias`

Local migration files use the same version identifiers under `supabase/migrations/`.

Canonical tables:
- `public.tfi_hourly_production_records`
- `public.tfi_hourly_production_revisions`

Read view:
- `public.tfi_hourly_production_record_view`

Database controls:
- One shared records table with strict module separation through `module_key`.
- Separate `hourly_meat`, `hourly_coding`, and `hourly_agri` permission checks.
- RLS protects reads; private write functions enforce module-specific permissions.
- Public RPC wrappers are SECURITY INVOKER.
- Source inputs are stored; derived values are calculated by the read view.
- A complete date/hour/product-code slot is unique within its module. Exact duplicate partial inputs are also protected by an input fingerprint.
- Version-checked edits append before/after revisions and audit events.
- Manual records retain null `source_import_row_id`; import promotion is not enabled.
- No hard-delete endpoint was added.

## 4. Backend API

- GET `/api/hourly/<module_key>/catalog`
- GET `/api/hourly/<module_key>/records`
- POST `/api/hourly/<module_key>/records`
- PATCH `/api/hourly/<module_key>/records/<record_id>`
- GET `/api/hourly/<module_key>/records/<record_id>/revisions`

The same backend contract and API implementation serve all three modules. Module identity and permission checks are validated server-side.

## 5. UI integration

Hourly Meat:
- 12-row entry grid and current Code Map options.
- Live saved-record register, filters, paging, and refresh.
- Save, version-checked edit, and revision history.

Hourly Coding and Hourly Agri:
- New draft entry grid with live Code Map options.
- Server-backed saved-record history and filters.
- Save, version-checked edit, and revision history.

The source calculation fields remain read-only. The UI no longer claims that saving is unavailable.

## 6. Verification evidence

- Hourly Production contract/API tests: 25 passed.
- Full TFI_NEW backend regression suite: 225 passed.
- Browser integration test: Hourly Meat, Hourly Coding, and Hourly Agri all passed create/list/edit/history flows; zero browser runtime errors.
- All three module catalogs returned 68 current Product Code options.
- Python compile and frontend JavaScript syntax checks passed.
- Rolled-back TFI2 SQL smoke test covered all three modules: catalog access, create, derived calculations, duplicate-slot protection, version-2 edit, revision history, and record-list RPC.
- Post-smoke database counts: 0 hourly records, 0 hourly revisions, 0 hourly audit events. Test transactions were rolled back.
- Security Advisor reported no new Hourly Production SECURITY DEFINER finding. Existing findings remain two Production Entry SECURITY DEFINER RPCs and disabled leaked-password protection.
- No historical or sample production rows were imported or persisted.

## 7. Remaining gates and next work

Authenticated live acceptance remains pending. Use an explicitly approved controlled entry after the local application is restarted and the owner is ready to test.

The current UI saves records and supports versioned edits. The submit-for-review, approve, and return workflow is **not yet implemented**; the existing workflow descriptions are planning guidance only. The next Hourly work item is to define and implement the submit/review/approval state transitions and permissions without changing the seven-phase roadmap.

Historical spreadsheet import remains separate. Do not promote historical Hourly rows until the module-specific Phase 6 import mapping and duplicate/reconciliation rules are approved.
