# TFI_NEW — Spreadsheet-to-UI Coverage Audit v0.1

**Audit date:** 19 November 2026  
**Project:** TFI_NEW  
**Scope:** Existing 28-tab source workbook compared with current TFI_NEW design previews  
**Source workbook:** Copy of TFI_-_DPR___DMR_2026_KPI_Dashboard_v2  
**Source spreadsheet ID:** 1BzmYYCXRxOrseQK9VlXzucbri_Sv8A2NxHgZskWeJps  
**UI folder audited:** TFI_NEW/design  
**Purpose:** Identify all source-backed operational screens that still need UI before historical data transfer/import.

## 1. Executive result

The source workbook contains **28 worksheets**. The current TFI_NEW design folder already contains previews for the principal entry, monitoring, import, reference, and administration screens.

### Dedicated operational screen still missing

1. PR Monitoring

### Additional planned application screen still missing

Reports & Reconciliation

The remaining operational screen corresponds to a distinct source worksheet. Reports & Reconciliation is a planned application module in the TFI_NEW Master Blueprint; it should be built from validated operational records and calculations, not imported as a separate transaction worksheet.

## 2. Full 28-worksheet coverage matrix

| # | Exact source worksheet | Source role / treatment | TFI_NEW UI destination | UI status |
|---:|---|---|---|---|
| 1 | KPI Dashboard | Derived dashboard / visualization | Dashboard | Existing |
| 2 | Product Entry | Operational input; 39 product blocks | Product Entry | Existing |
| 3 | Summary | Formula-derived rollup from Product Entry | Reports / Dashboard | No separate source-entry UI required |
| 4 | Productivity | Operational productivity readings | Productivity | Existing |
| 5 | OEE | Machine run / OEE input records | OEE | Existing |
| 6 | PR-PPlan | Daily planning and schedule slots | Production Schedule | Existing; source calendar/year mapping is on hold for verification |
| 7 | co QA | Formula-derived QA observations from Product Entry plus packaging-cost fields | CO QA | Existing preview - read-only consolidated view |
| 8 | PR MONITORING | PR quantity, produced quantity, remaining quantity, and status tracking | PR Monitoring | **Missing** |
| 9 | Coding DPR | Coding/labelling date, line, production date, product code, batch quantities | Coding DPR | Existing preview |
| 10 | DMR Coding | Downtime events with stop/resume, duration, category, factor, reason | DMR Coding | Existing preview |
| 11 | DMR Production | Downtime events and production remarks | DMR Production | Existing |
| 12 | Product Standard and Specificat | Product specification/reference data | Master Data → Product Standard | Existing |
| 13 | DMP - Production | Manpower-based production operation records | DMP Production | Existing |
| 14 | DPR LEGEND | DPR product/code reference data | Master Data → DPR Legend | Existing |
| 15 | DMP LEGEND | DMP worker/process reference data | Master Data → DMP Legend | Existing |
| 16 | NON-PROD | Non-production manpower, time, activity, and location records | NON-PROD | Existing source-matched preview; no backend writes |
| 17 | MANPOWER | Employee, position, activity, location, and employment legend list | Master Data → Manpower | Existing UI category; source mapping/ownership still needs approval |
| 18 | KPI Setup | KPI settings, years, months, products, machines, lines, and downtime references | Master Data → KPI Setup | Existing |
| 19 | KPI Calc | Formula/helper calculations for KPI Dashboard | Calculation service | No standalone transaction UI |
| 20 | Code Map | Product-code to product-family mapping | Master Data → Code Map | Existing |
| 21 | Yield Map | Per-product yield/reject source-column mapping and target references | Master Data → Yield Map | Existing |
| 22 | Yield Log | Formula-generated yield view reading Product Entry and Yield Map | Yield Monitoring | Existing read-only monitor; **do not import as independent transactions** |
| 23 | Dash Calc | Dashboard helper calculations | Calculation service | No standalone transaction UI |
| 24 | Hourly Agri | Hourly Agri time-slot production inputs | Hourly Agri | Existing |
| 25 | Hourly Meat | Hourly Meat time-slot production inputs | Hourly Meat | Existing |
| 26 | Hourly Coding | Hourly Coding time-slot production inputs | Hourly Coding | Existing |
| 27 | Hourly Calc | Formula/helper rollups for Hourly Monitoring | Calculation service | No standalone transaction UI |
| 28 | Entry Map | Product Entry family/block layout and mapping | Master Data → Entry Map | Existing |

