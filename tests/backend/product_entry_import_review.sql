-- Run against TFI2 with an authorized test actor. All writes roll back.
begin;
do $test$
declare
  actor uuid;
  batch uuid;
  selected uuid[];
  sheet_id constant text := '1rCbQ16wj7MRjQCFF3tA-WEMkudraJK0RkwcqayUlz7k';
begin
  for actor in select user_id from public.tfi_profiles where account_status='active' loop
    perform set_config('request.jwt.claim.sub',actor::text,true);
    exit when private.tfi_has_permission('product_entry','import')
      and private.tfi_has_permission('spreadsheet_import','create')
      and private.tfi_has_permission('spreadsheet_import','import')
      and private.tfi_has_permission('import_confirmation','import');
  end loop;
  batch := (public.tfi_create_import_batch('product_entry','google_sheets','Synthetic Product Entry',
    'google:'||sheet_id,null,null,sheet_id,545274882)->>'id')::uuid;
  perform public.tfi_stage_import_rows(batch,(
    select jsonb_agg(jsonb_build_object('source_row_number',i,'source_locator','row:'||i,
      'source_values',v,'source_fingerprint',lpad(i::text,64,'0'),'classification','operational'))
    from (values (8,'["January 7","MDP-100-155"]'::jsonb),(9,'[46034]'::jsonb),
      (1009,'["section"]'::jsonb),(1012,'[46034,"MGB-48-225"]'::jsonb),
      (3020,'[46034,"MGB-48-225"]'::jsonb)) x(i,v)
  ));
  perform public.tfi_complete_import_scan(batch,'{"rows_inspected":5}');
  if (select count(*) from public.tfi_import_rows where batch_id=batch and (
      (source_row_number=8 and import_status='held' and review_reason like 'BLK_01%including the year.')
      or (source_row_number=9 and completeness_status='incomplete' and missing_fields=array['product_code'])
      or (source_row_number=1009 and classification='helper')
      or (source_row_number=1012 and import_status='held' and review_reason like 'BLK_02%')
      or (source_row_number=3020 and import_status='held' and review_reason like 'BLK_04%')
  )) <> 5 then raise exception 'Unexpected Product Entry staging classifications'; end if;
  select array_agg(id) into selected from public.tfi_import_rows where batch_id=batch;
  begin
    perform public.tfi_finalize_import_batch(batch,selected);
    raise exception 'Product Entry must remain in review';
  exception when invalid_parameter_value then
    if sqlerrm <> 'product_entry_import_review_only' then raise; end if;
  end;
end;
$test$;

rollback;
