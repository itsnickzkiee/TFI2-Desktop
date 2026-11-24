-- Run against TFI2 with an authorized test actor. All writes roll back.
begin;
do $test$
declare a uuid; b uuid; ids uuid[]; result jsonb;
begin
  for a in select user_id from public.tfi_profiles where account_status='active' loop
    perform set_config('request.jwt.claim.sub',a::text,true);
    exit when private.tfi_has_permission('production_schedule','import') and private.tfi_has_permission('spreadsheet_import','create')
      and private.tfi_has_permission('spreadsheet_import','import') and private.tfi_has_permission('import_confirmation','import');
  end loop;
  b := (public.tfi_create_import_batch('production_schedule','google_sheets','Synthetic Schedule',
    'google:SyntheticScheduleSpreadsheet123456789',null,null,'SyntheticScheduleSpreadsheet123456789',1538651320)->>'id')::uuid;
  perform public.tfi_stage_import_rows(b,(
    select jsonb_agg(jsonb_build_object('source_row_number',i,'source_locator','row:'||i,'source_values',v,
      'source_fingerprint',lpad(i::text,64,'0'),'classification',c))
    from (values (8,'["=$A$7","Product","SKU"]'::jsonb,'operational'),
      (9,'["=$A$7","Product"]'::jsonb,'operational'),
      (10,'["=$A$7"]'::jsonb,'derived'),
      (18,'[null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,"TOTAL PAX",0]'::jsonb,'operational')
    ) x(i,v,c)
  ));
  perform public.tfi_complete_import_scan(b,'{"rows_inspected":4}');
  if (select count(*) from public.tfi_import_rows where batch_id=b and (
    (source_row_number=8 and import_status='pending' and completeness_status='unassessed') or
    (source_row_number=9 and import_status='held' and missing_fields=array['production_code']) or
    (source_row_number=10 and classification='derived' and import_status='excluded') or
    (source_row_number=18 and classification='helper' and import_status='excluded')
  )) <> 4 then raise exception 'Unexpected schedule staging result'; end if;
  select array_agg(id) into ids from public.tfi_import_rows where batch_id=b;
  result := public.tfi_finalize_import_batch(b,ids);
  if result->>'status'<>'review' or (result->>'rows_held')::integer<>2 then
    raise exception 'An incomplete form must remain in review';
  end if;
end;
$test$;

rollback;