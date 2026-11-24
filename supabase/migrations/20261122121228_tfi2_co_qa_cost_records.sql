-- TFI2 CO QA unit-cost records, keyed by Product Entry UUID.
begin;

create table public.tfi_co_qa_cost_records (
  product_entry_record_id uuid primary key
    references public.tfi_product_entry_records(id) on delete restrict,
  labels_cost_per_piece_y numeric(14,6) check (labels_cost_per_piece_y is null or labels_cost_per_piece_y >= 0),
  box_cost_per_piece_z numeric(14,6) check (box_cost_per_piece_z is null or box_cost_per_piece_z >= 0),
  can_cost_per_piece_aa numeric(14,6) check (can_cost_per_piece_aa is null or can_cost_per_piece_aa >= 0),
  lid_cover_cost_per_piece_ab numeric(14,6) check (lid_cover_cost_per_piece_ab is null or lid_cover_cost_per_piece_ab >= 0),
  labels_cost_per_piece_ac numeric(14,6) check (labels_cost_per_piece_ac is null or labels_cost_per_piece_ac >= 0),
  box_cost_per_piece_ad numeric(14,6) check (box_cost_per_piece_ad is null or box_cost_per_piece_ad >= 0),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null
);

comment on table public.tfi_co_qa_cost_records is
  'CO QA Y:AD unit-cost inputs keyed 1:1 to a stable TFI2 Product Entry record UUID. Never keyed by the sorted Google Sheets row number.';

create index tfi_co_qa_cost_records_created_by_idx on public.tfi_co_qa_cost_records(created_by);
create index tfi_co_qa_cost_records_updated_by_idx on public.tfi_co_qa_cost_records(updated_by);

create table public.tfi_co_qa_cost_revisions (
  id uuid primary key default gen_random_uuid(),
  product_entry_record_id uuid not null references public.tfi_co_qa_cost_records(product_entry_record_id) on delete restrict,
  version integer not null check (version > 1),
  before_data jsonb not null check (jsonb_typeof(before_data) = 'object'),
  after_data jsonb not null check (jsonb_typeof(after_data) = 'object'),
  changed_columns text[] not null check (cardinality(changed_columns) > 0),
  change_reason text check (change_reason is null or length(change_reason) <= 500),
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now(),
  unique (product_entry_record_id, version)
);

comment on table public.tfi_co_qa_cost_revisions is
  'Append-only before/after history for CO QA unit-cost changes, linked to the Product Entry record UUID.';

create index tfi_co_qa_cost_revisions_record_version_idx on public.tfi_co_qa_cost_revisions(product_entry_record_id, version desc);
create index tfi_co_qa_cost_revisions_changed_by_idx on public.tfi_co_qa_cost_revisions(changed_by);

alter table public.tfi_co_qa_cost_records enable row level security;
alter table public.tfi_co_qa_cost_revisions enable row level security;

create policy tfi_co_qa_cost_records_authorized_read
on public.tfi_co_qa_cost_records for select to authenticated
using (private.tfi_has_permission('co_qa','view') and private.tfi_has_permission('product_entry','view'));

create policy tfi_co_qa_cost_revisions_authorized_read
on public.tfi_co_qa_cost_revisions for select to authenticated
using (private.tfi_has_permission('co_qa','view') and private.tfi_has_permission('product_entry','view'));

revoke all on public.tfi_co_qa_cost_records, public.tfi_co_qa_cost_revisions from public, anon, authenticated;
grant select on public.tfi_co_qa_cost_records, public.tfi_co_qa_cost_revisions to authenticated;

create or replace function private.tfi_upsert_co_qa_cost_record(
  p_product_entry_record_id uuid,
  p_expected_version integer,
  p_costs jsonb,
  p_change_reason text default null
) returns jsonb
language plpgsql security definer set search_path to ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_context jsonb;
  v_product_entry public.tfi_product_entry_records%rowtype;
  v_existing public.tfi_co_qa_cost_records%rowtype;
  v_exists boolean := false;
  v_key text;
  v_value text;
  v_before jsonb;
  v_after jsonb;
  v_changed_columns text[];
  v_new_version integer;
