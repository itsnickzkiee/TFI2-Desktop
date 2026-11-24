# TFI Module Import Inbox — UI Specification v0.1

**Date:** 20 November 2026  
**Project:** TFI_NEW  
**Area:** Data & Reports → Module Import Inbox  
**Scope:** Front-end UI only  
**Status:** Implemented and browser-tested  
**Backend / database:** Not connected or modified

## 1. Design decision

The Module Import Inbox is one shared UI workspace scoped to one selected operational destination module. It is not a separate import engine, duplicate data store, or independent workflow for every module.

- The Central Import Inbox remains the batch-level review surface in the six-step spreadsheet-import workflow.
- The Module Import Inbox is the module-wide staging view across saved batches for the selected destination.
- The selected module determines the mapped source worksheet and verified sheetId.
- The same module-scoped Inbox data model is expected to serve every destination.
- No Import All action or cross-module batch is introduced.

This preserves the existing Central Import Inbox and selective-import architecture.

## 2. Purpose

Provide an at-a-glance staging workspace where an Administrator can review source rows captured for one destination module before eligible new records are prepared for the module's Draft workflow.

The screen makes the data-protection rule explicit: new incomplete records remain eligible for Draft preparation, while existing records and confirmed duplicates are blocked from re-import. The workspace does not offer edit, replace, merge, or delete actions against existing operational records.

## 3. Supported destination modules

The module selector contains the same 15 operational/input destinations and source mappings approved in the selective-import specification.

| Group | Application destination | Source worksheet | Verified sheetId |
|---|---|---|---:|
| Production | Product Entry | Product Entry | 545274882 |
| Production | Production Entry | Production Entry | 1923467491 |
| Production | Production Schedule | Production Schedule | 1538651320 |
| Monitoring | DMP Production | DMP - Production | 1312335050 |
| Monitoring | DMR Production | DMR Production | 2048043346 |
| Monitoring | DMR Coding | DMR Coding | 675328096 |
| Monitoring | Hourly Meat | Hourly Meat | 428082343 |
| Monitoring | Hourly Coding | Hourly Coding | 1916766220 |
| Monitoring | Hourly Agri | Hourly Agri | 534145404 |
| Monitoring | OEE | OEE | 1750442014 |
| Monitoring | Productivity | Productivity | 1688444278 |
| Quality & Control | Coding DPR | Coding DPR | 1266086431 |
| Quality & Control | CO QA | co QA | 1359678099 |
| Quality & Control | NON-PROD | NON-PROD | 1381857831 |
| Quality & Control | PR Monitoring | PR MONITORING | 867256143 |

Reports, Master Data, formula-derived reports, and helper/reference tabs are not import destinations.

## 4. Module inbox summary

The page presents five summary indicators, populated only when a verified module Inbox connection is available:

- Total staged records.
- Ready for Draft.
- Incomplete · Eligible.
- Existing · Protected.
- Held for review.

The current UI preview shows an em dash rather than fabricated zero counts or sample transactions because no live module Inbox records are connected.

## 5. Record handling

| Inbox status | UI treatment |
|---|---|
| Ready for Draft | New record; eligible for future Draft preparation |
| Incomplete · Eligible | New record with missing required fields; retained and still eligible |
| Existing / duplicate | Protected; cannot be selected for re-import |
| Held for review | Not eligible until mapping, parsing, or duplicate uncertainty is resolved |

Completeness and import eligibility are separate. An incomplete new record must not be silently discarded solely because required fields are missing.

## 6. Main table and controls

The record table reserves these columns:

- Selection checkbox.
- Record / business key.
- Source worksheet / row.
- Source batch.
- Completeness.
- Inbox status.
- Captured timestamp.
- View details action.

Controls:
- Destination module selector grouped by Production, Monitoring, and Quality & Control.
- Status tabs: All records, Ready for Draft, Incomplete, Existing / duplicate, Held for review.
- Search across record/business key, source worksheet, row, batch, and review reason.
- Source-batch filter placeholder, disabled until verified batch data are connected.
- Select all eligible records and clear selection.
- Prepare selected Drafts action, disabled until Phase 4 integration is available.
- New Spreadsheet Import action, carrying the selected module into the Import Center.
- Back to batch review action, preserving available module and source context.

## 7. Navigation and context

- The Central Import Inbox has an **Open module inbox** action.
- The selected module, mapped worksheet, verified sheetId, source workbook context, source type, and batch reference are carried into the Module Import Inbox when available.
- Changing the selected module updates the URL and source mapping, clears stale batch-specific context, and retains the shared inbox screen.
- The Module Import Inbox is registered in the TFI preview router.
- The shared TFI shell, sidebar collapse control, and full-screen control are retained.

## 8. Responsive behavior

- Desktop: four-part module context, five summary indicators, filter toolbar, and full-width table.
- Tablet: context cards and summary indicators reflow.
- Mobile: module context stacks vertically, summary cards use two columns, and the record table scrolls within its own container.
- The 390px mobile test produced no page-level horizontal overflow.

