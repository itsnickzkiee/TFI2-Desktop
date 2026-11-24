-- TFI2 NON-PROD operational backend
create table if not exists public.tfi_nonprod_records (
  id uuid primary key default gen_random_uuid(),
  work_date date,
  employee_name text,
  employee_position text,
  time_start time,
  time_end time,
  total_minutes integer,
  working_hours numeric(12,2) generated always as (
    case when total_minutes is null then null else round(total_minutes::numeric / 60, 2) end
  ) stored,
  activity text,
  location text,
  remarks text,
  version integer not null default 1 check (version > 0),
  record_status text not null default 'active' check (record_status in ('active','archived')),
  created_by uuid not null references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tfi_nonprod_date_after_2000 check (work_date is null or work_date > date '2000-01-01'),
  constraint tfi_nonprod_minutes_nonnegative check (total_minutes is null or total_minutes between 0 and 100000),
  constraint tfi_nonprod_name_length check (employee_name is null or length(employee_name)<=200),
  constraint tfi_nonprod_position_length check (employee_position is null or length(employee_position)<=100),
  constraint tfi_nonprod_activity_length check (activity is null or length(activity)<=300),
  constraint tfi_nonprod_location_length check (location is null or length(location)<=200),
  constraint tfi_nonprod_remarks_length check (remarks is null or length(remarks)<=2000)
);
create index if not exists tfi_nonprod_records_date_idx
  on public.tfi_nonprod_records(work_date desc,created_at desc) where record_status='active';
create index if not exists tfi_nonprod_records_employee_idx
  on public.tfi_nonprod_records(employee_name,work_date desc) where record_status='active';
alter table public.tfi_nonprod_records enable row level security;
revoke all on public.tfi_nonprod_records from public,anon,authenticated;
grant select on public.tfi_nonprod_records to authenticated;
create policy tfi_nonprod_records_authorized_read on public.tfi_nonprod_records
 for select to authenticated using ((select private.tfi_has_permission('nonprod','view')));

create table if not exists public.tfi_nonprod_revisions (
  id uuid primary key default gen_random_uuid(),
  nonprod_record_id uuid not null references public.tfi_nonprod_records(id) on delete restrict,
  version integer not null check (version>1),
  before_data jsonb not null check (jsonb_typeof(before_data)='object'),
  after_data jsonb not null check (jsonb_typeof(after_data)='object'),
  changed_fields text[] not null check (cardinality(changed_fields)>0),
  change_reason text check (change_reason is null or length(change_reason)<=500),
  changed_by uuid references auth.users(id),
  changed_at timestamptz not null default now(),
  unique(nonprod_record_id,version)
);
create index if not exists tfi_nonprod_revisions_record_order_idx
 on public.tfi_nonprod_revisions(nonprod_record_id,version desc);
alter table public.tfi_nonprod_revisions enable row level security;
revoke all on public.tfi_nonprod_revisions from public,anon,authenticated;
grant select on public.tfi_nonprod_revisions to authenticated;
create policy tfi_nonprod_revisions_authorized_read on public.tfi_nonprod_revisions
 for select to authenticated using (exists(
  select 1 from public.tfi_nonprod_records r
  where r.id=nonprod_record_id and private.tfi_has_permission('nonprod','view')
 ));

create or replace function private.tfi_get_nonprod_catalog()
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare v_names jsonb; v_positions jsonb; v_activities jsonb; v_locations jsonb;
begin
 if auth.uid() is null or not private.tfi_has_permission('nonprod','view') then
  raise exception using errcode='42501',message='nonprod_view_permission_required';
 end if;
 select coalesce(jsonb_agg(to_jsonb(v) order by source_row_number),'[]'::jsonb) into v_names
 from (select source_row_number,current_values->>0 as value from public.tfi_master_data_rows
  where category_key='manpower' and row_kind='data' and record_status='active'
   and nullif(current_values->>0,'') is not null and source_row_number between 4 and 500) v;
 select coalesce(jsonb_agg(value order by first_row),'[]'::jsonb) into v_positions
 from (select btrim(current_values->>1) value,min(source_row_number) first_row
  from public.tfi_master_data_rows where category_key='manpower' and row_kind='data'
   and record_status='active' and source_row_number between 4 and 16
   and nullif(btrim(current_values->>1),'') is not null group by btrim(current_values->>1)) v;
 select coalesce(jsonb_agg(value order by first_row),'[]'::jsonb) into v_activities
 from (select btrim(current_values->>2) value,min(source_row_number) first_row
  from public.tfi_master_data_rows where category_key='manpower' and row_kind='data'
   and record_status='active' and source_row_number between 4 and 60
   and nullif(btrim(current_values->>2),'') is not null group by btrim(current_values->>2)) v;
 select coalesce(jsonb_agg(value order by first_row),'[]'::jsonb) into v_locations
 from (select btrim(current_values->>3) value,min(source_row_number) first_row
  from public.tfi_master_data_rows where category_key='manpower' and row_kind='data'
   and record_status='active' and source_row_number between 4 and 39
   and nullif(btrim(current_values->>3),'') is not null group by btrim(current_values->>3)) v;
 return jsonb_build_object('source',jsonb_build_object('workbook_id','1rCbQ16wj7MRjQCFF3tA-WEMkudraJK0RkwcqayUlz7k',
  'sheet_name','NON-PROD','sheet_id',1381857831,'header_rows',jsonb_build_array(1,2),'first_data_row',3,
  'input_columns',jsonb_build_array('DATE','Name','Position','Time Start','Time End','Total of minutes','Activities','Location','Remarks'),
  'formula_columns',jsonb_build_array('No. of Working Hours'),'working_hours_formula','Total of minutes / 60'),
  'names',v_names,'positions',v_positions,'activities',v_activities,'locations',v_locations);
