-- TFI2 Master Data backend — reviewed implementation.
-- Additive reference-data schema only. No operational records are modified.

begin;

create table public.tfi_master_data_categories (
  category_key text primary key check (category_key ~ '^[a-z][a-z0-9_]{1,63}$'),
  source_sheet_ref uuid not null unique references public.tfi_source_sheets(id) on delete restrict,
  display_name text not null check (length(display_name) between 1 and 120),
  source_range text not null check (source_range ~ '^[A-Z]+[0-9]+:[A-Z]+[0-9]+$'),
  source_row_count integer not null check (source_row_count > 0),
  reference_count integer not null check (reference_count >= 0),
  source_column_count smallint not null check (source_column_count between 1 and 40),
  source_header_rows smallint[] not null check (
    cardinality(source_header_rows) between 1 and 4
    and array_position(source_header_rows, null) is null
    and 0 < all(source_header_rows)
  ),
  first_data_row integer not null check (first_data_row > 0),
  edit_policy text not null check (edit_policy in ('controlled_fields','read_only','auto_refreshed')),
  editable_columns text[] not null default '{}',
  read_only_columns text[] not null default '{}',
  locked_source_rows integer[] not null default '{}',
  field_rules jsonb not null default '{}'::jsonb check (jsonb_typeof(field_rules) = 'object'),
  source_count_note text,
  sort_order smallint not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tfi_master_data_category_edit_policy_valid check (
    (edit_policy = 'controlled_fields' and cardinality(editable_columns) > 0)
    or (edit_policy in ('read_only','auto_refreshed') and cardinality(editable_columns) = 0)
  )
);

create table public.tfi_master_data_rows (
  id uuid primary key default gen_random_uuid(),
  category_key text not null references public.tfi_master_data_categories(category_key) on delete restrict,
  source_row_number integer not null check (source_row_number > 0),
  row_kind text not null check (row_kind in ('title','instruction','header','group_header','data','reserved_slot','helper','blank')),
  source_values jsonb not null check (jsonb_typeof(source_values) = 'array'),
  current_values jsonb not null check (jsonb_typeof(current_values) = 'array'),
  source_notes jsonb not null default '[]'::jsonb check (jsonb_typeof(source_notes) = 'array'),
  source_fingerprint text not null check (source_fingerprint ~ '^[0-9a-f]{64}$'),
  record_status text not null default 'active' check (record_status in ('active','needs_review','archived')),
  row_editable boolean not null default true,
  version integer not null default 1 check (version > 0),
  source_captured_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  archived_at timestamptz,
  archived_by uuid references auth.users(id) on delete set null,
  constraint tfi_master_data_row_source_identity unique (category_key, source_row_number),
  constraint tfi_master_data_row_value_width check (jsonb_array_length(source_values) = jsonb_array_length(current_values)),
  constraint tfi_master_data_row_archive_state check (
    (record_status = 'archived' and archived_at is not null)
    or (record_status <> 'archived' and archived_at is null)
  )
);

create index tfi_master_data_rows_category_order_idx
  on public.tfi_master_data_rows(category_key, source_row_number) where record_status = 'active';
create index tfi_master_data_rows_fingerprint_idx
  on public.tfi_master_data_rows(category_key, source_fingerprint);
create index tfi_master_data_rows_current_values_gin_idx
  on public.tfi_master_data_rows using gin(current_values);

create table public.tfi_master_data_row_revisions (
  id uuid primary key default gen_random_uuid(),
  master_data_row_id uuid not null references public.tfi_master_data_rows(id) on delete restrict,
  version integer not null check (version > 1),
  before_values jsonb not null check (jsonb_typeof(before_values) = 'array'),
  after_values jsonb not null check (jsonb_typeof(after_values) = 'array'),
  changed_columns text[] not null check (cardinality(changed_columns) > 0),
  change_reason text check (change_reason is null or length(change_reason) <= 500),
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now(),
  unique (master_data_row_id, version)
);

create index tfi_master_data_revisions_row_order_idx
  on public.tfi_master_data_row_revisions(master_data_row_id, version desc);

comment on table public.tfi_master_data_categories is
  'Nine source-aligned Master Data categories with approved field-level edit rules.';
comment on table public.tfi_master_data_rows is
  'Source-row-preserving Master Data snapshot. source_values and source_fingerprint remain immutable; current_values stores approved TFI2 edits.';
comment on table public.tfi_master_data_row_revisions is
  'Append-only before/after history for Master Data edits. No hard-delete workflow is provided.';

