-- TFI2 Phase 5 — DMP Production operational backend.
-- Additive only. No historical workbook rows are imported or changed.

begin;

create table public.tfi_dmp_production_records (
  id uuid primary key default gen_random_uuid(),
  production_date date,
  product_code text check (product_code is null or length(product_code) <= 100),
  process text check (process is null or length(process) <= 300),
  worker_name text check (worker_name is null or length(worker_name) <= 200),
  worker_position text check (worker_position is null or length(worker_position) <= 120),
  worker_reference_row_id uuid references public.tfi_master_data_rows(id) on delete restrict,
  worker_count numeric(14,3) check (worker_count is null or worker_count >= 0),
  start_time time without time zone,
  end_time time without time zone,
  total_time_hours numeric(14,4) check (total_time_hours is null or total_time_hours >= 0),
  record_fingerprint text not null check (record_fingerprint ~ '^[0-9a-f]{64}$'),
  completeness_status text not null default 'unassessed'
    check (completeness_status in ('complete','incomplete','unassessed')),
  blank_fields text[] not null default '{}',
  record_status text not null default 'active' check (record_status in ('active','archived')),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  archived_at timestamptz,
  archived_by uuid references auth.users(id) on delete set null,
  constraint tfi_dmp_production_archive_state check (
    (record_status = 'archived' and archived_at is not null)
    or (record_status <> 'archived' and archived_at is null)
  ),
  constraint tfi_dmp_production_record_fingerprint_key unique (record_fingerprint)
);

create index tfi_dmp_production_date_idx
  on public.tfi_dmp_production_records (production_date desc nulls last, created_at desc);
create index tfi_dmp_production_product_code_idx
  on public.tfi_dmp_production_records (product_code);
create index tfi_dmp_production_process_idx
  on public.tfi_dmp_production_records (process);
create index tfi_dmp_production_worker_name_idx
  on public.tfi_dmp_production_records (worker_name);
create index tfi_dmp_production_worker_reference_idx
  on public.tfi_dmp_production_records (worker_reference_row_id);
create index tfi_dmp_production_created_by_idx
  on public.tfi_dmp_production_records (created_by);
create index tfi_dmp_production_updated_by_idx
  on public.tfi_dmp_production_records (updated_by);

create table public.tfi_dmp_production_revisions (
  id uuid primary key default gen_random_uuid(),
  dmp_production_record_id uuid not null references public.tfi_dmp_production_records(id) on delete restrict,
  version integer not null check (version > 1),
  before_data jsonb not null check (jsonb_typeof(before_data) = 'object'),
  after_data jsonb not null check (jsonb_typeof(after_data) = 'object'),
  changed_fields text[] not null check (cardinality(changed_fields) > 0),
  change_reason text check (change_reason is null or length(change_reason) <= 500),
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now(),
  unique (dmp_production_record_id, version)
);
create index tfi_dmp_production_revisions_row_order_idx
  on public.tfi_dmp_production_revisions (dmp_production_record_id, version desc);
create index tfi_dmp_production_revisions_changed_by_idx
  on public.tfi_dmp_production_revisions (changed_by);

comment on table public.tfi_dmp_production_records is
  'New DMP Production entries created in TFI2. Incomplete rows are accepted; Position is a server-derived DMP LEGEND snapshot. No hard-delete path.';
comment on table public.tfi_dmp_production_revisions is
  'Append-only before/after history for DMP Production edits.';

alter table public.tfi_dmp_production_records enable row level security;
alter table public.tfi_dmp_production_revisions enable row level security;

create policy tfi_dmp_production_records_authorized_read
on public.tfi_dmp_production_records for select to authenticated
using (private.tfi_has_permission('dmp_production','view'));
create policy tfi_dmp_production_revisions_authorized_read
on public.tfi_dmp_production_revisions for select to authenticated
using (private.tfi_has_permission('dmp_production','view'));

revoke all on public.tfi_dmp_production_records, public.tfi_dmp_production_revisions
from public, anon, authenticated;
grant select on public.tfi_dmp_production_records, public.tfi_dmp_production_revisions
to authenticated;

