-- TFI2 Phase 5 — selective operational import foundation.
-- Adds an append-only operational record store and a controlled import ledger.
-- Existing Master Data, source workbook metadata, and historical source rows are untouched.

begin;

create table public.tfi_import_destinations (
  module_key text primary key references public.tfi_modules(module_key) on delete restrict,
  source_sheet_ref uuid not null unique references public.tfi_source_sheets(id) on delete restrict,
  source_sheet_id bigint not null,
  source_sheet_title text not null,
  grid_rows integer not null check (grid_rows > 0),
  grid_columns integer not null check (grid_columns between 1 and 200),
  header_rows integer[] not null default '{}',
  first_data_row integer not null check (first_data_row > 0),
  source_kind text not null check (source_kind in ('transaction','input_form','mixed_transaction')),
  contract_status text not null default 'raw_capture_only'
    check (contract_status in ('approved','raw_capture_only','hold_pending_business_rule')),
  required_columns text[] not null default '{}',
  input_columns text[] not null default '{}',
  formula_columns text[] not null default '{}',
  source_notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.tfi_import_destinations is
  'Server-side allowlist of the 15 approved selective import destinations and their exact source worksheets.';

insert into public.tfi_import_destinations (
  module_key,source_sheet_ref,source_sheet_id,source_sheet_title,grid_rows,grid_columns,
  header_rows,first_data_row,source_kind,contract_status,required_columns,input_columns,
  formula_columns,source_notes
)
select
  v.module_key,s.id,s.sheet_id,s.sheet_title,s.grid_rows,s.grid_columns,
  coalesce(s.header_rows::integer[],'{}'::integer[]),coalesce(s.first_data_row,1),s.source_kind,
  v.contract_status,v.required_columns,v.input_columns,v.formula_columns,s.source_notes
from (
  values
    ('product_entry',545274882::bigint,'raw_capture_only',array[]::text[],array[]::text[],array[]::text[]),
    ('production_entry',1923467491::bigint,'raw_capture_only',array[]::text[],array[]::text[],array[]::text[]),
    ('production_schedule',1538651320::bigint,'raw_capture_only',array[]::text[],array[]::text[],array[]::text[]),
    ('dmp_production',1312335050::bigint,'raw_capture_only',array[]::text[],array['A','B','C','D','E','F','G','H','I']::text[],array[]::text[]),
    ('dmr_production',2048043346::bigint,'raw_capture_only',array[]::text[],array['A','B','C','D','E','F','G','H']::text[],array[]::text[]),
    ('dmr_coding',675328096::bigint,'raw_capture_only',array[]::text[],array[]::text[],array[]::text[]),
    ('hourly_meat',428082343::bigint,'raw_capture_only',array[]::text[],array[]::text[],array[]::text[]),
    ('hourly_coding',1916766220::bigint,'raw_capture_only',array[]::text[],array[]::text[],array[]::text[]),
    ('hourly_agri',534145404::bigint,'raw_capture_only',array[]::text[],array[]::text[],array[]::text[]),
    ('oee',1750442014::bigint,'raw_capture_only',array[]::text[],array['A','B','C','D','E','F','G','H','I','J']::text[],array['K','L','M','N','O','P','Q','R','S','T','U']::text[]),
    ('productivity',1688444278::bigint,'raw_capture_only',array[]::text[],array['A','B','C','D','E','F','G','H','I','J','K']::text[],array['L','M','N','O','P','Q','R','S','T','U','V']::text[]),
    ('coding_dpr',1266086431::bigint,'raw_capture_only',array[]::text[],array[]::text[],array[]::text[]),
    ('co_qa',1359678099::bigint,'hold_pending_business_rule',array[]::text[],array['Y','Z','AA','AB','AC','AD']::text[],array['AE','AF','AG','AH']::text[]),
    ('nonprod',1381857831::bigint,'raw_capture_only',array[]::text[],array['A','B','C','D','E','F','H','I','J']::text[],array['G']::text[]),
    ('pr_monitoring',867256143::bigint,'raw_capture_only',array[]::text[],array['A','B','C','D','E','F']::text[],array['G']::text[])
) as v(module_key,sheet_id,contract_status,required_columns,input_columns,formula_columns)
join public.tfi_modules m
  on m.module_key=v.module_key and m.is_active and m.is_operational and m.is_importable
join public.tfi_source_sheets s
  on s.sheet_id=v.sheet_id
 and s.destination_module_key=v.module_key
 and s.import_policy='selective'
 and s.source_kind in ('transaction','input_form','mixed_transaction')
on conflict (module_key) do nothing;

create table public.tfi_import_batches (
  id uuid primary key default gen_random_uuid(),
  batch_ref text not null unique default (
    'TFI-IMP-' || to_char(now(),'YYYYMMDD') || '-' ||
    upper(substr(replace(gen_random_uuid()::text,'-',''),1,8))
  ),
  module_key text not null references public.tfi_import_destinations(module_key) on delete restrict,
  source_sheet_ref uuid not null references public.tfi_source_sheets(id) on delete restrict,
  source_sheet_id bigint not null,
  source_sheet_title text not null,
  source_type text not null check (source_type in ('xlsx','google_sheets')),
  source_name text not null check (length(btrim(source_name)) between 1 and 255),
  source_workbook_key text not null check (length(source_workbook_key) between 10 and 300),
  source_file_sha256 text check (source_file_sha256 is null or source_file_sha256 ~ '^[0-9a-f]{64}$'),
  source_file_size bigint check (source_file_size is null or source_file_size between 1 and 104857600),
  source_spreadsheet_id text,
  status text not null default 'scanning'
    check (status in ('scanning','review','completed','completed_with_issues','failed','cancelled')),
  rows_inspected integer not null default 0 check (rows_inspected >= 0),
  rows_staged integer not null default 0 check (rows_staged >= 0),
  blank_rows integer not null default 0 check (blank_rows >= 0),
  formula_cells integer not null default 0 check (formula_cells >= 0),
  derived_rows integer not null default 0 check (derived_rows >= 0),
  unmapped_rows integer not null default 0 check (unmapped_rows >= 0),
  rows_inserted integer not null default 0 check (rows_inserted >= 0),
  rows_incomplete integer not null default 0 check (rows_incomplete >= 0),
  rows_duplicates integer not null default 0 check (rows_duplicates >= 0),
  rows_held integer not null default 0 check (rows_held >= 0),
  rows_failed integer not null default 0 check (rows_failed >= 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  scan_started_at timestamptz not null default now(),
  scanned_at timestamptz,
  completed_at timestamptz,
  error_message text,
  source_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(source_metadata)='object'),
  constraint tfi_import_batch_source_identity check (
    (source_type='xlsx' and source_file_sha256 is not null and source_workbook_key='sha256:'||source_file_sha256)
    or
    (source_type='google_sheets' and source_spreadsheet_id is not null and source_workbook_key='google:'||source_spreadsheet_id)
  )
);

create index tfi_import_batches_module_created_idx
  on public.tfi_import_batches(module_key,created_at desc);
create index tfi_import_batches_status_created_idx
  on public.tfi_import_batches(status,created_at desc);
create index tfi_import_batches_source_key_idx
  on public.tfi_import_batches(module_key,source_workbook_key,source_sheet_id);

create table public.tfi_import_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.tfi_import_batches(id) on delete restrict,
  source_row_number integer not null check (source_row_number > 0),
  source_locator text not null check (length(btrim(source_locator)) between 1 and 120),
  source_values jsonb not null check (jsonb_typeof(source_values)='array'),
  source_formulas jsonb not null default '{}'::jsonb check (jsonb_typeof(source_formulas)='object'),
  source_fingerprint text not null check (source_fingerprint ~ '^[0-9a-f]{64}$'),
  classification text not null check (classification in ('operational','derived','helper','summary','unmapped','invalid')),
  completeness_status text not null default 'unassessed'
    check (completeness_status in ('complete','incomplete','unassessed')),
  missing_fields text[] not null default '{}',
  duplicate_status text not null default 'none'
    check (duplicate_status in ('none','exact_source_duplicate','possible_duplicate','confirmed_duplicate','distinct_new')),
  review_decision text check (review_decision in ('import_as_new','skip_duplicate','hold')),
  review_reason text check (review_reason is null or length(review_reason)<=500),
  import_status text not null default 'pending'
    check (import_status in ('pending','inserted','skipped_existing','held','failed','excluded')),
  duplicate_record_id uuid,
  destination_record_id uuid,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  unique(batch_id,source_locator)
);

