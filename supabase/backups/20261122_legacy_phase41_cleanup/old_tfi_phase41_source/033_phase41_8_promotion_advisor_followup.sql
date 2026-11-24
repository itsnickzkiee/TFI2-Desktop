-- Phase 41.8 follow-up — close advisor findings for the new promotion objects.
-- Promotion groups remain inaccessible through direct Data API table access.

drop policy if exists tfi2_historical_promotion_groups_no_direct_read
  on public.tfi_historical_promotion_groups;
create policy tfi2_historical_promotion_groups_no_direct_read
  on public.tfi_historical_promotion_groups
  for select to authenticated
  using (false);

create index if not exists tfi_historical_promotion_groups_created_by_idx
  on public.tfi_historical_promotion_groups(created_by);

create index if not exists tfi_module_import_drafts_promoted_by_idx
  on public.tfi_module_import_drafts(promoted_by)
  where promoted_by is not null;

create index if not exists tfi_module_import_drafts_promoted_record_idx
  on public.tfi_module_import_drafts(promoted_record_id)
  where promoted_record_id is not null;

create index if not exists tfi_module_import_drafts_promotion_group_idx
  on public.tfi_module_import_drafts(promotion_entry_batch_id)
  where promotion_entry_batch_id is not null;

create index if not exists tfi_production_entry_source_import_batch_idx
  on public.tfi_production_entry_records(source_import_batch_id)
  where source_import_batch_id is not null;
