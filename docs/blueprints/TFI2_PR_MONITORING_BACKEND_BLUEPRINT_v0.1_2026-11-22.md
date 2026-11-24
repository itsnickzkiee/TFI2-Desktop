# TFI2 Phase 5 — PR Monitoring Backend Blueprint

**Date:** 22 November 2026  
**Module order:** 11 of 13  
**Status:** Read-only TFI2 backend/API/UI implemented; authenticated live browser acceptance pending  
**Database:** TFI2 Supabase project only

## 1. Approved source contract

- Workbook: `Copy of TFI - Production Monitoring Sheet 1`
- Spreadsheet ID: `1rCbQ16wj7MRjQCFF3tA-WEMkudraJK0RkwcqayUlz7k`
- Worksheet: `PR MONITORING`
- sheetId: `867256143`
- Source grid: A1:AA1000; displayed PR register fields A:G
- Summary row: 2; header row: 3; first data row: 4; three frozen rows.
- Source title: `TOSEN FOODS INC. 2025 -  PR MONITORING`
- Current source audit: 78 populated rows across rows 4–81; 64 rows carry a PR Number; 12 product-group total rows; row 4 is a zero-value template; row 79 is an incomplete candidate without a PR Number.
- Product-group total source rows: 6, 11, 15, 19, 25, 34, 41, 45, 57, 65, 71, 77.

| Source column | TFI2 field | Contract |
|---|---|---|
| A | `column_a` | Blank source header; product/group label. Preserve as supplied. |
| B | `pr_no` | Text, not numeric. Preserve leading zeros and source formatting. |
| C | `date_pr_received` | Date received. Preserve source date. |
| D | `pr_required_quantity_tins` | Stored source quantity; no recalculation. |
| E | `production_produced_tins` | Stored source quantity; no recalculation. |
| F | `for_production_quantity_tins` | Stored source quantity; no recalculation. |
| G | `status` | Formula result captured as a read-only source value. |

## 2. Source summary and formula rules

Summary row 2 is a source-sheet snapshot, not a live TFI2 aggregate:

- Total Tins To Produce — B2: 16,182,629; formula `=SUM(D4:D1002)`.
- Total Tins Produced — D2: 15,648,348; formula `=SUM(E4:E1002)`.
- Completion — F2: 96.70%; formula `=D2/B2`.

The source Status formula in G is:
`=if(D4="","",if(F4>0,"Pending for Production",if(F4=0,"Complete","Over Produce")))`

Exact source status values:
- `Pending for Production`
- `Complete`
- `Over Produce`

TFI2 does not recalculate column F or G. Columns D, E, F and the displayed formula result in G are stored as source values when an approved import is later promoted. The original Google Sheet is never modified by ordinary TFI2 register operations.

## 3. Source-row classification contract

- A nonblank PR Number in column B identifies a PR register candidate. PR Number is not a unique business key; multiple rows may legitimately carry the same PR Number.
- A column A label ending in ` Total` is a product-group summary. Exclude it from the operational PR register and preserve it in import review/source staging.
- Row 4 is the zero-value template. Exclude it from the operational PR register.
- Row 79 has no PR Number but contains a date and quantities (1 February 2025; 40,993 required; 1,708 produced; 39,285 remaining; Pending for Production). Preserve it as an incomplete Import Inbox candidate with reason `missing_pr_no`; do not auto-complete it or convert it into a PR transaction.
- Blank rows remain blank.
- No PR Number is converted to a number; no date or quantity is inferred.
- Source summary and group-total rows are never counted as individual PR transactions.

## 4. Database model and safeguards

