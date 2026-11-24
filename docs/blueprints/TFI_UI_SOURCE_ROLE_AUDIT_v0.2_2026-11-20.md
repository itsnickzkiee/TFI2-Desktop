# TFI_NEW — UI, Source Mapping, Protection and Role Audit v0.2

**Audit date:** 20 November 2026  
**Project:** TFI_NEW  
**Official workbook:** Copy of TFI - Production Monitoring Sheet 1  
**Spreadsheet ID:** 1rCbQ16wj7MRjQCFF3tA-WEMkudraJK0RkwcqayUlz7k  
**Worksheet count:** 35

## 1. Executive result

The official 35-tab workbook is confirmed. All 15 operational/input modules have preview pages, including PR Monitoring. Yield Monitoring is a separate read-only derived view, and KPI Dashboard is represented by the Dashboard preview.

The system is **not yet import-ready**. Remaining work is source/role validation and cleanup of preview-only mock content—not a broad UI redesign.

| Area | Result | Status |
|---|---|---|
| Official workbook | 35 worksheets confirmed | Pass |
| Operational UI coverage | 15 of 15 modules have preview pages | Pass |
| Dashboard / Yield Monitoring | Existing previews | Pass with source checks |
| Master Data | One workspace with 9 reference categories | Partial; static/partial data |
| Reports & Reconciliation | No dedicated page or route | Outstanding |
| Router | 23 routes; all target files exist | Pass with Reports exception |
| Import subflow pages | Scan, Inbox, Confirmation exist and link in sequence | Pass as preview flow |
| Active source workbook IDs | All 16 active source data files use the official ID | Pass |
| Explicit sheetId metadata | Missing in 6 active data files | Correction required |
| JS syntax / local assets | 32 JS files parse; no missing local references | Pass |
| No-mock-data requirement | 6 screens contain illustrative/sample data | Fail |
| Actual protected-range inventory | Not exposed by current connector response | Unverified |
| Final role matrix | Draft roles remain | Not approved |
| Historical import / database integration | Not performed | Correctly on hold |

No Google Sheets cells, historical transactions, Supabase tables or active UI source files were modified during this audit. This document is the audit deliverable only.

## 2. UI coverage and remaining screens

### 2.1 Operational modules already represented

All 15 operational/input worksheets have an existing preview page and router destination:

1. Product Entry
2. Production Entry
3. Production Schedule
4. DMP Production
5. DMR Production
6. DMR Coding
7. Hourly Meat
8. Hourly Coding
9. Hourly Agri
10. OEE
11. Productivity
12. Coding DPR
13. PR Monitoring
14. CO QA
15. NON-PROD

Yield Monitoring is present as a read-only derived monitor. KPI Dashboard is represented by the Dashboard preview.

**Conclusion:** No additional standalone operational-entry screen is required from the current 35-tab inventory.

### 2.2 Navigation inventory

- Shared router contains 23 module routes; all 23 target HTML files exist.
- Design folder contains 27 HTML preview pages.
- Three additional HTML pages are internal import-workflow steps: Scan Progress / Worksheet Detection, Central Import Inbox, and Import Confirmation / Results.
- These three pages are linked in sequence and do not need separate sidebar entries merely because they are separate workflow pages.
- The fourth non-routed page is the generic Module Placeholder.
- The sidebar contains a Reports item, but the router has no reports route. It falls back to the generic Module Placeholder.
- No dedicated Reports & Reconciliation page currently exists.

### 2.3 Remaining UI work

**One planned application screen remains: Reports & Reconciliation.**

| Source worksheet | Recommended destination |
|---|---|
| Production Summary | Production Entry history / saved-run report |
| Schedule Summary | Production Schedule history |
| Summary | Derived production / QA summary |
| Removed Rows | Restricted archive and exception review |

The Reports sidebar item should eventually route to this screen. Do not create duplicate transaction-entry screens for these sources.

## 3. 35-tab disposition