create index tfi_import_rows_batch_order_idx
  on public.tfi_import_rows(batch_id,source_row_number,source_locator);
create index tfi_import_rows_batch_status_idx
  on public.tfi_import_rows(batch_id,import_status,classification);
create index tfi_import_rows_fingerprint_idx
  on public.tfi_import_rows(source_fingerprint);

create table public.tfi_operational_records (
  id uuid primary key default gen_random_uuid(),
  module_key text not null references public.tfi_modules(module_key) on delete restrict,
  source_batch_id uuid not null references public.tfi_import_batches(id) on delete restrict,
  source_row_id uuid not null unique references public.tfi_import_rows(id) on delete restrict,
  source_workbook_key text not null,
  source_file_sha256 text,
  source_spreadsheet_id text,
  source_sheet_ref uuid not null references public.tfi_source_sheets(id) on delete restrict,
  source_sheet_id bigint not null,
  source_sheet_title text not null,
  source_row_number integer not null check (source_row_number > 0),
  source_locator text not null,
  source_fingerprint text not null check (source_fingerprint ~ '^[0-9a-f]{64}$'),
  source_values jsonb not null check (jsonb_typeof(source_values)='array'),
  source_formulas jsonb not null default '{}'::jsonb check (jsonb_typeof(source_formulas)='object'),
  completeness_status text not null
    check (completeness_status in ('complete','incomplete','unassessed')),
  missing_fields text[] not null default '{}',
  imported_by uuid references auth.users(id) on delete set null,
  imported_at timestamptz not null default now(),
  constraint tfi_operational_source_identity unique (
    module_key,source_workbook_key,source_sheet_id,source_locator
  )
);

alter table public.tfi_import_rows
  add constraint tfi_import_rows_duplicate_record_fk
  foreign key (duplicate_record_id) references public.tfi_operational_records(id) on delete restrict;
alter table public.tfi_import_rows
  add constraint tfi_import_rows_destination_record_fk
  foreign key (destination_record_id) references public.tfi_operational_records(id) on delete restrict;

create index tfi_operational_records_module_imported_idx
  on public.tfi_operational_records(module_key,imported_at desc);
create index tfi_operational_records_module_fingerprint_idx
  on public.tfi_operational_records(module_key,source_fingerprint);
create index tfi_operational_records_source_sheet_row_idx
  on public.tfi_operational_records(source_sheet_id,source_row_number);

comment on table public.tfi_import_batches is
  'Immutable source metadata and aggregate scan/import outcomes for one destination module per batch.';
comment on table public.tfi_import_rows is
  'Source-traceable staged rows. Incomplete new rows remain eligible; exact existing rows are never reinserted.';
comment on table public.tfi_operational_records is
  'Append-only operational records imported from approved source rows. Existing records have no update or delete path.';


