# TFI_NEW — Summary UI Specification v0.1

**Date:** 20 November 2026  
**Project:** TFI_NEW  
**Module:** Reports & Reconciliation  
**Report view:** Summary  
**Status:** UI preview implemented; source-aligned; browser-tested; backend source connection/import not started

## 1. Verified source identity

- Official workbook: `Copy of TFI - Production Monitoring Sheet 1`
- Spreadsheet ID: `1rCbQ16wj7MRjQCFF3tA-WEMkudraJK0RkwcqayUlz7k`
- Exact worksheet: `Summary`
- Verified sheetId: `1639151211`
- Grid dimensions: 1,201 rows × 32 columns
- Source columns: A:AF
- Header rows: 1–3
- First formula output row: 4
- Frozen rows: 3
- Workbook contains 35 visible worksheets.

## 2. Source structure and exact columns

The Summary worksheet uses three header rows. Preserve the grouped headings and all 32 detailed source fields in their original order.

| Column | Exact source header |
|---|---|
| A | Date produce |
| B | Product code |
| C | Can Size |
| D | PR# |
| E | No. of Batches |
| F | Total FG |
| G | Dented |
| H | False seam |
| I | Flipper |
| J | Bulged |
| K | Panel |
| L | Buckling |
| M | Retention |
| N | Q.A Samples |
| O | Dented/ Curl |
| P | Teardown |
| Q | From Underweight |
| R | Rusty |
| S | Teardown |
| T | Dented from seamer |
| U | Dented from filler |
| V | Underweight |
| W | Dented flange (SD) |
| X | Can wshr/ Palletizer (SD)/ Dented Body/Rusty |
| Y | %Lids Reject |
| Z | % Empty Can Reject |
| AA | %Dented |
| AB | %False seam |
| AC | %Flipper |
| AD | %Bulged |
| AE | %Panel |
| AF | %Buckling |

### Grouped header structure

- Row 1: SUMMARY (A:D); Production Output (E:F); FINISHED GOODS REJECTION (G:L); QUALITY ASSURANCE (M:N); Can and Lids Rejection Breakdown (O:X); % Reject (Y:AF).
- Row 2: Rejected (G:L); Sample (M:N); Can Lids (O:R); Empty Cans (S:X); PM Rejection (Y:Z); FG Rejection (AA:AF).
- Row 3: Exact detailed source headers listed above.

## 3. Formula and source treatment

- The primary output formula in A4 is a LET-based formula that stacks multiple Product Entry data blocks.
- The percentage fields in Y:AF are formula-derived from summary output fields.
- Summary is a calculated report, not a separate operational transaction-entry worksheet.
- The application should derive the Summary view from canonical Product Entry production and quality data rather than import the Summary output as a second set of production transactions.
- Preserve source labels, group headings, column order, and formula-derived semantics. Do not silently rename or reinterpret fields.

## 4. UI composition

- Reports & Reconciliation remains the single active sidebar destination.
- Added three report-view tabs: Production Summary, Schedule Summary, and Summary.
- Summary heading and description identify it as a consolidated formula-derived production and QA report.
- Admin Access Only indicator and dedicated Import Spreadsheet entry point.
- Verified workbook, worksheet, sheetId, 32-column structure, header rows 1–3, and data start row 4.
- Four neutral KPI cards: Summary Records, Total Finished Goods, Production Batches, and QA Samples. Values remain blank/dash until the application source connection is implemented.
- Filters: Date produce, Product code, Can Size, PR#, and Search All Fields.
- Reset Filters and disabled Export CSV.
- Sort indicators for all 32 source columns.
- Three-tier grouped table header preserves the source group/subgroup/detail structure.
- Wide table supports horizontal scrolling inside its own container.
- Empty state explicitly says the Summary source is not connected to this application preview.
- Source-treatment note explains formula derivation from Product Entry.

## 5. Shared Paste Spreadsheet Link section

The Import Spreadsheet modal includes:
- Google Sheets URL input with a clear paste instruction.
- Validate Link action.
- Local URL-format validation for standard Google Sheets links.
- Detected Spreadsheet ID display.
- Inline invalid, pending, and valid status feedback.

