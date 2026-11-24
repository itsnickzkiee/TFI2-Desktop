create table public.tfi_oee_records (
  id uuid primary key default gen_random_uuid(),
  production_date date not null check (isfinite(production_date)),
  machine text not null check (length(btrim(machine)) between 1 and 500),
  line text not null check (length(btrim(line)) between 1 and 500),
  product_code text not null check (length(btrim(product_code)) between 1 and 200),
  planned_hours numeric not null check (planned_hours >= 0 and planned_hours < 'Infinity'::numeric),
  downtime_hours numeric not null check (downtime_hours between 0 and planned_hours),
  ideal_rate numeric not null check (ideal_rate >= 0 and ideal_rate < 'Infinity'::numeric),
  total_count bigint not null check (total_count >= 0),
  reject_count bigint not null check (reject_count between 0 and total_count),
  include_in_overall text not null check (include_in_overall in ('Y', 'N')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create unique index tfi_oee_records_business_key
  on public.tfi_oee_records (production_date, lower(btrim(machine)), lower(btrim(product_code)));
create index tfi_oee_records_created_by_idx on public.tfi_oee_records (created_by);

alter table public.tfi_oee_records enable row level security;
revoke all on public.tfi_oee_records from public, anon, authenticated;
grant select on public.tfi_oee_records to authenticated;
create policy tfi_oee_records_authorized_read on public.tfi_oee_records
  for select to authenticated using ((select private.tfi_has_permission('oee', 'view')));

create function private.tfi_create_oee_record(p_record jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_id uuid;
  v_row public.tfi_oee_records%rowtype;
  v_context jsonb;
  v_required constant text[] := array[
    'production_date','machine','line','product_code','planned_hours',
    'downtime_hours','ideal_rate','total_count','reject_count','include_in_overall'
  ];
begin
  if v_user_id is null or not private.tfi_has_permission('oee','view')
     or not private.tfi_has_permission('oee','create') then
    raise exception using errcode = '42501', message = 'oee_create_permission_required';
  end if;

  if jsonb_typeof(p_record) is distinct from 'object' then
    raise exception using errcode = '22023', message = 'oee_record_must_be_object';
  end if;
  if exists (select 1 from jsonb_object_keys(p_record) as f(key) where not (key = any(v_required)))
     or exists (select 1 from unnest(v_required) as f(key)
       where nullif(btrim(p_record->>key), '') is null) then
    raise exception using errcode = '22023', message = 'oee_record_fields_invalid';
  end if;
  if p_record->>'production_date' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
     or exists (select 1 from unnest(array['machine','line','product_code','include_in_overall']) as f(key)
       where jsonb_typeof(p_record->key) <> 'string')
     or exists (select 1 from unnest(array['total_count','reject_count']) as f(key)
       where btrim(p_record->>key) !~ '^[0-9]+$') then
    raise exception using errcode = '22023', message = 'oee_record_field_type_invalid';
  end if;

  insert into public.tfi_oee_records (
    production_date, machine, line, product_code, planned_hours, downtime_hours,
    ideal_rate, total_count, reject_count, include_in_overall, created_by
  ) values (
    (p_record->>'production_date')::date, btrim(p_record->>'machine'),
    btrim(p_record->>'line'), btrim(p_record->>'product_code'),
    (p_record->>'planned_hours')::numeric, (p_record->>'downtime_hours')::numeric,
    (p_record->>'ideal_rate')::numeric, (p_record->>'total_count')::bigint,
    (p_record->>'reject_count')::bigint, upper(btrim(p_record->>'include_in_overall')), v_user_id
  )
  on conflict (production_date, lower(btrim(machine)), lower(btrim(product_code)))
  do nothing returning * into v_row;

  v_id := v_row.id;
  if v_id is null then
    return jsonb_build_object('status', 'duplicate');
  end if;

  v_context := private.tfi_get_my_access_context();
  insert into public.tfi_audit_events (
    actor_user_id, actor_email_snapshot, actor_roles_snapshot, action_key, module_key,
    entity_type, entity_id, after_data, metadata, occurred_at
  ) values (
    v_user_id, v_context #>> '{profile,email}', coalesce(v_context->'roles','[]'::jsonb),
    'oee.create', 'oee', 'oee_record', v_id::text, to_jsonb(v_row),
    jsonb_build_object('entry_source','manual'), now()
  );
  return jsonb_build_object('status', 'inserted', 'id', v_id);
end;
$function$;

create function public.tfi_create_oee_record(p_record jsonb)
returns jsonb
language sql
set search_path = ''
as $function$
  select private.tfi_create_oee_record($1);
$function$;

revoke all on function private.tfi_create_oee_record(jsonb) from public, anon, authenticated;
revoke all on function public.tfi_create_oee_record(jsonb) from public, anon, authenticated;
grant execute on function private.tfi_create_oee_record(jsonb) to authenticated;
grant execute on function public.tfi_create_oee_record(jsonb) to authenticated;
