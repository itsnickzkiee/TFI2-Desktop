# TFI Import Workflow UI Audit & Refinement v0.2

**Date:** 20 November 2026  
**Project:** TFI_NEW  
**Scope:** Front-end UI only  
**Status:** Completed and browser-tested  
**Backend / database:** Not connected or modified

## 1. Agreed six-step workflow

1. **Choose module** — select one operational destination for this batch.
2. **Select source** — choose an Excel workbook or an authorized Google Sheets URL.
3. **Scan & classify** — inspect only the worksheet mapped to the selected module.
4. **Review records** — inspect detected source rows and select eligible new records.
5. **Duplicate review** — compare possible matches and decide how to handle incoming rows.
6. **Final import approval** — review the eligible new records and the duplicate-review summary.

## 2. Selective import restrictions retained

- One operational destination module per batch.
- No Import All option.
- Reports & Reconciliation is not an import destination.
- Master Data is not an import destination.
- The destination list contains the 15 operational choices already present in the UI.
- The selected module, mapped worksheet and verified sheetId are carried from the Import Center to Scan Progress.
- The Central Import Inbox is scoped to the selected module; its redundant All modules filter was removed.

## 3. UI refinements completed

- Standardized the workflow progress indicator to six steps on Import Center, Scan Progress, Central Import Inbox, Duplicate Review and Final Import Approval.
- Added the missing Review records stage between Scan & classify and Duplicate review.
- Added a matching workflow stepper to Central Import Inbox.
- Kept the duplicate review summary visible on return to the Inbox and on entry to Final Import Approval.
- Changed the Inbox shortcut label to **Preview duplicate review** so it is clearly identified as a UI preview.
- Disabled **Continue to scan preview** until both a valid destination module and a source workbook / valid Google Sheets URL are selected.
- Preserved the existing-record protection rule: no edit, merge, replacement, deletion or overwrite action is offered.
- Kept Final Import Approval disabled because the real scan selection and import execution service are not connected.

## 4. Browser verification

**All checks passed.**

- Six-step indicator is present on all five import workflow screens.
- Correct active step is shown on each screen.
- The module selector contains 15 operational choices and does not include Import All, Reports or Master Data.
- The Inbox no longer displays an All modules filter for a single-module batch.
- Destination module, worksheet, sheetId and source workbook context carry into Scan Progress.
- Continue button remains disabled until both destination and source are selected.
- A valid .xlsx selection enables the Continue button.
- Google Sheets mode requires a valid Google Sheets URL before Continue is enabled.
- Duplicate decisions carry their totals forward to Final Import Approval.
- Final Import Approval remains unavailable for execution in this front-end preview.
- All five screens fit a 390px mobile viewport without page-level horizontal overflow.
- No browser JavaScript errors were detected during the tests.

## 5. Updated UI files

- `design/spreadsheet-import-center-preview.html`
- `design/scan-progress-worksheet-detection-preview.html`
- `design/central-import-inbox-preview.html`
- `design/duplicate-review-resolution-preview.html`
- `design/import-confirmation-results-preview.html`

## 6. Test and capture files

- `design/test-import-flow-ui-consistency.js`
- `design/test-import-center-validation.js`
- `design/capture-import-flow-six-step.js`
- `design/import-center-six-step-desktop.png`
- `design/scan-progress-six-step-desktop.png`
- `design/import-inbox-six-step-desktop.png`
- `design/duplicate-review-six-step-desktop.png`
- `design/final-import-approval-six-step-desktop.png`

## 7. Back navigation

Back navigation is enabled across the early import stages:

- From Scan & classify, Back returns to Spreadsheet Import Center.
- The selected destination module and selected Excel file are restored when returning through browser history.
- The Continue button is recalculated on page restoration, so a valid restored selection remains usable.
- From Review records, Back returns to Scan & classify with the destination, worksheet, sheetId and source workbook context retained.
- If a screen is opened directly without the expected workflow history, a fallback route carries the available source and destination metadata. A local Excel file must be reselected in that fallback case because browsers do not allow scripts to repopulate a file input.

**Back-navigation browser test: passed.** The test verified the module, Excel file, Continue state, destination worksheet, sheetId and source workbook after returning from both Scan & classify and Review records. No browser JavaScript errors were detected.

## 8. Boundary

This work is a front-end UI refinement only. No production workbook was imported. No live records were read, inserted, updated, merged, deleted or overwritten. Actual scan, duplicate matching, persistence, permissions and import execution remain separate future integration work.
