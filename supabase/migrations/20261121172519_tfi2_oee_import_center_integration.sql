alter table public.tfi_oee_records
  add column source_import_row_id uuid unique references public.tfi_import_rows(id) on delete restrict;

create function private.tfi_inspect_oee_import(p_values jsonb)
returns jsonb language plpgsql immutable set search_path = '' as $oee$
declare
  v_fields constant text[] := array['production_date','machine','line','product_code','planned_hours',
    'downtime_hours','ideal_rate','total_count','reject_count','include_in_overall'];
  v_missing text[] := array[]::text[];
  v_day date;
  v_serial numeric;
  v_planned numeric;
  v_down numeric;
  v_rate numeric;
  v_total numeric;
  v_reject numeric;
  v_flag text;
  v_i integer;
begin
  for v_i in 1..10 loop
    if nullif(btrim(p_values->>(v_i-1)), '') is null then
      v_missing := array_append(v_missing,v_fields[v_i]);
    end if;
  end loop;
  if cardinality(v_missing)>0 then
    return jsonb_build_object('status','incomplete','missing_fields',to_jsonb(v_missing));
  end if;

  if jsonb_typeof(p_values->0)='number' then
    v_serial := (p_values->>0)::numeric;
    if v_serial < 0 or v_serial > 2958465 or v_serial <> trunc(v_serial) then
      return jsonb_build_object('status','invalid','reason','Use a valid whole-number spreadsheet date.');
    end if;
    v_day := date '1899-12-30' + v_serial::integer;
  elsif btrim(p_values->>0) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}(T00:00:00)?$' then
    v_day := left(btrim(p_values->>0),10)::date;
  else
    return jsonb_build_object('status','invalid','reason','Use a valid production date.');
  end if;

  v_planned := (p_values->>4)::numeric;
  v_down := (p_values->>5)::numeric;
  v_rate := (p_values->>6)::numeric;
  v_total := (p_values->>7)::numeric;
  v_reject := (p_values->>8)::numeric;
  v_flag := upper(btrim(p_values->>9));
  if jsonb_typeof(p_values->1)<>'string' or length(btrim(p_values->>1))>500
     or jsonb_typeof(p_values->2)<>'string' or length(btrim(p_values->>2))>500
     or jsonb_typeof(p_values->3)<>'string' or length(btrim(p_values->>3))>200
     or v_planned<0 or v_planned>='Infinity'::numeric or v_down not between 0 and v_planned
     or v_rate<0 or v_rate>='Infinity'::numeric
     or v_total not between 0 and 9223372036854775807 or v_total<>trunc(v_total)
     or v_reject not between 0 and v_total or v_reject<>trunc(v_reject)
     or v_flag not in ('Y','N') then
    return jsonb_build_object('status','invalid','reason','Check OEE inputs, counts, hours, and the Y/N flag.');
  end if;
  return jsonb_build_object('status','valid','production_date',v_day,
    'machine',btrim(p_values->>1),'line',btrim(p_values->>2),'product_code',btrim(p_values->>3),
    'planned_hours',v_planned,'downtime_hours',v_down,'ideal_rate',v_rate,
    'total_count',v_total::bigint,'reject_count',v_reject::bigint,'include_in_overall',v_flag);
exception when data_exception then
  return jsonb_build_object('status','invalid','reason','Check OEE date and number formats.');
end;
$oee$;
revoke all on function private.tfi_inspect_oee_import(jsonb) from public, anon, authenticated;

