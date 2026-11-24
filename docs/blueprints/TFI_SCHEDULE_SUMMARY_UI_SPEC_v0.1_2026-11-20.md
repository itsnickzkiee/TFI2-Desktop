# TFI_NEW — Schedule Summary UI Specification v0.1

**Date:** 20 November 2026  
**Project:** TFI_NEW  
**Module:** Reports & Reconciliation  
**Report view:** Schedule Summary  
**Status:** UI preview implemented; browser-tested; backend/import integration not started

## 1. Verified source identity

- Official workbook: `Copy of TFI - Production Monitoring Sheet 1`
- Spreadsheet ID: `1rCbQ16wj7MRjQCFF3tA-WEMkudraJK0RkwcqayUlz7k`
- Exact worksheet: `Schedule Summary`
- Verified sheetId: `720094137`
- Header row: 2
- First data row: 3
- Source columns: A:S (19 columns)
- Grid dimensions: 11,000 rows × 26 columns
- Frozen rows: 2
- Upstream operational form: `Production Schedule`
- Upstream sheetId: `1538651320`

The Production Schedule source form states: “ONE FORM PER DAY - fill it, then press SAVE (goes to Schedule Summary).” Schedule Summary is therefore the saved schedule-history destination, not a second operational schedule-entry form.

## 2. Exact source column order

| Column | Exact source header | Treatment |
|---|---|---|
| A | DATE | Source field |
| B | DAY | Source field |
| C | LINE | Source field |
| D | AREA | Source field |
| E | PRODUCT NAME | Source field |
| F | PRODUCTION CODE | Source field |
| G | # OF BATCHES | Source field |
| H | TARGET | Source field |
| I | REVISED TARGET | Source field |
| J | UM | Source field |
| K | QUANTITY (tins/ends) | Source field |
| L | QUANTITY (box) | Source field |
| M | REQUIRED NO. OF PAX | Source field |
| N | PR# | Source field |
| O | REMARKS | Source field |
| P | FC/IDC REF | Source field |
| Q | SHIFT HRS | Source field |
| R | AVAILABLE PAX (day) | Source field |
| S | SAVED ON | Source trace/timestamp |

Preserve all 19 source fields in the exact A:S order. Do not rename, reorder, omit, or reinterpret source headers. The source worksheet has a single header row; it has no separate grouped-header row.

## 3. Source population observation

A bounded read of `Schedule Summary!A3:S1000` returned no populated rows. The preview therefore displays an empty history state and no fabricated schedule lines.

This observation is limited to the inspected source range. It is not a claim that every row in the full 11,000-row grid has been exhaustively scanned.

## 4. UI composition

- Reports & Reconciliation remains the single active sidebar destination.
- Added report-view tabs for Production Summary and Schedule Summary. Both pages can navigate to one another without changing the active Reports sidebar item.
- Schedule Summary heading and description identify it as saved schedule history.
- Admin Access Only indicator and a dedicated Import Spreadsheet entry point.
- Verified workbook, worksheet, sheetId, column count, header row and upstream-form metadata.
- Four neutral summary cards: Saved Schedule Lines, Schedule Days, Target Quantity, and Required Manpower. Values remain blank/dash until approved application records are connected.
- Filters: From Date, To Date, Day, Line, Area, Product Name, Production Code, PR#, and Search All Fields.
- Reset Filters and Export CSV controls. Export remains disabled until approved records are connected.
- Sort indicators on all 19 source columns.
- Wide table preserves the exact 19-column source order and supports horizontal scrolling.
- Empty state states that no saved schedule history is imported.
- Source-treatment note explains the Production Schedule → Schedule Summary relationship.

## 5. Import entry point and access boundary

The Admin-only Import Spreadsheet entry point opens a source-identification modal showing:
- Official workbook name and spreadsheet ID.
- Schedule Summary worksheet and sheetId.
- Header row 2, first data row 3, and source columns A:S.
- Upstream Production Schedule sheet and sheetId.
- Inspected source range A3:S1000 and the absence of populated rows in that inspected range.

The import action is disabled. File upload, scanning, validation, and database import are not connected in this UI preview.

