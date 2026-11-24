-- TFI2 Phase 5B hardening — indexes for import-ledger foreign keys.
-- Additive only. No records or existing operational data are changed.

create index if not exists tfi_import_batches_created_by_idx
  on public.tfi_import_batches (created_by);

create index if not exists tfi_import_batches_source_sheet_ref_idx
  on public.tfi_import_batches (source_sheet_ref);

create index if not exists tfi_import_rows_destination_record_id_idx
  on public.tfi_import_rows (destination_record_id);

create index if not exists tfi_import_rows_duplicate_record_id_idx
  on public.tfi_import_rows (duplicate_record_id);

create index if not exists tfi_operational_records_imported_by_idx
  on public.tfi_operational_records (imported_by);

create index if not exists tfi_operational_records_source_batch_id_idx
  on public.tfi_operational_records (source_batch_id);

create index if not exists tfi_operational_records_source_sheet_ref_idx
  on public.tfi_operational_records (source_sheet_ref);
