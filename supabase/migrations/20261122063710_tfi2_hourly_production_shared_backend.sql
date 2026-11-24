create table if not exists public.tfi_hourly_production_records (
  id uuid primary key default gen_random_uuid(),
  module_key text not null check (module_key in ('hourly_meat','hourly_coding','hourly_agri')),
  production_date date,
  hour smallint,
  product_code text,
  target_tins numeric(14,2),
  actual_tins numeric(14,2),
  remarks text,
  product_code_reference_status text not null default 'not_entered'
    check (product_code_reference_status in ('not_entered','matched','unmatched')),
  record_fingerprint text generated always as (
    md5(module_key || chr(31) ||
      coalesce((production_date-date '2000-01-01')::text,'') || chr(31) ||
      coalesce(hour::text,'') || chr(31) ||
      lower(btrim(coalesce(product_code,''))) || chr(31) ||
      coalesce(target_tins::text,'') || chr(31) ||
      coalesce(actual_tins::text,'') || chr(31) ||
      btrim(coalesce(remarks,'')))
  ) stored,
  source_import_row_id uuid unique references public.tfi_import_rows(id) on delete restrict,
  entry_source text not null default 'manual' check (entry_source in ('manual','import')),
  version integer not null default 1 check (version>0),
  record_status text not null default 'active' check (record_status in ('active','archived')),
  created_by uuid not null references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tfi_hourly_date_after_2000 check (production_date is null or production_date > date '2000-01-01'),
  constraint tfi_hourly_hour_range check (hour is null or hour between 0 and 23),
  constraint tfi_hourly_product_code_length check (product_code is null or length(product_code)<=100),
  constraint tfi_hourly_target_nonnegative check (target_tins is null or target_tins>=0),
  constraint tfi_hourly_actual_nonnegative check (actual_tins is null or actual_tins>=0),
  constraint tfi_hourly_remarks_length check (remarks is null or length(remarks)<=400),
  constraint tfi_hourly_fingerprint_unique unique(record_fingerprint)
);
create unique index if not exists tfi_hourly_module_slot_active_uidx
  on public.tfi_hourly_production_records(module_key,production_date,hour,product_code)
  where record_status='active' and production_date is not null and hour is not null and product_code is not null;
create index if not exists tfi_hourly_module_date_hour_idx
  on public.tfi_hourly_production_records(module_key,production_date desc,hour desc);
create index if not exists tfi_hourly_module_code_idx
  on public.tfi_hourly_production_records(module_key,product_code);
alter table public.tfi_hourly_production_records enable row level security;
revoke all on public.tfi_hourly_production_records from public,anon,authenticated;
grant select on public.tfi_hourly_production_records to authenticated;
create policy tfi_hourly_records_authorized_read on public.tfi_hourly_production_records for select to authenticated
  using ((select private.tfi_has_permission(module_key,'view')));

create table if not exists public.tfi_hourly_production_revisions (
  id uuid primary key default gen_random_uuid(),
  hourly_production_record_id uuid not null references public.tfi_hourly_production_records(id) on delete restrict,
  version integer not null check (version>1),
  before_data jsonb not null check (jsonb_typeof(before_data)='object'),
  after_data jsonb not null check (jsonb_typeof(after_data)='object'),
  changed_fields text[] not null check (cardinality(changed_fields)>0),
  change_reason text check (change_reason is null or length(change_reason)<=500),
  changed_by uuid references auth.users(id),
  changed_at timestamptz not null default now(),
  unique(hourly_production_record_id,version)
);
create index if not exists tfi_hourly_revisions_record_order_idx
  on public.tfi_hourly_production_revisions(hourly_production_record_id,version desc);
alter table public.tfi_hourly_production_revisions enable row level security;
revoke all on public.tfi_hourly_production_revisions from public,anon,authenticated;
grant select on public.tfi_hourly_production_revisions to authenticated;
create policy tfi_hourly_revisions_authorized_read on public.tfi_hourly_production_revisions for select to authenticated
  using (exists(
    select 1 from public.tfi_hourly_production_records r
    where r.id=hourly_production_record_id and private.tfi_has_permission(r.module_key,'view')
  ));