alter table public.tfi_import_destinations enable row level security;
alter table public.tfi_import_batches enable row level security;
alter table public.tfi_import_rows enable row level security;
alter table public.tfi_operational_records enable row level security;

create policy tfi_import_destinations_authorized_read
on public.tfi_import_destinations for select to authenticated
using (
  private.tfi_has_permission('spreadsheet_import','view')
  and private.tfi_has_permission(module_key,'import')
);

create policy tfi_import_batches_authorized_read
on public.tfi_import_batches for select to authenticated
using (
  private.tfi_has_permission('spreadsheet_import','view')
  and private.tfi_has_permission(module_key,'import')
);

create policy tfi_import_rows_authorized_read
on public.tfi_import_rows for select to authenticated
using (
  exists (
    select 1 from public.tfi_import_batches b
    where b.id=tfi_import_rows.batch_id
      and private.tfi_has_permission('spreadsheet_import','view')
      and private.tfi_has_permission(b.module_key,'import')
  )
);

create policy tfi_operational_records_module_read
on public.tfi_operational_records for select to authenticated
using (private.tfi_has_permission(module_key,'view'));

revoke all on public.tfi_import_destinations,public.tfi_import_batches,
  public.tfi_import_rows,public.tfi_operational_records
from public,anon,authenticated;
grant select on public.tfi_import_destinations,public.tfi_import_batches,
  public.tfi_import_rows,public.tfi_operational_records to authenticated;
grant usage on schema private to authenticated;

