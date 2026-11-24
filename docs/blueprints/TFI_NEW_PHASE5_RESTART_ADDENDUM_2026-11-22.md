# TFI_NEW / TFI2 — Phase 5 Development Restart Addendum
Date: 22 November 2026

## Official phase position
The official seven-phase roadmap remains unchanged:
1. System Foundation — completed
2. Authentication & Authorization — core implemented
3. Audit Trail & Security — partial
4. Master Data Backend — implemented
5. Operational Modules Backend — **ACTIVE DEVELOPMENT**
6. Import Center — early priority work only; module-specific destination integration remains gated
7. Dashboard, Reports & Final System-wide Testing — pending

This addendum does not renumber, merge, skip, or close any phase.

## Strict project boundary
- Active application: `C:\Users\Rominick\Desktop\TFI_NEW`
- Active Supabase target: `TFI2` / project ref `slfjqrkxnsgdaturaguw`
- Active local app: `http://127.0.0.1:5100/`
- Verified health endpoint: `GET /api/health` returns application `TFI_NEW`, connected `true`, database_project `TFI2`, status `ok`.
- Legacy folder `C:\Users\Rominick\Desktop\TFI` is not an implementation source for TFI_NEW.
- The active TFI_NEW source tree was searched for Phase 41.8 historical-promotion function/table references; no active application-source matches were found.

## Legacy Phase 41.8 isolation and database cleanup
Historical Draft Promotion (the Phase 41.8 flow involving `tfi_module_import_drafts_promote`, `tfi_historical_promotion_groups`, and legacy promotion-freeze triggers) is not part of the current TFI_NEW Phase 5 module contract.

- Do not call, expose, or integrate these historical-promotion RPCs from TFI_NEW.
- Do not use the legacy historical-promotion group/slot allocation as a Production Entry contract.
- Do not import historical records or run promotion.
- The historical-promotion tables and functions remain dormant in TFI2; they have not been dropped because their full dependency graph has not been reconstructed.
- The Phase 41.8 freeze-guard repair is isolated to the dormant legacy promotion trigger. It is not a prerequisite or dependency for TFI_NEW Phase 5.
- TFI_NEW's early Phase 6 Import Center remains its separate implementation; it is not the legacy Phase 41 historical draft-promotion engine.

### Production Entry provenance cleanup applied
Preflight findings:
- `public.tfi_production_entry_records` contained zero rows.
- Seven nullable provenance columns had foreign-key/check dependencies on legacy `tfi_module_import_batches` and `tfi_module_import_drafts`.
- No database views referenced the legacy `source_import_*` fields.
- TFI_NEW active source functions for Production Entry did not reference those fields.
- The active TFI_NEW source tree had no references to the legacy promotion RPCs.

Applied migration:
- Version: `20261121162337`
- Name: `tfi_new_remove_legacy_phase41_provenance`
- Source: `supabase/migrations/20261121162337_tfi_new_remove_legacy_phase41_provenance.sql`

Removed from the TFI_NEW Production Entry table:
- `source_import_batch_id`
- `source_import_draft_id`
- `source_import_spreadsheet_id`
- `source_import_sheet`
- `source_import_sheet_row`
- `source_import_source_key`
- `source_import_fingerprint_sha256`
- Their two legacy foreign keys, provenance check constraint, and two supporting indexes.

The seven columns were nullable and the table had zero records. No Production Entry record data was deleted or changed. A schema restoration reference is preserved at `supabase/backups/20261122_migration_reconciliation_hold/production_entry_legacy_phase41_provenance_restore.sql`.

Important: this cleanup removes the old Phase 41 promotion dependency from the TFI_NEW Production Entry table. It does not remove the dormant historical-promotion tables/functions from TFI2. Those remain isolated pending a separate dependency review. Future TFI_NEW import provenance must use a separately designed Phase 6 contract against the TFI_NEW import workflow, not the legacy Phase 41 draft tables.

## Migration source boundary
- Mismatched or untracked old/local SQL files are retained under `supabase/reconciliation_hold` with byte-for-byte backup copies under `supabase/backups/20261122_migration_reconciliation_hold`.
- Never reapply held SQL files or run a blanket migration push/reset while reconciliation is open.
- TFI_NEW's own DMP Production, Product Entry, Master Data, and import implementations remain the authoritative source for development.
- No old TFI production records were imported into TFI2.

## Current Phase 5 implementation position
Use the approved module order in `TFI2_PHASE5_OPERATIONAL_MODULES_ROADMAP_v0.1_2026-11-21.md`:
1. DMP Production — backend/UI foundation exists; authenticated browser acceptance remains deferred.
2. Product Entry — backend/UI foundation exists; authenticated live browser acceptance remains pending.
3. **Production Entry + Production Summary — NEXT DEVELOPMENT MODULE.**
4. Production Schedule.
5. DMR Production.
6. DMR Coding.
7. Hourly Meat, Hourly Coding, Hourly Agri.
8. OEE.
9. Productivity.
10. Coding DPR.
11. PR Monitoring.
12. CO QA — remains blocked pending business-rule approval.
13. NON-PROD.

