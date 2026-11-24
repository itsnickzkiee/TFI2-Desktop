-- TFI2 Phase 5 — connect the Schedule Summary Day filter to its live register RPC.
-- Adds a server-side day predicate and searches all visible Schedule Summary fields.
begin;

create or replace function private.tfi_get_production_schedule_records(
  p_date_from date default null,
  p_date_to date default null,
  p_day text default null,
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
    where (p_day is null or day ilike '%'||p_day||'%')
      and (p_line is null or line ilike '%'||p_line||'%')
      and (p_area is null or area ilike '%'||p_area||'%')
      and (p_product_name is null or product_name ilike '%'||p_product_name||'%')
      and (p_production_code is null or production_code ilike '%'||p_production_code||'%')
      and (p_pr_number is null or pr_number ilike '%'||p_pr_number||'%')
      and (p_search is null or concat_ws(' ',production_date::text,day,line,area,product_name,production_code,batches::text,target::text,revised_target::text,um,quantity_tins::text,quantity_box::text,required_pax::text,pr_number,remarks,fc_idc_ref,shift_hours::text,available_pax_total::text,saved_on::text) ilike '%'||p_search||'%')
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

create or replace function public.tfi_get_production_schedule_records(
  p_date_from date default null,
  p_date_to date default null,
  p_day text default null,
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
returns jsonb language sql security invoker set search_path to ''
as $function$
  select private.tfi_get_production_schedule_records(
    $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13
  );
$function$;

revoke all on function private.tfi_get_production_schedule_records(date,date,text,text,text,text,text,text,text,integer,integer,text,text)
from public,anon,authenticated;
grant execute on function private.tfi_get_production_schedule_records(date,date,text,text,text,text,text,text,text,integer,integer,text,text)
to authenticated;

revoke all on function public.tfi_get_production_schedule_records(date,date,text,text,text,text,text,text,text,integer,integer,text,text)
from public,anon,authenticated;
grant execute on function public.tfi_get_production_schedule_records(date,date,text,text,text,text,text,text,text,integer,integer,text,text)
to authenticated;

commit;
