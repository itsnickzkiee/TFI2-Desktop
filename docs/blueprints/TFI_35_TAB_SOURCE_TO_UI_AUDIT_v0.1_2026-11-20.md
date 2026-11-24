# TFI_NEW — 35-Tab Source-to-UI Audit v0.1

**Audit date:** 20 November 2026  
**Project:** TFI_NEW  
**Official reference workbook:** Copy of TFI - Production Monitoring Sheet 1  
**Spreadsheet ID:** `1rCbQ16wj7MRjQCFF3tA-WEMkudraJK0RkwcqayUlz7k`  
**Verified URL:** https://docs.google.com/spreadsheets/d/1rCbQ16wj7MRjQCFF3tA-WEMkudraJK0RkwcqayUlz7k/edit  
**Worksheet count:** 35  
**Purpose:** Establish the official 35-tab workbook as the source baseline, map every worksheet to the TFI_NEW UI/module, identify stale source references, and define safe import treatment before further UI work or data transfer.

## 1. Executive result

The new workbook was read through Google Sheets metadata and bounded worksheet reads. It contains **35 worksheets**. This is now the official source reference for TFI_NEW, replacing the previously used 28-tab workbook for future source mapping and import planning.

### 1.1 Difference from the previous workbook

| Comparison | Result |
|---|---:|
| Previous workbook | 28 worksheets |
| Official workbook | 35 worksheets |
| Exact worksheet names shared by both | 27 |
| Old-only worksheet | PR-PPlan |
| New-only names | 8 |
| Of the 8 new-only names | 1 renamed/replacement tab + 7 additional tabs |

The old `PR-PPlan` worksheet is represented in the new workbook as `Production Schedule`. The seven genuinely additional worksheets are:
- GUIDELINES
- Production Entry
- Schedule Summary
- Production Summary
- Schedule Lists
- Lists
- Removed Rows

The 35-tab workbook is not a requirement for 35 standalone application screens. Some tabs are operational entry sources, some are reports or saved logs, some are master/reference data, and some are calculation helpers or instructions.

### 1.2 Current UI coverage

- Existing operational preview pages are present for 14 of the 15 main operational/input worksheets.
- **PR MONITORING is the missing operational UI.**
- Existing UI data files for DMR Coding, Coding DPR, and NON-PROD still identify the previous 28-tab workbook.
- CO QA still contains the previous workbook's sheet ID in its data specification and must be revalidated against the new workbook.
- OEE, Productivity, and Yield Monitoring have previews, but their current data files do not embed an explicit workbook ID; source mapping must be verified.
- Production Summary, Schedule Summary, Summary, and Removed Rows need to be represented in history/report/reconciliation views. They do not automatically require four separate entry screens.
- Reports & Reconciliation remains a planned application module and has no dedicated preview route/page yet.
- Master Data UI exists, but its source-backed categories and baseline counts must be checked against the new workbook before it is treated as import-ready.

## 2. Workbook identity and protection

- Workbook title: `Copy of TFI - Production Monitoring Sheet 1`
- Spreadsheet ID: `1rCbQ16wj7MRjQCFF3tA-WEMkudraJK0RkwcqayUlz7k`
- The previous 28-tab workbook ID `1BzmYYCXRxOrseQK9VlXzucbri_Sv8A2NxHgZskWeJps` is retained only for comparison and legacy UI reference detection.
- This audit did not edit either Google Spreadsheet.
- No rows were imported, copied, deleted, normalized, or changed.
- No Supabase/database writes were performed.
- Existing TFI_NEW UI files were inspected only; no UI source code was changed during this audit.

## 3. Full 35-worksheet inventory and UI mapping

Grid dimensions below are the dimensions reported by spreadsheet metadata, not a claim that every cell in the grid is populated.

