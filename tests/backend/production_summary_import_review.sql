-- Run against TFI2 with an authorized test actor. All writes roll back.
begin;
do $test$
declare
  actor uuid;
  batch uuid;
  selected uuid[];
  sheet_id constant text := 'SyntheticSummarySpreadsheet1234567890';
begin
  for actor in select user_id from public.tfi_profiles where account_status='active' loop
    perform set_config('request.jwt.claim.sub',actor::text,true);
    exit when private.tfi_has_permission('production_entry','import')
      and private.tfi_has_permission('spreadsheet_import','create')
      and private.tfi_has_permission('spreadsheet_import','import')
      and private.tfi_has_permission('import_confirmation','import');
  end loop;
  begin
    perform public.tfi_create_import_batch('production_entry','google_sheets','Synthetic Production Summary',
      'google:'||sheet_id,null,null,sheet_id,1923467491);
    raise exception 'Daily form must not be accepted as the historical source';
  exception when invalid_parameter_value then
    if sqlerrm <> 'source_sheet_not_approved_for_destination' then raise; end if;
  end;
  batch := (public.tfi_create_import_batch('production_entry','google_sheets','Synthetic Production Summary',
    'google:'||sheet_id,null,null,sheet_id,1846667474)->>'id')::uuid;
  perform public.tfi_stage_import_rows(batch,(
    select jsonb_agg(jsonb_build_object('source_row_number',i,'source_locator','row:'||i,
      'source_values',v,'source_fingerprint',lpad(i::text,64,'0'),'classification','operational'))
    from (values (7,'[46105,"Agri","Test","TEST-1",1]'::jsonb),
      (8,'[46105,"Agri","Test",null,2]'::jsonb),(9,'[46105,"Agri"]'::jsonb)) x(i,v)
  ));
  perform public.tfi_complete_import_scan(batch,'{"rows_inspected":3}');
  if (select count(*) from public.tfi_import_rows where batch_id=batch and (
      (source_row_number=7 and import_status='held' and completeness_status='unassessed')
      or (source_row_number=8 and import_status='held' and completeness_status='incomplete' and missing_fields=array['product_code'])
      or (source_row_number=9 and classification='helper')
  )) <> 3 then raise exception 'Unexpected Production Summary staging classifications'; end if;
  select array_agg(id) into selected from public.tfi_import_rows where batch_id=batch;
  begin
    perform public.tfi_finalize_import_batch(batch,selected);
    raise exception 'Production Summary must remain in review';
  exception when invalid_parameter_value then
    if sqlerrm <> 'production_summary_import_review_only' then raise; end if;
  end;
end;
$test$;

rollback;
