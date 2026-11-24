# TFI Import Confirmation & Results — UI Specification v0.1

**Date:** 18 November 2026  
**Project:** TFI_NEW  
**Screen:** Import Confirmation & Results  
**Status:** First visual prototype

## 1. Purpose

This screen is the fourth and fifth stage of the controlled Spreadsheet Import workflow. It receives the selected eligible record IDs from the Central Import Inbox, shows a final confirmation summary, and presents a result view after the Admin confirms.

## 2. Confirmation view

The confirmation screen includes:
- Four-step workflow progress.
- Selected record count.
- Complete and incomplete counts.
- Number of destination modules.
- Selected-record table with source worksheet, source row, record details, destination module, completeness, and eligibility.
- Import summary with module breakdown.
- Duplicate-protection notice.
- Explicit Admin acknowledgement checkbox.
- Confirm & Import action, disabled until acknowledgement is checked.

Incomplete new records remain eligible if the destination module is identified. Exact existing records are excluded from the selected set. Possible duplicates, unmapped rows, invalid rows, and derived/helper rows remain outside the eligible selection.

## 3. Results view

After confirmation, the prototype changes to an Import Results view showing:
- Prepared sample records.
- Count of incomplete sample records included.
- Row-level preview outcomes.
- Return navigation to the Inbox or Spreadsheet Import Center.

## 4. Navigation

Central Import Inbox → Prepare Selected Import → Import Confirmation → Confirm & Import → Import Results.

The selected record IDs are passed as a URL query parameter in this local prototype. Back navigation returns to the Central Import Inbox.

## 5. Prototype boundary

All rows and counts are illustrative sample data. The confirmation action only switches the UI to a simulated results view. It does not:
- Read or validate a live workbook.
- Query Supabase for duplicate detection.
- Insert into Supabase or operational module tables.
- Run production formulas or calculations.
- Create an actual import batch.
- Guarantee transactional or retry-safe behavior.

## 6. Production requirements

The live implementation must:
- Revalidate selected records server-side at confirmation time.
- Recheck exact duplicate business keys and source fingerprints to prevent concurrent duplicate insertion.
- Preserve incomplete status while allowing insertion where destination mapping is known.
- Keep possible duplicates on hold until Admin resolution.
- Write each accepted record to its correct module table and create import-batch/source-trace records.
- Use transaction-safe and retry-safe insertion behavior.
- Report inserted, skipped, held, and failed rows separately, including reasons and retry guidance.
- Preserve source worksheet, source row, and original values for audit and traceability.
