alter table public.tfi_oee_records
  add column if not exists version integer not null default 1 check (version>0),
  add column if not exists record_status text not null default 'active' check (record_status in ('active','archived')),
  add column if not exists updated_by uuid references auth.users(id),
  add column if not exists updated_at timestamptz not null default now();
create index if not exists tfi_oee_records_date_machine_idx on public.tfi_oee_records(production_date desc,machine,product_code);

create table if not exists public.tfi_oee_revisions (
  id uuid primary key default gen_random_uuid(),
  oee_record_id uuid not null references public.tfi_oee_records(id) on delete restrict,
  version integer not null check (version>1),
  before_data jsonb not null check (jsonb_typeof(before_data)='object'),
  after_data jsonb not null check (jsonb_typeof(after_data)='object'),
  changed_fields text[] not null check (cardinality(changed_fields)>0),
  change_reason text check (change_reason is null or length(change_reason)<=500),
  changed_by uuid references auth.users(id),
  changed_at timestamptz not null default now(),
  unique(oee_record_id,version)
);
create index if not exists tfi_oee_revisions_record_order_idx on public.tfi_oee_revisions(oee_record_id,version desc);
alter table public.tfi_oee_revisions enable row level security;
revoke all on public.tfi_oee_revisions from public,anon,authenticated;
grant select on public.tfi_oee_revisions to authenticated;
create policy tfi_oee_revisions_authorized_read on public.tfi_oee_revisions for select to authenticated
  using (exists(select 1 from public.tfi_oee_records r where r.id=oee_record_id and private.tfi_has_permission('oee','view')));

create or replace view public.tfi_oee_record_view with (security_invoker=true) as
select
  r.id,r.production_date,r.machine,r.line,r.product_code,r.planned_hours,r.downtime_hours,r.ideal_rate,
  r.total_count,r.reject_count,r.include_in_overall,
  (r.planned_hours-r.downtime_hours) as run_time_hours,
  (r.total_count-r.reject_count) as good_count,
  case when r.planned_hours>0 then (r.planned_hours-r.downtime_hours)/r.planned_hours else null end as availability,
  case when (r.planned_hours-r.downtime_hours)*r.ideal_rate>0
    then least(r.total_count::numeric,(r.planned_hours-r.downtime_hours)*r.ideal_rate)/
      ((r.planned_hours-r.downtime_hours)*r.ideal_rate) else null end as performance,
  case when r.total_count>0 then (r.total_count-r.reject_count)::numeric/r.total_count else null end as quality,
  case when r.planned_hours>0
    and (r.planned_hours-r.downtime_hours)*r.ideal_rate>0
    and r.total_count>0
    then ((r.planned_hours-r.downtime_hours)/r.planned_hours) *
      (least(r.total_count::numeric,(r.planned_hours-r.downtime_hours)*r.ideal_rate)/
      ((r.planned_hours-r.downtime_hours)*r.ideal_rate)) *
      ((r.total_count-r.reject_count)::numeric/r.total_count)
    else null end as oee,
  ((r.planned_hours-r.downtime_hours)*r.ideal_rate) as ideal_output,
  least(r.total_count::numeric,(r.planned_hours-r.downtime_hours)*r.ideal_rate) as capped_count,
  extract(week from r.production_date)::integer as week,
  extract(month from r.production_date)::integer as month,
  coalesce(nullif(btrim(cm.product_name),''),'Other') as product_name,
  r.source_import_row_id,r.created_by,r.created_at,r.updated_by,r.updated_at,r.version,r.record_status
from public.tfi_oee_records r
left join lateral (
  select nullif(btrim(md.current_values->>1),'') product_name
  from public.tfi_master_data_rows md
  where md.category_key='code_map' and md.row_kind='data' and md.record_status='active'
    and btrim(coalesce(md.current_values->>0,''))=r.product_code
  order by md.source_row_number limit 1
) cm on true
where r.record_status='active';
revoke all on public.tfi_oee_record_view from public,anon;
grant select on public.tfi_oee_record_view to authenticated;

