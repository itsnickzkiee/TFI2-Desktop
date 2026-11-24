# TFI2 Database Safety & Migration Reconciliation — 22 November 2026

## Scope and target
- Application folder: `C:\Users\Rominick\Desktop\TFI_NEW`
- Supabase project: `TFI2` (`slfjqrkxnsgdaturaguw`)
- Project status at audit: `ACTIVE_HEALTHY`
- Database engine: PostgreSQL 17
- This audit did not query or change the legacy `TFI` Supabase project.
- No `.git` repository was found at the TFI_NEW project root; manual file backups were created before migration files were moved.

## Live data snapshot
The following operational/import transaction tables were empty at the time of inspection:
- `tfi_production_entry_records`: 0
- `tfi_module_import_batches`: 0
- `tfi_module_import_inbox`: 0
- `tfi_module_import_inbox_revisions`: 0
- `tfi_module_import_drafts`: 0
- `tfi_module_import_draft_revisions`: 0
- `tfi_historical_promotion_groups`: 0

This is evidence only for the listed tables at audit time. It is not a claim that every table in TFI2 is empty. Master Data and access/configuration tables contain their expected catalogue rows.

## Repairs applied

### 1. Historical promotion freeze guard
Migration:
- Version: `20261121160604`
- Name: `phase41_8_freeze_guard_requires_promoted_row`

Issue:
The prior trigger guard froze a date/line group as soon as a promotion-group row existed. The promotion routine can create that group before final duplicate/slot checks. If a draft was held after the group was created, an empty group could incorrectly block later edits/revalidation of the held draft.

Correction:
The freeze guard now blocks INSERT/UPDATE/DELETE only when the matching group contains at least one draft whose status is `promoted` and whose `promoted_record_id` is non-null. The in-transaction promotion bypass remains unchanged. This preserves the intended freeze after a successful promotion while allowing recovery from a blocked/held attempt before any row is promoted.

Regression check:
A transaction-only test created a temporary batch, inbox row, promotion group, draft and record, verified that an empty group allowed draft creation/approval, verified that a successfully promoted row caused subsequent edits to be blocked, and rolled the entire test transaction back. No test rows were retained.

### 2. Foreign-key index coverage
Migration:
- Version: `20261121161040`
- Name: `phase41_8_import_foreign_key_indexes`

Added 13 covering indexes for actor/owner foreign keys across the import batch, inbox, draft, draft revision, Production Entry and Production Schedule tables.

Post-change Performance Advisor:
- No remaining `unindexed_foreign_keys` findings.
- Unused-index notices remain informational because these transaction tables are currently empty or have not yet been exercised.

Neither repair migration inserted, updated or deleted operational/import rows.

## Rollback snapshot
The pre-repair function definition is stored at:
`supabase/backups/20261122_phase41_8_freeze_guard/original_freeze_guard.sql`

The applied migration sources are stored at:
- `supabase/migrations/20261121160604_phase41_8_freeze_guard_requires_promoted_row.sql`
- `supabase/migrations/20261121161040_phase41_8_import_foreign_key_indexes.sql`

## Security review
- RLS is enabled on all audited import and operational tables.
- Authenticated users do not have direct INSERT, UPDATE or DELETE table privileges on the audited operational/import tables.
- Supabase Security Advisor reports 11 authenticated-callable SECURITY DEFINER RPC wrappers. The wrappers are not executable by `anon` or `public`. Inspection confirmed that the underlying private production-entry functions check `auth.uid()` and module permissions; the other reviewed import/preflight functions check authentication and relevant module permissions directly. These are intentional authenticated RPC entry points, not blanket permission bypasses.
- Leaked-password protection remains disabled in Supabase Auth and must be enabled before production release.

## Migration reconciliation findings
The live Supabase migration ledger contains 30 entries after the repairs. The local `supabase/migrations` directory is not yet a complete mirror of the live ledger.

Known local filename/version mismatches:
| Local file moved to hold | Live ledger version/name |
|---|---|
| `202611200001_tfi2_identity_access_foundation.sql` | `20261120155046 / tfi2_identity_access_foundation` |
| `202611200002_official_35_tab_source_registry.sql` | `20261120155058 / official_35_tab_source_registry` |
| `202611200003_harden_rls_helper_functions.sql` | `20261120155245 / harden_rls_helper_functions` |
| `202611210001_system_administrator_role.sql` | `20261120162008 / system_administrator_role` |
| `202611210002_one_time_first_admin_bootstrap.sql` | `20261120162125 / one_time_first_admin_bootstrap` |
| `20261121103000_tfi2_production_entry_backend.sql` | `20261121091916 / tfi2_production_entry_backend` |
| `20261121110000_tfi2_product_standard_source_expansion.sql` | `20261121095851 / expand_product_standard_source_snapshot` (source equivalence not yet proven) |
| `20261121113000_tfi2_production_schedule_backend.sql` | `20261121101704 / production_schedule_backend` |
| `20261121114000_tfi2_production_schedule_numeric_parser_fix.sql` | `20261121101806 / production_schedule_numeric_parser_fix` |

