# TFI New System — PR Monitoring UI Specification v0.1

**Date:** 20 November 2026  
**Project:** TFI_NEW  
**Status:** UI preview implemented; backend contract not connected  
**Source workbook:** Copy of TFI - Production Monitoring Sheet 1  
**Source worksheet:** PR MONITORING

## 1. Source identity and worksheet structure
- Spreadsheet ID: 1rCbQ16wj7MRjQCFF3tA-WEMkudraJK0RkwcqayUlz7k.
- Worksheet ID: 867256143; grid metadata: 1,000 rows × 27 columns.
- Source columns used by the register: A:G (7 columns).
- Source title in A1: TOSEN FOODS INC. 2025 -  PR MONITORING.
- Summary formulas and values: row 2.
- Header row: 3; the A3 header is blank, while B:G contain the visible source labels.
- First source data row: 4; frozen rows: 3; frozen columns: 0.
- Column A contains product/group labels and product-total labels. Do not silently rename its blank source header.
- Column G contains the status formula. D, E and F are stored source values; the UI must not recompute F from D and E.

## 2. Exact source columns
| Column | Exact source label | UI key | Type |
|---|---|---|---|
| A | (blank source header) | column_a | Text / product-group label |
| B | PR No. | pr_no | Text; preserve leading zeros |
| C | Date PR Recieved | date_pr_received | Date |
| D | PR Required Quantity (tins) | pr_required_quantity_tins | Stored number |
| E | Production Produced (tins) | production_produced_tins | Stored number |
| F | For Production Quantity (tins) | for_production_quantity_tins | Stored number |
| G | Status | status | Formula-derived, read-only |

## 3. Source summary row 2
- A2 label "Total Tins To Produce:"; B2 formula =SUM(D4:D1002); displayed source snapshot 16,182,629.
- C2 label "Total Tins Produced:"; D2 formula =SUM(E4:E1002); displayed source snapshot 15,648,348.
- E2 label "Completion:"; F2 formula =D2/B2; displayed source snapshot 96.70%.
- These are shown as source snapshot values, explicitly not live database metrics. The preview does not recalculate or modify the source formulas.

## 4. Status formula and classifications

- Observed status formula in G4: =if(D4="","",if(F4>0,"Pending for Production",if(F4=0,"Complete","Over Produce"))).
- Exact status values: Pending for Production, Complete, Over Produce.
- The formula is preserved as a source-derived read-only value. The UI does not calculate or edit status.
- Audited source-row classification: 78 populated rows; 64 rows with a PR No.; 12 product-total/group rows (source rows 6, 11, 15, 19, 25, 34, 41, 45, 57, 65, 71, 77); row 4 is a zero-value template row; row 79 is an incomplete PR candidate with date/quantities but no PR No.
- The PR register must not treat group totals as individual PR transactions. Keep incomplete candidates traceable for review; do not silently discard or auto-complete missing identity fields.

## 5. UI behavior
- Read-only view. No Add, Edit, Save, Submit, or manual transaction-entry actions.
- Filters: Date PR Recieved range, PR No. search, exact source Status values, and general search.
- Sorting and pagination are supported; CSV export is enabled only when approved source records are supplied.
- Table columns A:G remain in exact source order. Column A keeps a blank header; it is described outside the header as an unlabeled product/group column.
- The table starts empty. No historical rows, sample rows, template values, or mock transactions are loaded.
- Status chips use the exact source wording. Blank source values remain blank.
- The 3 source frozen rows are documented; the web table header remains sticky while the register scrolls. No frozen columns are added because the source has none.
- The source Google Sheet is read-only during UI work.

## 6. Shared shell and navigation
- The preview reuses tfi-shell-standard.css, tfi-preview-router.js, and tfi-shell-controls.js.
- The existing sidebar item PR Monitoring is retained and the router maps it to pr-monitoring-preview.html.
- The preview uses the same Tosen Foods palette and responsive shell as Yield Monitoring.

## 7. Acceptance checks
1. Exact source worksheet ID and sheetId are retained in the data contract.
2. The 7 source columns A:G appear in exact order; B:G labels preserve source spelling.
3. Column A remains visibly present with a blank source header and accessible label.
4. Source summary values are identified as row-2 snapshot values, not live backend metrics.
5. Status values match the source formula outputs exactly; D/E/F are not recalculated.
6. No historical PR transactions, group totals, template row, or incomplete candidate rows are preloaded in the table.
7. Filters, sorting, reset, pagination, and empty-state behavior work.
8. CSV export stays disabled while there are no connected records.
9. Desktop and mobile layouts have no page-level horizontal overflow; the table scrolls within its own container.
10. The parent sidebar route opens this page with PR Monitoring active.
11. No Google Sheet cells, database tables, or historical records are changed by the preview.

Source inspection note: Summary totals follow the source workbook formulas exactly. The preview does not reconcile or rewrite those formulas.

## 8. Verification record
- Chrome preview loaded the new PR Monitoring page with the exact source title visible.
- The page displays 7 table columns in A:G order; the A header remains blank and B:G labels match the source worksheet.
- Source snapshot values render as 16,182,629 required tins, 15,648,348 produced tins, and 96.70% completion.
- The transaction table contains only the empty-state row; record count is 0 and CSV export is disabled.
- Status filter options match the exact three source formula outputs.
- Sort, filter, and reset interactions were exercised with the empty dataset.
- Parent application navigation opens the new page and marks PR Monitoring as the active sidebar item.
- Desktop viewport 1600px: no page-level horizontal overflow.
- Mobile viewport 390px: no page-level horizontal overflow; the source table scrolls inside its own horizontal container.
- All JavaScript files pass syntax checks, all local asset references resolve, and no browser console/page errors were detected.
- No source spreadsheet cells, database tables, or historical records were modified.
