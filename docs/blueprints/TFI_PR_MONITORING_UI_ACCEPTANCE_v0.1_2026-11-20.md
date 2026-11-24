# TFI PR Monitoring — UI Acceptance v0.1

**Verification date:** 20 November 2026  
**Project:** TFI_NEW  
**Screen:** PR Monitoring  
**Implementation:** design/pr-monitoring-preview.html  
**Source specification:** TFI_PR_MONITORING_UI_SPEC_v0.1_2026-11-20.md

## 1. Acceptance result

**Status: UI preview verified after CSV export correction.**

The existing PR Monitoring UI was reviewed against the current official 35-tab workbook and tested through the shared application router. The existing page was refined in place; no duplicate UI or source workbook was created.

## 2. Official source verification

- Workbook: Copy of TFI - Production Monitoring Sheet 1
- Spreadsheet ID: 1rCbQ16wj7MRjQCFF3tA-WEMkudraJK0RkwcqayUlz7k
- Worksheet: PR MONITORING
- Worksheet ID: 867256143
- Grid: 1,000 rows x 27 columns
- Used UI source columns: A:G
- Summary row: 2
- Header row: 3
- First data row: 4
- Frozen rows: 3
- Frozen columns: 0

The seven UI columns preserve the source order and labels:
- A: blank source header; product/group labels
- B: PR No.
- C: Date PR Recieved
- D: PR Required Quantity (tins)
- E: Production Produced (tins)
- F: For Production Quantity (tins)
- G: Status

The source spelling "Recieved" is intentionally preserved. Column A remains present with a visually blank header and an accessible description. PR No. is treated as text so leading zeroes are preserved.

## 3. Source summary and row classification

The UI summary matches the live source worksheet row-2 snapshot:
- Total Tins To Produce: 16,182,629 (B2; formula =SUM(D4:D1002))
- Total Tins Produced: 15,648,348 (D2; formula =SUM(E4:E1002))
- Completion: 96.70% (F2; formula =D2/B2)

Source rows 4:81 were rechecked:
- 78 populated source rows
- 64 rows with a PR No.
- 12 product-total/group rows: 6, 11, 15, 19, 25, 34, 41, 45, 57, 65, 71, 77
- Row 4: zero-value template row
- Row 79: incomplete PR candidate with date and quantities but no PR No.

Group totals are not individual PR transactions. The template row and incomplete candidate are not silently completed or converted into transactions. The preview register remains empty and does not preload historical rows.

## 4. Source formula preservation

The source G4 formula is:
=if(D4="","",if(F4>0,"Pending for Production",if(F4=0,"Complete","Over Produce")))

The exact status values are:
- Pending for Production
- Complete
- Over Produce

D, E, and F are stored source values. The UI does not recalculate F from D and E, and Status is read-only. The row-2 summary is displayed as a source snapshot, not as a live database KPI.

## 5. UI and interaction acceptance

- Seven columns appear in exact A:G order.
- Column A header remains visually blank and accessible.
- B:G labels and source spelling match the source sheet.
- Source summary values render correctly.
- The initial table has one empty-state row and zero transaction records.
- No historical, template, group-total, incomplete-candidate, sample, or fabricated transaction rows are preloaded.
- Read-only status is visible; no Add, Edit, Save, or Submit transaction workflow is offered.
- PR No. search, date range filters, status filter, general search, sorting, reset, pagination, and CSV export controls are present.
- CSV export is disabled while the preview has no connected records.

### CSV export correction

The first QA pass identified escaped literal backslash sequences in the CSV byte stream. The export implementation was corrected to write a UTF-8 BOM and actual CRLF line endings. A backup was retained as:

design/pr-monitoring-ui.js.pre-csv-fix-20261120.bak

The corrected export was verified with 12 temporary test-only rows in a headless browser session: BOM present, 12 CRLF separators, and no literal escaped CRLF sequences. The temporary test records were removed from browser memory after the test; the active data file still contains records: [].

## 6. Navigation, responsive layout, and browser checks

- Shared router sequence passed: PR Monitoring → Dashboard → PR Monitoring.
- PR Monitoring is marked as the active outer sidebar item after navigation.
- Desktop viewport 1600px: no page-level horizontal overflow.
- Mobile viewport 390px: no page-level horizontal overflow; the shared sidebar uses its compact 76px layout.
- The 1,300px source table scrolls inside its own horizontal container on desktop and mobile.
- Table header sticky offset is 74px on desktop and 62px on mobile.
- JavaScript syntax checks passed for PR Monitoring data/UI and shared router/shell scripts.
- Browser page errors: 0.
- Browser console errors: 0.
- Failed local asset requests: 0.

## 7. Verification artifacts

- design/pr-monitoring-preview.html
- design/pr-monitoring-data.js
- design/pr-monitoring-ui.js
- design/pr-monitoring.css
- design/test-pr-monitoring-acceptance.js
- design/test-pr-monitoring-responsive.js
- design/pr-monitoring-verified-desktop.png
- design/pr-monitoring-verified-mobile.png
- design/pr-monitoring-ui.js.pre-csv-fix-20261120.bak

## 8. Explicit limitations

This acceptance covers the local UI preview only. It does not connect a live PR Monitoring data source, database, or CSV export pipeline. The summary values remain a source snapshot. Historical transactions, group totals, the zero-value template row, and the incomplete candidate remain in the original Google Sheet and are not copied into the preview.

No Google Sheet cells, historical PR records, Supabase schema, or live database records were changed.
