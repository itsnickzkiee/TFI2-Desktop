# TFI Duplicate Review & Resolution UI Specification v0.1

**Date:** 20 November 2026  
**Project:** TFI_NEW  
**Area:** Data & Reports → Spreadsheet Import workflow  
**Status:** UI preview implemented and browser-tested; duplicate matching service and import backend are not connected

## 1. Purpose

Provide a dedicated Admin review step for possible duplicate records detected during a selected-module import. The Admin compares the incoming source row with a possible existing record and decides how to handle only the incoming row.

The existing operational record is always read-only.

## 2. Workflow position

1. Choose module.
2. Select source workbook.
3. Scan & classify the selected worksheet.
4. Duplicate Review & Resolution.
5. Final Import Approval.

The selected destination module, worksheet, sheetId, workbook name, batch reference and selected row IDs are carried through the workflow.

## 3. Permitted decisions

| Admin decision | Incoming row outcome | Existing record |
|---|---|---|
| Confirm duplicate | Excluded from this import batch | Unchanged and read-only |
| Not a duplicate | Retained as a separate new row; proceeds to validation | Unchanged and read-only |
| Keep on hold | Excluded until the candidate is verified | Unchanged and read-only |

There is no merge, update-existing, replace, delete or overwrite action.

Exact existing matches are excluded from import automatically and are not offered for modification in this review screen. Possible matches require a manual decision. A candidate on hold blocks progression to final approval until it is resolved.

## 4. UI contents

- Selected destination module, source worksheet and verified sheetId.
- Five-step workflow indicator.
- Summary cards for possible matches, high-confidence matches, medium-confidence matches and on-hold candidates.
- Read-only protection guidance.
- Filters for all, high confidence, medium confidence, pending, resolved and on-hold candidates.
- Search by incoming source row and existing record reference.
- Side-by-side candidate comparison with matching evidence.
- Three decision actions with explicit incoming-row consequences.
- Progress indicator and a gated Continue to Final Import Approval button.
- Return-to-Inbox summary showing confirmed duplicates excluded, distinct new rows cleared, on-hold rows and pending rows.

## 5. Sample data and preview boundaries

The three visible candidate pairs are illustrative UI sample data only. They are not sourced from a live workbook or production database. The sample queue is used to demonstrate comparison, resolution, filters, hold behavior and navigation.

Actual confidence scoring, field-level matching, existing-record lookup and resolution persistence require the scanner and duplicate matching service. UI query parameters are not a security boundary; the backend must validate user role, destination, source scope and record permissions.

## 6. Integration

- Central Import Inbox has a Review duplicates entry point.
- The Prepare selected import action routes through Duplicate Review before Final Import Approval.
- The selected module and source metadata carry into Duplicate Review.
- Returning to the Inbox carries a review summary.
- Continuing to Final Import Approval carries the duplicate-review totals and destination context.
- Final Import Approval displays the review summary but remains disabled because no real scan records or import service are connected.

## 7. Files

- `design/duplicate-review-resolution-preview.html`
- `design/central-import-inbox-preview.html`
- `design/import-confirmation-results-preview.html`
- `design/test-duplicate-review.js`
- `design/test-duplicate-review-integration.js`

## 8. Browser verification

**All duplicate-review and integration checks passed.**

- Three illustrative candidates render with confidence and mapped-field evidence.
- Candidate comparison modal opens and shows incoming versus existing record details.
- Existing record is visibly locked/read-only.
- Confirm duplicate excludes the incoming row.
- Not a duplicate clears the incoming row as a separate new record for validation.
- Keep on hold is reflected in the summary and blocks final approval.
- All candidates resolved enables progression to Final Import Approval.
- Duplicate-review summary and destination context carry back to the Inbox and forward to Final Import Approval.
- Five-step progress is visible.
- Mobile viewport has no page-level horizontal overflow; comparison table scrolls within its own container.
- No browser JavaScript errors.
- Final import remains disabled because backend execution is not connected.

**Important:** This is a front-end workflow preview. No production data has been read, changed, inserted, merged, deleted or overwritten.
