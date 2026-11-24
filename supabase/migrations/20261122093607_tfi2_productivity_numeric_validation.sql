-- Exact source-aligned Productivity RPC definitions with database-level finite numeric validation.
create or replace function private.tfi_productivity_nonnegative(p_value numeric)
returns boolean language sql immutable set search_path=''
as $function$
  select p_value is not null and p_value::text ~ '^[0-9]+([.][0-9]{1,4})?$';
$function$;
revoke all on function private.tfi_productivity_nonnegative(numeric) from public,anon,authenticated;

CREATE OR REPLACE FUNCTION private.tfi_create_productivity_records(p_records jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_item jsonb; v_data jsonb; v_idx integer; v_row_index integer;
  v_date date; v_code text; v_line text; v_planned numeric; v_actual numeric;
  v_dented numeric; v_false_seam numeric; v_flipper numeric; v_bulged numeric; v_panel numeric; v_buckling numeric;
  v_id uuid; v_context jsonb; v_after jsonb;
  v_inserted integer:=0; v_duplicates integer:=0; v_empty integer:=0; v_results jsonb:='[]'::jsonb;
begin
  if auth.uid() is null or not private.tfi_has_permission('productivity','view')
    or not private.tfi_has_permission('productivity','create') then
    raise exception using errcode='42501',message='productivity_create_permission_required';
  end if;
  if p_records is null or jsonb_typeof(p_records)<>'array' or jsonb_array_length(p_records)<1 or jsonb_array_length(p_records)>100 then
    raise exception using errcode='22023',message='productivity_rows_required';
  end if;
  for v_item,v_idx in select value,ordinality::integer from jsonb_array_elements(p_records) with ordinality loop
    if jsonb_typeof(v_item)<>'object' or exists(select 1 from jsonb_object_keys(v_item) k where k not in ('row_index','record_data'))
      or jsonb_typeof(v_item->'record_data')<>'object' then
      raise exception using errcode='22023',message='productivity_row_shape_invalid';
    end if;
    v_data:=v_item->'record_data';
    v_row_index:=coalesce(nullif(v_item->>'row_index','')::integer,v_idx);
    if v_row_index<1 or v_row_index>1000 then raise exception using errcode='22023',message='productivity_row_index_invalid'; end if;
    if v_data='{}'::jsonb then
      v_empty:=v_empty+1;
      v_results:=v_results||jsonb_build_array(jsonb_build_object('row_index',v_row_index,'status','empty'));
      continue;
    end if;
    if exists(select 1 from jsonb_object_keys(v_data) k where k not in
      ('production_date','product_code','line','planned_run_hours','actual_output_tins','dented','false_seam','flipper','bulged','panel','buckling')) then
      raise exception using errcode='22023',message='productivity_unknown_or_derived_field';
    end if;
    if nullif(btrim(v_data->>'production_date'),'') is null
      or nullif(btrim(v_data->>'product_code'),'') is null
      or nullif(btrim(v_data->>'line'),'') is null
      or nullif(btrim(v_data->>'planned_run_hours'),'') is null
      or nullif(btrim(v_data->>'actual_output_tins'),'') is null then
      raise exception using errcode='22023',message='productivity_required_fields_missing';
    end if;
    begin
      v_date:=nullif(btrim(v_data->>'production_date'),'')::date;
      v_code:=nullif(btrim(v_data->>'product_code'),'');
      v_line:=nullif(btrim(v_data->>'line'),'');
      v_planned:=nullif(v_data->>'planned_run_hours','')::numeric;
      v_actual:=nullif(v_data->>'actual_output_tins','')::numeric;
      v_dented:=coalesce(nullif(v_data->>'dented','')::numeric,0);
      v_false_seam:=coalesce(nullif(v_data->>'false_seam','')::numeric,0);
      v_flipper:=coalesce(nullif(v_data->>'flipper','')::numeric,0);
      v_bulged:=coalesce(nullif(v_data->>'bulged','')::numeric,0);
      v_panel:=coalesce(nullif(v_data->>'panel','')::numeric,0);
      v_buckling:=coalesce(nullif(v_data->>'buckling','')::numeric,0);
    exception when others then raise exception using errcode='22023',message='productivity_invalid_field_value'; end;
    if v_date is null or v_code is null or v_line is null or length(v_code)>100 or length(v_line)>100
      or not private.tfi_productivity_nonnegative(v_planned)
      or not private.tfi_productivity_nonnegative(v_actual)
      or not private.tfi_productivity_nonnegative(v_dented)
      or not private.tfi_productivity_nonnegative(v_false_seam)
      or not private.tfi_productivity_nonnegative(v_flipper)
      or not private.tfi_productivity_nonnegative(v_bulged)
      or not private.tfi_productivity_nonnegative(v_panel)
      or not private.tfi_productivity_nonnegative(v_buckling) then
      raise exception using errcode='22023',message='productivity_invalid_field_value';
    end if;
    begin
      insert into public.tfi_productivity_records(
        production_date,product_code,line,planned_run_hours,actual_output_tins,
        dented,false_seam,flipper,bulged,panel,buckling,created_by,updated_by
      ) values (
        v_date,v_code,v_line,v_planned,v_actual,v_dented,v_false_seam,v_flipper,v_bulged,v_panel,v_buckling,auth.uid(),auth.uid()
      ) returning id into v_id;
    exception when unique_violation then
      v_duplicates:=v_duplicates+1;
      v_results:=v_results||jsonb_build_array(jsonb_build_object('row_index',v_row_index,'status','duplicate'));
      continue;
    end;
    v_context:=private.tfi_get_my_access_context();
    select to_jsonb(v) into v_after from public.tfi_productivity_record_view v where v.id=v_id;
    insert into public.tfi_audit_events(
      actor_user_id,actor_email_snapshot,actor_roles_snapshot,action_key,module_key,entity_type,entity_id,
      before_data,after_data,metadata,occurred_at
    ) values (
      auth.uid(),v_context #>> '{profile,email}',coalesce(v_context->'roles','[]'::jsonb),
      'productivity.create','productivity','productivity_record',v_id::text,
      null,v_after,jsonb_build_object('row_index',v_row_index),now()
    );
    v_inserted:=v_inserted+1;
    v_results:=v_results||jsonb_build_array(jsonb_build_object('row_index',v_row_index,'status','inserted','id',v_id));
  end loop;
  return jsonb_build_object('inserted',v_inserted,'duplicates',v_duplicates,'empty',v_empty,'results',v_results);
end;
$function$
;
CREATE OR REPLACE FUNCTION private.tfi_update_productivity_record(p_record_id uuid, p_expected_version integer, p_changes jsonb, p_change_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user_id uuid:=auth.uid(); v_context jsonb; v_row public.tfi_productivity_records%rowtype;
  v_date date; v_code text; v_line text; v_planned numeric; v_actual numeric;
  v_dented numeric; v_false_seam numeric; v_flipper numeric; v_bulged numeric; v_panel numeric; v_buckling numeric;
  v_before jsonb; v_after jsonb; v_changed text[]:=array[]::text[]; v_version integer;
begin
  if v_user_id is null or not private.tfi_has_permission('productivity','view')
    or not private.tfi_has_permission('productivity','edit') then
    raise exception using errcode='42501',message='productivity_edit_permission_required';
  end if;
  if p_expected_version is null or p_expected_version<1 or p_changes is null or
    jsonb_typeof(p_changes)<>'object' or p_changes='{}'::jsonb then
    raise exception using errcode='22023',message='productivity_update_request_invalid';
  end if;
  if exists(select 1 from jsonb_object_keys(p_changes) k where k not in
    ('production_date','product_code','line','planned_run_hours','actual_output_tins','dented','false_seam','flipper','bulged','panel','buckling')) then
    raise exception using errcode='22023',message='productivity_unknown_or_derived_field';
  end if;
  select * into v_row from public.tfi_productivity_records where id=p_record_id and record_status='active' for update;
  if not found then raise exception using errcode='P0002',message='productivity_record_not_found'; end if;
  if v_row.version<>p_expected_version then raise exception using errcode='40001',message='productivity_version_conflict'; end if;
  begin
    v_date:=case when p_changes?'production_date' then nullif(btrim(p_changes->>'production_date'),'')::date else v_row.production_date end;
    v_code:=case when p_changes?'product_code' then nullif(btrim(p_changes->>'product_code'),'') else v_row.product_code end;
    v_line:=case when p_changes?'line' then nullif(btrim(p_changes->>'line'),'') else v_row.line end;
    v_planned:=case when p_changes?'planned_run_hours' then nullif(p_changes->>'planned_run_hours','')::numeric else v_row.planned_run_hours end;
    v_actual:=case when p_changes?'actual_output_tins' then nullif(p_changes->>'actual_output_tins','')::numeric else v_row.actual_output_tins end;
    v_dented:=case when p_changes?'dented' then coalesce(nullif(p_changes->>'dented','')::numeric,0) else v_row.dented end;
    v_false_seam:=case when p_changes?'false_seam' then coalesce(nullif(p_changes->>'false_seam','')::numeric,0) else v_row.false_seam end;
    v_flipper:=case when p_changes?'flipper' then coalesce(nullif(p_changes->>'flipper','')::numeric,0) else v_row.flipper end;
    v_bulged:=case when p_changes?'bulged' then coalesce(nullif(p_changes->>'bulged','')::numeric,0) else v_row.bulged end;
    v_panel:=case when p_changes?'panel' then coalesce(nullif(p_changes->>'panel','')::numeric,0) else v_row.panel end;
    v_buckling:=case when p_changes?'buckling' then coalesce(nullif(p_changes->>'buckling','')::numeric,0) else v_row.buckling end;
  exception when others then raise exception using errcode='22023',message='productivity_invalid_field_value'; end;
  if v_date is null or v_code is null or v_line is null or length(v_code)>100 or length(v_line)>100
    or not private.tfi_productivity_nonnegative(v_planned)
    or not private.tfi_productivity_nonnegative(v_actual)
    or not private.tfi_productivity_nonnegative(v_dented)
    or not private.tfi_productivity_nonnegative(v_false_seam)
    or not private.tfi_productivity_nonnegative(v_flipper)
    or not private.tfi_productivity_nonnegative(v_bulged)
    or not private.tfi_productivity_nonnegative(v_panel)
    or not private.tfi_productivity_nonnegative(v_buckling) then
    raise exception using errcode='22023',message='productivity_invalid_field_value';
  end if;
  v_before:=jsonb_build_object(
    'production_date',v_row.production_date,'product_code',v_row.product_code,'line',v_row.line,
    'planned_run_hours',v_row.planned_run_hours,'actual_output_tins',v_row.actual_output_tins,
    'dented',v_row.dented,'false_seam',v_row.false_seam,'flipper',v_row.flipper,
    'bulged',v_row.bulged,'panel',v_row.panel,'buckling',v_row.buckling,'version',v_row.version
  );
  v_after:=jsonb_build_object(
    'production_date',v_date,'product_code',v_code,'line',v_line,
    'planned_run_hours',v_planned,'actual_output_tins',v_actual,
    'dented',v_dented,'false_seam',v_false_seam,'flipper',v_flipper,
    'bulged',v_bulged,'panel',v_panel,'buckling',v_buckling,'version',v_row.version+1
  );
  if (v_before-'version')=(v_after-'version') then
    return jsonb_build_object('changed',false,'id',v_row.id,'version',v_row.version);
  end if;
  if v_date is distinct from v_row.production_date then v_changed:=array_append(v_changed,'production_date'); end if;
  if v_code is distinct from v_row.product_code then v_changed:=array_append(v_changed,'product_code'); end if;
  if v_line is distinct from v_row.line then v_changed:=array_append(v_changed,'line'); end if;
  if v_planned is distinct from v_row.planned_run_hours then v_changed:=array_append(v_changed,'planned_run_hours'); end if;
  if v_actual is distinct from v_row.actual_output_tins then v_changed:=array_append(v_changed,'actual_output_tins'); end if;
  if v_dented is distinct from v_row.dented then v_changed:=array_append(v_changed,'dented'); end if;
  if v_false_seam is distinct from v_row.false_seam then v_changed:=array_append(v_changed,'false_seam'); end if;
  if v_flipper is distinct from v_row.flipper then v_changed:=array_append(v_changed,'flipper'); end if;
  if v_bulged is distinct from v_row.bulged then v_changed:=array_append(v_changed,'bulged'); end if;
  if v_panel is distinct from v_row.panel then v_changed:=array_append(v_changed,'panel'); end if;
  if v_buckling is distinct from v_row.buckling then v_changed:=array_append(v_changed,'buckling'); end if;
  v_version:=v_row.version+1;
  insert into public.tfi_productivity_revisions(
    productivity_record_id,version,before_data,after_data,changed_fields,change_reason,changed_by
  ) values (
    v_row.id,v_version,v_before,v_after,v_changed,nullif(left(btrim(coalesce(p_change_reason,'')),500),''),v_user_id
  );
  begin
    update public.tfi_productivity_records set
      production_date=v_date,product_code=v_code,line=v_line,
      planned_run_hours=v_planned,actual_output_tins=v_actual,
      dented=v_dented,false_seam=v_false_seam,flipper=v_flipper,
      bulged=v_bulged,panel=v_panel,buckling=v_buckling,
      version=v_version,updated_at=now(),updated_by=v_user_id
    where id=v_row.id;
  exception when unique_violation then raise exception using errcode='23505',message='productivity_duplicate_record'; end;
  v_context:=private.tfi_get_my_access_context();
  select to_jsonb(v) into v_after from public.tfi_productivity_record_view v where v.id=v_row.id;
  insert into public.tfi_audit_events(
    actor_user_id,actor_email_snapshot,actor_roles_snapshot,action_key,module_key,entity_type,entity_id,
    before_data,after_data,metadata,occurred_at
  ) values (
    v_user_id,v_context #>> '{profile,email}',coalesce(v_context->'roles','[]'::jsonb),
    'productivity.update','productivity','productivity_record',v_row.id::text,
    v_before,v_after,jsonb_build_object('changed_fields',to_jsonb(v_changed),'change_reason',nullif(left(btrim(coalesce(p_change_reason,'')),500),'')),now()
  );
  return jsonb_build_object('changed',true,'id',v_row.id,'version',v_version);
end;
$function$
;
CREATE OR REPLACE FUNCTION private.tfi_get_productivity_preview(p_record_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_date date; v_code text; v_planned numeric:=0; v_actual numeric:=0;
  v_dented numeric:=0; v_false_seam numeric:=0; v_flipper numeric:=0; v_bulged numeric:=0; v_panel numeric:=0; v_buckling numeric:=0;
  v_rejects numeric; v_mhr numeric:=0; v_capacity numeric:=0; v_standard numeric:=0; v_name text:='Other';
begin
  if auth.uid() is null or not private.tfi_has_permission('productivity','view') then
    raise exception using errcode='42501',message='productivity_view_permission_required';
  end if;
  if p_record_data is null or jsonb_typeof(p_record_data)<>'object'
    or exists(select 1 from jsonb_object_keys(p_record_data) k where k not in
      ('production_date','product_code','line','planned_run_hours','actual_output_tins','dented','false_seam','flipper','bulged','panel','buckling')) then
    raise exception using errcode='22023',message='productivity_preview_shape_invalid';
  end if;
  begin
    v_date:=nullif(btrim(p_record_data->>'production_date'),'')::date;
    v_code:=nullif(btrim(p_record_data->>'product_code'),'');
    v_planned:=coalesce(nullif(p_record_data->>'planned_run_hours','')::numeric,0);
    v_actual:=coalesce(nullif(p_record_data->>'actual_output_tins','')::numeric,0);
    v_dented:=coalesce(nullif(p_record_data->>'dented','')::numeric,0);
    v_false_seam:=coalesce(nullif(p_record_data->>'false_seam','')::numeric,0);
    v_flipper:=coalesce(nullif(p_record_data->>'flipper','')::numeric,0);
    v_bulged:=coalesce(nullif(p_record_data->>'bulged','')::numeric,0);
    v_panel:=coalesce(nullif(p_record_data->>'panel','')::numeric,0);
    v_buckling:=coalesce(nullif(p_record_data->>'buckling','')::numeric,0);
  exception when others then raise exception using errcode='22023',message='productivity_preview_value_invalid'; end;
  if v_date is null or v_code is null or length(v_code)>100
    or not private.tfi_productivity_nonnegative(v_planned)
    or not private.tfi_productivity_nonnegative(v_actual)
    or not private.tfi_productivity_nonnegative(v_dented)
    or not private.tfi_productivity_nonnegative(v_false_seam)
    or not private.tfi_productivity_nonnegative(v_flipper)
    or not private.tfi_productivity_nonnegative(v_bulged)
    or not private.tfi_productivity_nonnegative(v_panel)
    or not private.tfi_productivity_nonnegative(v_buckling) then
    raise exception using errcode='22023',message='productivity_preview_value_invalid';
  end if;
  select coalesce(sum(dp.total_time_hours),0) into v_mhr
  from public.tfi_dmp_production_records dp
  where dp.record_status='active' and dp.production_date=v_date
    and lower(btrim(coalesce(dp.product_code,'')))=lower(v_code);
  select
    case when nullif(replace(btrim(m.current_values->>5),',',''),'') ~ '^[0-9]+([.][0-9]+)?$'
      then replace(btrim(m.current_values->>5),',','')::numeric else 0::numeric end,
    case when nullif(replace(btrim(m.current_values->>7),',',''),'') ~ '^[0-9]+([.][0-9]+)?$'
      then replace(btrim(m.current_values->>7),',','')::numeric else 0::numeric end
  into v_capacity,v_standard
  from public.tfi_master_data_rows m
  where m.category_key='product_standard' and m.row_kind='data' and m.record_status='active'
    and lower(btrim(m.current_values->>0))=lower(v_code)
  order by m.source_row_number limit 1;
  v_capacity:=coalesce(v_capacity,0); v_standard:=coalesce(v_standard,0);
  select coalesce(nullif(btrim(c.current_values->>1),''),'Other') into v_name
  from public.tfi_master_data_rows c
  where c.category_key='code_map' and c.row_kind='data' and c.record_status='active'
    and lower(btrim(c.current_values->>0))=lower(v_code)
  order by c.source_row_number limit 1;
  v_name:=coalesce(v_name,'Other');
  v_rejects:=v_dented+v_false_seam+v_flipper+v_bulged+v_panel+v_buckling;
  return jsonb_build_object(
    'total_fg_rejects',v_rejects,'manpower_hours_dmp',v_mhr,
    'target_output_12h_tins',(v_capacity/10::numeric)*v_planned,
    'standard_productivity_tins_per_mhr',v_standard,
    'standard_output_actual_mhr',case when v_standard>0 and v_mhr>0 then v_standard*v_mhr else 0 end,
    'productivity_tins_per_mhr',case when v_mhr>0 then v_actual/v_mhr else null end,
    'output_attainment',case when (v_capacity/10::numeric)*v_planned>0 then v_actual/((v_capacity/10::numeric)*v_planned) else null end,
    'reject_rate',case when v_actual+v_rejects>0 then v_rejects/(v_actual+v_rejects) else null end,
    'iso_week',extract(week from v_date)::integer,'month_number',extract(month from v_date)::integer,'product_name',v_name
  );
end;
$function$
;
