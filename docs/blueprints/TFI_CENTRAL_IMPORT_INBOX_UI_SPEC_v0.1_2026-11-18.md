# TFI Central Import Inbox & Classification Review — UI Specification v0.1

**Date:** 18 November 2026  
**Project:** TFI_NEW  
**Screen:** Central Import Inbox  
**Status:** First visual prototype

## 1. Design consistency

Follows the approved TFI Admin visual direction:
- Tosen Foods, Inc. logo and forest-green navigation.
- White content cards and light neutral workspace.
- Consistent typography, spacing, buttons, borders, and status treatments.
- Spreadsheet Import remains the active sidebar module because this is a workflow screen within that module.
- Breadcrumb identifies the current location: Data & Reports / Spreadsheet Import / Import Inbox.

## 2. Purpose

Provide one central review surface for operational rows detected from a source workbook. The Admin can inspect source traceability, destination module, completeness, import classification, and review reason before preparing eligible records for import.

The Central Import Inbox is the staging and audit ledger for captured operational rows. It is not a separate disconnected import system for each module.

## 3. Summary cards

- Total detected.
- New records.
- Incomplete.
- Existing / duplicates.
- Needs review.

The prototype uses illustrative counts only. Live counts must come from a verified scan batch.

## 4. Classification and treatment

| Classification | Meaning | Import treatment |
|---|---|---|
| Ready to import | New operational row with an identified destination | Eligible for module insert |
| Incomplete | New row with missing required information but an identified destination | Still eligible for module insert; retain Incomplete status |
| Existing duplicate | Exact existing record is confirmed | Block new insert; retain source traceability and existing-record link |
| Possible duplicate | Similar record found but equivalence is uncertain | Hold for Admin review; do not auto-insert or auto-discard |
| Unmapped | Destination module cannot be confidently identified | Keep in Inbox until mapping is resolved |
| Invalid / Unparseable | Source value cannot safely be parsed into the module schema | Keep in Inbox for correction; do not insert yet |
| Derived / Excluded | Formula/report/helper row, not an independent transaction | Retain exclusion reason; do not create an operational record |

Incomplete status alone must never block a new record from entering its identified module table. Completeness and import eligibility are separate concepts.

Exact duplicate prevention must be based on source fingerprint and module-specific business key. Similar-but-uncertain candidates require review rather than automatic duplicate rejection.

## 5. Main review table

Columns:
- Selection checkbox.
- Source worksheet and row.
- Record details.
- Destination module.
- Completeness.
- Import classification.
- View details action.

Each row retains source worksheet, source row, source range, and source fingerprint. The record detail modal presents the reason for its current classification.

## 6. Filters and interactions

- Classification tabs.
- Search across record name, source worksheet, row number, and module.
- Destination-module filter.
- Select individual eligible rows.
- Select all eligible rows.
- Clear selection.
- View record details.
- Prepare selected import action.

Only Ready and Incomplete new records can be selected. Existing duplicates, possible duplicates, unmapped rows, invalid rows, and derived/helper rows are not selectable for insertion.

The Prepare Selected Import button is a preview action only. In the next screen, the user will review the selected set and confirm the import. No database writes occur in this prototype.

## 7. Sample data and prototype boundary

All 8 displayed records, counts, workbook identity, batch ID, source ranges, and fingerprints are illustrative design data. They do not originate from a live TFI scan.

The prototype does not:
- Read the actual workbook.
- Perform real duplicate checks.
- Validate against Supabase.
- Write to Supabase or module tables.
- Recalculate operational formulas.
- Create a real import batch.

## 8. Next screen

**Import Confirmation & Results**:
- Selected record count and module breakdown.
- Complete vs. incomplete record counts.
- Explicit blocked/held row counts.
- Confirmation before insert.
- Import result summary.
- Failed row details and retry-safe outcomes.
- Links back to the source Inbox and batch history.