create or replace function private.tfi_write_import_audit_event(
  p_action_key text,
  p_module_key text,
  p_entity_type text,
  p_entity_id text,
  p_before_data jsonb default null,
  p_after_data jsonb default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_context jsonb;
begin
  if v_user_id is null then
    raise exception using errcode='42501',message='authentication_required';
  end if;
  v_context := private.tfi_get_my_access_context();
  insert into public.tfi_audit_events (
    actor_user_id,actor_email_snapshot,actor_roles_snapshot,
    action_key,module_key,entity_type,entity_id,
    before_data,after_data,metadata,occurred_at
  )
  values (
    v_user_id,v_context #>> '{profile,email}',coalesce(v_context -> 'roles','[]'::jsonb),
    p_action_key,p_module_key,p_entity_type,p_entity_id,
    p_before_data,p_after_data,coalesce(p_metadata,'{}'::jsonb),now()
  );
end;
$function$;

create or replace function private.tfi_create_import_batch(
  p_module_key text,
  p_source_type text,
  p_source_name text,
  p_source_workbook_key text,
  p_source_file_sha256 text,
  p_source_file_size bigint,
  p_source_spreadsheet_id text,
  p_source_sheet_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_destination public.tfi_import_destinations%rowtype;
  v_batch public.tfi_import_batches%rowtype;
begin
  if v_user_id is null then
    raise exception using errcode='42501',message='authentication_required';
  end if;
  if not private.tfi_has_permission('spreadsheet_import','create') then
    raise exception using errcode='42501',message='spreadsheet_import_create_permission_required';
  end if;
  if p_module_key is null or not private.tfi_has_permission(p_module_key,'import') then
    raise exception using errcode='42501',message='module_import_permission_required';
  end if;
  if p_source_type is null or p_source_type not in ('xlsx','google_sheets') then
    raise exception using errcode='22023',message='unsupported_import_source_type';
  end if;
  if p_source_name is null or length(btrim(p_source_name)) not between 1 and 255 then
    raise exception using errcode='22023',message='invalid_import_source_name';
  end if;

  select d.* into v_destination
  from public.tfi_import_destinations d
  join public.tfi_modules m on m.module_key=d.module_key
  where d.module_key=p_module_key and d.is_active and m.is_active
  for share of d;

  if not found then
    raise exception using errcode='22023',message='import_destination_not_available';
  end if;
  if p_source_sheet_id is distinct from v_destination.source_sheet_id then
    raise exception using errcode='22023',message='source_sheet_not_approved_for_destination';
  end if;

  if p_source_type='xlsx' then
    if p_source_file_sha256 is null or p_source_file_sha256 !~ '^[0-9a-f]{64}$'
      or p_source_workbook_key is distinct from 'sha256:'||p_source_file_sha256
      or p_source_file_size is null or p_source_file_size not between 1 and 104857600 then
      raise exception using errcode='22023',message='invalid_xlsx_source_metadata';
    end if;
  else
    if p_source_spreadsheet_id is null or length(btrim(p_source_spreadsheet_id)) not between 10 and 200
      or p_source_workbook_key is distinct from 'google:'||p_source_spreadsheet_id then
      raise exception using errcode='22023',message='invalid_google_sheets_source_metadata';
    end if;
  end if;

  insert into public.tfi_import_batches (
    module_key,source_sheet_ref,source_sheet_id,source_sheet_title,
    source_type,source_name,source_workbook_key,source_file_sha256,
    source_file_size,source_spreadsheet_id,created_by,source_metadata
  )
  values (
    p_module_key,v_destination.source_sheet_ref,v_destination.source_sheet_id,
    v_destination.source_sheet_title,p_source_type,btrim(p_source_name),
    p_source_workbook_key,p_source_file_sha256,p_source_file_size,
    p_source_spreadsheet_id,v_user_id,
    jsonb_build_object('contract_status',v_destination.contract_status)
  )
  returning * into v_batch;

  perform private.tfi_write_import_audit_event(
    'import.batch.created','spreadsheet_import','import_batch',v_batch.id::text,
    null,jsonb_build_object(
      'batch_ref',v_batch.batch_ref,'module_key',v_batch.module_key,
      'source_type',v_batch.source_type,'source_name',v_batch.source_name,
      'source_sheet_id',v_batch.source_sheet_id,'source_sheet_title',v_batch.source_sheet_title
    ),
    jsonb_build_object('source_workbook_key',v_batch.source_workbook_key)
  );

  return jsonb_build_object(
    'id',v_batch.id,'batch_ref',v_batch.batch_ref,'module_key',v_batch.module_key,
    'source_sheet_id',v_batch.source_sheet_id,'source_sheet_title',v_batch.source_sheet_title,
    'status',v_batch.status,'contract_status',v_destination.contract_status
  );
end;
$function$;

create or replace function private.tfi_stage_import_rows(
  p_batch_id uuid,
  p_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_batch public.tfi_import_batches%rowtype;
  v_destination public.tfi_import_destinations%rowtype;
  v_item jsonb;
  v_row_number integer;
  v_locator text;
  v_values jsonb;
  v_formulas jsonb;
  v_fingerprint text;
  v_classification text;
  v_completeness text;
  v_missing_fields text[];
  v_duplicate_status text;
  v_import_status text;
  v_duplicate_id uuid;
  v_inserted integer := 0;
begin
  if v_user_id is null then
    raise exception using errcode='42501',message='authentication_required';
  end if;
  if p_rows is null or jsonb_typeof(p_rows)<>'array'
    or jsonb_array_length(p_rows)<1 or jsonb_array_length(p_rows)>100 then
    raise exception using errcode='22023',message='import_stage_chunk_must_contain_1_to_100_rows';
  end if;

  select b.* into v_batch
  from public.tfi_import_batches b
  where b.id=p_batch_id
  for update;
  if not found then
    raise exception using errcode='P0002',message='import_batch_not_found';
  end if;
  if v_batch.status<>'scanning' then
    raise exception using errcode='22023',message='import_batch_not_scanning';
  end if;
  if not private.tfi_has_permission('spreadsheet_import','create')
    or not private.tfi_has_permission(v_batch.module_key,'import') then
    raise exception using errcode='42501',message='module_import_permission_required';
  end if;

  select d.* into v_destination
  from public.tfi_import_destinations d
  where d.module_key=v_batch.module_key and d.is_active;
  if not found then
    raise exception using errcode='22023',message='import_destination_not_available';
  end if;

  for v_item in select value from jsonb_array_elements(p_rows) as e(value)
  loop
    if jsonb_typeof(v_item)<>'object' then
      raise exception using errcode='22023',message='invalid_import_row_object';
    end if;
    v_row_number := (v_item->>'source_row_number')::integer;
    v_locator := btrim(coalesce(v_item->>'source_locator',''));
    v_values := v_item->'source_values';
    v_formulas := coalesce(v_item->'source_formulas','{}'::jsonb);
    v_fingerprint := v_item->>'source_fingerprint';
    v_classification := v_item->>'classification';
    v_completeness := coalesce(v_item->>'completeness_status','unassessed');
    v_missing_fields := case
      when jsonb_typeof(v_item->'missing_fields')='array'
      then array(select jsonb_array_elements_text(v_item->'missing_fields'))
      else array[]::text[]
    end;

    if v_row_number is null or v_row_number<1
      or length(v_locator) not between 1 and 120
      or v_values is null or jsonb_typeof(v_values)<>'array'
      or jsonb_array_length(v_values)>200
      or jsonb_typeof(v_formulas)<>'object'
      or v_fingerprint is null or v_fingerprint !~ '^[0-9a-f]{64}$'
      or v_classification is null or v_classification not in ('operational','derived','helper','summary','unmapped','invalid')
      or v_completeness not in ('complete','incomplete','unassessed') then
      raise exception using errcode='22023',message='invalid_import_row_payload';
    end if;

    v_duplicate_id := null;
    v_duplicate_status := 'none';
    v_import_status := 'excluded';

    if v_classification='operational' then
      select o.id into v_duplicate_id
      from public.tfi_operational_records o
      where o.module_key=v_batch.module_key
        and o.source_workbook_key=v_batch.source_workbook_key
        and o.source_sheet_id=v_batch.source_sheet_id
        and o.source_locator=v_locator
      limit 1;

      if v_duplicate_id is not null then
        v_duplicate_status := 'exact_source_duplicate';
        v_import_status := 'skipped_existing';
      elsif v_destination.contract_status='hold_pending_business_rule' then
        v_import_status := 'held';
      elsif exists (
        select 1 from public.tfi_operational_records o
        where o.module_key=v_batch.module_key and o.source_fingerprint=v_fingerprint
      ) or exists (
        select 1 from public.tfi_import_rows r
        where r.batch_id=p_batch_id and r.classification='operational'
          and r.source_fingerprint=v_fingerprint
      ) then
        v_duplicate_status := 'possible_duplicate';
        v_import_status := 'held';
        select o.id into v_duplicate_id
        from public.tfi_operational_records o
        where o.module_key=v_batch.module_key and o.source_fingerprint=v_fingerprint
        order by o.imported_at desc limit 1;
      else
        v_import_status := 'pending';
      end if;
    end if;

    insert into public.tfi_import_rows (
      batch_id,source_row_number,source_locator,source_values,source_formulas,
      source_fingerprint,classification,completeness_status,missing_fields,
      duplicate_status,import_status,duplicate_record_id
    )
    values (
      p_batch_id,v_row_number,v_locator,v_values,v_formulas,v_fingerprint,
      v_classification,v_completeness,v_missing_fields,v_duplicate_status,
      v_import_status,v_duplicate_id
    )
    on conflict (batch_id,source_locator) do nothing;

    if found then
      v_inserted := v_inserted+1;
    end if;
  end loop;

  update public.tfi_import_batches b
  set rows_staged=(select count(*) from public.tfi_import_rows r where r.batch_id=p_batch_id),
      rows_incomplete=(select count(*) from public.tfi_import_rows r where r.batch_id=p_batch_id and r.completeness_status='incomplete'),
      rows_duplicates=(select count(*) from public.tfi_import_rows r where r.batch_id=p_batch_id and r.duplicate_status in ('exact_source_duplicate','possible_duplicate','confirmed_duplicate')),
      rows_held=(select count(*) from public.tfi_import_rows r where r.batch_id=p_batch_id and r.import_status='held'),
      rows_failed=(select count(*) from public.tfi_import_rows r where r.batch_id=p_batch_id and r.import_status='failed')
  where b.id=p_batch_id;

  return jsonb_build_object(
    'batch_id',p_batch_id,'rows_inserted_to_staging',v_inserted,
    'rows_staged',(select count(*) from public.tfi_import_rows r where r.batch_id=p_batch_id)
  );
end;
$function$;


create or replace function private.tfi_complete_import_scan(
  p_batch_id uuid,
  p_scan_stats jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_batch public.tfi_import_batches%rowtype;
  v_inspected integer;
  v_blank integer;
  v_formula_cells integer;
  v_derived integer;
  v_unmapped integer;
begin
  if v_user_id is null then
    raise exception using errcode='42501',message='authentication_required';
  end if;
  if p_scan_stats is null or jsonb_typeof(p_scan_stats)<>'object' then
    raise exception using errcode='22023',message='invalid_import_scan_summary';
  end if;

  select b.* into v_batch
  from public.tfi_import_batches b
  where b.id=p_batch_id
  for update;
  if not found then
    raise exception using errcode='P0002',message='import_batch_not_found';
  end if;
  if v_batch.status<>'scanning' then
    raise exception using errcode='22023',message='import_batch_not_scanning';
  end if;
  if not private.tfi_has_permission('spreadsheet_import','create')
    or not private.tfi_has_permission(v_batch.module_key,'import') then
    raise exception using errcode='42501',message='module_import_permission_required';
  end if;

  v_inspected := greatest(0,coalesce((p_scan_stats->>'rows_inspected')::integer,0));
  v_blank := greatest(0,coalesce((p_scan_stats->>'blank_rows')::integer,0));
  v_formula_cells := greatest(0,coalesce((p_scan_stats->>'formula_cells')::integer,0));
  v_derived := greatest(0,coalesce((p_scan_stats->>'derived_rows')::integer,0));
  v_unmapped := greatest(0,coalesce((p_scan_stats->>'unmapped_rows')::integer,0));

  update public.tfi_import_batches b
  set status='review',
      rows_inspected=v_inspected,
      blank_rows=v_blank,
      formula_cells=v_formula_cells,
      derived_rows=v_derived,
      unmapped_rows=v_unmapped,
      rows_staged=(select count(*) from public.tfi_import_rows r where r.batch_id=p_batch_id),
      rows_incomplete=(select count(*) from public.tfi_import_rows r where r.batch_id=p_batch_id and r.completeness_status='incomplete'),
      rows_duplicates=(select count(*) from public.tfi_import_rows r where r.batch_id=p_batch_id and r.duplicate_status in ('exact_source_duplicate','possible_duplicate','confirmed_duplicate')),
      rows_held=(select count(*) from public.tfi_import_rows r where r.batch_id=p_batch_id and r.import_status='held'),
      scanned_at=now()
  where b.id=p_batch_id
  returning * into v_batch;

  perform private.tfi_write_import_audit_event(
    'import.scan.completed','spreadsheet_import','import_batch',v_batch.id::text,
    jsonb_build_object('status','scanning'),
    jsonb_build_object(
      'status',v_batch.status,'rows_inspected',v_batch.rows_inspected,
      'rows_staged',v_batch.rows_staged,'blank_rows',v_batch.blank_rows,
      'derived_rows',v_batch.derived_rows,'unmapped_rows',v_batch.unmapped_rows
    ),
    jsonb_build_object('module_key',v_batch.module_key,'formula_cells',v_batch.formula_cells)
  );

  return jsonb_build_object(
    'id',v_batch.id,'batch_ref',v_batch.batch_ref,'status',v_batch.status,
    'rows_inspected',v_batch.rows_inspected,'rows_staged',v_batch.rows_staged,
    'blank_rows',v_batch.blank_rows,'formula_cells',v_batch.formula_cells,
    'derived_rows',v_batch.derived_rows,'unmapped_rows',v_batch.unmapped_rows,
    'rows_incomplete',v_batch.rows_incomplete,'rows_duplicates',v_batch.rows_duplicates,
    'rows_held',v_batch.rows_held
  );
end;
$function$;

create or replace function private.tfi_fail_import_batch(
  p_batch_id uuid,
  p_error_message text
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_batch public.tfi_import_batches%rowtype;
begin
  if v_user_id is null then
    raise exception using errcode='42501',message='authentication_required';
  end if;
  select b.* into v_batch
  from public.tfi_import_batches b
  where b.id=p_batch_id
  for update;
  if not found then
    raise exception using errcode='P0002',message='import_batch_not_found';
  end if;
  if v_batch.status<>'scanning' then
    raise exception using errcode='22023',message='import_batch_not_scanning';
  end if;
  if not private.tfi_has_permission('spreadsheet_import','create')
    or not private.tfi_has_permission(v_batch.module_key,'import') then
    raise exception using errcode='42501',message='module_import_permission_required';
  end if;

  update public.tfi_import_batches
  set status='failed',completed_at=now(),
      error_message=left(coalesce(nullif(btrim(p_error_message),''),'The source scan could not be completed.'),500)
  where id=p_batch_id
  returning * into v_batch;

  perform private.tfi_write_import_audit_event(
    'import.batch.failed','spreadsheet_import','import_batch',v_batch.id::text,
    jsonb_build_object('status','scanning'),
    jsonb_build_object('status',v_batch.status,'error_message',v_batch.error_message),
    jsonb_build_object('module_key',v_batch.module_key)
  );
  return jsonb_build_object('id',v_batch.id,'batch_ref',v_batch.batch_ref,'status',v_batch.status);
end;
$function$;

create or replace function private.tfi_set_import_row_decision(
  p_batch_id uuid,
  p_row_id uuid,
  p_decision text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_batch public.tfi_import_batches%rowtype;
  v_destination public.tfi_import_destinations%rowtype;
  v_row public.tfi_import_rows%rowtype;
  v_next_duplicate_status text;
  v_next_import_status text;
  v_reason text := nullif(left(btrim(coalesce(p_reason,'')),500),'');
begin
  if v_user_id is null then
    raise exception using errcode='42501',message='authentication_required';
  end if;
  if p_decision is null or p_decision not in ('import_as_new','skip_duplicate','hold') then
    raise exception using errcode='22023',message='invalid_import_review_decision';
  end if;

  select b.* into v_batch
  from public.tfi_import_batches b
  where b.id=p_batch_id
  for update;
  if not found or v_batch.status<>'review' then
    raise exception using errcode='P0002',message='reviewable_import_batch_not_found';
  end if;
  if not private.tfi_has_permission('spreadsheet_import','review')
    or not private.tfi_has_permission('duplicate_review','review')
    or not private.tfi_has_permission(v_batch.module_key,'review') then
    raise exception using errcode='42501',message='import_duplicate_review_permission_required';
  end if;

  select d.* into v_destination
  from public.tfi_import_destinations d
  where d.module_key=v_batch.module_key and d.is_active;
  select r.* into v_row
  from public.tfi_import_rows r
  where r.id=p_row_id and r.batch_id=p_batch_id
  for update;
  if not found then
    raise exception using errcode='P0002',message='import_row_not_found';
  end if;
  if v_row.classification<>'operational' then
    raise exception using errcode='22023',message='non_operational_import_row_cannot_be_promoted';
  end if;
  if v_row.import_status in ('inserted','skipped_existing','excluded') then
    raise exception using errcode='22023',message='import_row_already_resolved';
  end if;
  if p_decision='import_as_new' then
    if v_destination.contract_status='hold_pending_business_rule' then
      raise exception using errcode='42501',message='import_mapping_pending_business_rule';
    end if;
    if v_row.duplicate_status='exact_source_duplicate' then
      raise exception using errcode='42501',message='existing_source_record_cannot_be_reimported';
    end if;
    if v_row.duplicate_status='possible_duplicate' and v_reason is null then
      raise exception using errcode='22023',message='reason_required_to_resolve_possible_duplicate';
    end if;
    v_next_duplicate_status := case
      when v_row.duplicate_status='possible_duplicate' then 'distinct_new'
      else v_row.duplicate_status
    end;
    v_next_import_status := 'pending';
  elsif p_decision='skip_duplicate' then
    if v_row.duplicate_status not in ('exact_source_duplicate','possible_duplicate') then
      raise exception using errcode='22023',message='row_is_not_a_detected_duplicate';
    end if;
    v_next_duplicate_status := 'confirmed_duplicate';
    v_next_import_status := 'skipped_existing';
  else
    v_next_duplicate_status := v_row.duplicate_status;
    v_next_import_status := 'held';
  end if;

  update public.tfi_import_rows
  set duplicate_status=v_next_duplicate_status,
      review_decision=p_decision,
      review_reason=v_reason,
      import_status=v_next_import_status
  where id=p_row_id
  returning * into v_row;

  perform private.tfi_write_import_audit_event(
    'import.row.reviewed','duplicate_review','import_row',v_row.id::text,
    jsonb_build_object('duplicate_status',case when p_decision='import_as_new' then 'possible_duplicate' else null end),
    jsonb_build_object(
      'duplicate_status',v_row.duplicate_status,'review_decision',v_row.review_decision,
      'import_status',v_row.import_status,'reason',v_row.review_reason
    ),
    jsonb_build_object('batch_id',p_batch_id,'module_key',v_batch.module_key,'source_row_number',v_row.source_row_number)
  );

  return jsonb_build_object(
    'id',v_row.id,'duplicate_status',v_row.duplicate_status,
    'review_decision',v_row.review_decision,'import_status',v_row.import_status
  );
end;
$function$;

create or replace function private.tfi_finalize_import_batch(
  p_batch_id uuid,
  p_row_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_batch public.tfi_import_batches%rowtype;
  v_destination public.tfi_import_destinations%rowtype;
  v_row public.tfi_import_rows%rowtype;
  v_existing_id uuid;
  v_new_id uuid;
  v_inserted integer := 0;
  v_skipped integer := 0;
  v_held integer := 0;
  v_pending integer := 0;
  v_failed integer := 0;
  v_incomplete integer := 0;
  v_issue_count integer := 0;
begin
  if v_user_id is null then
    raise exception using errcode='42501',message='authentication_required';
  end if;
  if p_row_ids is null or cardinality(p_row_ids)<1 or cardinality(p_row_ids)>1000 then
    raise exception using errcode='22023',message='select_between_1_and_1000_import_rows';
  end if;

  select b.* into v_batch
  from public.tfi_import_batches b
  where b.id=p_batch_id
  for update;
  if not found or v_batch.status<>'review' then
    raise exception using errcode='P0002',message='reviewable_import_batch_not_found';
  end if;
  if not private.tfi_has_permission('spreadsheet_import','import')
    or not private.tfi_has_permission('import_confirmation','import')
    or not private.tfi_has_permission(v_batch.module_key,'import') then
    raise exception using errcode='42501',message='final_import_permission_required';
  end if;

  select d.* into v_destination
  from public.tfi_import_destinations d
  where d.module_key=v_batch.module_key and d.is_active;
  if not found then
    raise exception using errcode='22023',message='import_destination_not_available';
  end if;
  if v_destination.contract_status='hold_pending_business_rule' then
    raise exception using errcode='42501',message='import_mapping_pending_business_rule';
  end if;

  for v_row in
    select r.* from public.tfi_import_rows r
    where r.batch_id=p_batch_id and r.id=any(p_row_ids)
    order by r.source_row_number,r.source_locator
    for update
  loop
    if v_row.import_status in ('inserted','skipped_existing','excluded') then
      continue;
    end if;
    if v_row.classification<>'operational' then
      update public.tfi_import_rows set import_status='excluded' where id=v_row.id;
      continue;
    end if;
    if v_row.review_decision in ('skip_duplicate','hold') then
      if v_row.review_decision='skip_duplicate' then
        update public.tfi_import_rows set import_status='skipped_existing' where id=v_row.id;
        v_skipped := v_skipped+1;
      else
        update public.tfi_import_rows set import_status='held' where id=v_row.id;
        v_held := v_held+1;
      end if;
      continue;
    end if;
    if v_row.duplicate_status='exact_source_duplicate' then
      update public.tfi_import_rows
      set import_status='skipped_existing',review_decision='skip_duplicate'
      where id=v_row.id;
      v_skipped := v_skipped+1;
      continue;
    end if;
    if v_row.duplicate_status='possible_duplicate'
      and v_row.review_decision is distinct from 'import_as_new' then
      update public.tfi_import_rows set import_status='held' where id=v_row.id;
      v_held := v_held+1;
      continue;
    end if;

    v_existing_id := null;
    select o.id into v_existing_id
    from public.tfi_operational_records o
    where o.module_key=v_batch.module_key
      and o.source_workbook_key=v_batch.source_workbook_key
      and o.source_sheet_id=v_batch.source_sheet_id
      and o.source_locator=v_row.source_locator
    limit 1;
    if v_existing_id is not null then
      update public.tfi_import_rows
      set duplicate_status='exact_source_duplicate',duplicate_record_id=v_existing_id,
          import_status='skipped_existing'
      where id=v_row.id;
      v_skipped := v_skipped+1;
      continue;
    end if;

    if v_row.review_decision is distinct from 'import_as_new' then
      select o.id into v_existing_id
      from public.tfi_operational_records o
      where o.module_key=v_batch.module_key
        and o.source_fingerprint=v_row.source_fingerprint
      order by o.imported_at desc limit 1;
      if v_existing_id is not null then
        update public.tfi_import_rows
        set duplicate_status='possible_duplicate',duplicate_record_id=v_existing_id,
            import_status='held'
        where id=v_row.id;
        v_held := v_held+1;
        continue;
      end if;
    end if;

    v_new_id := null;
    insert into public.tfi_operational_records (
      module_key,source_batch_id,source_row_id,source_workbook_key,
      source_file_sha256,source_spreadsheet_id,source_sheet_ref,
      source_sheet_id,source_sheet_title,source_row_number,source_locator,
      source_fingerprint,source_values,source_formulas,completeness_status,
      missing_fields,imported_by
    )
    values (
      v_batch.module_key,v_batch.id,v_row.id,v_batch.source_workbook_key,
      v_batch.source_file_sha256,v_batch.source_spreadsheet_id,v_batch.source_sheet_ref,
      v_batch.source_sheet_id,v_batch.source_sheet_title,v_row.source_row_number,
      v_row.source_locator,v_row.source_fingerprint,v_row.source_values,
      v_row.source_formulas,v_row.completeness_status,v_row.missing_fields,v_user_id
    )
    on conflict do nothing
    returning id into v_new_id;

    if v_new_id is null then
      select o.id into v_existing_id
      from public.tfi_operational_records o
      where o.module_key=v_batch.module_key
        and o.source_workbook_key=v_batch.source_workbook_key
        and o.source_sheet_id=v_batch.source_sheet_id
        and o.source_locator=v_row.source_locator
      limit 1;
      update public.tfi_import_rows
      set duplicate_status='exact_source_duplicate',duplicate_record_id=v_existing_id,
          import_status='skipped_existing'
      where id=v_row.id;
      v_skipped := v_skipped+1;
    else
      update public.tfi_import_rows
      set import_status='inserted',destination_record_id=v_new_id
      where id=v_row.id;
      v_inserted := v_inserted+1;
      if v_row.completeness_status='incomplete' then
        v_incomplete := v_incomplete+1;
      end if;
    end if;
  end loop;

  select
    count(*) filter(where import_status='pending'),
    count(*) filter(where import_status='held'),
    count(*) filter(where import_status='failed'),
    count(*) filter(where import_status='skipped_existing')
  into v_pending,v_held,v_failed,v_skipped
  from public.tfi_import_rows
  where batch_id=p_batch_id;

  select count(*) into v_incomplete
  from public.tfi_operational_records o
  where o.source_batch_id=p_batch_id and o.completeness_status='incomplete';

  update public.tfi_import_batches b
  set rows_inserted=(select count(*) from public.tfi_operational_records o where o.source_batch_id=p_batch_id),
      rows_incomplete=v_incomplete,
      rows_duplicates=v_skipped,
      rows_held=v_held,
      rows_failed=v_failed,
      status=case
        when v_pending>0 or v_held>0 then 'review'
        when v_skipped>0 or v_failed>0 or v_incomplete>0 then 'completed_with_issues'
        else 'completed'
      end,
      completed_at=case when v_pending=0 and v_held=0 then now() else null end
  where b.id=p_batch_id
  returning * into v_batch;

  v_issue_count := v_skipped+v_held+v_failed+v_incomplete;
  perform private.tfi_write_import_audit_event(
    'import.batch.finalized','spreadsheet_import','import_batch',v_batch.id::text,
    jsonb_build_object('status','review'),
    jsonb_build_object(
      'status',v_batch.status,'rows_inserted',v_batch.rows_inserted,
      'rows_duplicates',v_batch.rows_duplicates,'rows_held',v_batch.rows_held,
      'rows_failed',v_batch.rows_failed,'rows_incomplete',v_batch.rows_incomplete
    ),
    jsonb_build_object('module_key',v_batch.module_key,'selected_rows',cardinality(p_row_ids),'issue_count',v_issue_count)
  );

  return jsonb_build_object(
    'id',v_batch.id,'batch_ref',v_batch.batch_ref,'status',v_batch.status,
    'rows_inserted',v_batch.rows_inserted,'rows_duplicates',v_batch.rows_duplicates,
    'rows_held',v_batch.rows_held,'rows_failed',v_batch.rows_failed,
    'rows_incomplete',v_batch.rows_incomplete,'rows_pending',v_pending
  );
end;
$function$;


revoke all on function private.tfi_write_import_audit_event(text,text,text,text,jsonb,jsonb,jsonb)
  from public,anon,authenticated;
revoke all on function private.tfi_create_import_batch(text,text,text,text,text,bigint,text,bigint)
  from public,anon,authenticated;
revoke all on function private.tfi_stage_import_rows(uuid,jsonb)
  from public,anon,authenticated;
revoke all on function private.tfi_complete_import_scan(uuid,jsonb)
  from public,anon,authenticated;
revoke all on function private.tfi_fail_import_batch(uuid,text)
  from public,anon,authenticated;
revoke all on function private.tfi_set_import_row_decision(uuid,uuid,text,text)
  from public,anon,authenticated;
revoke all on function private.tfi_finalize_import_batch(uuid,uuid[])
  from public,anon,authenticated;

grant execute on function private.tfi_create_import_batch(text,text,text,text,text,bigint,text,bigint)
  to authenticated;
grant execute on function private.tfi_stage_import_rows(uuid,jsonb)
  to authenticated;
grant execute on function private.tfi_complete_import_scan(uuid,jsonb)
  to authenticated;
grant execute on function private.tfi_fail_import_batch(uuid,text)
  to authenticated;
grant execute on function private.tfi_set_import_row_decision(uuid,uuid,text,text)
  to authenticated;
grant execute on function private.tfi_finalize_import_batch(uuid,uuid[])
  to authenticated;

create or replace function public.tfi_create_import_batch(
  p_module_key text,p_source_type text,p_source_name text,p_source_workbook_key text,
  p_source_file_sha256 text,p_source_file_size bigint,p_source_spreadsheet_id text,
  p_source_sheet_id bigint
)
returns jsonb
language sql
security invoker
set search_path to ''
as $function$
  select private.tfi_create_import_batch($1,$2,$3,$4,$5,$6,$7,$8);
$function$;

create or replace function public.tfi_stage_import_rows(p_batch_id uuid,p_rows jsonb)
returns jsonb
language sql
security invoker
set search_path to ''
as $function$
  select private.tfi_stage_import_rows($1,$2);
$function$;

create or replace function public.tfi_complete_import_scan(p_batch_id uuid,p_scan_stats jsonb)
returns jsonb
language sql
security invoker
set search_path to ''
as $function$
  select private.tfi_complete_import_scan($1,$2);
$function$;

create or replace function public.tfi_fail_import_batch(p_batch_id uuid,p_error_message text)
returns jsonb
language sql
security invoker
set search_path to ''
as $function$
  select private.tfi_fail_import_batch($1,$2);
$function$;

create or replace function public.tfi_set_import_row_decision(
  p_batch_id uuid,p_row_id uuid,p_decision text,p_reason text default null
)
returns jsonb
language sql
security invoker
set search_path to ''
as $function$
  select private.tfi_set_import_row_decision($1,$2,$3,$4);
$function$;

create or replace function public.tfi_finalize_import_batch(p_batch_id uuid,p_row_ids uuid[])
returns jsonb
language sql
security invoker
set search_path to ''
as $function$
  select private.tfi_finalize_import_batch($1,$2);
$function$;

revoke all on function public.tfi_create_import_batch(text,text,text,text,text,bigint,text,bigint)
  from public,anon,authenticated;
revoke all on function public.tfi_stage_import_rows(uuid,jsonb)
  from public,anon,authenticated;
revoke all on function public.tfi_complete_import_scan(uuid,jsonb)
  from public,anon,authenticated;
revoke all on function public.tfi_fail_import_batch(uuid,text)
  from public,anon,authenticated;
revoke all on function public.tfi_set_import_row_decision(uuid,uuid,text,text)
  from public,anon,authenticated;
revoke all on function public.tfi_finalize_import_batch(uuid,uuid[])
  from public,anon,authenticated;

grant execute on function public.tfi_create_import_batch(text,text,text,text,text,bigint,text,bigint)
  to authenticated;
grant execute on function public.tfi_stage_import_rows(uuid,jsonb)
  to authenticated;
grant execute on function public.tfi_complete_import_scan(uuid,jsonb)
  to authenticated;
grant execute on function public.tfi_fail_import_batch(uuid,text)
  to authenticated;
grant execute on function public.tfi_set_import_row_decision(uuid,uuid,text,text)
  to authenticated;
grant execute on function public.tfi_finalize_import_batch(uuid,uuid[])
  to authenticated;

notify pgrst,'reload schema';
commit;
