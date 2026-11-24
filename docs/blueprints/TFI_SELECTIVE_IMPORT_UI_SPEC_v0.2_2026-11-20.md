# TFI Selective Spreadsheet Import UI Specification v0.2

**Date:** 20 November 2026  
**Project:** TFI_NEW  
**Area:** Data & Reports → Spreadsheet Import  
**Status:** UI preview implemented and browser-tested; scanner and import backend are not connected

## 1. Purpose

Replace the broad workbook-wide import choice with a module-first workflow. The Admin selects one operational destination module before selecting the source workbook. Each import batch is scoped to that module's mapped worksheet.

**No Import All action is provided.** If more than one operational module must be imported, the Admin starts a separate batch for each module.

## 2. Four-step workflow

1. Choose module.
2. Select source — upload an authorized .xlsx file or paste an authorized Google Sheets URL.
3. Scan & classify — inspect only the selected module's mapped worksheet.
4. Review & import — inspect eligible, incomplete, existing, possible duplicate, unmapped and derived records before staging.

The selected destination module, source worksheet and verified sheetId are passed through Scan Progress to the Central Import Inbox.

## 3. Allowed import destinations

The following 15 operational/input destinations are sourced from the official 35-tab source-to-UI audit.

| Group | Application destination | Exact source worksheet | Verified sheetId |
|---|---|---|---:|
| Production | Product Entry | Product Entry | 545274882 |
| Production | Production Entry | Production Entry | 1923467491 |
| Production | Production Schedule | Production Schedule | 1538651320 |
| Monitoring | DMP Production | DMP - Production | 1312335050 |
| Monitoring | DMR Production | DMR Production | 2048043346 |
| Monitoring | DMR Coding | DMR Coding | 675328096 |
| Monitoring | Hourly Meat | Hourly Meat | 428082343 |
| Monitoring | Hourly Coding | Hourly Coding | 1916766220 |
| Monitoring | Hourly Agri | Hourly Agri | 534145404 |
| Monitoring | OEE | OEE | 1750442014 |
| Monitoring | Productivity | Productivity | 1688444278 |
| Quality & Control | Coding DPR | Coding DPR | 1266086431 |
| Quality & Control | CO QA | co QA | 1359678099 |
| Quality & Control | NON-PROD | NON-PROD | 1381857831 |
| Quality & Control | PR Monitoring | PR MONITORING | 867256143 |

## 4. Explicit exclusions

These are not import destinations:

- Reports & Reconciliation and report/history outputs such as Production Summary, Schedule Summary, Summary and Removed Rows.
- Master Data and reference/configuration tabs such as Product Standard, Code Map, Yield Map, Entry Map, KPI Setup, DPR LEGEND, DMP LEGEND, MANPOWER and Schedule Lists.
- Dashboard and calculation/helper tabs such as KPI Dashboard, KPI Calc, Dash Calc and Hourly Calc.
- Yield Monitoring / Yield Log because it is formula-derived from Product Entry and Yield Map, not an independent operational transaction source.
- GUIDELINES and Lists documentation/reference content.

## 5. UI behavior

- Destination is required before Continue is allowed.
- Choices are grouped into Production, Monitoring, and Quality & Control.
- On selection, the UI displays the exact source worksheet and verified sheetId.
- The right-side Source Readiness panel displays the selected destination.
- The four-step progress indicator begins at Choose module.
- Scan Progress displays the selected module, source worksheet and sheetId.
- Scan Progress explicitly states that other workbook tabs are excluded from the batch.
- The selected module and source metadata are carried into the Central Import Inbox URL.
- Responsive layout was checked at 390px with no page-level horizontal overflow.
- Reports and Master Data are not present in the destination selector.

## 6. Data-integrity boundaries

- UI selection does not itself read or import spreadsheet data.
- The source workbook remains unchanged.
- The scanning service must enforce the selected worksheet scope server-side; the UI query parameters are not an authorization boundary.
- Formula/helper columns remain derived or read-only according to each source mapping.
- Duplicate detection and record resolution remain separate review stages.
- Backend role enforcement, Google access validation, scanner, duplicate-resolution engine, staging and database writes remain pending.

## 7. Local implementation files

- `design/spreadsheet-import-center-preview.html`
- `design/scan-progress-worksheet-detection-preview.html`
- `design/build-selective-import-flow.js`
- `design/finish-selective-import-scan.js`
- `design/test-selective-import-flow.js`

Rollback copies:
- `spreadsheet-import-center-preview.html.pre-selective-import-20261120.bak`
- `scan-progress-worksheet-detection-preview.html.pre-selective-import-20261120.bak`

## 8. Browser verification

**All 13 browser checks passed.**

- Exactly 15 operational destination choices.
- Group labels are Production, Monitoring, Quality & Control.
- Reports, Master Data, summary/report outputs, Removed Rows, Yield Monitoring and Import All are absent from the selector.
- Destination selection is required before continuing.
- All 15 module-to-worksheet mappings and sheetIds were checked against the source audit.
- DMR Production selection resolves to worksheet DMR Production / sheetId 2048043346.
- Four-step workflow is displayed on Import Center and Scan Progress.
- Selected destination is carried into Scan Progress and Central Import Inbox.
- Scan-scope message specifies that only the mapped worksheet is in scope.
- No browser errors.
- Mobile viewport 390px: no page-level horizontal overflow.

**Important:** These checks validate the UI workflow only. The real scanning service and import backend are not connected yet.
