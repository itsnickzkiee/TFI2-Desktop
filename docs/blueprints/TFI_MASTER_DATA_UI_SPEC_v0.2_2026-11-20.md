# TFI Master Data UI Specification v0.2

**Date:** 20 November 2026  
**Project:** TFI_NEW  
**Screen:** Master Data — Admin Only  
**Status:** Full source-reference UI preview implemented and browser-tested; no live import or database writes

## 1. Source of truth

- Workbook: **Copy of TFI - Production Monitoring Sheet 1**
- Spreadsheet ID: `1rCbQ16wj7MRjQCFF3tA-WEMkudraJK0RkwcqayUlz7k`
- Workbook contains 35 worksheets.
- Source values were read from the official workbook on 20 November 2026.
- The UI uses a local source snapshot. It does not write to the Google Spreadsheet or Supabase.

## 2. Nine Master Data categories

| UI category | Exact source worksheet | sheetId | Source range | Source reference count |
|---|---|---:|---|---:|
| Product Standard and Specificat | Product Standard and Specificat | 2138697021 | A1:U110 | 58 variants; 26 family headers; 25 reserved slots |
| Code Map | Code Map | 2098561343 | A1:B72 | 68 mappings |
| Yield Map | Yield Map | 854969610 | A1:W43 | 39 mapped product families |
| Entry Map | Entry Map | 1628314566 | A1:E43 | 39 populated mappings |
| KPI Setup | KPI Setup | 1955006742 | A1:T129 | 127 product codes + All, plus reference groups |
| DPR LEGEND | DPR LEGEND | 508797580 | A1:AN119 | 116 unique product codes across 119 family-list entries |
| DMP LEGEND | DMP LEGEND | 1070169465 | A1:D70 | 69 source rows |
| MANPOWER | MANPOWER | 583741906 | A1:E448 | 445 source records; 430 distinct employee names |
| Schedule Lists | Schedule Lists | 156467196 | A1:L101 | 100 production-code rows |

## 3. Category-specific source treatment

### 3.1 Product Standard and Specificat
- Preserves all 21 source columns A:U in exact order and original source row positions.
- Full source range includes 58 populated product-code variants, 26 family-header rows, and 25 reserved new-variant slots.
- The direct source read confirms 26 family headers. This supersedes the earlier 24-family count in the first audit draft.
- Columns F, G and S are displayed as formula/read-only fields.
- Source header notes identify column E as edited by Production and columns F/G as edited by Plant IE.
- Default Shift remains numeric hours; Halal stays blank unless the source contains a value.
- Product codes are not automatically renamed or normalized.

### 3.2 Code Map
- Displays all 68 source mappings from rows 5:72, columns A:B.
- Adds an application-side reconciliation indicator without changing the source columns.
- Current comparison: 32 codes appear in both Product Standard and Code Map; 36 Code Map codes have no Product Standard variant; 26 Product Standard variants have no Code Map mapping.
- Unmatched references remain visible for Admin review. The UI does not auto-create or delete mappings.

### 3.3 Yield Map
- Displays all 39 mapped families and the complete A:W source structure.
- B:M are marked as source input fields.
- Product family A, information column N, and helper columns P:W are marked reference/formula read-only.
- The source warning about placeholder 95% targets is retained. No target is silently treated as an approved business threshold.

### 3.4 Entry Map
- Displays all 39 populated family-to-block mappings from rows 2:40.
- Preserves Product (dropdown), Block name, Product title, First row, and Rows.
- Read-only. The source instruction not to change columns A/B is retained.
- A new family requires a verified BLK_xx named range and complete Product Entry block; a display row alone is insufficient.

### 3.5 KPI Setup
- Displays the source as grouped reference cards rather than flattening separate lists into a fictitious single table.
- Groups: View; Month / Month # / Week #; Product Code; Machine; Line; Downtime Reference; KPI Settings; Downtime Code / Group; Product Name List; Year List.
- Keeps paired source fields together.
- Product Code All and View Daily are marked protected.
- No delete/clear action is provided.

