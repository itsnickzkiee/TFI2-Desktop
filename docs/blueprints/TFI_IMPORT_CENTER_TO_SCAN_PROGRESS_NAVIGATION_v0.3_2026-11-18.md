# TFI Spreadsheet Import Center and Scan Progress — Navigation Update v0.3

**Date:** 18 November 2026  
**Project:** TFI_NEW  
**Screens:** Spreadsheet Import Center → Scan Progress & Worksheet Detection

## 1. Navigation relationship

Spreadsheet Import Center and Scan Progress are two sequential screens inside the same **Data & Reports → Spreadsheet Import** workflow.

The user does not open Scan Progress from a separate sidebar item.

The expected flow is:
1. Open Spreadsheet Import from the sidebar.
2. Select an XLSX workbook or enter an authorized Google Sheets URL.
3. Click **Continue to Scan Preview**.
4. The application navigates to Scan Progress & Worksheet Detection.
5. The selected source summary appears on the Scan Progress screen.
6. The user can return to Spreadsheet Import using **Back to import center**.

The sidebar continues to highlight Spreadsheet Import on both screens because they belong to the same module. The breadcrumb and three-step workflow indicate the current screen and stage.

## 2. Preview navigation implementation

The two local HTML previews now use a URL query-parameter handoff to pass selected source metadata:
- XLSX: file name and file size.
- Google Sheets: source type and display name.

Scan Progress reads these values and displays the selected source name and source method.

The route and source display were checked using a test workbook name. The selected source metadata appears on the Scan Progress screen.

This is a preview-only metadata handoff. The selected local file's binary contents are not transferred or parsed by this navigation.

## 3. Production application requirement

In the actual Windows application, the workflow should use one application shell and internal navigation (not open a new browser tab or require the user to locate another HTML file).

The selected XLSX File object or uploaded source reference must remain available to the scanning service. For Google Sheets, the application must securely authorize access and pass a validated source reference.

The scanner must then read the workbook, detect worksheets and used ranges, inspect values and formulas, classify records, and return verified results.

## 4. Current implementation boundary

The current preview supports:
- Select XLSX or Google Sheets source method.
- Basic file extension and URL checks.
- Navigate from Import Center to Scan Progress.
- Pass source metadata and display it on Scan Progress.
- Return to Import Center.

The current preview does not yet:
- Parse the XLSX file.
- Authenticate or read Google Sheets.
- Detect worksheets or rows.
- Read formula cells.
- Classify records.
- Insert records into Supabase.

No live scan or database import is claimed by this prototype.