| # | Exact worksheet | TFI_NEW destination | Treatment |
|---:|---|---|---|
| 1 | GUIDELINES | Project documentation | No user-facing UI |
| 2 | KPI Dashboard | Dashboard | Derived dashboard view |
| 3 | Production Entry | Production Entry | Operational daily form |
| 4 | Product Entry | Product Entry | Operational product-family form; 39 blocks |
| 5 | Production Schedule | Production Schedule | Operational schedule form |
| 6 | OEE | OEE | Operational input + calculated monitoring |
| 7 | Hourly Meat | Hourly Meat | Operational hourly input |
| 8 | Hourly Coding | Hourly Coding | Operational hourly input |
| 9 | Hourly Agri | Hourly Agri | Operational hourly input |
| 10 | DMR Production | DMR Production | Downtime / production record |
| 11 | DMR Coding | DMR Coding | Downtime / coding record |
| 12 | Coding DPR | Coding DPR | Coding/labelling production record |
| 13 | PR MONITORING | PR Monitoring | PR quantity/status monitor |
| 14 | co QA | CO QA | Product Entry-derived QA view + manual cost inputs |
| 15 | NON-PROD | NON-PROD | Non-production manpower/activity record |
| 16 | DMP - Production | DMP Production | Manpower/process record |
| 17 | MANPOWER | Master Data → Manpower | Reference data; preserve duplicate source rows |
| 18 | Productivity | Productivity | Operational inputs + calculated productivity |
| 19 | DMP LEGEND | Master Data → DMP Legend | Worker/process/line references |
| 20 | Schedule Summary | Reports & Reconciliation | Schedule history / summary |
| 21 | Production Summary | Reports & Reconciliation / Production Entry History | Saved Production Entry history; avoid duplicate imports |
| 22 | Summary | Reports & Reconciliation / Dashboard | Formula-derived summary |
| 23 | Schedule Lists | Master Data → Schedule Lists | Derived/auto-refreshed reference list |
| 24 | Product Standard and Specificat | Master Data → Product Standard | Product specification and standards |
| 25 | DPR LEGEND | Master Data → DPR Legend | Product/code/reference lists |
| 26 | KPI Setup | Master Data → KPI Setup | KPI configuration and option lists |
| 27 | KPI Calc | Internal calculation service | No standalone UI |
| 28 | Code Map | Master Data → Code Map | Product-code-to-family mapping |
| 29 | Yield Map | Master Data → Yield Map | Yield/reject source mapping and targets |
| 30 | Yield Log | Yield Monitoring | Read-only derived view |
| 31 | Dash Calc | Internal calculation service | No standalone UI |
| 32 | Hourly Calc | Internal calculation service | No standalone UI |
| 33 | Entry Map | Master Data → Entry Map | Product Entry block/named-range structure |
| 34 | Lists | Relevant module dropdowns / internal reference | Use list values; no standalone operational screen |
| 35 | Removed Rows | Reports & Reconciliation → Restricted Archive | Preserve source reason and trace; do not auto-restore |

**Disposition summary:** 15 operational/input modules; 1 Dashboard; 1 Yield Monitoring derived view; 9 Master Data reference categories; 1 planned Reports & Reconciliation screen covering 4 report/archive sources; 3 internal calculation sheets; and 2 documentation/support sheets.

## 4. Active source-mapping audit

### 4.1 Workbook identity

All 16 active source data JavaScript files were inspected. All 16 identify the official spreadsheet ID. No active source data file contains the previous 28-tab workbook ID.

### 4.2 Missing explicit sheetId metadata

The following active source data files contain the official workbook ID and exact sheet name but do not embed the current sheetId:

| Active file | Exact source worksheet | Current sheetId to add |
|---|---|---:|
| dmp-production-data.js | DMP - Production | 1312335050 |
| dmr-production-data.js | DMR Production | 2048043346 |
| hourly-meat-data.js | Hourly Meat | 428082343 |
| product-entry-data.js | Product Entry | 545274882 |
| production-entry-data.js | Production Entry | 1923467491 |
| production-schedule-data.js | Production Schedule | 1538651320 |

Add the verified sheetId to each source contract before import/scanning is treated as fully traceable.

