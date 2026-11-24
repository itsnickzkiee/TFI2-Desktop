-- TFI_NEW Phase 5 cleanup:
-- Remove only Phase 41.8 legacy Historical Draft Promotion provenance
-- columns and foreign keys from the TFI_NEW Production Entry table.
-- Preflight: Production Entry row count = 0; no views reference these fields;
-- TFI_NEW source code does not call legacy Phase 41.8 promotion functions.
-- TFI_NEW import workflow remains separately implemented and is not removed.
DROP INDEX IF EXISTS public.tfi_production_entry_source_import_batch_idx;
DROP INDEX IF EXISTS public.tfi_production_entry_source_import_draft_uidx;

ALTER TABLE public.tfi_production_entry_records
  DROP CONSTRAINT IF EXISTS tfi_production_entry_records_source_import_batch_id_fkey,
  DROP CONSTRAINT IF EXISTS tfi_production_entry_records_source_import_draft_id_fkey,
  DROP CONSTRAINT IF EXISTS tfi_production_entry_records_source_import_provenance_check;

ALTER TABLE public.tfi_production_entry_records
  DROP COLUMN IF EXISTS source_import_batch_id,
  DROP COLUMN IF EXISTS source_import_draft_id,
  DROP COLUMN IF EXISTS source_import_spreadsheet_id,
  DROP COLUMN IF EXISTS source_import_sheet,
  DROP COLUMN IF EXISTS source_import_sheet_row,
  DROP COLUMN IF EXISTS source_import_source_key,
  DROP COLUMN IF EXISTS source_import_fingerprint_sha256;