## 3. Existing TFI_NEW screens verified in the design folder

### Operational screens
- Dashboard
- Product Entry
- Production Entry
- Production Schedule
- DMP Production
- DMR Production
- Hourly Agri
- Hourly Meat
- Hourly Coding
- OEE
- Productivity
- Yield Monitoring
- CO QA (read-only consolidated quality monitor)
- NON-PROD (blank entry rows with source-backed dropdowns)

### Import workflow screens
- Spreadsheet Import Center
- Scan Progress / Worksheet Detection
- Central Import Inbox
- Import Confirmation / Results
- Import History

### Reference and administration screens
- Master Data
- Users & Access
- Audit Trail
- System Settings

These are existing UI preview files, not confirmation that live database integration or production import is complete.

## 4. Important distinctions for the UI build

### 4.1 PR-PPlan is not the same as PR MONITORING
The PR-PPlan tab is titled "PR Monitoring and Daily Production Schedule" and contains PR request details plus daily planning slots. It maps to the existing **Production Schedule** UI.

The separate **PR MONITORING** tab contains PR-level requested quantity, produced quantity, remaining quantity, and status. It needs its own **PR Monitoring** UI.

### 4.2 DMR Coding is not the same as DMR Production
The source workbook has two separate tabs with different field layouts and records:
- DMR Coding: downtime event inputs including Factor and Reason.
- DMR Production: downtime event inputs including Remarks.

The TFI_NEW Master Blueprint also lists DMR Coding and DMR Production separately. Do not silently merge these screens or their source rows. A dedicated DMR Coding screen or clearly separated DMR submodule is required.

### 4.3 Yield Log is derived, not a new transaction source
The live Yield Log sheet explicitly states that each row is formula-generated from a product sheet and that the selected source columns are configured in Yield Map. Its formulas read Product Entry and Yield Map. Keep Yield Monitoring as a read-only monitoring view; do not import Yield Log rows as independent production records.

### 4.4 Calculated tabs are not transaction modules
KPI Calc, Dash Calc, Hourly Calc, and Summary are formula/helper outputs. Rebuild their results from approved operational records and reference data. Do not create duplicate transactions by importing these tabs.

### 4.5 Master Data is one UI with multiple source categories
The current Master Data preview already contains:
- Product Standard
- Code Map
- Yield Map
- Entry Map
- KPI Setup
- DPR Legend
- Manpower
- DMP Legend
- Schedule Lists

These reference categories do not each require a separate standalone operational screen.

## 5. Recommended UI build order

Build and review one screen at a time, reusing the existing TFI shell and design standards:

1. Coding DPR - preview completed.
2. DMR Coding - preview completed separately from DMR Production.
3. CO QA - preview completed as a read-only consolidated view derived from Product Entry.
4. NON-PROD - source-matched preview completed; no historical transactions preloaded.
5. **PR Monitoring** - next missing source-backed screen for PR-level progress and remaining-quantity tracking.
6. **Reports & Reconciliation** - planned derived application screen after operational module definitions are confirmed.

The exact field layout, filters, actions, calculations, and statuses must be taken from the source sheet and approved module rules. Do not invent missing company rules.

## 6. Data-transfer safeguards

- Build the missing operational UIs before beginning historical data transfer.
- A UI preview is not proof that the source mapping, backend, or import workflow is production-ready.
- Keep raw source worksheet and row identity for traceability.
- Do not import derived/helper tabs as separate transactions.
- Keep unresolved mappings on hold until source ownership and field mapping are approved.
- The existing worksheet mapping/reconciliation workbook describes its inventory as partial and not production-certified. UI completion alone does not remove those data-mapping gates.
- Do not change the original source workbook or the old TFI project while building TFI_NEW.