| # | Exact worksheet | sheetId | Grid (rows × cols) | Role / key source structure | TFI_NEW destination and current state | Import treatment |
|---:|---|---:|---:|---|---|---|
| 1 | GUIDELINES | 2077282819 | 1,000 × 26 | Workbook instructions, color guide, usage and workflow notes | Documentation only; no standalone operational UI | Do not import as transactions. Retain as source documentation. |
| 2 | KPI Dashboard | 1506213325 | 1,000 × 27 | Dashboard filters and formula-driven KPI/production views | Dashboard preview exists; exact KPI parity and source mapping still need verification | Rebuild dashboard from canonical records and approved calculations; do not import displayed metrics as transactions. |
| 3 | Production Entry | 1923467491 | 1,000 × 26 | Daily form; header row 6; fields A:W; 12 form rows at 8:19; product, production, time, manpower/OT, remarks and trace fields | Production Entry preview exists; data file references official workbook | Treat as daily entry form/state. Do not duplicate saved history already represented in Production Summary. If populated unsaved rows are present, preserve and classify them before import. |
| 4 | Product Entry | 545274882 | 39,160 × 164 | 39 product-family blocks from Entry Map; 164 columns A:FH; row 7 contains the main field headers and product-specific groups for output, raw materials, packaging, coding/labelling, QA, downtime and manpower | Product Entry preview exists; source ID is the official workbook | Operational product records. Preserve family/block mapping, source row, manual inputs, formula outputs and hidden-column rules. |
| 5 | Production Schedule | 1538651320 | 1,000 × 26 | Replaces old PR-PPlan; daily form with header row 6 and fields A:U. A:R are business fields; S:U are key/has-data/source-row helpers | Production Schedule preview exists; data file references official workbook | Operational schedule records. Preserve date, product, code, PR, target, quantity, manpower and trace fields. Do not import helper columns as separate business fields. |
| 6 | OEE | 1750442014 | 4,000 × 21 | Header row 4; A:J are run/input fields; K:U are calculated run time, good count, availability, performance, quality, OEE, ideal output, week/month and product name | OEE preview exists; current data file has no explicit workbook ID | Verify its current options, formulas and source identity against this tab before import readiness. Import source inputs once; calculate derived OEE values in TFI_NEW. |
| 7 | Hourly Meat | 428082343 | 5,004 × 12 | Header row 4; A:F input fields (date, hour, product code, target, actual, remarks); G:L formula/lookup outputs | Hourly Meat preview exists; data file references official workbook | Import input fields; derive product name, time slot, variance, cumulative values and attainment from approved rules. |
| 8 | Hourly Coding | 1916766220 | 5,004 × 12 | Same 12-column hourly structure as Hourly Meat | Hourly Coding preview exists; data file references official workbook | Same input-versus-derived separation as Hourly Meat. |
| 9 | Hourly Agri | 534145404 | 5,004 × 12 | Same 12-column hourly structure as Hourly Meat | Hourly Agri preview exists; data file references official workbook | Same input-versus-derived separation as Hourly Meat. |
| 10 | DMR Production | 2048043346 | 12,004 × 12 | Header row 3; Date, Product Code, Line, Stop, Resume, Total in Min., Total in Hrs., Category, Remarks, Product Name (auto). I:J are blank/unlabelled in the observed header | DMR Production preview exists; data file references official workbook | Import identified downtime input fields. Preserve source formulas for duration and product-name lookup as calculation references, not duplicate input fields. Do not invent meanings for I:J. |
| 11 | DMR Coding | 675328096 | 12,317 × 11 | Header row 3; Date, Product Code, Line, Stop, Resume, Time in Mins, Time in Hours, Category, Factor, Reason, Product Name (auto) | DMR Coding preview exists, but its data file still points to the previous workbook | Rebase and revalidate against this tab before use. New workbook Product Code validation is `#REF!`; Category and Factor validations reference DPR LEGEND columns B and D. Product Code choices need an approved source-backed mapping. |
| 12 | Coding DPR | 1266086431 | 1,000 × 26 | Header row 2; A:B date/line plus seven production-date/product-code/quantity batch groups across C:W; X is Total Quantity | Coding DPR preview exists, but its data file still points to the previous workbook | Rebase and revalidate. New Product Code validations are `#REF!`; line number validation points to DMP LEGEND D2:D4. Source X formula is `=SUM(E3,H3,K3,N3,Q3,T3)` and excludes Batch 7 quantity in W. Preserve this source behavior until the business owner approves a correction. |
| 13 | PR MONITORING | 867256143 | 1,000 × 27 | Summary metrics on row 2; headers B:G on row 3: PR No., Date PR Recieved, PR Required Quantity (tins), Production Produced (tins), For Production Quantity (tins), Status | **Missing UI — next missing operational screen** | Build a PR Monitoring module. Initial row typing found 64 rows with a PR No., one additional candidate at row 79 with date/quantities but no PR No. (incomplete candidate), 12 product-total rows in column A, and a zero-value template row 4. Preserve the incomplete candidate; do not treat product-total rows or the blank template as PR transactions. Status in G is formula-generated. D/E/F values are stored values in the inspected rows; do not assume F is formula-derived. |
| 14 | co QA | 1359678099 | 2,745 × 40 | Header row 2; A:X quality fields derived from Product Entry; Y:AD packaging unit-cost inputs; AE:AH formula totals; AI:AL require formula verification | CO QA preview exists as a read-only view; its data specification still has the previous workbook sheetId | Revalidate the new sheetId and formulas. Review whether Y:AD manual cost fields need an editable Admin workflow; do not silently treat the entire sheet as read-only if those inputs are required. |
| 15 | NON-PROD | 1381857831 | 1,000 × 26 | Two header rows; A:J fields: Date, Name, Position, Time Start, Time End, Total of minutes, No. of Working Hours, Activities, Location, Remarks | NON-PROD preview exists, but its data file still points to the previous workbook | Rebase workbook ID and sheetId. Layout, validation rules and MANPOWER dropdown contents were compared and are identical across old/new workbooks: 445 names, 8 positions, 48 activities, 36 locations. G uses `=F/60`; keep read-only/derived. No UI layout redesign is indicated by this comparison. |
| 16 | DMP - Production | 1312335050 | 7,629 × 9 | Header row 1; A:I: Production Date, Product Code, Process, Regular's Name/Casual, Count, Start, End, Total Time, Position | DMP Production preview exists; data file references official workbook | Import operational manpower/process rows. Position in I is a lookup from DMP LEGEND. New Product Code validation is `#REF!`; Process and worker lists reference DMP LEGEND. Product Code option source needs verification. |
| 17 | MANPOWER | 583741906 | 1,000 × 26 | Reference columns A:E: Name, Position, Activities, Location, Legend | Master Data preview exists | Master/reference records. Retain repeated names as separate source rows until the data owner confirms merge rules. Used by NON-PROD dropdowns. |
| 18 | Productivity | 1688444278 | 1,500 × 22 | Header row 4; A:K input fields (date, product code, line, planned hours, output and reject counts); L:V calculated totals, manpower hours, targets, productivity, attainment, reject %, week/month and product name | Productivity preview exists; current data file has no explicit workbook ID | Verify source mapping and formulas against the new tab. Import A:K once; calculate L:V from approved source relationships and standards. |
| 19 | DMP LEGEND | 1070169465 | 1,000 × 26 | Reference columns A:D: Workers name, Position/Role, Process, Line | Master Data preview exists | Reference data for DMP Production and line options. Preserve source identities and unresolved worker-name mismatches. |
| 20 | Schedule Summary | 720094137 | 11,000 × 26 | Header row 2; A:R schedule summary fields: date/day/line/area/product/code/batches/targets/quantities/manpower/PR/remarks/FC-IDC/shift | No standalone preview; planned as Production Schedule history/report or Reports & Reconciliation view | Treat as schedule summary/history, not a second independent schedule-entry source. Confirm source population/formula behavior before importing rows. |
| 21 | Production Summary | 1846667474 | 13,188 × 26 | Header row 6; A:X saved production log. One row per saved product run. Trace fields include Saved on, Check, Has data and Day has data. Summary formulas report 893 logged rows and 140 days in the inspected snapshot. | Production Entry form exists; no dedicated saved-history/report view identified | Treat this as the saved Production Entry history source. Avoid importing the same saved runs again from the daily Production Entry form. Build a Production History view within Production Entry or Reports & Reconciliation. |
| 22 | Summary | 1639151211 | 1,201 × 32 | Header row 3; A:AF product output, finished-goods rejects, QA, can/lid rejection breakdown and rejection percentages; formula-driven from Product Entry | No standalone preview; Reports & Reconciliation / Dashboard destination | Derived summary; rebuild from canonical Product Entry/QA records. Do not import as a second set of transactions. |
| 23 | Schedule Lists | 156467196 | 1,000 × 26 | Product group, production codes, line, UOM, shift hours, area and Product Standard field/column mapping | Master Data preview includes a Schedule Lists summary | Reference list refreshed from Product Standard. Keep as a reference view, not an independent product catalog. Revalidate the new workbook rows and refresh behavior. |
| 24 | Product Standard and Specificat | 2138697021 | 1,000 × 26 | Product Standard reference; row 1 includes code/variant, name, production line, line, manpower, capacity, TMS, can size/code, product type/description, brand, weight, label, can type, case count, Halal, output/hr, shift and manual override | Master Data preview exists | Master/reference data. Preserve input fields and formula-derived capacity/output values separately. Verify new workbook row counts and source validation before enabling edits. |
| 25 | DPR LEGEND | 508797580 | 17,972 × 40 | Reference columns B:F (downtime codes/factors/status/review), G:H formula-generated production line and DPR code list, I:AN product-family code lists | Master Data preview exists | Reference data. Preserve G:H as formula/helper outputs; use approved product-code lists for Coding DPR and DMR only after validation. |
| 26 | KPI Setup | 1955006742 | 1,000 × 26 | Settings and reference groups: view, month, week, product code, machine, line, downtime code/description/Y-N, KPI settings, downtime group, product names and years | Master Data preview exists | Configuration/reference data. Validate the new workbook's settings and option lists; do not import formula/dashboard results as settings. |
| 27 | KPI Calc | 1639168265 | 520 × 53 | KPI Dashboard calculation/helper sheet | No standalone UI | Calculation service only. Rebuild calculations from approved source inputs; do not import as transactions. |
| 28 | Code Map | 2098561343 | 1,000 × 26 | Product Code → Product Name/family lookup (header row 4) | Master Data preview exists | Reference data used by Productivity, OEE, DMR and other product-name lookups. |
| 29 | Yield Map | 854969610 | 1,000 × 26 | Header row 4; A:W product-family yield/reject source-column mappings, labels, targets and helper indices | Master Data preview exists | Reference/calculation mapping. Preserve editable mapping fields separately from helper formulas. |
| 30 | Yield Log | 743111542 | 39,043 × 12 | Header row 4; A:L formula-generated date/product/output/yield/reject view sourced from Product Entry and Yield Map | Yield Monitoring preview exists; current data file has no explicit workbook ID | Read-only derived monitor. Do not import Yield Log rows as independent production transactions. Verify its source formulas and mapping against the new workbook. |
| 31 | Dash Calc | 218696408 | 437 × 65 | Dashboard helper calculations and product-code matrix/list | No standalone UI | Helper only; rebuild from approved records and master data. Do not import as transactions. |
| 32 | Hourly Calc | 337985486 | 1,000 × 32 | Hourly Dashboard helper: time slots, targets, actuals, cumulative values, variances, status and product-code totals | No standalone UI | Derived helper only; rebuild from Hourly Meat/Coding/Agri. |
| 33 | Entry Map | 1628314566 | 1,000 × 26 | A:F mapping of product dropdown, block name, Product Entry title, first row, row count and hidden columns; current Product Entry specification identifies 39 blocks | Master Data preview exists as a read-only mapping summary | Reference mapping only. Do not create a new Product Entry family by adding a display row alone; preserve block/named-range relationships. |
| 34 | Lists | 832240400 | 1,000 × 26 | Supporting line and UOM lists plus operational instructions/migration notes | No standalone UI; supporting values belong in relevant modules/reference settings | Use only the actual reference values needed by modules. Do not display workbook instructions in ordinary user screens. |
| 35 | Removed Rows | 1842536867 | 1,000 × 26 | Header row 3; A:R archived removed rows with date, reason, old product code, quantity, time, manpower, remarks, source tab and check | No standalone preview; candidate for Reports & Reconciliation / Import Archive | Preserve as a separate archive/exception source with its reason and source trace. Do not merge into Production Summary or silently discard. Business owner must decide whether any archived rows should be restored as operational records. |