### 4.3 Source validation defects and preview fallbacks

The following source Product Code validation cells currently resolve to #REF!:

- DMR Coding, column B.
- DMR Production, column B.
- Coding DPR, product-code batch columns D/G/J/M/P/S/V.
- DMP - Production, column B.
- OEE, Machine column B and Product Code column D.

Current previews use bounded source-derived lists instead of copying the broken validations:
- DMR Coding and Coding DPR use DPR LEGEND product-family code values, including supplemental TMRMB-24-380 from DPR LEGEND L3.
- DMR Production uses distinct codes observed in its own source records.
- DMP Production uses distinct codes observed in its own source records.
- OEE uses populated KPI Setup machine and product-code lists.

These are preview fallbacks, not proof that original source validation rules are repaired. Confirm the approved canonical list and ownership before import.

### 4.4 Additional source exceptions

1. **Production Entry Product Code validation:** D8 points to DPR LEGEND!AP1, but the DPR LEGEND grid ends at column AN. The preview instead uses product-specific code lists in DPR LEGEND I:AN, keyed by Product Name.
2. **DPR LEGEND helper list:** H3's formula excludes column L and omits TMRMB-24-380. The preview supplements this source-backed code from L3. Business owner should decide whether the source helper formula should be repaired later.
3. **Unmatched historical codes:** TMWKC-6-2950 is not in the approved DMR Coding helper list. Coding DPR also contains MRMB-24-380 as an unmatched historical code. Preserve raw values and flag them for review; do not auto-correct or delete.
4. **Product Standard / Code Map mismatch:** 58 Product Standard variants and 68 Code Map mappings share 32 codes; 36 Code Map codes have no Product Standard variant, while 26 Product Standard variants have no Code Map mapping. Do not merge, delete or invent missing standards.
5. **Productivity target formula:** Source formula for Target Output divides Product Standard's 12H capacity field by 10 and multiplies by planned run hours. Preserve the source formula until the business owner approves any correction.
6. **Coding DPR total formula:** X sums E, H, K, N, Q and T (batch slots 1–6) and excludes batch-7 quantity W. Preserve this source behavior and display batch 7 separately.
7. **Yield Map target notes:** Source instructions describe some 95% targets as placeholders for products whose average yield is already at least 90%. Confirm target values before treating them as approved thresholds.
8. **Hourly sample rows:** Hourly Meat and Hourly Agri source row 5 contains SAMPLE - delete this row. These rows must not be imported as historical transactions. Active hourly preview data arrays remain empty.
9. **DMP LEGEND worker notes:** Ten worker-name cells contain notes marking people as resigned or AWOL. Preserve these notes/status signals for Admin/HR review; do not silently delete or offer these names as active workers without an approved rule.

## 5. Formula-derived, helper and read-only field treatment

The exact Google Sheets protected-range list is not included in the current connector metadata/cell response. The absence of that field is **not evidence that no protection exists**. The following are formula/helper-derived candidate read-only fields, not a verified list of Google Sheets protected ranges.

| Source worksheet | Formula/helper fields observed | Recommended TFI_NEW treatment |
|---|---|---|
| Production Entry | I, Q, R, W; date/day header formulas | Read-only calculated/trace fields |
| Production Schedule | S:U key/has-data/source-row helpers | Internal/read-only |
| Product Entry | Product-family-specific formulas across 39 blocks | Preserve block-specific read-only calculations |
| OEE | K:U | Read-only calculations/lookups |
| Hourly Meat/Coding/Agri | G:L | Read-only lookup/time/variance/cumulative fields |
| DMR Production | F, G, L | Read-only duration and product-name lookup |
| DMR Coding | F, G, K | Read-only duration and product-name lookup |
| Coding DPR | X | Read-only source total; retain batch-7 exclusion |
| PR MONITORING | G | Read-only status formula |
| co QA | A:X, AE:AH | Derived/calculated; Y:AD manual cost inputs; AI:AL unresolved |
| NON-PROD | G | Read-only working-hours formula |
| DMP - Production | I | Read-only position lookup |
| Productivity | L:V | Read-only derived productivity and product-name fields |
| Product Standard and Specificat | F, G, S; group/helper formulas | Read-only capacity/output formulas; editable inputs remain field-controlled |
| DPR LEGEND | G:H | Read-only formula/helper outputs |
| Yield Map | P:W | Read-only helper formulas; approved map input fields remain controlled |
| Entry Map | C:E | Read-only block/title/row mapping formulas |
| KPI Dashboard / Summary / Yield Log | Formula-derived display | Read-only reporting views |
| KPI Calc / Dash Calc / Hourly Calc | Calculation/helper logic | Internal services; no direct user editing |

