-- TFI_NEW / TFI2 — Migration 002: official 35-worksheet source registry.
-- This stores workbook and worksheet metadata only. It does not copy spreadsheet rows or formulas.
-- The source workbook remains read-only and is not a live operational database.

begin;

create table if not exists public.tfi_source_workbooks (
  id uuid primary key default gen_random_uuid(),
  spreadsheet_id text not null unique
    check (length(spreadsheet_id) between 20 and 128),
  title text not null check (length(title) between 1 and 180),
  is_authoritative boolean not null default false,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists tfi_source_workbooks_one_authoritative_uidx
  on public.tfi_source_workbooks (is_authoritative)
  where is_authoritative = true;

create table if not exists public.tfi_source_sheets (
  id uuid primary key default gen_random_uuid(),
  workbook_id uuid not null references public.tfi_source_workbooks(id) on delete restrict,
  sheet_id bigint not null,
  sheet_title text not null check (length(sheet_title) between 1 and 120),
  sheet_index integer not null check (sheet_index >= 0),
  grid_rows integer not null check (grid_rows > 0),
  grid_columns integer not null check (grid_columns > 0),
  header_rows smallint[],
  first_data_row integer check (first_data_row is null or first_data_row > 0),
  source_kind text not null check (source_kind in (
    'documentation','input_form','transaction','mixed_transaction',
    'transaction_history','reference','summary','derived','helper','archive'
  )),
  import_policy text not null check (import_policy in (
    'none','selective','reference_only','derived_only','archive_only'
  )),
  destination_module_key text references public.tfi_modules(module_key) on delete restrict,
  source_notes text,
  created_at timestamptz not null default now(),
  unique (workbook_id,sheet_id),
  unique (workbook_id,sheet_title),
  constraint tfi_source_sheets_header_rows_valid check (
    header_rows is null or (
      cardinality(header_rows) between 1 and 4
      and array_position(header_rows,null) is null
      and 0 < all(header_rows)
    )
  )
);

create index if not exists tfi_source_sheets_destination_idx
  on public.tfi_source_sheets (destination_module_key,sheet_index);

create index if not exists tfi_source_sheets_policy_idx
  on public.tfi_source_sheets (import_policy,source_kind);

comment on table public.tfi_source_workbooks is
  'Approved source-workbook identity registry. This is not a runtime operational dependency.';
comment on table public.tfi_source_sheets is
  'Verified 35-tab workbook metadata and import classification. No source row values are stored here.';

insert into public.tfi_source_workbooks
  (spreadsheet_id,title,is_authoritative,verified_at)
values
  ('1rCbQ16wj7MRjQCFF3tA-WEMkudraJK0RkwcqayUlz7k',
   'Copy of TFI - Production Monitoring Sheet 1',
   true,
   timestamptz '2026-11-20 00:00:00+08')
on conflict (spreadsheet_id) do nothing;

with workbook as (
  select id
  from public.tfi_source_workbooks
  where spreadsheet_id = '1rCbQ16wj7MRjQCFF3tA-WEMkudraJK0RkwcqayUlz7k'
)
insert into public.tfi_source_sheets
  (workbook_id,sheet_id,sheet_title,sheet_index,grid_rows,grid_columns,
   header_rows,first_data_row,source_kind,import_policy,destination_module_key,source_notes)
select workbook.id,v.sheet_id,v.sheet_title,v.sheet_index,v.grid_rows,v.grid_columns,
       v.header_rows,v.first_data_row,v.source_kind,v.import_policy,v.destination_module_key,v.source_notes
from workbook
cross join (values
  (2077282819::bigint,'GUIDELINES',0,1000,26,null::smallint[],null::integer,'documentation','none',null::text,
   'Workbook instructions and workflow notes. Retain as source documentation; do not import as transactions.'),
  (1506213325::bigint,'KPI Dashboard',1,1000,27,null::smallint[],null::integer,'derived','derived_only','dashboard',
   'Formula-driven KPI and production dashboard. Rebuild from canonical TFI2 records; do not import displayed metrics as transactions.'),
  (1923467491::bigint,'Production Entry',2,1000,26,array[6]::smallint[],8,'input_form','selective','production_entry',
   'Daily form with 12 form rows and helper/trace fields. Compare against Production Summary before importing to avoid duplicate saved runs.'),
  (545274882::bigint,'Product Entry',3,39160,164,array[7]::smallint[],8,'transaction','selective','product_entry',
   '39 product-family blocks. Preserve block mapping, source rows, manual inputs, formula outputs, and hidden-column rules.'),
  (1538651320::bigint,'Production Schedule',4,1000,26,array[6]::smallint[],8,'input_form','selective','production_schedule',
   'Daily schedule form. Preserve business fields and source trace; do not import helper columns as separate business fields.'),
  (1750442014::bigint,'OEE',5,4000,21,array[4]::smallint[],5,'transaction','selective','oee',
   'Import source inputs once. Recalculate derived run time, availability, performance, quality, and OEE from approved rules.'),
  (428082343::bigint,'Hourly Meat',6,5004,12,array[4]::smallint[],5,'transaction','selective','hourly_meat',
   'Import input fields only; product name, time slot, variance, cumulative totals, and attainment are derived.'),
  (1916766220::bigint,'Hourly Coding',7,5004,12,array[4]::smallint[],5,'transaction','selective','hourly_coding',
   'Same 12-column source structure as Hourly Meat. Preserve raw input values and source-row identity.'),
  (534145404::bigint,'Hourly Agri',8,5004,12,array[4]::smallint[],5,'transaction','selective','hourly_agri',
   'Same 12-column source structure as Hourly Meat. Preserve raw input values and source-row identity.'),
  (2048043346::bigint,'DMR Production',9,12004,12,array[3]::smallint[],4,'transaction','selective','dmr_production',
   'Only A:H have identified headers in the inspected header row. I:J are blank/unlabelled; do not invent meanings for them.'),
  (675328096::bigint,'DMR Coding',10,12317,11,array[3]::smallint[],4,'transaction','selective','dmr_coding',
   'Product Code validation in the source workbook shows #REF!. Preserve unmatched historical codes; do not invent replacement codes.'),
  (1266086431::bigint,'Coding DPR',11,1000,26,array[2]::smallint[],3,'transaction','selective','coding_dpr',
   'Seven batch groups. Source total formula excludes batch 7 quantity; preserve source behavior until the owner approves a correction. Product Code validations show #REF!.'),
  (867256143::bigint,'PR MONITORING',12,1000,27,array[3]::smallint[],4,'transaction','selective','pr_monitoring',
   'Preserve incomplete identifiable PR candidates and source rows. Exclude product-group totals and blank template rows from PR transactions.'),
  (1359678099::bigint,'co QA',13,2745,40,array[2]::smallint[],3,'mixed_transaction','selective','co_qa',
   'A:X are Product Entry-derived; Y:AD are manual cost inputs; AE:AH are calculated; AI:AL remain unresolved in the inspected source.'),
  (1381857831::bigint,'NON-PROD',14,1000,26,array[1,2]::smallint[],3,'transaction','selective','nonprod',
   'Two header rows. Preserve source dropdown values and distinguish source inputs from the derived working-hours field.'),
  (1312335050::bigint,'DMP - Production',15,7629,9,array[1]::smallint[],2,'transaction','selective','dmp_production',
   'Preserve manpower/process rows and source identities. Product Code validation shows #REF! and requires approved reference mapping.'),
  (583741906::bigint,'MANPOWER',16,1000,26,array[3]::smallint[],4,'reference','reference_only','master_data',
   'Reference source for NON-PROD. Preserve repeated source rows until the data owner approves any merge rule.'),
  (1688444278::bigint,'Productivity',17,1500,22,array[4]::smallint[],5,'transaction','selective','productivity',
   'Import A:K input fields once; calculate derived totals, manpower hours, targets, productivity, attainment, and reject percentages from approved rules.'),
  (1070169465::bigint,'DMP LEGEND',18,1000,26,array[1]::smallint[],2,'reference','reference_only','master_data',
   'Reference data for DMP Production. Preserve blank worker-name cells and source notes; do not infer missing people or HR status.'),
  (720094137::bigint,'Schedule Summary',19,11000,26,array[2]::smallint[],3,'summary','derived_only','reports_reconciliation',
   'Saved schedule history companion to Production Schedule; not a second independent schedule-entry source.'),
  (1846667474::bigint,'Production Summary',20,13188,26,array[6]::smallint[],7,'transaction_history','selective','production_entry',
   'Saved Production Entry history. Use as the historical source and avoid importing the same saved runs again from the daily form.'),
  (1639151211::bigint,'Summary',21,1201,32,array[1,2,3]::smallint[],4,'derived','derived_only','reports_reconciliation',
   'Formula-derived rollup from Product Entry and QA fields. Rebuild from canonical records; do not import as duplicate transactions.'),
  (156467196::bigint,'Schedule Lists',22,1000,26,array[1]::smallint[],2,'reference','reference_only','master_data',
   'Reference list refreshed from Product Standard. Keep as a reference view, not an independent product catalog.'),
  (2138697021::bigint,'Product Standard and Specificat',23,1000,26,array[1,2]::smallint[],3,'reference','reference_only','master_data',
   'Product specification reference. Preserve manual inputs separately from formula-derived capacity and output values.'),
  (508797580::bigint,'DPR LEGEND',24,17972,40,array[2]::smallint[],3,'reference','reference_only','master_data',
   'Reference code lists and formula/helper outputs. Preserve unmatched historical codes; do not silently auto-correct source values.'),
  (1955006742::bigint,'KPI Setup',25,1000,26,array[1]::smallint[],2,'reference','reference_only','master_data',
   'KPI and operational reference settings. Preserve protected values and paired reference groups.'),
  (1639168265::bigint,'KPI Calc',26,520,53,null::smallint[],null::integer,'helper','derived_only','dashboard',
   'Calculation/helper sheet only. Rebuild calculations from approved source inputs and reference data.'),
  (2098561343::bigint,'Code Map',27,1000,26,array[4]::smallint[],5,'reference','reference_only','master_data',
   'Product Code to Product Name mapping. Preserve unmatched mappings for Admin review; do not auto-merge or delete.'),
  (854969610::bigint,'Yield Map',28,1000,26,array[4]::smallint[],5,'reference','reference_only','master_data',
   'Per-product yield/reject source-column mappings and target references. Placeholder yield targets are not approved thresholds.'),
  (743111542::bigint,'Yield Log',29,39043,12,array[4]::smallint[],5,'derived','derived_only','yield_monitoring',
   'Read-only derived view sourced from Product Entry and Yield Map. Do not import Yield Log rows as independent production transactions.'),
  (218696408::bigint,'Dash Calc',30,437,65,null::smallint[],null::integer,'helper','derived_only','dashboard',
   'Dashboard helper calculations only. Rebuild from canonical operational records.'),
  (337985486::bigint,'Hourly Calc',31,1000,32,null::smallint[],null::integer,'helper','derived_only','dashboard',
   'Hourly dashboard helper calculations only. Rebuild from Hourly Meat, Hourly Coding, and Hourly Agri records.'),
  (1628314566::bigint,'Entry Map',32,1000,26,array[1]::smallint[],2,'reference','reference_only','master_data',
   'Product Entry family/block mapping. A new family requires a verified named range and complete product block, not a display row alone.'),
  (832240400::bigint,'Lists',33,1000,26,array[1]::smallint[],2,'reference','reference_only','master_data',
   'Supporting line and UOM values plus source instructions. Use only the required reference values in application workflows.'),
  (1842536867::bigint,'Removed Rows',34,1000,26,array[3]::smallint[],4,'archive','archive_only','reports_reconciliation',
   'Archived removed rows. Preserve reason and source trace; do not silently restore into active operational tables.')
) as v(sheet_id,sheet_title,sheet_index,grid_rows,grid_columns,header_rows,first_data_row,source_kind,import_policy,destination_module_key,source_notes)
on conflict (workbook_id,sheet_id) do nothing;

alter table public.tfi_source_workbooks enable row level security;
alter table public.tfi_source_sheets enable row level security;

drop policy if exists tfi_source_workbooks_active_read on public.tfi_source_workbooks;
create policy tfi_source_workbooks_active_read
on public.tfi_source_workbooks for select to authenticated
using (public.tfi_is_active_user());

drop policy if exists tfi_source_sheets_active_read on public.tfi_source_sheets;
create policy tfi_source_sheets_active_read
on public.tfi_source_sheets for select to authenticated
using (public.tfi_is_active_user());

revoke all on public.tfi_source_workbooks,public.tfi_source_sheets from public,anon,authenticated;
grant select on public.tfi_source_workbooks,public.tfi_source_sheets to authenticated;

commit;