CREATE OR REPLACE FUNCTION private.tfi_stage_import_rows(p_batch_id uuid, p_rows jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_batch public.tfi_import_batches%rowtype;
  v_destination public.tfi_import_destinations%rowtype;
  v_item jsonb;
  v_row_number integer;
  v_locator text;
  v_values jsonb;
  v_formulas jsonb;
  v_fingerprint text;
  v_classification text;
  v_completeness text;
  v_missing_fields text[];
  v_duplicate_status text;
  v_import_status text;
  v_duplicate_id uuid;
  v_oee jsonb;
  v_reason text;
  v_inserted integer := 0;
begin
  if v_user_id is null then
    raise exception using errcode='42501',message='authentication_required';
  end if;
  if p_rows is null or jsonb_typeof(p_rows)<>'array'
    or jsonb_array_length(p_rows)<1 or jsonb_array_length(p_rows)>100 then
    raise exception using errcode='22023',message='import_stage_chunk_must_contain_1_to_100_rows';
  end if;

  select b.* into v_batch
  from public.tfi_import_batches b
  where b.id=p_batch_id
  for update;
  if not found then
    raise exception using errcode='P0002',message='import_batch_not_found';
  end if;
  if v_batch.status<>'scanning' then
    raise exception using errcode='22023',message='import_batch_not_scanning';
  end if;
  if not private.tfi_has_permission('spreadsheet_import','create')
    or not private.tfi_has_permission(v_batch.module_key,'import') then
    raise exception using errcode='42501',message='module_import_permission_required';
  end if;

  select d.* into v_destination
  from public.tfi_import_destinations d
  where d.module_key=v_batch.module_key and d.is_active;
  if not found then
    raise exception using errcode='22023',message='import_destination_not_available';
  end if;

  for v_item in select value from jsonb_array_elements(p_rows) as e(value)
  loop
    if jsonb_typeof(v_item)<>'object' then
      raise exception using errcode='22023',message='invalid_import_row_object';
    end if;
    v_row_number := (v_item->>'source_row_number')::integer;
    v_locator := btrim(coalesce(v_item->>'source_locator',''));
    v_values := v_item->'source_values';
    v_formulas := coalesce(v_item->'source_formulas','{}'::jsonb);
    v_fingerprint := v_item->>'source_fingerprint';
    v_classification := v_item->>'classification';
    v_completeness := coalesce(v_item->>'completeness_status','unassessed');
    v_missing_fields := case
      when jsonb_typeof(v_item->'missing_fields')='array'
      then array(select jsonb_array_elements_text(v_item->'missing_fields'))
      else array[]::text[]
    end;

    if v_row_number is null or v_row_number<1
      or length(v_locator) not between 1 and 120
      or v_values is null or jsonb_typeof(v_values)<>'array'
      or jsonb_array_length(v_values)>200
      or jsonb_typeof(v_formulas)<>'object'
      or v_fingerprint is null or v_fingerprint !~ '^[0-9a-f]{64}$'
      or v_classification is null or v_classification not in ('operational','derived','helper','summary','unmapped','invalid')
      or v_completeness not in ('complete','incomplete','unassessed') then
      raise exception using errcode='22023',message='invalid_import_row_payload';
    end if;

    v_duplicate_id := null;
    v_duplicate_status := 'none';
    v_import_status := 'excluded';

    v_reason := null;
    if v_batch.module_key='oee' and v_classification='operational' then
      v_oee := private.tfi_inspect_oee_import(v_values);
      case v_oee->>'status'
        when 'incomplete' then
          v_completeness := 'incomplete';
          v_missing_fields := array(select jsonb_array_elements_text(v_oee->'missing_fields'));
          v_import_status := 'held';
          v_reason := 'Missing required OEE inputs.';
        when 'invalid' then
          v_classification := 'invalid';
          v_reason := v_oee->>'reason';
        else
          v_completeness := 'complete';
          v_missing_fields := array[]::text[];
          if exists (
            select 1 from public.tfi_oee_records o
            where o.production_date=(v_oee->>'production_date')::date
              and lower(btrim(o.machine))=lower(v_oee->>'machine')
              and lower(btrim(o.product_code))=lower(v_oee->>'product_code')
          ) then
            v_duplicate_status := 'confirmed_duplicate';
            v_import_status := 'skipped_existing';
            v_reason := 'An OEE record already exists for this date, machine, and product.';
          else
            v_import_status := 'pending';
          end if;
      end case;
    elsif v_classification='operational' then
      select o.id into v_duplicate_id
      from public.tfi_operational_records o
      where o.module_key=v_batch.module_key
        and o.source_workbook_key=v_batch.source_workbook_key
        and o.source_sheet_id=v_batch.source_sheet_id
        and o.source_locator=v_locator
      limit 1;

      if v_duplicate_id is not null then
        v_duplicate_status := 'exact_source_duplicate';
        v_import_status := 'skipped_existing';
      elsif v_destination.contract_status='hold_pending_business_rule' then
        v_import_status := 'held';
      elsif exists (
        select 1 from public.tfi_operational_records o
        where o.module_key=v_batch.module_key and o.source_fingerprint=v_fingerprint
      ) or exists (
        select 1 from public.tfi_import_rows r
        where r.batch_id=p_batch_id and r.classification='operational'
          and r.source_fingerprint=v_fingerprint
      ) then
        v_duplicate_status := 'possible_duplicate';
        v_import_status := 'held';
        select o.id into v_duplicate_id
        from public.tfi_operational_records o
        where o.module_key=v_batch.module_key and o.source_fingerprint=v_fingerprint
        order by o.imported_at desc limit 1;
      else
        v_import_status := 'pending';
      end if;
    end if;

    insert into public.tfi_import_rows (
      batch_id,source_row_number,source_locator,source_values,source_formulas,
      source_fingerprint,classification,completeness_status,missing_fields,
      duplicate_status,import_status,duplicate_record_id,review_reason
    )
    values (
      p_batch_id,v_row_number,v_locator,v_values,v_formulas,v_fingerprint,
      v_classification,v_completeness,v_missing_fields,v_duplicate_status,
      v_import_status,v_duplicate_id,v_reason
    )
    on conflict (batch_id,source_locator) do nothing;

    if found then
      v_inserted := v_inserted+1;
    end if;
  end loop;

  update public.tfi_import_batches b
  set rows_staged=(select count(*) from public.tfi_import_rows r where r.batch_id=p_batch_id),
      rows_incomplete=(select count(*) from public.tfi_import_rows r where r.batch_id=p_batch_id and r.completeness_status='incomplete'),
      rows_duplicates=(select count(*) from public.tfi_import_rows r where r.batch_id=p_batch_id and r.duplicate_status in ('exact_source_duplicate','possible_duplicate','confirmed_duplicate')),
      rows_held=(select count(*) from public.tfi_import_rows r where r.batch_id=p_batch_id and r.import_status='held'),
      rows_failed=(select count(*) from public.tfi_import_rows r where r.batch_id=p_batch_id and r.import_status='failed')
  where b.id=p_batch_id;

  return jsonb_build_object(
    'batch_id',p_batch_id,'rows_inserted_to_staging',v_inserted,
    'rows_staged',(select count(*) from public.tfi_import_rows r where r.batch_id=p_batch_id)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION private.tfi_finalize_import_batch(p_batch_id uuid, p_row_ids uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_batch public.tfi_import_batches%rowtype;
  v_destination public.tfi_import_destinations%rowtype;
  v_row public.tfi_import_rows%rowtype;
  v_existing_id uuid;
  v_oee jsonb;
  v_new_id uuid;
  v_inserted integer := 0;
  v_skipped integer := 0;
  v_held integer := 0;
  v_pending integer := 0;
  v_failed integer := 0;
  v_incomplete integer := 0;
  v_issue_count integer := 0;
begin
  if v_user_id is null then
    raise exception using errcode='42501',message='authentication_required';
  end if;
  if p_row_ids is null or cardinality(p_row_ids)<1 or cardinality(p_row_ids)>1000 then
    raise exception using errcode='22023',message='select_between_1_and_1000_import_rows';
  end if;

  select b.* into v_batch
  from public.tfi_import_batches b
  where b.id=p_batch_id
  for update;
  if not found or v_batch.status<>'review' then
    raise exception using errcode='P0002',message='reviewable_import_batch_not_found';
  end if;
  if not private.tfi_has_permission('spreadsheet_import','import')
    or not private.tfi_has_permission('import_confirmation','import')
    or not private.tfi_has_permission(v_batch.module_key,'import') then
    raise exception using errcode='42501',message='final_import_permission_required';
  end if;

  select d.* into v_destination
  from public.tfi_import_destinations d
  where d.module_key=v_batch.module_key and d.is_active;
  if not found then
    raise exception using errcode='22023',message='import_destination_not_available';
  end if;
  if v_destination.contract_status='hold_pending_business_rule' then
    raise exception using errcode='42501',message='import_mapping_pending_business_rule';
  end if;

  for v_row in
    select r.* from public.tfi_import_rows r
    where r.batch_id=p_batch_id and r.id=any(p_row_ids)
    order by r.source_row_number,r.source_locator
    for update
  loop
    if v_row.import_status in ('inserted','skipped_existing','excluded') then
      continue;
    end if;
    if v_batch.module_key='oee' and v_row.classification='operational' then
      v_oee := private.tfi_inspect_oee_import(v_row.source_values);
      if v_oee->>'status'='incomplete' then
        update public.tfi_import_rows set import_status='held', completeness_status='incomplete',
          missing_fields=array(select jsonb_array_elements_text(v_oee->'missing_fields')),
          review_reason='Missing required OEE inputs.' where id=v_row.id;
      elsif v_oee->>'status'='invalid' then
        update public.tfi_import_rows set import_status='excluded', classification='invalid',
          review_reason=v_oee->>'reason' where id=v_row.id;
      elsif v_row.review_decision='hold' then
        update public.tfi_import_rows set import_status='held' where id=v_row.id;
      elsif v_row.review_decision='skip_duplicate' then
        update public.tfi_import_rows set import_status='skipped_existing' where id=v_row.id;
      else
        insert into public.tfi_oee_records (
          production_date,machine,line,product_code,planned_hours,downtime_hours,ideal_rate,
          total_count,reject_count,include_in_overall,created_by,source_import_row_id
        ) values (
          (v_oee->>'production_date')::date,v_oee->>'machine',v_oee->>'line',v_oee->>'product_code',
          (v_oee->>'planned_hours')::numeric,(v_oee->>'downtime_hours')::numeric,(v_oee->>'ideal_rate')::numeric,
          (v_oee->>'total_count')::bigint,(v_oee->>'reject_count')::bigint,v_oee->>'include_in_overall',
          v_user_id,v_row.id
        ) on conflict do nothing returning id into v_new_id;
        if v_new_id is null then
          update public.tfi_import_rows set import_status='skipped_existing',
            duplicate_status='confirmed_duplicate',
            review_reason='An OEE record already exists for this date, machine, and product.' where id=v_row.id;
        else
          update public.tfi_import_rows set import_status='inserted', completeness_status='complete',
            missing_fields=array[]::text[] where id=v_row.id;
          perform private.tfi_write_import_audit_event(
            'oee.import','oee','oee_record',v_new_id::text,null,v_oee,
            jsonb_build_object('batch_id',v_batch.id,'import_row_id',v_row.id)
          );
        end if;
      end if;
      continue;
    end if;
    if v_row.classification<>'operational' then
      update public.tfi_import_rows set import_status='excluded' where id=v_row.id;
      continue;
    end if;
    if v_row.review_decision in ('skip_duplicate','hold') then
      if v_row.review_decision='skip_duplicate' then
        update public.tfi_import_rows set import_status='skipped_existing' where id=v_row.id;
        v_skipped := v_skipped+1;
      else
        update public.tfi_import_rows set import_status='held' where id=v_row.id;
        v_held := v_held+1;
      end if;
      continue;
    end if;
    if v_row.duplicate_status='exact_source_duplicate' then
      update public.tfi_import_rows
      set import_status='skipped_existing',review_decision='skip_duplicate'
      where id=v_row.id;
      v_skipped := v_skipped+1;
      continue;
    end if;
    if v_row.duplicate_status='possible_duplicate'
      and v_row.review_decision is distinct from 'import_as_new' then
      update public.tfi_import_rows set import_status='held' where id=v_row.id;
      v_held := v_held+1;
      continue;
    end if;

    v_existing_id := null;
    select o.id into v_existing_id
    from public.tfi_operational_records o
    where o.module_key=v_batch.module_key
      and o.source_workbook_key=v_batch.source_workbook_key
      and o.source_sheet_id=v_batch.source_sheet_id
      and o.source_locator=v_row.source_locator
    limit 1;
    if v_existing_id is not null then
      update public.tfi_import_rows
      set duplicate_status='exact_source_duplicate',duplicate_record_id=v_existing_id,
          import_status='skipped_existing'
      where id=v_row.id;
      v_skipped := v_skipped+1;
      continue;
    end if;

    if v_row.review_decision is distinct from 'import_as_new' then
      select o.id into v_existing_id
      from public.tfi_operational_records o
      where o.module_key=v_batch.module_key
        and o.source_fingerprint=v_row.source_fingerprint
      order by o.imported_at desc limit 1;
      if v_existing_id is not null then
        update public.tfi_import_rows
        set duplicate_status='possible_duplicate',duplicate_record_id=v_existing_id,
            import_status='held'
        where id=v_row.id;
        v_held := v_held+1;
        continue;
      end if;
    end if;

    v_new_id := null;
    insert into public.tfi_operational_records (
      module_key,source_batch_id,source_row_id,source_workbook_key,
      source_file_sha256,source_spreadsheet_id,source_sheet_ref,
      source_sheet_id,source_sheet_title,source_row_number,source_locator,
      source_fingerprint,source_values,source_formulas,completeness_status,
      missing_fields,imported_by
    )
    values (
      v_batch.module_key,v_batch.id,v_row.id,v_batch.source_workbook_key,
      v_batch.source_file_sha256,v_batch.source_spreadsheet_id,v_batch.source_sheet_ref,
      v_batch.source_sheet_id,v_batch.source_sheet_title,v_row.source_row_number,
      v_row.source_locator,v_row.source_fingerprint,v_row.source_values,
      v_row.source_formulas,v_row.completeness_status,v_row.missing_fields,v_user_id
    )
    on conflict do nothing
    returning id into v_new_id;

    if v_new_id is null then
      select o.id into v_existing_id
      from public.tfi_operational_records o
      where o.module_key=v_batch.module_key
        and o.source_workbook_key=v_batch.source_workbook_key
        and o.source_sheet_id=v_batch.source_sheet_id
        and o.source_locator=v_row.source_locator
      limit 1;
      update public.tfi_import_rows
      set duplicate_status='exact_source_duplicate',duplicate_record_id=v_existing_id,
          import_status='skipped_existing'
      where id=v_row.id;
      v_skipped := v_skipped+1;
    else
      update public.tfi_import_rows
      set import_status='inserted',destination_record_id=v_new_id
      where id=v_row.id;
      v_inserted := v_inserted+1;
      if v_row.completeness_status='incomplete' then
        v_incomplete := v_incomplete+1;
      end if;
    end if;
  end loop;

  select
    count(*) filter(where import_status='pending'),
    count(*) filter(where import_status='held'),
    count(*) filter(where import_status='failed'),
    count(*) filter(where import_status='skipped_existing')
  into v_pending,v_held,v_failed,v_skipped
  from public.tfi_import_rows
  where batch_id=p_batch_id;

  select count(*) into v_incomplete
  from public.tfi_operational_records o
  where o.source_batch_id=p_batch_id and o.completeness_status='incomplete';

  if v_batch.module_key='oee' then
    select count(*) filter (where completeness_status='incomplete'),
           count(*) filter (where import_status='inserted'),
           count(*) filter (where import_status='failed' or classification='invalid')
    into v_incomplete,v_inserted,v_failed
    from public.tfi_import_rows where batch_id=p_batch_id;
  else
    select count(*) into v_inserted from public.tfi_operational_records where source_batch_id=p_batch_id;
  end if;

  update public.tfi_import_batches b
  set rows_inserted=v_inserted,
      rows_incomplete=v_incomplete,
      rows_duplicates=v_skipped,
      rows_held=v_held,
      rows_failed=v_failed,
      status=case
        when v_pending>0 or v_held>0 then 'review'
        when v_skipped>0 or v_failed>0 or v_incomplete>0 then 'completed_with_issues'
        else 'completed'
      end,
      completed_at=case when v_pending=0 and v_held=0 then now() else null end
  where b.id=p_batch_id
  returning * into v_batch;

  v_issue_count := v_skipped+v_held+v_failed+v_incomplete;
  perform private.tfi_write_import_audit_event(
    'import.batch.finalized','spreadsheet_import','import_batch',v_batch.id::text,
    jsonb_build_object('status','review'),
    jsonb_build_object(
      'status',v_batch.status,'rows_inserted',v_batch.rows_inserted,
      'rows_duplicates',v_batch.rows_duplicates,'rows_held',v_batch.rows_held,
      'rows_failed',v_batch.rows_failed,'rows_incomplete',v_batch.rows_incomplete
    ),
    jsonb_build_object('module_key',v_batch.module_key,'selected_rows',cardinality(p_row_ids),'issue_count',v_issue_count)
  );

  return jsonb_build_object(
    'id',v_batch.id,'batch_ref',v_batch.batch_ref,'status',v_batch.status,
    'rows_inserted',v_batch.rows_inserted,'rows_duplicates',v_batch.rows_duplicates,
    'rows_held',v_batch.rows_held,'rows_failed',v_batch.rows_failed,
    'rows_incomplete',v_batch.rows_incomplete,'rows_pending',v_pending
  );
end;
$function$;

update public.tfi_import_destinations set contract_status='approved', required_columns=array['A','B','C','D','E','F','G','H','I','J'] where module_key='oee';