- `public.tfi_pr_monitoring_records` is the canonical read-only PR register destination.
- Every canonical row requires source spreadsheet/sheet identity, source row number, PR Number text, source A:G values, source formulas, a SHA-256 source fingerprint, source Import Inbox row ID, import batch ID, importer and timestamp.
- Unique source-sheet/source-row identity prevents the same source row being promoted twice. A source-row correction requires a future approved Import Center reconciliation workflow; this module has no manual correction endpoint.
- Constraints prevent blank PR Numbers, product-group total labels, unsupported status values, wrong source identities, invalid source row numbers, and malformed source A:G/formula snapshots.
- RLS is enabled. Authenticated users have SELECT only when `pr_monitoring.view` is granted. Direct client INSERT/UPDATE/DELETE is revoked.
- No manual create, edit, submit, approve, archive, restore or delete API is exposed.
- Export requires `pr_monitoring.export`.
- The table is empty by design. No historical source rows were imported in Phase 5.

## 5. API

- `GET /api/pr-monitoring/catalog` — source mapping, static source-summary snapshot, status options, read-only capabilities and permissions.
- `GET /api/pr-monitoring/records` — date range, PR Number, status and general search; allow-listed sorting; pagination up to the approved source-grid limit.
- `GET /api/pr-monitoring/export.csv` — filtered A:G CSV export; permission-checked and source-column ordered.

The database RPC is `public.tfi_get_pr_monitoring_records`, SECURITY INVOKER, permission-checked, and RLS-respecting.

## 6. UI integration

- PR Monitoring preview now loads catalog and saved records from TFI2; the local preview's empty sample array is not treated as production data.
- Connection state is visible as TFI2 CONNECTED / READ-ONLY or an explicit connection error.
- Source summary cards are labelled as row-2 source snapshots, not live database totals.
- Seven source columns A:G and the original source labels are retained.
- Date, PR Number, status and general-search filters and table sorting remain available.
- CSV export stays disabled unless approved records exist and the signed-in role has export permission.
- Refresh reloads the TFI2 catalog and register.
- No Add/Edit/Save Transaction controls are provided.

## 7. Applied migrations

- `20261122103759_tfi2_pr_monitoring_readonly_backend` — canonical read-only table, source constraints, RLS, SELECT policy, module permission setup, and paginated/filterable read RPC.
- `20261122104722_tfi2_pr_monitoring_fk_indexes` — covering indexes for import-batch and importer foreign keys.

The existing Import Center destination remains:
- module key: `pr_monitoring`
- source sheetId: `867256143`
- input columns: A:F
- formula column: G
- contract status: `raw_capture_only`

Do not change the destination to an import-approved/promotion status until Phase 6 has the matching canonical promotion handler and reviewed classification rules for valid PR rows, group totals, the template row and incomplete candidates.

## 8. Verification evidence

- Focused PR Monitoring contract/API/gateway tests: 9 passed.
- Full backend regression suite: 287 passed.
- Python compilation and PR Monitoring JavaScript syntax checks passed.
- Mocked browser test passed on desktop and mobile: live catalog identity, source snapshot values, seven columns, leading-zero PR Numbers, status filter, refresh, export enablement and no write actions; zero browser errors.
- Authenticated TFI2 SQL smoke test ran in a rolled-back transaction: read RPC and filter response, invalid status rejection, RLS and direct-write denial passed.
- Live database count: 0 PR Monitoring records.
- Authenticated table privileges: SELECT true; INSERT/UPDATE/DELETE false.
- Supabase Security Advisor: no new PR Monitoring security finding. Existing warnings are the two Production Entry SECURITY DEFINER RPC findings and project-wide leaked-password protection disabled.
- Supabase Performance Advisor: no unindexed foreign-key finding for PR Monitoring after the FK-index migration. Existing unindexed-FK notices are in other modules.
- Import destination remains raw-capture-only; no source history or incomplete candidate was promoted.

## 9. Acceptance still required

Sign in through the local TFI_NEW app, open PR Monitoring, verify the green TFI2 read-only connection and zero approved records, test the filters, and confirm export remains disabled while the canonical register is empty. Do not create a manual PR record and do not import the 64 source PR rows during this acceptance. Historical source review and canonical promotion remain Phase 6 work.

**Next approved Phase 5 module:** CO QA (order 12), subject to its existing business-rule hold. NON-PROD remains order 13. Official seven-phase roadmap unchanged.
