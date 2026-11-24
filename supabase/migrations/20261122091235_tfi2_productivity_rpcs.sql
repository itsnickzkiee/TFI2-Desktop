-- TFI2 Phase 5 — Productivity permission-checked RPCs.
begin;

create or replace function private.tfi_get_productivity_catalog()
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare v_products jsonb;
begin
  if auth.uid() is null or not private.tfi_has_permission('productivity','view') then
    raise exception using errcode='42501',message='productivity_view_permission_required';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'code',p.product_code,
    'name',coalesce(nullif(btrim(cm.current_values->>1),''),'Other'),
    'capacity',coalesce(std.standard_capacity,0),
    'std',coalesce(std.standard_productivity,0)
  ) order by p.first_row),'[]'::jsonb)
  into v_products
  from (
    select min(source_row_number) first_row,btrim(current_values->>0) product_code
    from public.tfi_master_data_rows
    where category_key='code_map' and row_kind='data' and record_status='active'
      and nullif(btrim(current_values->>0),'') is not null
    group by btrim(current_values->>0)
  ) p
  left join lateral (
    select m.current_values
    from public.tfi_master_data_rows m
    where m.category_key='code_map' and m.row_kind='data' and m.record_status='active'
      and lower(btrim(m.current_values->>0))=lower(p.product_code)
    order by m.source_row_number limit 1
  ) cm on true
  left join lateral (
    select
      case when nullif(replace(btrim(m.current_values->>5),',',''),'') ~ '^[0-9]+([.][0-9]+)?$'
        then replace(btrim(m.current_values->>5),',','')::numeric else 0::numeric end standard_capacity,
      case when nullif(replace(btrim(m.current_values->>7),',',''),'') ~ '^[0-9]+([.][0-9]+)?$'
        then replace(btrim(m.current_values->>7),',','')::numeric else 0::numeric end standard_productivity
    from public.tfi_master_data_rows m
    where m.category_key='product_standard' and m.row_kind='data' and m.record_status='active'
      and lower(btrim(m.current_values->>0))=lower(p.product_code)
    order by m.source_row_number limit 1
  ) std on true;

  return jsonb_build_object(
    'products',v_products,
    'lines',jsonb_build_array('AGRILINE','MEATLINE'),
    'source',jsonb_build_object('sheet_name','Productivity','sheet_id',1688444278,
      'range','A1:V1500','header_row',4,'first_data_row',5,
      'input_columns','A:K','calculated_columns','L:V',
      'manpower_hours_source','DMP - Production!H:H by exact production date and product code',
      'product_standard_source','Product Standard and Specificat!F:H',
      'product_name_source','Code Map!A:B')
  );
end;
$function$;
revoke all on function private.tfi_get_productivity_catalog() from public,anon;
grant execute on function private.tfi_get_productivity_catalog() to authenticated;
create or replace function public.tfi_get_productivity_catalog()
returns jsonb language sql security invoker set search_path=''
as $function$ select private.tfi_get_productivity_catalog(); $function$;
revoke all on function public.tfi_get_productivity_catalog() from public,anon;
grant execute on function public.tfi_get_productivity_catalog() to authenticated;

create or replace function private.tfi_get_productivity_records(
  p_date_from date default null,p_date_to date default null,p_line text default null,
  p_product_code text default null,p_search text default null,p_page integer default 1,p_page_size integer default 100
)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare v_result jsonb;
begin
  if auth.uid() is null or not private.tfi_has_permission('productivity','view') then
    raise exception using errcode='42501',message='productivity_view_permission_required';
  end if;
  if p_page is null or p_page<1 or p_page_size is null or p_page_size<1 or p_page_size>100 then
    raise exception using errcode='22023',message='productivity_pagination_invalid';
  end if;
  if p_date_from is not null and p_date_to is not null and p_date_from>p_date_to then
    raise exception using errcode='22023',message='productivity_date_range_invalid';
  end if;
  with filtered as (
    select * from public.tfi_productivity_record_view v
    where (p_date_from is null or v.production_date>=p_date_from)
      and (p_date_to is null or v.production_date<=p_date_to)
      and (nullif(btrim(coalesce(p_line,'')),'') is null or v.line=p_line)
      and (nullif(btrim(coalesce(p_product_code,'')),'') is null or v.product_code=p_product_code)
      and (nullif(btrim(coalesce(p_search,'')),'') is null or
        concat_ws(' ',v.product_code,v.product_name,v.line,v.production_date::text) ilike '%'||btrim(p_search)||'%')
  ), page_rows as (
    select * from filtered order by production_date desc,product_code,line
    limit p_page_size offset (p_page-1)*p_page_size
  )
  select jsonb_build_object(
    'records',coalesce((select jsonb_agg(to_jsonb(pr) order by pr.production_date desc,pr.product_code,pr.line) from page_rows pr),'[]'::jsonb),
    'page',p_page,'page_size',p_page_size,
    'total_count',(select count(*)::integer from filtered),
    'has_more',(select count(*) from filtered)>(p_page*p_page_size)
  ) into v_result;
  return v_result;
