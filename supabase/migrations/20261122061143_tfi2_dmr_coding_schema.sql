create table if not exists public.tfi_dmr_coding_records (
  id uuid primary key default gen_random_uuid(),
  production_date date,
  product_code text,
  line text,
  stop_time time without time zone,
  resume_time time without time zone,
  downtime_minutes numeric(12,4) generated always as (
    case when stop_time is null or resume_time is null then null
      else ((extract(epoch from (resume_time-stop_time))+
        case when resume_time<stop_time then 86400 else 0 end)/60)::numeric(12,4)
    end
  ) stored,
  downtime_hours numeric(12,4) generated always as (
    case when stop_time is null or resume_time is null then null
      else ((extract(epoch from (resume_time-stop_time))+
        case when resume_time<stop_time then 86400 else 0 end)/3600)::numeric(12,4)
    end
  ) stored,
  category text,
  factor text,
  reason text,
  product_code_reference_status text not null default 'not_entered'
    check (product_code_reference_status in ('not_entered','matched','unmatched')),
  completeness_status text not null default 'unassessed'
    check (completeness_status in ('unassessed','complete')),
  record_fingerprint text generated always as (
    md5(
      coalesce((production_date-date '2000-01-01')::text,'') || chr(31) ||
      lower(btrim(coalesce(product_code,''))) || chr(31) ||
      lower(btrim(coalesce(line,''))) || chr(31) ||
      coalesce(extract(epoch from stop_time)::numeric(12,4)::text,'') || chr(31) ||
      coalesce(extract(epoch from resume_time)::numeric(12,4)::text,'') || chr(31) ||
      lower(btrim(coalesce(category,''))) || chr(31) ||
      lower(btrim(coalesce(factor,''))) || chr(31) ||
      btrim(coalesce(reason,''))
    )
  ) stored,
  source_import_row_id uuid unique references public.tfi_import_rows(id) on delete restrict,
  entry_source text not null default 'manual' check (entry_source in ('manual','import')),
  version integer not null default 1 check (version>0),
  record_status text not null default 'active' check (record_status in ('active','archived')),
  created_by uuid not null references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tfi_dmr_coding_product_code_length check (product_code is null or length(product_code)<=100),
  constraint tfi_dmr_coding_line_length check (line is null or length(line)<=80),
  constraint tfi_dmr_coding_category_length check (category is null or length(category)<=80),
  constraint tfi_dmr_coding_factor_length check (factor is null or length(factor)<=120),
  constraint tfi_dmr_coding_reason_length check (reason is null or length(reason)<=1000),
  constraint tfi_dmr_coding_fingerprint_unique unique(record_fingerprint)
);
create index if not exists tfi_dmr_coding_date_created_idx on public.tfi_dmr_coding_records(production_date desc,created_at desc);
create index if not exists tfi_dmr_coding_product_code_idx on public.tfi_dmr_coding_records(product_code);
create index if not exists tfi_dmr_coding_line_date_idx on public.tfi_dmr_coding_records(line,production_date desc);
create index if not exists tfi_dmr_coding_category_idx on public.tfi_dmr_coding_records(category);
alter table public.tfi_dmr_coding_records enable row level security;
revoke all on public.tfi_dmr_coding_records from public,anon,authenticated;
grant select on public.tfi_dmr_coding_records to authenticated;
create policy tfi_dmr_coding_records_authorized_read on public.tfi_dmr_coding_records for select to authenticated
  using ((select private.tfi_has_permission('dmr_coding','view')));

create table if not exists public.tfi_dmr_coding_revisions (
  id uuid primary key default gen_random_uuid(),
  dmr_coding_record_id uuid not null references public.tfi_dmr_coding_records(id) on delete restrict,
  version integer not null check (version>1),
  before_data jsonb not null check (jsonb_typeof(before_data)='object'),
  after_data jsonb not null check (jsonb_typeof(after_data)='object'),
  changed_fields text[] not null check (cardinality(changed_fields)>0),
  change_reason text check (change_reason is null or length(change_reason)<=500),
  changed_by uuid references auth.users(id),
  changed_at timestamptz not null default now(),
  unique(dmr_coding_record_id,version)
);
create index if not exists tfi_dmr_coding_revisions_record_order_idx
  on public.tfi_dmr_coding_revisions(dmr_coding_record_id,version desc);
alter table public.tfi_dmr_coding_revisions enable row level security;
revoke all on public.tfi_dmr_coding_revisions from public,anon,authenticated;
grant select on public.tfi_dmr_coding_revisions to authenticated;
create policy tfi_dmr_coding_revisions_authorized_read on public.tfi_dmr_coding_revisions for select to authenticated
  using ((select private.tfi_has_permission('dmr_coding','view')));
