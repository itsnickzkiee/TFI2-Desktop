create index if not exists tfi_nonprod_records_created_by_idx on public.tfi_nonprod_records(created_by);
create index if not exists tfi_nonprod_records_updated_by_idx on public.tfi_nonprod_records(updated_by);
create index if not exists tfi_nonprod_revisions_changed_by_idx on public.tfi_nonprod_revisions(changed_by);