end;
$function$;
revoke all on function private.tfi_get_nonprod_catalog() from public,anon;
grant execute on function private.tfi_get_nonprod_catalog() to authenticated;
create or replace function public.tfi_get_nonprod_catalog()
returns jsonb language sql security invoker set search_path=''
as $function$ select private.tfi_get_nonprod_catalog(); $function$;
revoke all on function public.tfi_get_nonprod_catalog() from public,anon;
grant execute on function public.tfi_get_nonprod_catalog() to authenticated;

create or replace function private.tfi_get_nonprod_records(
 p_date_from date default null,p_date_to date default null,p_employee_name text default null,
 p_search text default null,p_page integer default 1,p_page_size integer default 100)
returns jsonb language plpgsql security invoker set search_path=''
as $function$
declare v_result jsonb;
begin
 if auth.uid() is null or not private.tfi_has_permission('nonprod','view') then
  raise exception using errcode='42501',message='nonprod_view_permission_required';
 end if;
 if p_page<1 or p_page_size<1 or p_page_size>100 then raise exception using errcode='22023',message='nonprod_pagination_invalid'; end if;
 if p_date_from is not null and p_date_to is not null and p_date_from>p_date_to then raise exception using errcode='22023',message='nonprod_date_range_invalid'; end if;
 with filtered as (
  select * from public.tfi_nonprod_records r where r.record_status='active'
   and (p_date_from is null or r.work_date>=p_date_from) and (p_date_to is null or r.work_date<=p_date_to)
   and (nullif(btrim(coalesce(p_employee_name,'')),'') is null or r.employee_name=p_employee_name)
   and (nullif(btrim(coalesce(p_search,'')),'') is null or concat_ws(' ',r.employee_name,r.employee_position,r.activity,r.location,r.remarks) ilike '%'||btrim(p_search)||'%')
 ), summary as (select count(*)::integer total_count,coalesce(sum(total_minutes),0)::bigint total_minutes,
  coalesce(sum(working_hours),0)::numeric(14,2) total_working_hours from filtered),
 page_rows as (select * from filtered order by work_date desc nulls last,created_at desc,id limit p_page_size offset (p_page-1)*p_page_size)
 select jsonb_build_object('records',coalesce((select jsonb_agg(to_jsonb(x) order by x.work_date desc nulls last,x.created_at desc,x.id) from page_rows x),'[]'::jsonb),
  'page',p_page,'page_size',p_page_size,'total_count',(select total_count from summary),
  'has_more',(select total_count from summary)>p_page*p_page_size,'summary',(select to_jsonb(summary) from summary)) into v_result;
 return v_result;
end;
$function$;
revoke all on function private.tfi_get_nonprod_records(date,date,text,text,integer,integer) from public,anon;
grant execute on function private.tfi_get_nonprod_records(date,date,text,text,integer,integer) to authenticated;
create or replace function public.tfi_get_nonprod_records(
 p_date_from date default null,p_date_to date default null,p_employee_name text default null,
 p_search text default null,p_page integer default 1,p_page_size integer default 100)
returns jsonb language sql security invoker set search_path=''
as $function$ select private.tfi_get_nonprod_records(p_date_from,p_date_to,p_employee_name,p_search,p_page,p_page_size); $function$;
revoke all on function public.tfi_get_nonprod_records(date,date,text,text,integer,integer) from public,anon;
grant execute on function public.tfi_get_nonprod_records(date,date,text,text,integer,integer) to authenticated;

