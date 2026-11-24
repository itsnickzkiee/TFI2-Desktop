# TFI_NEW — Consolidated 8-Module Source Alignment Validation v0.2

**Audit date:** 20 November 2026  
**Project:** TFI_NEW  
**Official source workbook:** Copy of TFI - Production Monitoring Sheet 1  
**Official spreadsheet ID:** 1rCbQ16wj7MRjQCFF3tA-WEMkudraJK0RkwcqayUlz7k  
**Scope:** DMR Coding, Coding DPR, NON-PROD, CO QA, OEE, Productivity, Yield Monitoring, and Master Data.

## 1. Executive result

The eight requested modules were revalidated against the official 35-tab workbook. All seven active module data files now identify the official workbook ID and the correct worksheet title/sheetId. The Master Data preview is a static local prototype; its source counts and Product Standard field behavior were updated to the 35-tab audit.

The active JavaScript files in the design folder passed syntax checks. All script references in the eight relevant preview HTML files resolve to existing files. No source workbook cells, historical production records, Supabase tables, or live database records were changed.

### Overall status

| Module | Source alignment | Important finding |
|---|---|---|
| DMR Coding | Aligned with controlled exceptions | 116 product options; one historical code is not in the approved helper list |
| Coding DPR | Aligned with controlled exceptions | 414 populated rows in a 526-row span; two historical codes are not in the approved helper list |
| NON-PROD | Aligned | 20 historical rows; dropdowns match the official MANPOWER reference |
| CO QA | Structurally aligned; manual-field decision remains | Y:AD are manual cost fields; AI:AL are unresolved in the sampled source |
| OEE | Aligned | 3,700 source rows; 50 machines, 127 product codes, 3 lines |
| Productivity | Aligned with master-data mismatch noted | 626 source rows; 68 codes; 36 Code Map codes lack a Product Standard variant |
| Yield Monitoring | Aligned as read-only derived view | Yield Log is derived from Product Entry and Yield Map; no history is preloaded |
| Master Data | Revalidated and preview updated | Corrected source counts, capacity labels, numeric fields and protected calculated values |

## 2. Official workbook identity

- Workbook title: Copy of TFI - Production Monitoring Sheet 1
- Spreadsheet ID: 1rCbQ16wj7MRjQCFF3tA-WEMkudraJK0RkwcqayUlz7k
- The previous 28-tab workbook is retained for legacy comparison only.
- All active module data files in this validation use the official 35-tab spreadsheet ID.
- Older .pre35tab backup files may retain legacy references; they are not loaded by the current preview pages.

## 3. Module-by-module findings

### 3.1 DMR Coding

**Official source:** DMR Coding, sheetId 675328096  
**Source data extent:** Rows 4:4774, 4,771 populated rows  
**Source fields:** Date, Product Code, Line, Stop, Resume, Time in Mins, Time in Hours, Category, Factor, Reason, Product Name (auto).

