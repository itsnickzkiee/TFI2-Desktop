# TFI_NEW / TFI2 — OLD TFI Reference Isolation Audit
Date: 22 November 2026
Status: Phase 41 legacy runtime cleanup applied and verified

## 1. Scope and target

- Active application: C:\Users\Rominick\Desktop\TFI_NEW
- Active Supabase project: TFI2
- Project ref: slfjqrkxnsgdaturaguw
- Legacy reference folder inspected: C:\Users\Rominick\Desktop\TFI
- The OLD TFI Supabase project itself was not queried or changed. This review inspected the old local project files and the live TFI2 project only.
- No blanket reset, historical import, promotion, TRUNCATE, or bulk DELETE was run.

## 2. Executive result

The confirmed OLD TFI Phase 41.6–41.8 Historical Production Summary import/promotion subsystem was present in live TFI2. It was not part of the active TFI_NEW application workflow.

The legacy runtime objects have now been removed from TFI2 through a guarded, TFI_NEW-owned migration. The new TFI_NEW import architecture remains intact.

This closes the confirmed Phase 41 legacy import/promotion dependency. It is not a claim that every business formula and every module rule across the full OLD TFI application has undergone a complete line-by-line parity review. That separate review must use the approved 35-tab source workbook and TFI_NEW contracts as the authority.

## 3. TFI_NEW application-source inspection

The active TFI_NEW source paths inspected were src and design.

- Active-source search for tfi_module_import_*, tfi_historical_promotion_groups, tfi_guard_historical_promotion_freeze, tfi_source42_check_page, source_import_*, and Phase 41.6/41.7/41.8 identifiers returned zero matches.
- The TFI_NEW Supabase gateway uses the separate tfi_import_* tables and RPCs, including tfi_create_import_batch, tfi_stage_import_rows, tfi_complete_import_scan, tfi_fail_import_batch, tfi_set_import_row_decision, and tfi_finalize_import_batch.
- The TFI_NEW import scanner is implemented separately in src/tfi_backend/import_service.py.
- The approved workbook/source registry and the 15 tfi_import_destinations configuration rows are intentional TFI_NEW source-mapping data. They are not the OLD TFI historical import/promotion engine.
- The old TFI application folder remains outside the TFI_NEW implementation boundary.

## 4. Legacy Phase 41 objects found before cleanup

### Tables

All six tables were verified at exact row count zero immediately before cleanup:

1. public.tfi_module_import_batches
2. public.tfi_module_import_inbox
3. public.tfi_module_import_inbox_revisions
4. public.tfi_module_import_drafts
5. public.tfi_module_import_draft_revisions
6. public.tfi_historical_promotion_groups

### Functions

Thirteen legacy functions were removed:

- public.tfi_source42_check_page(text,jsonb)
- public.tfi_module_import_batch_finish(uuid)
- public.tfi_module_import_batch_manifest(uuid,jsonb)
- public.tfi_module_import_batch_start(text,text,text,text,text)
- public.tfi_module_import_drafts_approve(uuid[],boolean,text)
- public.tfi_module_import_drafts_create(uuid,integer)
- public.tfi_module_import_drafts_promote(uuid,uuid[],boolean,boolean)
- public.tfi_module_import_drafts_status(uuid,integer,integer,text)
- public.tfi_module_import_inbox_edit(uuid,integer,jsonb,jsonb,jsonb,jsonb,text)
- public.tfi_module_import_inbox_revalidate(uuid,integer)
- public.tfi_module_import_inbox_upsert(uuid,jsonb)
- private.tfi_module_import_drafts_promote(uuid,uuid[],boolean,boolean)
- private.tfi_guard_historical_promotion_freeze()

The source42 preflight RPC also referenced the retired import inbox and was not called by active TFI_NEW source.

### Other legacy objects

- Historical promotion triggers were removed; post-cleanup trigger count for the retired family is zero.
- Legacy indexes attached to the removed tables were removed with those tables.
- The seven source_import_* Production Entry provenance columns had already been removed by migration 20261121162337.
- No database views referenced the retired tables.
- The five current Production Entry / Production Schedule indexes from the mixed Phase 41.8 index migration were preserved.

## 5. Cleanup migration applied