begin
  if v_user_id is null then raise exception using errcode='42501', message='authentication_required'; end if;
  if not private.tfi_has_permission('co_qa','view') or not private.tfi_has_permission('product_entry','view') then
    raise exception using errcode='42501', message='co_qa_view_and_product_entry_view_required';
  end if;
  if p_costs is null or jsonb_typeof(p_costs)<>'object' or p_costs='{}'::jsonb then
    raise exception using errcode='22023', message='co_qa_cost_fields_required';
  end if;
  if p_change_reason is not null and length(p_change_reason)>500 then
    raise exception using errcode='22023', message='co_qa_change_reason_too_long';
  end if;

  select * into v_product_entry from public.tfi_product_entry_records
  where id=p_product_entry_record_id and record_status='active' for key share;
  if not found then raise exception using errcode='P0002', message='co_qa_product_entry_record_not_found'; end if;

  if exists (select 1 from jsonb_object_keys(p_costs) as fields(key) where key not in ('Y','Z','AA','AB','AC','AD')) then
    raise exception using errcode='22023', message='co_qa_cost_field_not_allowed';
  end if;

  select * into v_existing from public.tfi_co_qa_cost_records
  where product_entry_record_id=p_product_entry_record_id for update;
  v_exists := found;

  if v_exists then
    if not private.tfi_has_permission('co_qa','edit') then raise exception using errcode='42501', message='co_qa_edit_permission_required'; end if;
    if p_expected_version is null or p_expected_version<1 then raise exception using errcode='22023', message='co_qa_expected_version_required'; end if;
    if v_existing.version<>p_expected_version then raise exception using errcode='40001', message='co_qa_version_conflict'; end if;
    v_before := jsonb_build_object('Y',v_existing.labels_cost_per_piece_y,'Z',v_existing.box_cost_per_piece_z,'AA',v_existing.can_cost_per_piece_aa,'AB',v_existing.lid_cover_cost_per_piece_ab,'AC',v_existing.labels_cost_per_piece_ac,'AD',v_existing.box_cost_per_piece_ad);
  else
    if not private.tfi_has_permission('co_qa','create') then raise exception using errcode='42501', message='co_qa_create_permission_required'; end if;
    if p_expected_version is not null and p_expected_version<>0 then raise exception using errcode='40001', message='co_qa_version_conflict'; end if;
    v_before := jsonb_build_object('Y',null,'Z',null,'AA',null,'AB',null,'AC',null,'AD',null);
  end if;

  v_after := v_before;
  for v_key in select key from jsonb_object_keys(p_costs) as fields(key) loop
    if jsonb_typeof(p_costs->v_key)='null' then
      v_after := jsonb_set(v_after,array[v_key],'null'::jsonb,true);
      continue;
    end if;
    if jsonb_typeof(p_costs->v_key) not in ('string','number') then raise exception using errcode='22023', message='co_qa_cost_must_be_numeric'; end if;
    v_value := nullif(btrim(p_costs->>v_key),'');
    if v_value is null then
      v_after := jsonb_set(v_after,array[v_key],'null'::jsonb,true);
      continue;
    end if;
    if v_value !~ '^(\d{1,8}(\.\d{1,6})?|\.\d{1,6})$' then
      raise exception using errcode='22023', message='co_qa_cost_precision_or_format_invalid';
    end if;
    v_after := jsonb_set(v_after,array[v_key],to_jsonb(v_value::numeric),true);
  end loop;

  if not v_exists and not exists (select 1 from jsonb_each(v_after) as fields(key,value) where value<>'null'::jsonb) then
    raise exception using errcode='22023', message='co_qa_initial_costs_cannot_be_blank';
  end if;

  select array_agg(key order by key) into v_changed_columns
  from jsonb_object_keys(v_after) as fields(key) where v_before->key is distinct from v_after->key;
  v_changed_columns := coalesce(v_changed_columns,'{}'::text[]);

  if v_exists and cardinality(v_changed_columns)=0 then
    return jsonb_build_object('product_entry_record_id',p_product_entry_record_id,'created',false,'changed',false,'version',v_existing.version,'costs',v_after);
  end if;

  v_context := private.tfi_get_my_access_context();
  if v_exists then
    v_new_version := v_existing.version+1;
    update public.tfi_co_qa_cost_records set
      labels_cost_per_piece_y=(v_after->>'Y')::numeric,
      box_cost_per_piece_z=(v_after->>'Z')::numeric,
      can_cost_per_piece_aa=(v_after->>'AA')::numeric,
      lid_cover_cost_per_piece_ab=(v_after->>'AB')::numeric,
      labels_cost_per_piece_ac=(v_after->>'AC')::numeric,
      box_cost_per_piece_ad=(v_after->>'AD')::numeric,
      version=v_new_version,updated_at=now(),updated_by=v_user_id
    where product_entry_record_id=p_product_entry_record_id;

    insert into public.tfi_co_qa_cost_revisions(product_entry_record_id,version,before_data,after_data,changed_columns,change_reason,changed_by)
    values(p_product_entry_record_id,v_new_version,v_before,v_after,v_changed_columns,p_change_reason,v_user_id);

    insert into public.tfi_audit_events(actor_user_id,actor_email_snapshot,actor_roles_snapshot,action_key,module_key,entity_type,entity_id,before_data,after_data,metadata,occurred_at)
    values(v_user_id,v_context #>> '{profile,email}',coalesce(v_context->'roles','[]'::jsonb),'co_qa.cost.update','co_qa','co_qa_cost_record',p_product_entry_record_id::text,
      jsonb_build_object('costs',v_before,'version',v_existing.version),jsonb_build_object('costs',v_after,'version',v_new_version),
      jsonb_build_object('source_linkage','product_entry_record_uuid','block_key',v_product_entry.block_key,'changed_columns',to_jsonb(v_changed_columns),'change_reason',p_change_reason),now());
  else
    v_new_version := 1;
    insert into public.tfi_co_qa_cost_records(product_entry_record_id,labels_cost_per_piece_y,box_cost_per_piece_z,can_cost_per_piece_aa,lid_cover_cost_per_piece_ab,labels_cost_per_piece_ac,box_cost_per_piece_ad,version,created_by,updated_by)
    values(p_product_entry_record_id,(v_after->>'Y')::numeric,(v_after->>'Z')::numeric,(v_after->>'AA')::numeric,(v_after->>'AB')::numeric,(v_after->>'AC')::numeric,(v_after->>'AD')::numeric,1,v_user_id,v_user_id);

    insert into public.tfi_audit_events(actor_user_id,actor_email_snapshot,actor_roles_snapshot,action_key,module_key,entity_type,entity_id,before_data,after_data,metadata,occurred_at)
    values(v_user_id,v_context #>> '{profile,email}',coalesce(v_context->'roles','[]'::jsonb),'co_qa.cost.create','co_qa','co_qa_cost_record',p_product_entry_record_id::text,
      null,jsonb_build_object('costs',v_after,'version',1),
      jsonb_build_object('source_linkage','product_entry_record_uuid','block_key',v_product_entry.block_key,'changed_columns',to_jsonb(v_changed_columns)),now());
  end if;

  return jsonb_build_object('product_entry_record_id',p_product_entry_record_id,'created',not v_exists,'changed',true,'version',v_new_version,'costs',v_after);
end;
$function$;

revoke all on function private.tfi_upsert_co_qa_cost_record(uuid,integer,jsonb,text) from public,anon,authenticated;
grant execute on function private.tfi_upsert_co_qa_cost_record(uuid,integer,jsonb,text) to authenticated;

create or replace function public.tfi_upsert_co_qa_cost_record(
  p_product_entry_record_id uuid,p_expected_version integer,p_costs jsonb,p_change_reason text default null
) returns jsonb language sql security invoker set search_path to ''
as $function$ select private.tfi_upsert_co_qa_cost_record($1,$2,$3,$4); $function$;

revoke all on function public.tfi_upsert_co_qa_cost_record(uuid,integer,jsonb,text) from public,anon,authenticated;
grant execute on function public.tfi_upsert_co_qa_cost_record(uuid,integer,jsonb,text) to authenticated;

commit;