## 7. Next action

Proceed with **PR Monitoring UI** as the next missing source-backed screen. Do not start Supabase integration or data transfer yet. After the remaining operational screen is designed and reviewed, perform a separate module-by-module source-to-UI and import-readiness check.


## 8. Coding DPR source-structure correction (verified 19 November 2026)

A deeper inspection of Coding DPR!A:X confirms **seven** production batch groups, not six:

- Batch 1: C:E
- Batch 2: F:H
- Batch 3: I:K
- Batch 4: L:N
- Batch 5: O:Q
- Batch 6: R:T
- Batch 7: U:W
- Total Quantity: X

The existing source formula in X3 is `=SUM(E3,H3,K3,N3,Q3,T3)`. It sums only the first six quantity columns and **does not include W (Batch 7 Quantity)**. A source row in the inspected range uses Batch 7, while its displayed Total Quantity matches the six-column formula and excludes Batch 7.

The Coding DPR UI therefore displays all seven source groups. To preserve current workbook behavior, its Source Total mirrors the existing six-column formula, while Batch 7 quantity is shown separately and visibly flagged as excluded from that source total pending business-rule approval. Do not silently change the total formula during migration.


## 9. Implementation update — Coding DPR UI and shared sidebar navigation

**Completed:** 19 November 2026

### Coding DPR UI files created
- `design/coding-dpr-preview.html`
- `design/coding-dpr.css`
- `design/coding-dpr-ui.js`
- `design/coding-dpr-data.js`
- `design/coding-dpr-preview.png`

The UI uses the source worksheet's A:X layout, seven batch groups, three line-number options observed in the source (1, 2, 3), and 115 distinct Product Code options from the DPR LEGEND range I3:I215. It starts with 12 blank rows and supports adding 12 more rows, clearing the current preview form, per-row total calculation, and summary counts. No historical transactions are preloaded and no live database save is claimed.

The Source Total follows the existing formula exactly (E, H, K, N, Q, T). Batch 7 Quantity (W) is visible and separately summarized because the source formula does not include it.

### Shared sidebar navigation fix

Updated `design/tfi-preview-router.js` and `design/tfi-shell-controls.js`. Before a module route change, the current navigation scroll ratio is saved in session storage. The next module restores the same relative scroll position, including when different pages have slightly different navigation heights. This applies to all preview pages that load the shared router and shell controls.

### Verification performed
- Coding DPR page loads with 12 rows, 25 table columns, and 7 batch groups.
- 115 Product Code options are loaded from the source reference list.
- Test quantity in one of the first six slots updates Source Total; Batch 7 quantity updates its separate summary without changing Source Total.
- Coding DPR page passed browser load with no page JavaScript errors.
- Navigation scroll ratio was preserved across module navigation and when returning to Coding DPR.

**Next UI to build:** DMR Coding.


## 10. Coding DPR shell styling correction — verified 19 November 2026

The user-provided screenshot showed that Coding DPR's module content stylesheet was loading, but the shared shell baseline was absent. The page linked `tfi-shell-standard.css`, which is a refinement/override layer and assumes base shell styles (body typography/background, green sidebar, navigation buttons, brand panel, profile, topbar, and content layout) are already present. Unlike several older module previews, Coding DPR did not include those base styles inline.

### Fix
- Created `design/tfi-shell-base.css` containing the reusable TFI shell baseline.
- Updated `design/coding-dpr-preview.html` to load stylesheets in this order: `tfi-shell-base.css`, `tfi-shell-standard.css`, then `coding-dpr.css`.
- Kept Coding DPR's own table, seven batch groups, summary cards, and module styling separate.
- Refined sidebar scroll restoration to save/restore only the actual navigation panel's scroll ratio. The fixed sidebar container itself is not the scrolling element.

