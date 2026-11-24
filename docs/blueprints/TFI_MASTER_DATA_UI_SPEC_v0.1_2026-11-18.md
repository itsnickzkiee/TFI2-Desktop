# TFI Master Data — UI Specification v0.1

**Date:** 18 November 2026  
**Project:** TFI_NEW  
**Screen:** Master Data  
**Status:** First visual prototype

## 1. Purpose

The Master Data screen provides one Admin workspace for the product standards and reference lists used by TFI operational modules and calculation rules. It is based on the reviewed workbook reference inventory rather than generic catalog categories.

The counts shown in the prototype are audited source-baseline counts. They are not live records in the new TFI database and must not be presented as migrated data.

## 2. Reference categories

### Product references

**Product Standard**
- Audited baseline: 100 source rows.
- Product code / variant, product name, production line, line, manpower allocation, productivity TMS, can size, can code, product type, description, brand, net weight, label, can type, case (tins/box), Halal, default shift, and manual output/hr override.
- Output / 12H and Capacity / 10H are calculated source values and are protected from direct editing.
- Add Product creates a variant under an existing Product Entry family; it does not create a new family.
- Product codes must be unique.
- No delete action.
- A code rename must preserve the previous code in Code Map and KPI Setup for historical lookups; historical production rows are not rewritten.
- A new Product Entry family requires a separate verified Entry Map row, matching BLK_xx named range, and complete Product Entry block.

**Code Map**
- Audited baseline: 68 source mappings.
- Maps Product Code to Product Entry family.
- Product code is unique and normalized to uppercase.
- Product Entry family must be selected from the approved family catalog.
- No delete action; historical lookups remain available.

**Yield Map**
- Audited baseline: 39 mapped product families.
- Editable fields are limited to source columns B:M: yield/reject source letters, labels, and main-yield target.
- Product family in column A, helper columns N:W, and formula-generated values are protected.
- Eight helper formulas in P:W must be verified before edits are enabled.
- Adding a map is available only when an approved catalog family exists but is not yet mapped.
- The current preview shows a summary only because row-level Yield Map values were not included in the available reconciliation ledger.

**Entry Map**
- Audited source: 43 populated mapping rows and 39 Product Entry blocks.
- Read-only.
- Preserves product dropdown names, BLK_xx block names, title formulas, named-range first-row and row-count formulas, and hidden-column definitions.
- A new family cannot be created by adding a display row alone.

### Operating references

**KPI Setup**
- Audited baseline: 128 Product Code list entries.
- Other reference groups include View, Month / Month #, Week #, Product Code, Machine, Line, downtime code / description / Y-N, KPI setting values, downtime code / group, Product Name, and Year.
- Month and Month # are maintained as a pair.
- Downtime code, description, and Y/N are maintained together.
- Existing DT Group values are restricted to approved groups.
- Product Code 'All' and View 'Daily' are protected from renaming.
- No delete/clear action.

**DPR Legend**
- Audited baseline: 116 product-code family references.
- Contains independent reference lists in source columns B:F and product-specific DPR code lists in I:AN.
- Formula-generated Production Line and sorted DPR Code helper outputs in G:H are protected.
- No row insertion/deletion or helper-column editing.

**Manpower**
- Audited baseline: 445 source records.
- Fields: employee name, position, activities, location, and legend.
- Repeated-name source rows are retained separately until the data owner confirms whether any are accidental duplicates; no automatic merge or deletion.

**DMP Legend**
- Audited baseline: 70 source rows.
- Fields: worker name, position / role, process, and line.
- Worker-name matching is reviewed against Manpower. Missing or unconfirmed names remain visible for Admin resolution; the UI must not silently substitute a person.

**Schedule Lists**
- Audited baseline: 100 source rows.
- Product groups and production codes are refreshed from Product Standard after an approved product-standard save.
- This is an automatically refreshed reference view, not a separately maintained product catalog.
- Other source ranges not covered by the refresh remain untouched.

## 3. Screen layout

- Existing TFI branded sidebar and Administrator profile.
- Page heading and breadcrumb.
- Baseline notice explaining that displayed counts and examples are not yet migrated into the new system.
- Four summary cards: Product Standards, Code Mappings, Yield Families, and Manpower Records.
- Reference category navigation grouped into Product References and Operating References.
- Main data panel with category title, access state, search, category-specific filters, a well-spaced table, row actions, and pagination.
- Detail / edit modal with field labels, validation, protected-field behavior, and cancel/save actions.

## 4. Table and form behavior

- Product Standard table shows Product Code, Product Name, Production Line, Output / 12H, Capacity / 10H, Productivity TMS, and row action.
- Code Map table shows Product Code, Product Entry Family, source row, and mapping status.
- DPR Legend table shows Product Code, DPR Family, Production Line, Product Standard Reference, and reference status.
- KPI Setup table previews Product Code list values and identifies protected entries.
- Manpower table shows Employee Name, Position, Activities, Location, and Legend.
- DMP Legend table shows Worker Name, Position / Role, Process, Line, and reference status.
- Yield Map, Entry Map, and Schedule Lists show their current summary/protection behavior until their full approved row-level data is loaded into the new system.
- There is no delete action in the prototype.
- Preview edits update only in-memory page data. They do not change the old workbook, the new Supabase database, or production records.

