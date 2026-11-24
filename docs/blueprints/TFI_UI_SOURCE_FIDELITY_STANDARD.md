# TFI UI Source-Fidelity Standard

**Effective date:** 18 November 2026  
**Project:** TFI_NEW  
**Status:** Required for all module UI work

## 1. Source of truth

The user's Google Spreadsheet, **Copy of TFI - Production Monitoring Sheet 1**, is the source of truth for production and monitoring module interfaces. Its URL/ID is retained in the project configuration. The source workbook is read-only during UI design unless the user separately authorizes a spreadsheet edit.

## 2. Required UI approach

Every web module must be a faithful web implementation of its corresponding source worksheet. Do not replace the worksheet's workflow with a generic dashboard or a newly invented form design.

For each module, reproduce the source worksheet's:
- visible title and section bands;
- exact field labels, spelling, capitalization, and left-to-right order;
- grouped and nested headers, including merged-header spans;
- product-specific or category-specific column layouts;
- hidden columns and their conditional visibility rules;
- frozen identity columns and sticky header behavior where applicable;
- dropdowns, validation-backed fields, and actual option lists;
- formula-derived and read-only cells;
- visual hierarchy, colors, borders, and cell density as closely as practical.

The application shell/navigation may remain consistent across TFI, but the body of each module must follow its source tab.

## 3. No mock data — mandatory

- Do not seed tables with sample, demo, fabricated, or illustrative records.
- Do not insert example names, dates, product codes, quantities, output, yields, downtime, manpower, or statuses into data rows.
- Initial data tables must contain blank entry rows only when the source worksheet provides blank entry rows.
- Do not add fake historical records, fake recent activity, fake KPI values, or fake record counts.
- Do not show sample values as placeholders inside cells. Blank source cells must render blank.
- Real dropdown choices from source master-data tabs are allowed; they are reference options, not mock transaction rows.
- If a value depends on a future backend connection, show a neutral blank/dash state rather than inventing a value.
- Formula-driven cells must be read-only and should remain visually blank while their source inputs are blank. Do not display artificial zeroes or formula errors as sample output.

## 4. Source inspection before coding

Before implementing a module, inspect the exact workbook tab and record:
1. workbook and tab names/IDs;
2. used range, grid dimensions, frozen rows and columns;
3. header rows and grouped headings;
4. data-row start and available blank rows;
5. dropdown validation rules and their source ranges;
6. formula columns and formulas from a representative data row;
7. product/category-specific hidden columns or block mappings;
8. cell fills and formatting that distinguish input and calculated cells.

Do not infer a common schema where the workbook uses different schemas by product, block, line, or date.

## 5. Backend readiness

- Preserve source tab terminology and column order in the UI and in the future data mapping.
- Keep input fields separate from calculated/read-only fields.
- Retain the exact source-column letter and block-row mapping in the module configuration.
- Do not rename or normalize source fields without the user's explicit approval.
- Do not connect a preview control to live writes until the backend contract is approved.
- Keep the source spreadsheet unchanged during UI prototyping.

## 6. Acceptance checks for every module

A module UI is not accepted until:
- its labels and order are checked against the source worksheet;
- the relevant product/category selection changes the correct headings and visible columns;
- dropdowns use source-backed options;
- formula cells are not editable;
- all transaction rows are empty unless real backend data has been deliberately connected;
- no fake data or mock KPIs appear;
- the preview renders and its interactions are tested.

## 7. Current implementation order

Build and review one source-aligned module at a time. Product Entry is the first reference implementation. The next modules must follow their own actual worksheet tabs, not copy a generic layout from Product Entry.


## 8. Shared application shell and navigation

All preview pages use the shared design/tfi-shell-standard.css and design/tfi-preview-router.js files.

- Desktop sidebar width: 258px across all pages.
- Compact sidebar width: 76px at viewport widths of 900px and below.
- Standard topbar height: 74px on desktop; 62px on small mobile widths.
- Sidebar logo panel, navigation row height, spacing, and typography use one shared standard.
- The main document owns vertical scrolling. Product Entry's table owns horizontal scrolling only.
- Product Entry keeps its spreadsheet header visible during page scrolling using a synchronized floating header; the table's horizontal position is mirrored in that header.
- The shared navigation router handles every sidebar item. Existing preview pages open their corresponding HTML file. Modules whose source-matched UI has not yet been built open module-placeholder-preview.html with the selected module name. The placeholder contains no transaction rows or fabricated data.

Do not create page-specific sidebar widths, breakpoints, nav spacing, or independent navigation handlers that conflict with the shared files. If the shell changes, update the shared stylesheet/router rather than making one-off page changes.


## 9. Product Entry row numbering and Production Entry

