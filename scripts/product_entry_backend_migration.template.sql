-- TFI2 Phase 5 — Product Entry backend for the 39 source-mapped product-family blocks.
-- Additive only. Does not import or alter historical Product Entry worksheet rows.
-- Formula columns, hidden columns, and block-specific product-code lists remain source-aligned.

begin;

create table public.tfi_product_entry_block_catalog (
  block_key text primary key check (block_key ~ '^BLK_[0-9]{2}$'),
  product_key text not null unique check (length(product_key) between 1 and 120),
  display_title text not null check (length(display_title) between 1 and 180),
  source_spreadsheet_id text not null,
  source_sheet_id bigint not null,
  source_first_row integer not null check (source_first_row > 0),
  source_first_data_row integer not null check (source_first_data_row > 0),
  source_block_rows integer not null check (source_block_rows > 0),
  source_column_count smallint not null check (source_column_count = 164),
  source_header_column_count smallint not null check (
    source_header_column_count between 1 and source_column_count
  ),
  visible_columns text[] not null,
  editable_columns text[] not null check (cardinality(editable_columns) > 0),
  formula_columns text[] not null,
  hidden_columns text[] not null,
  product_codes text[] not null check (cardinality(product_codes) > 0),
  review_column text not null,
  review_options text[] not null check (cardinality(review_options) > 0),
  manifest_version text not null,
  source_schema_sha256 text not null check (source_schema_sha256 ~ '^[0-9a-f]{64}$'),
  schema_metadata jsonb not null check (jsonb_typeof(schema_metadata) = 'object'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.tfi_product_entry_block_catalog is
  'Versioned source manifest for the 39 Product Entry Entry Map blocks. Keeps per-block fields, formulas, hidden columns, validations, and product-code options separate.';

create table public.tfi_product_entry_records (
  id uuid primary key default gen_random_uuid(),
  block_key text not null references public.tfi_product_entry_block_catalog(block_key) on delete restrict,
  product_key text not null,
  production_date date,
  production_date_text text check (production_date_text is null or length(production_date_text) <= 40),
  product_code text check (product_code is null or length(product_code) <= 100),
  pr_number text check (pr_number is null or length(pr_number) <= 120),
  review_status text check (review_status is null or length(review_status) <= 60),
  record_data jsonb not null check (jsonb_typeof(record_data) = 'object'),
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
  constraint tfi_product_entry_archive_state check (
    (record_status = 'archived' and archived_at is not null)
    or (record_status <> 'archived' and archived_at is null)
  ),
  constraint tfi_product_entry_record_fingerprint_key unique (record_fingerprint)
);

comment on table public.tfi_product_entry_records is
  'New Product Entry records created in TFI2. record_data uses original source column letters and only accepts visible, non-formula, non-hidden fields for the selected block. No historical rows are seeded.';

create index tfi_product_entry_records_block_date_idx
  on public.tfi_product_entry_records (block_key, production_date desc nulls last, created_at desc);
create index tfi_product_entry_records_product_code_idx
  on public.tfi_product_entry_records (block_key, product_code);
create index tfi_product_entry_records_pr_number_idx
  on public.tfi_product_entry_records (block_key, pr_number);
create index tfi_product_entry_records_review_status_idx
  on public.tfi_product_entry_records (block_key, review_status);
create index tfi_product_entry_records_created_by_idx
  on public.tfi_product_entry_records (created_by);
create index tfi_product_entry_records_updated_by_idx
  on public.tfi_product_entry_records (updated_by);

create table public.tfi_product_entry_revisions (
  id uuid primary key default gen_random_uuid(),
  product_entry_record_id uuid not null
    references public.tfi_product_entry_records(id) on delete restrict,
  version integer not null check (version > 1),
  before_data jsonb not null check (jsonb_typeof(before_data) = 'object'),
  after_data jsonb not null check (jsonb_typeof(after_data) = 'object'),
  changed_columns text[] not null check (cardinality(changed_columns) > 0),
  change_reason text check (change_reason is null or length(change_reason) <= 500),
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now(),
  unique (product_entry_record_id, version)
);

comment on table public.tfi_product_entry_revisions is
  'Append-only before/after revision history for Product Entry records.';

create index tfi_product_entry_revisions_row_order_idx
  on public.tfi_product_entry_revisions (product_entry_record_id, version desc);
create index tfi_product_entry_revisions_changed_by_idx
  on public.tfi_product_entry_revisions (changed_by);

-- Seed the 39 exact source blocks from the verified Product Entry / Entry Map manifest.
with seed as (
  select *
  from jsonb_to_recordset(
    $tfi_product_entry_seed$__PRODUCT_ENTRY_SEED_JSON__$tfi_product_entry_seed$::jsonb
  ) as x(
    block_key text,
    product_key text,
    display_title text,
    source_first_row integer,
    source_first_data_row integer,
    source_block_rows integer,
    source_column_count smallint,
    source_header_column_count smallint,
    visible_columns text[],
    editable_columns text[],
    formula_columns text[],
    hidden_columns text[],
    product_codes text[],
    review_column text,
    review_options text[],
    manifest_version text,
    source_schema_sha256 text,
    schema_metadata jsonb
  )
)
insert into public.tfi_product_entry_block_catalog (
  block_key,product_key,display_title,
  source_spreadsheet_id,source_sheet_id,
  source_first_row,source_first_data_row,source_block_rows,
  source_column_count,source_header_column_count,
  visible_columns,editable_columns,formula_columns,hidden_columns,
  product_codes,review_column,review_options,manifest_version,
  source_schema_sha256,schema_metadata
)
select
  s.block_key,s.product_key,s.display_title,
  '1rCbQ16wj7MRjQCFF3tA-WEMkudraJK0RkwcqayUlz7k',545274882,
  s.source_first_row,s.source_first_data_row,s.source_block_rows,
  s.source_column_count,s.source_header_column_count,
  s.visible_columns,s.editable_columns,s.formula_columns,s.hidden_columns,
  s.product_codes,s.review_column,s.review_options,s.manifest_version,
  s.source_schema_sha256,s.schema_metadata
from seed s
on conflict (block_key) do update set
  product_key = excluded.product_key,
  display_title = excluded.display_title,
  source_spreadsheet_id = excluded.source_spreadsheet_id,
  source_sheet_id = excluded.source_sheet_id,
  source_first_row = excluded.source_first_row,
  source_first_data_row = excluded.source_first_data_row,
  source_block_rows = excluded.source_block_rows,
  source_column_count = excluded.source_column_count,
  source_header_column_count = excluded.source_header_column_count,
  visible_columns = excluded.visible_columns,
  editable_columns = excluded.editable_columns,
  formula_columns = excluded.formula_columns,
  hidden_columns = excluded.hidden_columns,
  product_codes = excluded.product_codes,
  review_column = excluded.review_column,
  review_options = excluded.review_options,
  manifest_version = excluded.manifest_version,
  source_schema_sha256 = excluded.source_schema_sha256,
  schema_metadata = excluded.schema_metadata,
  updated_at = now();

alter table public.tfi_product_entry_block_catalog enable row level security;
alter table public.tfi_product_entry_records enable row level security;
alter table public.tfi_product_entry_revisions enable row level security;

create policy tfi_product_entry_catalog_authorized_read
on public.tfi_product_entry_block_catalog for select to authenticated
using (private.tfi_has_permission('product_entry','view'));

create policy tfi_product_entry_records_authorized_read
on public.tfi_product_entry_records for select to authenticated
using (private.tfi_has_permission('product_entry','view'));

create policy tfi_product_entry_revisions_authorized_read
on public.tfi_product_entry_revisions for select to authenticated
using (private.tfi_has_permission('product_entry','view'));

revoke all on public.tfi_product_entry_block_catalog,
  public.tfi_product_entry_records, public.tfi_product_entry_revisions
from public, anon, authenticated;
grant select on public.tfi_product_entry_block_catalog,
  public.tfi_product_entry_records, public.tfi_product_entry_revisions
to authenticated;

create or replace function private.tfi_product_entry_fingerprint(
  p_block_key text, p_record_data jsonb
) returns text
language sql immutable security invoker set search_path to ''
as $function$
  select encode(
    extensions.digest(
      convert_to(jsonb_build_array(p_block_key,p_record_data)::text,'UTF8'),
      'sha256'
    ),
    'hex'
  );
$function$;

revoke all on function private.tfi_product_entry_fingerprint(text,jsonb)
from public, anon, authenticated;

create or replace function private.tfi_get_product_entry_catalog()
returns jsonb
language plpgsql security definer set search_path to ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_result jsonb;
begin
  if v_user_id is null or not private.tfi_has_permission('product_entry','view') then
    raise exception using errcode = '42501', message = 'product_entry_view_permission_required';
  end if;

  select jsonb_build_object(
    'manifest_version', max(c.manifest_version),
    'source', jsonb_build_object(
      'spreadsheet_id', max(c.source_spreadsheet_id),
      'sheet_title', 'Product Entry',
      'sheet_id', max(c.source_sheet_id),
      'entry_map_sheet', 'Entry Map',
      'entry_map_sheet_id', 1628314566,
      'entry_map_range', 'Entry Map!A2:F40',
      'product_selector_range', 'Entry Map!A2:A40',
      'column_count', 164,
      'first_column', 'A',
      'last_column', 'FH'
    ),
    'review_options', to_jsonb((array_agg(c.review_options))[1]),
    'blocks', coalesce(
      jsonb_agg(jsonb_build_object(
        'block_key',c.block_key,
        'product_key',c.product_key,
        'display_title',c.display_title,
        'source_first_row',c.source_first_row,
        'source_first_data_row',c.source_first_data_row,
        'source_block_rows',c.source_block_rows,
        'source_column_count',c.source_column_count,
        'source_header_column_count',c.source_header_column_count,
        'visible_columns',to_jsonb(c.visible_columns),
        'editable_columns',to_jsonb(c.editable_columns),
        'formula_columns',to_jsonb(c.formula_columns),
        'hidden_columns',to_jsonb(c.hidden_columns),
        'product_codes',to_jsonb(c.product_codes),
        'review_column',c.review_column,
        'review_options',to_jsonb(c.review_options),
        'source_schema_sha256',c.source_schema_sha256,
        'schema_metadata',c.schema_metadata
      ) order by c.block_key),
      '[]'::jsonb
    )
  )
  into v_result
  from public.tfi_product_entry_block_catalog c
  where c.is_active;

  return coalesce(v_result,'{}'::jsonb);
end;
$function$;

revoke all on function private.tfi_get_product_entry_catalog() from public,anon,authenticated;
grant execute on function private.tfi_get_product_entry_catalog() to authenticated;

create or replace function public.tfi_get_product_entry_catalog()
returns jsonb language sql security invoker set search_path to ''
as $function$ select private.tfi_get_product_entry_catalog(); $function$;

revoke all on function public.tfi_get_product_entry_catalog() from public,anon,authenticated;
grant execute on function public.tfi_get_product_entry_catalog() to authenticated;

create or replace function private.tfi_create_product_entry_records(
  p_block_key text, p_records jsonb
) returns jsonb
language plpgsql security definer set search_path to ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_context jsonb;
  v_block public.tfi_product_entry_block_catalog%rowtype;
  v_item jsonb;
  v_index integer;
  v_key text;
  v_value text;
  v_data jsonb;
  v_date_text text;
  v_date date;
  v_product_code text;
  v_pr_number text;
  v_review_status text;
  v_fingerprint text;
  v_id uuid;
  v_after jsonb;
  v_blank_fields text[];
  v_results jsonb := '[]'::jsonb;
  v_inserted integer := 0;
  v_duplicates integer := 0;
  v_empty integer := 0;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;
  if not private.tfi_has_permission('product_entry','view')
     or not private.tfi_has_permission('product_entry','create') then
    raise exception using errcode = '42501', message = 'product_entry_create_permission_required';
  end if;

  select * into v_block
  from public.tfi_product_entry_block_catalog
  where block_key = p_block_key and is_active;
  if not found then
    raise exception using errcode = '22023', message = 'product_entry_block_not_found';
  end if;

  if p_records is null or jsonb_typeof(p_records) <> 'array'
     or jsonb_array_length(p_records) < 1 or jsonb_array_length(p_records) > 40 then
    raise exception using errcode = '22023', message = 'product_entry_rows_required';
  end if;

  v_context := private.tfi_get_my_access_context();

  for v_item, v_index in
    select value, ordinality::integer
    from jsonb_array_elements(p_records) with ordinality
  loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception using errcode = '22023', message = 'product_entry_row_must_be_object';
    end if;

    if exists (
      select 1 from jsonb_object_keys(v_item) as fields(key)
      where not (key = any(v_block.editable_columns))
    ) then
      raise exception using errcode = '22023', message = 'product_entry_hidden_or_derived_field';
    end if;

    v_data := '{}'::jsonb;
    for v_key in select key from jsonb_object_keys(v_item) as fields(key)
    loop
      if jsonb_typeof(v_item->v_key) = 'null' then
        continue;
      end if;
      if jsonb_typeof(v_item->v_key) not in ('string','number') then
        raise exception using errcode = '22023', message = 'product_entry_cell_must_be_scalar';
      end if;
      v_value := nullif(btrim(v_item->>v_key),'');
      if v_value is not null then
        if length(v_value) > 1000 then
          raise exception using errcode = '22023', message = 'product_entry_cell_too_long';
        end if;
        v_data := jsonb_set(v_data,array[v_key],to_jsonb(v_value),true);
      end if;
    end loop;

    if v_data = '{}'::jsonb then
      v_empty := v_empty + 1;
      v_results := v_results || jsonb_build_array(
        jsonb_build_object('row_index',v_index,'status','empty')
      );
      continue;
    end if;

    v_product_code := v_data->>'B';
    if v_product_code is not null
       and not (v_product_code = any(v_block.product_codes)) then
      raise exception using errcode = '22023', message = 'product_entry_product_code_not_valid_for_block';
    end if;

    v_review_status := v_data->>v_block.review_column;
    if v_review_status is not null
       and not (v_review_status = any(v_block.review_options)) then
      raise exception using errcode = '22023', message = 'product_entry_review_status_invalid';
    end if;

    v_date_text := v_data->>'A';
    v_date := null;
    if coalesce(v_date_text,'') ~ '^\d{4}-\d{2}-\d{2}$' then
      begin
        v_date := v_date_text::date;
      exception when others then
        v_date := null;
      end;
    end if;
    v_pr_number := v_data->>'D';

    select array_agg(column_key order by array_position(v_block.editable_columns,column_key))
    into v_blank_fields
    from unnest(v_block.editable_columns) as columns(column_key)
    where not (v_data ? column_key);
    v_blank_fields := coalesce(v_blank_fields,'{}'::text[]);

    v_fingerprint := private.tfi_product_entry_fingerprint(p_block_key,v_data);
    v_id := null;
    insert into public.tfi_product_entry_records (
      block_key,product_key,production_date,production_date_text,
      product_code,pr_number,review_status,record_data,record_fingerprint,
      completeness_status,blank_fields,created_by,updated_by
    ) values (
      v_block.block_key,v_block.product_key,v_date,v_date_text,
      v_product_code,v_pr_number,v_review_status,v_data,v_fingerprint,
      'unassessed',v_blank_fields,v_user_id,v_user_id
    ) on conflict (record_fingerprint) do nothing returning id into v_id;

    if v_id is null then
      v_duplicates := v_duplicates + 1;
      v_results := v_results || jsonb_build_array(
        jsonb_build_object('row_index',v_index,'status','duplicate')
      );
      continue;
    end if;

    v_after := jsonb_build_object(
      'block_key',v_block.block_key,
      'product_key',v_block.product_key,
      'production_date_text',v_date_text,
      'production_date',v_date,
      'product_code',v_product_code,
      'pr_number',v_pr_number,
      'review_status',v_review_status,
      'record_data',v_data,
      'completeness_status','unassessed',
      'blank_fields',to_jsonb(v_blank_fields)
    );
    insert into public.tfi_audit_events (
      actor_user_id,actor_email_snapshot,actor_roles_snapshot,
      action_key,module_key,entity_type,entity_id,
      before_data,after_data,metadata,occurred_at
    ) values (
      v_user_id,v_context #>> '{profile,email}',coalesce(v_context->'roles','[]'::jsonb),
      'product_entry.create','product_entry','product_entry_record',v_id::text,
      null,v_after,jsonb_build_object(
        'entry_source','manual',
        'row_index',v_index,
        'manifest_version',v_block.manifest_version,
        'source_block',v_block.block_key
      ),now()
    );

    v_inserted := v_inserted + 1;
    v_results := v_results || jsonb_build_array(
      jsonb_build_object(
        'row_index',v_index,'status','inserted','id',v_id,
        'block_key',v_block.block_key,'product_code',v_product_code,
        'review_status',v_review_status,'blank_fields',to_jsonb(v_blank_fields),
        'completeness_status','unassessed'
      )
    );
  end loop;

  return jsonb_build_object(
    'block_key',v_block.block_key,
    'inserted',v_inserted,
    'duplicates',v_duplicates,
    'empty',v_empty,
    'results',v_results
  );
end;
$function$;

revoke all on function private.tfi_create_product_entry_records(text,jsonb)
from public,anon,authenticated;
grant execute on function private.tfi_create_product_entry_records(text,jsonb) to authenticated;

create or replace function public.tfi_create_product_entry_records(
  p_block_key text, p_records jsonb
) returns jsonb language sql security invoker set search_path to ''
as $function$ select private.tfi_create_product_entry_records($1,$2); $function$;

revoke all on function public.tfi_create_product_entry_records(text,jsonb)
from public,anon,authenticated;
grant execute on function public.tfi_create_product_entry_records(text,jsonb) to authenticated;

create or replace function private.tfi_update_product_entry_record(
  p_record_id uuid,
  p_expected_version integer,
  p_changes jsonb,
  p_change_reason text default null
) returns jsonb
language plpgsql security definer set search_path to ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_context jsonb;
  v_record public.tfi_product_entry_records%rowtype;
  v_block public.tfi_product_entry_block_catalog%rowtype;
  v_key text;
  v_value text;
  v_before jsonb;
  v_after jsonb;
  v_product_code text;
  v_pr_number text;
  v_review_status text;
  v_date_text text;
  v_date date;
  v_fingerprint text;
  v_blank_fields text[];
  v_changed_columns text[];
  v_new_version integer;
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;
  if not private.tfi_has_permission('product_entry','view')
     or not private.tfi_has_permission('product_entry','edit') then
    raise exception using errcode = '42501', message = 'product_entry_edit_permission_required';
  end if;
  if p_expected_version is null or p_expected_version < 1 then
    raise exception using errcode = '22023', message = 'product_entry_expected_version_required';
  end if;
  if p_changes is null or jsonb_typeof(p_changes) <> 'object'
     or p_changes = '{}'::jsonb then
    raise exception using errcode = '22023', message = 'product_entry_changes_required';
  end if;
  if p_change_reason is not null and length(p_change_reason) > 500 then
    raise exception using errcode = '22023', message = 'product_entry_change_reason_too_long';
  end if;

  select * into v_record
  from public.tfi_product_entry_records
  where id = p_record_id and record_status = 'active'
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'product_entry_record_not_found';
  end if;
  if v_record.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'product_entry_version_conflict';
  end if;

  select * into v_block
  from public.tfi_product_entry_block_catalog
  where block_key = v_record.block_key and is_active;
  if not found then
    raise exception using errcode = '22023', message = 'product_entry_block_not_found';
  end if;

  if exists (
    select 1 from jsonb_object_keys(p_changes) as fields(key)
    where not (key = any(v_block.editable_columns))
  ) then
    raise exception using errcode = '22023', message = 'product_entry_hidden_or_derived_field';
  end if;

  v_before := v_record.record_data;
  v_after := v_before;
  for v_key in select key from jsonb_object_keys(p_changes) as fields(key)
  loop
    if jsonb_typeof(p_changes->v_key) = 'null' then
      v_after := v_after - v_key;
      continue;
    end if;
    if jsonb_typeof(p_changes->v_key) not in ('string','number') then
      raise exception using errcode = '22023', message = 'product_entry_cell_must_be_scalar';
    end if;
    v_value := nullif(btrim(p_changes->>v_key),'');
    if v_value is null then
      v_after := v_after - v_key;
    else
      if length(v_value) > 1000 then
        raise exception using errcode = '22023', message = 'product_entry_cell_too_long';
      end if;
      v_after := jsonb_set(v_after,array[v_key],to_jsonb(v_value),true);
    end if;
  end loop;

  if v_after = '{}'::jsonb then
    raise exception using errcode = '22023', message = 'product_entry_record_cannot_be_blank';
  end if;

  v_product_code := v_after->>'B';
  if v_product_code is not null
     and not (v_product_code = any(v_block.product_codes)) then
    raise exception using errcode = '22023', message = 'product_entry_product_code_not_valid_for_block';
  end if;
  v_review_status := v_after->>v_block.review_column;
  if v_review_status is not null
     and not (v_review_status = any(v_block.review_options)) then
    raise exception using errcode = '22023', message = 'product_entry_review_status_invalid';
  end if;

  v_date_text := v_after->>'A';
  v_date := null;
  if coalesce(v_date_text,'') ~ '^\d{4}-\d{2}-\d{2}$' then
    begin
      v_date := v_date_text::date;
    exception when others then
      v_date := null;
    end;
  end if;
  v_pr_number := v_after->>'D';

  select array_agg(column_key order by array_position(v_block.editable_columns,column_key))
  into v_blank_fields
  from unnest(v_block.editable_columns) as columns(column_key)
  where not (v_after ? column_key);
  v_blank_fields := coalesce(v_blank_fields,'{}'::text[]);

  if v_before = v_after then
    return jsonb_build_object(
      'id',v_record.id,'changed',false,'version',v_record.version,
      'block_key',v_record.block_key
    );
  end if;

  select array_agg(field_key order by field_key)
  into v_changed_columns
  from (
    select key as field_key from jsonb_object_keys(v_before) as old_fields(key)
    union
    select key as field_key from jsonb_object_keys(v_after) as new_fields(key)
  ) fields
  where v_before->field_key is distinct from v_after->field_key;
  v_changed_columns := coalesce(v_changed_columns,'{}'::text[]);

  v_fingerprint := private.tfi_product_entry_fingerprint(v_record.block_key,v_after);
  v_new_version := v_record.version + 1;
  v_context := private.tfi_get_my_access_context();

  begin
    update public.tfi_product_entry_records
    set record_data = v_after,
        production_date = v_date,
        production_date_text = v_date_text,
        product_code = v_product_code,
        pr_number = v_pr_number,
        review_status = v_review_status,
        record_fingerprint = v_fingerprint,
        blank_fields = v_blank_fields,
        version = v_new_version,
        updated_at = now(),
        updated_by = v_user_id
    where id = v_record.id;
  exception when unique_violation then
    raise exception using errcode = '23505', message = 'product_entry_exact_duplicate';
  end;

  insert into public.tfi_product_entry_revisions (
    product_entry_record_id,version,before_data,after_data,
    changed_columns,change_reason,changed_by
  ) values (
    v_record.id,v_new_version,v_before,v_after,
    v_changed_columns,p_change_reason,v_user_id
  );

  v_result := jsonb_build_object(
    'block_key',v_record.block_key,
    'product_key',v_record.product_key,
    'production_date_text',v_date_text,
    'production_date',v_date,
    'product_code',v_product_code,
    'pr_number',v_pr_number,
    'review_status',v_review_status,
    'record_data',v_after,
    'blank_fields',to_jsonb(v_blank_fields),
    'version',v_new_version
  );

  insert into public.tfi_audit_events (
    actor_user_id,actor_email_snapshot,actor_roles_snapshot,
    action_key,module_key,entity_type,entity_id,
    before_data,after_data,metadata,occurred_at
  ) values (
    v_user_id,v_context #>> '{profile,email}',coalesce(v_context->'roles','[]'::jsonb),
    'product_entry.update','product_entry','product_entry_record',v_record.id::text,
    jsonb_build_object('record_data',v_before,'version',v_record.version),
    jsonb_build_object('record_data',v_after,'version',v_new_version),
    jsonb_build_object(
      'changed_columns',to_jsonb(v_changed_columns),
      'change_reason',p_change_reason,
      'manifest_version',v_block.manifest_version
    ),now()
  );

  return jsonb_build_object(
    'id',v_record.id,'changed',true,'version',v_new_version,
    'changed_columns',to_jsonb(v_changed_columns)
  );
end;
$function$;

revoke all on function private.tfi_update_product_entry_record(uuid,integer,jsonb,text)
from public,anon,authenticated;
grant execute on function private.tfi_update_product_entry_record(uuid,integer,jsonb,text)
to authenticated;

create or replace function public.tfi_update_product_entry_record(
  p_record_id uuid,
  p_expected_version integer,
  p_changes jsonb,
  p_change_reason text default null
) returns jsonb language sql security invoker set search_path to ''
as $function$
  select private.tfi_update_product_entry_record($1,$2,$3,$4);
$function$;

revoke all on function public.tfi_update_product_entry_record(uuid,integer,jsonb,text)
from public,anon,authenticated;
grant execute on function public.tfi_update_product_entry_record(uuid,integer,jsonb,text)
to authenticated;

commit;
