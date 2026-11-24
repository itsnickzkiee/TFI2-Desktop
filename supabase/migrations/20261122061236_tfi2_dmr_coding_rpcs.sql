create or replace function private.tfi_get_dmr_coding_reference_data()
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare v_product_names jsonb; v_product_codes jsonb; v_categories jsonb; v_factors jsonb;
begin
  if auth.uid() is null or not private.tfi_has_permission('dmr_coding','view') then
    raise exception using errcode='42501',message='dmr_coding_view_permission_required';
  end if;
  select coalesce(jsonb_object_agg(code,name),'{}'::jsonb) into v_product_names
  from (
    select nullif(btrim(current_values->>0),'') code,nullif(btrim(current_values->>1),'') name
    from public.tfi_master_data_rows where category_key='code_map' and row_kind='data'
      and record_status='active' and nullif(btrim(current_values->>0),'') is not null
      and nullif(btrim(current_values->>1),'') is not null
  ) m;
  select coalesce(jsonb_agg(code order by first_row),'[]'::jsonb) into v_product_codes
  from (
    select min(source_row_number) first_row,btrim(code_value) code
    from (
      select source_row_number,current_values->>7 code_value from public.tfi_master_data_rows
        where category_key='dpr_legend' and row_kind='data' and record_status='active'
      union all
      select source_row_number,current_values->>11 code_value from public.tfi_master_data_rows
        where category_key='dpr_legend' and row_kind='data' and record_status='active'
    ) c where nullif(btrim(code_value),'') is not null group by btrim(code_value)
  ) codes;
  select coalesce(jsonb_agg(jsonb_build_object('code',code,'description',description) order by first_row),'[]'::jsonb)
  into v_categories
  from (
    select min(source_row_number) first_row,btrim(current_values->>1) code,btrim(current_values->>2) description
    from public.tfi_master_data_rows where category_key='dpr_legend' and row_kind='data' and record_status='active'
      and nullif(btrim(current_values->>1),'') is not null and nullif(btrim(current_values->>2),'') is not null
    group by btrim(current_values->>1),btrim(current_values->>2)
  ) c;
  select coalesce(jsonb_agg(factor order by first_row),'[]'::jsonb) into v_factors
  from (
    select min(source_row_number) first_row,btrim(current_values->>3) factor
    from public.tfi_master_data_rows where category_key='dpr_legend' and row_kind='data' and record_status='active'
      and nullif(btrim(current_values->>3),'') is not null group by btrim(current_values->>3)
  ) f;
  return jsonb_build_object('product_codes',v_product_codes,'product_names',v_product_names,'categories',v_categories,'factors',v_factors);
end;
$function$;
revoke all on function private.tfi_get_dmr_coding_reference_data() from public,anon;
grant execute on function private.tfi_get_dmr_coding_reference_data() to authenticated;

create or replace function public.tfi_get_dmr_coding_reference_data()
returns jsonb language sql security invoker set search_path=''
as $function$ select private.tfi_get_dmr_coding_reference_data(); $function$;
revoke all on function public.tfi_get_dmr_coding_reference_data() from public,anon;
grant execute on function public.tfi_get_dmr_coding_reference_data() to authenticated;