create or replace view public.tfi_hourly_production_record_view
with (security_invoker=true) as
select
  r.id,r.module_key,r.production_date,r.hour,r.product_code,r.target_tins,r.actual_tins,r.remarks,
  coalesce(nullif(btrim(cm.product_name),''),'Other') as product_name,
  case when r.hour is null then null else
    to_char(make_time(r.hour::integer,0,0),'HH24:MI') || '-' ||
    to_char(make_time(((r.hour::integer+1)%24),0,0),'HH24:MI') end as time_slot,
  case when r.target_tins is null or r.actual_tins is null then null
    else r.actual_tins-r.target_tins end as variance_tins,
  case when r.production_date is null or r.hour is null or r.product_code is null then null
    else sum(coalesce(r.target_tins,0)) over (
      partition by r.module_key,r.production_date,r.product_code
      order by r.hour rows between unbounded preceding and current row
    ) end as cumulative_target_tins,
  case when r.production_date is null or r.hour is null or r.product_code is null or r.actual_tins is null then null
    else sum(coalesce(r.actual_tins,0)) over (
      partition by r.module_key,r.production_date,r.product_code
      order by r.hour rows between unbounded preceding and current row
    ) end as cumulative_actual_tins,
  case when r.target_tins is null or r.target_tins=0 or r.actual_tins is null then null
    else r.actual_tins/r.target_tins end as hour_attainment,
  r.product_code_reference_status,r.source_import_row_id,r.entry_source,r.version,r.record_status,
  r.created_by,r.updated_by,r.created_at,r.updated_at
from public.tfi_hourly_production_records r
left join lateral (
  select nullif(btrim(md.current_values->>1),'') as product_name
  from public.tfi_master_data_rows md
  where md.category_key='code_map' and md.row_kind='data' and md.record_status='active'
    and btrim(coalesce(md.current_values->>0,''))=r.product_code
  order by md.source_row_number
  limit 1
) cm on true;
revoke all on public.tfi_hourly_production_record_view from public,anon;
grant select on public.tfi_hourly_production_record_view to authenticated;

create or replace function private.tfi_get_hourly_production_catalog(p_module_key text)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare v_products jsonb; v_sheet text; v_sheet_id bigint; v_range text;
begin
  if p_module_key not in ('hourly_meat','hourly_coding','hourly_agri') then
    raise exception using errcode='22023',message='hourly_module_invalid';
  end if;
  if auth.uid() is null or not private.tfi_has_permission(p_module_key,'view') then
    raise exception using errcode='42501',message='hourly_view_permission_required';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('code',btrim(current_values->>0),'name',btrim(current_values->>1))
    order by source_row_number),'[]'::jsonb)
  into v_products
  from public.tfi_master_data_rows
  where category_key='code_map' and row_kind='data' and record_status='active'
    and nullif(btrim(current_values->>0),'') is not null
    and nullif(btrim(current_values->>1),'') is not null;
  select
    case p_module_key when 'hourly_meat' then 'Hourly Meat' when 'hourly_coding' then 'Hourly Coding' else 'Hourly Agri' end,
    case p_module_key when 'hourly_meat' then 428082343 when 'hourly_coding' then 1916766220 else 534145404 end,
    case p_module_key when 'hourly_meat' then 'A1:L5004' when 'hourly_coding' then 'A5:L5004' else 'A5:L5004' end
  into v_sheet,v_sheet_id,v_range;
  return jsonb_build_object(
    'module_key',p_module_key,'module_name',v_sheet,
    'products',v_products,'product_code_count',jsonb_array_length(v_products),
    'source',jsonb_build_object('sheet_name',v_sheet,'sheet_id',v_sheet_id,'range',v_range,
      'input_columns',jsonb_build_array('Date','Hour','Product Code','Target (tins)','Actual (tins)','Remarks'),
      'calculated_columns',jsonb_build_array('Product Name','Time Slot','Variance','Cumulative Target','Cumulative Actual','Hour Attainment')),
    'validation',jsonb_build_object('date_after','2000-01-01','hour_min',0,'hour_max',23,
      'product_code_reference','Code Map A5:B400','target_min',0,'actual_min',0)
  );
end;
$function$;
revoke all on function private.tfi_get_hourly_production_catalog(text) from public,anon;
grant execute on function private.tfi_get_hourly_production_catalog(text) to authenticated;
create or replace function public.tfi_get_hourly_production_catalog(p_module_key text)
returns jsonb language sql security invoker set search_path=''
as $function$ select private.tfi_get_hourly_production_catalog(p_module_key); $function$;
revoke all on function public.tfi_get_hourly_production_catalog(text) from public,anon;
grant execute on function public.tfi_get_hourly_production_catalog(text) to authenticated;