### Validation
- Opened the exact local `file:///C:/Users/Rominick/Desktop/TFI_NEW/design/coding-dpr-preview.html?sidebar=expanded` route in headless Chrome.
- Confirmed Segoe UI typography, green gradient sidebar (258px), white topbar, 12 blank rows, and seven batch groups.
- Confirmed zero browser JavaScript errors on local file load.
- Tested navigation scroll at approximately 73%: Coding DPR → Audit Trail → Coding DPR. The nav restored at 73.07% on Audit Trail and 72.99% on return to Coding DPR.

The user can refresh the local preview with Ctrl+F5 to load the new shared shell stylesheet.


## 11. Implementation update — static sidebar and DMR Coding UI

**Completed:** 19 November 2026

### Static sidebar interaction
- Updated `design/tfi-shell-standard.css` to disable hover/press transforms, translations, animations, and transitions on `.nav-link` controls.
- Sidebar module buttons retain their hover/active color treatment but no longer nudge, lift, or animate when pointed at or clicked.
- Added the `DMR Coding` navigation entry after `DMR Production` in the existing 22 routable preview pages and added the route in `design/tfi-preview-router.js`.
- Navigation scroll restoration remains ratio-based. Browser testing confirmed the Coding DPR → DMR Coding route restores the same 62.07% navigation scroll ratio; DMR Coding → DMR Production also retained the lower navigation position proportionally.

### DMR Coding source inspection

Source workbook: `Copy of TFI_-_DPR___DMR_2026_KPI_Dashboard_v2`  
Source worksheet: `DMR Coding` (`sheetId: 75251033`)  
Source range: `DMR Coding!A1:K12317`  
Grid: 12,317 rows × 11 columns; 3 frozen rows.

- Historical records occupy rows 4–4722 (4,719 records). The first blank, formula-backed template row is 4723.
- Group headers: Details (A:E) and Downtime (F:K).
- Exact field order: Date; Product Code; Line; Stop; Resume; Time in Mins; Time in Hours; Category; Factor; Reason; Product Name (auto).
- Formula fields: F = G × 60; G = MOD(E − D, 1) × 24; K looks up Product Code in Code Map A5:B400 and falls back to `Other`.
- Blank template row 4723 validation ranges: Product Code from DPR LEGEND I3:I18862 (115 distinct choices); Category from DPR LEGEND B3:B19217 (8 choices); Factor from DPR LEGEND D3:D19217 (13 choices).
- Line has no data-validation rule. AGRILINE and MEATLINE are the two distinct values observed in source rows; the UI uses an editable text field with those values as suggestions.
- The Product Code validation range changes across historical rows; the UI uses the latest blank-template row's validation range, not the older historical-row range.

### DMR Coding UI files created
- `design/dmr-coding-preview.html`
- `design/dmr-coding.css`
- `design/dmr-coding-data.js`
- `design/dmr-coding-ui.js`
- `design/dmr-coding-preview.png`

The preview begins with 12 blank entry rows mapped to source rows 4723–4734. It includes 115 product-code choices, 8 categories, 13 factors, line suggestions, automatic product-name lookup, and source-formula-equivalent elapsed-time calculations (including midnight rollover). Time in Mins, Time in Hours, and Product Name are read-only derived fields. Add 12 Rows, Clear Form, and a preview-only Save action are provided. No historical transactions are preloaded and no live database writes are performed.

A synchronized floating header keeps the two source header rows visible when the entry table is scrolled vertically and follows horizontal table scrolling.

### Verification performed
- Local browser load returned HTTP 200 with no JavaScript errors.
- Initial state: 12 blank rows, 11 source fields, active DMR Coding navigation, and no toast/error state.
- Formula test: Stop 23:55 and Resume 00:10 produced 15 minutes and 0.2500 hours; Product Code MDP-100-155 resolved to DPGP.
- Add Rows increased 12 rows to 24 and mapped the last added row to source row 4746; Clear Form reset all inputs and derived values.
- Save action clearly states that database saving is not connected and no data has been saved.
- Floating header appeared during vertical scrolling and synchronized its horizontal offset with the table scroll position.
- Sidebar hover computed transform `none` and transition duration `0s`; module navigation and active state passed browser tests.

