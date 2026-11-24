create table if not exists public.tfi_pr_monitoring_records (
  id uuid primary key default gen_random_uuid(),
  source_spreadsheet_id text not null default '1rCbQ16wj7MRjQCFF3tA-WEMkudraJK0RkwcqayUlz7k',
  source_sheet_id bigint not null default 867256143,
  source_sheet_title text not null default 'PR MONITORING',
  source_row_number integer not null,
  column_a text,
  pr_no text not null,
  date_pr_received date,
  pr_required_quantity_tins numeric(18,4),
  production_produced_tins numeric(18,4),
  for_production_quantity_tins numeric(18,4),
  status text,
  source_values jsonb not null,
  source_formulas jsonb not null default '{}'::jsonb,
  source_fingerprint text not null,
  source_import_row_id uuid not null unique references public.tfi_import_rows(id) on delete restrict,
  import_batch_id uuid not null references public.tfi_import_batches(id) on delete restrict,
  imported_by uuid references auth.users(id) on delete restrict,
  imported_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint tfi_pr_monitoring_source_identity check (
    source_spreadsheet_id='1rCbQ16wj7MRjQCFF3tA-WEMkudraJK0RkwcqayUlz7k'
    and source_sheet_id=867256143
    and source_sheet_title='PR MONITORING'
  ),
  constraint tfi_pr_monitoring_source_row_check check (source_row_number between 4 and 1000),
  constraint tfi_pr_monitoring_pr_no_check check (length(btrim(pr_no)) between 1 and 100),
  constraint tfi_pr_monitoring_not_group_total check (
    lower(btrim(coalesce(column_a,''))) not like '% total'
  ),
  constraint tfi_pr_monitoring_status_check check (
    status is null or status in ('Pending for Production','Complete','Over Produce')
  ),
  constraint tfi_pr_monitoring_source_values_check check (
    jsonb_typeof(source_values)='array' and jsonb_array_length(source_values)=7
  ),
  constraint tfi_pr_monitoring_source_formulas_check check (jsonb_typeof(source_formulas)='object'),
  constraint tfi_pr_monitoring_fingerprint_check check (source_fingerprint ~ '^[0-9a-f]{64}$'),
  constraint tfi_pr_monitoring_source_row_unique unique(source_spreadsheet_id,source_sheet_id,source_row_number)
);

create index if not exists tfi_pr_monitoring_date_received_idx
  on public.tfi_pr_monitoring_records(date_pr_received desc,source_row_number);
create index if not exists tfi_pr_monitoring_pr_no_idx
  on public.tfi_pr_monitoring_records(pr_no);
create index if not exists tfi_pr_monitoring_status_date_idx
  on public.tfi_pr_monitoring_records(status,date_pr_received desc);
create index if not exists tfi_pr_monitoring_source_import_idx
  on public.tfi_pr_monitoring_records(source_import_row_id);

comment on table public.tfi_pr_monitoring_records is
  'Read-only canonical PR Monitoring register. Rows are populated only by approved Phase 6 import promotion; no manual create/edit/delete workflow.';
comment on column public.tfi_pr_monitoring_records.column_a is
  'Source column A has a deliberately blank header and contains product/group labels.';
comment on column public.tfi_pr_monitoring_records.pr_no is
  'Source column B stored as text to preserve leading zeros.';
comment on column public.tfi_pr_monitoring_records.for_production_quantity_tins is
  'Source column F stored as supplied; never recalculated from columns D and E.';
comment on column public.tfi_pr_monitoring_records.status is
  'Source column G formula result captured as read-only source value; never recalculated by TFI2.';

alter table public.tfi_pr_monitoring_records enable row level security;
revoke all on public.tfi_pr_monitoring_records from public,anon,authenticated;
grant select on public.tfi_pr_monitoring_records to authenticated;
create policy tfi_pr_monitoring_records_authorized_read
  on public.tfi_pr_monitoring_records
  for select to authenticated
  using ((select private.tfi_has_permission('pr_monitoring','view')));

insert into public.tfi_permissions(module_key,action_key,permission_key,display_label)
values
  ('pr_monitoring','view','pr_monitoring.view','View — PR Monitoring'),
  ('pr_monitoring','export','pr_monitoring.export','Export — PR Monitoring')
on conflict (module_key,action_key) do nothing;

insert into public.tfi_role_permissions(role_id,permission_id,granted_by)
select r.id,p.id,null
from public.tfi_roles r
join public.tfi_permissions p on p.module_key='pr_monitoring' and p.action_key in ('view','export')
where r.role_key='system_admin'
on conflict (role_id,permission_id) do nothing;

create or replace function public.tfi_get_pr_monitoring_records(
  p_date_from date default null,
  p_date_to date default null,
  p_pr_no text default null,
  p_status text default null,
  p_search text default null,
  p_sort_key text default null,
  p_sort_direction text default 'asc',
  p_page integer default 1,
  p_page_size integer default 100
)
returns jsonb
language plpgsql
stable
security invoker
set search_path to ''
as $function$
declare
  v_total bigint;
  v_records jsonb;
  v_pr_no text:=nullif(btrim(p_pr_no),'');
  v_search text:=nullif(btrim(p_search),'');
  v_sort_key text:=nullif(btrim(p_sort_key),'');
  v_sort_direction text:=lower(coalesce(nullif(btrim(p_sort_direction),''),'asc'));
