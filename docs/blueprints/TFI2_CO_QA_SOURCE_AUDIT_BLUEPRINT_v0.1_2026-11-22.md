# TFI2 Phase 5 — CO QA Source Audit and Contract Blueprint

**Date:** 22 November 2026  
**Module order:** 12 of 13  
**Status:** Source contract and guard tests implemented; canonical operational backend remains blocked by explicit business-rule hold  
**Database:** TFI2 Supabase project only; no CO QA schema migration applied

## 1. Official source identity

- Workbook: `Copy of TFI - Production Monitoring Sheet 1`
- Spreadsheet ID: `1rCbQ16wj7MRjQCFF3tA-WEMkudraJK0RkwcqayUlz7k`
- Worksheet: `co QA`
- sheetId: `1359678099`
- Grid: 2,745 rows × 40 columns (A:AN)
- Group heading row: 1
- Field header row: 2
- First output row: 3
- Current Import Center registry: `module_key=co_qa`, `source_kind=mixed_transaction`, `contract_status=hold_pending_business_rule`, `header_rows=[2]`, `first_data_row=3`.

## 2. Verified source structure

The first output row, A3, contains a single `ARRAY_CONSTRAIN(ARRAYFORMULA(SORT(...)))` formula. It combines multiple non-contiguous ranges from the Product Entry worksheet, sorts the combined data by its first output column in descending order, and spills 24 columns into A:X.

The spill draws from Product Entry's 39 registered product blocks, but the CO QA output does not carry the originating Product Entry record UUID or block_key. The visible row number is not a durable identity.

### A:X — Product Entry-derived output

| CO QA columns | Mapped source fields |
|---|---|
| A:F | Date produce, Product code, Can Size, PR No, No. of Batches, Total FG |
| G:M | Dented, False seam, Flipper, Bulged, Panel, Buckling, Retention |
| N:X | Q.A Samples, Dented/Curl, Teardown, From Underweight, Rusty, Teardown, Dented from seamer, Dented from filler, Underweight, Dented flange (SD), Can washer/Palletizer (SD)/Dented Body/Rusty |

The A:F labels are inherited from Product Entry's row-7 headers; the CO QA row-2 header cells D:F are blank in the inspected worksheet.

### Y:AD — manual cost inputs

| Column | Source label |
|---|---|
| Y | Labels (cost pr piece) |
| Z | Box (Cost per piece) |
| AA | CAN (Cost per piece) |
| AB | LIDS/COVER (Cost per piece) |
| AC | LABELS (Cost per piece) |
| AD | BOX (Cost per piece) |

These values are manually entered against the visible sorted spill rows. They must not be attached to a row number that can move when Product Entry records change or the A3 sort order changes.

### AE:AH — existing formula outputs

| Column | Source label | Formula pattern from row 3 |
|---|---|---|
| AE | total cans | `=SUM(G3:X3)-SUM(N3:Q3)` |
| AF | Cost of cans | `=AE3*AA3` |
| AG | total lids | `=AE3-SUM(O3:S3)` |
| AH | Cost of lids | `=AG3*AB3` |

These are derived outputs and are not manual inputs. TFI2 must not accept imported values as user-entered amounts or silently substitute a different formula.

### AI:AL — unresolved formula outputs

| Column | Header | Finding |
|---|---|---|
| AI | total Labels | Header exists; no formula found in inspected source rows. |
| AJ | Cost of Labels | Header exists; no formula found in inspected source rows. |
| AK | total Box | Header exists; no formula found in inspected source rows. |
| AL | Cost of box | Header exists; no formula found in inspected source rows. |

AM:AN are blank in the inspected layout.

## 3. Why the existing business-rule hold must remain

The live Import Center registry explicitly marks CO QA as `hold_pending_business_rule`. The audit confirms the reason is substantive:

1. A:X is a sorted formula spill from Product Entry and loses the originating Product Entry UUID and block_key.
2. The original worksheet places Y:AD beside visible sorted spill rows, so historical row-position values cannot safely be imported without stable provenance. TFI2 now stores new Y:AD values in a separate versioned child record keyed to the Product Entry UUID.
3. AE:AH are calculated outputs, not editable source facts.
4. AI:AL have headers but no formulas in the inspected source rows.
5. A unique CO QA transaction key cannot safely be inferred from Date, Product Code, Can Size, PR No, batch count, or displayed row number without confirming repeat-batch rules.

