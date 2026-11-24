-- Pre-cleanup snapshot: legacy Phase 41.8 provenance fields on TFI2 Production Entry.
-- At capture time public.tfi_production_entry_records contained zero rows.
-- This file is a schema restoration reference only; do not apply unless rollback is explicitly required.
ALTER TABLE public.tfi_production_entry_records
  ADD COLUMN source_import_batch_id uuid,
  ADD COLUMN source_import_draft_id uuid,
  ADD COLUMN source_import_spreadsheet_id text,
  ADD COLUMN source_import_sheet text,
  ADD COLUMN source_import_sheet_row integer,
  ADD COLUMN source_import_source_key text,
  ADD COLUMN source_import_fingerprint_sha256 text;

ALTER TABLE public.tfi_production_entry_records
  ADD CONSTRAINT tfi_production_entry_records_source_import_batch_id_fkey
    FOREIGN KEY (source_import_batch_id) REFERENCES public.tfi_module_import_batches(id) ON DELETE RESTRICT,
  ADD CONSTRAINT tfi_production_entry_records_source_import_draft_id_fkey
    FOREIGN KEY (source_import_draft_id) REFERENCES public.tfi_module_import_drafts(id) ON DELETE RESTRICT,
  ADD CONSTRAINT tfi_production_entry_records_source_import_provenance_check
    CHECK (
      (source_import_draft_id IS NULL AND source_import_batch_id IS NULL
       AND source_import_spreadsheet_id IS NULL AND source_import_sheet IS NULL
       AND source_import_sheet_row IS NULL AND source_import_source_key IS NULL
       AND source_import_fingerprint_sha256 IS NULL)
      OR
      (source_import_draft_id IS NOT NULL AND source_import_batch_id IS NOT NULL
       AND source_import_spreadsheet_id IS NOT NULL
       AND length(source_import_spreadsheet_id) BETWEEN 20 AND 128
       AND source_import_sheet='Production Summary'
       AND source_import_sheet_row BETWEEN 7 AND 13188
       AND source_import_source_key IS NOT NULL
       AND length(source_import_source_key) BETWEEN 1 AND 240
       AND source_import_fingerprint_sha256 ~ '^[a-f0-9]{64}$')
    );

CREATE INDEX tfi_production_entry_source_import_batch_idx
  ON public.tfi_production_entry_records(source_import_batch_id)
  WHERE source_import_batch_id IS NOT NULL;
CREATE UNIQUE INDEX tfi_production_entry_source_import_draft_uidx
  ON public.tfi_production_entry_records(source_import_draft_id)
  WHERE source_import_draft_id IS NOT NULL;
