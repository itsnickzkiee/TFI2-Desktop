create index if not exists tfi_pr_monitoring_import_batch_idx
  on public.tfi_pr_monitoring_records(import_batch_id);
create index if not exists tfi_pr_monitoring_imported_by_idx
  on public.tfi_pr_monitoring_records(imported_by);
