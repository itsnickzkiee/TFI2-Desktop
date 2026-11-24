# TFI_NEW - NON-PROD UI Specification v0.1

**Date:** 19 November 2026  
**Project folder:** `C:\Users\Rominick\Desktop\TFI_NEW`  
**Source workbook:** Copy of TFI_-_DPR___DMR_2026_KPI_Dashboard_v2  
**Spreadsheet ID:** `1BzmYYCXRxOrseQK9VlXzucbri_Sv8A2NxHgZskWeJps`  
**Source worksheet:** `NON-PROD`  
**Source sheetId:** `593515400`  
**Reference worksheet:** `MANPOWER`  
**UI status:** Preview implemented; no backend writes

## 1. Source worksheet structure

The `NON-PROD` worksheet has a 1,000-row by 26-column grid, with two frozen header rows. Its operational fields occupy columns A:J.

| Source column | Group heading | Exact field label | Input behavior |
|---|---|---|---|
| A | DATE | DATE | Manual date |
| B | MANPOWER | Name | Strict dropdown from MANPOWER!A4:A500 |
| C | MANPOWER | Position | Strict dropdown from MANPOWER!B4:B16 |
| D | TIME | Time Start | Manual time |
| E | TIME | Time End | Manual time |
| F | TIME | Total of minutes | Manual numeric entry |
| G | TIME | No. of Working Hours | Formula output; read-only |
| H | Activities | Activities | Strict dropdown from MANPOWER!C4:C60 |
| I | Location | Location | Strict dropdown from MANPOWER!D4:D39 |
| J | Remarks | Remarks | Free text; no validation observed |

The source's grouped header spans are:
- DATE: A (rowspan 2)
- MANPOWER: B:C
- TIME: D:G
- Activities: H (rowspan 2)
- Location: I (rowspan 2)
- Remarks: J (rowspan 2)

## 2. Formula and manual-entry behavior

- Column F, `Total of minutes`, is manually entered. The source does not derive it from Time Start and Time End.
- Column G, `No. of Working Hours`, uses the source formula `=F3/60`, filled through row 668.
- The UI makes column G read-only and calculates the same formula from the entered minutes.
- When F is blank, the UI keeps G blank. If a numeric value is entered, G is displayed to two decimal places.
- No additional calculation for elapsed time, breaks, or overtime is invented.

## 3. Source dropdowns

The source validation rules are strict dropdowns linked to MANPOWER ranges:

| Field | Source range | Nonblank option entries |
|---|---|---:|
| Name | MANPOWER!A4:A500 | 445 |
| Position | MANPOWER!B4:B16 | 8 |
| Activities | MANPOWER!C4:C60 | 48 |
| Location | MANPOWER!D4:D39 | 36 |

The Name list contains 15 duplicate entries in the source range. The UI preserves source order and duplicates rather than silently deduplicating the reference list. These are master-data dropdown choices only; no historical NON-PROD transaction rows are loaded.

## 4. Source row availability

- Existing source transactions: rows 3:22 (20 rows).
- Blank source entry rows with the working-hours formula: rows 23:668 (646 rows).
- Dropdown validation ranges continue through row 1,000.
- The preview starts with 12 blank rows mapped to source rows 23:34.
- **Add 12 Rows** adds further blank source rows, up to the 646-row source blank-row capacity.
- Historical source rows 3:22 are not copied into the preview.

## 5. UI files created

- `design/non-prod-preview.html`
- `design/non-prod.css`
- `design/non-prod-data.js`
- `design/non-prod-ui.js`
- `design/non-prod-preview.png`
- `design/non-prod-viewport.png`
- `design/non-prod-mobile.png`

### UI behavior

- Uses the shared TFI application shell, logo, sidebar, topbar, and shared router.
- Reproduces the source A:J column order and two-row grouped headers.
- Uses source-backed MANPOWER dropdown options.
- Shows blank entry rows only; no sample or historical transactions.
- Supports adding 12 blank rows, clearing current preview entries, and calculating working hours from Total of minutes.
- Save action explicitly reports that backend saving is not connected and no data was saved.
- No Google Sheet writes, database writes, or data transfer were performed.

## 6. Verification

### Direct Chrome preview
- Local preview returned HTTP 200.
- All 10 source fields and the grouped header spans were rendered.
- Initial table contains 12 blank rows.
- Dropdown options per row: 445 names, 8 positions, 48 activities, 36 locations.
- Formula output is blank while Total of minutes is blank.
- Entering 600 minutes produces 10.00 working hours.
- Add 12 Rows expands the table to 24 rows and maps them to source rows 23:46.
- Clear Form empties the current preview rows and resets the derived hours.
- Save action displays the preview-only notice; no data is saved.
- No JavaScript errors or failed requests were reported.

### Shared sidebar navigation
- DMR Production -> NON-PROD loaded the correct embedded module.
- NON-PROD -> CO QA loaded the correct embedded module.
- Exactly one module frame was visible after each successful swap.
- The parent sidebar remained mounted and retained its 190px scroll position.
- No JavaScript errors were reported.

### Mobile viewport
- Tested at 390 x 844.
- Compact sidebar rendered at 76px.
- Main content remained within the 390px viewport.
- The source table scrolls horizontally within its own container; it does not force horizontal overflow on the page.
- Twelve blank rows and the Add Rows control remained available.
- No JavaScript errors were reported.

## 7. Next UI

**PR Monitoring** is the next missing source-backed operational screen. Inspect its exact source worksheet before designing its UI. Keep historical records out of the preview and do not start data transfer or backend writes during UI design.
