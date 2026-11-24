-- TFI2 Phase 5 — Production Schedule + Schedule Summary.
-- Source-aligned daily form: one form per day, ten source row slots (8–17).
-- Product options and derived standards come from the expanded TFI2 Master Data snapshot.
-- No historical worksheet rows are imported or changed.

begin;

create table public.tfi_production_schedule_forms (
  id uuid primary key default gen_random_uuid(),
  production_date date not null unique,
  available_pax_total numeric check (available_pax_total is null or available_pax_total >= 0),
  form_data jsonb not null check (
    jsonb_typeof(form_data) = 'object'
    and jsonb_typeof(form_data->'rows') = 'array'
  ),
  record_fingerprint text not null unique check (record_fingerprint ~ '^[0-9a-f]{64}$'),
  version integer not null default 1 check (version > 0),
  record_status text not null default 'active' check (record_status = 'active'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null
);

create index tfi_production_schedule_forms_date_idx
  on public.tfi_production_schedule_forms(production_date desc);
create index tfi_production_schedule_forms_updated_idx
  on public.tfi_production_schedule_forms(updated_at desc);

create table public.tfi_production_schedule_revisions (
  id uuid primary key default gen_random_uuid(),
  production_schedule_form_id uuid not null references public.tfi_production_schedule_forms(id) on delete restrict,
  version integer not null check (version > 1),
  before_data jsonb not null check (jsonb_typeof(before_data) = 'object'),
  after_data jsonb not null check (jsonb_typeof(after_data) = 'object'),
  changed_columns text[] not null check (cardinality(changed_columns) > 0),
  change_reason text check (change_reason is null or length(change_reason) <= 500),
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now(),
  unique (production_schedule_form_id, version)
);

create index tfi_production_schedule_revisions_form_order_idx
  on public.tfi_production_schedule_revisions(production_schedule_form_id, version desc);

comment on table public.tfi_production_schedule_forms is
  'One source-aligned daily Production Schedule form per production date. Contains only new TFI2 schedule lines; no historical workbook rows are seeded.';
comment on table public.tfi_production_schedule_revisions is
  'Append-only before/after history for versioned Production Schedule form updates.';
comment on column public.tfi_production_schedule_forms.form_data is
  'Stores the ten source slots as server-derived A:R row snapshots. S:U source helper columns are not persisted as user inputs.';

alter table public.tfi_production_schedule_forms enable row level security;
alter table public.tfi_production_schedule_revisions enable row level security;

create policy tfi_production_schedule_forms_authorized_read
on public.tfi_production_schedule_forms for select to authenticated
using (private.tfi_has_permission('production_schedule','view'));

create policy tfi_production_schedule_revisions_authorized_read
on public.tfi_production_schedule_revisions for select to authenticated
using (private.tfi_has_permission('production_schedule','view'));

revoke all on public.tfi_production_schedule_forms,public.tfi_production_schedule_revisions
from public,anon,authenticated;
grant select on public.tfi_production_schedule_forms,public.tfi_production_schedule_revisions
to authenticated;
grant usage on schema private to authenticated;

create or replace function private.tfi_production_schedule_numeric(p_value text)
returns numeric
language plpgsql
immutable
set search_path to ''
as $function$
declare
  v_text text;
begin
  if p_value is null then
    return null;
  end if;
  v_text := regexp_replace(btrim(p_value), ',', '', 'g');
  if v_text = '' then
    return null;
  end if;
  if v_text !~ '^[+-]?[0-9]+([.][0-9]+)?$' then
    return null;
  end if;
  return v_text::numeric;
exception when others then
  return null;
end;
$function$;

create or replace function private.tfi_get_production_schedule_catalog()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_groups jsonb;
  v_group_codes jsonb;
  v_products jsonb;
  v_lines jsonb;
  v_areas jsonb;
  v_uom jsonb;
  v_shifts jsonb;
  v_product_count integer;
  v_group_count integer;
  v_code_count integer;
  v_context jsonb;
begin
  if v_user_id is null then
    raise exception using errcode='42501',message='authentication_required';
  end if;
  if not private.tfi_has_permission('production_schedule','view') then
    raise exception using errcode='42501',message='production_schedule_view_permission_required';
  end if;

  select count(*) into v_product_count
  from public.tfi_master_data_rows
  where category_key='product_standard'
    and row_kind='data'
    and record_status='active'
    and nullif(btrim(current_values->>0),'') is not null;

  select count(*) into v_group_count
  from public.tfi_master_data_rows
  where category_key='schedule_lists'
    and row_kind='data'
    and record_status='active'
    and source_row_number between 2 and 44
    and nullif(btrim(current_values->>0),'') is not null;

  if v_product_count <> 100 or v_group_count <> 43 then
    raise exception using errcode='22023',message='production_schedule_catalog_incomplete';
  end if;

  select coalesce(jsonb_agg(to_jsonb(btrim(current_values->>0)) order by source_row_number),'[]'::jsonb)
  into v_groups
  from public.tfi_master_data_rows
  where category_key='schedule_lists'
    and row_kind='data'
    and record_status='active'
    and source_row_number between 2 and 44
    and nullif(btrim(current_values->>0),'') is not null;

  with product_rows as (
    select
      p.source_row_number,
      trim(split_part(g.current_values->>1,'|',1)) as product_group,
      btrim(p.current_values->>0) as code
    from public.tfi_master_data_rows p
    join lateral (
      select h.current_values
      from public.tfi_master_data_rows h
      where h.category_key='product_standard'
        and h.row_kind='group_header'
        and h.record_status='active'
        and h.source_row_number < p.source_row_number
      order by h.source_row_number desc
      limit 1
    ) g on true
    where p.category_key='product_standard'
      and p.row_kind='data'
      and p.record_status='active'
      and nullif(btrim(p.current_values->>0),'') is not null
  )
  select coalesce(jsonb_object_agg(product_group,codes),'{}'::jsonb)
  into v_group_codes
  from (
    select product_group,jsonb_agg(code order by source_row_number) as codes
    from product_rows
    where product_group in (
      select btrim(current_values->>0)
      from public.tfi_master_data_rows
      where category_key='schedule_lists'
        and row_kind='data'
        and record_status='active'
        and source_row_number between 2 and 44
        and nullif(btrim(current_values->>0),'') is not null
    )
    group by product_group
  ) grouped_codes;

  select coalesce(sum(jsonb_array_length(value)),0)
  into v_code_count
  from jsonb_each(v_group_codes);

  if v_code_count <> 100 then
    raise exception using errcode='22023',message='production_schedule_product_group_mapping_incomplete';
  end if;

  with product_rows as (
    select
      p.source_row_number,
      trim(split_part(g.current_values->>1,'|',1)) as product_group,
      p.current_values
    from public.tfi_master_data_rows p
    join lateral (
      select h.current_values
      from public.tfi_master_data_rows h
      where h.category_key='product_standard'
        and h.row_kind='group_header'
        and h.record_status='active'
        and h.source_row_number < p.source_row_number
      order by h.source_row_number desc
      limit 1
    ) g on true
    where p.category_key='product_standard'
      and p.row_kind='data'
      and p.record_status='active'
      and nullif(btrim(p.current_values->>0),'') is not null
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'code',btrim(current_values->>0),
    'name',current_values->>1,
    'product_group',product_group,
    'production_line',current_values->>2,
    'line_code',current_values->>3,
    'manpower',private.tfi_production_schedule_numeric(current_values->>4),
    'productivity_tms',private.tfi_production_schedule_numeric(current_values->>7),
    'can_size',current_values->>8,
    'case_count',private.tfi_production_schedule_numeric(current_values->>16),
    'output_per_hour',coalesce(
      private.tfi_production_schedule_numeric(current_values->>20),
      private.tfi_production_schedule_numeric(current_values->>4)
        * private.tfi_production_schedule_numeric(current_values->>7)
    ),
    'default_shift',case
      when coalesce(private.tfi_production_schedule_numeric(current_values->>19),0) > 0
        then private.tfi_production_schedule_numeric(current_values->>19)
      else 12
    end,
    'manual_output',private.tfi_production_schedule_numeric(current_values->>20),
    'source_row_number',source_row_number
  ) order by source_row_number),'[]'::jsonb)
  into v_products
  from product_rows;

  select coalesce(jsonb_agg(to_jsonb(btrim(current_values->>3)) order by source_row_number),'[]'::jsonb)
  into v_lines
  from public.tfi_master_data_rows
  where category_key='schedule_lists' and row_kind='data' and record_status='active'
    and source_row_number between 2 and 4 and nullif(btrim(current_values->>3),'') is not null;

  select coalesce(jsonb_agg(to_jsonb(btrim(current_values->>6)) order by source_row_number),'[]'::jsonb)
  into v_areas
  from public.tfi_master_data_rows
  where category_key='schedule_lists' and row_kind='data' and record_status='active'
    and source_row_number between 2 and 3 and nullif(btrim(current_values->>6),'') is not null;

  select coalesce(jsonb_agg(to_jsonb(btrim(current_values->>4)) order by source_row_number),'[]'::jsonb)
  into v_uom
  from public.tfi_master_data_rows
  where category_key='schedule_lists' and row_kind='data' and record_status='active'
    and source_row_number between 2 and 3 and nullif(btrim(current_values->>4),'') is not null;

  select coalesce(jsonb_agg(to_jsonb(private.tfi_production_schedule_numeric(current_values->>5)) order by source_row_number),'[]'::jsonb)
  into v_shifts
  from public.tfi_master_data_rows
  where category_key='schedule_lists' and row_kind='data' and record_status='active'
    and source_row_number between 2 and 4 and nullif(btrim(current_values->>5),'') is not null;

  v_context := private.tfi_get_my_access_context();

  return jsonb_build_object(
    'manifest_version','2026-11-21-v1',
    'source',jsonb_build_object(
      'workbook','Copy of TFI - Production Monitoring Sheet 1',
      'spreadsheet_id','1rCbQ16wj7MRjQCFF3tA-WEMkudraJK0RkwcqayUlz7k',
      'production_schedule',jsonb_build_object(
        'sheet_title','Production Schedule',
        'sheet_id',1538651320,
        'source_range','Production Schedule!A1:U19',
        'first_form_row',8,
        'last_form_row',17,
        'form_row_count',10,
        'business_columns','A:R',
        'helper_columns','S:U'
      ),
      'schedule_summary',jsonb_build_object(
        'sheet_title','Schedule Summary',
        'sheet_id',720094137,
        'header_row',2,
        'first_data_row',3,
        'source_range','Schedule Summary!A1:S11000',
        'source_column_count',19
      ),
      'references',jsonb_build_object(
        'schedule_lists_sheet_id',156467196,
        'product_standard_sheet_id',2138697021
      )
    ),
    'form',jsonb_build_object(
      'date_input','B2',
      'source_rows',jsonb_build_array(8,9,10,11,12,13,14,15,16,17),
      'editable_columns',jsonb_build_array('B','C','D','E','F','G','K','L','M','O','P','R'),
      'derived_columns',jsonb_build_array('A','H','I','J','N','Q','S','T','U'),
      'source_headers',jsonb_build_array(
        'DATE','PRODUCT NAME','PRODUCTION CODE','# OF BATCHES','LINE','AREA','PR#',
        'CAN SIZE','SHIFT HRS','TARGET','REVISED TARGET','UM',
        'QUANTITY (tins/ends)','QUANTITY (box)','FC/IDC REF','REMARKS',
        'REQUIRED NO. OF PAX','AVAILABLE PAX','KEY','HAS DATA','PS ROW'
      ),
      'formula_rules',jsonb_build_object(
        'date','A8:A17 mirrors the date selected in B2',
        'can_size','Product Standard and Specificat!I by selected production code',
        'shift_hours','Product Standard and Specificat!T when positive; otherwise 12',
        'target','ROUND(output per hour × derived shift hours, 0)',
        'revised_target','User-entered override',
        'quantity_box','ROUND(quantity tins/ends ÷ Product Standard and Specificat!Q, 0)',
        'required_pax','Product Standard and Specificat!E manpower allocation',
        'has_data','Production code is the source key; blank-code rows are not saved',
        'daily_manpower_adjustment','R18 available total pax − Q18 total required pax'
      )
    ),
    'product_groups',v_groups,
    'group_codes',v_group_codes,
    'products',v_products,
    'line_options',v_lines,
    'area_options',v_areas,
    'shift_hours',v_shifts,
    'uom',v_uom,
    'permissions',jsonb_build_object(
      'view',private.tfi_has_permission('production_schedule','view'),
      'create',private.tfi_has_permission('production_schedule','create'),
      'edit',private.tfi_has_permission('production_schedule','edit')
    )
  );
