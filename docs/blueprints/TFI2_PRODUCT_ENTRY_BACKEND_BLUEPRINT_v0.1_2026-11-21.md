# TFI2 Product Entry Backend Blueprint

Date: 21 November 2026  
Project: TFI_NEW / TFI2  
Phase: 5 — Operational Modules Backend  
Module: Product Entry  
Status: Backend deployed; UI integration completed; mock-API browser verification passed; authenticated live browser acceptance pending

## 1. Objective

Provide TFI2-native create, read, update, duplicate detection, revision history, and audit logging for new Product Entry records. This increment does not import historical Product Entry worksheet rows and does not write back to the source workbook.

The implementation preserves the 39 product-family blocks in Entry Map. It does not flatten them into a shared product-code list or a generic one-size-fits-all form.

## 2. Verified source identity

| Item | Source |
|---|---|
| Workbook | Copy of TFI - Production Monitoring Sheet 1 |
| Spreadsheet ID | 1rCbQ16wj7MRjQCFF3tA-WEMkudraJK0RkwcqayUlz7k |
| Worksheet | Product Entry |
| sheetId | 545274882 |
| Source range | Product Entry!A1:FH39160 |
| Entry Map worksheet | Entry Map |
| Entry Map sheetId | 1628314566 |
| Entry Map range | Entry Map!A2:F40 |
| Product selector | Entry Map!A2:A40 |
| Product-family blocks | BLK_01 through BLK_39 |
| Source columns | A:FH (164 columns) |

## 3. Block-specific contract

The backend manifest contains 39 distinct blocks and preserves each block's:
- Entry Map block key, product key, and display title.
- Source first row, first data row, and source block row count.
- Header labels, group headers, and source column identities.
- Formula templates and formula-column list.
- Hidden-column specification.
- Per-block Product Code validation options.
- Per-block Production Supervisor review column.
- Source fills and validation metadata.
- Source schema SHA-256 fingerprint.

The catalog contains 39 product blocks, 152 per-block Product Code options, and 1,578 editable source fields across the 39 block schemas. Product Code lists remain attached to their original block; the lists are not combined.

## 4. Field handling rules

- The record_data object stores values under their original spreadsheet column letters, for example A, B, D, or DH.
- Only columns classified as visible, non-formula, non-hidden, and within that block's defined header width are accepted.
- Formula columns, hidden columns, and trailing columns without a defined source header are rejected by the API contract and database RPC.
- Column B Product Code is validated against the selected block's exact option list.
- Column A Date produce is retained as source text. A typed date projection is populated only when the supplied value is valid ISO YYYY-MM-DD; other date text is not silently reinterpreted.
- Column D PR No / PR# is retained as a searchable text field.
- The Production Supervisor review field is block-specific (for example, DH in BLK_01 and CA in BLK_39). Its allowed values are Reviewed, Incomplete Data, For Verification of Data, and Cancelled.
- Other editable cell values are retained as text. Numeric precision, units, mandatory fields, and additional field-specific validations remain subject to source-format and business-rule review.
- Incomplete entries are accepted. Because no mandatory-field rules have been approved, records remain unassessed; blank editable columns are recorded in blank_fields.
- Formula templates are retained as metadata only. This increment does not execute spreadsheet formulas or claim formula parity in TFI2.

## 5. TFI2 data model

### Tables

- public.tfi_product_entry_block_catalog — source-backed 39-block schema and validation catalog.
- public.tfi_product_entry_records — new TFI2 Product Entry records; record_data stores source-column-keyed manual inputs.
- public.tfi_product_entry_revisions — append-only before/after history for edits.

### Functions

- public.tfi_get_product_entry_catalog
- public.tfi_create_product_entry_records
- public.tfi_update_product_entry_record

### Local API routes

- GET /api/product-entry/catalog
- GET /api/product-entry/records?block_key=BLK_01&page=1&page_size=50
- POST /api/product-entry/records
- PATCH /api/product-entry/records/<record_id>
- GET /api/product-entry/records/<record_id>/revisions

