-- Run against TFI2 with an active authorized DMP test actor. All writes roll back.
begin;
do $test$
declare
  actor uuid;
  batch uuid;
  sheet_id text := 'SyntheticDmpSpreadsheetId1234567890';
  selected uuid[];
  result jsonb;
  complete jsonb;
  n integer;
begin
  select jsonb_build_array(46024,'TEST-DMP-IMPORT',btrim(current_values->>2),
    btrim(current_values->>0),1,0.25,'15:00 PM',8,'untrusted source position')
  into complete from public.tfi_master_data_rows
  where category_key='dmp_legend' and row_kind='data' and record_status='active'
    and nullif(btrim(current_values->>0),'') is not null
    and nullif(btrim(current_values->>2),'') is not null
  order by source_row_number limit 1;
  if complete is null then raise exception 'DMP Legend fixture required'; end if;
  if private.tfi_parse_dmp_import_time('"13:00 AM"') is not null
     or private.tfi_parse_dmp_import_time('"3:00 PM"') is distinct from time '15:00'
     or private.tfi_parse_dmp_import_time('0.25') is distinct from time '06:00' then
    raise exception 'DMP time conversion mismatch';
  end if;
  for actor in select user_id from public.tfi_profiles where account_status='active' loop
    perform set_config('request.jwt.claim.sub', actor::text, true);
    exit when private.tfi_has_permission('dmp_production','import')
      and private.tfi_has_permission('spreadsheet_import','create')
      and private.tfi_has_permission('spreadsheet_import','import')
      and private.tfi_has_permission('import_confirmation','import');
  end loop;
  for n in 1..2 loop
    batch := (public.tfi_create_import_batch('dmp_production','google_sheets','Synthetic DMP',
      'google:'||sheet_id,null,null,sheet_id,1312335050)->>'id')::uuid;
    perform public.tfi_stage_import_rows(batch, (
      select jsonb_agg(jsonb_build_object('source_row_number',i,'source_locator','row:'||i,
        'source_values',v,'source_fingerprint',repeat(i::text,64),'classification','operational'))
      from (values (2,complete),(3,jsonb_set(complete,'{6}','"3:00 PM"')),
        (4,'[46024,"Partial"]'::jsonb),(5,jsonb_set(complete,'{6}','"15:00 AM"')),
        (6,jsonb_set(complete,'{3}','"Synthetic unmatched worker"'))) x(i,v)
    ));
    perform public.tfi_complete_import_scan(batch,'{"rows_inspected":5}');
    select array_agg(id) into selected from public.tfi_import_rows where batch_id=batch;
    result := public.tfi_finalize_import_batch(batch,selected);
    if (result->>'rows_inserted')::integer <> (case when n=1 then 1 else 0 end)
       or (result->>'rows_duplicates')::integer <> n
       or (result->>'rows_incomplete')::integer <> 1 or (result->>'rows_failed')::integer <> 1
       or (result->>'rows_held')::integer <> 2 then
      raise exception 'Unexpected DMP batch summary: %',result;
    end if;
  end loop;
  if (select count(*) from public.tfi_dmp_production_records o join public.tfi_import_rows r
      on r.id=o.source_import_row_id where o.product_code='TEST-DMP-IMPORT' and r.source_row_number=2
      and o.start_time=time '06:00' and o.end_time=time '15:00'
      and o.worker_position is distinct from 'untrusted source position') <> 1 then
    raise exception 'Expected one canonical DMP record with provenance and trusted position';
  end if;
end;
$test$;

rollback;