create or replace function private.tfi_get_hourly_production_records(
  p_module_key text,p_date_from date default null,p_date_to date default null,
  p_product_code text default null,p_search text default null,p_page integer default 1,p_page_size integer default 100
)
returns jsonb language plpgsql security invoker set search_path=''
as $function$
declare v_result jsonb;
begin
  if p_module_key not in ('hourly_meat','hourly_coding','hourly_agri') then
    raise exception using errcode='22023',message='hourly_module_invalid';
  end if;
  if not private.tfi_has_permission(p_module_key,'view') then
    raise exception using errcode='42501',message='hourly_view_permission_required';
  end if;
  if p_page is null or p_page<1 or p_page_size is null or p_page_size<1 or p_page_size>100 then
    raise exception using errcode='22023',message='hourly_pagination_invalid';
  end if;
  if p_date_from is not null and p_date_to is not null and p_date_from>p_date_to then
    raise exception using errcode='22023',message='hourly_date_range_invalid';
  end if;
  with filtered as (
    select * from public.tfi_hourly_production_record_view v
    where v.module_key=p_module_key and v.record_status='active'
      and (p_date_from is null or v.production_date>=p_date_from)
      and (p_date_to is null or v.production_date<=p_date_to)
      and (nullif(btrim(coalesce(p_product_code,'')),'') is null or v.product_code=p_product_code)
      and (nullif(btrim(coalesce(p_search,'')),'') is null or
        concat_ws(' ',v.product_code,v.product_name,v.remarks,v.time_slot,v.hour::text,v.production_date::text)
        ilike '%'||btrim(p_search)||'%')
  ), summary as (
    select count(*)::integer record_count,
      count(distinct product_code)::integer product_codes_in_use,
      coalesce(sum(target_tins),0)::numeric(16,2) total_target_tins,
      coalesce(sum(actual_tins),0)::numeric(16,2) total_actual_tins,
      coalesce(sum(variance_tins),0)::numeric(16,2) total_variance_tins,
      case when coalesce(sum(target_tins),0)>0 then sum(actual_tins)/sum(target_tins) else null end attainment
    from filtered
  ), page_rows as (
    select * from filtered order by production_date desc nulls last,hour desc nulls last,product_code,created_at desc
      limit p_page_size offset (p_page-1)*p_page_size
  )
  select jsonb_build_object(
    'records',coalesce((select jsonb_agg(to_jsonb(pr) order by pr.production_date desc nulls last,pr.hour desc nulls last,pr.product_code,pr.created_at desc) from page_rows pr),'[]'::jsonb),
    'page',p_page,'page_size',p_page_size,
    'total_count',(select record_count from summary),
    'has_more',(select record_count from summary)>(p_page*p_page_size),
    'summary',(select to_jsonb(summary) from summary)
  ) into v_result;
  return v_result;
end;
$function$;
revoke all on function private.tfi_get_hourly_production_records(text,date,date,text,text,integer,integer) from public,anon;
grant execute on function private.tfi_get_hourly_production_records(text,date,date,text,text,integer,integer) to authenticated;
create or replace function public.tfi_get_hourly_production_records(
  p_module_key text,p_date_from date default null,p_date_to date default null,
  p_product_code text default null,p_search text default null,p_page integer default 1,p_page_size integer default 100
)
returns jsonb language sql security invoker set search_path=''
as $function$ select private.tfi_get_hourly_production_records(p_module_key,p_date_from,p_date_to,p_product_code,p_search,p_page,p_page_size); $function$;
revoke all on function public.tfi_get_hourly_production_records(text,date,date,text,text,integer,integer) from public,anon;
grant execute on function public.tfi_get_hourly_production_records(text,date,date,text,text,integer,integer) to authenticated;