end;
$function$;
revoke all on function private.tfi_get_productivity_records(date,date,text,text,text,integer,integer) from public,anon;
grant execute on function private.tfi_get_productivity_records(date,date,text,text,text,integer,integer) to authenticated;
create or replace function public.tfi_get_productivity_records(
  p_date_from date default null,p_date_to date default null,p_line text default null,
  p_product_code text default null,p_search text default null,p_page integer default 1,p_page_size integer default 100
)
returns jsonb language sql security invoker set search_path=''
as $function$ select private.tfi_get_productivity_records(p_date_from,p_date_to,p_line,p_product_code,p_search,p_page,p_page_size); $function$;
revoke all on function public.tfi_get_productivity_records(date,date,text,text,text,integer,integer) from public,anon;
grant execute on function public.tfi_get_productivity_records(date,date,text,text,text,integer,integer) to authenticated;

create or replace function private.tfi_get_productivity_record(p_record_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare v_result jsonb;
begin
  if auth.uid() is null or not private.tfi_has_permission('productivity','view') then
    raise exception using errcode='42501',message='productivity_view_permission_required';
  end if;
  select to_jsonb(v) into v_result from public.tfi_productivity_record_view v where v.id=p_record_id;
  return v_result;
end;
$function$;
revoke all on function private.tfi_get_productivity_record(uuid) from public,anon;
grant execute on function private.tfi_get_productivity_record(uuid) to authenticated;
create or replace function public.tfi_get_productivity_record(p_record_id uuid)
returns jsonb language sql security invoker set search_path=''
as $function$ select private.tfi_get_productivity_record(p_record_id); $function$;
revoke all on function public.tfi_get_productivity_record(uuid) from public,anon;
grant execute on function public.tfi_get_productivity_record(uuid) to authenticated;

create or replace function private.tfi_create_productivity_records(p_records jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $function$
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
      v_planned:=coalesce(nullif(v_data->>'planned_run_hours','')::numeric,0);
      v_actual:=coalesce(nullif(v_data->>'actual_output_tins','')::numeric,0);
      v_dented:=coalesce(nullif(v_data->>'dented','')::numeric,0);
      v_false_seam:=coalesce(nullif(v_data->>'false_seam','')::numeric,0);
      v_flipper:=coalesce(nullif(v_data->>'flipper','')::numeric,0);
      v_bulged:=coalesce(nullif(v_data->>'bulged','')::numeric,0);
      v_panel:=coalesce(nullif(v_data->>'panel','')::numeric,0);
      v_buckling:=coalesce(nullif(v_data->>'buckling','')::numeric,0);
    exception when others then raise exception using errcode='22023',message='productivity_invalid_field_value'; end;
    if v_date is null or v_code is null or v_line is null then
      raise exception using errcode='22023',message='productivity_required_fields_missing';
    end if;
    if length(v_code)>100 or length(v_line)>100 or
      v_planned<0 or v_actual<0 or v_dented<0 or v_false_seam<0 or v_flipper<0 or v_bulged<0 or v_panel<0 or v_buckling<0 then
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
$function$;
revoke all on function private.tfi_create_productivity_records(jsonb) from public,anon;
grant execute on function private.tfi_create_productivity_records(jsonb) to authenticated;
create or replace function public.tfi_create_productivity_records(p_records jsonb)
returns jsonb language sql security invoker set search_path=''
as $function$ select private.tfi_create_productivity_records(p_records); $function$;
revoke all on function public.tfi_create_productivity_records(jsonb) from public,anon;
grant execute on function public.tfi_create_productivity_records(jsonb) to authenticated;

create or replace function private.tfi_update_productivity_record(
  p_record_id uuid,p_expected_version integer,p_changes jsonb,p_change_reason text default null
)
returns jsonb language plpgsql security definer set search_path=''
as $function$
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
    or v_planned is null or v_actual is null or v_planned<0 or v_actual<0
    or v_dented<0 or v_false_seam<0 or v_flipper<0 or v_bulged<0 or v_panel<0 or v_buckling<0 then
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
$function$;
revoke all on function private.tfi_update_productivity_record(uuid,integer,jsonb,text) from public,anon;
grant execute on function private.tfi_update_productivity_record(uuid,integer,jsonb,text) to authenticated;
create or replace function public.tfi_update_productivity_record(
  p_record_id uuid,p_expected_version integer,p_changes jsonb,p_change_reason text default null
)
returns jsonb language sql security invoker set search_path=''
as $function$ select private.tfi_update_productivity_record(p_record_id,p_expected_version,p_changes,p_change_reason); $function$;
revoke all on function public.tfi_update_productivity_record(uuid,integer,jsonb,text) from public,anon;
grant execute on function public.tfi_update_productivity_record(uuid,integer,jsonb,text) to authenticated;

commit;