Do not remove the hold or create a standalone CO QA CRUD table until these points are resolved. No source rows were imported and the Google Sheet was not modified.

## 4. Safe target architecture for owner review

- Treat the QA/rejection data in A:X as a projection of canonical Product Entry records, joined by the Product Entry record UUID and block_key. Do not persist the formula spill as a second copy of the same transaction.
- **Implemented:** Store manually maintained Y:AD cost inputs in a separate versioned CO QA cost record keyed to the stable Product Entry record UUID. Never key cost values by the current CO QA row number.
- Calculate AE:AH as read-only outputs after the owner confirms the formula meaning and units.
- Keep AI:AL unavailable until the owner supplies the intended formulas or explicitly approves that they remain blank.
- Define repeat-batch behavior and a stable source identity before enabling duplicate checks, edit/version rules, import promotion, or historical migration.
- Preserve source row, spreadsheet ID, sheetId, source fingerprint and import batch provenance when a reviewed Phase 6 path is eventually approved.

This architecture is a proposal derived from the inspected workbook and existing TFI2 Product Entry design; it is not yet an approved business rule.

## 5. Initial source-audit checkpoint (22 November 2026)

- Added `src/tfi_backend/co_qa_contract.py` with the exact source identity, A:X source-field mapping, Y:AD manual cost mapping, AE:AH formula outputs, AI:AL unresolved outputs, explicit hold reasons, and a classifier that never promotes rows.
- Added `tests/backend/test_co_qa_contract.py`.
- Python compilation passed.
- Focused CO QA contract tests: 7 passed.
- No Supabase migration, canonical table, CRUD API, cost save, or import promotion was created. Existing `co_qa` registry status remains `hold_pending_business_rule`.

## 6. Remaining decisions before Phase 5 CO QA completion

1. **Completed:** Y:AD unit-cost values are linked to each individual Product Entry record UUID. The TFI2 child-table design is deployed.
2. Confirm whether Y/Z and AC/AD are intentionally distinct cost values or legacy duplicate columns. TFI2 currently preserves all six source columns separately without merging them.
3. **Mapped:** The original A3 formula includes 31 of the 39 Product Entry blocks. The 31 source ranges feeding G:X are mapped in TFI2 and formula-only source columns are explicitly marked pending. Verify the projection against actual saved Product Entry records.
4. Confirm the formula meaning and units for AE:AH, then validate their per-block source inputs and reproduce only approved calculations.
5. Supply formulas for AI:AL or explicitly approve leaving those outputs unavailable.
6. For any future historical import, establish source-row provenance and repeat-batch identity rules; do not infer them from the visible sorted row number.

Until items 2–5 are approved and tested, keep the overall CO QA module and its historical import destination in review/hold. NON-PROD remains the next module in the approved order (13). Official seven-phase roadmap unchanged.

## 7. TFI2 implementation update — Product Entry-linked unit costs (22 November 2026)

Owner confirmation received: each Y:AD value is stored against the individual Product Entry record UUID, not the sorted CO QA worksheet row.

### Database and security

- Applied TFI2 migration `20261122121228_tfi2_co_qa_cost_records`.
- Added `public.tfi_co_qa_cost_records`: one optional cost record per Product Entry UUID, with six distinct numeric Y:AD fields, six-decimal precision, non-negative checks, version, and creator/updater metadata.
- Added `public.tfi_co_qa_cost_revisions`: append-only before/after snapshots, changed fields, reason, actor, and version.
- Added permission-checked RPC `public.tfi_upsert_co_qa_cost_record`. New costs require `co_qa.create`; changes require `co_qa.edit`; both require `co_qa.view` and `product_entry.view`.
- RLS permits authorized reads only. Direct authenticated INSERT/UPDATE on the cost table are denied; writes go through the RPC. Audit events are written on create and update.
- No Product Entry source record or historical CO QA source row was created/imported. Current Product Entry, cost, and cost-revision counts remain zero.

### API and UI

