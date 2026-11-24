# TFI_NEW — KPI Dashboard UI Specification v0.2

**Date:** 20 November 2026  
**Project:** TFI_NEW  
**Screen:** Main Dashboard / KPI Dashboard  
**Status:** UI preview implemented and browser-tested; live KPI calculation/data connection is not enabled

## 1. Reference and scope

The dashboard layout follows the KPI Dashboard worksheet in the latest identified reference workbook, Copy of TFI - Production Monitoring Sheet 1 (35 worksheets).

The system dashboard reproduces the reference's reporting structure and filter categories, not its cached cell values. The source workbook is used for design and business-label reference only. The system database remains the intended source of truth for future dashboard calculations.

## 2. Main layout

- Existing Tosen Foods green sidebar and module navigation retained.
- Existing shared topbar, administrator profile, and full-screen controls retained.
- Main page title changed to KPI Dashboard.
- Operations-performance subtitle and data-availability notice added.
- Filter bar added with the reference categories:
  - Year
  - View
  - Month
  - Week No.
  - Date
  - Product Name
  - Product Code
  - Machine (OEE)
- Filters remain disabled until verified dashboard data is available.
- Dashboard section tabs added:
  - Overview
  - Hourly Monitoring
  - Productivity
  - Downtime
  - OEE
  - Yield %
  - Quality
  - Production Report

## 3. Overview KPIs

The Overview uses the same KPI categories and labels as the reference dashboard:

1. Total Output (tins)
2. Output Attainment
3. Productivity (tins/MHR)
4. OEE
5. Average Main Yield %
6. FG Reject %
7. Downtime (hrs)
8. % Downtime
9. Machine-Related Downtime (hrs)
10. Manpower-Related Downtime (hrs)
11. MTBF (hrs)
12. Manpower Hours (MHR)

Overview panels:
- Productivity & Output
- Machine vs Manpower
- Downtime Reason Summary per Line
- OEE Snapshot

## 4. Detail sections

### Hourly Monitoring
- Agri, Meat, and Coding line summaries
- Day target
- Actual so far
- Attainment vs day target
- Projected end of day
- Product-code activity

### Productivity
- Total output
- Productivity (tins/MHR)
- Productivity vs standard
- Manpower hours
- Productivity trend and line comparison

### Downtime
- Total downtime
- Machine-related downtime
- Manpower-related downtime
- MTBF and MTTR
- Agri, Meat, and Coding downtime reason breakdowns

### OEE
- Availability
- Performance
- Quality
- OEE
- Machine-level OEE table

The source workbook's OEE section includes a note that its OEE worksheet currently contains sample data. No OEE values or cached results from that section were copied into the system UI.

### Yield %
- Main yield
- Stage 2 yield
- Stage 3 yield
- Total rejects
- Lid / can-end reject %
- Empty can reject %
- Box reject %
- Product-level yield scorecard

### Quality
- FG rejects (tins)
- FG reject %
- Coding and labelling rejects
- Auto insights
- Trend scoreboard

### Production Report
- Days logged
- Average output attainment
- Average attendance
- OT hours
- Rows below 95%
- Product rows logged
- By-production-line report for Agri, Meat, Finishing, and all lines

## 5. No-mock / data integrity rules

- No cached values from the Google Sheet are copied into the application.
- No fabricated output, yield, productivity, downtime, OEE, quality, attendance, or manpower values are displayed.
- No seeded chart series, trend lines, production rows, product codes, or machine records are present.
- KPI values use a neutral em dash while no verified data is available.
- Charts and tables show explicit empty states.
- Filter controls remain disabled until valid options can be sourced from operational data.
- OEE remains blank until the system has independently verified OEE source records.
- No silent fallback to Google Sheets is used for live dashboard values.

## 6. Current data connection state

As checked on 20 November 2026, the Supabase project TFI2 has no application tables in the public schema. Therefore, the dashboard remains a UI preview with empty values and no operational data claims. No database schema, rows, or authentication state were changed for this UI task.

## 7. Interactions

- Dashboard section tabs switch panels without navigating away from the main dashboard.
- Tabs support Left/Right Arrow, Home, and End keyboard navigation.
- The module search filters sidebar navigation items.
- The Open Import Center action opens the existing Spreadsheet Import Center through the shared module router.
- Notification control shows an empty-notification state; no notification badge is shown.

## 8. Responsive behavior

- Desktop KPI cards use a six-column grid.
- Tablet and mobile layouts reduce the KPI and filter grids.
- Section tabs scroll horizontally on narrow screens.
- Dashboard content is constrained to the available shared-shell width.
- No page-level horizontal overflow at 390 × 844 or 320 × 844 viewports.

## 9. Acceptance test results — 20 November 2026

Passed:
- All eight dashboard tabs render and switch correctly.
- Overview is selected by default.
- All eight filter controls are present and disabled while no data is available.
- All 39 KPI display slots remain blank (—).
- All 12 hourly summary slots remain blank (—).
- No sample rows or chart series are present.
- Dashboard section keyboard navigation works.
- Sidebar module search works.
- Open Import Center routes through the shared module workspace.
- Notification empty state works and no alert badge is displayed.
- No duplicate element IDs.
- No browser page errors or console errors.
- No failed local asset requests.
- No page-level horizontal overflow at 390 × 844 and 320 × 844.

**Test result:** KPI Dashboard UI flow passed.

## 10. Implementation files

- design/dashboard-preview.html — main dashboard and shared shell
- design/dashboard-kpi.css — KPI dashboard layout and responsive styles
- design/dashboard-kpi-ui.js — tab, search, import navigation, and notification interactions
- design/test-dashboard-kpi-ui.js — browser acceptance test
- design/dashboard-kpi-desktop.png — desktop screenshot
- design/dashboard-kpi-mobile.png — mobile screenshot
- design/dashboard-preview.html.pre-kpi-dashboard-20261120.bak — pre-change backup

## 11. Completion boundary

The dashboard's reference-aligned UI is complete. Real KPI values, filters, charts, comparisons, and reports require approved operational records and verified calculation logic in the TFI database. No spreadsheet values were used to fill the dashboard, and no database data was changed.