## 4. Critical source-mapping findings

### 4.1 Stale workbook IDs in existing UI data files

The following existing data files still point to the previous 28-tab workbook:

| UI data file | Current embedded source ID | Required action |
|---|---|---|
| `design/dmr-coding-data.js` | `1BzmYYCXRxOrseQK9VlXzucbri_Sv8A2NxHgZskWeJps` | Rebase to official workbook and revalidate product-code options/formulas |
| `design/coding-dpr-data.js` | `1BzmYYCXRxOrseQK9VlXzucbri_Sv8A2NxHgZskWeJps` | Rebase to official workbook and revalidate all seven batch groups and validations |
| `design/non-prod-data.js` | `1BzmYYCXRxOrseQK9VlXzucbri_Sv8A2NxHgZskWeJps` | Rebase workbook ID and sheetId; dropdown content and layout are unchanged |

CO QA's data specification currently identifies old sheetId `274508256`; the official workbook's co QA sheetId is `1359678099`. Its source identity and all formula/manual fields must be rechecked.

### 4.2 Broken Product Code validation in the official workbook

The new workbook's sampled Product Code validation cells show `#REF!` in:
- DMR Coding, column B
- Coding DPR, product-code batch columns D/G/J/M/P/S/V
- DMP - Production, column B

This is a source-workbook validation defect, not a reason to invent new business codes. The DPR LEGEND sheet has a formula-generated DPR code list in column H and product-family code lists in I:AN. The exact replacement range and whether all codes are valid for each module must be verified before updating any UI dropdown or migration mapping.