**Next UI to build:** CO QA.


### Sidebar flicker / jumping correction — 19 November 2026

The first static-interaction pass removed link transforms and transitions, but a follow-up browser comparison identified a second cause of the perceived highlight movement: module preview pages did not share identical navigation markup and spacing. Some pages omitted Hourly Meat / Hourly Coding / Hourly Agri or used a combined Hourly Monitoring item; some module styles also overrode the vertical margins on sidebar buttons. The earlier ratio-based scroll restoration could therefore reposition the active item when the target page had a different sidebar height.

**Corrective changes applied:**
- Standardized the sidebar navigation markup across all 24 HTML preview pages to the same 24 module links, group labels, order, and icons. Each page has its own correct active module; the module placeholder reads its requested module from the URL and activates the matching link.
- Enforced a shared `2px 0` vertical margin on every `.nav-link`, so module-specific global button rules cannot alter sidebar geometry.
- Replaced delayed, two-frame ratio restoration with synchronous, exact-pixel `nav.scrollTop` restoration. Legacy ratio values remain readable for one transition.
- Disabled smooth scrolling and scroll anchoring on the shared navigation. The active link has no transform, transition, animation, or hover lift.
- Clicking the already-active module no longer reloads the current preview page. Clicking another module changes the active class immediately before routing.
- The import-confirmation screen now uses the same data-page navigation and shared router behavior.

**Verification:**
- All 24 preview pages load 24 identical sidebar links in the same order.
- Browser-measured navigation content height is identical at 1,176px across all pages at a 1,600×1,000 viewport; all link margins resolve to 2px 0.
- Exactly one active module is present on each fixed-module page; the placeholder activates its query-selected module.
- Navigating Coding DPR → DMR Coding → DMR Production preserved `scrollTop=247px` exactly on every page; no ratio-based jump occurred.
- Clicking the already-active DMR Production item did not reload the page.
- Import Confirmation → DMR Coding → CO QA placeholder preserved the same 247px scroll position and selected the correct active module.
- Computed nav `scroll-behavior:auto`, active-link `transform:none`, and `transition-duration:0s`. Browser tests reported no JavaScript errors.

This correction supersedes the earlier ratio-based restoration note in the initial implementation update.


### Persistent-sidebar navigation correction — 19 November 2026

The user-provided screen recording confirmed that the remaining flicker was caused by full-document navigation between separate module preview HTML pages. The prior scroll-preservation and CSS transition fixes could not prevent the browser from rebuilding the entire page on every module click.

**Architecture change:**
- Replaced full-page navigation in `tfi-preview-router.js` with a persistent outer shell. The original page's sidebar remains mounted in the parent document; module workspaces load in a single content iframe.
- Clicking a module synchronously updates the active sidebar item, then changes only the iframe source. The outer sidebar DOM, scroll container, and page lifecycle remain unchanged.
- The embedded workspace hides its duplicate sidebar and renders its own module topbar/content at full available width. Both the standard `.shell/.main` layout and the Dashboard's distinct `.app-shell/.main-shell` layout are supported.
- The iframe is detected as embedded even when an internal module action navigates to another preview page without query parameters; its sidebar remains hidden and the outer navigation stays persistent.
- Browser history stores the selected module in the query string; opening or refreshing a module deep link reconstructs the embedded workspace.
- Existing module files and their page-specific scripts remain separate and unchanged; this is a UI navigation-shell change only. No database or operational data was modified.

**Browser verification (Chrome, 1,600×1,000):**
- Tested all 24 sidebar destinations in sequence. Each displayed the expected active module and corresponding page title.
- The parent sidebar DOM identity and parent `performance.timeOrigin` remained unchanged through every module switch.
- The sidebar scroll position remained exactly 247px across all 24 programmatic module clicks; no automatic repositioning occurred.
- All embedded pages hid their duplicate sidebar and rendered the workspace at the full iframe width. Dashboard's alternate shell layout was verified separately.
- Deep-link refresh test restored DMR Production in the iframe with the correct active outer sidebar item.
- No JavaScript errors were reported in the 24-destination browser test.

