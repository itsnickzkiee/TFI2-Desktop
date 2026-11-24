# TFI Admin Dashboard — UI Design Specification v0.1

**Date:** 18 November 2026  
**Project:** TFI_NEW  
**Screen:** Admin Dashboard  
**Status:** First visual prototype

## 1. Brand direction

Use the supplied official Tosen Foods, Inc. logo as the primary brand asset.

Initial UI palette sampled from the logo:
- Primary forest green: #086333
- Deep green: #064B29
- Brand red: #ED1C24
- White: #FFFFFF
- Light workspace background: #F4F7F5
- Primary text: #17251D
- Secondary text: #758279

The overall visual direction is a polished corporate Windows business application: clean, confident, readable, restrained, and suitable for daily production operations.

## 2. Dashboard layout

### Left navigation
- Official Tosen Foods logo.
- Dashboard.
- Production: Product Entry, Production Entry, Production Schedule.
- Monitoring: DMP Production, DMR Production, Hourly Monitoring, OEE, Productivity, Yield Monitoring.
- Quality & Control: Coding DPR, CO QA, NON-PROD, PR Monitoring.
- Data & Reports: Spreadsheet Import, Import History, Master Data, Reports.
- Administration: Users & Access, Audit Trail, Settings.
- Administrator account area.

### Top bar
- Current page breadcrumb.
- Module search.
- Notifications.
- Administrator profile.

### Main dashboard
- Dashboard heading and short operational subtitle.
- Clearly marked design-preview notice.
- KPI cards: Production Output, Yield Rate, Overall Equipment Effectiveness, Productivity.
- Production Performance line chart.
- Production Mix chart.
- Module Activity table.
- Spreadsheet Import Center summary.
- Recent Admin Activity.

## 3. Table design standards

- Clear headers and consistent alignment.
- Comfortable row height and spacing.
- Search and filtering where appropriate.
- Readable numeric, date, and percentage values.
- Restrained status indicators.
- Horizontal overflow support for wider module tables.
- No dense spreadsheet-like appearance.

## 4. Data presentation rules

All numerical production values and module activity rows in this first visual prototype are illustrative sample data. They must not be interpreted as live production figures.

The new TFI system has not yet performed its first spreadsheet scan. Therefore, the Import Center summary displays:
- Last scan: Not yet scanned.
- Imported records: 0 records.
- Status: Ready for first scan.

Once the application is connected to its operational data, dashboard figures must be loaded from verified records and the approved calculation logic. Sample values must be removed.

## 5. Interaction included in the prototype

- Sidebar active-state navigation.
- Module search filters the module activity table.
- Chart period selector.
- Export overview invokes browser print.
- Import Center opens an explanatory next-screen dialog.
- Notification control displays the empty notification state.

These interactions are prototype behavior and are not yet connected to production records or database actions.

## 6. UI exclusions

Do not display:
- User guides or how-to instructions.
- Developer notes.
- Technology stack labels.
- Architecture diagrams.
- Debug information.
- Internal database names or file paths.

## 7. Next design screens

After the Dashboard visual direction is approved, continue with:
1. Spreadsheet Import Center.
2. Scan Results and Import History.
3. Central Import Inbox.
4. Duplicate Review and Resolution.
5. Module Data Tables and record details.

The Admin screens should be designed as one consistent application, not as unrelated pages.