## 5. Navigation

Master Data is reachable from the sidebar on:
- Admin Dashboard.
- Spreadsheet Import Center.
- Scan Progress.
- Central Import Inbox.
- Import Confirmation / Results.
- Import History.

The New Spreadsheet Import action returns to the Spreadsheet Import Center. Import History and Dashboard navigation are also connected where available.

## 6. Prototype boundary

- Product and reference rows shown are selected examples from the reviewed source ledgers.
- Summary counts are from the 18 November 2026 audit snapshot.
- The prototype does not read or write the live workbook or Supabase.
- The page does not create a database schema or perform migration.
- Any Add / Edit interaction is local preview behavior only.

## 7. Production requirements

The live Master Data module must:
- Load the approved reference snapshot from the new central database.
- Preserve source workbook, worksheet, source row, and source fingerprint for migrated reference rows.
- Keep reference versions and change history.
- Enforce Admin authorization on the server and database, not only by hiding UI actions.
- Validate unique codes and approved family references.
- Preserve historical codes and prevent deletion of referenced master data.
- Recompute dependent calculations only according to approved formula eligibility rules.
- Keep incomplete operational records in their module tables; missing reference values should be visible and traceable rather than silently guessed.
- Prevent unauthorized edits to formula-derived or structurally protected mapping fields.
- Record who changed a reference, when, and why.

## 8. Source documents used

The screen structure and field constraints were derived from the prior TFI project documents:
- PHASE19_PRODUCT_STANDARD.md
- PHASE20_DPR_LEGEND_KPI_SETUP.md
- PHASE22_CODE_YIELD_MAP.md
- PHASE24_HOURLY_CALC_ENTRY_MAP.md
- PHASE_A_REFERENCE_ROW_LEVEL_RECONCILIATION_2026-11-18.md
- PHASE_A_PRODUCT_STANDARD_ROW_LEDGER_2026-11-18.csv
- PHASE_A_CODE_MAP_ROW_LEDGER_2026-11-18.csv
- PHASE_A_KPI_SETUP_PRODUCT_CODE_LEDGER_2026-11-18.csv
- PHASE_A_DPR_CODE_FAMILY_LEDGER_2026-11-18.csv
- PHASE_A_MANPOWER_ROW_LEDGER_2026-11-18.csv
- PHASE_A_DMP_LEGEND_ROW_LEDGER_2026-11-18.csv
- PHASE_A_SCHEDULE_LIST_PRODUCTION_CODE_LEDGER_2026-11-18.csv


## 8. Official 35-tab source revalidation — 20 November 2026

The earlier baseline counts in this first UI specification are superseded where noted below. The approved source is Copy of TFI - Production Monitoring Sheet 1 (35 worksheets), spreadsheet ID 1rCbQ16wj7MRjQCFF3tA-WEMkudraJK0RkwcqayUlz7k. Full details are in TFI_8_MODULE_SOURCE_ALIGNMENT_VALIDATION_v0.2_2026-11-20.md.

| Reference | Revalidated source count |
|---|---:|
| Product Standard | 58 populated product-code variants, 26 family headers, 25 blank new-variant slots |
| Code Map | 68 mappings |
| Yield Map | 39 mapped product families |
| Entry Map | 39 populated Product Entry blocks |
| KPI Setup | 127 product codes plus All |
| DPR Legend | 116 unique product codes across 119 family-list entries |
| Manpower | 445 source records; 430 distinct employee names |
| DMP Legend | 69 data rows |
| Schedule Lists | 100 production-code options |

### 8.1 Reconciled source differences

- Product Standard and Code Map are not one-to-one: 36 Code Map codes have no matching Product Standard variant, and 26 Product Standard codes have no Code Map mapping. Preserve these as unmatched references for Admin review; do not automatically delete, merge, or create mappings.
- DPR LEGEND product-family columns contain 116 unique codes, while H3:H119 contains 115 unique helper values. H3's formula omits column L, which contains TMRMB-24-380. DMR Coding and Coding DPR preview dropdowns supplement this source-backed code from L3; the source workbook remains unchanged.
- KPI Setup contains 127 product codes plus the protected All option.
- Entry Map has 39 populated family-to-block mappings. Blank/instruction rows are not additional Product Entry blocks.

### 8.2 Product Standard field mapping corrections

- Source F/G are Production Capacity 12H and Production Capacity 10H. The preview label is Capacity / 12H and Capacity / 10H; both remain protected calculated fields.
- Source S (Output per Hr) is calculated and protected.
- Default Shift is numeric hours (source options 8, 10, 12), not Day/Night. Current populated source values are 10 where present.
- Halal values remain blank unless explicitly selected; the preview must not default to Yes.
- Production Line options are AGRI LINE and MEAT LINE.
- Numeric inputs include Manpower Allocation, Productivity TMS, Case (Tins/Box), and Manual Output/hr Override.
- DPR Legend helper columns G:H remain protected. The preview does not add DPR rows; Production Line and Product Standard Reference are derived/read-only.

### 8.3 Preview boundary

The Master Data screen remains a local prototype with selected examples and source-baseline counts. It does not load migrated records, edit the official Google Spreadsheet, or write to Supabase. The updated counts are source-reference counts, not database migration totals.
