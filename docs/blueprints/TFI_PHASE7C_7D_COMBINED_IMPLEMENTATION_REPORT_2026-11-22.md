# TFI — Phase 7C + 7D Combined Workstream Report

**Date:** 23 November 2026  
**Project:** TFI_NEW / TFI2  
**Workstream:** 7C KPI & Computation Verification + 7D Reports & Reconciliation  
**Status:** Dashboard filters, Yield Log read-only formula engine, Yield Dashboard UI, and Dashboard/Reports readiness integration are implemented; Summary projection, remaining report calculations, and live-session acceptance are open.

## Roadmap

The official seven-phase roadmap remains unchanged. Phase 7C and 7D are combined as one development workstream, with separate formula and reporting acceptance gates.

## Source formula audit

- Connected to the owner's authorized Google Sheets OAuth account in read-only mode.
- Audited the official workbook helper tabs: KPI Dashboard, KPI Calc, Dash Calc, Hourly Calc, Yield Map, Yield Log, KPI Setup, and Summary.
- Formula scan observed 2,544 formula cells in KPI Calc and 1,398 formula cells in KPI Dashboard.
- Verified source filter behavior for date range, Product Code, Product Name, Machine, and the Include in Overall rule.
- Verified the downtime group mapping from KPI Setup columns O:P: Machine, Manpower, Material, Quality, and Process / Other. Unknown codes map to Process / Other.
- Audited Yield Map A5:N43 against all 39 Product Entry blocks and traced 955 formula dependency cells used by Yield Log metrics. The required source functions are IF, IFERROR, SUM, and SUMIFS.
- The Yield Map's Mayon Kaong label-reject mapping uses a DMR Production SUMIFS across source columns A, B, G, and H. KPI Setup M2 supplies the workbook year used for month/day text dates.
- The original source workbook was not modified. No live source rows were scanned for import or copied into TFI2.

## 7C — KPI and computation implementation

### TFI2 database

Added the read-only, permission-checked RPC:

- `public.tfi_get_dashboard_analytics(date,date,text,text,text)`
- Private implementation: `private.tfi_get_dashboard_analytics`
- Calculation contract: `source-workbook-2026-11-22-v1`

The function checks Dashboard permission and each module's view permission before reading its source. It uses the signed-in user's authorization context, does not write operational records, and returns explicit empty/restricted/pending states.

### Verified calculation groups

1. **Productivity**
   - Total output and target output.
   - Output attainment: output on rows with a target divided by total target.
   - Productivity: output on rows with MHR divided by total DMP-linked MHR.
   - Standard productivity and productivity versus standard.
   - FG reject percentage: FG rejects divided by output plus FG rejects.
   - Individual reject totals: dented, false seam, flipper, bulged, panel, and buckling.

2. **Downtime**
   - DMR Production downtime minutes converted to hours.
   - DMR Coding downtime kept as a separate measure, matching the source workbook.
   - Downtime reason categories and KPI Setup group mapping.
   - MTTR: BD downtime hours divided by BD count.
   - MTBF: (planned run hours minus DMR Production downtime hours) divided by BD count.
   - Downtime percentage: DMR Production downtime hours divided by Productivity planned run hours.

3. **OEE**
   - Availability: run time divided by planned hours.
   - Performance: capped count divided by ideal output.
   - Quality: good count divided by total count.
   - Overall OEE: Availability × Performance × Quality.
   - The source Include in Overall behavior is retained when Machine is All.

4. **Hourly Production**
   - Separate Hourly Meat, Hourly Coding, and Hourly Agri summaries.
   - Target, actual, variance, attainment, and hourly cumulative series are returned from the canonical TFI2 view.

5. **Production Summary**
   - Saved rows, distinct days logged, average attainment, average attendance, overtime hours, and rows below 95%, using the source dashboard's 95% condition.

### API and UI

