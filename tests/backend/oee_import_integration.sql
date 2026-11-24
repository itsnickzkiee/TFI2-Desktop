-- Run against TFI2 with an active authorized OEE test actor. All writes roll back.
begin;
do $test$
declare
  actor uuid;
  batch uuid;
  sheet_id text := 'SyntheticTestSpreadsheetId1234567890';
  selected uuid[];
  result jsonb;
  complete jsonb := '[46024,"Synthetic OEE Import","Test Line","TEST-IMPORT",10,2,100,1000,100,"Y"]';
  n integer;
begin
  for actor in select user_id from public.tfi_profiles where account_status='active' loop
    perform set_config('request.jwt.claim.sub', actor::text, true);
    exit when private.tfi_has_permission('oee','import')
      and private.tfi_has_permission('spreadsheet_import','create')
      and private.tfi_has_permission('spreadsheet_import','import')
      and private.tfi_has_permission('import_confirmation','import');
  end loop;
  for n in 1..2 loop
    batch := (public.tfi_create_import_batch('oee','google_sheets','Synthetic OEE',
      'google:'||sheet_id,null,null,sheet_id,1750442014)->>'id')::uuid;
    perform public.tfi_stage_import_rows(batch, (
      select jsonb_agg(jsonb_build_object('source_row_number',i,'source_locator','row:'||i,
        'source_values',v,'source_fingerprint',repeat(i::text,64),'classification','operational'))
      from (values (5,complete),(6,jsonb_set(complete,'{1}','" synthetic oee import "')),
        (7,'[46024,"Partial"]'::jsonb),(8,jsonb_set(complete,'{5}','11'))) x(i,v)
    ));
    perform public.tfi_complete_import_scan(batch,'{"rows_inspected":4}');
    select array_agg(id) into selected from public.tfi_import_rows where batch_id=batch;
    result := public.tfi_finalize_import_batch(batch,selected);
    if (result->>'rows_inserted')::integer <> (case when n=1 then 1 else 0 end)
       or (result->>'rows_duplicates')::integer <> n
       or (result->>'rows_incomplete')::integer <> 1 or (result->>'rows_failed')::integer <> 1
       or (result->>'rows_held')::integer <> 1 then
      raise exception 'Unexpected OEE batch summary: %',result;
    end if;
  end loop;
  if (select count(*) from public.tfi_oee_records o join public.tfi_import_rows r
      on r.id=o.source_import_row_id where o.product_code='TEST-IMPORT' and r.source_row_number=5
      and o.total_count=1000) <> 1 then
    raise exception 'Expected one canonical record with provenance';
  end if;
end;
$test$;

rollback;
