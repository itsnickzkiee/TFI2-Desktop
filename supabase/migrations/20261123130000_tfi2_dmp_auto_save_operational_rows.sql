CREATE OR REPLACE FUNCTION private.tfi_save_all_dmp_import_batch(p_batch_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_batch public.tfi_import_batches%rowtype;
  v_row public.tfi_import_rows%rowtype;
  v_values jsonb;
  v_text text;
  v_serial numeric;
  v_day date;
  v_product text;
  v_process text;
  v_worker text;
  v_count numeric;
  v_hours numeric;
  v_start time;
  v_end time;
  v_worker_id uuid;
  v_position text;
  v_blank text[];
  v_fingerprint text;
  v_new_id uuid;
  v_existing_id uuid;
  v_inserted integer := 0;
  v_duplicates integer := 0;
  v_held integer := 0;
  v_failed integer := 0;
  v_incomplete integer := 0;
  v_pending integer := 0;
  v_excluded integer := 0;
  v_issue_count integer := 0;
begin
  if v_user_id is null then
    raise exception using errcode='42501',message='authentication_required';
  end if;

  select * into v_batch
  from public.tfi_import_batches
  where id=p_batch_id
  for update;

  if not found or v_batch.module_key<>'dmp_production' then
    raise exception using errcode='P0002',message='dmp_production_import_batch_not_found';
  end if;
  if not private.tfi_has_permission('spreadsheet_import','import')
     or not private.tfi_has_permission('dmp_production','import')
     or not private.tfi_has_permission('dmp_production','create') then
    raise exception using errcode='42501',message='dmp_production_import_permission_required';
  end if;
  if v_batch.status not in ('review','completed','completed_with_issues') then
    raise exception using errcode='22023',message='dmp_import_batch_not_ready';
  end if;

  for v_row in
    select r.*
    from public.tfi_import_rows r
    where r.batch_id=p_batch_id
      and r.import_status in ('pending','held')
      and r.classification='operational'
    order by r.source_row_number,r.source_locator
    for update
  loop
    if v_row.review_decision='hold' then
      v_held:=v_held+1;
      continue;
    end if;

    if v_row.review_decision='skip_duplicate'
       or v_row.duplicate_status in ('exact_source_duplicate','confirmed_duplicate') then
      update public.tfi_import_rows
      set import_status='skipped_existing',
          duplicate_status='confirmed_duplicate',
          review_reason=coalesce(review_reason,'Confirmed duplicate; kept out of DMP Production.')
      where id=v_row.id;
      v_duplicates:=v_duplicates+1;
      continue;
    end if;

    if v_row.duplicate_status='possible_duplicate' then
      update public.tfi_import_rows
      set import_status='held',
          review_reason=coalesce(review_reason,'Possible duplicate requires confirmation before import.')
      where id=v_row.id;
      v_held:=v_held+1;
      continue;
    end if;

    v_values:=coalesce(v_row.source_values,'[]'::jsonb);

    -- Parse each field independently. Missing or malformed values become blanks,
    -- so a partially populated operational row can still be saved as Incomplete.
    v_day:=null;
    v_text:=nullif(btrim(v_values->>0),'');
    if v_text is not null then
      begin
        if jsonb_typeof(v_values->0)='number' then
          v_serial:=v_text::numeric;
          if v_serial>=0 and v_serial<=2958465 and v_serial=trunc(v_serial) then
            v_day:=date '1899-12-30'+v_serial::integer;
          end if;
        elsif v_text ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}(T00:00:00)?$' then
          v_day:=left(v_text,10)::date;
        end if;
      exception when others then
        v_day:=null;
      end;
    end if;

    v_product:=nullif(btrim(v_values->>1),'');
    if length(coalesce(v_product,''))>100 then v_product:=null; end if;
    v_process:=nullif(btrim(v_values->>2),'');
    if length(coalesce(v_process,''))>300 then v_process:=null; end if;
    v_worker:=nullif(btrim(v_values->>3),'');
    if length(coalesce(v_worker,''))>200 then v_worker:=null; end if;

    v_count:=null;
    v_text:=nullif(btrim(v_values->>4),'');
    if v_text is not null then
      begin
        v_count:=replace(v_text,',','')::numeric;
        if v_count<0 or v_count>='Infinity'::numeric then v_count:=null; end if;
      exception when others then
        v_count:=null;
      end;
    end if;

    v_start:=private.tfi_parse_dmp_import_time(v_values->5);
    v_end:=private.tfi_parse_dmp_import_time(v_values->6);

    v_hours:=null;
    v_text:=nullif(btrim(v_values->>7),'');
    if v_text is not null then
      begin
        v_hours:=replace(v_text,',','')::numeric;
        if v_hours<0 or v_hours>='Infinity'::numeric then v_hours:=null; end if;
      exception when others then
        v_hours:=null;
      end;
    end if;

    v_blank:=array_remove(array[
      case when v_day is null then 'production_date' end,
      case when v_product is null then 'product_code' end,
      case when v_process is null then 'process' end,
      case when v_worker is null then 'worker_name' end,
      case when v_count is null then 'worker_count' end,
      case when v_start is null then 'start_time' end,
      case when v_end is null then 'end_time' end,
      case when v_hours is null then 'total_time_hours' end
    ],null);

    if cardinality(v_blank)=8 then
      update public.tfi_import_rows
      set import_status='excluded',
          classification='invalid',
          review_reason='No usable DMP Production values were present in this source row.'
      where id=v_row.id;
      continue;
    end if;

    v_worker_id:=null;
    v_position:=null;
    if v_worker is not null then
      select md.id,nullif(btrim(md.current_values->>1),'')
      into v_worker_id,v_position
      from public.tfi_master_data_rows md
      where md.category_key='dmp_legend'
        and md.row_kind='data'
        and md.record_status='active'
        and nullif(btrim(md.current_values->>0),'')=v_worker
      order by md.source_row_number
      limit 1;
    end if;

    v_fingerprint:=private.tfi_dmp_record_fingerprint(
      v_day,v_product,v_process,v_worker,v_count,v_start,v_end,v_hours
    );

    v_new_id:=null;
    insert into public.tfi_dmp_production_records(
      production_date,product_code,process,worker_name,worker_position,
      worker_reference_row_id,worker_count,start_time,end_time,total_time_hours,
      record_fingerprint,completeness_status,blank_fields,
      created_by,updated_by,source_import_row_id
    ) values (
      v_day,v_product,v_process,v_worker,v_position,v_worker_id,
      v_count,v_start,v_end,v_hours,v_fingerprint,
      case when cardinality(v_blank)>0 then 'incomplete' else 'complete' end,
      v_blank,v_user_id,v_user_id,v_row.id
    )
    on conflict do nothing
    returning id into v_new_id;

    if v_new_id is null then
      select r.id
      into v_existing_id
      from public.tfi_dmp_production_records r
      where r.record_fingerprint=v_fingerprint
         or r.source_import_row_id=v_row.id
      order by (r.source_import_row_id=v_row.id) desc
      limit 1;

      if exists(select 1 from public.tfi_dmp_production_records r where r.source_import_row_id=v_row.id) then
        select r.id into v_existing_id
        from public.tfi_dmp_production_records r
        where r.source_import_row_id=v_row.id;
        update public.tfi_import_rows
        set import_status='inserted',
            completeness_status=case when cardinality(v_blank)>0 then 'incomplete' else 'complete' end,
            missing_fields=v_blank,
            review_reason=null
        where id=v_row.id;
        v_inserted:=v_inserted+1;
      else
        update public.tfi_import_rows
        set import_status='skipped_existing',
            duplicate_status='confirmed_duplicate',
            review_reason='An identical normalized DMP Production record already exists.'
        where id=v_row.id;
        v_duplicates:=v_duplicates+1;
      end if;
    else
      update public.tfi_import_rows
      set import_status='inserted',
          completeness_status=case when cardinality(v_blank)>0 then 'incomplete' else 'complete' end,
          missing_fields=v_blank,
          review_reason=case when cardinality(v_blank)>0
            then 'Saved to DMP Production with blank fields: '||array_to_string(v_blank,', ')
            else null end
      where id=v_row.id;

      v_inserted:=v_inserted+1;
      if cardinality(v_blank)>0 then v_incomplete:=v_incomplete+1; end if;

      perform private.tfi_write_import_audit_event(
        'dmp_production.import','dmp_production','dmp_production_record',
        v_new_id::text,null,
        jsonb_build_object(
          'production_date',v_day,'product_code',v_product,'process',v_process,
          'worker_name',v_worker,'worker_position',v_position,'worker_count',v_count,
          'start_time',v_start,'end_time',v_end,'total_time_hours',v_hours,
          'completeness_status',case when cardinality(v_blank)>0 then 'incomplete' else 'complete' end,
          'blank_fields',to_jsonb(v_blank)
        ),
        jsonb_build_object(
          'batch_id',v_batch.id,'import_row_id',v_row.id,
          'source_row_number',v_row.source_row_number,'source_locator',v_row.source_locator
        )
      );
    end if;
  end loop;

  select
    count(*) filter(where import_status='inserted'),
    count(*) filter(where import_status='skipped_existing'),
    count(*) filter(where import_status='held'),
    count(*) filter(where import_status='failed'),
    count(*) filter(where import_status='pending'),
    count(*) filter(where import_status='excluded'),
    count(*) filter(where import_status='inserted' and completeness_status='incomplete')
  into v_inserted,v_duplicates,v_held,v_failed,v_pending,v_excluded,v_incomplete
  from public.tfi_import_rows
  where batch_id=p_batch_id;

  v_issue_count:=v_duplicates+v_held+v_failed+v_incomplete+v_excluded;

  update public.tfi_import_batches
  set rows_inserted=v_inserted,
      rows_incomplete=v_incomplete,
      rows_duplicates=v_duplicates,
      rows_held=v_held,
      rows_failed=v_failed,
      status=case when v_pending>0 or v_held>0 or v_failed>0 then 'review'
                  when v_issue_count>0 then 'completed_with_issues'
                  else 'completed' end,
      completed_at=case when v_pending=0 and v_held=0 and v_failed=0 then now() else null end
  where id=p_batch_id
  returning * into v_batch;

  perform private.tfi_write_import_audit_event(
    'import.batch.dmp_saved','spreadsheet_import','import_batch',v_batch.id::text,
    null,
    jsonb_build_object(
      'status',v_batch.status,'rows_inserted',v_inserted,'rows_incomplete',v_incomplete,
      'rows_duplicates',v_duplicates,'rows_held',v_held,'rows_failed',v_failed,
      'rows_excluded',v_excluded
    ),
    jsonb_build_object('module_key','dmp_production','issue_count',v_issue_count)
  );

  return jsonb_build_object(
    'id',v_batch.id,'batch_ref',v_batch.batch_ref,'status',v_batch.status,
    'rows_inserted',v_inserted,'rows_incomplete',v_incomplete,
    'rows_duplicates',v_duplicates,'rows_held',v_held,'rows_failed',v_failed,
    'rows_pending',v_pending,'rows_excluded',v_excluded
  );
end;
$function$


CREATE OR REPLACE FUNCTION public.tfi_save_all_dmp_import_batch(p_batch_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select private.tfi_save_all_dmp_import_batch($1);
$function$


revoke all on function private.tfi_save_all_dmp_import_batch(uuid) from public,anon,authenticated;
grant execute on function private.tfi_save_all_dmp_import_batch(uuid) to authenticated;
revoke all on function public.tfi_save_all_dmp_import_batch(uuid) from public,anon,authenticated;
grant execute on function public.tfi_save_all_dmp_import_batch(uuid) to authenticated;
