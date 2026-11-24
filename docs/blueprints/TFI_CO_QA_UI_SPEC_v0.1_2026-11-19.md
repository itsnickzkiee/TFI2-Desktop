# TFI_NEW — CO QA UI Specification v0.1

**Date:** 19 November 2026  
**Source workbook:** Copy of TFI_-_DPR___DMR_2026_KPI_Dashboard_v2  
**Spreadsheet ID:** 1BzmYYCXRxOrseQK9VlXzucbri_Sv8A2NxHgZskWeJps  
**Source worksheet:** `co QA`  
**Source sheetId:** `274508256`  
**Source grid:** 2,745 rows × 40 columns; no frozen rows  
**Source columns represented:** A:AL (38 columns)  
**UI status:** Preview created; no backend writes

## 1. Source behavior and ownership

The `co QA` worksheet is not an independent QA transaction-entry table.

- Cell `co QA!A3` contains an `ARRAY_CONSTRAIN(ARRAYFORMULA(SORT(...)))` expression that combines Product Entry identity fields and QA-specific product-block fields, then sorts the combined records by the first column.
- The array formula consolidates the Product Entry ranges into columns A:X. The QA observations in G:X are therefore sourced from the Product Entry QA blocks.
- The `co QA` worksheet's own row 2 leaves D:F header labels blank. Those fields are inherited from Product Entry: `PR No`, `No. of Batches`, and `Total FG`.
- Creating a second editable QA transaction form here would duplicate fields already entered in Product Entry. The CO QA UI is therefore a consolidated, read-only monitoring view with a direct navigation action to Product Entry.

## 2. Source column map

| Columns | Source group | Exact source fields |
|---|---|---|
| A:F | Record identity | Date; Product; Can size; PR No*; No. of Batches*; Total FG* |
| G:L | FINISHED GOODS | Dented; False seam; Flipper; Bulged; Panel; Buckling |
| M:N | QA SAMPLE | Retention; Q.A Samples |
| O:R | LIDS/COVER | Dented/ Curl; Teardown; From Underweight; Rusty |
| S:X | CANS | Teardown; Dented from seamer; Dented from filler; Underweight; Dented flange (SD); Can wshr/ Palletizer (SD)/ Dented Body/Rusty |
| Y:Z | Unit cost fields | Labels (cost pr piece); Box (Cost per piece) |
| AA:AD | Unit cost fields | CAN (Cost per piece); LIDS/COVER (Cost per piece; LABELS (Cost per piece); BOX (Cost per piece) |
| AE:AH | Formula outputs | total cans; Cost of cans; total lids; Cost of lids |
| AI:AL | Label-only outputs | total Labels; Cost of Labels; total Box; Cost of box |

* D:F labels are taken from the source Product Entry headers because the `co QA` header cells are blank while the array formula brings across Product Entry columns A:F.

The UI retains the original group labels and left-to-right source order. Columns Y:Z remain outside the `PACKAGING MATERIALS TOTAL COST` group, matching the source worksheet's row 1.

## 3. Formula and field findings

### Formula-backed columns

- AE — `=SUM(G3:X3)-SUM(N3:Q3)`
- AF — `=AE3*AA3`
- AG — `=AE3-SUM(O3:S3)`
- AH — `=AG3*AB3`

These are shown as read-only formula outputs in the source map.

### Source fields without confirmed rules

- Y:AD are blank in the inspected populated source rows and have no data-validation rules. The preview does not seed or calculate unit-cost values.
- AI:AL have visible labels but no formulas or populated values in the inspected source rows. The preview leaves them unresolved and does not invent totals or cost formulas.

## 4. UI files created

- `design/co-qa-preview.html`
- `design/co-qa.css`
- `design/co-qa-data.js`
- `design/co-qa-ui.js`
- `design/co-qa-preview.png`
- `design/co-qa-viewport.png`

### UI behavior

- Uses the shared TFI shell, topbar, sidebar, logo, and Quality & Control navigation.
- Displays the full A:AL source structure with seven grouped header bands spanning 38 source columns.
- Shows source-field behavior for A:X, Y:AD, AE:AH, and AI:AL.
- Includes an **Open Product Entry** action. In the embedded application shell, it requests parent navigation rather than reloading the full page.
- The initial table contains no historical or illustrative transaction rows. It displays a neutral empty state.
- No independent CO QA transaction writes or backend integration are connected.

## 5. Navigation/loading issue correction

The attached screen recording showed a blank/white flash in the content area while switching modules. The earlier single-iframe implementation removed the old module before the new page had finished loading.

The shared router now uses a **double-buffered module workspace**:

- The original module remains visible as a fallback until the first embedded module is ready.
- Two iframe workspaces alternate. The currently visible module remains on screen while the next module loads in the hidden frame.
- Once the next page fires its load event and its requested module identity is confirmed, the router swaps visibility.
- The previous module remains cached in the second frame, so returning to the last module can be immediate.
- The outer sidebar stays mounted. Active highlight changes synchronously; sidebar scroll position is not reset by module navigation.
- The CO QA **Open Product Entry** action uses a parent-window message, allowing the shared router to change modules without reloading the parent document.

### Verification

- CO QA local preview returned HTTP 200 and loaded with no JavaScript errors.
- Exactly 38 source columns were rendered; grouped header spans total 38 columns.
- No historical transaction rows were loaded.
- The empty-state message is visible at the left edge of the horizontally scrollable source table.
- Tested all 24 sidebar destinations in Chrome at 1,600 × 1,000. Every destination selected the correct active item and loaded its expected module.
- The previous content remained visible during module loading; no empty workspace was exposed between swaps.
- Parent sidebar DOM identity and page lifecycle remained unchanged throughout navigation.
- Sidebar scroll position remained at 247px across all 24 module switches using non-scrolling click dispatch.
- Embedded module sidebars remained hidden.
- CO QA → Open Product Entry correctly navigated the parent shell to Product Entry.
- No JavaScript errors were reported in the 24-destination test.

## 6. Next UI

**NON-PROD** — inspect the exact source worksheet and build its source-matched UI next. Do not import historical transactions or connect live writes during this preview stage.


## 7. Normal Chrome navigation compatibility fix

The original double-buffer router attempted to read the child iframe's `contentDocument` and `contentWindow.location`. Chrome's normal `file://` security policy blocks this access unless a special browser flag is enabled, which caused the module click to change the highlight but leave the previous workspace visible.

The router now uses a cross-origin-safe readiness handshake. Each embedded module sends its module name and request token to the parent with `postMessage` after its load event. The parent verifies the message source against its own iframe references and checks both the expected module and current request token before swapping the visible frame. No special Chrome launch flag is needed and browser security settings remain unchanged.

**Ordinary Chrome verification (no `--allow-file-access-from-files`):** 24/24 sidebar destinations passed; correct active item and loaded module on every click; one visible module frame after each switch; no JavaScript errors. CO QA → Open Product Entry also passed.