create or replace function private.tfi_dmp_record_fingerprint(
  p_production_date date, p_product_code text, p_process text, p_worker_name text,
  p_worker_count numeric, p_start_time time, p_end_time time, p_total_time_hours numeric
) returns text
language sql immutable security invoker set search_path to ''
as $function$
  select encode(extensions.digest(convert_to(jsonb_build_array(
    p_production_date::text, nullif(btrim(p_product_code),''), nullif(btrim(p_process),''),
    nullif(btrim(p_worker_name),''), trim_scale(p_worker_count)::text,
    p_start_time::text, p_end_time::text, trim_scale(p_total_time_hours)::text
  )::text,'UTF8'),'sha256'),'hex');
$function$;
revoke all on function private.tfi_dmp_record_fingerprint(date,text,text,text,numeric,time,time,numeric)
from public, anon, authenticated;

create or replace function private.tfi_create_dmp_production_records(p_records jsonb)
returns jsonb language plpgsql security definer set search_path to ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_context jsonb;
  v_item jsonb;
  v_index integer;
  v_date date;
  v_product_code text;
  v_process text;
  v_worker_name text;
  v_worker_position text;
  v_worker_reference_row_id uuid;
  v_worker_count numeric;
  v_start_time time;
  v_end_time time;
  v_total_time_hours numeric;
  v_fingerprint text;
  v_id uuid;
  v_results jsonb := '[]'::jsonb;
  v_inserted integer := 0;
  v_duplicates integer := 0;
  v_empty integer := 0;
  v_blank_fields text[];
  v_after jsonb;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;
  if not private.tfi_has_permission('dmp_production','view')
     or not private.tfi_has_permission('dmp_production','create') then
    raise exception using errcode = '42501', message = 'dmp_production_create_permission_required';
  end if;
  if p_records is null or jsonb_typeof(p_records) <> 'array'
     or jsonb_array_length(p_records) < 1 or jsonb_array_length(p_records) > 12 then
    raise exception using errcode = '22023', message = 'dmp_production_rows_required';
  end if;
  v_context := private.tfi_get_my_access_context();

  for v_item, v_index in
    select value, ordinality::integer from jsonb_array_elements(p_records) with ordinality
  loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception using errcode = '22023', message = 'dmp_production_row_must_be_object';
    end if;
    if exists (
      select 1 from jsonb_object_keys(v_item) as keys(key)
      where key not in ('production_date','product_code','process','worker_name','worker_count','start_time','end_time','total_time_hours')
    ) then
      raise exception using errcode = '22023', message = 'dmp_production_unknown_or_derived_field';
    end if;

    begin
      v_date := nullif(btrim(v_item->>'production_date'),'')::date;
      v_product_code := nullif(btrim(v_item->>'product_code'),'');
      v_process := nullif(btrim(v_item->>'process'),'');
      v_worker_name := nullif(btrim(v_item->>'worker_name'),'');
      v_worker_count := nullif(btrim(v_item->>'worker_count'),'')::numeric;
      v_start_time := nullif(btrim(v_item->>'start_time'),'')::time;
      v_end_time := nullif(btrim(v_item->>'end_time'),'')::time;
      v_total_time_hours := nullif(btrim(v_item->>'total_time_hours'),'')::numeric;
    exception when others then
      raise exception using errcode = '22023', message = 'dmp_production_invalid_field_value';
    end;

    if v_product_code is not null and length(v_product_code) > 100
       or v_process is not null and length(v_process) > 300
       or v_worker_name is not null and length(v_worker_name) > 200 then
      raise exception using errcode = '22023', message = 'dmp_production_text_value_too_long';
    end if;
    if v_worker_count < 0 or v_total_time_hours < 0 then
      raise exception using errcode = '22023', message = 'dmp_production_numeric_values_must_be_nonnegative';
    end if;

    if v_date is null and v_product_code is null and v_process is null and v_worker_name is null
       and v_worker_count is null and v_start_time is null and v_end_time is null and v_total_time_hours is null then
      v_empty := v_empty + 1;
      v_results := v_results || jsonb_build_array(jsonb_build_object('row_index',v_index,'status','empty'));
      continue;
    end if;

    if v_process is not null and not exists (
      select 1 from public.tfi_master_data_rows md
      where md.category_key='dmp_legend' and md.row_kind='data' and md.record_status='active'
        and nullif(btrim(md.current_values->>2),'') = v_process
    ) then
      raise exception using errcode = '22023', message = 'dmp_production_process_not_in_master_data';
    end if;

    v_worker_position := null;
    v_worker_reference_row_id := null;
    if v_worker_name is not null then
      select nullif(btrim(md.current_values->>1),''), md.id
      into v_worker_position, v_worker_reference_row_id
      from public.tfi_master_data_rows md
      where md.category_key='dmp_legend' and md.row_kind='data' and md.record_status='active'
        and nullif(btrim(md.current_values->>0),'') = v_worker_name
      order by md.source_row_number
      limit 1;
      if not found then
        raise exception using errcode = '22023', message = 'dmp_production_worker_not_in_master_data';
      end if;
    end if;

    v_fingerprint := private.tfi_dmp_record_fingerprint(
      v_date,v_product_code,v_process,v_worker_name,v_worker_count,v_start_time,v_end_time,v_total_time_hours
    );
    v_blank_fields := array_remove(array[
      case when v_date is null then 'production_date' end,
      case when v_product_code is null then 'product_code' end,
      case when v_process is null then 'process' end,
      case when v_worker_name is null then 'worker_name' end,
      case when v_worker_count is null then 'worker_count' end,
      case when v_start_time is null then 'start_time' end,
      case when v_end_time is null then 'end_time' end,
      case when v_total_time_hours is null then 'total_time_hours' end
    ],null);

    v_id := null;
    insert into public.tfi_dmp_production_records (
      production_date,product_code,process,worker_name,worker_position,worker_reference_row_id,
      worker_count,start_time,end_time,total_time_hours,record_fingerprint,blank_fields,created_by,updated_by
    ) values (
      v_date,v_product_code,v_process,v_worker_name,v_worker_position,v_worker_reference_row_id,
      v_worker_count,v_start_time,v_end_time,v_total_time_hours,v_fingerprint,v_blank_fields,v_user_id,v_user_id
    ) on conflict (record_fingerprint) do nothing returning id into v_id;

    if v_id is null then
      v_duplicates := v_duplicates + 1;
      v_results := v_results || jsonb_build_array(jsonb_build_object('row_index',v_index,'status','duplicate'));
      continue;
    end if;

    v_after := jsonb_build_object(
      'production_date',v_date,'product_code',v_product_code,'process',v_process,
      'worker_name',v_worker_name,'worker_position',v_worker_position,
      'worker_count',v_worker_count,'start_time',v_start_time,'end_time',v_end_time,
      'total_time_hours',v_total_time_hours,'completeness_status','unassessed','blank_fields',v_blank_fields
    );
    insert into public.tfi_audit_events (
      actor_user_id,actor_email_snapshot,actor_roles_snapshot,action_key,module_key,
      entity_type,entity_id,before_data,after_data,metadata,occurred_at
    ) values (
      v_user_id,v_context #>> '{profile,email}',coalesce(v_context->'roles','[]'::jsonb),
      'dmp_production.create','dmp_production','dmp_production_record',v_id::text,
      null,v_after,jsonb_build_object('entry_source','manual','row_index',v_index),now()
    );
    v_inserted := v_inserted + 1;
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'row_index',v_index,'status','inserted','id',v_id,'worker_position',v_worker_position,
      'blank_fields',to_jsonb(v_blank_fields),'completeness_status','unassessed'
    ));
  end loop;

  return jsonb_build_object(
    'inserted',v_inserted,'duplicates',v_duplicates,'empty',v_empty,'results',v_results
  );