The Admin Access Only label/button placement is a UI design indication only. Actual role authorization must later be enforced by the authenticated application and backend/database policies; hiding a button in the browser is not a security control.

## 6. No-mock-data and safety rules

- No historical schedule lines are preloaded.
- No fabricated dates, products, production codes, PR numbers, quantities, or manpower values are displayed.
- KPI cards remain neutral until verified application records exist.
- No Google Sheets writes or cell edits are performed.
- No Supabase/database writes or schema changes are performed.
- No existing schedule records are imported, deleted, overwritten, or normalized.
- Production Schedule remains the daily operational input form; Schedule Summary remains its saved history.
- Do not create a second schedule-entry form from this report page.
- Preserve `SAVED ON` as the source trace field.

## 7. Local implementation files

- `design/schedule-summary-preview.html`
- `design/schedule-summary.css`
- `design/schedule-summary-ui.js`
- `design/reports-reconciliation-preview.html` — Production Summary report tab added.
- `design/reports-reconciliation-ui.js` — report-tab navigation added.
- `design/reports-reconciliation.css` — report-tab styling added.
- `design/tfi-preview-router.js` — Schedule Summary route added and report subviews mapped to the Reports sidebar item.
- `design/schedule-summary-desktop.png`
- `design/schedule-summary-mobile.png`

Backups retained:
- `design/tfi-preview-router.js.pre-schedule-summary-route-20261120.bak`
- `design/reports-reconciliation-preview.html.pre-schedule-tabs-20261120.bak`
- `design/reports-reconciliation-ui.js.pre-schedule-tabs-20261120.bak`
- `design/reports-reconciliation.css.pre-schedule-tabs-20261120.bak`

## 8. Verification results

- Schedule Summary route resolves from the shared Reports module.
- Reports sidebar remains active on both report views.
- Production Summary ↔ Schedule Summary tab navigation passes.
- Source sheetId verified as `720094137`; upstream sheetId verified as `1538651320`.
- All 19 exact source headers are present and match the source order A:S.
- Header row 2 and first data row 3 are represented correctly.
- Empty-state behavior confirmed; no sample schedule rows are present.
- Admin Import Spreadsheet button opens the source-identification modal; modal closes correctly.
- Import action remains disabled and clearly reports that import is not connected.
- Date, day, line, area, product, code, PR and global-search controls are present.
- Sort indicator and reset-filter interactions pass.
- Desktop and mobile layouts pass. The wide table scrolls within its own container; page-level horizontal overflow is absent.
- Browser errors: 0.
- Failed local asset requests: 0.

**Test status:** Schedule Summary UI browser checks passed. Report-subview navigation passed.

## 9. Remaining Priority 3 UI work

Build the next report views in sequence:
1. Summary
2. Removed Rows

Each report view should retain its exact source worksheet identity, source row classification, and Admin-only import-information entry point. Summary is formula-derived and should be rebuilt from canonical Product Entry/QA records rather than imported as duplicate transactions. Removed Rows remains a separate archive/exception source; preserve reason and source trace and do not silently restore rows to active operations.

**Current completion boundary:** Production Summary and Schedule Summary UI previews are implemented. The full Reports & Reconciliation module is not yet complete. No import authorization or historical data transfer is implied.


## 10. Shared Paste Spreadsheet Link enhancement — 20 November 2026

The Schedule Summary Admin-only Import Spreadsheet modal now includes a **Paste Spreadsheet Link** section.

- Google Sheets URL input and Validate Link action.
- Local URL-format validation and detected Spreadsheet ID display.
- Inline feedback for empty, invalid, pending, and valid URL states.
- URL-format validation does not confirm access permissions or read sheet contents.
- Import remains disabled as **IMPORT NOT CONNECTED**.
- No source fetch, scan, Google Sheets write, or database import is performed.

The same section is now present in the Production Summary and Summary import modals. The three report views share the same URL-format validation behavior.

**Priority 3 status update:** Production Summary, Schedule Summary, and Summary UI previews are implemented. Removed Rows is the remaining report view. Full Reports & Reconciliation completion and historical import remain separate future work.