- Added TFI_NEW endpoints for CO QA catalog, Product Entry-backed record listing, version-checked cost save, and cost revision history.
- Added Product Entry-linked Y:AD cost editor in the CO QA screen, with product-block/date filters, paged record loading, and revision history.
- UI keeps all six source columns distinct. It does not create duplicate QA transactions or invent AI:AL formulas.
- Added a source note that AE:AH remain unavailable in the operational view until their complete per-block input mapping is verified.

### Verification

- CO QA contract/API tests: 16 passed across focused suites.
- CO QA browser workflow with mocked API: PASS; cost create/update payload and revision history rendered; zero browser console errors.
- Rolled-back TFI2 SQL smoke test: synthetic Product Entry parent, cost create, version-2 partial update, revision, audit events, stale-version rejection, negative-value rejection, and unknown-field rejection all passed. Transaction rolled back.
- Full backend regression suite: **306 passed**.
- Python compilation and JavaScript syntax checks passed.
- TFI_NEW health: HTTP 200, connected to TFI2.
- Supabase advisors: no new CO QA security finding and no unindexed CO QA foreign key finding. Existing unrelated security warnings are unchanged.
- Authenticated live browser acceptance remains pending. The browser workflow used a mocked API and must not be treated as live acceptance.

### Current boundary

The cost-storage workflow is implemented, but the complete CO QA module is not marked complete. The Import Center destination remains `hold_pending_business_rule`; no historical rows were promoted. Remaining work is the per-block A:X QA projection, validated AE:AH calculations, and owner decision on AI:AL and the duplicated-looking cost columns.

## 8. TFI2 implementation update — 31-block A:X projection (22 November 2026)

### Source mapping

- The original CO QA A3 formula was checked against the Product Entry block catalog. It projects **31 of 39** blocks, not all 39.
- Added an explicit mapping for the 31 included block keys and their 18 source columns feeding CO QA G:X.
- Mapping retains each Product Entry UUID and block key through the API; it does not depend on the sorted worksheet position.
- Source columns marked as formulas in the Product Entry block manifest are flagged as formula-pending. They are not treated as user-entered values and are not fabricated.
- The CO QA catalog selector and default records query are restricted to those exact 31 blocks. The other eight Product Entry blocks are excluded from CO QA.

### UI and API

- CO QA records now return an A:X QA projection with captured, missing, and formula-pending counts.
- Added a View QA details modal showing CO QA output column, source Product Entry column, value, and formula/missing status.
- Existing Y:AD unit-cost child record remains separately linked to Product Entry UUID with version history.

### Verification

- Added tests for the 31-block allowlist, source ranges, 18-field mapping, source formula columns, projected values, formula-pending flags, and rejection of non-projected Product Entry blocks.
- Focused CO QA contract/API tests: 17 passed.
- Full backend regression: **311 passed**.
- Mocked browser workflow: PASS; 31 block choices plus All, QA details, cost edit, and history verified with zero browser console errors.
- Python compilation and JavaScript syntax checks passed.
- TFI_NEW health: HTTP 200, connected to TFI2.
- Live Product Entry, CO QA cost, revision, and CO QA audit counts remain zero. No historical data was imported.

### Remaining boundary

The per-block A:X source mapping is implemented, but formula-derived Product Entry source fields and AE:AH calculations still require live-record verification and approved source units. AI:AL formulas remain unresolved. Owner confirmation is still required on whether Y/Z and AC/AD are intentionally distinct. The CO QA Import Center destination remains `hold_pending_business_rule`; do not promote historical rows. CO QA remains partial and does not advance the Phase 5 implementation count.

## 9. TFI2 implementation update — AE:AH exact formulas (22 November 2026)

### Verified source formulas

- AE (Total cans): `=SUM(G3:X3)-SUM(N3:Q3)`
- AF (Cost of cans): `=AE3*AA3`
- AG (Total lids): `=AE3-SUM(O3:S3)`
- AH (Cost of lids): `=AG3*AB3`

### Implementation and validation