Other observed validations:
- Coding DPR line number (column B) points to DMP LEGEND!D2:D4.
- DMR Coding Category and Factor point to DPR LEGEND columns B and D.
- DMP Production Process and worker lists point to DMP LEGEND columns C and A.
- NON-PROD Name, Position, Activities and Location point to MANPOWER ranges.

### 4.3 NON-PROD compatibility result

The old and official NON-PROD worksheets were compared:
- Same two header rows and A:J field structure.
- Same strict validation ranges.
- Same exact option lists: 445 names, 8 positions, 48 activities, 36 locations.
- Same working-hours formula pattern `=F(row)/60`.

Conclusion: the NON-PROD screen does not need a layout redesign because of the workbook switch. Its source workbook ID and sheetId still need updating in the UI data specification. Historical records remain separate from the blank preview form.

### 4.4 PR MONITORING row classification

The official PR MONITORING sheet has summary formulas in row 2 and headers in B:G on row 3. In the bounded data read of rows 4:1002:
- 64 rows contain a PR No.
- Row 79 has a date and quantity values but no PR No.; retain it as an incomplete PR candidate for module review, not as a product-total row.
- 12 rows in column A are product-total/group summary rows.
- Row 4 is a zero-value template row with no PR No. or date.
- Column G contains the status formula.
- The inspected D/E/F values are stored values; do not assume the remaining quantity is calculated by the source formula.

The new PR Monitoring UI must preserve incomplete identifiable PR records while excluding group totals and empty/template rows from the PR transaction table. Keep source row numbers for traceability.

### 4.5 Production Entry versus Production Summary

The official workbook describes Production Entry as a one-form-per-day input form and Production Summary as the log of saved daily forms:
- Production Entry has 12 form rows (8:19) and helper/trace fields U:W.
- Production Summary has one row per saved product run, source trace fields U:X, and summary formulas showing 893 logged rows and 140 days in the inspected snapshot.

Do not import the same saved production run twice. Use Production Summary as the saved historical log; treat Production Entry as the daily form/current input state. Any populated form rows not represented in the saved log must be separately classified before import.

### 4.6 Derived and helper tabs

The following are not independent operational transaction sources:
- KPI Dashboard (derived view)
- Summary (formula-derived from Product Entry)
- Yield Log (formula-generated from Product Entry and Yield Map)
- KPI Calc
- Dash Calc
- Hourly Calc

Schedule Summary is a summary/history companion to Production Schedule. Production Summary is the saved log of Production Entry. These should be represented in history/reporting views without creating duplicate operational transactions.

Removed Rows is an archive/exception dataset. Preserve it and its reason/source trace, but do not silently restore it into active operational tables.

## 5. Existing UI files and routing

The shared router currently contains routes for:
- Dashboard
- Product Entry
- Production Entry
- Production Schedule
- DMP Production
- DMR Production
- DMR Coding
- Hourly Meat
- Hourly Coding
- Hourly Agri
- OEE
- Productivity
- Yield Monitoring
- Coding DPR
- CO QA
- NON-PROD
- Spreadsheet Import
- Import History
- Master Data
- Users & Access
- Audit Trail
- Settings

No route/page currently exists for PR Monitoring or Reports & Reconciliation.

### 5.1 Existing preview files

The design folder contains preview files for the operational modules listed above, including Product Entry, Production Entry, Production Schedule, DMP Production, DMR Production, DMR Coding, the three Hourly modules, OEE, Productivity, Yield Monitoring, Coding DPR, CO QA and NON-PROD.

Existing previews do not prove backend integration, source parity, import readiness, or production database completion.

### 5.2 Master Data coverage

The current Master Data UI specification includes:
- Product Standard
- Code Map
- Yield Map
- Entry Map
- KPI Setup
- DPR Legend
- Manpower
- DMP Legend
- Schedule Lists

The official workbook also has a Lists tab. Its line/UOM support values should be mapped to the relevant modules or reference settings; it does not automatically need its own standalone UI.

The 18 November Master Data specification contains audited baseline counts from an earlier review. Those counts must be revalidated against the official 35-tab workbook before being shown as current source counts or treated as migration totals.

## 6. Recommended next work order

Do not start a new screen until the existing source references are aligned. Recommended sequence:

1. **Rebase and revalidate stale UI source mappings** for DMR Coding, Coding DPR, NON-PROD and CO QA. Keep the visual design unchanged unless the new source structure requires a field-level correction.
2. **Verify source mappings with no explicit workbook ID** for OEE, Productivity and Yield Monitoring, and verify KPI Dashboard metrics against the official workbook.
3. **Revalidate Master Data** against all reference tabs in the official workbook, including Schedule Lists and Lists.
4. **Build PR Monitoring UI** from the official PR MONITORING tab. Preserve incomplete PR records and separate group totals/template rows.
5. **Plan Reports & Reconciliation** to include Production Summary history, Schedule Summary, Summary, and Removed Rows archive/exception review.
6. Complete a module-by-module source-to-UI and import-readiness check before database integration or historical import.

## 7. Import safeguards

- The official workbook is a controlled source for scanning/import/migration only; Google Sheets must not become the live operational database.
- Preserve workbook ID, exact worksheet title, sheetId, source row, raw cell values, formula text/cached values where available, and a stable source-row fingerprint.
- Separate manual inputs, formula outputs, lookup values, template rows, group totals, helper calculations, reports and archive rows.
- New identifiable operational rows may be imported even when some fields are incomplete, consistent with the TFI_NEW Admin blueprint.
- Only proven existing duplicates should be blocked automatically. Possible duplicates must be reviewed.
- Do not silently fill missing dates, product codes, quantities, manpower, cost values or business statuses.
- Do not import derived/helper sheets as duplicate operational transactions.
- Do not change the official source workbook during UI development or source audit.
- Do not start Supabase writes, schema migrations or historical data transfer as part of this UI/source-audit phase.

## 8. Verification record

- Official workbook metadata returned 35 exact worksheet names, sheetIds and grid dimensions.
- Old workbook metadata returned 28 worksheet names; exact name comparison returned 27 common tabs, old-only PR-PPlan, and 8 new-only names (including the renamed/replacement Production Schedule).
- Bounded reads confirmed the principal operational header rows, formula samples and validation rules.
- NON-PROD dropdown values were compared between old and new workbooks and matched exactly.
- PR MONITORING rows 4:1002 were classified by visible PR No., date, product-total label and placeholder values.
- TFI_NEW local design folder and shared router were inspected for existing preview files and routes.
- No spreadsheet, UI source file, database, or historical data was changed in this audit pass.

**Audit status:** First-pass 35-tab inventory complete. Detailed per-module formula, validation, duplicate and import-readiness checks remain a separate gate before production data transfer.


## 9. Consolidated 8-module source revalidation — 20 November 2026

The follow-up validation is recorded in TFI_8_MODULE_SOURCE_ALIGNMENT_VALIDATION_v0.2_2026-11-20.md. It covers DMR Coding, Coding DPR, NON-PROD, CO QA, OEE, Productivity, Yield Monitoring, and Master Data.

The initial stale-ID observation is superseded by the active-file recheck: all seven active module data files now use the official 35-tab workbook ID and the verified sheetId for their worksheet. Older .pre35tab backups are retained for comparison and are not referenced by the current preview pages.

The current validation confirms:
- DMR Coding: 4,771 populated source rows; 116 product options; TMRMB-24-380 is supplemented from DPR LEGEND L3 because H3 omits column L; TMWKC-6-2950 remains an unmatched historical code.
- Coding DPR: 414 populated rows within a 526-row source span; 116 product options; batch-7 quantity remains excluded from the source total formula; TMWKC-6-2950 and MRMB-24-380 remain unmatched historical codes.
- NON-PROD: 20 historical rows; source dropdowns match MANPOWER (445 name records, 8 positions, 48 activities, 36 locations).
- CO QA: A:X is Product Entry-derived; Y:AD are manual cost fields; AE:AH are calculated; AI:AL remain unresolved in the inspected source.
- OEE: 3,700 source rows; 50 machine options, 127 product-code options, 3 lines; source Machine/Product Code validations show #REF! and are replaced in the preview with populated KPI Setup lists.
- Productivity: 626 source rows; 68 Code Map product codes; 36 codes lack Product Standard variants and 26 Product Standard variants lack Code Map entries.
- Yield Monitoring: Yield Log is a read-only derived view based on Product Entry and 39 Yield Map families; no historical rows are preloaded.
- Master Data counts and Product Standard field behavior have been updated to the official 35-tab source baseline.

Accidental read-result markers were removed from the affected active preview files. All design JavaScript files passed syntax checks and the eight relevant preview pages resolve their script references. No source spreadsheet, historical record, or live database was changed.


## 10. PR Monitoring UI preview implementation — 20 November 2026

The PR Monitoring preview is now implemented from the official 35-tab workbook and the exact PR MONITORING worksheet (sheetId 867256143).

- Added design/pr-monitoring-preview.html, design/pr-monitoring.css, design/pr-monitoring-data.js, and design/pr-monitoring-ui.js.
- Added the PR Monitoring route to the shared router; the existing sidebar item is retained.
- Preserved source columns A:G in order. Column A remains blank-headed; B:G preserve exact source labels and spelling.
- Preserved the row-2 summary snapshot values and formulas as source snapshot information, not live database metrics.
- Preserved the exact source status formula and values; D/E/F remain stored source values and are not recalculated in the UI.
- The preview table is empty. Historical PR rows, product-group total rows, the zero-value template row, and the incomplete candidate row are not preloaded.
- The source-row classification remains documented in the PR Monitoring UI specification for future import/reconciliation work.
- Desktop and mobile previews, filters/reset, sort controls, active sidebar route, seven-column table, and empty-state behavior were tested.
- No browser errors, missing local asset references, Google Sheets writes, or database writes were observed.
- A router backup was retained as design/tfi-preview-router.js.pre-pr-monitoring-20261120.bak.

**Current status:** PR Monitoring UI preview implemented and source-aligned. Backend connection and approved historical PR record reconciliation remain separate future work.


## 11. Priority 3 initial Reports & Reconciliation UI — 20 November 2026