- Version: 20261121165112
- Name: tfi2_remove_legacy_phase41_import_objects
- Local source: supabase/migrations/20261121165112_tfi2_remove_legacy_phase41_import_objects.sql

Safety properties of the migration:

- Aborts if any legacy table contains a row.
- Aborts if the new TFI_NEW import foundation is missing.
- Aborts if Production Entry legacy provenance columns remain.
- Drops functions and tables explicitly.
- Drops child tables before parent tables.
- Uses DROP TABLE ... RESTRICT; no CASCADE.
- Checks for remaining routine references after dropping legacy functions.
- Verifies the new tfi_import_* tables and staging RPC still exist.
- Preserves the live migration-ledger history.

## 6. Post-cleanup verification

Live TFI2 checks after migration:

- Six retired legacy tables remaining: 0.
- Routines referencing retired legacy tables: 0.
- Retired Phase 41 trigger count: 0.
- Production Entry source_import_* columns remaining: 0.
- Legacy source42 preflight RPC: absent.
- Legacy batch-start RPC: absent.
- Legacy private promotion engine: absent.
- New public tfi_stage_import_rows RPC: present.
- New tfi_import_destinations rows: 15.
- New tfi_import_batches rows: 0.
- New tfi_import_rows rows: 0.
- New tfi_operational_records rows: 0.
- Production Entry records: 0.
- Product Entry records: 0.
- DMP Production records: 0.

The five current indexes preserved are:
- tfi_production_entry_records_archived_by_idx
- tfi_production_entry_records_updated_by_idx
- tfi_production_schedule_forms_created_by_idx
- tfi_production_schedule_forms_updated_by_idx
- tfi_production_schedule_revisions_changed_by_idx

## 7. Security and application verification

Before cleanup, Supabase Security Advisor reported 11 authenticated-callable SECURITY DEFINER RPC findings. Nine findings belonged to the legacy Phase 41 / source-preflight RPC surface.

After cleanup:
- Only two SECURITY DEFINER findings remain: current TFI_NEW Production Entry create/update RPCs. They were intentionally preserved for separate security review.
- Leaked-password protection remains disabled in Supabase Auth and must be addressed before production release.
- Supabase Health Advisor returned no lints.
- Local health endpoint returned HTTP 200 with application=TFI_NEW, connected=true, database_project=TFI2, status=ok.
- TFI_NEW backend test suite: 149 passed.

## 8. Backup and forensic archive

Rollback/reference material is stored at:

supabase/backups/20261122_legacy_phase41_cleanup/

It contains:
- Byte-for-byte copies of the eight original OLD TFI Phase 41.6–41.8 SQL files (027–034).
- Exact live TFI2 definitions for all 13 removed legacy functions.
- Exact live tfi_source42_check_page definition.
- Copies of the two TFI_NEW Phase 41.8 draft SQL files.
- README and SHA256SUMS.txt.

This folder is a forensic/restore archive only. It is not a migration directory. Do not replay its SQL or copy it into supabase/migrations.

The two obsolete Phase 41.8 draft files were removed from supabase/drafts after backup. The applied historical migration files remain in supabase/migrations as migration history and are not active runtime dependencies.

## 9. Migration-history boundary

The live migration ledger now contains 32 entries. Historical Phase 41.6–41.8 migration records remain in the ledger for auditability; they were not deleted.

The local TFI_NEW migration directory is still not a complete mirror of the full live migration ledger. Existing reconciliation_hold items remain unresolved. Do not run supabase db push, db reset, or blanket migration repair until the separate migration-history reconciliation is complete.

The applied migration 20261121161040 contains both legacy indexes and five current indexes. It remains as historical source; the cleanup removed the legacy tables/indexes while preserving the five current indexes.

## 10. Remaining work and project phase

- The confirmed legacy Phase 41 import/promotion runtime dependency is removed.
- Complete the separate 35-tab formula and business-rule parity review module by module using the approved workbook and TFI_NEW manifests/contracts.
- Review the two current Production Entry SECURITY DEFINER RPC warnings.
- Enable leaked-password protection before production release.
- Continue the official seven-phase roadmap without renumbering: Phase 5 Operational Modules Backend remains ACTIVE.
- Next module remains Production Entry + Production Summary.
- Phase 6 Import Center remains a separate TFI_NEW implementation; Phase 7 remains final system-wide testing and release acceptance.