- The active data file now points to the official workbook and worksheet.
- The UI has 116 source-backed product-code options: the 115 unique values returned by DPR LEGEND H3:H119 plus TMRMB-24-380 from DPR LEGEND L3.
- Category options are normalized from DPR LEGEND B3:B10 (8 values).
- Factor options are normalized from DPR LEGEND D3:D15 (13 values).
- Two distinct production-line values are present in the source data.
- The source Product Code validation is broken in sampled early cells (#REF!) and a later sampled validation extends beyond the current DPR LEGEND grid. The UI uses the bounded, populated source lists rather than copying the broken validation.
- One historical code, TMWKC-6-2950, is not present in the approved helper list. It remains an unresolved historical value; it was not added as a new approved code.
- Duration calculations and Product Name lookup remain preview calculations; no historical DMR rows are preloaded.

### 3.2 Coding DPR

**Official source:** Coding DPR, sheetId 1266086431  
**Source data extent:** Rows 3:528 (526-row span)  
**Populated rows:** 414  
**Blank rows within the scanned span:** 112  
**Batch structure:** Seven product-code/quantity slots.

- The active data file now points to the official workbook and worksheet.
- The UI has 116 source-backed product-code options: 115 unique helper-list values plus TMRMB-24-380 from DPR LEGEND L3.
- Product-code validation cells in the source show #REF!.
- Line-number validation uses DMP LEGEND D2:D4.
- The source Total Quantity formula sums batch quantities in slots 1–6 and excludes batch 7. The UI preserves this source behavior and keeps the batch-7 quantity separately visible; it does not silently change the source formula.
- Two historical codes, TMWKC-6-2950 and MRMB-24-380, are not in the approved helper list. Preserve them as raw unresolved historical codes during any future import; do not normalize or discard them.
- The source row count metadata now distinguishes 414 populated rows from the 526-row scanned extent.
- Historical Coding DPR transactions are not preloaded into the blank-entry preview.

### 3.3 NON-PROD

**Official source:** NON-PROD, sheetId 1381857831  
**Historical source rows:** 3:22 (20 rows)  
**Blank entry area:** Rows 23:668.

- The active data file now points to the official workbook and worksheet.
- The official NON-PROD layout and dropdown values match the previous workbook comparison.
- Dropdown sources are MANPOWER: 445 name records, 8 distinct positions, 48 activities and 36 locations.
- Repeated employee names are retained in source order; the UI does not automatically merge them.
- The source formula for No. of Working Hours is F/60. The preview computes this derived value and does not ask the user to enter it.
- The preview starts with blank entry rows and does not preload the 20 historical NON-PROD records.
- No visual redesign was required by the workbook switch.

### 3.4 CO QA

**Official source:** co QA, sheetId 1359678099  
**Source extent:** Header row 2; rows 3:2745.

- The active data file now points to the official workbook and worksheet.
- A:X are the Product Entry-derived array output area.
- Y:AD are manual packaging/unit-cost input columns. The inspected source cells are blank and do not show dropdown validation.
- AE:AH are formula-derived total fields.
- AI:AL are unresolved in the inspected source: no formulas or populated values were identified in the sampled rows.
- The current preview remains a read-only monitoring view and does not invent cost values or create an unapproved editing workflow.
- **Open product decision:** Confirm whether Y:AD should be editable in TFI_NEW, who is authorized to enter them, and whether AI:AL should remain reserved or be mapped to defined business fields.

### 3.5 OEE

**Official source:** OEE, sheetId 1750442014  
**Source data:** Rows 5:3704 (3,700 records), dated 2 January 2026 to 3 November 2026.

- The active data file points to the official workbook and worksheet.
- A:J are the input fields; K:U are calculated/lookup fields.
- Machine options: 50 distinct values from KPI Setup F3:F54.
- Product-code options: 127 values from KPI Setup E3:E129; the All dashboard filter is excluded from entry.
- Line options: 3 values from the OEE source validation list.
- All 34 distinct historical OEE product codes are present in the 127-code option list.
- Source validation for Machine and Product Code currently resolves to #REF!. The UI uses the bounded populated KPI Setup lists.
- The preview calculation flow mirrors the source relationships: run time, good count, ideal output, capped count, availability, performance, quality, OEE, week, month and product name.
- The preview uses blank entry rows; historical OEE rows are not preloaded. Saving remains disabled.

### 3.6 Productivity

**Official source:** Productivity, sheetId 1688444278  
**Source data:** Rows 5:630 (626 records).

- The active data file points to the official workbook and worksheet.
- A:K are input columns; L:V are calculated/lookup columns.
- Product-code options are the 68 Code Map entries. All 68 distinct historical Productivity product codes are present in Code Map.
- The source has two production-line values.
- Manpower Hours (M) is derived from DMP - Production through SUMIFS by date and product code. It is read-only in the preview and remains blank until the DMP source connection is available.
- Target Output (N) follows the source formula using Product Standard column F divided by 10, multiplied by planned run hours. The source formula is preserved as-is even though Product Standard column F is labelled Production Capacity 12H; any formula correction requires business-owner approval.
- Standard Productivity (O) uses Product Standard column H.
- Output per actual manpower hour, attainment, reject percentage, week, month and Product Name follow the source calculation structure.
- Historical Productivity rows are not preloaded into the blank-entry preview.

#### Product Standard and Code Map reconciliation

| Comparison | Count |
|---|---:|
| Product Standard populated product-code variants | 58 |
| Code Map product-code mappings | 68 |
| Codes present in both | 32 |
| Code Map codes with no matching Product Standard variant | 36 |
| Product Standard codes with no Code Map mapping | 26 |

These are source mismatches, not permission to delete or auto-create records. Preserve the mappings and expose unmatched references for Admin review. The current source formula fallback may return zero when a Product Standard lookup is missing; do not silently assign a standard.

### 3.7 Yield Monitoring

**Official source:** Yield Log, sheetId 743111542  
**Source extent:** Rows 5:39043 (39,039-row formula/data span)  
**Reference:** Yield Map, sheetId 854969610, A5:A43 (39 mapped product families)  
**Upstream source:** Product Entry, sheetId 545274882.

- The active data file points to the official workbook and worksheet.
- Yield Log is a read-only derived view, not an independent production-entry source.
- The 12 displayed fields map to date, product name/code, total finished goods and yield/reject measures.
- The preview contains zero historical sample records and does not invent or copy historical rows.
- Product-family filters use the 39 Yield Map families.
- Yield Map helper formulas and Product Entry-derived outputs remain protected.

### 3.8 Master Data

The Master Data preview remains a static local prototype. It does not read/write the live workbook or database. Its source counts and field behavior have been updated to the official 35-tab workbook.

| Reference category | Revalidated source count |
|---|---:|
| Product Standard | 58 populated product-code variants |
| Code Map | 68 mappings |
| Yield Map | 39 mapped product families |
| Entry Map | 39 populated Product Entry blocks |
| KPI Setup | 127 product codes + All |
| DPR Legend | 116 unique product codes across product-family lists |
| Manpower | 445 source records; 430 distinct employee names |
| DMP Legend | 69 data rows |
| Schedule Lists | 100 production-code options |

Additional source structure:
- Product Standard rows 3:109 contain 58 populated product-code variants, 26 family-header rows and 25 blank new-variant slots.
- Entry Map contains 39 populated family-to-block mappings; the extra sheet rows include blank/instruction rows and are not additional Product Entry blocks.
- DPR LEGEND product-family columns contain 119 populated code entries and 116 unique codes, with 3 repeated entries.
- DPR LEGEND H3:H119 contains 117 helper-list entries and 115 unique codes. Its H3 formula excludes column L, omitting TMRMB-24-380. The DMR Coding and Coding DPR UI lists now supplement that source-backed code from L3. The source workbook was not edited.
- Product Standard and Code Map are not one-to-one; preserve unmatched codes and mappings.
- The Lists worksheet remains a supporting reference source for module line/UOM values, not a separate Master Data catalog screen.

#### Product Standard UI corrections

- Changed the 12-hour field label to Capacity / 12H to match the source header.
- Kept Capacity / 12H, Capacity / 10H and Output per Hr as protected calculated values.
- Changed Default Shift to numeric hours (8, 10, 12), not Day/Night.
- Kept Halal blank unless an Admin explicitly selects a value; the preview no longer defaults it to Yes.
- Restricted Production Line choices to the two populated source values: AGRI LINE and MEAT LINE.
- Changed numeric source inputs such as Manpower Allocation, Productivity TMS, Case and Manual Output/hr Override to numeric controls.
- Disabled the Add Reference action for DPR Legend and made Production Line and Product Standard Reference read-only derived fields. Helper columns G:H remain protected.

## 4. Active files corrected and verified

The following active data files now use the official 35-tab workbook ID and verified sheet IDs:
- dmr-coding-data.js
- coding-dpr-data.js
- non-prod-data.js
- co-qa-data.js
- oee-data.js
- productivity-data.js
- yield-monitoring-data.js

The following accidental read-result marker text was removed from active preview files:
- coding-dpr-data.js
- non-prod-data.js
- co-qa-data.js
- productivity-ui.js
- productivity-preview.html

Before cleanup, a separate .pre-wrapper-clean-20261120.bak copy was retained. Before source-alignment updates, a .pre-source-align-20261120.bak copy was retained where applicable. Existing .pre35tab backups remain available for legacy comparison and are not loaded by the active preview pages.

## 5. Verification checks

- All active module data files parse successfully and use the official spreadsheet ID.
- All JavaScript files in the design folder passed syntax checks.
- The eight relevant preview HTML files contain no leading/trailing read-result markers.
- All script references in those eight preview pages resolve to existing local files.
- DMR Coding and Coding DPR each expose 116 source-backed product-code options, including the L3 supplemental code.
- Coding DPR metadata distinguishes 414 populated rows from its 526-row scanned extent.
- Master Data summary counts and Product Standard field controls match the revalidated source inventory.
- No Google Spreadsheet cells were edited.
- No historical data was imported, deleted, normalized or rewritten.
- No Supabase schema, table or record was changed.
- Preview save actions remain disabled; all current changes are local design/data-reference updates only.

## 6. Outstanding decisions before import readiness

1. Confirm whether the DPR LEGEND H3 source formula should be corrected to include column L, or whether the supplemental UI option is the permanent treatment.
2. Confirm how unmatched historical codes TMWKC-6-2950 and MRMB-24-380 should be displayed and classified during scan/import. Preserve raw values; do not drop or auto-correct them.
3. Review the 36 Code Map codes missing from Product Standard and the 26 Product Standard codes missing from Code Map. Do not auto-merge or delete.
4. Decide whether CO QA manual cost fields Y:AD should be editable in TFI_NEW and who may maintain them.
5. Confirm the Productivity target-output formula that divides the Product Standard 12H capacity column by 10. The current UI deliberately preserves the source formula.
6. Verify the intended meaning or future use of CO QA columns AI:AL before mapping them.

**Status:** Eight-module source alignment and first-pass UI revalidation complete. Remaining items are source/business-owner decisions and import-readiness checks, not reasons to change existing production records.

## 7. Yield Monitoring UI polish — 20 November 2026

The existing Yield Monitoring preview was polished using the official 35-tab workbook structure. The page remains a read-only preview with no imported or fabricated transaction rows.

### UI updates
- Replaced the raw spreadsheet title/description with a clear Yield Monitoring hero and read-only status.
- Added source context cards for Yield Log (12 fields, A:L), Product Entry (upstream formula-derived rows), and Yield Map (39 mapped product families).
- Retained the exact 12 Yield Log headers and the source's first-three-column freeze behavior.
- Preserved date range, product name, product code, and keyword filters; reset remains functional.
- Kept CSV export disabled while the preview has no source records.
- Improved the empty state to clearly state that no sample transactions are shown.
- Kept the shared TFI shell, persistent sidebar/navigation, router, and shell-control files unchanged.
- No Add/Edit/Save workflow was introduced.

### Files updated
- design/yield-monitoring-preview.html
- design/yield-monitoring.css
- design/yield-monitoring-ui.js

Backups were retained beside each file with the suffix .pre-ui-polish-20261120.bak.

### QA results
- Desktop viewport 1365px: 12 headers, one empty-state row, 0 preview records, export disabled, no horizontal page overflow.
- Mobile viewport 390px: source cards stack correctly, the 12-column table scrolls within its own container, no horizontal page overflow.
- Filter/sort/reset interactions tested; no records were fabricated or revealed.
- No JavaScript page errors.
- The source data file remains records: [].
- No Google Sheets cells, historical transactions, Supabase tables, or database records were changed.