insert into public.tfi_master_data_categories (
  category_key, source_sheet_ref, display_name, source_range,
  source_row_count, reference_count, source_column_count, source_header_rows,
  first_data_row, edit_policy, editable_columns, read_only_columns,
  locked_source_rows, field_rules, source_count_note, sort_order
)
select
  v.category_key, s.id, v.display_name, v.source_range,
  v.source_row_count, v.reference_count, v.source_column_count, v.source_header_rows,
  v.first_data_row, v.edit_policy, v.editable_columns, v.read_only_columns,
  v.locked_source_rows, v.field_rules, v.source_count_note, v.sort_order
from (
  values
  ('product_standard',2138697021::bigint,'Product Standard and Specificat','A1:U110',110,58,21,array[1,2]::smallint[],3,'controlled_fields',
   array['B','C','D','E','H','I','J','K','L','M','N','O','P','Q','R','T','U']::text[],
   array['A','F','G','S']::text[],array[]::integer[],
   jsonb_build_object('A','immutable_source_key','E','production_input','F','formula_read_only','G','formula_read_only','S','formula_read_only'),
   '58 product variants; 26 family headers; 25 reserved new-variant slots. F, G and S are formula/read-only.',1),
  ('code_map',2098561343::bigint,'Code Map','A1:B72',72,68,2,array[4]::smallint[],5,'controlled_fields',
   array['B']::text[],array['A']::text[],array[]::integer[],
   jsonb_build_object('A','immutable_product_code_key','B','editable_product_name_mapping'),
   '68 mappings. Preserve 36 unmatched codes and 26 Product Standard variants without Code Map entries.',2),
  ('yield_map',854969610::bigint,'Yield Map','A1:W43',43,39,23,array[4]::smallint[],5,'controlled_fields',
   array['B','C','D','E','F','G','H','I','J','K','L','M']::text[],
   array['A','N','P','Q','R','S','T','U','V','W']::text[],array[]::integer[],
   jsonb_build_object('A','reference','B:M','source_inputs','N','reference_information','P:W','formula_helpers'),
   '39 product families. Placeholder 95 percent targets are not approved business thresholds.',3),
  ('entry_map',1628314566::bigint,'Entry Map','A1:E43',43,39,5,array[1]::smallint[],2,'read_only',
   array[]::text[],array['A','B','C','D','E']::text[],array[]::integer[],
   jsonb_build_object('A:E','protected_product_entry_block_mapping'),
   '39 populated family-to-block mappings. New families require a verified named range and complete Product Entry block.',4),
  ('kpi_setup',1955006742::bigint,'KPI Setup','A1:T129',129,128,20,array[1]::smallint[],2,'read_only',
   array[]::text[],array['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T']::text[],array[]::integer[],
   jsonb_build_object('A:T','grouped_reference_lists','A2','protected_daily_view','E2','protected_all_product_filter'),
   '127 product codes plus protected All; other reference groups remain paired and separate.',5),
  ('dpr_legend',508797580::bigint,'DPR LEGEND','A1:AN119',119,116,40,array[2]::smallint[],3,'read_only',
   array[]::text[],
   array['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z','AA','AB','AC','AD','AE','AF','AG','AH','AI','AJ','AK','AL','AM','AN']::text[],
   array[]::integer[],
   jsonb_build_object('B:F','independent_reference_lists','G:H','formula_helpers','I:AN','product_family_code_lists'),
   '116 unique product codes across 119 product-family list entries. Preserve the documented helper formula omission.',6),
  ('dmp_legend',1070169465::bigint,'DMP LEGEND','A1:D70',70,69,4,array[1]::smallint[],2,'controlled_fields',
   array['A','B','C','D']::text[],array[]::text[],array[5,9,14,17,20,23,31,33,36,39]::integer[],
   jsonb_build_object('A:D','controlled_reference_fields','source_notes','ten worker-name cell notes; source signals only'),
   '69 source rows; preserve ten RESIGNED/AWOL cell notes separately. Note-bearing rows are locked.',7),
  ('manpower',583741906::bigint,'MANPOWER','A1:E448',448,445,5,array[3]::smallint[],4,'controlled_fields',
   array['A','B','C','D','E']::text[],array[]::text[],array[]::integer[],
   jsonb_build_object('A:E','controlled_manpower_reference_fields'),
   '445 source records and 430 distinct employee names. Preserve repeated source rows and source order.',8),
  ('schedule_lists',156467196::bigint,'Schedule Lists','A1:L101',101,100,12,array[1]::smallint[],2,'auto_refreshed',
   array[]::text[],array['A','B','C','D','E','F','G','H','I','J','K','L']::text[],array[]::integer[],
   jsonb_build_object('A:B','refreshed_from_product_standard','D:G','reference_lists','K:L','protected_source_mapping'),
   '100 production-code rows. Approved UI keeps the category read-only and source-driven.',9)
) as v(
  category_key,sheet_id,display_name,source_range,source_row_count,reference_count,
  source_column_count,source_header_rows,first_data_row,edit_policy,editable_columns,
  read_only_columns,locked_source_rows,field_rules,source_count_note,sort_order
)
join public.tfi_source_sheets s on s.sheet_id = v.sheet_id
join public.tfi_source_workbooks w on w.id = s.workbook_id and w.is_authoritative = true
where s.destination_module_key = 'master_data'
  and s.source_kind = 'reference'
  and s.import_policy = 'reference_only'