create or replace function private.tfi_create_nonprod_records(p_records jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare v_user uuid:=auth.uid(); v_item jsonb; v_data jsonb; v_idx integer; v_id uuid; v_inserted integer:=0; v_results jsonb:='[]'::jsonb;
 v_date date; v_name text; v_position text; v_start time; v_end time; v_minutes integer; v_activity text; v_location text; v_remarks text;
begin
 if v_user is null or not private.tfi_has_permission('nonprod','create') then raise exception using errcode='42501',message='nonprod_create_permission_required'; end if;
 if p_records is null or jsonb_typeof(p_records)<>'array' or jsonb_array_length(p_records)<1 or jsonb_array_length(p_records)>100 then
  raise exception using errcode='22023',message='nonprod_rows_required'; end if;
 for v_item,v_idx in select value,ordinality::integer from jsonb_array_elements(p_records) with ordinality loop
  if jsonb_typeof(v_item)<>'object' or exists(select 1 from jsonb_object_keys(v_item) k where k not in ('row_index','record_data'))
   or jsonb_typeof(v_item->'record_data')<>'object' then raise exception using errcode='22023',message='nonprod_row_shape_invalid'; end if;
  v_data:=v_item->'record_data';
  if exists(select 1 from jsonb_object_keys(v_data) k where k not in ('work_date','employee_name','employee_position','time_start','time_end','total_minutes','activity','location','remarks')) then
   raise exception using errcode='22023',message='nonprod_derived_or_unknown_field'; end if;
  begin
   v_date:=nullif(btrim(v_data->>'work_date'),'')::date; v_name:=nullif(btrim(v_data->>'employee_name'),'');
   v_position:=nullif(btrim(v_data->>'employee_position'),''); v_start:=nullif(btrim(v_data->>'time_start'),'')::time;
   v_end:=nullif(btrim(v_data->>'time_end'),'')::time; v_minutes:=nullif(btrim(v_data->>'total_minutes'),'')::integer;
   v_activity:=nullif(btrim(v_data->>'activity'),''); v_location:=nullif(btrim(v_data->>'location'),''); v_remarks:=nullif(btrim(v_data->>'remarks'),'');
  exception when others then raise exception using errcode='22023',message='nonprod_invalid_field_value'; end;
  if v_date is null and v_name is null and v_position is null and v_start is null and v_end is null and v_minutes is null and v_activity is null and v_location is null and v_remarks is null then
   v_results:=v_results||jsonb_build_array(jsonb_build_object('row_index',coalesce(nullif(v_item->>'row_index','')::integer,v_idx),'status','empty')); continue;
  end if;
  if v_date is not null and v_date<=date '2000-01-01' then raise exception using errcode='22023',message='nonprod_date_out_of_range'; end if;
  if v_minutes is not null and v_minutes not between 0 and 100000 then raise exception using errcode='22023',message='nonprod_minutes_invalid'; end if;
  if length(v_name)>200 or length(v_position)>100 or length(v_activity)>300 or length(v_location)>200 or length(v_remarks)>2000 then raise exception using errcode='22023',message='nonprod_text_too_long'; end if;
  insert into public.tfi_nonprod_records(work_date,employee_name,employee_position,time_start,time_end,total_minutes,activity,location,remarks,created_by)
  values(v_date,v_name,v_position,v_start,v_end,v_minutes,v_activity,v_location,v_remarks,v_user) returning id into v_id;
  v_inserted:=v_inserted+1;
  v_results:=v_results||jsonb_build_array(jsonb_build_object('row_index',coalesce(nullif(v_item->>'row_index','')::integer,v_idx),'status','inserted','id',v_id));
 end loop;
 return jsonb_build_object('inserted',v_inserted,'results',v_results);
end;
$function$;
revoke all on function private.tfi_create_nonprod_records(jsonb) from public,anon;
grant execute on function private.tfi_create_nonprod_records(jsonb) to authenticated;
create or replace function public.tfi_create_nonprod_records(p_records jsonb)
returns jsonb language sql security invoker set search_path=''
as $function$ select private.tfi_create_nonprod_records(p_records); $function$;
revoke all on function public.tfi_create_nonprod_records(jsonb) from public,anon;
grant execute on function public.tfi_create_nonprod_records(jsonb) to authenticated;

create or replace function private.tfi_update_nonprod_record(
 p_record_id uuid,p_expected_version integer,p_changes jsonb,p_change_reason text default null)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare v_user uuid:=auth.uid(); v_row public.tfi_nonprod_records%rowtype; v_before jsonb; v_after jsonb; v_changed text[]; v_new_version integer;
begin
 if v_user is null or not private.tfi_has_permission('nonprod','edit') then raise exception using errcode='42501',message='nonprod_edit_permission_required'; end if;
 if p_expected_version is null or p_expected_version<1 or jsonb_typeof(p_changes)<>'object' or p_changes='{}'::jsonb then raise exception using errcode='22023',message='nonprod_changes_required'; end if;
 if exists(select 1 from jsonb_object_keys(p_changes) k where k not in ('work_date','employee_name','employee_position','time_start','time_end','total_minutes','activity','location','remarks')) then
  raise exception using errcode='22023',message='nonprod_derived_or_unknown_field'; end if;
 if p_change_reason is not null and length(p_change_reason)>500 then raise exception using errcode='22023',message='nonprod_change_reason_invalid'; end if;
 select * into v_row from public.tfi_nonprod_records where id=p_record_id and record_status='active' for update;
 if not found then raise exception using errcode='P0002',message='nonprod_record_not_found'; end if;
 if v_row.version<>p_expected_version then raise exception using errcode='40001',message='nonprod_version_conflict'; end if;
 v_before:=jsonb_build_object('work_date',v_row.work_date,'employee_name',v_row.employee_name,'employee_position',v_row.employee_position,
  'time_start',v_row.time_start,'time_end',v_row.time_end,'total_minutes',v_row.total_minutes,'working_hours',v_row.working_hours,
  'activity',v_row.activity,'location',v_row.location,'remarks',v_row.remarks);
 update public.tfi_nonprod_records set
  work_date=case when p_changes?'work_date' then nullif(btrim(p_changes->>'work_date'),'')::date else work_date end,
  employee_name=case when p_changes?'employee_name' then nullif(btrim(p_changes->>'employee_name'),'') else employee_name end,
  employee_position=case when p_changes?'employee_position' then nullif(btrim(p_changes->>'employee_position'),'') else employee_position end,
  time_start=case when p_changes?'time_start' then nullif(btrim(p_changes->>'time_start'),'')::time else time_start end,
  time_end=case when p_changes?'time_end' then nullif(btrim(p_changes->>'time_end'),'')::time else time_end end,
  total_minutes=case when p_changes?'total_minutes' then nullif(btrim(p_changes->>'total_minutes'),'')::integer else total_minutes end,
  activity=case when p_changes?'activity' then nullif(btrim(p_changes->>'activity'),'') else activity end,
  location=case when p_changes?'location' then nullif(btrim(p_changes->>'location'),'') else location end,
  remarks=case when p_changes?'remarks' then nullif(btrim(p_changes->>'remarks'),'') else remarks end,
  version=version+1,updated_by=v_user,updated_at=now()
 where id=p_record_id returning * into v_row;
 v_after:=jsonb_build_object('work_date',v_row.work_date,'employee_name',v_row.employee_name,'employee_position',v_row.employee_position,
  'time_start',v_row.time_start,'time_end',v_row.time_end,'total_minutes',v_row.total_minutes,'working_hours',v_row.working_hours,
  'activity',v_row.activity,'location',v_row.location,'remarks',v_row.remarks);
 select array_agg(key order by key) into v_changed from jsonb_each(v_before) b join jsonb_each(v_after) a using(key) where b.value is distinct from a.value;
 if coalesce(cardinality(v_changed),0)>0 then
  insert into public.tfi_nonprod_revisions(nonprod_record_id,version,before_data,after_data,changed_fields,change_reason,changed_by)
  values(p_record_id,v_row.version,v_before,v_after,v_changed,p_change_reason,v_user);
 end if;
 return jsonb_build_object('id',p_record_id,'version',v_row.version,'changed_fields',coalesce(to_jsonb(v_changed),'[]'::jsonb));
end;
$function$;
revoke all on function private.tfi_update_nonprod_record(uuid,integer,jsonb,text) from public,anon;
grant execute on function private.tfi_update_nonprod_record(uuid,integer,jsonb,text) to authenticated;
create or replace function public.tfi_update_nonprod_record(p_record_id uuid,p_expected_version integer,p_changes jsonb,p_change_reason text default null)
returns jsonb language sql security invoker set search_path=''
as $function$ select private.tfi_update_nonprod_record(p_record_id,p_expected_version,p_changes,p_change_reason); $function$;
revoke all on function public.tfi_update_nonprod_record(uuid,integer,jsonb,text) from public,anon;
grant execute on function public.tfi_update_nonprod_record(uuid,integer,jsonb,text) to authenticated;

grant execute on function public.tfi_get_nonprod_catalog() to authenticated;
grant execute on function public.tfi_get_nonprod_records(date,date,text,text,integer,integer) to authenticated;
grant execute on function public.tfi_create_nonprod_records(jsonb) to authenticated;
grant execute on function public.tfi_update_nonprod_record(uuid,integer,jsonb,text) to authenticated;
