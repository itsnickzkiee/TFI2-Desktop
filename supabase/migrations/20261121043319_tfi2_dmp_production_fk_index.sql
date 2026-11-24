-- Additive performance index for the DMP Production archive actor foreign key.
create index if not exists tfi_dmp_production_archived_by_idx
  on public.tfi_dmp_production_records (archived_by);
