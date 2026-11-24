# TFI Product Entry UI Specification — v0.3

**Date:** 19 November 2026  
**Project:** TFI_NEW  
**Status:** Current implementation baseline; supersedes v0.2 for shell, scrolling, navigation, and visual refinement.

## 1. Source workbook

- Workbook: Copy of TFI - Production Monitoring Sheet 1
- Spreadsheet ID: 1rCbQ16wj7MRjQCFF3tA-WEMkudraJK0RkwcqayUlz7k
- Source tab: Product Entry
- Supporting tabs: Entry Map and DPR LEGEND
- Source dimensions: 39,160 rows × 164 columns (A:FH)
- The source workbook remains read-only during UI prototyping.

## 2. Source fidelity retained

- 39 product-family mappings from Entry Map.
- Product-specific group headers, subgroup headers, column labels, hidden columns, formulas, validation rules, and source fills.
- Selected reference product: Maharlika LM / BLK_38 / Maharlika Luncheon Meat.
- Data begins at source row 37156 for BLK_38.
- No sample or mock transaction rows are inserted.
- Dropdown options remain source-backed.
- Formula-derived cells remain read-only and visually blank until their inputs are populated.

## 3. Visual refinement

The Product Entry screen retains its existing spreadsheet-style format and source color hierarchy. Refinements are limited to:
- consistent Tosen Foods company shell and branding;
- shared desktop sidebar width and navigation spacing;
- consistent topbar height and typography;
- refined spacing, borders, subtle shadows, and focus/hover states;
- no change to field names, column order, product selector behavior, or source workflow.

## 4. Shared shell

- Shared stylesheet: design/tfi-shell-standard.css
- Shared navigation router: design/tfi-preview-router.js
- Desktop sidebar: 258px.
- Compact sidebar: 76px at viewport widths ≤900px.
- Desktop topbar: 74px.
- Main page uses the document's vertical scrollbar.
- Product Entry table uses horizontal scrolling only; it does not create a second vertical scrollbar.
- A synchronized floating copy of the three-row table header remains visible while scrolling through the table and follows the table's horizontal scroll position.
- The first six identity columns remain frozen in the table body.

## 5. Navigation

- Existing preview pages are directly connected through the shared router.
- Sidebar modules whose source-matched screens are not yet designed open a neutral module placeholder page.
- Placeholder pages identify the selected module and state that its source worksheet must be reviewed before its UI is built.
- No fake transactions, sample KPIs, or invented activity are shown.

## 6. Files

- design/product-entry-preview.html
- design/product-entry-data.js
- design/product-entry-options.js
- design/product-entry-preview.png
- design/tfi-shell-standard.css
- design/tfi-preview-router.js
- design/module-placeholder-preview.html

## 7. Verification

- Product selector: all 39 product mappings are present.
- BLK_38: actual header labels, hidden columns, formula columns, and dropdown options render.
- Product switching: BLK_38 to BLK_01 verified; correct title, first data row, formula column, and product-code dropdown load.
- All initial transaction inputs and dropdowns are blank.
- Table wrapper: horizontal overflow is auto; vertical overflow is clip.
- Page document owns vertical scrolling.
- Floating header: appears after the original header scrolls above the topbar and mirrors the table's horizontal scroll position.
- Navigation: Product Entry → Dashboard, Dashboard → Product Entry, and Product Entry → Production Schedule placeholder verified.
- Shared desktop shell: 258px sidebar and 74px topbar verified across all existing preview pages.
- Responsive shell: 258px sidebar at 1366px and 1024px; 76px at 800px.
- The original Google Spreadsheet was not modified.

## 8. Next work

Continue one module at a time. Inspect the matching source worksheet before designing the next screen. Keep the shared shell and navigation; do not copy Product Entry's table schema into other modules.