The first Reports & Reconciliation UI view, **Production Summary**, has been implemented as an Admin-first preview.

- Added `design/reports-reconciliation-preview.html`, `design/reports-reconciliation.css`, and `design/reports-reconciliation-ui.js`.
- Added the Reports route to the shared router and changed the persistent sidebar label to Reports & Reconciliation.
- Verified source: official workbook `Copy of TFI - Production Monitoring Sheet 1`, worksheet `Production Summary`, sheetId `1846667474`.
- Preserved all 24 source columns A:X in exact order, with row-5 group headers and row-6 column headers.
- Preserved trace/helper columns U:X and visually distinguished formula-derived columns I (% Attainment) and R (% Attendance).
- The register remains empty; no historical production records or illustrative/sample transactions are preloaded.
- KPI cards remain neutral until approved application records are connected.
- Added an Admin Access Only Import Spreadsheet entry point. It opens a source-identification modal; the actual import action is disabled because scanning, upload, validation, and backend import are not part of this UI-only phase.
- Added date, line, product, code and global search controls, reset, sort indicators, disabled export, pagination state, and responsive horizontal table scrolling.
- Reports route, source metadata, 24-column layout, modal behavior, filter reset, sorting indicator, desktop/mobile layout, and empty-state behavior passed browser tests. Browser errors: 0; failed local asset requests: 0.
- No Google Sheets cells/formulas, historical records, Supabase tables, or backend data were changed.

The detailed specification is saved as `TFI_PRODUCTION_SUMMARY_UI_SPEC_v0.1_2026-11-20.md`.

**Priority 3 status:** Production Summary UI is implemented. Schedule Summary, Summary, and Removed Rows UI views remain outstanding. The full Reports & Reconciliation module is not yet complete, and no import authorization or historical data transfer is implied.


## 12. Schedule Summary UI preview implementation — 20 November 2026

The second Reports & Reconciliation report view, **Schedule Summary**, has been implemented and source-aligned.

- Verified official source: `Copy of TFI - Production Monitoring Sheet 1`, worksheet `Schedule Summary`, sheetId `720094137`.
- Verified source structure: header row 2, first data row 3, 19 columns A:S, frozen rows 2.
- Verified upstream form: `Production Schedule`, sheetId `1538651320`. Its source note says one form per day is filled and saved to Schedule Summary.
- Bounded read of `Schedule Summary!A3:S1000` returned no populated rows; the UI therefore displays an empty history state and no sample schedule transactions.
- Added `design/schedule-summary-preview.html`, `design/schedule-summary.css`, and `design/schedule-summary-ui.js`.
- Added the Schedule Summary route to the shared router. Production Summary and Schedule Summary now have report-view tabs, and the Reports sidebar item remains active on both views.
- Preserved all 19 source headers in exact A:S order, including SAVED ON as the source trace field.
- Added four neutral KPI cards, date/day/line/area/product/code/PR/global filters, sort indicators, reset, disabled export, pagination state, horizontal table scrolling, empty state, source-treatment note, and an Admin-only Import Spreadsheet information modal.
- The import action remains disabled. No upload, scanning, validation, backend import, Google Sheets write, or database write was performed.
- Browser checks confirmed exact 19-column header parity, source metadata, empty-state/no-mock behavior, modal behavior, sorting, filter reset, Production Summary ↔ Schedule Summary navigation, and desktop/mobile layout. Browser errors: 0; failed local asset requests: 0.

The detailed specification is saved as `TFI_SCHEDULE_SUMMARY_UI_SPEC_v0.1_2026-11-20.md`.

**Priority 3 status update:** Production Summary and Schedule Summary UI previews are implemented. The remaining report views are Summary and Removed Rows. Full Reports & Reconciliation completion and historical import remain separate future work.


## 13. Summary UI and shared import-link enhancement — 20 November 2026

The third Reports & Reconciliation report view, **Summary**, has been implemented from the exact workbook worksheet.

- Verified source: `Copy of TFI - Production Monitoring Sheet 1`, worksheet `Summary`, sheetId `1639151211`.
- Verified structure: 32 columns A:AF, grouped header rows 1–3, formula output begins at row 4, frozen rows 3, grid 1,201 × 32.
- The primary A4 LET formula stacks multiple Product Entry data blocks; Y:AF contain formula-derived rejection percentages. Summary is a calculated report and must not be imported as duplicate transactions.
- Preserved all 32 exact detailed headers and both grouped header levels. Browser checks confirmed both header group rows span exactly 32 columns.
- Added `design/summary-preview.html`, `design/summary.css`, and `design/summary-ui.js`.
- Added Summary route and three report tabs: Production Summary, Schedule Summary, and Summary. The Reports sidebar remains active across all three.
- Added neutral KPI cards, source-field filters, sort indicators, reset, disabled export, wide horizontally scrollable table, formula-source note, empty state, and Admin-only source modal.
- Added a Paste Spreadsheet Link section to the Import Spreadsheet modals on Production Summary and Schedule Summary, and included the same section on Summary.
- Validate Link checks the URL format locally and displays the detected Spreadsheet ID. It does not check permissions or read data. Import remains disabled; no scanning, source fetching, Google Sheets write, or database write was performed.
- Browser tests passed for all 32 headers, group colspans, source metadata, no-mock empty state, invalid/valid link validation on all three report views, modal open/close, sorting, filter reset, three-tab navigation, desktop/mobile layout, and persistent Reports sidebar. Browser errors: 0; failed local asset requests: 0.

The detailed specification is saved as `TFI_SUMMARY_UI_SPEC_v0.1_2026-11-20.md`.

