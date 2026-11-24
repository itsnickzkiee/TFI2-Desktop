-- Phase 41.8 provenance constraint hardening.
alter table public.tfi_production_entry_records
  drop constraint if exists tfi_production_entry_records_source_import_provenance_check;

alter table public.tfi_production_entry_records
  add constraint tfi_production_entry_records_source_import_provenance_check
  check (
    (source_import_draft_id is null and source_import_batch_id is null
      and source_import_spreadsheet_id is null and source_import_sheet is null
      and source_import_sheet_row is null and source_import_source_key is null
      and source_import_fingerprint_sha256 is null)
    or
    (source_import_draft_id is not null and source_import_batch_id is not null
      and source_import_spreadsheet_id is not null
      and length(source_import_spreadsheet_id) between 20 and 128
      and source_import_sheet is not null
      and source_import_sheet='Production Summary'
      and source_import_sheet_row is not null
      and source_import_sheet_row between 7 and 13188
      and source_import_source_key is not null
      and length(source_import_source_key) between 1 and 240
      and source_import_fingerprint_sha256 is not null
      and source_import_fingerprint_sha256 ~ '^[a-f0-9]{64}$')
  );
