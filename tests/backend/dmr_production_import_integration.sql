-- Run against TFI2 with an authorized test actor. All writes roll back.
begin;
do $test$
declare
  actor uuid; batch uuid; ids uuid[]; result jsonb; n integer;
  fixture jsonb := '[73418,"TEST-DMR","Test Line","23:55","00:05",null,null,"BD",null,null,"Original"]';
  sid text := 'SyntheticDmrSpreadsheet123456789';
begin
  for actor in select user_id from public.tfi_profiles where account_status='active' loop
    perform set_config('request.jwt.claim.sub',actor::text,true);
    exit when private.tfi_has_permission('dmr_production','import') and private.tfi_has_permission('spreadsheet_import','create')
      and private.tfi_has_permission('spreadsheet_import','import') and private.tfi_has_permission('import_confirmation','import');
  end loop;
  for n in 1..2 loop
    batch := (public.tfi_create_import_batch('dmr_production','google_sheets','Synthetic DMR Production',
      'google:'||sid,null,null,sid,2048043346)->>'id')::uuid;
    perform public.tfi_stage_import_rows(batch,(
      select jsonb_agg(jsonb_build_object('source_row_number',i,'source_locator','row:'||i,'source_values',v,
        'source_formulas','{"F":"=G4*60","G":"=MOD(E4-D4,1)*24"}'::jsonb,
        'source_fingerprint',lpad(i::text,64,'0'),'classification','operational'))
      from (values (4,fixture),(5,jsonb_set(fixture,'{2}','" test line "')),
        (6,jsonb_set(fixture,'{10}','"Conflicting remarks"')),(7,jsonb_set(fixture,'{4}','null')),
        (8,jsonb_set(fixture,'{8}','"Unknown input"')),(9,jsonb_set(fixture,'{3}','"25:00"'))) x(i,v)
    ));
    perform public.tfi_complete_import_scan(batch,'{"rows_inspected":6}');
    select array_agg(id) into ids from public.tfi_import_rows where batch_id=batch;
    result := public.tfi_finalize_import_batch(batch,ids);
    if (result->>'rows_inserted')::integer <> (case when n=1 then 1 else 0 end)
      or (result->>'rows_duplicates')::integer <> n
      or (result->>'rows_held')::integer <> 3
      or (result->>'rows_failed')::integer <> 1
      or (result->>'rows_incomplete')::integer <> 1 then
      raise exception 'Unexpected DMR result: %',result;
    end if;
  end loop;
  if (select count(*) from public.tfi_dmr_production_records o join public.tfi_import_rows r
    on r.id=o.source_import_row_id where o.product_code='TEST-DMR' and o.remarks='Original'
      and o.downtime_minutes=10 and r.source_row_number=4) <> 1 then
    raise exception 'Expected a single unchanged 10-minute overnight event with provenance';
  end if;
end;
$test$;

rollback;