- Product Entry display row numbers begin at 1 for every selected product block. The original source row is preserved in each table row's data-source-row attribute; never use the visible display number as a spreadsheet row address.
- Production Entry is based on the exact Production Entry worksheet, source range A1:W19, with 23 visible data fields and 12 template rows (source rows 8–19).
- Production Entry template line assignments are four Agri rows (8–11), four Meat rows (12–15), and four Finishing rows (16–19).
- Production Entry product names come from DPR LEGEND!I2:AN2. Product-specific code choices come from the corresponding product columns in DPR LEGEND!I3:AN100. UOM options are can, case, batch, ton, and kg.
- The source Production Entry Product Code validation currently references DPR LEGEND!AP1, but the source sheet's declared grid ends at column AN. The preview therefore uses the underlying product-specific code lists in I3:AN100 and does not alter the source workbook.
- Production Entry derived fields follow the source formulas: % Attainment = Produced / Target when Target > 0; Absent = Man Reqmt - Present; % Attendance = Present / Man Reqmt when Man Reqmt > 0; Has data checks columns C, D, F, G, O, P, S, and T.
- Production Entry's source snapshot summary is 893 saved rows, 140 days saved, and last saved 29-Oct-26. The preview labels these as snapshot values, not live-synced metrics.
- Production Entry's 12 template rows contain no prefilled product names, product codes, batch quantities, target/produced quantities, time entries, manpower entries, OT hours, remarks, or trace records. The line labels are source template defaults, not mock transactions.
- Production Entry display row numbers begin at 1; each row retains its original source row (8–19) in the data-source-row attribute.
- The Save action in the preview must never claim to save. Until the backend connection is implemented, it must state clearly that saving to Production Summary is not connected and no data was saved.
- Production Entry is linked through the shared navigation router and uses the same shared shell and scroll behavior as Product Entry.


## 10. NON-PROD source mapping (verified 19 November 2026)

- Source worksheet: `NON-PROD`, sheetId `593515400`; grid 1,000 rows x 26 columns; two frozen header rows; operational fields A:J.
- Header groups: DATE A; MANPOWER B:C; TIME D:G; Activities H; Location I; Remarks J.
- Input fields: A Date; B Name; C Position; D Time Start; E Time End; F Total of minutes; H Activities; I Location; J Remarks.
- Formula field: G No. of Working Hours = `=F3/60`, filled through row 668. F is manually entered; do not calculate it from the time fields.
- Strict dropdowns: B from MANPOWER!A4:A500; C from MANPOWER!B4:B16; H from MANPOWER!C4:C60; I from MANPOWER!D4:D39.
- Historical records are in rows 3:22. Blank entry rows with formula output are 23:668. Dropdown validation continues through row 1,000.
- UI preview must not preload the 20 historical records. Real master-data dropdown choices are permitted; retain source order and duplicate options.
- Saving remains disconnected until the backend contract is approved.


## Official reference workbook update — 20 November 2026

Use `Copy of TFI - Production Monitoring Sheet 1` (spreadsheet ID `1rCbQ16wj7MRjQCFF3tA-WEMkudraJK0RkwcqayUlz7k`, 35 worksheets) as the current source baseline for TFI_NEW. The former 28-tab workbook ID `1BzmYYCXRxOrseQK9VlXzucbri_Sv8A2NxHgZskWeJps` is legacy comparison only. Before treating any UI as source-ready, confirm its exact tab title, sheetId, source columns, formulas, validation ranges, row typing, and current workbook ID against `TFI_35_TAB_SOURCE_TO_UI_AUDIT_v0.1_2026-11-20.md`. This update changes documentation only; it does not modify UI code or the source spreadsheet.


## 35-tab multi-module revalidation — 20 November 2026

Use TFI_8_MODULE_SOURCE_ALIGNMENT_VALIDATION_v0.2_2026-11-20.md as the current consolidated validation record for DMR Coding, Coding DPR, NON-PROD, CO QA, OEE, Productivity, Yield Monitoring, and Master Data. All seven active data files were verified against the official workbook ID and their current sheetIds. Historical data remains unloaded in preview forms, and no live database or source workbook writes were performed.

Important preservation rules confirmed by this pass:
- Do not discard or silently correct historical codes that are absent from current master dropdowns. Preserve raw source values and flag them for Admin review.
- Do not import formula-derived sheets such as Yield Log as independent production transactions.
- Preserve source formulas even when their logic needs business-owner review; do not silently change the Productivity target-output divisor or Coding DPR batch-7 total behavior.
- Keep CO QA Y:AD manual cost fields distinct from formula outputs and unresolved AI:AL columns until the business owner approves their handling.
- Preserve the 36 Code Map / Product Standard unmatched codes and the 26 reverse unmatched Product Standard codes until an explicit reconciliation decision is approved.
