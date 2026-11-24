# TFI Spreadsheet Import Center — UI Design Specification v0.1

**Date:** 18 November 2026  
**Project:** TFI_NEW  
**Screen:** Spreadsheet Import Center  
**Status:** First visual prototype

## 1. Design consistency

The screen follows the approved TFI Admin Dashboard design direction:
- Official Tosen Foods, Inc. logo.
- Forest-green sidebar and white active navigation.
- Light neutral workspace background.
- White content cards with restrained borders and shadows.
- Consistent typography, buttons, spacing, and status treatments.
- Desktop-first layout with responsive behavior.

## 2. Purpose

Provide the Admin with one controlled entry point for selecting an authorized source workbook and preparing it for scanning, classification, review, and import.

The selected workbook is a controlled source for migration and verification. It is not a live operational database and must not create a continuous Google Sheets synchronization dependency.

## 3. Source selection

The design deliberately supports both source methods because the project blueprint has not yet finalized the choice:
1. Upload an authorized XLSX workbook from the computer.
2. Enter an authorized Google Sheets URL for a one-time controlled scan.

The screen does not silently choose one method or imply that either has already been approved.

## 4. Workflow stepper

1. Select source — choose the workbook.
2. Scan and classify — read worksheets and rows.
3. Review and import — validate before staging.

## 5. Main UI sections

### Source workbook card
- Two source-method cards.
- XLSX file selection and drag-and-drop area.
- Google Sheets URL field.
- Source selection readiness.
- Continue to scan preview action.

### Source readiness card
- Source workbook.
- Worksheets detected.
- Rows classified.
- Scan status.

Values remain empty until a real scanning service is connected and returns verified results.

### Import workflow summary
- Read workbook.
- Classify and validate.
- Stage and trace in the Central Import Inbox.

### Recent import batches
- Batch ID.
- Source workbook.
- Scan date.
- Worksheets.
- Rows read.
- Status.

The initial state is an honest empty state: no import batches yet.

## 6. Prototype interactions

- Switch between XLSX and Google Sheets source methods.
- Select an XLSX file and display its filename and size.
- Drag and drop an XLSX file.
- Validate that the selected file has an XLSX extension.
- Enter and basic-format-check a Google Sheets URL.
- Display a clear prototype notice when the user continues.
- Open the Import History placeholder.
- Refresh the empty import batch list.

These are front-end preview interactions only. They do not read workbook contents, authenticate Google Sheets access, scan worksheets, classify records, write to Supabase, or perform imports.

## 7. Data integrity rules reflected in the design

- Do not show fabricated scan counts, worksheet counts, batch IDs, or import statuses.
- Preserve source workbook identity and traceability once scanning is implemented.
- Do not imply that a selected file has been scanned.
- Do not overwrite or import records from a preview interaction.
- Actual scan results must be supplied by the future scanning service.

## 8. Next UI screens

1. Scan Progress and Worksheet Detection.
2. Scan Results and Classification Summary.
3. Central Import Inbox.
4. Duplicate Review and Resolution.
5. Record Detail / Raw Source Preview.
6. Import History.

The actual source method must be approved before implementing the source connector.