### 5.1 Source notes that indicate ownership

Product Standard header notes explicitly identify:
- Column E, Manpower Allocation: EDITED BY PRODUCTION.
- Columns F and G, Production Capacity 12H and 10H: EDITED BY PLANT IE.

F and G are also formula-derived in the inspected rows, so the application should not expose them as ordinary editable fields. Column S, Output per Hr, is formula-derived. Other manual Product Standard inputs (including E, H and U) require field-level permission and owner confirmation.

CO QA columns Y:AD are manual cost inputs, with no validation rules observed in the inspected source. Their authorized owner is not confirmed. AI:AL have labels but no populated values or formulas in the inspected source; do not invent their purpose.

## 6. No-mock-data audit

The project UI Source-Fidelity Standard prohibits fabricated sample transactions, demo KPI values and fake activity records. The following current previews contain illustrative/sample data and must be cleared or replaced with a neutral empty state before UI acceptance:

| Preview | Current issue | Required correction |
|---|---|---|
| Dashboard | Illustrative sample metrics and SAMPLE DATA label | Show neutral blank/dash metrics until real backend data is connected |
| Central Import Inbox | Hardcoded illustrative source rows | Empty review table; no fake source records |
| Import Confirmation / Results | Hardcoded sample rows; defaults to IDs 1,2,3 without supplied IDs | No default sample records; show empty/unavailable state until a real scan selection exists |
| Import History | Six hardcoded sample import batches and fictitious actors/files | Empty history state until actual import batches exist |
| Audit Trail | Hardcoded illustrative events and sample event references | Empty history state until verified events exist |
| Users & Access | Fictitious example.com accounts and Draft Role A/B records | Empty user list or clearly separated role-design prototype; do not present fake accounts as actual users |

The main operational previews generally use blank forms/empty transaction arrays. Source-backed dropdown options and reference lists are permitted; they are not mock transactions. Source rows explicitly marked SAMPLE - delete this row must remain excluded from import.

### 6.1 Master Data preview limitation

Master Data is a static local prototype. It contains nine categories, but visible table rows are only a partial source-derived preview. Its add/edit interactions update local preview arrays only and do not write to the source workbook or database.

Do not describe Master Data as complete, live or import-ready until it loads the full approved reference lists, preserves source identities/notes, and has approved role-specific permissions.

## 7. Locked sheets, protected fields and role recommendations

### 7.1 What is verified and what is not

Verified:
- Formula cells and helper columns identified from live source-cell reads.
- Some validation-backed input fields and exact dropdown sources.
- Product Standard notes indicating Production and Plant IE ownership.
- DMP LEGEND notes marking certain workers resigned/AWOL.

Not verified:
- Exact protected sheet/range list and which people/groups may edit each protected range.
- Whether the workbook protects entire tabs, selected ranges, or only formula cells.
- Final TFI_NEW role names and permission grants.

The current Google Sheets connector returns worksheet properties and cell data but does not expose protectedRanges in the response used for this audit. Do not call any worksheet/tab locked based solely on a formula or helper column. Obtain the actual protection list from the spreadsheet's Protect sheets and ranges panel or an API response that includes protectedRanges before finalizing a protection-to-role matrix.

### 7.2 Recommended UI treatment