end;
$function$;

create or replace function private.tfi_build_production_schedule_form_data(
  p_production_date date,
  p_available_pax_total numeric,
  p_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_item jsonb;
  v_input jsonb;
  v_key text;
  v_source_row integer;
  v_seen_rows integer[] := array[]::integer[];
  v_group text;
  v_code text;
  v_line text;
  v_area text;
  v_pr text;
  v_um text;
  v_fcidc text;
  v_remarks text;
  v_batches numeric;
  v_revised numeric;
  v_qty_tins numeric;
  v_row_available_pax numeric;
  v_can_size text;
  v_manpower numeric;
  v_case_count numeric;
  v_output_per_hour numeric;
  v_default_shift numeric;
  v_shift numeric;
  v_target numeric;
  v_qty_box numeric;
  v_has_fields boolean;
  v_record_data jsonb;
  v_rows jsonb := '[]'::jsonb;
  v_product record;
begin
  if p_production_date is null then
    raise exception using errcode='22023',message='production_schedule_date_required';
  end if;
  if p_available_pax_total is not null and p_available_pax_total < 0 then
    raise exception using errcode='22023',message='production_schedule_negative_number';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception using errcode='22023',message='production_schedule_rows_must_be_between_1_and_10';
  end if;
  if jsonb_array_length(p_rows) < 1 or jsonb_array_length(p_rows) > 10 then
    raise exception using errcode='22023',message='production_schedule_rows_must_be_between_1_and_10';
  end if;

  for v_item in select value from jsonb_array_elements(p_rows)
  loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception using errcode='22023',message='production_schedule_invalid_row';
    end if;
    if coalesce(v_item->>'source_row_number','') !~ '^[0-9]+$' then
      raise exception using errcode='22023',message='production_schedule_invalid_source_row';
    end if;
    v_source_row := (v_item->>'source_row_number')::integer;
    if v_source_row < 8 or v_source_row > 17 then
      raise exception using errcode='22023',message='production_schedule_invalid_source_row';
    end if;
    if v_source_row = any(v_seen_rows) then
      raise exception using errcode='22023',message='production_schedule_duplicate_source_row';
    end if;
    v_seen_rows := array_append(v_seen_rows,v_source_row);

    v_input := v_item->'record_data';
    if v_input is null or jsonb_typeof(v_input) <> 'object' then
      raise exception using errcode='22023',message='production_schedule_invalid_row_data';
    end if;

    for v_key in select jsonb_object_keys(v_input)
    loop
      if v_key <> all(array['B','C','D','E','F','G','K','L','M','O','P','R']) then
        raise exception using errcode='22023',message='production_schedule_unknown_or_derived_field';
      end if;
      if jsonb_typeof(v_input->v_key) <> 'string' then
        raise exception using errcode='22023',message='production_schedule_field_values_must_be_text';
      end if;
      if length(v_input->>v_key) > 1000 then
        raise exception using errcode='22023',message='production_schedule_field_too_long';
      end if;
    end loop;

    select exists (
      select 1 from jsonb_each_text(v_input) e
      where nullif(btrim(e.value),'') is not null
    ) into v_has_fields;

    v_group := nullif(btrim(v_input->>'B'),'');
    v_code := nullif(btrim(v_input->>'C'),'');

    if v_code is null then
      if v_has_fields then
        raise exception using errcode='22023',message='production_schedule_code_required_for_populated_row';
      end if;
      continue;
    end if;
    if v_group is null then
      raise exception using errcode='22023',message='production_schedule_product_group_required';
    end if;

    if not exists (
      select 1 from public.tfi_master_data_rows
      where category_key='schedule_lists'
        and row_kind='data'
        and record_status='active'
        and source_row_number between 2 and 44
        and btrim(current_values->>0)=v_group
    ) then
      raise exception using errcode='22023',message='production_schedule_invalid_product_group';
    end if;

    select
      p.current_values->>8 as can_size,
      private.tfi_production_schedule_numeric(p.current_values->>4) as manpower,
      private.tfi_production_schedule_numeric(p.current_values->>16) as case_count,
      private.tfi_production_schedule_numeric(p.current_values->>19) as default_shift,
      coalesce(
        private.tfi_production_schedule_numeric(p.current_values->>20),
        private.tfi_production_schedule_numeric(p.current_values->>4)
          * private.tfi_production_schedule_numeric(p.current_values->>7)
      ) as output_per_hour
    into v_product
    from public.tfi_master_data_rows p
    join lateral (
      select trim(split_part(h.current_values->>1,'|',1)) as product_group
      from public.tfi_master_data_rows h
      where h.category_key='product_standard'
        and h.row_kind='group_header'
        and h.record_status='active'
        and h.source_row_number < p.source_row_number
      order by h.source_row_number desc
      limit 1
    ) g on true
    where p.category_key='product_standard'
      and p.row_kind='data'
      and p.record_status='active'
      and btrim(p.current_values->>0)=v_code
      and g.product_group=v_group
    limit 1;

    if not found then
      raise exception using errcode='22023',message='production_schedule_product_code_mismatch';
    end if;

    v_line := nullif(btrim(v_input->>'E'),'');
    v_area := nullif(btrim(v_input->>'F'),'');
    v_pr := nullif(btrim(v_input->>'G'),'');
    v_um := nullif(btrim(v_input->>'L'),'');
    v_fcidc := nullif(btrim(v_input->>'O'),'');
    v_remarks := nullif(btrim(v_input->>'P'),'');

    if v_line is not null and not exists (
      select 1 from public.tfi_master_data_rows
      where category_key='schedule_lists' and row_kind='data' and record_status='active'
        and source_row_number between 2 and 4 and btrim(current_values->>3)=v_line
    ) then
      raise exception using errcode='22023',message='production_schedule_invalid_line';
    end if;
    if v_area is not null and not exists (
      select 1 from public.tfi_master_data_rows
      where category_key='schedule_lists' and row_kind='data' and record_status='active'
        and source_row_number between 2 and 3 and btrim(current_values->>6)=v_area
    ) then
      raise exception using errcode='22023',message='production_schedule_invalid_area';
    end if;
    if v_um is not null and not exists (
      select 1 from public.tfi_master_data_rows
      where category_key='schedule_lists' and row_kind='data' and record_status='active'
        and source_row_number between 2 and 3 and btrim(current_values->>4)=v_um
    ) then
      raise exception using errcode='22023',message='production_schedule_invalid_uom';
    end if;

    v_batches := private.tfi_production_schedule_numeric(v_input->>'D');
    v_revised := private.tfi_production_schedule_numeric(v_input->>'K');
    v_qty_tins := private.tfi_production_schedule_numeric(v_input->>'M');
    v_row_available_pax := private.tfi_production_schedule_numeric(v_input->>'R');

    if nullif(btrim(v_input->>'D'),'') is not null and v_batches is null then
      raise exception using errcode='22023',message='production_schedule_invalid_numeric_value';
    end if;
    if nullif(btrim(v_input->>'K'),'') is not null and v_revised is null then
      raise exception using errcode='22023',message='production_schedule_invalid_numeric_value';
    end if;
    if nullif(btrim(v_input->>'M'),'') is not null and v_qty_tins is null then
      raise exception using errcode='22023',message='production_schedule_invalid_numeric_value';
    end if;
    if nullif(btrim(v_input->>'R'),'') is not null and v_row_available_pax is null then
      raise exception using errcode='22023',message='production_schedule_invalid_numeric_value';
    end if;
    if coalesce(v_batches,0) < 0 or coalesce(v_revised,0) < 0
      or coalesce(v_qty_tins,0) < 0 or coalesce(v_row_available_pax,0) < 0 then
      raise exception using errcode='22023',message='production_schedule_negative_number';
    end if;

    if length(coalesce(v_pr,'')) > 120 or length(coalesce(v_fcidc,'')) > 120
      or length(coalesce(v_remarks,'')) > 1000 then
      raise exception using errcode='22023',message='production_schedule_field_too_long';
    end if;

    v_can_size := v_product.can_size;
    v_manpower := v_product.manpower;
    v_case_count := v_product.case_count;
    v_output_per_hour := v_product.output_per_hour;
    v_default_shift := v_product.default_shift;
    v_shift := case when coalesce(v_default_shift,0) > 0 then v_default_shift else 12 end;
    v_target := case when v_output_per_hour is not null then round(v_output_per_hour * v_shift,0) else null end;
    v_qty_box := case when v_qty_tins is not null and v_case_count is not null and v_case_count > 0
      then round(v_qty_tins / v_case_count,0) else null end;

    v_record_data := jsonb_strip_nulls(jsonb_build_object(
      'A',p_production_date::text,
      'B',v_group,
      'C',v_code,
      'D',v_batches,
      'E',v_line,
      'F',v_area,
      'G',v_pr,
      'H',v_can_size,
      'I',v_shift,
      'J',v_target,
      'K',v_revised,
      'L',v_um,
      'M',v_qty_tins,
      'N',v_qty_box,
      'O',v_fcidc,
      'P',v_remarks,
      'Q',v_manpower,
      'R',v_row_available_pax
    ));

    v_rows := v_rows || jsonb_build_array(jsonb_build_object(
      'source_row_number',v_source_row,
      'record_data',v_record_data
    ));
  end loop;

  if jsonb_array_length(v_rows) = 0 then
    raise exception using errcode='22023',message='production_schedule_at_least_one_product_code_required';
  end if;

  return jsonb_build_object(
    'available_pax_total',p_available_pax_total,
    'rows',v_rows
  );
end;
$function$;

create or replace function private.tfi_create_production_schedule_form(
  p_production_date date,
  p_available_pax_total numeric,
  p_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_form public.tfi_production_schedule_forms%rowtype;
  v_form_data jsonb;
  v_fingerprint text;
  v_context jsonb;
  v_entry_count integer;
begin
  if v_user_id is null then
    raise exception using errcode='42501',message='authentication_required';
  end if;
  if not private.tfi_has_permission('production_schedule','create') then
    raise exception using errcode='42501',message='production_schedule_create_permission_required';
  end if;
  if not private.tfi_has_permission('production_schedule','view') then
    raise exception using errcode='42501',message='production_schedule_view_permission_required';
  end if;

  v_form_data := private.tfi_build_production_schedule_form_data(
    p_production_date,p_available_pax_total,p_rows
  );
  v_entry_count := jsonb_array_length(v_form_data->'rows');
  v_fingerprint := encode(extensions.digest(convert_to(
    jsonb_build_object('production_date',p_production_date,'form_data',v_form_data)::text,
    'UTF8'
  ),'sha256'),'hex');

  insert into public.tfi_production_schedule_forms (
    production_date,available_pax_total,form_data,record_fingerprint,created_by,updated_by
  )
  values (
    p_production_date,p_available_pax_total,v_form_data,v_fingerprint,v_user_id,v_user_id
  )
  returning * into v_form;

  v_context := private.tfi_get_my_access_context();

  insert into public.tfi_audit_events (
    actor_user_id,actor_email_snapshot,actor_roles_snapshot,
    action_key,module_key,entity_type,entity_id,before_data,after_data,metadata,occurred_at
  )
  values (
    v_user_id,v_context #>> '{profile,email}',coalesce(v_context->'roles','[]'::jsonb),
    'production_schedule.create','production_schedule','production_schedule_form',v_form.id::text,
    null,
    jsonb_build_object('production_date',v_form.production_date,'version',v_form.version,'entry_count',v_entry_count),
    jsonb_build_object('source_sheet_id',1538651320,'summary_sheet_id',720094137,'entry_count',v_entry_count),
    v_form.created_at
  );

  return jsonb_build_object(
    'id',v_form.id,
    'production_date',v_form.production_date,
    'available_pax_total',v_form.available_pax_total,
    'form_data',v_form.form_data,
    'version',v_form.version,
    'created_at',v_form.created_at,
    'updated_at',v_form.updated_at,
    'entry_count',v_entry_count,
    'changed',true
  );
end;
$function$;

create or replace function private.tfi_update_production_schedule_form(
  p_form_id uuid,
  p_expected_version integer,
  p_production_date date,
  p_available_pax_total numeric,
  p_rows jsonb,
  p_change_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_form public.tfi_production_schedule_forms%rowtype;
  v_form_data jsonb;
  v_before jsonb;
  v_after jsonb;
  v_fingerprint text;
  v_next_version integer;
  v_changed_columns text[] := array[]::text[];
  v_context jsonb;
  v_updated_at timestamptz;
begin
  if v_user_id is null then
    raise exception using errcode='42501',message='authentication_required';
  end if;
  if not private.tfi_has_permission('production_schedule','edit') then
    raise exception using errcode='42501',message='production_schedule_edit_permission_required';
  end if;
  if not private.tfi_has_permission('production_schedule','view') then
    raise exception using errcode='42501',message='production_schedule_view_permission_required';
  end if;
  if p_expected_version is null or p_expected_version < 1 then
    raise exception using errcode='22023',message='expected_version_required';
  end if;
  if p_change_reason is not null and length(p_change_reason) > 500 then
    raise exception using errcode='22023',message='production_schedule_change_reason_too_long';
  end if;

  select * into v_form
  from public.tfi_production_schedule_forms
  where id=p_form_id
  for update;

  if not found or v_form.record_status <> 'active' then
    raise exception using errcode='P0002',message='production_schedule_form_not_found';
  end if;
  if v_form.version <> p_expected_version then
    raise exception using errcode='40001',message='production_schedule_version_conflict';
  end if;

  v_form_data := private.tfi_build_production_schedule_form_data(
    p_production_date,p_available_pax_total,p_rows
  );

  if v_form.production_date is distinct from p_production_date then
    v_changed_columns := array_append(v_changed_columns,'production_date');
  end if;
  if v_form.available_pax_total is distinct from p_available_pax_total then
    v_changed_columns := array_append(v_changed_columns,'available_pax_total');
  end if;
  if v_form.form_data is distinct from v_form_data then
    v_changed_columns := array_append(v_changed_columns,'rows');
  end if;

  if cardinality(v_changed_columns)=0 then
    return jsonb_build_object(
      'id',v_form.id,'changed',false,'production_date',v_form.production_date,
      'version',v_form.version,'form_data',v_form.form_data,'updated_at',v_form.updated_at
    );
  end if;

  v_before := jsonb_build_object(
    'production_date',v_form.production_date,
    'available_pax_total',v_form.available_pax_total,
    'form_data',v_form.form_data
  );
  v_after := jsonb_build_object(
    'production_date',p_production_date,
    'available_pax_total',p_available_pax_total,
    'form_data',v_form_data
  );
  v_next_version := v_form.version + 1;
  v_updated_at := now();
  v_fingerprint := encode(extensions.digest(convert_to(
    jsonb_build_object('production_date',p_production_date,'form_data',v_form_data)::text,
    'UTF8'
  ),'sha256'),'hex');

  insert into public.tfi_production_schedule_revisions (
    production_schedule_form_id,version,before_data,after_data,
    changed_columns,change_reason,changed_by,changed_at
  )
  values (
    v_form.id,v_next_version,v_before,v_after,v_changed_columns,
    nullif(left(btrim(coalesce(p_change_reason,'')),500),''),
    v_user_id,v_updated_at
  );

  update public.tfi_production_schedule_forms
  set production_date=p_production_date,
      available_pax_total=p_available_pax_total,
      form_data=v_form_data,
      record_fingerprint=v_fingerprint,
      version=v_next_version,
      updated_at=v_updated_at,
      updated_by=v_user_id
  where id=v_form.id;

  v_context := private.tfi_get_my_access_context();

  insert into public.tfi_audit_events (
    actor_user_id,actor_email_snapshot,actor_roles_snapshot,
    action_key,module_key,entity_type,entity_id,before_data,after_data,metadata,occurred_at
  )
  values (
    v_user_id,v_context #>> '{profile,email}',coalesce(v_context->'roles','[]'::jsonb),
    'production_schedule.update','production_schedule','production_schedule_form',v_form.id::text,
    jsonb_build_object('version',v_form.version,'data',v_before),
    jsonb_build_object('version',v_next_version,'data',v_after),
    jsonb_build_object('changed_columns',v_changed_columns,'change_reason',nullif(left(btrim(coalesce(p_change_reason,'')),500),'')),
    v_updated_at
  );

  return jsonb_build_object(
    'id',v_form.id,'changed',true,'production_date',p_production_date,
    'available_pax_total',p_available_pax_total,'form_data',v_form_data,
    'version',v_next_version,'updated_at',v_updated_at,
    'changed_columns',to_jsonb(v_changed_columns)
  );
end;
$function$;

create or replace function private.tfi_get_production_schedule_form_by_date(p_production_date date)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_form public.tfi_production_schedule_forms%rowtype;
begin
  if v_user_id is null then
    raise exception using errcode='42501',message='authentication_required';
  end if;
  if not private.tfi_has_permission('production_schedule','view') then
    raise exception using errcode='42501',message='production_schedule_view_permission_required';
  end if;

  select * into v_form
  from public.tfi_production_schedule_forms
  where production_date=p_production_date and record_status='active';

  if not found then
    return jsonb_build_object('form',null);
  end if;

  return jsonb_build_object(
    'form',jsonb_build_object(
      'id',v_form.id,
      'production_date',v_form.production_date,
      'available_pax_total',v_form.available_pax_total,
      'form_data',v_form.form_data,
      'version',v_form.version,
      'created_at',v_form.created_at,
      'updated_at',v_form.updated_at
    )
  );
end;
$function$;

create or replace function private.tfi_get_production_schedule_summary()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_summary jsonb;
begin
  if v_user_id is null then
    raise exception using errcode='42501',message='authentication_required';
  end if;
  if not private.tfi_has_permission('production_schedule','view') then
    raise exception using errcode='42501',message='production_schedule_view_permission_required';
  end if;

  with rows as (
    select f.production_date,f.updated_at,f.available_pax_total,r->'record_data' as d
    from public.tfi_production_schedule_forms f
    cross join lateral jsonb_array_elements(f.form_data->'rows') r
    where f.record_status='active'
  )
  select jsonb_build_object(
    'saved_rows',count(*),
    'days_saved',count(distinct production_date),
    'target_total',coalesce(sum(private.tfi_production_schedule_numeric(d->>'J')),0),
    'quantity_tins_total',coalesce(sum(private.tfi_production_schedule_numeric(d->>'M')),0),
    'quantity_box_total',coalesce(sum(private.tfi_production_schedule_numeric(d->>'N')),0),
    'revised_target_total',coalesce(sum(private.tfi_production_schedule_numeric(d->>'K')),0),
    'required_manpower_total',coalesce(sum(private.tfi_production_schedule_numeric(d->>'Q')),0),
    'last_saved',max(updated_at)
  )
  into v_summary
  from rows;

  return coalesce(v_summary,'{}'::jsonb);
end;
$function$;

create or replace function private.tfi_get_production_schedule_records(
  p_date_from date default null,
  p_date_to date default null,
  p_line text default null,
  p_area text default null,
  p_product_name text default null,
  p_production_code text default null,
  p_pr_number text default null,
  p_search text default null,
  p_page integer default 1,
  p_page_size integer default 10,
  p_sort_key text default 'date',
  p_sort_direction text default 'desc'
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_total integer := 0;
  v_records jsonb := '[]'::jsonb;
  v_page integer := greatest(coalesce(p_page,1),1);
  v_page_size integer := least(greatest(coalesce(p_page_size,10),1),100);
  v_sort_key text := coalesce(nullif(p_sort_key,''),'date');
  v_sort_direction text := case when lower(coalesce(p_sort_direction,'desc'))='asc' then 'asc' else 'desc' end;
begin
  if v_user_id is null then
    raise exception using errcode='42501',message='authentication_required';
  end if;
  if not private.tfi_has_permission('production_schedule','view') then
    raise exception using errcode='42501',message='production_schedule_view_permission_required';
  end if;
  if p_date_from is not null and p_date_to is not null and p_date_from > p_date_to then
    raise exception using errcode='22023',message='production_schedule_invalid_date_range';
  end if;

  with base as (
    select
      f.id as form_id,
      f.version as form_version,
      f.production_date,
      upper(trim(to_char(f.production_date,'FMDay'))) as day,
      f.available_pax_total,
      f.updated_at as saved_on,
      (item->>'source_row_number')::integer as source_row_number,
      item->'record_data' as d
    from public.tfi_production_schedule_forms f
    cross join lateral jsonb_array_elements(f.form_data->'rows') item
    where f.record_status='active'
  ),
  filtered as (
    select
      form_id,form_version,production_date,day,available_pax_total,saved_on,source_row_number,d,
      d->>'E' as line,
      d->>'F' as area,
      d->>'B' as product_name,
      d->>'C' as production_code,
      private.tfi_production_schedule_numeric(d->>'D') as batches,
      private.tfi_production_schedule_numeric(d->>'J') as target,
      private.tfi_production_schedule_numeric(d->>'K') as revised_target,
      d->>'L' as um,
      private.tfi_production_schedule_numeric(d->>'M') as quantity_tins,
      private.tfi_production_schedule_numeric(d->>'N') as quantity_box,
      private.tfi_production_schedule_numeric(d->>'Q') as required_pax,
      d->>'G' as pr_number,
      d->>'P' as remarks,
      d->>'O' as fc_idc_ref,
      private.tfi_production_schedule_numeric(d->>'I') as shift_hours
    from base
    where (p_date_from is null or production_date >= p_date_from)
      and (p_date_to is null or production_date <= p_date_to)
  ),
  matched as (
    select *
    from filtered
    where (p_line is null or line ilike '%'||p_line||'%')
      and (p_area is null or area ilike '%'||p_area||'%')
      and (p_product_name is null or product_name ilike '%'||p_product_name||'%')
      and (p_production_code is null or production_code ilike '%'||p_production_code||'%')
      and (p_pr_number is null or pr_number ilike '%'||p_pr_number||'%')
      and (p_search is null or concat_ws(' ',production_date::text,day,line,area,product_name,production_code,pr_number,remarks,fc_idc_ref) ilike '%'||p_search||'%')
  ),
  ranked as (
    select *,
      case when v_sort_key='date' then production_date end as sort_date,
      case when v_sort_key='saved_on' then saved_on end as sort_timestamp,
      case v_sort_key
        when 'batches' then batches
        when 'target' then target
        when 'revised_target' then revised_target
        when 'quantity_tins' then quantity_tins
        when 'quantity_box' then quantity_box
        when 'required_pax' then required_pax
        when 'shift_hours' then shift_hours
        when 'available_pax_day' then available_pax_total
      end as sort_numeric,
      case v_sort_key
        when 'day' then day
        when 'line' then line
        when 'area' then area
        when 'product_name' then product_name
        when 'production_code' then production_code
        when 'um' then um
        when 'pr_number' then pr_number
        when 'remarks' then remarks
        when 'fc_idc_ref' then fc_idc_ref
      end as sort_text
    from matched
  ),
  page_rows as (
    select *,
      row_number() over (
        order by
          case when v_sort_direction='asc' then sort_date end asc,
          case when v_sort_direction='desc' then sort_date end desc,
          case when v_sort_direction='asc' then sort_timestamp end asc,
          case when v_sort_direction='desc' then sort_timestamp end desc,
          case when v_sort_direction='asc' then sort_numeric end asc,
          case when v_sort_direction='desc' then sort_numeric end desc,
          case when v_sort_direction='asc' then sort_text end asc,
          case when v_sort_direction='desc' then sort_text end desc,
          production_date desc,source_row_number asc
      ) as sort_position
    from ranked
    order by
      case when v_sort_direction='asc' then sort_date end asc,
      case when v_sort_direction='desc' then sort_date end desc,
      case when v_sort_direction='asc' then sort_timestamp end asc,
      case when v_sort_direction='desc' then sort_timestamp end desc,
      case when v_sort_direction='asc' then sort_numeric end asc,
      case when v_sort_direction='desc' then sort_numeric end desc,
      case when v_sort_direction='asc' then sort_text end asc,
      case when v_sort_direction='desc' then sort_text end desc,
      production_date desc,source_row_number asc
    limit v_page_size offset ((v_page-1)*v_page_size)
  )
  select
    (select count(*) from matched),
    coalesce(jsonb_agg(jsonb_build_object(
      'form_id',form_id,
      'form_version',form_version,
      'source_row_number',source_row_number,
      'date',production_date,
      'day',day,
      'line',line,
      'area',area,
      'product_name',product_name,
      'production_code',production_code,
      'batches',batches,
      'target',target,
      'revised_target',revised_target,
      'um',um,
      'quantity_tins',quantity_tins,
      'quantity_box',quantity_box,
      'required_pax',required_pax,
      'pr_number',pr_number,
      'remarks',remarks,
      'fc_idc_ref',fc_idc_ref,
      'shift_hours',shift_hours,
      'available_pax_day',available_pax_total,
      'saved_on',saved_on,
      'record_data',d
    ) order by sort_position),'[]'::jsonb)
  into v_total,v_records
  from page_rows;

  return jsonb_build_object(
    'records',v_records,
    'total',v_total,
    'page',v_page,
    'page_size',v_page_size
  );
end;
$function$;

create or replace function private.tfi_get_production_schedule_revisions(p_form_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_revisions jsonb;
begin
  if v_user_id is null then
    raise exception using errcode='42501',message='authentication_required';
  end if;
  if not private.tfi_has_permission('production_schedule','view') then
    raise exception using errcode='42501',message='production_schedule_view_permission_required';
  end if;
  if not exists (
    select 1 from public.tfi_production_schedule_forms
    where id=p_form_id
  ) then
    raise exception using errcode='P0002',message='production_schedule_form_not_found';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'version',version,
    'before_data',before_data,
    'after_data',after_data,
    'changed_columns',to_jsonb(changed_columns),
    'change_reason',change_reason,
    'changed_by',changed_by,
    'changed_at',changed_at
  ) order by version desc),'[]'::jsonb)
  into v_revisions
  from public.tfi_production_schedule_revisions
  where production_schedule_form_id=p_form_id;

  return jsonb_build_object('form_id',p_form_id,'revisions',v_revisions);
end;
$function$;

-- Public RPC wrappers remain SECURITY INVOKER; all authorization is checked
-- inside the private SECURITY DEFINER functions.
create or replace function public.tfi_get_production_schedule_catalog()
returns jsonb language sql security invoker set search_path to ''
as $function$ select private.tfi_get_production_schedule_catalog(); $function$;

create or replace function public.tfi_create_production_schedule_form(
  p_production_date date,p_available_pax_total numeric,p_rows jsonb
)
returns jsonb language sql security invoker set search_path to ''
as $function$ select private.tfi_create_production_schedule_form($1,$2,$3); $function$;

create or replace function public.tfi_update_production_schedule_form(
  p_form_id uuid,p_expected_version integer,p_production_date date,
  p_available_pax_total numeric,p_rows jsonb,p_change_reason text default null
)
returns jsonb language sql security invoker set search_path to ''
as $function$ select private.tfi_update_production_schedule_form($1,$2,$3,$4,$5,$6); $function$;

create or replace function public.tfi_get_production_schedule_form_by_date(p_production_date date)
returns jsonb language sql security invoker set search_path to ''
as $function$ select private.tfi_get_production_schedule_form_by_date($1); $function$;

create or replace function public.tfi_get_production_schedule_summary()
returns jsonb language sql security invoker set search_path to ''
as $function$ select private.tfi_get_production_schedule_summary(); $function$;

create or replace function public.tfi_get_production_schedule_records(
  p_date_from date default null,p_date_to date default null,p_line text default null,
  p_area text default null,p_product_name text default null,p_production_code text default null,
  p_pr_number text default null,p_search text default null,p_page integer default 1,
  p_page_size integer default 10,p_sort_key text default 'date',p_sort_direction text default 'desc'
)
returns jsonb language sql security invoker set search_path to ''
as $function$ select private.tfi_get_production_schedule_records($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12); $function$;

create or replace function public.tfi_get_production_schedule_revisions(p_form_id uuid)
returns jsonb language sql security invoker set search_path to ''
as $function$ select private.tfi_get_production_schedule_revisions($1); $function$;

revoke all on function private.tfi_production_schedule_numeric(text) from public,anon,authenticated;
revoke all on function private.tfi_build_production_schedule_form_data(date,numeric,jsonb) from public,anon,authenticated;
revoke all on function private.tfi_get_production_schedule_catalog() from public,anon,authenticated;
revoke all on function private.tfi_create_production_schedule_form(date,numeric,jsonb) from public,anon,authenticated;
revoke all on function private.tfi_update_production_schedule_form(uuid,integer,date,numeric,jsonb,text) from public,anon,authenticated;
revoke all on function private.tfi_get_production_schedule_form_by_date(date) from public,anon,authenticated;
revoke all on function private.tfi_get_production_schedule_summary() from public,anon,authenticated;
revoke all on function private.tfi_get_production_schedule_records(date,date,text,text,text,text,text,text,integer,integer,text,text) from public,anon,authenticated;
revoke all on function private.tfi_get_production_schedule_revisions(uuid) from public,anon,authenticated;

grant execute on function private.tfi_get_production_schedule_catalog() to authenticated;
grant execute on function private.tfi_create_production_schedule_form(date,numeric,jsonb) to authenticated;
grant execute on function private.tfi_update_production_schedule_form(uuid,integer,date,numeric,jsonb,text) to authenticated;
grant execute on function private.tfi_get_production_schedule_form_by_date(date) to authenticated;
grant execute on function private.tfi_get_production_schedule_summary() to authenticated;
grant execute on function private.tfi_get_production_schedule_records(date,date,text,text,text,text,text,text,integer,integer,text,text) to authenticated;
grant execute on function private.tfi_get_production_schedule_revisions(uuid) to authenticated;

revoke all on function public.tfi_get_production_schedule_catalog() from public,anon,authenticated;
revoke all on function public.tfi_create_production_schedule_form(date,numeric,jsonb) from public,anon,authenticated;
revoke all on function public.tfi_update_production_schedule_form(uuid,integer,date,numeric,jsonb,text) from public,anon,authenticated;
revoke all on function public.tfi_get_production_schedule_form_by_date(date) from public,anon,authenticated;
revoke all on function public.tfi_get_production_schedule_summary() from public,anon,authenticated;
revoke all on function public.tfi_get_production_schedule_records(date,date,text,text,text,text,text,text,integer,integer,text,text) from public,anon,authenticated;
revoke all on function public.tfi_get_production_schedule_revisions(uuid) from public,anon,authenticated;

grant execute on function public.tfi_get_production_schedule_catalog() to authenticated;
grant execute on function public.tfi_create_production_schedule_form(date,numeric,jsonb) to authenticated;
grant execute on function public.tfi_update_production_schedule_form(uuid,integer,date,numeric,jsonb,text) to authenticated;
grant execute on function public.tfi_get_production_schedule_form_by_date(date) to authenticated;
grant execute on function public.tfi_get_production_schedule_summary() to authenticated;
grant execute on function public.tfi_get_production_schedule_records(date,date,text,text,text,text,text,text,integer,integer,text,text) to authenticated;
grant execute on function public.tfi_get_production_schedule_revisions(uuid) to authenticated;

commit;