Local migration `20261121022314_tfi2_operational_import_foundation.sql` was also moved to hold. Its database objects were previously observed, but that version is absent from the live migration ledger. Do not reapply it without a full object-by-object comparison.

The live ledger also contains migration versions for Master Data FK indexes and Phase 41.6/41.7/41.8 work whose original SQL files are not present in the local `supabase/migrations` folder. Those original SQL sources must be recovered or reconstructed from verified live definitions before treating the local folder as a complete rebuild source.

All 10 held SQL files were copied byte-for-byte to `supabase/backups/20261122_migration_reconciliation_hold/` and moved to `supabase/reconciliation_hold/`. The active migrations folder now contains only files whose version numbers match the live ledger, plus the two newly applied repair migrations and a non-executable `.template` file. The held files were not deleted or edited.

## Operational safety decision
- Do not run `supabase db push`, `db reset`, blanket migration repair, or reapply the local-only import foundation migration until reconciliation is completed.
- Do not create fake/no-op migration files to pretend missing SQL sources were recovered.
- No historical workbook import or promotion was run.
- No production records were written.
- The official seven-phase roadmap remains unchanged; Phase 5 remains active.

## Remaining audit items
1. Recover/compare the source SQL for the missing live migrations.
2. Verify exact local-vs-live body equivalence before correcting filenames.
3. Enable Supabase leaked-password protection before production release.
4. Continue the Phase 5 operational-module backend roadmap.


## Follow-up OLD TFI reference audit and Phase 41 runtime cleanup — 22 November 2026

This section supersedes the earlier statement that the Phase 41.6–41.8 import/promotion tables and functions remained dormant in TFI2.

A follow-up comparison of the OLD TFI local SQL source, active TFI_NEW src/design code, and live TFI2 schema confirmed that the old Phase 41.6–41.8 Historical Production Summary import/promotion subsystem was present in TFI2 but was not called by the active TFI_NEW application. The TFI_NEW application uses the separate tfi_import_* workflow.

### Cleanup applied

Migration:
- Version: 20261121165112
- Name: tfi2_remove_legacy_phase41_import_objects
- Local source: supabase/migrations/20261121165112_tfi2_remove_legacy_phase41_import_objects.sql

Removed:
- Six legacy tables: tfi_module_import_batches, tfi_module_import_inbox, tfi_module_import_inbox_revisions, tfi_module_import_drafts, tfi_module_import_draft_revisions, and tfi_historical_promotion_groups.
- Thirteen legacy functions, including the public Phase 41 import RPCs, private promotion engine, freeze guard, and tfi_source42_check_page preflight RPC.
- Legacy promotion triggers and table-owned indexes.

All six legacy tables were verified at exact row count zero immediately before the migration. The migration used explicit DROP statements, child-first table order, RESTRICT, and pre/postflight checks. No CASCADE, TRUNCATE, bulk DELETE, reset, historical import, or promotion was run.

Preserved:
- tfi_import_destinations, tfi_import_batches, tfi_import_rows, tfi_operational_records, and their TFI_NEW RPC workflow.
- Fifteen import destination configuration rows.
- Source workbook/sheet registry and shared permission/audit helpers.
- Production Entry, Product Entry, DMP Production, Production Schedule structures and all existing current-module indexes.
- Applied migration-ledger history.

### Post-cleanup evidence

- Six legacy tables remaining: 0.
- Database routines referencing the retired legacy tables: 0.
- Retired legacy triggers remaining: 0.
- Production Entry source_import_* columns remaining: 0.
- New tfi_stage_import_rows RPC: present.
- New import destination configurations: 15.
- New import batches/rows/operational records: 0.
- Production Entry/Product Entry/DMP Production transaction rows: 0.
- Five current Production Entry/Production Schedule indexes from the mixed Phase 41.8 index migration remain present.
- Supabase Health Advisor: no lints.
- Security Advisor authenticated-callable SECURITY DEFINER findings decreased from 11 to 2. The two remaining findings are current TFI_NEW Production Entry create/update RPCs; leaked-password protection remains a separate Auth warning.
- TFI_NEW local health: HTTP 200, application=TFI_NEW, connected=true, database_project=TFI2, status=ok.
- TFI_NEW backend suite: 149 passed.
- Active TFI_NEW src/design search for legacy Phase 41 identifiers: zero matches.

### Backup and migration-history notes

Original OLD TFI Phase 41.6–41.8 SQL files 027–034 and exact live definitions of all 13 removed functions are preserved in:
supabase/backups/20261122_legacy_phase41_cleanup/

The two obsolete Phase 41.8 draft SQL files were removed from supabase/drafts after backup. Applied historical Phase 41 migration files and their ledger rows remain for auditability; they are not active runtime dependencies.

The live migration ledger now contains 32 entries. The broader local-versus-live migration-history reconciliation remains incomplete. Do not run supabase db push, db reset, or blanket migration repair until all held/mismatched migration sources are reconciled.

This cleanup closes the confirmed legacy Phase 41 import/promotion runtime dependency. It does not replace the separate module-by-module formula/business-rule parity review against the approved 35-tab source workbook.
