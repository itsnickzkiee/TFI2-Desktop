create or replace view public.tfi_hourly_production_record_view
with (security_invoker=true) as
select
  r.id,r.module_key,r.production_date,r.hour,r.product_code,r.target_tins,r.actual_tins,r.remarks,
  case when r.product_code is null then null else coalesce(nullif(btrim(cm.product_name),''),'Other') end as product_name,
  case when r.hour is null then null else
    to_char(make_time(r.hour::integer,0,0),'HH24:MI') || '-' ||
    to_char(make_time(((r.hour::integer+1)%24),0,0),'HH24:MI') end as time_slot,
  case when r.target_tins is null or r.actual_tins is null then null
    else r.actual_tins-r.target_tins end as variance_tins,
  case when r.production_date is null or r.hour is null or r.product_code is null then null
    else sum(coalesce(r.target_tins,0)) over (
      partition by r.module_key,r.production_date,r.product_code
      order by r.hour rows between unbounded preceding and current row
    ) end as cumulative_target_tins,
  case when r.production_date is null or r.hour is null or r.product_code is null or r.actual_tins is null then null
    else sum(coalesce(r.actual_tins,0)) over (
      partition by r.module_key,r.production_date,r.product_code
      order by r.hour rows between unbounded preceding and current row
    ) end as cumulative_actual_tins,
  case when r.target_tins is null or r.target_tins=0 or r.actual_tins is null then null
    else r.actual_tins/r.target_tins end as hour_attainment,
  r.product_code_reference_status,r.source_import_row_id,r.entry_source,r.version,r.record_status,
  r.created_by,r.updated_by,r.created_at,r.updated_at,
  r.production_date as record_date
from public.tfi_hourly_production_records r
left join lateral (
  select nullif(btrim(md.current_values->>1),'') as product_name
  from public.tfi_master_data_rows md
  where md.category_key='code_map' and md.row_kind='data' and md.record_status='active'
    and btrim(coalesce(md.current_values->>0,''))=r.product_code
  order by md.source_row_number
  limit 1
) cm on true
where r.record_status='active';
grant select on public.tfi_hourly_production_record_view to authenticated;