- Added `GET /api/dashboard/analytics`.
- Added the Supabase gateway method and date/filter validation.
- Connected the primary Overview cards: 11 verified measures plus the source-backed Average % Yield KPI. Yield remains blank when no eligible Product Entry records exist.
- Kept all other KPI slots blank until their individual formula and source mappings are verified.
- Added a source-calculation status strip.
- Added `GET /api/dashboard/filter-catalog`, protected by `dashboard.view` and `master_data.view`. It reads the existing TFI2 `kpi_setup` and `code_map` Master Data snapshots; no new table or migration was required.
- Connected all eight workbook-aligned filters: Year, View (Daily / Weekly / Monthly), Month, Week No., Date, Product Name, Product Code, and Machine (OEE). Source ranges are KPI Setup A2:A4, B2:B13, D2:D54, E2:E129, F3:F54, R2:R129, and S2:S5; product-code/name pairing comes from Code Map A:B.
- Daily, ISO-weekly, and monthly selections are translated into inclusive `date_from` / `date_to` analytics parameters. Product Name, Product Code, and Machine selections are passed to the same source-backed analytics endpoint; a Code Map mismatch is flagged in the filter status.
- Filter catalogs are loaded on initial view and refreshed after module saves, focus, or visibility return. The 15-second fallback refresh updates coverage and analytics without repeatedly downloading static filter lists.
- Added read-only `GET /api/yield/log`. It projects Product Entry records through the live TFI2 Yield Map and recalculates the selected source formula dependencies at read time for all 39 product blocks. Formula outputs are never written back to Product Entry records.
- The Yield Log projection uses KPI Setup M2 for month/day text dates and the DMR Production source for the mapped Mayon Kaong SUMIFS formula. It requires Dashboard, Product Entry, and Master Data view permissions, plus DMR Production view permission when that DMR-backed formula is needed.
- The response carries the original Yield Map instruction that non-DPGP 95% targets are placeholders. No source-workbook edit or new operational table was required.
- Added `design/dashboard-yield-ui` integration: four yield/bloom summary cards, four individual reject-rate cards, product scorecard grouped by product, and the source-aligned 12-column Yield Log detail table.
- Connected dashboard Date From/To, Product Name, and Product Code filters to the Yield Log API. Product Name is resolved through the live Code Map to the corresponding Yield Map / Product Entry block. Added 100-row pagination and explicit loaded-row average labels so partial pages are never presented as full-period totals.
- Added a mobile-safe horizontally scrollable Yield Log table, empty states, source note, placeholder-target warning, and automatic refresh after module saves, focus, visibility return, and the 15-second fallback.
- Updated the TFI2 Dashboard analytics RPC wrapper so `readiness.yield_kpis` reports `implemented_read_only_projection` and the Yield Log formula engine is removed from the pending KPI group list. The wrapper remains SECURITY INVOKER with an empty search path. The matching SQL migration file was created locally; the function update was executed and verified on TFI2.
- Added a centralized write observer to the lazy-loaded module iframe router. It watches successful same-origin API `POST`, `PUT`, `PATCH`, and `DELETE` requests and emits a `TFI_DATA_SAVED` event without reloading the application.
- A successful operational-module save now immediately refreshes Dashboard coverage and KPI analytics. The event is also broadcast to cached module frames so Reports & Reconciliation refreshes its cross-module snapshot; Production Entry saves also refresh the report summary and saved-record list.
- Added 15-second fallback refresh, plus refresh-on-focus and refresh-on-tab-return behavior for Dashboard and Reports.
- Audited module UI transport patterns: current module UI save flows use Fetch; no XMLHttpRequest save transport was found in the scanned module UI scripts.
- Added browser acceptance test `design/test-dashboard-live-refresh.js`. It simulates a successful Productivity save and verifies the Dashboard analytics request and Reports snapshot refresh.

## 7D — Reports and reconciliation implementation

- Added a cross-module reconciliation snapshot to Reports & Reconciliation.
- Connected it to the same TFI2 analytics endpoint used by the Dashboard.
- Production Summary and Schedule Summary report sources are identified as connected.
- The Summary report remains explicitly pending until its separate Product Entry formula-only outputs are calculated and projected.
- The Yield Log read-only projection API, visual Yield tab, average-yield KPI, product scorecard, and detailed Yield Log table are connected. The dashboard and Reports readiness snapshots now identify Yield as an implemented read-only projection.
- Removed Rows remains identified as a source archive; no canonical TFI2 archive relation is registered, so it is not represented as live operational data.
- The report snapshot follows the Production Summary date range.