**Expected user behavior:** clicking another module changes the white active highlight immediately while the green sidebar remains stationary; only the module content area is replaced.


## 12. CO QA UI and navigation blank-flash correction — 19 November 2026

### CO QA source inspection

- Source worksheet: `co QA`; sheetId `274508256`; grid 2,745 rows × 40 columns; UI represents A:AL (38 source columns).
- `co QA!A3` contains an array formula that combines Product Entry identity fields and QA-specific product-block fields into A:X, then sorts the consolidated records. The QA observation counts in G:X are therefore sourced from Product Entry, not independently entered in CO QA.
- The co QA header row leaves D:F blank; Product Entry's source headers identify these fields as PR No, No. of Batches, and Total FG.
- Y:AD are blank in the inspected populated source rows and have no validation rules.
- AE:AH contain four formula patterns: AE = SUM(G:X)-SUM(N:Q); AF = AE*AA; AG = AE-SUM(O:S); AH = AG*AB.
- AI:AL have source labels but no formulas or populated values in the inspected source rows. No formula behavior was invented.

### CO QA UI files created
- `design/co-qa-preview.html`
- `design/co-qa.css`
- `design/co-qa-data.js`
- `design/co-qa-ui.js`
- `design/co-qa-preview.png`
- `design/co-qa-viewport.png`

The CO QA screen is a read-only consolidated monitoring view because A:X is formula-derived from Product Entry. It preserves the seven source header groups and all 38 columns A:AL. The **Open Product Entry** action routes through the parent shell. The preview contains no historical transaction rows and no backend writes. Packaging unit-cost fields and unresolved AI:AL totals remain unpopulated.

### Navigation issue shown in the uploaded video

The video showed a blank/white content flash while a module page was being replaced. The shared router was updated from a single iframe to a double-buffered workspace. The current module remains visible while the next module loads in a hidden iframe; the new page is shown only after its load event and module identity are confirmed. The previous page is retained in the second iframe for quick return. The original sidebar remains mounted and its active highlight changes immediately.

### Verification
- CO QA preview loaded in Chrome with HTTP 200 and no JavaScript errors.
- Header columns count = 38; grouped-header spans sum to 38; empty state has no historical rows.
- All 24 sidebar destinations were tested; every active module and loaded module matched.
- The old module remained visible during the next module's loading period; no blank workspace was exposed.
- Parent sidebar DOM identity and page lifecycle stayed unchanged; scrollTop 247px was preserved across all 24 route changes.
- CO QA → Open Product Entry correctly navigated the parent application shell.
- No JavaScript errors in the 24-destination navigation test.

**Next UI to build:** NON-PROD.


## 13. Normal Chrome local-file navigation fix — 19 November 2026

**User-reported regression:** sidebar module clicks did not change the content after opening the CO QA preview directly in normal Chrome.

**Root cause confirmed:** the previous router inspected `iframe.contentDocument` and `iframe.contentWindow.location` in its load handler. Chrome's normal local-file security model blocks a parent `file://` page from reading another local `file://` iframe unless the browser is started with a special file-access flag. The earlier automated test had used that flag, so it did not reproduce the user's ordinary Chrome setup.

**Correction:**
- Removed all parent-side reads of the iframe document and URL.
- The embedded module announces its own readiness to the parent using `postMessage`, including the module name and request token.
- The parent accepts the readiness message only from one of its own module frames and only when the expected module and latest request token match.
- The double-buffer swap still occurs only after the embedded page has fully loaded; the previous module remains visible while the next page loads.
- This uses standard cross-window messaging and requires no Chrome flags or weakened browser security.

**Verification in ordinary Chrome mode (no `--allow-file-access-from-files`):**
- Opened CO QA directly as a local file and confirmed the router initialized.
- Clicked all 24 sidebar destinations; all 24 showed the expected active item and loaded module.
- Exactly one module frame was visible after each switch; fallback content was hidden only after the new module was ready.
- No JavaScript errors or failed requests were reported.
- CO QA → Open Product Entry was tested through the embedded module's parent-window message.
- Router syntax check passed.


