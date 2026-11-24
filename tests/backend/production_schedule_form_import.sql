-- Run against TFI2 with an authorized test actor. All writes roll back.
begin;
do $test$
declare actor uuid; batch uuid; ids uuid[]; result jsonb; n integer; group_name text; code text; fixture jsonb; footer jsonb;
begin
  select btrim(g.current_values->>0),btrim(p.current_values->>0) into group_name,code
  from public.tfi_master_data_rows p
  join lateral (select trim(split_part(h.current_values->>1,'|',1)) as product_group
    from public.tfi_master_data_rows h where h.category_key='product_standard'
      and h.row_kind='group_header' and h.record_status='active' and h.source_row_number<p.source_row_number
    order by h.source_row_number desc limit 1) h on true
  join public.tfi_master_data_rows g on g.category_key='schedule_lists' and g.row_kind='data'
    and g.record_status='active' and g.source_row_number between 2 and 44 and btrim(g.current_values->>0)=h.product_group
  where p.category_key='product_standard' and p.row_kind='data' and p.record_status='active'
    and nullif(btrim(p.current_values->>0),'') is not null limit 1;
  if code is null then raise exception 'Schedule fixture catalog is unavailable'; end if;
  for actor in select user_id from public.tfi_profiles where account_status='active' loop
    perform set_config('request.jwt.claim.sub',actor::text,true);
    exit when private.tfi_has_permission('production_schedule','import') and private.tfi_has_permission('spreadsheet_import','create')
      and private.tfi_has_permission('spreadsheet_import','import') and private.tfi_has_permission('import_confirmation','import');
  end loop;
  footer := '[null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,"TOTAL PAX",25]';
  for n in 1..4 loop
    fixture := jsonb_build_array(73417,group_name,case when n=4 then null else code end,case when n=3 then 2 else 1 end);
    batch := (public.tfi_create_import_batch('production_schedule','google_sheets','Synthetic Schedule Operational',
      'google:SyntheticScheduleSpreadsheet123456789',null,null,'SyntheticScheduleSpreadsheet123456789',1538651320)->>'id')::uuid;
    perform public.tfi_stage_import_rows(batch,(
      select jsonb_agg(jsonb_build_object('source_row_number',i,'source_locator','row:'||i,'source_values',v,
        'source_formulas',f,'source_fingerprint',lpad(i::text,64,'0'),'classification','operational'))
      from (values (8,fixture,'{"A":"=$A$7"}'::jsonb),(18,footer,'{"Q":"=SUM(Q8:Q17)"}'::jsonb)) x(i,v,f)
    ));
    perform public.tfi_complete_import_scan(batch,'{"rows_inspected":2}');
    select array_agg(id) filter(where source_row_number=8) into ids from public.tfi_import_rows where batch_id=batch;
    result := public.tfi_finalize_import_batch(batch,ids);
    if (n=1 and ((result->>'rows_inserted')::int<>1 or result->>'status'<>'completed'))
      or (n=2 and ((result->>'rows_duplicates')::int<>1 or result->>'status'<>'completed_with_issues'))
      or (n>=3 and ((result->>'rows_held')::int<>1 or result->>'status'<>'review')) then
      raise exception 'Unexpected schedule approval result: %',result;
    end if;
    if n=1 and public.tfi_finalize_import_batch(batch,ids) is distinct from result then
      raise exception 'Repeat approval did not return the same result';
    end if;
  end loop;
  if (select count(*) from public.tfi_production_schedule_forms f join public.tfi_import_batches b
      on f.source_import_batch_id=b.id where b.source_name='Synthetic Schedule Operational'
      and f.available_pax_total=25 and f.form_data#>>'{rows,0,record_data,D}'='1')<>1 then
    raise exception 'Expected one unchanged daily form with source provenance';
  end if;
end;
$test$;

rollback;
