alter table public.tfi_dmr_production_records
  alter column source_import_row_id drop not null,
  add column if not exists source_column_i text,
  add column if not exists source_column_j text,
  add column if not exists version integer not null default 1 check (version > 0),
  add column if not exists record_status text not null default 'active' check (record_status in ('active','archived')),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists updated_by uuid references auth.users(id),
  add constraint tfi_dmr_production_source_i_length check (source_column_i is null or length(source_column_i)<=120),
  add constraint tfi_dmr_production_source_j_length check (source_column_j is null or length(source_column_j)<=120);

create index if not exists tfi_dmr_production_date_created_idx
  on public.tfi_dmr_production_records(production_date desc,created_at desc);
create index if not exists tfi_dmr_production_line_date_idx
  on public.tfi_dmr_production_records(line,production_date desc);

create table if not exists public.tfi_dmr_production_revisions (
  id uuid primary key default gen_random_uuid(),
  dmr_production_record_id uuid not null references public.tfi_dmr_production_records(id) on delete restrict,
  version integer not null check (version > 1),
  before_data jsonb not null check (jsonb_typeof(before_data)='object'),
  after_data jsonb not null check (jsonb_typeof(after_data)='object'),
  changed_fields text[] not null check (cardinality(changed_fields)>0),
  change_reason text check (change_reason is null or length(change_reason)<=500),
  changed_by uuid references auth.users(id),
  changed_at timestamptz not null default now(),
  unique(dmr_production_record_id,version)
);
create index if not exists tfi_dmr_production_revisions_record_order_idx
  on public.tfi_dmr_production_revisions(dmr_production_record_id,version desc);
create index if not exists tfi_dmr_production_revisions_changed_by_idx
  on public.tfi_dmr_production_revisions(changed_by);

alter table public.tfi_dmr_production_revisions enable row level security;
revoke all on public.tfi_dmr_production_revisions from public,anon,authenticated;
grant select on public.tfi_dmr_production_revisions to authenticated;
create policy tfi_dmr_production_revisions_authorized_read
  on public.tfi_dmr_production_revisions for select to authenticated
  using ((select private.tfi_has_permission('dmr_production','view')));

create or replace function private.tfi_get_dmr_production_reference_data()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_product_names jsonb;
  v_categories jsonb;
  v_additional_options jsonb;
begin
  if auth.uid() is null or not private.tfi_has_permission('dmr_production','view') then
    raise exception using errcode='42501',message='dmr_production_view_permission_required';
  end if;

  select coalesce(jsonb_object_agg(code,name),'{}'::jsonb)
  into v_product_names
  from (
    select nullif(btrim(current_values->>0),'') as code,
           nullif(btrim(current_values->>1),'') as name
    from public.tfi_master_data_rows
    where category_key='code_map' and row_kind='data' and record_status='active'
      and nullif(btrim(current_values->>0),'') is not null
      and nullif(btrim(current_values->>1),'') is not null
  ) mapped;

  select coalesce(jsonb_agg(jsonb_build_object('code',code,'description',description) order by first_row),'[]'::jsonb)
  into v_categories
  from (
    select min(source_row_number) as first_row,
           nullif(btrim(current_values->>1),'') as code,
           nullif(btrim(current_values->>2),'') as description
    from public.tfi_master_data_rows
    where category_key='dpr_legend' and row_kind='data' and record_status='active'
      and nullif(btrim(current_values->>1),'') is not null
      and nullif(btrim(current_values->>2),'') is not null
    group by nullif(btrim(current_values->>1),''),nullif(btrim(current_values->>2),'')
  ) category_rows;

  select coalesce(jsonb_agg(option_value order by first_row),'[]'::jsonb)
  into v_additional_options
  from (
    select min(source_row_number) as first_row,
           min(current_values->>2) as option_value
    from public.tfi_master_data_rows
    where category_key='dpr_legend' and row_kind='data' and record_status='active'
      and nullif(btrim(current_values->>2),'') is not null
    group by btrim(current_values->>2)
  ) option_rows;

  return jsonb_build_object(
    'product_names',v_product_names,
    'categories',v_categories,
    'additional_options',v_additional_options
  );
end;
$function$;

revoke all on function private.tfi_get_dmr_production_reference_data() from public,anon;
grant execute on function private.tfi_get_dmr_production_reference_data() to authenticated;

