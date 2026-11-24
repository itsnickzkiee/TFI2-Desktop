# TFI New System — Yield Monitoring UI Specification v0.1

**Date:** 19 November 2026  
**Project:** TFI_NEW  
**Status:** UI preview implemented; backend contract not connected  
**Source workbook:** Copy of TFI - Production Monitoring Sheet 1  
**Source worksheet:** Yield Log  
**Reference worksheet:** Yield Map  
**Related upstream worksheet:** Product Entry

## 1. Source identity and role

- Yield Log worksheet ID: 743111542.
- Header row: 4; first formula row: 5.
- Frozen rows: 4; frozen columns: 3.
- Source range has 12 columns (A:L).
- The source title is: "YIELD LOG - live links to every product sheet (DPGP ... Mayon Laing)".
- The source note states that each row reads one production row from a product sheet and that column selections are configured in Yield Map.
- Yield Log is a formula-derived projection, not an independent production transaction stream.
- One Yield Log row corresponds to one Product Entry production row.
## 2. Exact source columns

| Source column | UI label | Data key |
|---|---|---|
| A | Date | date |
| B | Product Name | product_name |
| C | Product Code | product_code |
| D | Total FG (tins) | total_fg_tins |
| E | Main % Yield | main_yield_pct |
| F | Stage 2 % Yield | stage2_yield_pct |
| G | Stage 3 % Yield | stage3_yield_pct |
| H | Bloom Rate (x) | bloom_rate |
| I | Lid reject % | lid_reject_pct |
| J | Can reject % | can_reject_pct |
| K | Box reject % | box_reject_pct |
| L | Label reject % | label_reject_pct |

## 3. Data relationships

- Date is derived from Product Entry production date, with the source workbook's year reference in KPI Setup.
- Product Name is selected through Yield Map.
- Product Code and Total FG are linked from Product Entry.
- Main, Stage 2, Stage 3, Bloom Rate, and reject percentages use per-product column mappings in Yield Map.
- Yield Map product-name options are sourced from Yield Map!A5:A43.
- Yield Map target values are not displayed as approved benchmarks. The source note identifies non-DPGP 95% values as placeholders.
## 4. UI behavior

- Read-only view. No Add, Edit, Save, Submit, or manual transaction entry.
- Filters: From Date, To Date, Product Name, Product Code text search, and general search.
- Sorting and pagination are supported.
- CSV export is enabled only when source records are supplied.
- First three identity columns remain frozen during horizontal table scrolling.
- Date, tin quantity, percentages, and bloom rate are formatted consistently with source display conventions.
- Empty source values remain blank.
- No fabricated sample rows, KPI totals, target values, or chart values are shown.
- Preview records remain empty until a verified read-only source is connected.

## 5. Shared application shell

The preview reuses tfi-shell-standard.css, tfi-preview-router.js, and tfi-shell-controls.js. The shared router now maps "Yield Monitoring" to yield-monitoring-preview.html.

## 6. Acceptance checks

1. The 12 table columns match Yield Log A:L in exact order and labels.
2. Product Name filter choices match Yield Map A5:A43.
3. No transaction rows are fabricated or preloaded.
4. All source-derived cells are read-only.
5. Missing values display as blank, not artificial zeroes.
6. Date, Product Name, Product Code, and text filters work together.
7. Sorting, pagination, and CSV export work when real records are supplied.
8. The page opens from the shared sidebar router and retains shared shell behavior.
9. No write action changes Product Entry, Yield Map, or any production record.


## 9. Mobile header polish and browser verification — 20 November 2026

The existing Yield Monitoring UI was reopened and rechecked through the shared Dashboard → Monitoring → Yield Monitoring route. No duplicate screen was created.

### Small responsive correction
- Fixed the narrow-screen breadcrumb/profile collision in the embedded module header.
- On mobile, the breadcrumb keeps the TFI and Yield Monitoring labels visible while the redundant intermediate breadcrumb labels and profile text are hidden; the Administrator avatar remains visible.
- Added the responsive override to `design/yield-monitoring.css`.
- Retained rollback copy: `yield-monitoring.css.pre-yield-mobile-topbar-20261120.bak`.

### Browser verification
- Exact source metadata: workbook ID `1rCbQ16wj7MRjQCFF3tA-WEMkudraJK0RkwcqayUlz7k`, Yield Log sheetId `743111542`, Yield Map sheetId `854969610`, Product Entry sheetId `545274882`.
- All 12 visible table headers match Yield Log A:L, including `Total FG (tins)`.
- All 39 Yield Map product families appear in the Product Name filter.
- Read-only flag and no-mock flag are true; source records remain zero.
- Empty-state display is correct; CSV export remains disabled.
- Product Code search, sorting, and reset controls pass.
- Shared sidebar highlights Yield Monitoring.
- Mobile source cards stack; table horizontal scrolling stays inside the table container; page-level horizontal overflow is absent; breadcrumb and Administrator profile do not overlap.
- Browser page errors: 0. Failed non-aborted local asset requests: 0.

The updated preview was opened in Chrome at `dashboard-preview.html?module=Yield%20Monitoring`.

**Boundary:** This is still a read-only UI preview. The Yield Log is derived from Product Entry and Yield Map; it is not an independent import source. No historical Yield Log rows, Google Sheets writes, Supabase writes, or production database records were added or changed.