create or replace function private.tfi_create_dmr_coding_records(p_records jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare
  v_user_id uuid:=auth.uid(); v_context jsonb; v_item jsonb; v_data jsonb; v_index integer; v_row_index integer;
  v_date date; v_code text; v_line text; v_stop time; v_resume time; v_category text; v_factor text; v_reason text;
  v_code_status text; v_id uuid; v_after jsonb; v_results jsonb:='[]'::jsonb;
  v_inserted integer:=0; v_duplicates integer:=0; v_empty integer:=0;
begin
  if v_user_id is null then raise exception using errcode='42501',message='authentication_required'; end if;
  if not private.tfi_has_permission('dmr_coding','view') or not private.tfi_has_permission('dmr_coding','create') then
    raise exception using errcode='42501',message='dmr_coding_create_permission_required';
  end if;
  if p_records is null or jsonb_typeof(p_records)<>'array' or jsonb_array_length(p_records)<1 or jsonb_array_length(p_records)>50 then
    raise exception using errcode='22023',message='dmr_coding_rows_required';
  end if;
  v_context:=private.tfi_get_my_access_context();
  for v_item,v_index in select value,ordinality::integer from jsonb_array_elements(p_records) with ordinality loop
    if jsonb_typeof(v_item)<>'object' or exists(select 1 from jsonb_object_keys(v_item) k where k not in ('row_index','record_data'))
       or jsonb_typeof(v_item->'record_data')<>'object' then
      raise exception using errcode='22023',message='dmr_coding_row_shape_invalid';
    end if;
    v_data:=v_item->'record_data';
    if exists(select 1 from jsonb_object_keys(v_data) k where k not in ('production_date','product_code','line','stop_time','resume_time','category','factor','reason')) then
      raise exception using errcode='22023',message='dmr_coding_unknown_or_derived_field';
    end if;
    v_row_index:=coalesce(nullif(v_item->>'row_index','')::integer,v_index);
    begin
      v_date:=nullif(btrim(v_data->>'production_date'),'')::date;
      v_code:=nullif(btrim(v_data->>'product_code'),'');
      v_line:=nullif(btrim(v_data->>'line'),'');
      v_stop:=nullif(btrim(v_data->>'stop_time'),'')::time;
      v_resume:=nullif(btrim(v_data->>'resume_time'),'')::time;
      v_category:=nullif(btrim(v_data->>'category'),'');
      v_factor:=nullif(btrim(v_data->>'factor'),'');
      v_reason:=nullif(btrim(v_data->>'reason'),'');
    exception when others then raise exception using errcode='22023',message='dmr_coding_invalid_field_value'; end;
    if v_code is null and v_line is null and v_date is null and v_stop is null and v_resume is null
       and v_category is null and v_factor is null and v_reason is null then
      v_empty:=v_empty+1;
      v_results:=v_results||jsonb_build_array(jsonb_build_object('row_index',v_row_index,'status','empty'));
      continue;
    end if;
    if length(v_code)>100 or length(v_line)>80 or length(v_category)>80 or length(v_factor)>120 or length(v_reason)>1000 then
      raise exception using errcode='22023',message='dmr_coding_text_value_too_long';
    end if;
    if v_category is not null and not exists(select 1 from public.tfi_master_data_rows md where md.category_key='dpr_legend'
      and md.row_kind='data' and md.record_status='active' and btrim(md.current_values->>1)=v_category) then
      raise exception using errcode='22023',message='dmr_coding_invalid_category'; end if;
    if v_factor is not null and not exists(select 1 from public.tfi_master_data_rows md where md.category_key='dpr_legend'
      and md.row_kind='data' and md.record_status='active' and btrim(md.current_values->>3)=v_factor) then
      raise exception using errcode='22023',message='dmr_coding_invalid_factor'; end if;
    if v_code is null then v_code_status:='not_entered';
    elsif exists(select 1 from public.tfi_master_data_rows md where md.category_key='dpr_legend' and md.row_kind='data'
      and md.record_status='active' and (btrim(coalesce(md.current_values->>7,''))=v_code or btrim(coalesce(md.current_values->>11,''))=v_code))
      then v_code_status:='matched';
    else v_code_status:='unmatched'; end if;

    v_id:=null;
    insert into public.tfi_dmr_coding_records(
      production_date,product_code,line,stop_time,resume_time,category,factor,reason,
      product_code_reference_status,completeness_status,source_import_row_id,entry_source,created_by,updated_by
    ) values (v_date,v_code,v_line,v_stop,v_resume,v_category,v_factor,v_reason,v_code_status,'unassessed',null,'manual',v_user_id,v_user_id)
    on conflict(record_fingerprint) do nothing returning id into v_id;
    if v_id is null then
      v_duplicates:=v_duplicates+1;
      v_results:=v_results||jsonb_build_array(jsonb_build_object('row_index',v_row_index,'status','duplicate'));
      continue;
    end if;
    v_after:=jsonb_build_object('production_date',v_date,'product_code',v_code,'line',v_line,'stop_time',v_stop,'resume_time',v_resume,
      'downtime_minutes',case when v_stop is null or v_resume is null then null else (extract(epoch from (v_resume-v_stop))+case when v_resume<v_stop then 86400 else 0 end)/60 end,
      'category',v_category,'factor',v_factor,'reason',v_reason,'product_code_reference_status',v_code_status,'completeness_status','unassessed');
    insert into public.tfi_audit_events(actor_user_id,actor_email_snapshot,actor_roles_snapshot,action_key,module_key,
      entity_type,entity_id,before_data,after_data,metadata,occurred_at)
    values(v_user_id,v_context #>> '{profile,email}',coalesce(v_context->'roles','[]'::jsonb),'dmr_coding.create','dmr_coding',
      'dmr_coding_record',v_id::text,null,v_after,jsonb_build_object('entry_source','manual','row_index',v_row_index),now());
    v_inserted:=v_inserted+1;
    v_results:=v_results||jsonb_build_array(jsonb_build_object('row_index',v_row_index,'status','inserted','id',v_id,'product_code_reference_status',v_code_status));
  end loop;
  return jsonb_build_object('inserted',v_inserted,'duplicates',v_duplicates,'empty',v_empty,'results',v_results);
end;
$function$;
revoke all on function private.tfi_create_dmr_coding_records(jsonb) from public,anon;
grant execute on function private.tfi_create_dmr_coding_records(jsonb) to authenticated;

create or replace function public.tfi_create_dmr_coding_records(p_records jsonb)
returns jsonb language sql security invoker set search_path=''
as $function$ select private.tfi_create_dmr_coding_records(p_records); $function$;
revoke all on function public.tfi_create_dmr_coding_records(jsonb) from public,anon;
grant execute on function public.tfi_create_dmr_coding_records(jsonb) to authenticated;

create or replace function private.tfi_update_dmr_coding_record(
  p_record_id uuid,p_expected_version integer,p_changes jsonb,p_change_reason text default null
)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare
  v_user_id uuid:=auth.uid(); v_context jsonb; v_row public.tfi_dmr_coding_records%rowtype;
  v_date date; v_code text; v_line text; v_stop time; v_resume time; v_category text; v_factor text; v_reason text;
  v_code_status text; v_before jsonb; v_after jsonb; v_changed text[]:=array[]::text[]; v_version integer;
begin
  if v_user_id is null then raise exception using errcode='42501',message='authentication_required'; end if;
  if not private.tfi_has_permission('dmr_coding','view') or not private.tfi_has_permission('dmr_coding','edit') then
    raise exception using errcode='42501',message='dmr_coding_edit_permission_required';
  end if;
  if p_expected_version is null or p_expected_version<1 or p_changes is null or jsonb_typeof(p_changes)<>'object' or p_changes='{}'::jsonb then
    raise exception using errcode='22023',message='dmr_coding_update_request_invalid';
  end if;
  if exists(select 1 from jsonb_object_keys(p_changes) k where k not in ('production_date','product_code','line','stop_time','resume_time','category','factor','reason')) then
    raise exception using errcode='22023',message='dmr_coding_unknown_or_derived_field';
  end if;
  select * into v_row from public.tfi_dmr_coding_records where id=p_record_id and record_status='active' for update;
  if not found then raise exception using errcode='P0002',message='dmr_coding_record_not_found'; end if;
  if v_row.version<>p_expected_version then raise exception using errcode='40001',message='dmr_coding_version_conflict'; end if;
  begin
    v_date:=case when p_changes?'production_date' then nullif(btrim(p_changes->>'production_date'),'')::date else v_row.production_date end;
    v_code:=case when p_changes?'product_code' then nullif(btrim(p_changes->>'product_code'),'') else v_row.product_code end;
    v_line:=case when p_changes?'line' then nullif(btrim(p_changes->>'line'),'') else v_row.line end;
    v_stop:=case when p_changes?'stop_time' then nullif(btrim(p_changes->>'stop_time'),'')::time else v_row.stop_time end;
    v_resume:=case when p_changes?'resume_time' then nullif(btrim(p_changes->>'resume_time'),'')::time else v_row.resume_time end;
    v_category:=case when p_changes?'category' then nullif(btrim(p_changes->>'category'),'') else v_row.category end;
    v_factor:=case when p_changes?'factor' then nullif(btrim(p_changes->>'factor'),'') else v_row.factor end;
    v_reason:=case when p_changes?'reason' then nullif(btrim(p_changes->>'reason'),'') else v_row.reason end;
  exception when others then raise exception using errcode='22023',message='dmr_coding_invalid_field_value'; end;
  if length(v_code)>100 or length(v_line)>80 or length(v_category)>80 or length(v_factor)>120 or length(v_reason)>1000 then
    raise exception using errcode='22023',message='dmr_coding_text_value_too_long'; end if;
  if v_category is not null and not exists(select 1 from public.tfi_master_data_rows md where md.category_key='dpr_legend' and md.row_kind='data' and md.record_status='active' and btrim(md.current_values->>1)=v_category) then
    raise exception using errcode='22023',message='dmr_coding_invalid_category'; end if;
  if v_factor is not null and not exists(select 1 from public.tfi_master_data_rows md where md.category_key='dpr_legend' and md.row_kind='data' and md.record_status='active' and btrim(md.current_values->>3)=v_factor) then
    raise exception using errcode='22023',message='dmr_coding_invalid_factor'; end if;
  if v_code is null then v_code_status:='not_entered';
  elsif exists(select 1 from public.tfi_master_data_rows md where md.category_key='dpr_legend' and md.row_kind='data' and md.record_status='active'
    and (btrim(coalesce(md.current_values->>7,''))=v_code or btrim(coalesce(md.current_values->>11,''))=v_code)) then v_code_status:='matched';
  else v_code_status:='unmatched'; end if;
  v_before:=jsonb_build_object('production_date',v_row.production_date,'product_code',v_row.product_code,'line',v_row.line,
    'stop_time',v_row.stop_time,'resume_time',v_row.resume_time,'downtime_minutes',v_row.downtime_minutes,'downtime_hours',v_row.downtime_hours,
    'category',v_row.category,'factor',v_row.factor,'reason',v_row.reason,'product_code_reference_status',v_row.product_code_reference_status,
    'completeness_status',v_row.completeness_status,'version',v_row.version);
  v_after:=jsonb_build_object('production_date',v_date,'product_code',v_code,'line',v_line,'stop_time',v_stop,'resume_time',v_resume,
    'downtime_minutes',case when v_stop is null or v_resume is null then null else (extract(epoch from (v_resume-v_stop))+case when v_resume<v_stop then 86400 else 0 end)/60 end,
    'downtime_hours',case when v_stop is null or v_resume is null then null else (extract(epoch from (v_resume-v_stop))+case when v_resume<v_stop then 86400 else 0 end)/3600 end,
    'category',v_category,'factor',v_factor,'reason',v_reason,'product_code_reference_status',v_code_status,'completeness_status','unassessed','version',v_row.version+1);
  if (v_before-'downtime_minutes'-'downtime_hours'-'version')=(v_after-'downtime_minutes'-'downtime_hours'-'version') then
    return jsonb_build_object('changed',false,'id',v_row.id,'version',v_row.version);
  end if;
  if v_date is distinct from v_row.production_date then v_changed:=array_append(v_changed,'production_date'); end if;
  if v_code is distinct from v_row.product_code then v_changed:=array_append(v_changed,'product_code'); end if;
  if v_line is distinct from v_row.line then v_changed:=array_append(v_changed,'line'); end if;
  if v_stop is distinct from v_row.stop_time then v_changed:=array_append(v_changed,'stop_time'); end if;
  if v_resume is distinct from v_row.resume_time then v_changed:=array_append(v_changed,'resume_time'); end if;
  if v_category is distinct from v_row.category then v_changed:=array_append(v_changed,'category'); end if;
  if v_factor is distinct from v_row.factor then v_changed:=array_append(v_changed,'factor'); end if;
  if v_reason is distinct from v_row.reason then v_changed:=array_append(v_changed,'reason'); end if;
  if v_code_status is distinct from v_row.product_code_reference_status then v_changed:=array_append(v_changed,'product_code_reference_status'); end if;
  v_version:=v_row.version+1;
  insert into public.tfi_dmr_coding_revisions(dmr_coding_record_id,version,before_data,after_data,changed_fields,change_reason,changed_by)
  values(v_row.id,v_version,v_before,v_after,v_changed,nullif(left(btrim(coalesce(p_change_reason,'')),500),''),v_user_id);
  update public.tfi_dmr_coding_records set production_date=v_date,product_code=v_code,line=v_line,stop_time=v_stop,resume_time=v_resume,
    category=v_category,factor=v_factor,reason=v_reason,product_code_reference_status=v_code_status,
    version=v_version,updated_at=now(),updated_by=v_user_id where id=v_row.id;
  v_context:=private.tfi_get_my_access_context();
  insert into public.tfi_audit_events(actor_user_id,actor_email_snapshot,actor_roles_snapshot,action_key,module_key,entity_type,entity_id,
    before_data,after_data,metadata,occurred_at)
  values(v_user_id,v_context #>> '{profile,email}',coalesce(v_context->'roles','[]'::jsonb),'dmr_coding.update','dmr_coding',
    'dmr_coding_record',v_row.id::text,v_before,v_after,jsonb_build_object('changed_fields',to_jsonb(v_changed),
    'change_reason',nullif(left(btrim(coalesce(p_change_reason,'')),500),'')),now());
  return jsonb_build_object('changed',true,'id',v_row.id,'version',v_version,
    'downtime_minutes',case when v_stop is null or v_resume is null then null else (extract(epoch from (v_resume-v_stop))+case when v_resume<v_stop then 86400 else 0 end)/60 end);
end;
$function$;
revoke all on function private.tfi_update_dmr_coding_record(uuid,integer,jsonb,text) from public,anon;
grant execute on function private.tfi_update_dmr_coding_record(uuid,integer,jsonb,text) to authenticated;

create or replace function public.tfi_update_dmr_coding_record(p_record_id uuid,p_expected_version integer,p_changes jsonb,p_change_reason text default null)
returns jsonb language sql security invoker set search_path=''
as $function$ select private.tfi_update_dmr_coding_record(p_record_id,p_expected_version,p_changes,p_change_reason); $function$;
revoke all on function public.tfi_update_dmr_coding_record(uuid,integer,jsonb,text) from public,anon;
grant execute on function public.tfi_update_dmr_coding_record(uuid,integer,jsonb,text) to authenticated;
