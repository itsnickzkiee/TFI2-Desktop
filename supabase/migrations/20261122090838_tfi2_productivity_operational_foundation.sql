-- TFI2 Phase 5 — Productivity operational foundation.
-- Additive only. Source formulas are resolved from DMP Production and Master Data.
begin;

create table public.tfi_productivity_records (
  id uuid primary key default gen_random_uuid(),
  production_date date not null check (isfinite(production_date)),
  product_code text not null check (length(btrim(product_code)) between 1 and 100),
  line text not null check (length(btrim(line)) between 1 and 100),
  planned_run_hours numeric(16,4) not null check (planned_run_hours >= 0),
  actual_output_tins numeric(18,4) not null check (actual_output_tins >= 0),
  dented numeric(18,4) not null default 0 check (dented >= 0),
  false_seam numeric(18,4) not null default 0 check (false_seam >= 0),
  flipper numeric(18,4) not null default 0 check (flipper >= 0),
  bulged numeric(18,4) not null default 0 check (bulged >= 0),
  panel numeric(18,4) not null default 0 check (panel >= 0),
  buckling numeric(18,4) not null default 0 check (buckling >= 0),
  version integer not null default 1 check (version > 0),
  record_status text not null default 'active' check (record_status in ('active','archived')),
  source_import_row_id uuid unique references public.tfi_import_rows(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  archived_at timestamptz,
  archived_by uuid references auth.users(id) on delete set null,
  constraint tfi_productivity_archive_state check (
    (record_status='archived' and archived_at is not null)
    or (record_status<>'archived' and archived_at is null)
  )
);

create unique index tfi_productivity_business_key
  on public.tfi_productivity_records (production_date, lower(btrim(product_code)))
  where record_status='active';
create index tfi_productivity_date_idx
  on public.tfi_productivity_records (production_date desc, created_at desc);
create index tfi_productivity_product_code_idx
  on public.tfi_productivity_records (product_code);
create index tfi_productivity_line_idx
  on public.tfi_productivity_records (line);
create index tfi_productivity_created_by_idx
  on public.tfi_productivity_records (created_by);

create table public.tfi_productivity_revisions (
  id uuid primary key default gen_random_uuid(),
  productivity_record_id uuid not null references public.tfi_productivity_records(id) on delete restrict,
  version integer not null check (version > 1),
  before_data jsonb not null check (jsonb_typeof(before_data)='object'),
  after_data jsonb not null check (jsonb_typeof(after_data)='object'),
  changed_fields text[] not null check (cardinality(changed_fields)>0),
  change_reason text check (change_reason is null or length(change_reason)<=500),
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now(),
  unique (productivity_record_id,version)
);
create index tfi_productivity_revisions_row_order_idx
  on public.tfi_productivity_revisions (productivity_record_id,version desc);

alter table public.tfi_productivity_records enable row level security;
alter table public.tfi_productivity_revisions enable row level security;
revoke all on public.tfi_productivity_records, public.tfi_productivity_revisions from public,anon,authenticated;
grant select on public.tfi_productivity_records, public.tfi_productivity_revisions to authenticated;

create policy tfi_productivity_records_authorized_read
on public.tfi_productivity_records for select to authenticated
using (private.tfi_has_permission('productivity','view'));
create policy tfi_productivity_revisions_authorized_read
on public.tfi_productivity_revisions for select to authenticated
using (private.tfi_has_permission('productivity','view'));

comment on table public.tfi_productivity_records is
  'New TFI2 Productivity A:K source inputs only. L:V are calculated from approved DMP Production and Master Data references. No hard-delete path.';
comment on table public.tfi_productivity_revisions is
  'Append-only before/after history for Productivity edits.';

create or replace view public.tfi_productivity_record_view
as
select
  r.id, r.production_date, r.product_code, r.line,
  r.planned_run_hours, r.actual_output_tins,
  r.dented, r.false_seam, r.flipper, r.bulged, r.panel, r.buckling,
  (r.dented+r.false_seam+r.flipper+r.bulged+r.panel+r.buckling) as total_fg_rejects,
  coalesce(dmp.manpower_hours,0::numeric) as manpower_hours_dmp,
  case when std.standard_capacity is null then 0::numeric
       else (std.standard_capacity/10::numeric)*r.planned_run_hours end as target_output_12h_tins,
  coalesce(std.standard_productivity,0::numeric) as standard_productivity_tins_per_mhr,
  case when coalesce(std.standard_productivity,0)>0 and coalesce(dmp.manpower_hours,0)>0
       then std.standard_productivity*dmp.manpower_hours else 0::numeric end as standard_output_actual_mhr,
  case when coalesce(dmp.manpower_hours,0)>0
       then r.actual_output_tins/dmp.manpower_hours else null end as productivity_tins_per_mhr,
  case when coalesce(std.standard_capacity,0)>0 and ((std.standard_capacity/10::numeric)*r.planned_run_hours)>0
       then r.actual_output_tins/((std.standard_capacity/10::numeric)*r.planned_run_hours)
       else null end as output_attainment,
  case when r.actual_output_tins+
    (r.dented+r.false_seam+r.flipper+r.bulged+r.panel+r.buckling)>0
       then (r.dented+r.false_seam+r.flipper+r.bulged+r.panel+r.buckling)/
         (r.actual_output_tins+r.dented+r.false_seam+r.flipper+r.bulged+r.panel+r.buckling)
       else null end as reject_rate,
  extract(week from r.production_date)::integer as iso_week,
  extract(month from r.production_date)::integer as month_number,
  coalesce(cm.product_name,'Other') as product_name,
  r.version, r.record_status, r.created_at, r.updated_at,
  r.created_by, r.updated_by, r.source_import_row_id
from public.tfi_productivity_records r
left join lateral (
  select sum(dp.total_time_hours) as manpower_hours
  from public.tfi_dmp_production_records dp
  where dp.record_status='active'
    and dp.production_date=r.production_date
    and dp.product_code=r.product_code
) dmp on true
left join lateral (
  select
    case when nullif(replace(btrim(m.current_values->>5),',',''),'') ~ '^-?[0-9]+([.][0-9]+)?$'
         then replace(btrim(m.current_values->>5),',','')::numeric else null end as standard_capacity,
    case when nullif(btrim(m.current_values->>7),'') ~ '^-?[0-9]+([.][0-9]+)?$'
         then (m.current_values->>7)::numeric else null end as standard_productivity
  from public.tfi_master_data_rows m
  where m.category_key='product_standard'
    and m.row_kind='data' and m.record_status='active'
    and lower(btrim(m.current_values->>0))=lower(btrim(r.product_code))
  order by m.source_row_number
  limit 1
) std on true
left join lateral (
  select nullif(btrim(c.current_values->>1),'') as product_name
  from public.tfi_master_data_rows c
  where c.category_key='code_map'
    and c.row_kind='data' and c.record_status='active'
    and lower(btrim(c.current_values->>0))=lower(btrim(r.product_code))
  order by c.source_row_number
  limit 1
) cm on true
where r.record_status='active';

revoke all on public.tfi_productivity_record_view from public,anon,authenticated;

commit;