end;
$function$;

revoke all on function private.tfi_create_dmp_production_records(jsonb) from public,anon,authenticated;
grant execute on function private.tfi_create_dmp_production_records(jsonb) to authenticated;

create or replace function public.tfi_create_dmp_production_records(p_records jsonb)
returns jsonb language sql security invoker set search_path to ''
as $function$ select private.tfi_create_dmp_production_records($1); $function$;
revoke all on function public.tfi_create_dmp_production_records(jsonb) from public,anon,authenticated;
grant execute on function public.tfi_create_dmp_production_records(jsonb) to authenticated;

create or replace function private.tfi_update_dmp_production_record(
  p_record_id uuid, p_expected_version integer, p_changes jsonb, p_change_reason text default null
) returns jsonb language plpgsql security definer set search_path to ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_context jsonb;
  v_row public.tfi_dmp_production_records%rowtype;
  v_date date;
  v_product_code text;
  v_process text;
  v_worker_name text;
  v_worker_position text;
  v_worker_reference_row_id uuid;
  v_worker_count numeric;
  v_start_time time;
  v_end_time time;
  v_total_time_hours numeric;
  v_fingerprint text;
  v_blank_fields text[];
  v_before jsonb;
  v_after jsonb;
  v_changed_fields text[] := array[]::text[];
  v_next_version integer;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;
  if not private.tfi_has_permission('dmp_production','view')
     or not private.tfi_has_permission('dmp_production','edit') then
    raise exception using errcode = '42501', message = 'dmp_production_edit_permission_required';
  end if;
  if p_expected_version is null or p_expected_version < 1
     or p_changes is null or jsonb_typeof(p_changes) <> 'object' or p_changes = '{}'::jsonb then
    raise exception using errcode = '22023', message = 'dmp_production_update_request_invalid';
  end if;
  if exists (
    select 1 from jsonb_object_keys(p_changes) as keys(key)
    where key not in ('production_date','product_code','process','worker_name','worker_count','start_time','end_time','total_time_hours')
  ) then
    raise exception using errcode = '22023', message = 'dmp_production_unknown_or_derived_field';
  end if;

  select * into v_row from public.tfi_dmp_production_records
  where id=p_record_id and record_status='active' for update;
  if not found then raise exception using errcode = 'P0002', message = 'dmp_production_record_not_found'; end if;
  if v_row.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'dmp_production_version_conflict';
  end if;

  begin
    v_date := case when p_changes ? 'production_date' then nullif(btrim(p_changes->>'production_date'),'')::date else v_row.production_date end;
    v_product_code := case when p_changes ? 'product_code' then nullif(btrim(p_changes->>'product_code'),'') else v_row.product_code end;
    v_process := case when p_changes ? 'process' then nullif(btrim(p_changes->>'process'),'') else v_row.process end;
    v_worker_name := case when p_changes ? 'worker_name' then nullif(btrim(p_changes->>'worker_name'),'') else v_row.worker_name end;
    v_worker_count := case when p_changes ? 'worker_count' then nullif(btrim(p_changes->>'worker_count'),'')::numeric else v_row.worker_count end;
    v_start_time := case when p_changes ? 'start_time' then nullif(btrim(p_changes->>'start_time'),'')::time else v_row.start_time end;
    v_end_time := case when p_changes ? 'end_time' then nullif(btrim(p_changes->>'end_time'),'')::time else v_row.end_time end;
    v_total_time_hours := case when p_changes ? 'total_time_hours' then nullif(btrim(p_changes->>'total_time_hours'),'')::numeric else v_row.total_time_hours end;
  exception when others then
    raise exception using errcode = '22023', message = 'dmp_production_invalid_field_value';
  end;
  if v_product_code is not null and length(v_product_code) > 100
     or v_process is not null and length(v_process) > 300
     or v_worker_name is not null and length(v_worker_name) > 200 then
    raise exception using errcode = '22023', message = 'dmp_production_text_value_too_long';
  end if;
  if v_worker_count < 0 or v_total_time_hours < 0 then
    raise exception using errcode = '22023', message = 'dmp_production_numeric_values_must_be_nonnegative';
  end if;
  if v_process is not null and not exists (
    select 1 from public.tfi_master_data_rows md
    where md.category_key='dmp_legend' and md.row_kind='data' and md.record_status='active'
      and nullif(btrim(md.current_values->>2),'') = v_process
  ) then raise exception using errcode = '22023', message = 'dmp_production_process_not_in_master_data'; end if;

  v_worker_position := null;
  v_worker_reference_row_id := null;
  if v_worker_name is not null then
    select nullif(btrim(md.current_values->>1),''), md.id
    into v_worker_position, v_worker_reference_row_id
    from public.tfi_master_data_rows md
    where md.category_key='dmp_legend' and md.row_kind='data' and md.record_status='active'
      and nullif(btrim(md.current_values->>0),'') = v_worker_name
    order by md.source_row_number limit 1;
    if not found then raise exception using errcode = '22023', message = 'dmp_production_worker_not_in_master_data'; end if;
  end if;

  v_fingerprint := private.tfi_dmp_record_fingerprint(
    v_date,v_product_code,v_process,v_worker_name,v_worker_count,v_start_time,v_end_time,v_total_time_hours
  );
  if exists (select 1 from public.tfi_dmp_production_records r where r.record_fingerprint=v_fingerprint and r.id<>v_row.id) then
    raise exception using errcode = '23505', message = 'dmp_production_duplicate_record';
  end if;
  v_blank_fields := array_remove(array[
    case when v_date is null then 'production_date' end,
    case when v_product_code is null then 'product_code' end,
    case when v_process is null then 'process' end,
    case when v_worker_name is null then 'worker_name' end,
    case when v_worker_count is null then 'worker_count' end,
    case when v_start_time is null then 'start_time' end,
    case when v_end_time is null then 'end_time' end,
    case when v_total_time_hours is null then 'total_time_hours' end
  ],null);

  v_before := jsonb_build_object(
    'production_date',v_row.production_date,'product_code',v_row.product_code,'process',v_row.process,
    'worker_name',v_row.worker_name,'worker_position',v_row.worker_position,'worker_count',v_row.worker_count,
    'start_time',v_row.start_time,'end_time',v_row.end_time,'total_time_hours',v_row.total_time_hours,
    'version',v_row.version,'blank_fields',to_jsonb(v_row.blank_fields)
  );
  v_after := jsonb_build_object(
    'production_date',v_date,'product_code',v_product_code,'process',v_process,
    'worker_name',v_worker_name,'worker_position',v_worker_position,'worker_count',v_worker_count,
    'start_time',v_start_time,'end_time',v_end_time,'total_time_hours',v_total_time_hours,
    'version',v_row.version+1,'blank_fields',to_jsonb(v_blank_fields)
  );
  if v_before - 'version' - 'blank_fields' = v_after - 'version' - 'blank_fields' then
    return jsonb_build_object('changed',false,'id',v_row.id,'version',v_row.version);
  end if;
  if p_changes ? 'production_date' and v_date is distinct from v_row.production_date then v_changed_fields := array_append(v_changed_fields,'production_date'); end if;
  if p_changes ? 'product_code' and v_product_code is distinct from v_row.product_code then v_changed_fields := array_append(v_changed_fields,'product_code'); end if;
  if p_changes ? 'process' and v_process is distinct from v_row.process then v_changed_fields := array_append(v_changed_fields,'process'); end if;
  if p_changes ? 'worker_name' and v_worker_name is distinct from v_row.worker_name then v_changed_fields := array_append(v_changed_fields,'worker_name'); end if;
  if p_changes ? 'worker_count' and v_worker_count is distinct from v_row.worker_count then v_changed_fields := array_append(v_changed_fields,'worker_count'); end if;
  if p_changes ? 'start_time' and v_start_time is distinct from v_row.start_time then v_changed_fields := array_append(v_changed_fields,'start_time'); end if;
  if p_changes ? 'end_time' and v_end_time is distinct from v_row.end_time then v_changed_fields := array_append(v_changed_fields,'end_time'); end if;
  if p_changes ? 'total_time_hours' and v_total_time_hours is distinct from v_row.total_time_hours then v_changed_fields := array_append(v_changed_fields,'total_time_hours'); end if;
  if v_worker_position is distinct from v_row.worker_position then v_changed_fields := array_append(v_changed_fields,'worker_position'); end if;

  v_next_version := v_row.version + 1;
  insert into public.tfi_dmp_production_revisions (
    dmp_production_record_id,version,before_data,after_data,changed_fields,change_reason,changed_by
  ) values (
    v_row.id,v_next_version,v_before,v_after,v_changed_fields,
    nullif(left(btrim(coalesce(p_change_reason,'')),500),''),v_user_id
  );
  update public.tfi_dmp_production_records
  set production_date=v_date,product_code=v_product_code,process=v_process,worker_name=v_worker_name,
      worker_position=v_worker_position,worker_reference_row_id=v_worker_reference_row_id,
      worker_count=v_worker_count,start_time=v_start_time,end_time=v_end_time,total_time_hours=v_total_time_hours,
      record_fingerprint=v_fingerprint,blank_fields=v_blank_fields,version=v_next_version,
      updated_at=now(),updated_by=v_user_id
  where id=v_row.id;

  v_context := private.tfi_get_my_access_context();
  insert into public.tfi_audit_events (
    actor_user_id,actor_email_snapshot,actor_roles_snapshot,action_key,module_key,
    entity_type,entity_id,before_data,after_data,metadata,occurred_at
  ) values (
    v_user_id,v_context #>> '{profile,email}',coalesce(v_context->'roles','[]'::jsonb),
    'dmp_production.update','dmp_production','dmp_production_record',v_row.id::text,
    v_before,v_after,jsonb_build_object('changed_fields',to_jsonb(v_changed_fields),
      'change_reason',nullif(left(btrim(coalesce(p_change_reason,'')),500),'')),now()
  );
  return jsonb_build_object('changed',true,'id',v_row.id,'version',v_next_version,
    'worker_position',v_worker_position,'blank_fields',to_jsonb(v_blank_fields),'updated_at',now());
