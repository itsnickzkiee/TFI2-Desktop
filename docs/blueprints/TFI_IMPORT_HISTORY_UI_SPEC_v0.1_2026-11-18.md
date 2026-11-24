# TFI Import History — UI Specification v0.1

**Date:** 18 November 2026  
**Project:** TFI_NEW  
**Screen:** Import History  
**Status:** First visual prototype

## 1. Purpose

Import History provides a searchable audit-oriented list of workbook import batches. It allows an Administrator to review when a workbook was processed, who initiated it, the number of source rows, the import outcome, and record-level module breakdown.

## 2. Summary metrics

- Total import batches.
- Records imported.
- Incomplete records imported.
- Exceptions, comprising duplicates skipped, records held for review, and failed rows.

The displayed figures are illustrative and reconciled against the six sample batches in the prototype.

## 3. History table

Columns:
- Batch reference.
- Source workbook and source type.
- Import date and time.
- Initiated by.
- Total source rows.
- Imported rows.
- Incomplete rows.
- Exceptions.
- Batch status.
- View details action.

## 4. Filters and interactions

- Status tabs: All, Completed, Completed with issues, Failed.
- Search by batch reference, workbook name, initiating user, or source type.
- Date period filter: All dates, Today, Last 7 days, Last 30 days.
- View details opens a modal containing batch totals, workbook and user metadata, duration, duplicate/held/failed counts, and module-level outcomes.
- New Spreadsheet Import opens the Spreadsheet Import Center.
- Import History is reachable from the sidebar while in Spreadsheet Import Center, Scan Progress, and Central Import Inbox.

## 5. Status definitions

- Completed: batch processing completed without skipped, held, or failed rows.
- Completed with issues: some rows were imported, but one or more rows were incomplete, duplicate, held, or failed.
- Failed: no rows were imported because the batch could not be processed.

Production status rules should be finalized with the import service and persisted batch result fields.

## 6. Prototype boundary

All six batches, workbook names, user names, timestamps, counts, and module breakdowns are illustrative UI data. Search, filters, and detail modal operate on this sample data only. The screen does not query Supabase, download actual import reports, or display real production history.

## 7. Production requirements

The live implementation should store an immutable import batch record with:
- Unique batch ID.
- Source workbook identity, source type, and file metadata.
- Initiating user and timestamps.
- Scan and import status.
- Total detected, inserted, incomplete, duplicate, held, and failed row counts.
- Module-level result counts.
- Row-level outcome and error reason.
- Links to source worksheet, row number, source fingerprint, and destination record ID where inserted.

History must be derived from persisted batch and row-result records, not from client-side sample values. Access to batch details should follow Admin permissions and preserve audit traceability.

## 8. UI refinement and navigation addendum — 20 November 2026

The existing Import History preview has been refined without introducing fabricated import transactions.

- Replaced the generic preview badge with a **Read-only history** indicator.
- Clarified that the history service is awaiting connection and that this page does not modify operational records.
- Retained em dashes for all summary metrics while no verified batch records are available.
- Added a structured empty state explaining which batch details will appear once the import service records a batch.
- Added a **Start a spreadsheet import** action in the empty state, alongside the page-level New spreadsheet import action.
- Removed the static page-number controls so an empty history does not imply that a page of records exists.
- Made the source type explicit beneath each batch reference when verified batch rows become available.
- Added Escape-key support for closing the batch details modal.
- Kept the existing status tabs, search fields, date-period filter, and batch detail modal structure.

### Navigation behavior

- Import History is reachable from the persistent TFI sidebar while viewing Spreadsheet Import Center, Scan Progress, and Central Import Inbox.
- New spreadsheet import from an embedded Import History page sends navigation to the parent TFI shell, preserving the sidebar and workspace.
- Browser Back restores Import History after opening Spreadsheet Import Center.

### Verification — 20 November 2026

Import History UI and navigation test: **11/11 checks passed**.
- Correct page title and active navigation.
- Verified empty state with no fabricated batch rows.
- Summary metrics remain unpopulated until verified history exists.
- Read-only and existing-record protection notice is visible.
- No static pagination on an empty history.
- Status, search, and date controls respond.
- Empty-state action opens Spreadsheet Import Center.
- Mobile layout has no horizontal overflow at 390px.
- Import History is reachable from Spreadsheet Import, Scan Progress, and Central Import Inbox.
- Embedded New spreadsheet import keeps the TFI shell active.
- Browser Back restores Import History.
- No browser JavaScript errors.

Updated screenshot: `design/import-history-preview.png`.

**Implementation boundary:** This is still a front-end preview. It does not query a live import-history service or display persisted batch records. The production requirements in Section 7 remain pending backend integration.