begin
  if not private.tfi_has_permission('pr_monitoring','view') then
    raise exception using errcode='42501',message='pr_monitoring_permission_denied';
  end if;
  if p_page is null or p_page<1 or p_page_size is null or p_page_size<1 or p_page_size>1000 then
    raise exception using errcode='22023',message='pr_monitoring_invalid_pagination';
  end if;
  if p_date_from is not null and p_date_to is not null and p_date_from>p_date_to then
    raise exception using errcode='22023',message='pr_monitoring_invalid_date_range';
  end if;
  if p_status is not null and p_status not in ('Pending for Production','Complete','Over Produce') then
    raise exception using errcode='22023',message='pr_monitoring_invalid_status';
  end if;
  if v_sort_direction not in ('asc','desc') then
    raise exception using errcode='22023',message='pr_monitoring_invalid_sort_direction';
  end if;
  if v_sort_key is not null and v_sort_key not in (
    'column_a','pr_no','date_pr_received','pr_required_quantity_tins',
    'production_produced_tins','for_production_quantity_tins','status'
  ) then
    raise exception using errcode='22023',message='pr_monitoring_invalid_sort_key';
  end if;

  select count(*) into v_total
  from public.tfi_pr_monitoring_records r
  where (p_date_from is null or r.date_pr_received>=p_date_from)
    and (p_date_to is null or r.date_pr_received<=p_date_to)
    and (v_pr_no is null or r.pr_no ilike '%'||v_pr_no||'%')
    and (p_status is null or r.status=p_status)
    and (
      v_search is null
      or concat_ws(' ',r.column_a,r.pr_no,r.date_pr_received::text,
        to_char(r.date_pr_received,'FMMonth FMDD, YYYY'),
        r.pr_required_quantity_tins::text,r.production_produced_tins::text,
        r.for_production_quantity_tins::text,r.status
      ) ilike '%'||v_search||'%'
    );

  select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) into v_records
  from (
    select r.id,r.source_row_number,r.column_a,r.pr_no,r.date_pr_received,
      r.pr_required_quantity_tins,r.production_produced_tins,
      r.for_production_quantity_tins,r.status,r.source_sheet_id,
      r.source_sheet_title,r.source_row_number as source_row,
      r.import_batch_id,r.imported_at
    from public.tfi_pr_monitoring_records r
    where (p_date_from is null or r.date_pr_received>=p_date_from)
      and (p_date_to is null or r.date_pr_received<=p_date_to)
      and (v_pr_no is null or r.pr_no ilike '%'||v_pr_no||'%')
      and (p_status is null or r.status=p_status)
      and (
        v_search is null
        or concat_ws(' ',r.column_a,r.pr_no,r.date_pr_received::text,
          to_char(r.date_pr_received,'FMMonth FMDD, YYYY'),
          r.pr_required_quantity_tins::text,r.production_produced_tins::text,
          r.for_production_quantity_tins::text,r.status
        ) ilike '%'||v_search||'%'
      )
    order by
      case when v_sort_key in ('column_a','pr_no','status') and v_sort_direction='asc'
        then case v_sort_key when 'column_a' then r.column_a when 'pr_no' then r.pr_no when 'status' then r.status end end asc nulls last,
      case when v_sort_key in ('column_a','pr_no','status') and v_sort_direction='desc'
        then case v_sort_key when 'column_a' then r.column_a when 'pr_no' then r.pr_no when 'status' then r.status end end desc nulls last,
      case when v_sort_key='date_pr_received' and v_sort_direction='asc' then r.date_pr_received end asc nulls last,
      case when v_sort_key='date_pr_received' and v_sort_direction='desc' then r.date_pr_received end desc nulls last,
      case when v_sort_key='pr_required_quantity_tins' and v_sort_direction='asc' then r.pr_required_quantity_tins end asc nulls last,
      case when v_sort_key='pr_required_quantity_tins' and v_sort_direction='desc' then r.pr_required_quantity_tins end desc nulls last,
      case when v_sort_key='production_produced_tins' and v_sort_direction='asc' then r.production_produced_tins end asc nulls last,
      case when v_sort_key='production_produced_tins' and v_sort_direction='desc' then r.production_produced_tins end desc nulls last,
      case when v_sort_key='for_production_quantity_tins' and v_sort_direction='asc' then r.for_production_quantity_tins end asc nulls last,
      case when v_sort_key='for_production_quantity_tins' and v_sort_direction='desc' then r.for_production_quantity_tins end desc nulls last,
      r.source_row_number asc
    limit p_page_size offset ((p_page-1)*p_page_size)
  ) q;

  return jsonb_build_object(
    'records',v_records,'total_count',v_total,'page',p_page,'page_size',p_page_size,
    'has_more',(p_page*p_page_size)<v_total
  );
end;
$function$;

revoke all on function public.tfi_get_pr_monitoring_records(date,date,text,text,text,text,text,integer,integer) from public,anon;
grant execute on function public.tfi_get_pr_monitoring_records(date,date,text,text,text,text,text,integer,integer) to authenticated;