Production Entry has an existing source-aligned contract and manifest in TFI_NEW:
- `src/tfi_backend/production_entry_contract.py`
- `src/tfi_backend/production_entry_manifest.json`
- `design/production-entry-ui.js`
- `design/production-entry-preview.html`
- `supabase/migrations/20261121103000_tfi2_production_entry_backend.sql.template`

The migration is intentionally a `.template` and must not be blindly applied. Its schema must be reconciled against live TFI2 tables, functions, indexes, constraints, RLS, policies, and the official migration history before preparing any new TFI_NEW-owned migration.

## Focused verification on 22 November 2026
- TFI_NEW health: HTTP 200; app reports `application=TFI_NEW`, `connected=true`, `database_project=TFI2`, `status=ok`.
- Production Entry contract/API tests: 17 passed.
- The first test invocation used a wrong relative test path; the corrected run used project root and `PYTHONPATH=src`. The successful result is the 17-pass run.
- The `/health` path returned 404 because the actual endpoint is `/api/health`; the correct endpoint returned the expected TFI_NEW/TFI2 identity.
- Production Entry live row count remains zero after cleanup.
- Legacy provenance columns are absent from the Production Entry table.
- No new Production Entry test records were persisted.
- No historical import or promotion was run.

## Next development gate — Production Entry + Production Summary
1. Compare the Production Entry source manifest and contract against the approved 35-tab source workbook and the current TFI2 Product Standard / DPR LEGEND dependencies.
2. Inspect the existing `.template` migration against live TFI2 tables, columns, indexes, constraints, RLS, policies, RPCs, and dependencies.
3. Produce a TFI_NEW-owned migration only for verified missing schema objects; no duplicate tables, no copied legacy promotion columns/logic unless explicitly required by the source contract.
4. Implement/verify API read/create/update/revision behavior and the Production Summary saved-run view.
5. Run focused tests and a rolled-back database smoke test.
6. Complete authenticated browser acceptance only with an owner-approved controlled test entry. Do not import historical workbook rows.

## Safety gates
- No DROP, TRUNCATE, bulk DELETE, database reset, or historical import.
- Do not change or overwrite existing operational records.
- Do not use the old TFI project folder or its business logic as an implementation source.
- Keep development checks module-scoped; final comprehensive system testing remains Phase 7.


## Follow-up OLD TFI reference audit — cleanup completed 22 November 2026

The earlier statements in this addendum that the Phase 41.6–41.8 historical import/promotion tables and functions remained dormant in TFI2 are superseded by the completed cleanup below.

Applied TFI2 migration:
- Version: 20261121165112
- Name: tfi2_remove_legacy_phase41_import_objects
- Source: supabase/migrations/20261121165112_tfi2_remove_legacy_phase41_import_objects.sql

The cleanup removed six empty legacy import/promotion tables, thirteen legacy functions, and the retired Phase 41 promotion triggers. It used guarded preflight checks and DROP ... RESTRICT. No production or historical transaction records were deleted. The exact legacy function definitions and original OLD TFI Phase 41.6–41.8 SQL sources are preserved in supabase/backups/20261122_legacy_phase41_cleanup/ for forensic/restore reference only.

Post-cleanup verification:
- Legacy tables remaining: 0.
- Database routines referencing the retired legacy tables: 0.
- Legacy triggers remaining: 0.
- Production Entry source_import_* columns: 0.
- New TFI_NEW tfi_import_* tables and tfi_stage_import_rows RPC: present.
- Import destination configuration rows: 15.
- New import batches, staged rows, and generic operational records: 0.
- Security Advisor authenticated-callable SECURITY DEFINER findings reduced from 11 to 2. The two remaining findings are current Production Entry create/update RPCs; leaked-password protection remains a separate Auth warning.
- Health Advisor: no lints.
- TFI_NEW health: HTTP 200; connected to TFI2.
- TFI_NEW backend suite: 149 passed.
- Active TFI_NEW src/design search for legacy Phase 41 identifiers: zero matches.

The Phase 41 migration-ledger entries and applied migration files remain as historical records. The local migration directory is still not a complete mirror of the live 32-entry ledger; do not run blanket migration push/reset or migration repair while reconciliation remains open.

The TFI_NEW import implementation remains separate from OLD TFI Historical Draft Promotion. The approved workbook/source registry and 15 new import destination configurations are intentionally retained. A complete module-by-module formula and business-rule parity review against the approved 35-tab workbook remains separate Phase 5 work.

Official seven-phase roadmap is unchanged. Phase 5 Operational Modules Backend remains ACTIVE. Next module: Production Entry + Production Summary.


Correction to the earlier safety-gates bullet: the prior blanket no-DROP instruction was superseded only for the specifically approved Phase 41 legacy cleanup migration described above. That migration had zero-row preflight checks, used RESTRICT, and removed only the retired Phase 41 import/promotion objects. No other operational tables are authorized for deletion.