create or replace function private.tfi_get_oee_catalog()
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare v_machines jsonb; v_products jsonb; v_lines jsonb;
begin
  if auth.uid() is null or not private.tfi_has_permission('oee','view') then
    raise exception using errcode='42501',message='oee_view_permission_required';
  end if;
  select coalesce(jsonb_agg(machine order by first_row),'[]'::jsonb) into v_machines
  from (
    select min(source_row_number) first_row,btrim(current_values->>5) machine
    from public.tfi_master_data_rows
    where category_key='kpi_setup' and row_kind='data' and record_status='active'
      and source_row_number between 3 and 54
      and nullif(btrim(current_values->>5),'') is not null and lower(btrim(current_values->>5))<>'all'
    group by btrim(current_values->>5)
  ) m;
  select coalesce(jsonb_agg(jsonb_build_object('code',code,'name',coalesce(nullif(btrim(cm.product_name),''),'Other')) order by first_row),'[]'::jsonb)
  into v_products
  from (
    select min(source_row_number) first_row,btrim(current_values->>4) code
    from public.tfi_master_data_rows
    where category_key='kpi_setup' and row_kind='data' and record_status='active'
      and source_row_number between 3 and 129
      and nullif(btrim(current_values->>4),'') is not null and lower(btrim(current_values->>4))<>'all'
    group by btrim(current_values->>4)
  ) p
  left join lateral (
    select md.current_values->>1 product_name from public.tfi_master_data_rows md
    where md.category_key='code_map' and md.row_kind='data' and md.record_status='active'
      and btrim(coalesce(md.current_values->>0,''))=p.code order by md.source_row_number limit 1
  ) cm on true;
  v_lines:=jsonb_build_array('AGRILINE','MEATLINE','CODINGLINE');
  return jsonb_build_object(
    'machines',v_machines,'lines',v_lines,'products',v_products,
    'source',jsonb_build_object('sheet_name','OEE','sheet_id',1750442014,'range','A1:U4000',
      'header_row',4,'first_data_row',5,'last_data_row',3704,'historical_records',3700,
      'machine_options_source','KPI Setup!F3:F54','product_code_options_source','KPI Setup!E3:E129',
      'line_options_source','OEE!C5 validation list','product_name_source','Code Map!A5:B400')
  );
end;
$function$;
revoke all on function private.tfi_get_oee_catalog() from public,anon;
grant execute on function private.tfi_get_oee_catalog() to authenticated;
create or replace function public.tfi_get_oee_catalog()
returns jsonb language sql security invoker set search_path=''
as $function$ select private.tfi_get_oee_catalog(); $function$;
revoke all on function public.tfi_get_oee_catalog() from public,anon;
grant execute on function public.tfi_get_oee_catalog() to authenticated;

create or replace function private.tfi_get_oee_records(
  p_date_from date default null,p_date_to date default null,p_machine text default null,
  p_line text default null,p_product_code text default null,p_search text default null,
  p_page integer default 1,p_page_size integer default 100
)
returns jsonb language plpgsql security invoker set search_path=''
as $function$
declare v_result jsonb;
begin
  if not private.tfi_has_permission('oee','view') then raise exception using errcode='42501',message='oee_view_permission_required'; end if;
  if p_page is null or p_page<1 or p_page_size is null or p_page_size<1 or p_page_size>100 then
    raise exception using errcode='22023',message='oee_pagination_invalid'; end if;
  if p_date_from is not null and p_date_to is not null and p_date_from>p_date_to then
    raise exception using errcode='22023',message='oee_date_range_invalid'; end if;
  with filtered as (
    select * from public.tfi_oee_record_view v
    where (p_date_from is null or v.production_date>=p_date_from)
      and (p_date_to is null or v.production_date<=p_date_to)
      and (nullif(btrim(coalesce(p_machine,'')),'') is null or v.machine=p_machine)
      and (nullif(btrim(coalesce(p_line,'')),'') is null or v.line=p_line)
      and (nullif(btrim(coalesce(p_product_code,'')),'') is null or v.product_code=p_product_code)
      and (nullif(btrim(coalesce(p_search,'')),'') is null or
        concat_ws(' ',v.machine,v.line,v.product_code,v.product_name,v.production_date::text) ilike '%'||btrim(p_search)||'%')
  ), summary as (
    select count(*)::integer record_count,
      count(*) filter(where include_in_overall='Y')::integer included_rows,
      coalesce(sum(planned_hours) filter(where include_in_overall='Y'),0)::numeric total_planned_hours,
      coalesce(sum(run_time_hours) filter(where include_in_overall='Y'),0)::numeric total_run_time_hours,
      coalesce(sum(total_count) filter(where include_in_overall='Y'),0)::numeric total_count,
      coalesce(sum(good_count) filter(where include_in_overall='Y'),0)::numeric good_count,
      coalesce(sum(ideal_output) filter(where include_in_overall='Y'),0)::numeric ideal_output,
      coalesce(sum(capped_count) filter(where include_in_overall='Y'),0)::numeric capped_count
    from filtered
  ), page_rows as (
    select * from filtered order by production_date desc,machine,product_code limit p_page_size offset (p_page-1)*p_page_size
  ), calculated_summary as (
    select *,
      case when total_planned_hours>0 then total_run_time_hours/total_planned_hours else null end availability,
      case when ideal_output>0 then capped_count/ideal_output else null end performance,
      case when total_count>0 then good_count/total_count else null end quality
    from summary
  )
  select jsonb_build_object(
    'records',coalesce((select jsonb_agg(to_jsonb(pr) order by pr.production_date desc,pr.machine,pr.product_code) from page_rows pr),'[]'::jsonb),
    'page',p_page,'page_size',p_page_size,'total_count',(select record_count from calculated_summary),
    'has_more',(select record_count from calculated_summary)>(p_page*p_page_size),
    'summary',(select to_jsonb(s)||jsonb_build_object('overall_oee',
      case when s.availability is not null and s.performance is not null and s.quality is not null
        then s.availability*s.performance*s.quality else null end) from calculated_summary s)
  ) into v_result;
  return v_result;