create or replace function private.tfi_create_hourly_production_records(p_module_key text,p_records jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare
  v_user_id uuid:=auth.uid(); v_context jsonb; v_item jsonb; v_data jsonb; v_index integer; v_row_index integer;
  v_date date; v_hour smallint; v_code text; v_target numeric(14,2); v_actual numeric(14,2); v_remarks text;
  v_code_status text; v_id uuid; v_after jsonb; v_results jsonb:='[]'::jsonb;
  v_inserted integer:=0; v_duplicates integer:=0; v_empty integer:=0;
begin
  if p_module_key not in ('hourly_meat','hourly_coding','hourly_agri') then
    raise exception using errcode='22023',message='hourly_module_invalid';
  end if;
  if v_user_id is null then raise exception using errcode='42501',message='authentication_required'; end if;
  if not private.tfi_has_permission(p_module_key,'view') or not private.tfi_has_permission(p_module_key,'create') then
    raise exception using errcode='42501',message='hourly_create_permission_required';
  end if;
  if p_records is null or jsonb_typeof(p_records)<>'array' or jsonb_array_length(p_records)<1 or jsonb_array_length(p_records)>100 then
    raise exception using errcode='22023',message='hourly_rows_required';
  end if;
  v_context:=private.tfi_get_my_access_context();
  for v_item,v_index in select value,ordinality::integer from jsonb_array_elements(p_records) with ordinality loop
    if jsonb_typeof(v_item)<>'object' or exists(select 1 from jsonb_object_keys(v_item) k where k not in ('row_index','record_data'))
      or jsonb_typeof(v_item->'record_data')<>'object' then
      raise exception using errcode='22023',message='hourly_row_shape_invalid';
    end if;
    v_data:=v_item->'record_data';
    if exists(select 1 from jsonb_object_keys(v_data) k where k not in ('production_date','hour','product_code','target_tins','actual_tins','remarks')) then
      raise exception using errcode='22023',message='hourly_unknown_or_derived_field';
    end if;
    v_row_index:=coalesce(nullif(v_item->>'row_index','')::integer,v_index);
    begin
      v_date:=nullif(btrim(v_data->>'production_date'),'')::date;
      v_hour:=nullif(btrim(v_data->>'hour'),'')::smallint;
      v_code:=nullif(btrim(v_data->>'product_code'),'');
      v_target:=nullif(btrim(v_data->>'target_tins'),'')::numeric;
      v_actual:=nullif(btrim(v_data->>'actual_tins'),'')::numeric;
      v_remarks:=nullif(btrim(v_data->>'remarks'),'');
    exception when others then raise exception using errcode='22023',message='hourly_invalid_field_value'; end;
    if v_date is null and v_hour is null and v_code is null and v_target is null and v_actual is null and v_remarks is null then
      v_empty:=v_empty+1;
      v_results:=v_results||jsonb_build_array(jsonb_build_object('row_index',v_row_index,'status','empty'));
      continue;
    end if;
    if v_date is not null and v_date<=date '2000-01-01' then raise exception using errcode='22023',message='hourly_date_out_of_range'; end if;
    if v_hour is not null and v_hour not between 0 and 23 then raise exception using errcode='22023',message='hourly_hour_out_of_range'; end if;
    if v_target is not null and (v_target<0 or v_target='NaN'::numeric) then raise exception using errcode='22023',message='hourly_target_invalid'; end if;
    if v_actual is not null and (v_actual<0 or v_actual='NaN'::numeric) then raise exception using errcode='22023',message='hourly_actual_invalid'; end if;
    if length(v_code)>100 or length(v_remarks)>400 then raise exception using errcode='22023',message='hourly_text_too_long'; end if;
    if v_code is null then v_code_status:='not_entered';
    elsif exists(select 1 from public.tfi_master_data_rows md where md.category_key='code_map' and md.row_kind='data'
      and md.record_status='active' and btrim(coalesce(md.current_values->>0,''))=v_code) then v_code_status:='matched';
    else v_code_status:='unmatched'; end if;
    v_id:=null;
    insert into public.tfi_hourly_production_records(
      module_key,production_date,hour,product_code,target_tins,actual_tins,remarks,
      product_code_reference_status,source_import_row_id,entry_source,created_by,updated_by
    ) values(p_module_key,v_date,v_hour,v_code,v_target,v_actual,v_remarks,v_code_status,null,'manual',v_user_id,v_user_id)
    on conflict do nothing returning id into v_id;
    if v_id is null then
      v_duplicates:=v_duplicates+1;
      v_results:=v_results||jsonb_build_array(jsonb_build_object('row_index',v_row_index,'status','duplicate'));
      continue;
    end if;
    select to_jsonb(v) into v_after from public.tfi_hourly_production_record_view v where v.id=v_id;
    insert into public.tfi_audit_events(actor_user_id,actor_email_snapshot,actor_roles_snapshot,action_key,module_key,
      entity_type,entity_id,before_data,after_data,metadata,occurred_at)
    values(v_user_id,v_context #>> '{profile,email}',coalesce(v_context->'roles','[]'::jsonb),
      p_module_key||'.create',p_module_key,'hourly_production_record',v_id::text,null,v_after,
      jsonb_build_object('entry_source','manual','row_index',v_row_index),now());
    v_inserted:=v_inserted+1;
    v_results:=v_results||jsonb_build_array(jsonb_build_object('row_index',v_row_index,'status','inserted','id',v_id,
      'product_code_reference_status',v_code_status));
  end loop;
  return jsonb_build_object('inserted',v_inserted,'duplicates',v_duplicates,'empty',v_empty,'results',v_results);
end;
$function$;
revoke all on function private.tfi_create_hourly_production_records(text,jsonb) from public,anon;
grant execute on function private.tfi_create_hourly_production_records(text,jsonb) to authenticated;
create or replace function public.tfi_create_hourly_production_records(p_module_key text,p_records jsonb)
returns jsonb language sql security invoker set search_path=''
as $function$ select private.tfi_create_hourly_production_records(p_module_key,p_records); $function$;
revoke all on function public.tfi_create_hourly_production_records(text,jsonb) from public,anon;
grant execute on function public.tfi_create_hourly_production_records(text,jsonb) to authenticated;

create or replace function private.tfi_update_hourly_production_record(
  p_module_key text,p_record_id uuid,p_expected_version integer,p_changes jsonb,p_change_reason text default null
)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare
  v_user_id uuid:=auth.uid(); v_context jsonb; v_row public.tfi_hourly_production_records%rowtype;
  v_date date; v_hour smallint; v_code text; v_target numeric(14,2); v_actual numeric(14,2); v_remarks text;
  v_code_status text; v_before jsonb; v_after jsonb; v_changed text[]:=array[]::text[]; v_version integer;
begin
  if p_module_key not in ('hourly_meat','hourly_coding','hourly_agri') then raise exception using errcode='22023',message='hourly_module_invalid'; end if;
  if v_user_id is null then raise exception using errcode='42501',message='authentication_required'; end if;
  if not private.tfi_has_permission(p_module_key,'view') or not private.tfi_has_permission(p_module_key,'edit') then
    raise exception using errcode='42501',message='hourly_edit_permission_required'; end if;
  if p_expected_version is null or p_expected_version<1 or p_changes is null or jsonb_typeof(p_changes)<>'object' or p_changes='{}'::jsonb then
    raise exception using errcode='22023',message='hourly_update_request_invalid'; end if;
  if exists(select 1 from jsonb_object_keys(p_changes) k where k not in ('production_date','hour','product_code','target_tins','actual_tins','remarks')) then
    raise exception using errcode='22023',message='hourly_unknown_or_derived_field'; end if;
  select * into v_row from public.tfi_hourly_production_records where id=p_record_id and module_key=p_module_key and record_status='active' for update;
  if not found then raise exception using errcode='P0002',message='hourly_record_not_found'; end if;
  if v_row.version<>p_expected_version then raise exception using errcode='40001',message='hourly_version_conflict'; end if;
  begin
    v_date:=case when p_changes?'production_date' then nullif(btrim(p_changes->>'production_date'),'')::date else v_row.production_date end;
    v_hour:=case when p_changes?'hour' then nullif(btrim(p_changes->>'hour'),'')::smallint else v_row.hour end;
    v_code:=case when p_changes?'product_code' then nullif(btrim(p_changes->>'product_code'),'') else v_row.product_code end;
    v_target:=case when p_changes?'target_tins' then nullif(btrim(p_changes->>'target_tins'),'')::numeric else v_row.target_tins end;
    v_actual:=case when p_changes?'actual_tins' then nullif(btrim(p_changes->>'actual_tins'),'')::numeric else v_row.actual_tins end;
    v_remarks:=case when p_changes?'remarks' then nullif(btrim(p_changes->>'remarks'),'') else v_row.remarks end;
  exception when others then raise exception using errcode='22023',message='hourly_invalid_field_value'; end;
  if v_date is not null and v_date<=date '2000-01-01' then raise exception using errcode='22023',message='hourly_date_out_of_range'; end if;
  if v_hour is not null and v_hour not between 0 and 23 then raise exception using errcode='22023',message='hourly_hour_out_of_range'; end if;
  if v_target is not null and (v_target<0 or v_target='NaN'::numeric) then raise exception using errcode='22023',message='hourly_target_invalid'; end if;
  if v_actual is not null and (v_actual<0 or v_actual='NaN'::numeric) then raise exception using errcode='22023',message='hourly_actual_invalid'; end if;
  if length(v_code)>100 or length(v_remarks)>400 then raise exception using errcode='22023',message='hourly_text_too_long'; end if;
  if v_code is null then v_code_status:='not_entered';
  elsif exists(select 1 from public.tfi_master_data_rows md where md.category_key='code_map' and md.row_kind='data' and md.record_status='active'
    and btrim(coalesce(md.current_values->>0,''))=v_code) then v_code_status:='matched';
  else v_code_status:='unmatched'; end if;
  v_before:=jsonb_build_object('production_date',v_row.production_date,'hour',v_row.hour,'product_code',v_row.product_code,
    'target_tins',v_row.target_tins,'actual_tins',v_row.actual_tins,'remarks',v_row.remarks,
    'product_code_reference_status',v_row.product_code_reference_status,'version',v_row.version);
  v_after:=jsonb_build_object('production_date',v_date,'hour',v_hour,'product_code',v_code,'target_tins',v_target,
    'actual_tins',v_actual,'remarks',v_remarks,'product_code_reference_status',v_code_status,'version',v_row.version+1);
  if (v_before-'version')=(v_after-'version') then return jsonb_build_object('changed',false,'id',v_row.id,'version',v_row.version); end if;
  if v_date is distinct from v_row.production_date then v_changed:=array_append(v_changed,'production_date'); end if;
  if v_hour is distinct from v_row.hour then v_changed:=array_append(v_changed,'hour'); end if;
  if v_code is distinct from v_row.product_code then v_changed:=array_append(v_changed,'product_code'); end if;
  if v_target is distinct from v_row.target_tins then v_changed:=array_append(v_changed,'target_tins'); end if;
  if v_actual is distinct from v_row.actual_tins then v_changed:=array_append(v_changed,'actual_tins'); end if;
  if v_remarks is distinct from v_row.remarks then v_changed:=array_append(v_changed,'remarks'); end if;
  if v_code_status is distinct from v_row.product_code_reference_status then v_changed:=array_append(v_changed,'product_code_reference_status'); end if;
  v_version:=v_row.version+1;
  insert into public.tfi_hourly_production_revisions(hourly_production_record_id,version,before_data,after_data,changed_fields,change_reason,changed_by)
  values(v_row.id,v_version,v_before,v_after,v_changed,nullif(left(btrim(coalesce(p_change_reason,'')),500),''),v_user_id);
  begin
    update public.tfi_hourly_production_records set production_date=v_date,hour=v_hour,product_code=v_code,
      target_tins=v_target,actual_tins=v_actual,remarks=v_remarks,product_code_reference_status=v_code_status,
      version=v_version,updated_at=now(),updated_by=v_user_id where id=v_row.id;
  exception when unique_violation then raise exception using errcode='23505',message='hourly_duplicate_slot'; end;
  v_context:=private.tfi_get_my_access_context();
  select to_jsonb(v) into v_after from public.tfi_hourly_production_record_view v where v.id=v_row.id;
  insert into public.tfi_audit_events(actor_user_id,actor_email_snapshot,actor_roles_snapshot,action_key,module_key,entity_type,entity_id,
    before_data,after_data,metadata,occurred_at)
  values(v_user_id,v_context #>> '{profile,email}',coalesce(v_context->'roles','[]'::jsonb),p_module_key||'.update',p_module_key,
    'hourly_production_record',v_row.id::text,v_before,v_after,
    jsonb_build_object('changed_fields',to_jsonb(v_changed),'change_reason',nullif(left(btrim(coalesce(p_change_reason,'')),500),'')),now());
  return jsonb_build_object('changed',true,'id',v_row.id,'version',v_version);
end;
$function$;
revoke all on function private.tfi_update_hourly_production_record(text,uuid,integer,jsonb,text) from public,anon;
grant execute on function private.tfi_update_hourly_production_record(text,uuid,integer,jsonb,text) to authenticated;
create or replace function public.tfi_update_hourly_production_record(
  p_module_key text,p_record_id uuid,p_expected_version integer,p_changes jsonb,p_change_reason text default null
)
returns jsonb language sql security invoker set search_path=''
as $function$ select private.tfi_update_hourly_production_record(p_module_key,p_record_id,p_expected_version,p_changes,p_change_reason); $function$;
revoke all on function public.tfi_update_hourly_production_record(text,uuid,integer,jsonb,text) from public,anon;
grant execute on function public.tfi_update_hourly_production_record(text,uuid,integer,jsonb,text) to authenticated;