**Priority 3 status update:** Production Summary, Schedule Summary, and Summary UI previews are implemented. **Removed Rows** is the remaining report view. Full Reports & Reconciliation completion and historical import remain separate future work.


## 14. Removed Rows UI preview implementation — 20 November 2026

The fourth Reports & Reconciliation report view, **Removed Rows**, is now implemented from the official 35-tab workbook and the exact Removed Rows worksheet.

- Verified official source: `Copy of TFI - Production Monitoring Sheet 1`, worksheet `Removed Rows`, sheetId `1842536867`.
- Verified structure: source title row 1; exact header row 3; first data row 4; 18 source fields A:R; grid 1,000 × 26; frozen rows 3.
- Preserved the source title and its archive meaning: Pandayan / Others / Finishing overflow rows are kept for reference and not counted in Summary.
- Preserved all 18 exact source headers and their original order: Date; Removed because; Old Product Code (text); No. of Batches; Target; Produced; UOM; Plan Start; Actual Start; Plan End; Actual End (Prod); Actual End (Cleaning); Man Reqmt; Present; OT Hrs; Remarks; Source Tab; Check.
- Added `design/removed-rows-preview.html`, `design/removed-rows.css`, and `design/removed-rows-ui.js`.
- Added the Removed Rows route to the shared router. Production Summary, Schedule Summary, Summary, and Removed Rows now expose four report-view tabs; the Reports sidebar remains active across all four.
- Added neutral KPI cards, date/reason/old-code/source-tab/global filters, sort indicators, reset, pagination state, disabled export, a horizontally scrollable 18-column archive register, and an archive-treatment note.
- Added an Admin-only Import Spreadsheet modal with Paste Spreadsheet Link and local URL-format validation. The detected Spreadsheet ID is displayed when the URL format is valid. This does not verify access or read source data; Import remains disabled.
- The preview contains zero copied historical archive records and offers no Restore or Delete action. Removal reason, old product code as text, Source Tab, and Check are preserved as source fields for future approved reconciliation.
- Browser tests confirmed exact 18-column parity, source metadata, no-mock empty state, invalid/valid link validation, modal open/close, sort, filter/reset, four-tab navigation, Summary → Removed Rows navigation, desktop/mobile layout, table-contained horizontal scrolling, and no page-level mobile overflow. Browser errors: 0; failed non-aborted local asset requests: 0.
- No source spreadsheet cells/formulas, archived rows, active production records, Supabase tables, or database records were changed.

The detailed specification is saved as `TFI_REMOVED_ROWS_UI_SPEC_v0.1_2026-11-20.md`.

**Priority 3 status update:** Production Summary, Schedule Summary, Summary, and Removed Rows UI previews are now implemented. The Reports & Reconciliation UI view set is complete. Live source connection, role enforcement, scanning, import authorization, archive restoration, and historical database transfer remain separate future work.


## 15. Yield Monitoring mobile-header verification — 20 November 2026

The existing Yield Monitoring preview was reopened through the shared Dashboard route. It was not rebuilt or duplicated.

- Confirmed exact official source contract: Yield Log sheetId 743111542, Yield Map sheetId 854969610, Product Entry sheetId 545274882.
- Confirmed all 12 Yield Log headers A:L and all 39 Yield Map family options.
- Confirmed the page remains read-only and derived, with zero historical/mock records and disabled CSV export.
- Corrected the narrow-screen breadcrumb/profile overlap in `design/yield-monitoring.css`; retained `.pre-yield-mobile-topbar-20261120.bak`.
- Re-ran browser checks for source metadata, exact headers, filters, sort, reset, empty state, disabled export, shared sidebar route, mobile source-card stacking, table-contained horizontal scrolling, no page overflow, and no header overlap.
- All checks passed. Browser page errors: 0; failed non-aborted local asset requests: 0.
- Opened the Yield Monitoring route in Chrome.
- No Google Sheets cells, Yield Log rows, Product Entry records, Yield Map references, Supabase tables, or live database records were changed.

**Status:** Yield Monitoring UI remains complete as a source-aligned, read-only derived view. It is not an additional operational transaction module.


## 16. Master Data full source-reference UI — 20 November 2026

The Master Data preview was rebuilt from a read-only value snapshot of the official 35-tab workbook. All nine categories now render their source-derived rows or reference groups instead of the earlier partial sample tables.

- Product Standard and Specificat — A1:U110, sheetId 2138697021; 58 variants, **26 family headers**, 25 reserved slots.
- Code Map — A1:B72, sheetId 2098561343; 68 mappings with 32 matched and 36 unmatched against Product Standard. Reverse unmatched Product Standard variants: 26.
- Yield Map — A1:W43, sheetId 854969610; 39 families; B:M inputs and P:W helper outputs are differentiated.
- Entry Map — A1:E43, sheetId 1628314566; 39 populated mappings, read-only.
- KPI Setup — A1:T129, sheetId 1955006742; 127 product codes plus All, shown as ten source reference groups.
- DPR LEGEND — A1:AN119, sheetId 508797580; B:F independent lists, G:H helper outputs, I:AN 32 product-family code columns; 116 unique codes.
- DMP LEGEND — A1:D70, sheetId 1070169465; 69 rows and ten source notes marking resigned/AWOL retained separately from worker-name values.
- MANPOWER — A1:E448, sheetId 583741906; 445 source rows and 430 distinct employee names; repeated rows retained.
- Schedule Lists — A1:L101, sheetId 156467196; 100 production-code rows, four reference lists, and K:L Product Standard field mapping.

### Product Standard count reconciliation

A fresh direct read of the official source range A1:U110 found 26 rows with the group marker in column A, 58 populated product-code rows, and 25 reserved new-variant rows. The earlier 24-family count in the first audit draft was stale and is superseded by the direct source read. The three row types account for all 109 rows below the header.