Validation is intentionally limited to URL structure. It does not verify Google account access, sheet permissions, worksheet contents, or import eligibility. The Import action remains disabled and labeled **IMPORT NOT CONNECTED**. No backend import, scanning, source read, or database write is performed by this preview.

The same Paste Spreadsheet Link section and local URL-format validation are now included in the Production Summary and Schedule Summary Import Spreadsheet modals. Their import actions also remain disabled.

## 6. No-mock-data and safety rules

- No sample Summary rows are loaded into the application preview.
- No fabricated dates, product codes, PR numbers, output quantities, rejection counts, QA values, or percentages are displayed.
- KPI cards remain neutral until approved source data is connected.
- No Google Sheets writes or cell edits are performed.
- No Supabase/database writes or schema changes are performed.
- Do not import Summary formula output as duplicate production transactions.
- Keep source calculation ownership in canonical Product Entry/quality data and preserve the source formula-derived report behavior.
- The pasted URL is only parsed locally for its Spreadsheet ID; it is not fetched.

## 7. Local implementation files

- `design/summary-preview.html`
- `design/summary.css`
- `design/summary-ui.js`
- `design/reports-reconciliation-preview.html` — added Summary tab and Paste Spreadsheet Link modal section.
- `design/reports-reconciliation-ui.js` — added URL-format validation and Summary navigation.
- `design/schedule-summary-preview.html` — added Summary tab and Paste Spreadsheet Link modal section.
- `design/schedule-summary-ui.js` — added URL-format validation and Summary navigation.
- `design/reports-reconciliation.css` — shared import-link styles and mobile three-tab layout.
- `design/tfi-preview-router.js` — Summary route.
- `design/summary-desktop.png`
- `design/summary-mobile.png`
- `design/summary-import-modal.png`
- `design/production-summary-import-modal.png`
- `design/schedule-summary-import-modal.png`

Backups retained:
- `design/reports-reconciliation-preview.html.pre-summary-tabs-and-link-20261120.bak`
- `design/reports-reconciliation-ui.js.pre-summary-tabs-and-link-20261120.bak`
- `design/schedule-summary-preview.html.pre-summary-tabs-and-link-20261120.bak`
- `design/schedule-summary-ui.js.pre-summary-tabs-and-link-20261120.bak`
- `design/reports-reconciliation.css.pre-summary-link-styles-20261120.bak`
- `design/tfi-preview-router.js.pre-summary-route-20261120.bak`

## 8. Browser verification results

- Summary route resolves from the shared Reports module.
- Reports sidebar remains active on Production Summary, Schedule Summary, and Summary.
- Three-tab navigation is available on all report views.
- Source sheetId verified as `1639151211`; 32 columns A:AF, header rows 1–3, first formula output row 4, frozen rows 3.
- All 32 detailed source headers match exactly.
- Group-header and subgroup-header colspan totals each equal 32.
- Empty-state behavior confirmed; no sample Summary transactions are present.
- Import modal opens and closes.
- Invalid Google Sheets URL is rejected with accessible inline feedback.
- Valid Google Sheets URL format is accepted and its Spreadsheet ID is displayed.
- The import action remains disabled on all three report views.
- Production Summary and Schedule Summary modals both contain the Paste Spreadsheet Link section and pass URL-format validation.
- Sort indicator and filter reset interactions pass.
- Reports tab navigation returns correctly between the three report views.
- Desktop and mobile layouts pass; page-level horizontal overflow is absent.
- Browser errors: 0.
- Failed local asset requests: 0.

**Test status:** Summary and shared import-link UI browser checks passed.

## 9. Remaining Priority 3 UI work

The remaining report view is **Removed Rows**. It must remain a separate archive/exception source, preserving reason and source trace. Do not silently restore removed rows to active operations.

**Current completion boundary:** Production Summary, Schedule Summary, and Summary UI previews are implemented. The full Reports & Reconciliation module is not yet complete. No import authorization, source fetching, or historical data transfer is implied.
