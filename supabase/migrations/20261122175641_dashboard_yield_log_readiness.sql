-- Keep the Dashboard KPI readiness contract aligned with the read-only Yield Log projection.
-- The source formula engine is served by GET /api/yield/log; the Summary worksheet
-- remains a separate pending projection until its own formula contract is complete.

create or replace function public.tfi_get_dashboard_analytics(
  p_date_from date default null::date,
  p_date_to date default null::date,
  p_product_code text default null::text,
  p_product_name text default null::text,
  p_machine text default null::text
)
returns jsonb
language sql
set search_path to ''
as $function$
  with source_payload as (
    select private.tfi_get_dashboard_analytics(
      p_date_from,
      p_date_to,
      p_product_code,
      p_product_name,
      p_machine
    ) as payload
  )
  select source_payload.payload
    || jsonb_build_object(
      'readiness',
      coalesce(source_payload.payload->'readiness', '{}'::jsonb)
      || jsonb_build_object(
        'yield_kpis',
        jsonb_build_object(
          'status', 'implemented_read_only_projection',
          'api_route', 'GET /api/yield/log',
          'product_mappings', 39,
          'formula_dependency_cells_audited', 955,
          'calculation', 'Recalculate source Yield Map-selected Product Entry formulas at read time; never persist calculated values into operational records.',
          'source', 'TFI2 Product Entry records, Yield Map Master Data, KPI Setup M2, and DMR Production when the source-mapped SUMIFS formula is needed.',
          'live_data_acceptance', 'Pending until eligible Product Entry and DMR Production source records exist.'
        ),
        'pending_kpi_groups',
        (
          select coalesce(
            jsonb_agg(item.value order by item.ordinality),
            '[]'::jsonb
          )
          from jsonb_array_elements_text(
            coalesce(
              source_payload.payload->'readiness'->'pending_kpi_groups',
              '[]'::jsonb
            )
          ) with ordinality as item(value, ordinality)
          where item.value <> 'Yield Log formula projection'
        )
      )
    )
  from source_payload;
$function$;
