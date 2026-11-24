create or replace function private.tfi_get_dashboard_analytics(
  p_date_from date default null,
  p_date_to date default null,
  p_product_code text default null,
  p_product_name text default null,
  p_machine text default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_productivity jsonb := jsonb_build_object('status','restricted');
  v_dmr_production jsonb := jsonb_build_object('status','restricted');
  v_dmr_coding jsonb := jsonb_build_object('status','restricted');
  v_oee jsonb := jsonb_build_object('status','restricted');
  v_hourly jsonb := '{}'::jsonb;
  v_production_entry jsonb := jsonb_build_object('status','restricted');
  v_production_schedule jsonb := jsonb_build_object('status','restricted');
  v_yield jsonb := jsonb_build_object(
    'status','pending_formula_engine',
    'reason','Yield Log reads formula-only Product Entry columns selected by Yield Map. Those formula outputs are not yet persisted or recalculated in TFI2.'
  );
  v_product_code text := nullif(btrim(coalesce(p_product_code,'')),'');
  v_product_name text := nullif(btrim(coalesce(p_product_name,'')),'');
  v_machine text := nullif(btrim(coalesce(p_machine,'')),'');
  v_productivity_count integer := 0;
  v_total_output numeric := 0;
  v_total_target numeric := 0;
  v_output_with_target numeric := 0;
  v_planned_run_hours numeric := 0;
  v_manpower_hours numeric := 0;
  v_output_with_mhr numeric := 0;
  v_standard_output numeric := 0;
  v_standard_mhr numeric := 0;
  v_output_standard_rows numeric := 0;
  v_fg_rejects numeric := 0;
  v_downtime_hours numeric := 0;
  v_bd_hours numeric := 0;
  v_bd_count integer := 0;
  v_has_productivity boolean := false;
  v_has_dmr_production boolean := false;
  v_has_dmr_coding boolean := false;
  v_has_oee boolean := false;
  v_has_hourly_meat boolean := false;
  v_has_hourly_coding boolean := false;
  v_has_hourly_agri boolean := false;
  v_has_production_entry boolean := false;
  v_has_production_schedule boolean := false;
begin
  if v_user_id is null then
    raise exception using errcode='42501', message='authentication_required';
  end if;
  if not private.tfi_has_permission('dashboard','view') then
    raise exception using errcode='42501', message='dashboard_view_permission_required';
  end if;
  if p_date_from is not null and p_date_to is not null and p_date_from > p_date_to then
    raise exception using errcode='22023', message='dashboard_date_range_invalid';
  end if;
  if length(coalesce(v_product_code,'')) > 100
    or length(coalesce(v_product_name,'')) > 160
    or length(coalesce(v_machine,'')) > 200 then
    raise exception using errcode='22023', message='dashboard_filter_invalid';
  end if;

  v_has_productivity := private.tfi_has_permission('productivity','view')
    and private.tfi_has_permission('dmp_production','view');
  v_has_dmr_production := private.tfi_has_permission('dmr_production','view');
  v_has_dmr_coding := private.tfi_has_permission('dmr_coding','view');
  v_has_oee := private.tfi_has_permission('oee','view');
  v_has_hourly_meat := private.tfi_has_permission('hourly_meat','view');
  v_has_hourly_coding := private.tfi_has_permission('hourly_coding','view');
  v_has_hourly_agri := private.tfi_has_permission('hourly_agri','view');
  v_has_production_entry := private.tfi_has_permission('production_entry','view');
  v_has_production_schedule := private.tfi_has_permission('production_schedule','view');

  if v_has_productivity then
    with filtered as (
      select v.*
      from public.tfi_productivity_record_view v
      where v.record_status='active'
        and (p_date_from is null or v.production_date>=p_date_from)
        and (p_date_to is null or v.production_date<=p_date_to)
        and (v_product_code is null or v.product_code=v_product_code)
        and (v_product_name is null or v.product_name=v_product_name)
    )
    select
      count(*)::integer,
      coalesce(sum(actual_output_tins),0),
      coalesce(sum(target_output_12h_tins),0),
      coalesce(sum(actual_output_tins) filter (where coalesce(target_output_12h_tins,0)>0),0),
      coalesce(sum(planned_run_hours),0),
      coalesce(sum(manpower_hours_dmp),0),
      coalesce(sum(actual_output_tins) filter (where coalesce(manpower_hours_dmp,0)>0),0),
      coalesce(sum(standard_output_actual_mhr),0),
      coalesce(sum(manpower_hours_dmp) filter (where coalesce(standard_output_actual_mhr,0)>0),0),
      coalesce(sum(actual_output_tins) filter (where coalesce(standard_output_actual_mhr,0)>0),0),
      coalesce(sum(total_fg_rejects),0),
      jsonb_build_object(
        'status', case when count(*)=0 then 'empty' else 'available' end,
        'record_count',count(*)::integer,
        'total_output_tins',coalesce(sum(actual_output_tins),0),
        'target_output_tins',coalesce(sum(target_output_12h_tins),0),
        'output_with_target_tins',coalesce(sum(actual_output_tins) filter (where coalesce(target_output_12h_tins,0)>0),0),
        'planned_run_hours',coalesce(sum(planned_run_hours),0),
        'manpower_hours',coalesce(sum(manpower_hours_dmp),0),
        'output_with_manpower_hours',coalesce(sum(actual_output_tins) filter (where coalesce(manpower_hours_dmp,0)>0),0),
        'standard_output_actual_mhr',coalesce(sum(standard_output_actual_mhr),0),
        'standard_manpower_hours',coalesce(sum(manpower_hours_dmp) filter (where coalesce(standard_output_actual_mhr,0)>0),0),
        'output_on_standard_rows',coalesce(sum(actual_output_tins) filter (where coalesce(standard_output_actual_mhr,0)>0),0),
        'total_fg_rejects',coalesce(sum(total_fg_rejects),0),
        'dented',coalesce(sum(dented),0),
        'false_seam',coalesce(sum(false_seam),0),
        'flipper',coalesce(sum(flipper),0),
        'bulged',coalesce(sum(bulged),0),
        'panel',coalesce(sum(panel),0),
        'buckling',coalesce(sum(buckling),0),
        'output_attainment',case when coalesce(sum(target_output_12h_tins),0)>0
          then coalesce(sum(actual_output_tins) filter (where coalesce(target_output_12h_tins,0)>0),0)/sum(target_output_12h_tins) else null end,
        'productivity_tins_per_mhr',case when coalesce(sum(manpower_hours_dmp),0)>0
          then coalesce(sum(actual_output_tins) filter (where coalesce(manpower_hours_dmp,0)>0),0)/sum(manpower_hours_dmp) else null end,
        'standard_productivity_tins_per_mhr',case when coalesce(sum(manpower_hours_dmp) filter (where coalesce(standard_output_actual_mhr,0)>0),0)>0
          then coalesce(sum(standard_output_actual_mhr),0)/sum(manpower_hours_dmp) filter (where coalesce(standard_output_actual_mhr,0)>0) else null end,
        'productivity_vs_standard',case when coalesce(sum(standard_output_actual_mhr),0)>0
          then coalesce(sum(actual_output_tins) filter (where coalesce(standard_output_actual_mhr,0)>0),0)/sum(standard_output_actual_mhr) else null end,
        'fg_reject_pct',case when coalesce(sum(actual_output_tins),0)+coalesce(sum(total_fg_rejects),0)>0
          then coalesce(sum(total_fg_rejects),0)/(sum(actual_output_tins)+sum(total_fg_rejects)) else null end
      )
    into
      v_productivity_count,v_total_output,v_total_target,v_output_with_target,
      v_planned_run_hours,v_manpower_hours,v_output_with_mhr,v_standard_output,
      v_standard_mhr,v_output_standard_rows,v_fg_rejects,v_productivity
    from filtered;
  end if;

  if v_has_dmr_production then
    with filtered as (
      select r.production_date,r.product_code,r.category,r.downtime_minutes,
        coalesce(cm.product_name,'Other') as product_name,
        coalesce(km.group_name,'Process / Other') as downtime_group
      from public.tfi_dmr_production_records r
      left join lateral (
        select md.current_values->>1 as product_name
        from public.tfi_master_data_rows md
        where md.category_key='code_map' and md.record_status='active'
          and md.current_values->>0=r.product_code
        order by md.source_row_number limit 1
      ) cm on true
      left join lateral (
        select md.current_values->>15 as group_name
        from public.tfi_master_data_rows md
        where md.category_key='kpi_setup' and md.record_status='active'
          and md.current_values->>14=r.category
        order by md.source_row_number limit 1
      ) km on true
      where r.record_status='active'
        and (p_date_from is null or r.production_date>=p_date_from)
        and (p_date_to is null or r.production_date<=p_date_to)
        and (v_product_code is null or r.product_code=v_product_code)
        and (v_product_name is null or coalesce(cm.product_name,'Other')=v_product_name)
    )
    select
      coalesce(sum(downtime_minutes),0)/60.0,
      coalesce(sum(downtime_minutes) filter(where category='BD'),0)/60.0,
      count(*) filter(where category='BD')::integer,
      jsonb_build_object(
        'status',case when count(*)=0 then 'empty' else 'available' end,
        'record_count',count(*)::integer,
        'total_downtime_hours',coalesce(sum(downtime_minutes),0)/60.0,
        'breakdown_hours',coalesce(sum(downtime_minutes) filter(where category='BD'),0)/60.0,
        'breakdown_count',count(*) filter(where category='BD')::integer,
        'category_hours',jsonb_build_object(
          'BD',coalesce(sum(downtime_minutes) filter(where category='BD'),0)/60.0,
          'MS',coalesce(sum(downtime_minutes) filter(where category='MS'),0)/60.0,
          'QA',coalesce(sum(downtime_minutes) filter(where category='QA'),0)/60.0,
          'SET-UP',coalesce(sum(downtime_minutes) filter(where category='SET-UP'),0)/60.0,
          'MN',coalesce(sum(downtime_minutes) filter(where category='MN'),0)/60.0,
          'CLN',coalesce(sum(downtime_minutes) filter(where category='CLN'),0)/60.0,
          'CO',coalesce(sum(downtime_minutes) filter(where category='CO'),0)/60.0,
          'RND',coalesce(sum(downtime_minutes) filter(where category='RND'),0)/60.0
        ),
        'machine_hours',coalesce(sum(downtime_minutes) filter(where downtime_group='Machine'),0)/60.0,
        'manpower_hours',coalesce(sum(downtime_minutes) filter(where downtime_group='Manpower'),0)/60.0,
        'material_hours',coalesce(sum(downtime_minutes) filter(where downtime_group='Material'),0)/60.0,
        'quality_hours',coalesce(sum(downtime_minutes) filter(where downtime_group='Quality'),0)/60.0,
        'process_other_hours',coalesce(sum(downtime_minutes) filter(where downtime_group='Process / Other'),0)/60.0,
        'unmapped_category_hours',coalesce(sum(downtime_minutes) filter(where category not in ('BD','MS','QA','SET-UP','MN','CLN','CO','RND')),0)/60.0
      )
    into v_downtime_hours,v_bd_hours,v_bd_count,v_dmr_production
    from filtered;
  end if;

  if v_has_dmr_coding then
    with filtered as (
      select r.downtime_hours
      from public.tfi_dmr_coding_records r
      left join lateral (
        select md.current_values->>1 as product_name
        from public.tfi_master_data_rows md
        where md.category_key='code_map' and md.record_status='active'
          and md.current_values->>0=r.product_code
        order by md.source_row_number limit 1
      ) cm on true
      where r.record_status='active'
        and (p_date_from is null or r.production_date>=p_date_from)
        and (p_date_to is null or r.production_date<=p_date_to)
        and (v_product_code is null or r.product_code=v_product_code)
        and (v_product_name is null or coalesce(cm.product_name,'Other')=v_product_name)
    )
    select jsonb_build_object(
      'status',case when count(*)=0 then 'empty' else 'available' end,
      'record_count',count(*)::integer,
      'total_downtime_hours',coalesce(sum(downtime_hours),0)
    ) into v_dmr_coding from filtered;
  end if;

  if v_has_oee then
    with filtered as (
      select v.*
      from public.tfi_oee_record_view v
      where v.record_status='active'
        and (p_date_from is null or v.production_date>=p_date_from)
        and (p_date_to is null or v.production_date<=p_date_to)
        and (v_machine is null or v.machine=v_machine)
        and (v_product_code is null or v.product_code=v_product_code)
        and (v_product_name is null or v.product_name=v_product_name)
        and (v_machine is not null or v.include_in_overall='Y')
    ), totals as (
      select count(*)::integer record_count,
        count(*) filter(where include_in_overall='Y')::integer included_rows,
        coalesce(sum(planned_hours),0) total_planned_hours,
        coalesce(sum(run_time_hours),0) total_run_time_hours,
        coalesce(sum(total_count),0) total_count,
        coalesce(sum(good_count),0) good_count,
        coalesce(sum(ideal_output),0) ideal_output,
        coalesce(sum(capped_count),0) capped_count
      from filtered
    )
    select jsonb_build_object(
      'status',case when record_count=0 then 'empty' else 'available' end,
      'record_count',record_count,
      'included_rows',included_rows,
      'total_planned_hours',total_planned_hours,
      'total_run_time_hours',total_run_time_hours,
      'total_count',total_count,
      'good_count',good_count,
      'ideal_output',ideal_output,
      'capped_count',capped_count,
      'availability',case when total_planned_hours>0 then total_run_time_hours/total_planned_hours else null end,
      'performance',case when ideal_output>0 then capped_count/ideal_output else null end,
      'quality',case when total_count>0 then good_count/total_count else null end,
      'oee',case when total_planned_hours>0 and ideal_output>0 and total_count>0
        then (total_run_time_hours/total_planned_hours)*(capped_count/ideal_output)*(good_count/total_count) else null end
    ) into v_oee from totals;
  end if;

  if v_has_hourly_meat then
    with filtered as (
      select * from public.tfi_hourly_production_record_view v
      where v.module_key='hourly_meat' and v.record_status='active'
        and (p_date_from is null or v.production_date>=p_date_from)
        and (p_date_to is null or v.production_date<=p_date_to)
        and (v_product_code is null or v.product_code=v_product_code)
        and (v_product_name is null or v.product_name=v_product_name)
    ), summary as (
      select count(*)::integer record_count,coalesce(sum(target_tins),0) target_tins,
        coalesce(sum(actual_tins),0) actual_tins,coalesce(sum(variance_tins),0) variance_tins
      from filtered
    ), per_hour as (
      select hour,min(time_slot) as time_slot,sum(target_tins) as target_tins,
        sum(actual_tins) as actual_tins,sum(variance_tins) as variance_tins,
        sum(cumulative_target_tins) as cumulative_target_tins,
        sum(cumulative_actual_tins) as cumulative_actual_tins
      from filtered group by hour
    ), series as (
      select jsonb_agg(jsonb_build_object('hour',hour,'time_slot',time_slot,
        'target_tins',target_tins,'actual_tins',actual_tins,
        'variance_tins',variance_tins,
        'cumulative_target_tins',cumulative_target_tins,
        'cumulative_actual_tins',cumulative_actual_tins
      ) order by hour) points from per_hour
    )
    select jsonb_build_object('hourly_meat',jsonb_build_object(
      'status',case when record_count=0 then 'empty' else 'available' end,
      'record_count',record_count,'target_tins',target_tins,'actual_tins',actual_tins,
      'variance_tins',variance_tins,
      'attainment',case when target_tins>0 then actual_tins/target_tins else null end,
      'hourly_series',coalesce((select points from series),'[]'::jsonb)
    )) into v_hourly from summary;
  end if;

  if v_has_hourly_coding then
    with filtered as (
      select * from public.tfi_hourly_production_record_view v
      where v.module_key='hourly_coding' and v.record_status='active'
        and (p_date_from is null or v.production_date>=p_date_from)
        and (p_date_to is null or v.production_date<=p_date_to)
        and (v_product_code is null or v.product_code=v_product_code)
        and (v_product_name is null or v.product_name=v_product_name)
    ), summary as (
      select count(*)::integer record_count,coalesce(sum(target_tins),0) target_tins,
        coalesce(sum(actual_tins),0) actual_tins,coalesce(sum(variance_tins),0) variance_tins
      from filtered
    ), per_hour as (
      select hour,min(time_slot) as time_slot,sum(target_tins) as target_tins,
        sum(actual_tins) as actual_tins,sum(variance_tins) as variance_tins,
        sum(cumulative_target_tins) as cumulative_target_tins,
        sum(cumulative_actual_tins) as cumulative_actual_tins
      from filtered group by hour
    ), series as (
      select jsonb_agg(jsonb_build_object('hour',hour,'time_slot',time_slot,
        'target_tins',target_tins,'actual_tins',actual_tins,
        'variance_tins',variance_tins,
        'cumulative_target_tins',cumulative_target_tins,
        'cumulative_actual_tins',cumulative_actual_tins
      ) order by hour) points from per_hour
    )
    select v_hourly || jsonb_build_object('hourly_coding',
      jsonb_build_object('status',case when record_count=0 then 'empty' else 'available' end,
        'record_count',record_count,'target_tins',target_tins,'actual_tins',actual_tins,
        'variance_tins',variance_tins,
        'attainment',case when target_tins>0 then actual_tins/target_tins else null end,
        'hourly_series',coalesce((select points from series),'[]'::jsonb)
      )) into v_hourly from summary;
  end if;

  if v_has_hourly_agri then
    with filtered as (
      select * from public.tfi_hourly_production_record_view v
      where v.module_key='hourly_agri' and v.record_status='active'
        and (p_date_from is null or v.production_date>=p_date_from)
        and (p_date_to is null or v.production_date<=p_date_to)
        and (v_product_code is null or v.product_code=v_product_code)
        and (v_product_name is null or v.product_name=v_product_name)
    ), summary as (
      select count(*)::integer record_count,coalesce(sum(target_tins),0) target_tins,
        coalesce(sum(actual_tins),0) actual_tins,coalesce(sum(variance_tins),0) variance_tins
      from filtered
    ), per_hour as (
      select hour,min(time_slot) as time_slot,sum(target_tins) as target_tins,
        sum(actual_tins) as actual_tins,sum(variance_tins) as variance_tins,
        sum(cumulative_target_tins) as cumulative_target_tins,
        sum(cumulative_actual_tins) as cumulative_actual_tins
      from filtered group by hour
    ), series as (
      select jsonb_agg(jsonb_build_object('hour',hour,'time_slot',time_slot,
        'target_tins',target_tins,'actual_tins',actual_tins,
        'variance_tins',variance_tins,
        'cumulative_target_tins',cumulative_target_tins,
        'cumulative_actual_tins',cumulative_actual_tins
      ) order by hour) points from per_hour
    )
    select v_hourly || jsonb_build_object('hourly_agri',
      jsonb_build_object('status',case when record_count=0 then 'empty' else 'available' end,
        'record_count',record_count,'target_tins',target_tins,'actual_tins',actual_tins,
        'variance_tins',variance_tins,
        'attainment',case when target_tins>0 then actual_tins/target_tins else null end,
        'hourly_series',coalesce((select points from series),'[]'::jsonb)
      )) into v_hourly from summary;
  end if;

  if v_has_production_entry then
    select jsonb_build_object(
      'status',case when count(*) filter(where has_data) = 0 then 'empty' else 'available' end,
      'saved_rows',count(*) filter(where has_data)::integer,
      'days_logged',count(distinct production_date) filter(where day_has_data)::integer,
      'average_attainment',avg(attainment) filter(where has_data),
      'average_attendance',avg(attendance) filter(where has_data),
      'overtime_hours',coalesce(sum(ot_hours) filter(where has_data),0),
      'rows_below_95_percent',count(*) filter(where has_data and attainment<0.95)::integer
    ) into v_production_entry
    from public.tfi_production_entry_records
    where record_status='active'
      and (p_date_from is null or production_date>=p_date_from)
      and (p_date_to is null or production_date<=p_date_to);
  end if;

  if v_has_production_schedule then
    v_production_schedule := private.tfi_get_production_schedule_summary();
    v_production_schedule := v_production_schedule || jsonb_build_object(
      'status',case when coalesce((v_production_schedule->>'saved_rows')::integer,0)>0 then 'available' else 'empty' end
    );
  end if;

  v_planned_run_hours := coalesce((v_productivity->>'planned_run_hours')::numeric,0);
  v_downtime_hours := coalesce((v_dmr_production->>'total_downtime_hours')::numeric,0);
  v_bd_hours := coalesce((v_dmr_production->>'breakdown_hours')::numeric,0);
  v_bd_count := coalesce((v_dmr_production->>'breakdown_count')::integer,0);

  return jsonb_build_object(
    'source','TFI2',
    'calculation_contract','source-workbook-2026-11-22-v1',
    'checked_at',extract(epoch from clock_timestamp())::bigint,
    'filters',jsonb_build_object(
      'date_from',p_date_from,'date_to',p_date_to,
      'product_code',v_product_code,'product_name',v_product_name,'machine',v_machine
    ),
    'modules',jsonb_build_object(
      'productivity',v_productivity,
      'dmr_production',v_dmr_production,
      'dmr_coding',v_dmr_coding,
      'oee',v_oee,
      'hourly',v_hourly
    ),
    'metrics',jsonb_build_object(
      'total_output_tins',case when v_has_productivity then coalesce((v_productivity->>'total_output_tins')::numeric,0) else null end,
      'output_attainment',v_productivity->'output_attainment',
      'productivity_tins_per_mhr',v_productivity->'productivity_tins_per_mhr',
      'standard_productivity_tins_per_mhr',v_productivity->'standard_productivity_tins_per_mhr',
      'productivity_vs_standard',v_productivity->'productivity_vs_standard',
      'total_manpower_hours',v_productivity->'manpower_hours',
      'total_fg_rejects',v_productivity->'total_fg_rejects',
      'fg_reject_pct',v_productivity->'fg_reject_pct',
      'planned_run_hours',case when v_has_productivity then v_planned_run_hours else null end,
      'total_downtime_hours',case when v_has_dmr_production then v_downtime_hours else null end,
      'downtime_pct',case when v_has_productivity and v_planned_run_hours>0 and v_has_dmr_production then v_downtime_hours/v_planned_run_hours else null end,
      'machine_downtime_hours',v_dmr_production->'machine_hours',
      'manpower_downtime_hours',v_dmr_production->'manpower_hours',
      'mttr_hours',case when v_has_dmr_production and v_bd_count>0 then v_bd_hours/v_bd_count else null end,
      'mtbf_hours',case when v_has_productivity and v_has_dmr_production and v_bd_count>0 then (v_planned_run_hours-v_downtime_hours)/v_bd_count else null end,
      'availability',v_oee->'availability',
      'performance',v_oee->'performance',
      'quality',v_oee->'quality',
      'oee',v_oee->'oee'
    ),
    'reports',jsonb_build_object(
      'production_summary',v_production_entry,
      'schedule_summary',v_production_schedule,
      'product_entry_summary',jsonb_build_object(
        'status','pending_formula_projection',
        'reason','The source Summary tab depends on Product Entry formula columns. Those formula outputs are not yet stored in the TFI2 operational record projection.'
      ),
      'removed_rows',jsonb_build_object(
        'status','archive_only',
        'reason','Removed Rows is a source archive tab; no canonical TFI2 archive relation is registered for live reporting.'
      )
    ),
    'readiness',jsonb_build_object(
      'yield_kpis',v_yield,
      'verified_kpi_groups',jsonb_build_array('Productivity','Downtime','OEE','Hourly Production','Production Summary'),
      'pending_kpi_groups',jsonb_build_array('Yield Log formula projection','Product Entry Summary projection','Removed Rows archive integration')
    )
  );
end;
$function$;

revoke all on function private.tfi_get_dashboard_analytics(date,date,text,text,text) from public;
grant execute on function private.tfi_get_dashboard_analytics(date,date,text,text,text) to authenticated;

create or replace function public.tfi_get_dashboard_analytics(
  p_date_from date default null,
  p_date_to date default null,
  p_product_code text default null,
  p_product_name text default null,
  p_machine text default null
)
returns jsonb
language sql
security invoker
set search_path to ''
as $function$
  select private.tfi_get_dashboard_analytics(p_date_from,p_date_to,p_product_code,p_product_name,p_machine);
$function$;

revoke all on function public.tfi_get_dashboard_analytics(date,date,text,text,text) from public, anon;
grant execute on function public.tfi_get_dashboard_analytics(date,date,text,text,text) to authenticated;