- **Calculation/helper tabs:** KPI Calc, Dash Calc and Hourly Calc should not have separate sidebar screens. Rebuild their logic as internal calculation services.
- **Derived reports:** KPI Dashboard, Summary and Yield Log should be read-only views backed by canonical TFI_NEW records.
- **Reference data:** Keep Product Standard, Code Map, Yield Map, Entry Map, KPI Setup, DPR LEGEND, DMP LEGEND, MANPOWER and Schedule Lists within one Master Data workspace, with category- and field-level permissions.
- **Archive:** Removed Rows should be a restricted, view-only archive/reconciliation section. Restoring a row must require explicit review and approval.
- **Manual cost fields:** CO QA Y:AD should only be editable after the business owner identifies the authorized Costing/Finance/QA role. Formula-derived AE:AH stay read-only; AI:AL stay unmapped until defined.
- **Worker references:** MANPOWER and DMP LEGEND should have a designated HR/Manpower or authorized Admin custodian. Resigned/AWOL notes should be visible to reviewers and not silently erased.
- **Product Standard:** Apply separate permissions to Production-owned inputs and Plant IE-owned standards. Formula-generated capacity/output fields remain read-only.

### 7.3 Draft role model — requires owner approval

| Proposed role | Suggested access |
|---|---|
| Administrator | User/role administration, system settings, import controls, audit review and approved master-data administration |
| Production Encoder | Create/edit assigned production, schedule, hourly and downtime records |
| Production Supervisor | Review production records, monitor operations, and perform only explicitly approved review/approval actions |
| Plant IE | Maintain approved production standards and IE-owned reference fields; no direct formula overrides |
| HR / Manpower Custodian | Maintain employee/manpower references and worker active/inactive status |
| QA/QC Personnel | Maintain authorized quality records and CO QA review fields |
| Finance / Costing | Maintain CO QA manual unit-cost inputs if confirmed as the field owner |
| Management / Viewer | Read-only Dashboard and Reports & Reconciliation access |

This is a recommendation, not an approved access matrix. Draft Role A/B in the current Users & Access preview are not final roles and must not be used as production permissions.

## 8. Import-readiness gate

Do not begin historical data transfer or database integration until the following are completed:

1. Clear mock data from Dashboard, Central Import Inbox, Import Confirmation, Import History, Audit Trail and Users & Access.
2. Add the six missing sheetIds to active source data contracts.
3. Reconcile broken Product Code validations and confirm canonical dropdown ownership for DMR Production, DMR Coding, Coding DPR, DMP Production, OEE and Production Entry.
4. Preserve unmatched historical codes and source-row fingerprints for review.
5. Obtain business decisions for Productivity's target formula, Coding DPR's batch-7 exclusion, DPR LEGEND's omitted L3 helper value, Yield Map placeholder targets and CO QA Y:AD / AI:AL.
6. Revalidate all Master Data categories against the full 35-tab source, not only visible prototype rows.
7. Obtain the exact protected-range inventory and approve the field-to-role matrix.
8. Build Reports & Reconciliation for Production Summary, Schedule Summary, Summary and Removed Rows.
9. Run end-to-end import tests for new rows, incomplete identifiable rows, exact duplicates, possible duplicates, unmapped rows, archive rows and derived/helper rows.
10. Obtain explicit approval before any Supabase schema migration or historical import.

## 9. Technical verification performed

- Google Sheets metadata confirmed the official workbook title, ID, 35 worksheet names, sheetIds and grid dimensions.
- Bounded live cell reads checked headers, formula cells, data validations and source notes across operational and reference worksheets.
- All 16 active source data JavaScript files use the official workbook ID; none use the old 28-tab ID.
- Six active source files were identified as missing explicit sheetId metadata.
- Shared router contains 23 routes and all 23 target HTML files exist.
- The three import sub-workflow pages are linked from the import flow.
- 32 JavaScript files passed syntax parsing.
- 27 HTML pages have no missing local script or stylesheet references.
- No source workbook writes, Supabase writes, UI code changes or historical data imports were performed.

**Overall audit status:** Operational UI coverage is complete for the current 35-tab source. Reports & Reconciliation, sample-data cleanup, source-contract metadata completion, protection verification, role approval and source/business-rule decisions remain before import readiness.
