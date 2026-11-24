# TFI_NEW — Removed Rows UI Specification v0.1

**Date:** 20 November 2026  
**Project:** TFI_NEW  
**Module:** Reports & Reconciliation  
**Report view:** Removed Rows  
**Status:** UI preview implemented; source-aligned; browser-tested; archive connection/import not started

## 1. Verified source identity

- Official workbook: `Copy of TFI - Production Monitoring Sheet 1`
- Spreadsheet ID: `1rCbQ16wj7MRjQCFF3tA-WEMkudraJK0RkwcqayUlz7k`
- Exact worksheet: `Removed Rows`
- Verified sheetId: `1842536867`
- Source title row: row 1
- Column header row: row 3
- First data row: row 4
- Source fields: A:R (18 columns)
- Worksheet grid: 1,000 rows × 26 columns
- Frozen rows: 3

### Source title

`REMOVED ROWS - Pandayan / Others / Finishing overflow (kept for reference, not counted in Summary)`

The source title establishes the archive's role: these rows are retained for reference and are not included in the Summary output.

## 2. Exact source column order

| Column | Exact source header | UI treatment |
|---|---|---|
| A | Date | Date display and range filter |
| B | Removed because | Preserve exact removal reason; text filter |
| C | Old Product Code (text) | Preserve as text; do not normalize or map automatically |
| D | No. of Batches | Numeric display |
| E | Target | Numeric display |
| F | Produced | Numeric display |
| G | UOM | Text display |
| H | Plan Start | Time display |
| I | Actual Start | Time display |
| J | Plan End | Time display |
| K | Actual End (Prod) | Time display |
| L | Actual End (Cleaning) | Time display |
| M | Man Reqmt | Numeric display |
| N | Present | Numeric display |
| O | OT Hrs | Numeric display |
| P | Remarks | Preserve source text |
| Q | Source Tab | Preserve exact source trace value |
| R | Check | Preserve exact source check value |

Preserve all 18 source fields in A:R order. The UI adds no business columns and does not reinterpret the values in Source Tab or Check.

## 3. Archive and reconciliation rules

- Removed Rows is a separate archive/exception source, not an active production-entry screen.
- Preserve the original removal reason and old product code as text.
- Preserve Source Tab and Check for source traceability.
- Keep archived rows excluded from Production Summary and Summary unless an authorized business owner explicitly approves a separate restoration/reconciliation workflow.
- Do not automatically restore, delete, merge, normalize, or rewrite archived records.
- Do not silently discard incomplete archived rows.
- Keep the source workbook unchanged during UI development and import planning.

## 4. UI composition

- Reports & Reconciliation remains the single active sidebar destination.
- Added the fourth report-view tab, Removed Rows, alongside Production Summary, Schedule Summary, and Summary.
- All four report pages expose the same four-tab navigation.
- Removed Rows heading, archive/exception description, and Admin Access Only indicator.
- Admin-only Import Spreadsheet entry point.
- Verified source metadata: official workbook, worksheet, sheetId, 18 fields A:R, title row 1, header row 3, first data row 4.
- Four neutral KPI cards: Archived Rows, Removal Reasons, Old Product Codes, and Source References. Values remain neutral until approved archive data is connected.
- Filters: From Date, To Date, Removed because, Old Product Code, Source Tab, and Search All Fields.
- Reset Filters and Export CSV controls. Export remains disabled while no approved archive records are connected.
- Wide read-only table preserves all 18 source fields in exact A:R order, with horizontal scrolling inside the table container.
- Sort indicators, pagination state, and an empty state are provided.
- Source-treatment note explains that the archive is kept for reference and excluded from Summary.

## 5. Admin Import Spreadsheet entry point

The Removed Rows modal includes:
- Official workbook name and spreadsheet ID.
- Worksheet name and sheetId.
- Title row 1, header row 3, first data row 4.
- Source fields A:R (18 fields), frozen rows 3, grid 1,000 × 26.
- Paste Spreadsheet Link input and Validate Link action.
- Local URL-format validation and detected Spreadsheet ID display.
- Inline feedback for empty, invalid, pending, and valid URL states.

Validation checks URL structure only. It does not verify Google account access, worksheet permissions, source contents, archive eligibility, or duplicate status. The Import action remains disabled as **IMPORT NOT CONNECTED**. No scan, source fetch, historical import, restore, Google Sheets write, or database write is performed by this preview.

Admin Access Only is a UI indication. Actual role authorization must later be enforced by the authenticated application and backend/database policies.

## 6. No-mock-data and safety rules

- The preview contains zero copied historical Removed Rows records.
- No fabricated removal reasons, old product codes, quantities, dates, times, remarks, source references, or check values are displayed.
- KPI values remain neutral until approved archive records are connected.
- No Restore or Delete action is offered in this UI.
- Export remains disabled while the archive has no connected records.
- No Google Sheets cells/formulas, Supabase tables, database records, or historical archive rows were changed.

## 7. Local implementation files

- `design/removed-rows-preview.html`
- `design/removed-rows.css`
- `design/removed-rows-ui.js`
- `design/tfi-preview-router.js` — Removed Rows route added.
- `design/reports-reconciliation-preview.html` — fourth report tab added.
- `design/schedule-summary-preview.html` — fourth report tab added.
- `design/summary-preview.html` — fourth report tab added.
- `design/reports-reconciliation-ui.js` — report tab routing updated.
- `design/schedule-summary-ui.js` — report tab routing updated.
- `design/summary-ui.js` — report tab routing updated.
- `design/reports-reconciliation.css`, `design/schedule-summary.css`, `design/summary.css` — four-tab mobile layout.

Backups were retained beside the modified existing files with the suffix `.pre-removed-rows-20261120.bak`.

## 8. Browser verification results

- Removed Rows route resolves from the shared Reports module.
- Reports sidebar remains active on all four report views.
- All four report pages show four report-view tabs.
- Removed Rows metadata reports sheetId `1842536867`, 18 columns, title row 1, header row 3, first data row 4, and frozen rows 3.
- All 18 displayed headers match the exact source A:R headers and order.
- Empty-state behavior confirmed; zero historical/sample rows are present.
- Import modal opens and closes.
- Invalid Google Sheets URL is rejected with inline feedback.
- Valid Google Sheets URL format is accepted and the correct spreadsheet ID is displayed.
- Import remains disabled.
- Sorting, filter state, reset, and Summary → Removed Rows navigation pass.
- Desktop and mobile layouts pass; the four tabs fit on mobile, the table scrolls within its own container, and page-level horizontal overflow is absent.
- Browser errors: 0.
- Failed non-aborted local asset requests: 0.

**Test status:** Removed Rows UI browser checks passed.

## 9. Priority 3 completion boundary

Production Summary, Schedule Summary, Summary, and Removed Rows UI previews are now implemented under Reports & Reconciliation. The UI work does not imply live source connection, authorization enforcement, scanning, import eligibility, restoration, or historical database transfer. Complete the consolidated source-to-UI and import-readiness review before backend integration.