### UI and import boundary

- Added full source-reference tables/cards, source-row trace labels, category-specific filters, pagination, DPR LEGEND and Schedule Lists subviews, and source metadata (workbook, worksheet, sheetId, range).
- Added Admin-only Import Spreadsheet modal with Paste Spreadsheet Link and URL/source-ID validation. Import remains disabled and no spreadsheet data is imported.
- Preview edits remain in browser memory only. No source workbook cells, formulas, notes, validation rules, Supabase tables, records or permissions were changed.
- The UI displays Admin Only, but backend authorization remains pending.
- Detailed specification: `TFI_MASTER_DATA_UI_SPEC_v0.2_2026-11-20.md`.

**Browser verification:** All nine category checks and interactions passed; zero browser errors and zero failed non-aborted local asset requests.


## 17. Selective Spreadsheet Import UI — 20 November 2026

The Spreadsheet Import Center now requires one operational destination module before the Admin can continue. It exposes 15 source-backed destinations grouped as Production, Monitoring, and Quality & Control.

- One module per import batch; no Import All option.
- The chosen module resolves to its exact official source worksheet and verified sheetId.
- Only that mapped worksheet is the intended scan scope; all other workbook tabs are excluded from that batch.
- Reports & Reconciliation, report/history outputs, Master Data, reference/configuration tabs, dashboard/helper tabs, Yield Log and documentation are excluded from the destination selector.
- The selected module and source worksheet metadata carry through Scan Progress and Central Import Inbox.
- Browser verification passed for all 15 mappings, required selection, workflow navigation, DMR Production example, and mobile layout.

Detailed specification: `TFI_SELECTIVE_IMPORT_UI_SPEC_v0.2_2026-11-20.md`.

The UI is complete for this selection flow. The actual scanner must still enforce the worksheet scope server-side; scan/import backend and authorization remain pending.

## 18. Audit Trail UI acceptance verification — 20 November 2026

The existing Audit Trail screen was verified and refined; it was not rebuilt as a second page.

- Corrected the metric label to Matching events.
- Expanded the module filter to 36 source-aligned module/category choices.
- Added accessible activity tabs and keyboard navigation.
- Improved combined global/local search term matching.
- Removed the misleading static page-one control from the no-events state.
- Retained the no-mock empty state, neutral metrics, read-only activity details, and disabled CSV export until verified audit events exist.
- Verified Audit Trail → Users & Access → Audit Trail navigation through the shared router.
- Tested the details modal with a temporary browser-only fixture, then cleared it; no fixture was saved to the preview or data files.
- Verified mobile table-contained horizontal scrolling with no page-level horizontal overflow.
- Browser acceptance and interaction tests passed with no page errors, console errors, or failed local asset requests.

Artifacts:
- `design/audit-trail-preview.html`
- `design/audit-trail-preview.html.pre-audit-acceptance-20261120.bak`
- `design/test-audit-trail-acceptance.js`
- `design/test-audit-trail-interactions.js`
- `design/audit-trail-acceptance-desktop.png`
- `docs/blueprints/TFI_AUDIT_TRAIL_UI_SPEC_v0.1_2026-11-18.md` (Section 9)

**Status:** Audit Trail UI acceptance passed. Live audit capture, immutable database storage, server-side authorization, and production export permissions remain pending backend/security implementation. No source workbook, operational record, Supabase table, or live audit data was modified.

## 19. Users & Access UI acceptance verification — 20 November 2026

The existing Users & Access screen was verified and refined against TFI_USERS_ACCESS_UI_SPEC_v0.1.

- Removed the stale static pagination control; paging is not implemented in this preview.
- Added accessible User Accounts / Roles & Permissions tabs with keyboard navigation and selected states.
- Converted account-status filters to an accessible pressed-state group.
- Corrected multi-term search so terms from the local and global search fields match independently; CSV export uses the same filter logic.
- Preserved the empty account and role-template state after mock-data cleanup.
- Prevented saving a permission matrix when no draft role is selected.
- Added a preview-session-only permission snapshot confirmation and explicit no-live-access boundary.
- Corrected Last sign-in display to Not recorded for accounts without an authentication event.
- Verified duplicate account and role checks, user edit/status actions, filters, CSV output, draft role creation, permission matrix, mobile layout, and shared-shell navigation.
- The draft permission matrix has 15 module/area rows and seven permission actions (View, Create, Edit, Review, Approve, Export, Manage access).
- Browser acceptance passed with no page errors, console errors, or failed local asset requests. Test accounts and roles existed only in temporary browser memory and were discarded when the browser closed.
- Clean-state screenshots were saved for desktop User Accounts, desktop Roles & Permissions, and mobile User Accounts.
- No identity provider, authentication service, live user directory, Supabase table, account, role, or permission was created or changed.

Artifacts:
- design/users-access-preview.html
- design/users-access-preview.html.pre-users-access-acceptance-20261120.bak
- design/test-users-access-acceptance.js
- design/capture-users-access-clean.js
- design/users-access-verified-empty-desktop.png
- design/users-access-roles-empty-desktop.png
- design/users-access-verified-empty-mobile.png
- docs/blueprints/TFI_USERS_ACCESS_UI_SPEC_v0.1_2026-11-18.md (Section 10)
- docs/blueprints/TFI_USERS_ACCESS_UI_ACCEPTANCE_v0.1_2026-11-20.md

**Status:** Users & Access UI acceptance passed. Final role catalogue and permission boundaries remain subject to client approval. Authentication, invitation delivery, server-side authorization, session revocation, and immutable audit-event generation remain backend/security requirements.
