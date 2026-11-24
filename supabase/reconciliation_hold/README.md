# Migration reconciliation hold

These SQL files were present in the TFI_NEW working folder but their local version numbers do not match the applied TFI2 migration ledger, or the local version is not recorded in the live ledger.

They have been moved out of supabase/migrations so a future Supabase CLI migration push cannot accidentally replay them as new migrations against the already-populated TFI2 schema.

Nothing here was deleted. Identical copies are preserved in:
supabase/backups/20261122_migration_reconciliation_hold/

Do not move these files back into supabase/migrations, rename them, or reapply them until their SQL bodies have been compared with the corresponding live database definitions and migration ledger.

## Phase 41 source recovery update — 22 November 2026

The original OLD TFI Phase 41.6–41.8 SQL files 027–034 were recovered from the separate OLD TFI local project folder and archived byte-for-byte at:
supabase/backups/20261122_legacy_phase41_cleanup/old_tfi_phase41_source/

The exact live TFI2 definitions for the 13 removed legacy functions are also preserved in that cleanup backup. This archive is forensic/restore reference only; it is not an active migration source and must never be replayed.

The confirmed Phase 41.6–41.8 historical import/promotion runtime objects have been removed by migration 20261121165112_tfi2_remove_legacy_phase41_import_objects. Their applied migration-ledger rows remain as history. See:
docs/blueprints/TFI_NEW_OLD_TFI_REFERENCE_ISOLATION_AUDIT_2026-11-22.md

The original sources for other held/mismatched applied migrations are still not fully reconciled. This directory remains a safety hold, not a completed rebuild-history reconstruction.

The TFI2 runtime application does not depend on this folder. Do not run supabase db push, supabase db reset, or a blanket migration repair while reconciliation remains open.