## Live database state observed

All queried operational transaction sources currently contain zero saved rows, including Product Entry, Production Entry, Production Schedule, DMP, DMR Production, DMR Coding, Hourly Production, OEE, Productivity, Coding DPR, PR Monitoring, CO QA costs, NON-PROD, and Import Center batches/staged rows. The audit event table contains one bootstrap event.

Therefore the live Dashboard correctly displays em dashes for KPIs with no eligible source records. The new Yield Log API will return an empty record list until Product Entry rows are saved; the DMR-backed formula cannot be live-validated until its source rows exist. Browser and formula-engine fixtures are synthetic and were used only in local tests; no fixture rows were written to TFI2.

## Verification

- Full backend regression suite: **354 passed**.
- Yield formula contract and API tests: **12 passed**.
- Yield Dashboard browser test: **PASS**; validates averages, all four reject rates, product scorecard, original 12-column detail table, pagination, filters, and mobile layout.
- Dashboard browser regression: **PASS** with source-backed Yield empty state and filter integration.
- Reports analytics snapshot browser test: **PASS**; Yield readiness displays `Available · read-only` and only two remaining source projections are pending.
- Synthetic formula projection validation: **39 of 39 product blocks passed**, with zero formula evaluation failures.
- Yield Map dependency audit: **955 formula dependency cells** across the 39 blocks; required functions IF, IFERROR, SUM, and SUMIFS.
- DMR SUMIFS source matching and conditional DMR permission gate: **PASS**.
- Dashboard browser filter test: **PASS**; verifies source option loading, default selections, Daily / Weekly / Monthly period ranges, and Product Name / Product Code / Machine query parameters.
- Dashboard browser test: **PASS**.
- Reports analytics snapshot browser test: **PASS**.
- Module-save-to-Dashboard-and-Reports automatic refresh browser test: **PASS**.
- JavaScript syntax checks: **PASS**.
- Desktop and mobile Dashboard layout checks: **PASS**, no horizontal overflow at 390 px or 320 px.
- Reports snapshot test verified live-source labels, Yield read-only availability, pending Summary/archive states, and date-filter request.
- TFI2 Dashboard analytics RPC wrapper verification: **PASS**; `SECURITY INVOKER` and empty `search_path` preserved; Yield Log removed from the pending KPI list.
- Database analytics RPC was executed with an authenticated test claim in a rolled-back, read-only verification transaction. Empty-state response and permission-gated source structure were returned successfully.
- TFI_NEW local backend restarted using the project virtual environment.
- Live `GET /api/health` returned HTTP 200 with `connected=true` and `database_project=TFI2`.
- Unauthenticated `GET /api/dashboard/analytics`, `GET /api/dashboard/filter-catalog`, and `GET /api/yield/log` return HTTP 401 in the Flask route tests, confirming all three routes require authentication.
- Restart cleared the local in-memory login session. Authenticated live-browser acceptance is pending the owner's next sign-in.
- No production data, import batches, or historical rows were created.

## Remaining 7C / 7D work

1. Reproduce the Summary worksheet's Product Entry formula projection before enabling its report totals.
2. Confirm and implement the Removed Rows archive source if it is to be a live TFI2 report.
3. Implement previous-period comparisons and trend-series parity from KPI Calc / Dash Calc.
4. Render the returned Hourly Production series and complete the remaining KPI cards/tabs.
5. Perform authenticated live-browser acceptance with actual Product Entry and DMR source rows after the local backend restart.

## Safety and rollback

- No database table or operational record was deleted or reset.
- The new analytics function is read-only.
- The official source workbook remains unchanged.
- Existing Phase 7A/7B pre-change backups remain available in `docs/backups/phase7a7b_20261122/`.
- No Phase 5 or Phase 6 work was reopened by this workstream.
