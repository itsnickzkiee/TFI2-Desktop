-- Add per-product totals to the existing permission-gated hourly aggregates.
do $migration$
declare
  definition text := pg_get_functiondef(
    'private.tfi_get_dashboard_analytics(date,date,text,text,text)'::regprocedure
  );
  hourly_cte constant text := '), per_hour as (';
  series_key constant text := $key$'hourly_series',coalesce((select points from series),'[]'::jsonb)$key$;
begin
  if (length(definition) - length(replace(definition, hourly_cte, ''))) <> 3 * length(hourly_cte)
    or (length(definition) - length(replace(definition, series_key, ''))) <> 3 * length(series_key) then
    raise exception 'Expected three hourly dashboard aggregates';
  end if;

  definition := replace(definition, hourly_cte, $body$), per_product as (
      select product_code, min(nullif(btrim(product_name),'')) as product_name,
        count(*) as record_count, coalesce(sum(target_tins),0) as target_tins,
        coalesce(sum(actual_tins),0) as actual_tins,
        coalesce(sum(variance_tins),0) as variance_tins
      from filtered
      group by product_code
    ), per_hour as ($body$);

  definition := replace(definition, series_key, series_key || $body$,
        'product_breakdown', coalesce((
          select jsonb_agg(to_jsonb(product) order by product.actual_tins desc, product.product_code)
          from per_product product
        ),'[]'::jsonb)$body$);

  execute definition;
end;
$migration$;