- Added a read-only formula calculator to the CO QA API. It returns AE:AH values with calculated/pending status and reasons.
- Preserved Google Sheets behavior for blank cost inputs: blank AA or AB is treated as zero in multiplication.
- Formula-derived Product Entry QA source fields remain pending; dependent calculations are withheld until the upstream source formulas are reproduced and verified.
- Added AE:AH read-only columns to the CO QA table. They are not editable and are separate from Y:AD.
- Compared the original CO QA A3:X8 values with source AE3:AE8 and AG3:AG8: all six sample rows matched exactly (AE: 353, 586, 602, 888, 453, 89; AG: 309, 546, 554, 822, 419, 81).
- Full backend regression: 314 passed. CO QA browser simulation: PASS; displayed AE=586.00, AF=879.00, AG=546.00, AH=0.00 with zero console errors.
- New API code is saved but the running TFI_NEW service still requires a controlled restart before authenticated live browser acceptance.

CO QA remains partial. Remaining source work is to reproduce and verify the formula-derived Product Entry columns used by the 31-block projection. AI:AL remain unresolved (headers only in inspected rows). Confirm Y/Z and AC/AD semantics and historical repeat-batch/provenance rules before enabling import promotion. No source rows were imported and the original Google Sheet was not modified.

## 10. Product Entry formula source audit — dynamic QA fields vs mixed manual fields (22 November 2026)

The original Product Entry sheet was inspected directly at the exact source cells for all 31 CO QA projection blocks. The formula-column manifest had conflated two different cases:

1. **31 dynamic formulas**, one per projected block. These are all a source input multiplied by 2. The source cell formulas reference the corresponding input field (e.g. BLK_01 CG = CH*2; BLK_02 CS = CT*2; BLK_03 CZ = DA*2; BLK_13 CT = CU*2; BLK_38 DL = DM*2). Newer source rows show a blank-date guard; TFI2 reproduces that behavior so the derived output remains blank when the production date is blank.
2. **Nine mixed formula/manual fields** across nine blocks: BLK_01 CR, BLK_02 CZ, BLK_03 DK, BLK_13 DE, BLK_09 DQ, BLK_10 DE, BLK_27 DH, BLK_26 DF, BLK_29 DF. Their first source rows contain one-off arithmetic formulas (e.g. `=25+20`, `=169+44`, `=20+8`), but subsequent rows contain literal numeric user-entered values. They are therefore not safe as whole-column calculated fields.

### Changes made

- CO QA projection contract now contains 31 explicit dynamic source formula rules and calculates the output from the original input column.
- The nine mixed formula/manual fields were moved from formula-only to editable in the TFI2 Product Entry manifest and catalog (manifest version `2026-11-22-v2`). The source sheet itself was not modified.
- CO QA projection now preserves those nine fields as manual input values and no longer falsely marks them as permanently formula-pending.
- Added coverage for all 31 dynamic formula rules, the nine mixed manual fields, and the blank-date guard.
- Applied database migration `tfi2_product_entry_mixed_co_qa_fields`; verified all nine block catalog entries are editable and no longer marked formula columns.
- Full backend regression: **317 passed**. JavaScript syntax and Python compilation passed. CO QA browser mock: PASS, zero console errors.

### Remaining gate

Restart TFI_NEW to load the updated Product Entry manifest and CO QA contract, then perform authenticated live acceptance. No operational records or historical CO QA rows were imported. The CO QA import/promotion business-rule hold remains in place. AI:AL still have no source formulas and remain unresolved.

### Controlled TFI_NEW restart — 22 November 2026

- Restarted the TFI_NEW Flask service using the project virtual environment after loading the revised Product Entry manifest and CO QA source contract.
- Live health endpoint returned HTTP 200: `{"application":"TFI_NEW","connected":true,"database_project":"TFI2","status":"ok"}`.
- Authenticated live browser acceptance is still pending; health confirms the service and TFI2 connection only. No records were created or modified during restart.

### CO QA browser fixture refresh — 22 November 2026

- Updated the browser acceptance fixture to reflect the corrected source projection: BLK_01 is now complete at 18/18, with the dynamic CG output captured and manual CR input retained.
- Re-ran the Puppeteer CO QA browser workflow: **PASS**. It verified the 18/18 projection display, QA detail modal with captured source fields, UUID-linked unit-cost edit/save, revision history, and zero browser console errors.
- This remains a local mock-API browser test, not authenticated live TFI2 acceptance. The local server health is already HTTP 200; live account sign-in and a controlled real-record verification remain the next gate.