### 3.6 DPR LEGEND
- Preserves source layout: B:F independent reference lists, G:H formula/helper outputs, I:AN product-specific code lists.
- Provides separate UI views for Product Family Codes, Independent Reference Lists, and Helper Outputs.
- G:H are marked read-only.
- The existing H3 helper formula omission of TMRMB-24-380 is documented; the UI does not alter the source formula.

### 3.7 DMP LEGEND
- Displays all 69 source rows and the four exact source columns.
- Preserves all 10 source notes marking resigned/AWOL, including notes attached to blank worker-name cells.
- Shows note status separately from the source name. Blank source names remain blank; no person is inferred or substituted.
- Note labels are source signals, not verified live HR status.

### 3.8 MANPOWER
- Displays all 445 source records across the five source columns.
- Preserves 430 distinct employee names and repeated source rows.
- Does not automatically merge or delete repeated names.

### 3.9 Schedule Lists
- Provides separate views for Production Codes (A:B), Reference Lists (D:G), and Product Standard Field Map (K:L).
- Displays all 100 production-code rows and the source reference options.
- Preserves the source instruction to auto-refresh from Product Standard and not to edit columns A, B, K or L.
- Read-only in this preview.

## 4. UI interactions

- Nine-category navigation in one Master Data workspace.
- Current worksheet name, verified sheetId, source range, and official workbook link update when the category changes.
- Search, category-specific filters, source-row trace labels, and pagination for tabular lists.
- DPR LEGEND product-family selector and three subviews.
- Schedule Lists three subviews.
- View and preview-edit details where category field rules permit.
- Preview edits change only in-memory browser data and disappear on reload.
- No delete action is available.
- Admin Import Spreadsheet modal includes Paste Spreadsheet Link and Validate Link.
- Link validation checks URL format and confirms the pasted ID matches the approved workbook ID. It does not verify Google account permissions or import data.
- Import remains disabled and labelled IMPORT NOT CONNECTED.

## 5. Access and safety boundaries

- The screen is labelled ADMIN ONLY.
- This is a UI access designation only. Server-side and database-level Admin authorization remains pending.
- Field-level role grants and exact Google protected-range metadata are not fully verified. UI input/read-only treatment follows the observed source notes, formulas, helper fields and current project audit.
- No Google Spreadsheet cells, formulas, validation rules, source notes, or historical rows were edited.
- No Supabase schema, table, record, or permission was changed.
- No historical or fabricated transaction data was added.

## 6. Local implementation files

- `design/master-data-preview.html`
- `design/master-data-source-data.js` — complete source-value snapshot and source-note metadata
- `design/master-data-ui.js` — category rendering, filtering, pagination, details and preview-only edit behavior
- `design/master-data-source-ui.css` — source-aligned table and responsive UI styling
- `design/tfi-preview-router.js` — existing shared route retained

A rollback copy of the previous page was retained as `master-data-preview.html.pre-full-source-master-data-20261120.bak`.

## 7. Browser verification

All category routes were opened in the shared Dashboard shell. Checks covered:

- Exact source sheet IDs and ranges for all nine categories.
- Product Standard 21 source columns, source grouping rows and reserved slots.
- Code Map match/unmatched filtering.
- Yield Map 23 source columns and input/helper treatment.
- Entry Map 39 mappings and read-only behavior.
- KPI Setup 10 reference groups and protected values.
- DPR LEGEND 32 family columns, independent lists and helper outputs.
- DMP LEGEND 10 note statuses and AWOL filter.
- MANPOWER 445 source rows and position filtering.
- Schedule Lists 100 code rows, four reference lists and field map.
- Preview-only edit behavior.
- Import modal open/close, invalid URL rejection, approved workbook ID validation, and disabled import action.
- Mobile layout, no page-level horizontal overflow, and table-contained horizontal scrolling.

**Final test status:** All Master Data browser checks passed; zero browser errors and zero failed non-aborted local asset requests.