## 14. NON-PROD UI implementation - 19 November 2026

**Completed:** Source-matched NON-PROD preview created.

### Source worksheet findings
- Workbook: `Copy of TFI_-_DPR___DMR_2026_KPI_Dashboard_v2`.
- Worksheet: `NON-PROD`; sheetId `593515400`; grid 1,000 rows x 26 columns; two frozen header rows.
- Operational fields occupy A:J, with grouped headings DATE (A), MANPOWER (B:C), TIME (D:G), Activities (H), Location (I), and Remarks (J).
- B Name, C Position, H Activities, and I Location have strict dropdown validations linked to MANPOWER!A4:A500, B4:B16, C4:C60, and D4:D39.
- The source ranges contain 445 name entries (15 duplicates retained), 8 positions, 48 activities, and 36 locations.
- F Total of minutes is manually entered; the source does not calculate it from Time Start and Time End.
- G No. of Working Hours follows `=F3/60` through row 668. The UI keeps G read-only and blank while F is blank.
- Source rows 3:22 contain 20 existing records and are not loaded into the preview. Rows 23:668 provide 646 blank entry rows with the working-hours formula; dropdown validation continues through row 1,000.

### UI files created
- `design/non-prod-preview.html`
- `design/non-prod.css`
- `design/non-prod-data.js`
- `design/non-prod-ui.js`
- `design/non-prod-preview.png`
- `design/non-prod-viewport.png`
- `design/non-prod-mobile.png`

### UI and navigation verification
- Direct Chrome preview returned HTTP 200 and loaded without JavaScript errors.
- Source group header spans and all 10 fields were verified.
- Twelve initial blank rows were rendered with no historical transactions.
- Source dropdown option counts per row: 445 names, 8 positions, 48 activities, and 36 locations.
- Entering 600 minutes displayed 10.00 hours; blank minutes kept the formula cell blank.
- Add 12 Rows mapped the expanded 24-row form to source rows 23:46; Clear Form cleared the preview fields; Save displayed the no-backend/no-save notice.
- DMR Production -> NON-PROD -> CO QA navigation passed; parent sidebar identity and 190px scroll position were preserved; one frame was visible after each swap.
- Mobile test at 390 x 844 passed; the table scrolls horizontally inside its own container without page-level horizontal overflow.
- No Google Sheet edits, backend writes, or historical data transfers were performed.

**Next missing operational UI:** PR Monitoring.


## 15. Source baseline superseded — 20 November 2026

The previous 28-tab audit was based on `Copy of TFI_-_DPR___DMR_2026_KPI_Dashboard_v2` (spreadsheet ID `1BzmYYCXRxOrseQK9VlXzucbri_Sv8A2NxHgZskWeJps`). It is no longer the official source baseline for new TFI_NEW work.

The user selected `Copy of TFI - Production Monitoring Sheet 1` (spreadsheet ID `1rCbQ16wj7MRjQCFF3tA-WEMkudraJK0RkwcqayUlz7k`) as the official 35-tab reference. Use the new audit `TFI_35_TAB_SOURCE_TO_UI_AUDIT_v0.1_2026-11-20.md` for the complete worksheet inventory, sheet IDs, dimensions, source-to-UI mapping, stale UI source references, and next work order.

Do not rely on this 28-tab coverage matrix for current source mappings without checking the official 35-tab audit. Existing visual previews remain in place; stale source IDs and formula/validation differences must be revalidated before import readiness. No source workbook or UI code was changed by this superseding note.


## Current module-level validation pointer — 20 November 2026

This 28-tab coverage audit is a historical comparison only. For current active module source mappings and UI revalidation, use TFI_8_MODULE_SOURCE_ALIGNMENT_VALIDATION_v0.2_2026-11-20.md together with TFI_35_TAB_SOURCE_TO_UI_AUDIT_v0.1_2026-11-20.md. Do not use the old workbook ID as the active source baseline.