end;
$function$;
revoke all on function private.tfi_get_oee_records(date,date,text,text,text,text,integer,integer) from public,anon;
grant execute on function private.tfi_get_oee_records(date,date,text,text,text,text,integer,integer) to authenticated;
create or replace function public.tfi_get_oee_records(
  p_date_from date default null,p_date_to date default null,p_machine text default null,
  p_line text default null,p_product_code text default null,p_search text default null,
  p_page integer default 1,p_page_size integer default 100
)
returns jsonb language sql security invoker set search_path=''
as $function$ select private.tfi_get_oee_records(p_date_from,p_date_to,p_machine,p_line,p_product_code,p_search,p_page,p_page_size); $function$;
revoke all on function public.tfi_get_oee_records(date,date,text,text,text,text,integer,integer) from public,anon;
grant execute on function public.tfi_get_oee_records(date,date,text,text,text,text,integer,integer) to authenticated;

create or replace function private.tfi_create_oee_records(p_records jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare v_item jsonb; v_index integer; v_data jsonb; v_result jsonb; v_results jsonb:='[]'::jsonb;
  v_inserted integer:=0; v_duplicates integer:=0; v_empty integer:=0; v_row_index integer;
begin
  if auth.uid() is null or not private.tfi_has_permission('oee','view') or not private.tfi_has_permission('oee','create') then
    raise exception using errcode='42501',message='oee_create_permission_required'; end if;
  if p_records is null or jsonb_typeof(p_records)<>'array' or jsonb_array_length(p_records)<1 or jsonb_array_length(p_records)>100 then
    raise exception using errcode='22023',message='oee_rows_required'; end if;
  for v_item,v_index in select value,ordinality::integer from jsonb_array_elements(p_records) with ordinality loop
    if jsonb_typeof(v_item)<>'object' or exists(select 1 from jsonb_object_keys(v_item) k where k not in ('row_index','record_data'))
      or jsonb_typeof(v_item->'record_data')<>'object' then raise exception using errcode='22023',message='oee_row_shape_invalid'; end if;
    v_data:=v_item->'record_data';
    v_row_index:=coalesce(nullif(v_item->>'row_index','')::integer,v_index);
    if v_data='{}'::jsonb then
      v_empty:=v_empty+1;v_results:=v_results||jsonb_build_array(jsonb_build_object('row_index',v_row_index,'status','empty'));continue;
    end if;
    if exists(select 1 from jsonb_object_keys(v_data) k where k not in ('production_date','machine','line','product_code','planned_hours','downtime_hours','ideal_rate','total_count','reject_count','include_in_overall')) then
      raise exception using errcode='22023',message='oee_unknown_or_derived_field'; end if;
    v_result:=private.tfi_create_oee_record(v_data);
    if v_result->>'status'='inserted' then
      v_inserted:=v_inserted+1;
      v_results:=v_results||jsonb_build_array(jsonb_build_object('row_index',v_row_index,'status','inserted','id',v_result->>'id'));
    else
      v_duplicates:=v_duplicates+1;
      v_results:=v_results||jsonb_build_array(jsonb_build_object('row_index',v_row_index,'status','duplicate'));
    end if;
  end loop;
  return jsonb_build_object('inserted',v_inserted,'duplicates',v_duplicates,'empty',v_empty,'results',v_results);
end;
$function$;
revoke all on function private.tfi_create_oee_records(jsonb) from public,anon;
grant execute on function private.tfi_create_oee_records(jsonb) to authenticated;
create or replace function public.tfi_create_oee_records(p_records jsonb)
returns jsonb language sql security invoker set search_path=''
as $function$ select private.tfi_create_oee_records(p_records); $function$;
revoke all on function public.tfi_create_oee_records(jsonb) from public,anon;
grant execute on function public.tfi_create_oee_records(jsonb) to authenticated;

create or replace function private.tfi_update_oee_record(
  p_record_id uuid,p_expected_version integer,p_changes jsonb,p_change_reason text default null
)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare
  v_user_id uuid:=auth.uid();v_context jsonb;v_row public.tfi_oee_records%rowtype;
  v_date date;v_machine text;v_line text;v_code text;v_planned numeric;v_down numeric;v_rate numeric;
  v_total bigint;v_reject bigint;v_flag text;v_validation jsonb;v_before jsonb;v_after jsonb;
  v_changed text[]:=array[]::text[];v_version integer;
begin
  if v_user_id is null or not private.tfi_has_permission('oee','view') or not private.tfi_has_permission('oee','edit') then
    raise exception using errcode='42501',message='oee_edit_permission_required'; end if;
  if p_expected_version is null or p_expected_version<1 or p_changes is null or jsonb_typeof(p_changes)<>'object' or p_changes='{}'::jsonb then
    raise exception using errcode='22023',message='oee_update_request_invalid'; end if;
  if exists(select 1 from jsonb_object_keys(p_changes) k where k not in ('production_date','machine','line','product_code','planned_hours','downtime_hours','ideal_rate','total_count','reject_count','include_in_overall')) then
    raise exception using errcode='22023',message='oee_unknown_or_derived_field'; end if;
  select * into v_row from public.tfi_oee_records where id=p_record_id and record_status='active' for update;
  if not found then raise exception using errcode='P0002',message='oee_record_not_found'; end if;
  if v_row.version<>p_expected_version then raise exception using errcode='40001',message='oee_version_conflict'; end if;
  begin
    v_date:=case when p_changes?'production_date' then nullif(btrim(p_changes->>'production_date'),'')::date else v_row.production_date end;
    v_machine:=case when p_changes?'machine' then nullif(btrim(p_changes->>'machine'),'') else v_row.machine end;
    v_line:=case when p_changes?'line' then nullif(btrim(p_changes->>'line'),'') else v_row.line end;
    v_code:=case when p_changes?'product_code' then nullif(btrim(p_changes->>'product_code'),'') else v_row.product_code end;
    v_planned:=case when p_changes?'planned_hours' then nullif(btrim(p_changes->>'planned_hours'),'')::numeric else v_row.planned_hours end;
    v_down:=case when p_changes?'downtime_hours' then nullif(btrim(p_changes->>'downtime_hours'),'')::numeric else v_row.downtime_hours end;
    v_rate:=case when p_changes?'ideal_rate' then nullif(btrim(p_changes->>'ideal_rate'),'')::numeric else v_row.ideal_rate end;
    v_total:=case when p_changes?'total_count' then nullif(btrim(p_changes->>'total_count'),'')::bigint else v_row.total_count end;
    v_reject:=case when p_changes?'reject_count' then nullif(btrim(p_changes->>'reject_count'),'')::bigint else v_row.reject_count end;
    v_flag:=case when p_changes?'include_in_overall' then upper(nullif(btrim(p_changes->>'include_in_overall'),'')) else v_row.include_in_overall end;
  exception when others then raise exception using errcode='22023',message='oee_invalid_field_value'; end;
  v_validation:=private.tfi_inspect_oee_import(jsonb_build_array(v_date::text,v_machine,v_line,v_code,v_planned::text,v_down::text,v_rate::text,v_total::text,v_reject::text,v_flag));
  if v_validation->>'status'<>'valid' then raise exception using errcode='22023',message='oee_invalid_field_value'; end if;
  v_before:=jsonb_build_object('production_date',v_row.production_date,'machine',v_row.machine,'line',v_row.line,'product_code',v_row.product_code,
    'planned_hours',v_row.planned_hours,'downtime_hours',v_row.downtime_hours,'ideal_rate',v_row.ideal_rate,'total_count',v_row.total_count,
    'reject_count',v_row.reject_count,'include_in_overall',v_row.include_in_overall,'version',v_row.version);
  v_after:=jsonb_build_object('production_date',v_date,'machine',v_machine,'line',v_line,'product_code',v_code,'planned_hours',v_planned,
    'downtime_hours',v_down,'ideal_rate',v_rate,'total_count',v_total,'reject_count',v_reject,'include_in_overall',v_flag,'version',v_row.version+1);
  if (v_before-'version')=(v_after-'version') then return jsonb_build_object('changed',false,'id',v_row.id,'version',v_row.version); end if;
  if v_date is distinct from v_row.production_date then v_changed:=array_append(v_changed,'production_date'); end if;
  if v_machine is distinct from v_row.machine then v_changed:=array_append(v_changed,'machine'); end if;
  if v_line is distinct from v_row.line then v_changed:=array_append(v_changed,'line'); end if;
  if v_code is distinct from v_row.product_code then v_changed:=array_append(v_changed,'product_code'); end if;
  if v_planned is distinct from v_row.planned_hours then v_changed:=array_append(v_changed,'planned_hours'); end if;
  if v_down is distinct from v_row.downtime_hours then v_changed:=array_append(v_changed,'downtime_hours'); end if;
  if v_rate is distinct from v_row.ideal_rate then v_changed:=array_append(v_changed,'ideal_rate'); end if;
  if v_total is distinct from v_row.total_count then v_changed:=array_append(v_changed,'total_count'); end if;
  if v_reject is distinct from v_row.reject_count then v_changed:=array_append(v_changed,'reject_count'); end if;
  if v_flag is distinct from v_row.include_in_overall then v_changed:=array_append(v_changed,'include_in_overall'); end if;
  v_version:=v_row.version+1;
  insert into public.tfi_oee_revisions(oee_record_id,version,before_data,after_data,changed_fields,change_reason,changed_by)
  values(v_row.id,v_version,v_before,v_after,v_changed,nullif(left(btrim(coalesce(p_change_reason,'')),500),''),v_user_id);
  begin
    update public.tfi_oee_records set production_date=v_date,machine=v_machine,line=v_line,product_code=v_code,
      planned_hours=v_planned,downtime_hours=v_down,ideal_rate=v_rate,total_count=v_total,reject_count=v_reject,
      include_in_overall=v_flag,version=v_version,updated_at=now(),updated_by=v_user_id where id=v_row.id;
  exception when unique_violation then raise exception using errcode='23505',message='oee_duplicate_record'; end;
  v_context:=private.tfi_get_my_access_context();
  select to_jsonb(v) into v_after from public.tfi_oee_record_view v where v.id=v_row.id;
  insert into public.tfi_audit_events(actor_user_id,actor_email_snapshot,actor_roles_snapshot,action_key,module_key,entity_type,entity_id,
    before_data,after_data,metadata,occurred_at)
  values(v_user_id,v_context #>> '{profile,email}',coalesce(v_context->'roles','[]'::jsonb),'oee.update','oee','oee_record',v_row.id::text,
    v_before,v_after,jsonb_build_object('changed_fields',to_jsonb(v_changed),'change_reason',nullif(left(btrim(coalesce(p_change_reason,'')),500),'')),now());
  return jsonb_build_object('changed',true,'id',v_row.id,'version',v_version);
end;
$function$;
revoke all on function private.tfi_update_oee_record(uuid,integer,jsonb,text) from public,anon;
grant execute on function private.tfi_update_oee_record(uuid,integer,jsonb,text) to authenticated;
create or replace function public.tfi_update_oee_record(p_record_id uuid,p_expected_version integer,p_changes jsonb,p_change_reason text default null)
returns jsonb language sql security invoker set search_path=''
as $function$ select private.tfi_update_oee_record(p_record_id,p_expected_version,p_changes,p_change_reason); $function$;
revoke all on function public.tfi_update_oee_record(uuid,integer,jsonb,text) from public,anon;
grant execute on function public.tfi_update_oee_record(uuid,integer,jsonb,text) to authenticated;
