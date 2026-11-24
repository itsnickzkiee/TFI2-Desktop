# TFI Scan Progress & Worksheet Detection — UI Design Specification v0.1

**Date:** 18 November 2026  
**Project:** TFI_NEW  
**Screen:** Scan Progress & Worksheet Detection  
**Status:** First visual prototype

## 1. Design consistency

This screen follows the approved TFI Admin Dashboard and Spreadsheet Import Center direction:
- Official Tosen Foods, Inc. logo.
- Forest-green sidebar and white active navigation.
- Light neutral workspace.
- White cards, restrained borders, and subtle shadows.
- Consistent typography, buttons, spacing, and status treatments.
- Desktop-first layout with responsive behavior.

## 2. Purpose

Provide the Admin with a clear view of workbook scanning progress and worksheet detection. The screen will eventually show the result of reading the selected workbook, including detected worksheet names, used ranges, row counts, formula-cell counts, classification, and destination module.

## 3. Workflow position

1. Select source — completed after a workbook is selected.
2. Scan and classify — current screen.
3. Review and import — next stage after successful scanning and classification.

## 4. Main UI sections

### Source workbook banner
- Selected workbook name.
- Source method or file details when available.
- Current source status.

### Scan summary metrics
- Worksheets detected.
- Rows inspected.
- Formula cells.
- Scan duration.

These values must come from the actual scan service. The prototype uses blank values rather than invented scan counts.

### Workbook scan card
- Start scan action.
- Cancel action.
- Progress indicator.
- Scan phases:
  1. Open workbook.
  2. Detect sheets.
  3. Read rows.
  4. Classify data.

### Detected worksheets table
Columns:
- Worksheet.
- Used range.
- Rows detected.
- Formula cells.
- Classification.
- Destination module.

The table starts with an empty state until a real scan returns worksheet data.

### Scan summary side panel
- Workbook.
- Worksheets.
- Operational rows.
- Derived/helper rows.
- Unmapped rows.
- Scan result.

### Scan activity panel
Shows time-ordered scan events such as source access, worksheet detection, row reading, and classification.

## 5. Data integrity rules reflected in the design

- Do not fabricate worksheet counts, row counts, formula counts, scan duration, or scan status.
- Preserve source worksheet and row traceability.
- Distinguish operational rows from derived/helper data.
- Unmapped rows must remain visible for review rather than being assigned to an uncertain module.
- Incomplete but readable records may still be imported when their target module is identified.
- Formula-only and helper/report rows must not become independent operational transactions.
- A failed or interrupted scan must not silently produce a completed status.

## 6. Prototype interactions

- Start scan action displays a prototype notice.
- Cancel action displays the no-active-scan state.
- Worksheet search and status filter are represented in the interface.
- Back navigation returns to the Import Center preview.
- Continue to review remains disabled until a real scan is completed.

These controls are visual preview interactions only. The screen is not yet connected to the workbook parser, Google Sheets authorization, classification engine, or Supabase.

## 7. Next UI screen

**Scan Results & Classification Review / Central Import Inbox** — the Admin will inspect the detected operational rows, incomplete records, exact duplicates, possible duplicates, unmapped rows, and derived/helper rows before import processing.