### Security and write behavior

- Uses the existing product_entry.view, product_entry.create, and product_entry.edit permission keys.
- Row reads are protected by RLS and module view permission.
- Direct client insert/update/delete is revoked. Writes use permission-checked RPC functions.
- Create and update operations write audit events in the same transaction.
- Updates require an expected version and append a revision.
- Exact duplicate fingerprints include both block key and normalized source-column payload.
- There is no hard-delete endpoint. Archive/restore requires a separately approved workflow.
- No historical source rows are inserted by this migration.

## 6. Applied migrations

- 20261121055418 — tfi2_product_entry_backend (migration ledger placeholder; no schema changes)
- 20261121055459 — tfi2_product_entry_backend_schema
- 20261121055925 — tfi2_product_entry_fk_index

## 7. Verification

- Python compile checks passed.
- 111 automated backend tests passed across the backend suite.
- Local TFI_NEW backend restarted with the new routes; health returns HTTP 200 and database_project=TFI2.
- Unauthenticated GET /api/product-entry/catalog returns HTTP 401, confirming the route is registered and session-protected.
- `design/product-entry-ui.js` and `design/product-entry-ui.css` connect the existing Product Entry source-sheet UI to the TFI2 catalog and CRUD APIs.
- UI provides New Entry, Saved Records, block-specific Product Code and review filters, Add Rows, Save, per-record Edit, and revision History.
- Browser test `tests/backend/test_product_entry_browser.cjs` passed against a mocked API: all 39 blocks switched correctly, per-block code lists and review columns matched, Save payloads, filters, version-checked Edit, and before/after History passed; browser console errors: 0.
- Screenshot: `design/product-entry-backend-verified-desktop.png`.
- Product Entry manifest check confirms 39 distinct product-family blocks.
- API contract tests cover block-specific Product Code validation, review statuses, formula/hidden/trailing-column rejection, incomplete rows, permissions, pagination, create, and version-checked update.
- Live TFI2 catalog RPC returned all 39 blocks, from BLK_01 through BLK_39, under the authenticated System Administrator context.
- Live create/update smoke test succeeded inside a rolled-back transaction: one row inserted, update advanced to version 2, one revision and two audit events were created inside the transaction.
- Live database validation rejected a formula column, a Product Code belonging to another block, and an invalid review status; exact duplicate test inserted one row and skipped the repeated row. All checks were rolled back.
- Post-rollback persisted counts remain zero: 0 Product Entry records, 0 revisions, and 0 Product Entry audit events.
- Supabase Performance Advisor found no remaining unindexed foreign-key finding after migration 20261121055925 added the archived_by index; remaining unused-index notices are informational.
- Existing Supabase Security Advisor warning remains: leaked-password protection is disabled. This is not caused by the Product Entry migration.

## 8. Acceptance still required

- Complete authenticated live browser acceptance in the signed-in TFI_NEW application using an owner-approved controlled test entry.
- Verify the live Supabase-backed Save, Saved Records, filters, Edit, and History flows through the local app session.
- Keep historical worksheet rows out of this acceptance test.
- The automated UI browser test uses a mocked API for repeatability; it does not substitute for live authenticated acceptance and does not persist production data.

## 9. Known limitations and next dependencies

- The Product Entry preview is wired to the TFI2 catalog and CRUD endpoints. Authenticated live browser acceptance remains outstanding.
- Spreadsheet formula outputs are preserved as metadata and displayed as read-only blank calculated cells; they are not yet calculated by a TFI2 formula engine.
- Numeric/date field-level rules beyond the currently verified Product Code and review-status validations require further source-format/business-rule review.
- The Phase 6 Import Center stages generic operational rows; module-specific promotion into tfi_product_entry_records is a later integration task.
- Product Entry is an upstream dependency for CO QA and Yield Monitoring. Do not mark either dependent module complete until their approved contracts and calculations are implemented.