## 9. Prototype boundary

This is a UI-only preview. It does not:
- Read or write the live Google workbook.
- Load live module Inbox rows.
- Perform live duplicate detection.
- Create operational Draft records.
- Update, merge, replace, or delete existing operational records.
- Write to Supabase or any operational database.

The page intentionally contains no illustrative transaction rows. Counts remain unpopulated until a verified module Inbox data source is connected. Draft promotion remains a separate Phase 4 integration task.

## 10. Files

Created:
- `design/module-import-inbox-preview.html`
- `design/test-module-import-inbox.js`
- `design/test-module-import-inbox-entry.js`
- `design/capture-module-import-inbox.js`
- `design/module-import-inbox-preview.png`

Updated:
- `design/central-import-inbox-preview.html` — added the Open module inbox action and context-preserving route.
- `design/tfi-preview-router.js` — registered the Module Import Inbox route.

## 11. Verification

Module Import Inbox browser test: **14 checks passed**.
- Correct title and initial destination context.
- Correct worksheet and sheetId mapping.
- Active navigation state.
- All 15 destination choices present.
- No fabricated transactions or counts.
- Module switching updates the mapping and clears stale batch context.
- Status tabs and search interaction.
- No page-level overflow at 390px.
- New Import carries the selected module.
- Back to batch review preserves the selected module.
- No browser JavaScript errors.

Central Import Inbox entry test: **5 checks passed**.
- Open module inbox route.
- Module, worksheet, and sheetId preserved.
- Source workbook and batch context preserved.
- Entry origin tracked.
- No browser JavaScript errors.

Existing import workflow consistency test: **11 checks passed**.  
Existing import back-navigation test: **9 checks passed**.

**Result:** Module Import Inbox UI is ready for visual review. Live inbox data and Phase 4 Draft promotion are not yet implemented.

## 12. Direct module entry — implementation addendum v0.2

A compact **Import Inbox** shortcut is now available in the top bar of all 15 operational destination modules.

- The shortcut sits beside the shared Full screen control.
- Desktop shows the icon and the “Import Inbox” label.
- Mobile uses a compact 36px icon-only control with an accessible title and label.
- The shortcut passes the current destination module, mapped worksheet, verified sheetId, and `from=module-page` context.
- In the embedded TFI shell, the shortcut uses the parent module router so the persistent shell and sidebar remain in place.
- The Module Import Inbox displays a contextual Back action, such as **Back to DMR Production**.
- Returning to the originating module restores the previous module workspace; browser Back also restores the module Inbox and its destination context.

The shared TFI navigation now exposes **Module Import Inbox** directly after **Spreadsheet Import**. The shared shell inserts this navigation item only when it is not already present, avoiding duplicates on the Module Import Inbox page.

## 13. Additional files and updates

Created:
- `design/tfi-module-inbox-shortcut.js` — shared module-aware top-bar shortcut.
- `design/test-module-inbox-shortcuts.js` — direct-entry, embedded-shell, mobile, return-navigation, and browser-history tests.
- `design/debug-module-inbox-shortcut.js` — temporary routing diagnostic.
- `design/capture-module-inbox-shortcut.js` — screenshot capture utility.
- `design/module-inbox-shortcut-dmr-production.png` — module page showing the shortcut.
- `design/module-inbox-direct-dmr-production.png` — destination-scoped Inbox after using the shortcut.

Updated:
- All 15 operational module preview pages load the shared shortcut script.
- `design/tfi-shell-controls.js` — adds the Module Import Inbox sidebar item where missing.
- `design/tfi-preview-router.js` — passes module context into the embedded Inbox route and restores it through browser history.
- `design/module-import-inbox-preview.html` — includes originating module routes and contextual Back behavior.

## 14. Additional verification

Direct shortcut test: **15/15 operational modules passed**.
- Shortcut appears in the shared top-bar actions.
- Correct destination key, label, source worksheet, and sheetId are passed.
- Back action returns to the exact originating module.

Embedded shell navigation: **passed**.
- Shortcut opens the Module Import Inbox inside the existing TFI workspace.
- Parent sidebar highlights Module Import Inbox.
- Module context is preserved.
- Back returns to the original module without leaving the TFI shell.
- Browser Back restores the module Inbox and its original destination context.

Mobile shortcut: **passed**.
- 36px icon-only control.
- No page-level horizontal overflow at 390px.

Regression tests:
- Module Import Inbox: **14/14 passed**.
- Direct module shortcut and shell navigation: **7/7 checks passed**.
- Six-step import workflow consistency: **11/11 passed**.
- Import back-navigation: **9/9 passed**.
- No browser JavaScript errors in the tested flows.

**Updated result:** Direct module-to-Inbox navigation is implemented for all 15 operational destinations. This remains a front-end preview; live Inbox records and Phase 4 Draft promotion are still separate integration work. No operational records or database data were changed.
