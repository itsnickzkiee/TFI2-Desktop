-- TFI2 Product Entry foreign-key index follow-up.
begin;
create index tfi_product_entry_records_archived_by_idx
  on public.tfi_product_entry_records (archived_by);
commit;