create or replace function public.tfi_get_dmr_production_reference_data()
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select private.tfi_get_dmr_production_reference_data();
$function$;
revoke all on function public.tfi_get_dmr_production_reference_data() from public,anon;
grant execute on function public.tfi_get_dmr_production_reference_data() to authenticated;

create or replace function private.tfi_create_dmr_production_records(p_records jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_context jsonb;
  v_item jsonb;
  v_data jsonb;
  v_index integer;
  v_row_index integer;
  v_date date;
  v_code text;
  v_line text;
  v_stop time;
  v_resume time;
  v_category text;
  v_i text;
  v_j text;
  v_remarks text;
  v_id uuid;
  v_existing public.tfi_dmr_production_records%rowtype;
  v_after jsonb;
  v_results jsonb := '[]'::jsonb;
  v_inserted integer := 0;
  v_duplicates integer := 0;
  v_conflicts integer := 0;
  v_empty integer := 0;
begin
  if v_user_id is null then
    raise exception using errcode='42501',message='authentication_required';
  end if;
  if not private.tfi_has_permission('dmr_production','view')
     or not private.tfi_has_permission('dmr_production','create') then
    raise exception using errcode='42501',message='dmr_production_create_permission_required';
  end if;
  if p_records is null or jsonb_typeof(p_records)<>'array'
     or jsonb_array_length(p_records)<1 or jsonb_array_length(p_records)>50 then
    raise exception using errcode='22023',message='dmr_production_rows_required';
  end if;
  v_context := private.tfi_get_my_access_context();

  for v_item,v_index in
    select value,ordinality::integer from jsonb_array_elements(p_records) with ordinality
  loop
    if jsonb_typeof(v_item)<>'object'
       or exists(select 1 from jsonb_object_keys(v_item) k where k not in ('row_index','record_data'))
       or jsonb_typeof(v_item->'record_data')<>'object' then
      raise exception using errcode='22023',message='dmr_production_row_shape_invalid';
    end if;
    v_data := v_item->'record_data';
    if exists(
      select 1 from jsonb_object_keys(v_data) k
      where k not in ('production_date','product_code','line','stop_time','resume_time','category','source_column_i','source_column_j','remarks')
    ) then
      raise exception using errcode='22023',message='dmr_production_unknown_or_derived_field';
    end if;

    v_row_index := coalesce(nullif(v_item->>'row_index','')::integer,v_index);
    begin
      v_date := nullif(btrim(v_data->>'production_date'),'')::date;
      v_code := nullif(btrim(v_data->>'product_code'),'');
      v_line := nullif(btrim(v_data->>'line'),'');
      v_stop := nullif(btrim(v_data->>'stop_time'),'')::time;
      v_resume := nullif(btrim(v_data->>'resume_time'),'')::time;
      v_category := nullif(btrim(v_data->>'category'),'');
      v_i := case when nullif(btrim(v_data->>'source_column_i'),'') is null then null else v_data->>'source_column_i' end;
      v_j := case when nullif(btrim(v_data->>'source_column_j'),'') is null then null else v_data->>'source_column_j' end;
      v_remarks := nullif(btrim(v_data->>'remarks'),'');
    exception when others then
      raise exception using errcode='22023',message='dmr_production_invalid_field_value';
    end;

    if v_date is null or v_code is null or v_line is null or v_stop is null
       or v_resume is null or v_category is null then
      raise exception using errcode='22023',message='dmr_production_required_fields_missing';
    end if;
    if length(v_code)>100 or length(v_line)>120 or length(v_category)>120
       or length(v_i)>120 or length(v_j)>120 or length(v_remarks)>1000 then
      raise exception using errcode='22023',message='dmr_production_text_value_too_long';
    end if;
    if not exists(
      select 1 from public.tfi_master_data_rows md
      where md.category_key='dpr_legend' and md.row_kind='data' and md.record_status='active'
        and nullif(btrim(md.current_values->>1),'')=v_category
    ) then
      raise exception using errcode='22023',message='dmr_production_invalid_category';
    end if;
    if v_i is not null and not exists(
      select 1 from public.tfi_master_data_rows md
      where md.category_key='dpr_legend' and md.row_kind='data' and md.record_status='active'
        and btrim(md.current_values->>2)=btrim(v_i)
    ) then
      raise exception using errcode='22023',message='dmr_production_invalid_source_column_i';
    end if;
    if v_j is not null and not exists(
      select 1 from public.tfi_master_data_rows md
      where md.category_key='dpr_legend' and md.row_kind='data' and md.record_status='active'
        and btrim(md.current_values->>2)=btrim(v_j)
    ) then
      raise exception using errcode='22023',message='dmr_production_invalid_source_column_j';
    end if;

    v_id := null;
    insert into public.tfi_dmr_production_records(
      production_date,product_code,line,stop_time,resume_time,category,remarks,
      source_column_i,source_column_j,source_import_row_id,created_by,updated_by
    ) values (
      v_date,v_code,v_line,v_stop,v_resume,v_category,v_remarks,
      v_i,v_j,null,v_user_id,v_user_id
    ) on conflict do nothing returning id into v_id;

    if v_id is null then
      select * into v_existing
      from public.tfi_dmr_production_records r
      where r.production_date=v_date
        and lower(btrim(r.product_code))=lower(v_code)
        and lower(btrim(r.line))=lower(v_line)
        and r.stop_time=v_stop and r.resume_time=v_resume
      limit 1;
      if found and lower(btrim(v_existing.category))=lower(v_category)
         and v_existing.remarks is not distinct from v_remarks
         and v_existing.source_column_i is not distinct from v_i
         and v_existing.source_column_j is not distinct from v_j then
        v_duplicates := v_duplicates+1;
        v_results := v_results||jsonb_build_array(jsonb_build_object(
          'row_index',v_row_index,'status','duplicate','existing_id',v_existing.id
        ));
      else
        v_conflicts := v_conflicts+1;
        v_results := v_results||jsonb_build_array(jsonb_build_object(
          'row_index',v_row_index,'status','conflict','existing_id',v_existing.id
        ));
      end if;
      continue;
    end if;

    v_after := jsonb_build_object(
      'production_date',v_date,'product_code',v_code,'line',v_line,
      'stop_time',v_stop,'resume_time',v_resume,'category',v_category,
      'source_column_i',v_i,'source_column_j',v_j,'remarks',v_remarks,
      'downtime_minutes',(extract(epoch from (v_resume-v_stop))+
        case when v_resume<v_stop then 86400 else 0 end)/60
    );
    insert into public.tfi_audit_events(
      actor_user_id,actor_email_snapshot,actor_roles_snapshot,action_key,module_key,
      entity_type,entity_id,before_data,after_data,metadata,occurred_at
    ) values (
      v_user_id,v_context #>> '{profile,email}',coalesce(v_context->'roles','[]'::jsonb),
      'dmr_production.create','dmr_production','dmr_production_record',v_id::text,
      null,v_after,jsonb_build_object('entry_source','manual','row_index',v_row_index),now()
    );
    v_inserted := v_inserted+1;
    v_results := v_results||jsonb_build_array(jsonb_build_object(
      'row_index',v_row_index,'status','inserted','id',v_id
    ));
  end loop;

  return jsonb_build_object(
    'inserted',v_inserted,'duplicates',v_duplicates,'conflicts',v_conflicts,
    'empty',v_empty,'results',v_results
  );
end;
$function$;

revoke all on function private.tfi_create_dmr_production_records(jsonb) from public,anon;
grant execute on function private.tfi_create_dmr_production_records(jsonb) to authenticated;

create or replace function public.tfi_create_dmr_production_records(p_records jsonb)
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select private.tfi_create_dmr_production_records(p_records);
$function$;
revoke all on function public.tfi_create_dmr_production_records(jsonb) from public,anon;
grant execute on function public.tfi_create_dmr_production_records(jsonb) to authenticated;

create or replace function private.tfi_update_dmr_production_record(
  p_record_id uuid,p_expected_version integer,p_changes jsonb,p_change_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_context jsonb;
  v_row public.tfi_dmr_production_records%rowtype;
  v_date date;
  v_code text;
  v_line text;
  v_stop time;
  v_resume time;
  v_category text;
  v_i text;
  v_j text;
  v_remarks text;
  v_before jsonb;
  v_after jsonb;
  v_changed text[] := array[]::text[];
  v_version integer;
  v_existing_id uuid;
begin
  if v_user_id is null then
    raise exception using errcode='42501',message='authentication_required';
  end if;
  if not private.tfi_has_permission('dmr_production','view')
     or not private.tfi_has_permission('dmr_production','edit') then
    raise exception using errcode='42501',message='dmr_production_edit_permission_required';
  end if;
  if p_expected_version is null or p_expected_version<1
     or p_changes is null or jsonb_typeof(p_changes)<>'object' or p_changes='{}'::jsonb then
    raise exception using errcode='22023',message='dmr_production_update_request_invalid';
  end if;
  if exists(
    select 1 from jsonb_object_keys(p_changes) k
    where k not in ('production_date','product_code','line','stop_time','resume_time','category','source_column_i','source_column_j','remarks')
  ) then
    raise exception using errcode='22023',message='dmr_production_unknown_or_derived_field';
  end if;

  select * into v_row from public.tfi_dmr_production_records
  where id=p_record_id and record_status='active' for update;
  if not found then raise exception using errcode='P0002',message='dmr_production_record_not_found'; end if;
  if v_row.version<>p_expected_version then
    raise exception using errcode='40001',message='dmr_production_version_conflict';
  end if;

  begin
    v_date := case when p_changes ? 'production_date' then nullif(btrim(p_changes->>'production_date'),'')::date else v_row.production_date end;
    v_code := case when p_changes ? 'product_code' then nullif(btrim(p_changes->>'product_code'),'') else v_row.product_code end;
    v_line := case when p_changes ? 'line' then nullif(btrim(p_changes->>'line'),'') else v_row.line end;
    v_stop := case when p_changes ? 'stop_time' then nullif(btrim(p_changes->>'stop_time'),'')::time else v_row.stop_time end;
    v_resume := case when p_changes ? 'resume_time' then nullif(btrim(p_changes->>'resume_time'),'')::time else v_row.resume_time end;
    v_category := case when p_changes ? 'category' then nullif(btrim(p_changes->>'category'),'') else v_row.category end;
    v_i := case when p_changes ? 'source_column_i' then case when nullif(btrim(p_changes->>'source_column_i'),'') is null then null else p_changes->>'source_column_i' end else v_row.source_column_i end;
    v_j := case when p_changes ? 'source_column_j' then case when nullif(btrim(p_changes->>'source_column_j'),'') is null then null else p_changes->>'source_column_j' end else v_row.source_column_j end;
    v_remarks := case when p_changes ? 'remarks' then nullif(btrim(p_changes->>'remarks'),'') else v_row.remarks end;
  exception when others then
    raise exception using errcode='22023',message='dmr_production_invalid_field_value';
  end;

  if v_date is null or v_code is null or v_line is null or v_stop is null or v_resume is null or v_category is null then
    raise exception using errcode='22023',message='dmr_production_required_fields_missing';
  end if;
  if length(v_code)>100 or length(v_line)>120 or length(v_category)>120
     or length(v_i)>120 or length(v_j)>120 or length(v_remarks)>1000 then
    raise exception using errcode='22023',message='dmr_production_text_value_too_long';
  end if;
  if not exists(
    select 1 from public.tfi_master_data_rows md
    where md.category_key='dpr_legend' and md.row_kind='data' and md.record_status='active'
      and nullif(btrim(md.current_values->>1),'')=v_category
  ) then raise exception using errcode='22023',message='dmr_production_invalid_category'; end if;
  if v_i is not null and not exists(
    select 1 from public.tfi_master_data_rows md
    where md.category_key='dpr_legend' and md.row_kind='data' and md.record_status='active'
      and btrim(md.current_values->>2)=btrim(v_i)
  ) then raise exception using errcode='22023',message='dmr_production_invalid_source_column_i'; end if;
  if v_j is not null and not exists(
    select 1 from public.tfi_master_data_rows md
    where md.category_key='dpr_legend' and md.row_kind='data' and md.record_status='active'
      and btrim(md.current_values->>2)=btrim(v_j)
  ) then raise exception using errcode='22023',message='dmr_production_invalid_source_column_j'; end if;

  select r.id into v_existing_id from public.tfi_dmr_production_records r
  where r.id<>v_row.id and r.production_date=v_date
    and lower(btrim(r.product_code))=lower(v_code)
    and lower(btrim(r.line))=lower(v_line)
    and r.stop_time=v_stop and r.resume_time=v_resume
  limit 1;
  if v_existing_id is not null then
    raise exception using errcode='23505',message='dmr_production_duplicate_event';
  end if;

  v_before := jsonb_build_object(
    'production_date',v_row.production_date,'product_code',v_row.product_code,'line',v_row.line,
    'stop_time',v_row.stop_time,'resume_time',v_row.resume_time,'category',v_row.category,
    'source_column_i',v_row.source_column_i,'source_column_j',v_row.source_column_j,
    'remarks',v_row.remarks,'downtime_minutes',v_row.downtime_minutes,'version',v_row.version
  );
  v_after := jsonb_build_object(
    'production_date',v_date,'product_code',v_code,'line',v_line,
    'stop_time',v_stop,'resume_time',v_resume,'category',v_category,
    'source_column_i',v_i,'source_column_j',v_j,'remarks',v_remarks,
    'downtime_minutes',(extract(epoch from (v_resume-v_stop))+
      case when v_resume<v_stop then 86400 else 0 end)/60,
    'version',v_row.version+1
  );

  if (v_before - 'downtime_minutes' - 'version')=(v_after - 'downtime_minutes' - 'version') then
    return jsonb_build_object('changed',false,'id',v_row.id,'version',v_row.version);
  end if;
  if v_date is distinct from v_row.production_date then v_changed:=array_append(v_changed,'production_date'); end if;
  if v_code is distinct from v_row.product_code then v_changed:=array_append(v_changed,'product_code'); end if;
  if v_line is distinct from v_row.line then v_changed:=array_append(v_changed,'line'); end if;
  if v_stop is distinct from v_row.stop_time then v_changed:=array_append(v_changed,'stop_time'); end if;
  if v_resume is distinct from v_row.resume_time then v_changed:=array_append(v_changed,'resume_time'); end if;
  if v_category is distinct from v_row.category then v_changed:=array_append(v_changed,'category'); end if;
  if v_i is distinct from v_row.source_column_i then v_changed:=array_append(v_changed,'source_column_i'); end if;
  if v_j is distinct from v_row.source_column_j then v_changed:=array_append(v_changed,'source_column_j'); end if;
  if v_remarks is distinct from v_row.remarks then v_changed:=array_append(v_changed,'remarks'); end if;

  v_version:=v_row.version+1;
  insert into public.tfi_dmr_production_revisions(
    dmr_production_record_id,version,before_data,after_data,changed_fields,change_reason,changed_by
  ) values (
    v_row.id,v_version,v_before,v_after,v_changed,
    nullif(left(btrim(coalesce(p_change_reason,'')),500),''),v_user_id
  );
  update public.tfi_dmr_production_records
  set production_date=v_date,product_code=v_code,line=v_line,stop_time=v_stop,resume_time=v_resume,
      category=v_category,source_column_i=v_i,source_column_j=v_j,remarks=v_remarks,
      version=v_version,updated_at=now(),updated_by=v_user_id
  where id=v_row.id;

  v_context:=private.tfi_get_my_access_context();
  insert into public.tfi_audit_events(
    actor_user_id,actor_email_snapshot,actor_roles_snapshot,action_key,module_key,
    entity_type,entity_id,before_data,after_data,metadata,occurred_at
  ) values (
    v_user_id,v_context #>> '{profile,email}',coalesce(v_context->'roles','[]'::jsonb),
    'dmr_production.update','dmr_production','dmr_production_record',v_row.id::text,
    v_before,v_after,jsonb_build_object('changed_fields',to_jsonb(v_changed),
      'change_reason',nullif(left(btrim(coalesce(p_change_reason,'')),500),'')),now()
  );
  return jsonb_build_object('changed',true,'id',v_row.id,'version',v_version,
    'downtime_minutes',(extract(epoch from (v_resume-v_stop))+
      case when v_resume<v_stop then 86400 else 0 end)/60,'updated_at',now());
end;
$function$;

revoke all on function private.tfi_update_dmr_production_record(uuid,integer,jsonb,text) from public,anon;
grant execute on function private.tfi_update_dmr_production_record(uuid,integer,jsonb,text) to authenticated;

create or replace function public.tfi_update_dmr_production_record(
  p_record_id uuid,p_expected_version integer,p_changes jsonb,p_change_reason text default null
)
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select private.tfi_update_dmr_production_record(p_record_id,p_expected_version,p_changes,p_change_reason);
$function$;
revoke all on function public.tfi_update_dmr_production_record(uuid,integer,jsonb,text) from public,anon;
grant execute on function public.tfi_update_dmr_production_record(uuid,integer,jsonb,text) to authenticated;

