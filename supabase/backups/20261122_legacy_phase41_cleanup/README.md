# Legacy Phase 41 cleanup backup

Purpose: forensic and rollback reference only.

The files under old_tfi_phase41_source are byte-for-byte copies of the original Phase 41.6–41.8 SQL files from the separate OLD TFI project folder. They are NOT TFI_NEW migrations and must never be copied into supabase/migrations, replayed, or used as the TFI_NEW application implementation.

The two *_draft.sql files are preserved draft copies from TFI_NEW. The freeze-guard draft is byte-identical to the applied migration 20261121160604_phase41_8_freeze_guard_requires_promoted_row.sql. The FK-index draft is a legacy-only draft; the applied mixed index migration 20261121161040_phase41_8_import_foreign_key_indexes.sql also contains five current TFI_NEW indexes and must remain as migration history.

Before any cleanup, the six legacy import/promotion tables were verified at exact row count zero. The TFI_NEW import architecture (tfi_import_*) is separate and must be preserved.

SHA-256 checksums are recorded in SHA256SUMS.txt.
