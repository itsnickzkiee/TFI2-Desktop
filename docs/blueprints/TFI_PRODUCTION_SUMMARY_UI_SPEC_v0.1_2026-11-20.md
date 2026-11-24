# TFI_NEW — Production Summary UI Specification v0.1

**Date:** 20 November 2026  
**Project:** TFI_NEW  
**Module:** Reports & Reconciliation  
**First report view:** Production Summary  
**Status:** UI preview implemented; browser-tested; backend/import integration not started

## 1. Verified source identity

- Official workbook: `Copy of TFI - Production Monitoring Sheet 1`
- Spreadsheet ID: `1rCbQ16wj7MRjQCFF3tA-WEMkudraJK0RkwcqayUlz7k`
- Exact worksheet: `Production Summary`
- Verified sheetId: `1846667474`
- Source title row: row 1
- Group header row: row 5
- Column header row: row 6
- First saved-run data row: row 7
- Source columns: A:X (24 columns)
- Worksheet grid: 13,188 rows × 26 columns
- Frozen source rows: 6
- Frozen source columns: 3

The worksheet is the saved log of Production Entry. One row represents one saved product run. Production Entry remains the daily operational input form. The report must not create a duplicate saved-run history from the same daily form.

## 2. Exact source column order

| Column | Exact source header | Treatment |
|---|---|---|
| A | Date | Source field |
| B | Line | Source field |
| C | Product Name | Source field |
| D | Product Code | Source field |
| E | No. of Batches | Source field |
| F | Target | Source field |
| G | Produced | Source field |
| H | UOM | Source field |
| I | % Attainment | Formula-derived display; read-only |
| J | Plan Start | Source field |
| K | Actual Start | Source field |
| L | Plan End | Source field |
| M | Actual End (Prod) | Source field |
| N | Actual End (Cleaning) | Source field |
| O | Man Reqmt | Source field |
| P | Present | Source field |
| Q | Absent | Source field |
| R | % Attendance | Formula-derived display; read-only |
| S | OT Hrs | Source field |
| T | Remarks / Reasons (Delay, <95%, Co-run, PD) | Source field |
| U | Saved on | Source trace |
| V | Check | Source trace/helper |
| W | Has data | Source trace/helper |
| X | Day has data | Source trace/helper |

Source group headers in row 5:
- A:D — PRODUCT
- E:I — PRODUCTION (PLAN VS ACTUAL)
- J:N — TIME
- O:S — MANPOWER & OT (1st row of line per day)
- T — REMARKS
- U:X — TRACE

Preserve all 24 source columns in this exact order. Do not silently rename, reorder, or omit the trace fields.

## 3. UI composition

- Reports & Reconciliation navigation destination.
- Production Summary page heading and saved-production-history description.
- Admin Access Only indicator.
- Admin-only Import Spreadsheet entry point.
- Verified workbook/worksheet metadata strip.
- Four neutral summary cards: Logged Production Runs, Days Logged, Average % Attainment, and Last Saved Entry. Each remains blank/dash until approved imported data is connected; no source snapshot counts are presented as live application metrics.
- Filters: From Date, To Date, Line, Product Name, Product Code, and Search All Fields.
- Reset Filters and Export CSV controls. Export remains disabled until approved records are connected.
- Wide source table with exact six group headers and all 24 source columns.
- Horizontal scrolling for the 24-column table; no page-level horizontal overflow on mobile.
- Empty state stating that no production history is imported in the preview.
- Source-treatment note explaining the Production Entry / Production Summary relationship and trace fields.

## 4. Import entry point and access boundary

The Import Spreadsheet button is presented as an Admin-only entry point. It opens an import-information modal identifying:
- The official workbook name and ID.
- Production Summary worksheet and sheetId.
- Header row 6 and source columns A:X.
- Saved production-run history as the record type.

The modal clearly states that file upload, scanning, validation, and database import are not connected in this UI preview. The import action is disabled.

This is a UI/access-design indication only. Actual role authorization must later be enforced by the authenticated application and backend/database policies; hiding a button in the browser is not a security control.

## 5. No-mock-data and safety rules

- No historical production rows are preloaded.
- No fabricated transactions, dates, products, quantities, or KPI values are displayed.
- KPI cards show neutral dashes until verified application records exist.
- No Google Sheets writes or cell edits are performed.
- No Supabase/database writes or schema changes are performed.
- No existing production records are imported, deleted, overwritten, or normalized.
- Production Summary remains a report/history view, not a second operational entry form.
- Formula-derived fields I and R are displayed as read-only/calculated fields.
- Trace/helper fields U:X remain visible and identifiable.

## 6. Local implementation files

- `design/reports-reconciliation-preview.html`
- `design/reports-reconciliation.css`
- `design/reports-reconciliation-ui.js`
- `design/tfi-preview-router.js` — Reports route added.
- `design/dashboard-preview.html` — persistent sidebar label updated to Reports & Reconciliation.
- `design/reports-production-summary-desktop.png`
- `design/reports-production-summary-mobile.png`

Backups retained:
- `design/tfi-preview-router.js.pre-reports-priority3-20261120.bak`
- `design/dashboard-preview.html.pre-reports-priority3-20261120.bak`
- `design/reports-reconciliation-preview.html.pre-ui-polish-20261120.bak`
- `design/reports-reconciliation-ui.js.pre-derived-column-style-20261120.bak`

## 7. Verification results

- Reports route resolves from the existing Reports sidebar item.
- Persistent sidebar label displays Reports & Reconciliation.
- Production Summary source sheetId verified as `1846667474`.
- Six group headers span exactly 24 source columns.
- All 24 exact source column headers are present in the preview.
- Formula-derived headers I and R are visually distinguished.
- Empty-state behavior confirmed; no sample transaction rows are present.
- Admin Import Spreadsheet button opens the modal; modal closes correctly.
- Import action remains disabled and clearly reports that import is not connected.
- Reset filters and sort indicator interactions pass.
- Desktop and mobile layouts pass.
- The 24-column table scrolls horizontally inside its own container; page-level horizontal overflow is absent.
- Browser errors: 0.
- Failed local asset requests: 0.

**Test status:** Production Summary UI browser checks passed. Reports route test passed.

## 8. Remaining Priority 3 UI work

Build the next report views in sequence:
1. Schedule Summary
2. Summary
3. Removed Rows

Each report view must have its own Admin-only Import Spreadsheet entry point and source-specific import-information state. All four report sources should eventually share a centralized import workflow, while preserving distinct source worksheet identity, row classification, and reconciliation rules.

**Current completion boundary:** Production Summary UI preview only. This does not declare the entire Reports & Reconciliation module complete or authorize historical import.


## 9. Shared Paste Spreadsheet Link enhancement — 20 November 2026

The Production Summary Admin-only Import Spreadsheet modal now includes a **Paste Spreadsheet Link** section.

- Google Sheets URL input and Validate Link action.
- Local URL-format validation and detected Spreadsheet ID display.
- Inline feedback for empty, invalid, pending, and valid URL states.
- The UI clearly states that URL-format validation does not confirm access permissions or read sheet contents.
- Import remains disabled as **IMPORT NOT CONNECTED**.
- No source fetch, scan, Google Sheets write, or database import is performed.

The same section is now present in the Schedule Summary and Summary import modals. The three report views share the same URL-format validation behavior.

**Priority 3 status update:** Production Summary, Schedule Summary, and Summary UI previews are implemented. Removed Rows is the remaining report view. Full Reports & Reconciliation completion and historical import remain separate future work.