on conflict (category_key) do nothing;

alter table public.tfi_master_data_categories enable row level security;
alter table public.tfi_master_data_rows enable row level security;
alter table public.tfi_master_data_row_revisions enable row level security;

create policy tfi_master_data_categories_authorized_read
on public.tfi_master_data_categories for select to authenticated
using (private.tfi_has_permission('master_data','view'));

create policy tfi_master_data_rows_authorized_read
on public.tfi_master_data_rows for select to authenticated
using (private.tfi_has_permission('master_data','view'));

create policy tfi_master_data_revisions_authorized_read
on public.tfi_master_data_row_revisions for select to authenticated
using (private.tfi_has_permission('master_data','view'));

revoke all on public.tfi_master_data_categories,public.tfi_master_data_rows,public.tfi_master_data_row_revisions
from public, anon, authenticated;
grant select on public.tfi_master_data_categories,public.tfi_master_data_rows,public.tfi_master_data_row_revisions
to authenticated;

-- The exposed RPC is SECURITY INVOKER. Its narrow SECURITY DEFINER helper
-- lives in the non-exposed private schema and performs explicit auth checks.
grant usage on schema private to authenticated;

create or replace function private.tfi_update_master_data_row(
  p_row_id uuid,
  p_expected_version integer,
  p_changes jsonb,
  p_change_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_row public.tfi_master_data_rows%rowtype;
  v_category public.tfi_master_data_categories%rowtype;
  v_before jsonb;
  v_after jsonb;
  v_column text;
  v_value jsonb;
  v_index integer;
  v_char_index integer;
  v_changed_columns text[] := array[]::text[];
  v_seen_columns text[] := array[]::text[];
  v_next_version integer;
  v_updated_at timestamptz;
  v_context jsonb;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;
  if not private.tfi_has_permission('master_data','edit') then
    raise exception using errcode = '42501', message = 'master_data_edit_permission_required';
  end if;
  if not private.tfi_has_permission('master_data','view') then
    raise exception using errcode = '42501', message = 'master_data_view_permission_required';
  end if;
  if p_expected_version is null or p_expected_version < 1 then
    raise exception using errcode = '22023', message = 'expected_version_required';
  end if;
  if p_changes is null or jsonb_typeof(p_changes) <> 'object' or p_changes = '{}'::jsonb then
    raise exception using errcode = '22023', message = 'nonempty_changes_object_required';
  end if;

  select r.* into v_row
  from public.tfi_master_data_rows r
  where r.id = p_row_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'master_data_row_not_found';
  end if;

  select c.* into v_category
  from public.tfi_master_data_categories c
  where c.category_key = v_row.category_key;

  if not found or not v_category.is_active then
    raise exception using errcode = '22023', message = 'master_data_category_inactive';
  end if;
  if v_row.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'master_data_version_conflict';
  end if;
  if v_row.record_status <> 'active' then
    raise exception using errcode = '22023', message = 'master_data_row_not_active';
  end if;
  if v_row.row_kind <> 'data' then
    raise exception using errcode = '42501', message = 'master_data_non_data_row_protected';
  end if;
  if not v_row.row_editable or v_row.source_row_number = any(v_category.locked_source_rows) then
    raise exception using errcode = '42501', message = 'master_data_source_row_protected';
  end if;
  if v_category.edit_policy <> 'controlled_fields' or cardinality(v_category.editable_columns) = 0 then
    raise exception using errcode = '42501', message = 'master_data_category_read_only';
  end if;

  v_before := v_row.current_values;
  v_after := v_before;

  for v_column, v_value in
    select upper(e.key), e.value from jsonb_each(p_changes) as e
  loop
    if v_column = any(v_seen_columns) then
      raise exception using errcode = '22023', message = 'duplicate_normalized_source_column';
    end if;
    v_seen_columns := array_append(v_seen_columns,v_column);

    if not (v_column = any(v_category.editable_columns)) then
      raise exception using errcode = '42501', message = 'master_data_column_protected';
    end if;
    if jsonb_typeof(v_value) <> 'string' then
      raise exception using errcode = '22023', message = 'master_data_values_must_be_text';
    end if;
    if length(v_value #>> '{}') > 10000 then
      raise exception using errcode = '22023', message = 'master_data_value_too_long';
    end if;

    v_index := 0;
    for v_char_index in 1..length(v_column) loop
      if substr(v_column,v_char_index,1) < 'A' or substr(v_column,v_char_index,1) > 'Z' then
        raise exception using errcode = '22023', message = 'invalid_source_column';
      end if;
      v_index := v_index * 26 + ascii(substr(v_column,v_char_index,1)) - 64;
    end loop;
    v_index := v_index - 1;

    if v_index < 0 or v_index >= jsonb_array_length(v_after) then
      raise exception using errcode = '22023', message = 'source_column_out_of_range';
    end if;

    if (v_after -> v_index) is distinct from v_value then
      v_after := jsonb_set(v_after,array[v_index::text],v_value,false);
      v_changed_columns := array_append(v_changed_columns,v_column);
    end if;
  end loop;

  if cardinality(v_changed_columns) = 0 then
    return jsonb_build_object(
      'changed',false,'id',v_row.id,'category_key',v_row.category_key,
      'source_row_number',v_row.source_row_number,'version',v_row.version,
      'current_values',v_row.current_values
    );
  end if;

  select array_agg(distinct c order by c) into v_changed_columns
  from unnest(v_changed_columns) as c;

  v_next_version := v_row.version + 1;
  v_updated_at := now();

  insert into public.tfi_master_data_row_revisions (
    master_data_row_id,version,before_values,after_values,
    changed_columns,change_reason,changed_by,changed_at
  )
  values (
    v_row.id,v_next_version,v_before,v_after,v_changed_columns,
    nullif(left(btrim(coalesce(p_change_reason,'')),500),''),
    v_user_id,v_updated_at
  );

  update public.tfi_master_data_rows
  set current_values=v_after,version=v_next_version,updated_at=v_updated_at,updated_by=v_user_id
  where id=v_row.id;

  v_context := private.tfi_get_my_access_context();

  insert into public.tfi_audit_events (
    actor_user_id,actor_email_snapshot,actor_roles_snapshot,
    action_key,module_key,entity_type,entity_id,before_data,after_data,metadata,occurred_at
  )
  values (
    v_user_id,v_context #>> '{profile,email}',coalesce(v_context -> 'roles','[]'::jsonb),
    'master_data.update','master_data',v_row.category_key,v_row.id::text,
    jsonb_build_object('source_row_number',v_row.source_row_number,'version',v_row.version,'values',v_before),
    jsonb_build_object('source_row_number',v_row.source_row_number,'version',v_next_version,'values',v_after),
    jsonb_build_object('changed_columns',v_changed_columns),v_updated_at
  );

  return jsonb_build_object(
    'changed',true,'id',v_row.id,'category_key',v_row.category_key,
    'source_row_number',v_row.source_row_number,'version',v_next_version,
    'current_values',v_after,'updated_at',v_updated_at
  );
end;
$function$;

revoke all on function private.tfi_update_master_data_row(uuid,integer,jsonb,text) from public,anon,authenticated;
grant execute on function private.tfi_update_master_data_row(uuid,integer,jsonb,text) to authenticated;

create or replace function public.tfi_update_master_data_row(
  p_row_id uuid,
  p_expected_version integer,
  p_changes jsonb,
  p_change_reason text default null
)
returns jsonb
language sql
security invoker
set search_path to ''
as $function$
  select private.tfi_update_master_data_row($1,$2,$3,$4);
$function$;

revoke all on function public.tfi_update_master_data_row(uuid,integer,jsonb,text) from public,anon,authenticated;
grant execute on function public.tfi_update_master_data_row(uuid,integer,jsonb,text) to authenticated;

commit;