end;
$function$;

revoke all on function private.tfi_update_dmp_production_record(uuid,integer,jsonb,text) from public,anon,authenticated;
grant execute on function private.tfi_update_dmp_production_record(uuid,integer,jsonb,text) to authenticated;

create or replace function public.tfi_update_dmp_production_record(
  p_record_id uuid,p_expected_version integer,p_changes jsonb,p_change_reason text default null
) returns jsonb language sql security invoker set search_path to ''
as $function$ select private.tfi_update_dmp_production_record($1,$2,$3,$4); $function$;
revoke all on function public.tfi_update_dmp_production_record(uuid,integer,jsonb,text) from public,anon,authenticated;
grant execute on function public.tfi_update_dmp_production_record(uuid,integer,jsonb,text) to authenticated;

create or replace function private.tfi_get_dmp_production_options()
returns jsonb language plpgsql security definer set search_path to ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_workers jsonb;
  v_processes jsonb;
begin
  if v_user_id is null or not private.tfi_has_permission('dmp_production','view') then
    raise exception using errcode = '42501', message = 'dmp_production_view_permission_required';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object('name',worker_name,'position',worker_position)
    order by source_row_number
  ),'[]'::jsonb)
  into v_workers
  from (
    select distinct on (worker_name)
      worker_name,worker_position,source_row_number
    from (
      select
        nullif(btrim(current_values->>0),'') as worker_name,
        nullif(btrim(current_values->>1),'') as worker_position,
        source_row_number
      from public.tfi_master_data_rows
      where category_key='dmp_legend' and row_kind='data' and record_status='active'
    ) source_workers
    where worker_name is not null
    order by worker_name,source_row_number
  ) unique_workers;

  select coalesce(jsonb_agg(process_name order by source_row_number),'[]'::jsonb)
  into v_processes
  from (
    select distinct on (process_name) process_name,source_row_number
    from (
      select nullif(btrim(current_values->>2),'') as process_name,source_row_number
      from public.tfi_master_data_rows
      where category_key='dmp_legend' and row_kind='data' and record_status='active'
    ) source_processes
    where process_name is not null
    order by process_name,source_row_number
  ) unique_processes;

  return jsonb_build_object('workers',v_workers,'processes',v_processes);
end;
$function$;

revoke all on function private.tfi_get_dmp_production_options() from public,anon,authenticated;
grant execute on function private.tfi_get_dmp_production_options() to authenticated;

create or replace function public.tfi_get_dmp_production_options()
returns jsonb language sql security invoker set search_path to ''
as $function$ select private.tfi_get_dmp_production_options(); $function$;
revoke all on function public.tfi_get_dmp_production_options() from public,anon,authenticated;
grant execute on function public.tfi_get_dmp_production_options() to authenticated;

commit;