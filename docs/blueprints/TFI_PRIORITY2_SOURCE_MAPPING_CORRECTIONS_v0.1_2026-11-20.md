# TFI_NEW — Priority 2 Source Mapping Corrections v0.1

**Date:** 20 November 2026  
**Status:** Complete  
**Project:** TFI_NEW  
**Official source workbook:** Copy of TFI - Production Monitoring Sheet 1  
**Spreadsheet ID:** 1rCbQ16wj7MRjQCFF3tA-WEMkudraJK0RkwcqayUlz7k  
**Scope:** Complete the six missing exact worksheet `sheetId` metadata entries and reconcile the source-backed dropdown references identified in the 20 November UI/source audit.

## 1. Six source metadata corrections

All six active local source contracts now identify the official workbook, exact worksheet name, and verified worksheet ID.

| Active source file | Exact worksheet | Verified sheetId |
|---|---|---:|
| `dmp-production-data.js` | DMP - Production | `1312335050` |
| `dmr-production-data.js` | DMR Production | `2048043346` |
| `hourly-meat-data.js` | Hourly Meat | `428082343` |
| `product-entry-data.js` | Product Entry | `545274882` |
| `production-entry-data.js` | Production Entry | `1923467491` |
| `production-schedule-data.js` | Production Schedule | `1538651320` |

Reference worksheet IDs were also checked where applicable:

- DMP Production → DMP LEGEND: `1070169465`
- DMR Production → Code Map: `2098561343`; DPR LEGEND: `508797580`
- Hourly Meat → Code Map: `2098561343`
- Product Entry → Entry Map: `1628314566`
- Production Entry → DPR LEGEND: `508797580`
- Production Schedule → Schedule Lists: `156467196`; Product Standard and Specificat: `2138697021`

## 2. Dropdown/source-reference corrections

- DMP Production: source-backed Product Code, Process and Worker options verified. Significant source whitespace in process values is preserved.
- DMR Production: Product Code and additional dropdown options verified against the local source contract, including source-authored trailing whitespace.
- Hourly Meat: Product Code options verified; entry rows remain blank.
- Product Entry: 39 product-family blocks and selected-block code mapping verified.
- Production Entry: the exact source label `American Corned Beef ` (including its trailing space) is preserved so its product-specific code list resolves correctly.
- Production Schedule: Product Code options now depend on the selected Product Name. Changing the group clears the previous code; Reset clears and disables the code selector.
- DMR Coding: source-backed product, category and factor options verified. Unmatched historical codes are not promoted into approved dropdown options.
- Coding DPR: product-code and line options verified; seven batch slots and unmatched historical codes remain handled as specified by the source.
- OEE: machine, product-code and line options verified against the source-backed reference lists.

No unmatched historical code was automatically normalized, deleted or promoted to an approved option.

## 3. Verification results

| Verification | Result |
|---|---:|
| Six source contracts: syntax, workbook ID, exact worksheet, sheetId, reference IDs and rollback backup | 6/6 passed |
| Priority 2 browser checks across DMP, DMR Production, Hourly Meat, Product Entry, Production Entry, Production Schedule, DMR Coding, Coding DPR and OEE | 33/33 passed |
| Production Schedule initial, group-specific, group-switch and reset behavior | 4/4 passed |
| Browser page/console errors in the tested previews | 0 |

The final browser test output reports: **ALL PRIORITY 2 BROWSER CHECKS PASSED**.

## 4. Backups and files

- The six source data files retain their `.pre-source-mapping-corrections-20261120.bak` rollback copies.
- `production-schedule-preview.html` now has a `.pre-source-mapping-corrections-20261120.bak` rollback copy.
- Verification scripts are retained in the local `design` folder:
  - `verify-priority2.js`
  - `verify-priority2-source-metadata.js`
  - `priority2-browser-test.js`
  - `priority2-schedule-dropdown-state-test.js`

## 5. Change boundaries

- Only local TFI_NEW source-contract/preview files and local verification artifacts were changed.
- No Google Spreadsheet cells, formulas, validation rules or protected ranges were edited.
- No Supabase schema, table, record or permission was changed.
- No historical production data was imported, deleted, normalized or overwritten.
- Import/approval remains on hold until the separately approved import-readiness work is completed.

**Result:** Priority 2 Source Mapping Corrections is complete. The six missing worksheet IDs and tested dropdown-reference issues are resolved in the local preview/source contracts. This completion does not authorize historical import or live spreadsheet writes.
