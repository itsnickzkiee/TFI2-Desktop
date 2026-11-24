-- TFI2 DMP Production: return imported records in original spreadsheet row order.
-- Read-only listing RPC; existing DMP records and import provenance remain unchanged.

begin;

create or replace function private.tfi_list_dmp_production_records(
  p_limit integer default 100,
  p_offset integer default 0,
  p_date_from date default null,
  p_date_to date default null
)
returns setof public.tfi_dmp_production_records
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  if auth.uid() is null or not private.tfi_has_permission('dmp_production','view') then
    raise exception using errcode='42501', message='dmp_production_view_permission_required';
  end if;

  if p_limit is null or p_limit < 1 or p_limit > 100
     or p_offset is null or p_offset < 0
     or (p_date_from is not null and p_date_to is not null and p_date_from > p_date_to) then
    raise exception using errcode='22023', message='dmp_production_list_parameters_invalid';
  end if;

  return query
  select d.*
  from public.tfi_dmp_production_records d
  left join public.tfi_import_rows ir on ir.id=d.source_import_row_id
  where d.record_status='active'
    and (p_date_from is null or d.production_date >= p_date_from)
    and (p_date_to is null or d.production_date <= p_date_to)
  order by
    ir.source_row_number asc nulls last,
    d.production_date asc nulls last,
    d.created_at asc,
    d.id asc
  limit p_limit
  offset p_offset;
end;
$function$;

revoke all on function private.tfi_list_dmp_production_records(integer,integer,date,date)
from public, anon, authenticated;
grant execute on function private.tfi_list_dmp_production_records(integer,integer,date,date)
to authenticated;

create or replace function public.tfi_list_dmp_production_records(
  p_limit integer default 100,
  p_offset integer default 0,
  p_date_from date default null,
  p_date_to date default null
)
returns setof public.tfi_dmp_production_records
language sql
security invoker
set search_path to ''
as $function$
  select *
  from private.tfi_list_dmp_production_records($1,$2,$3,$4);
$function$;

revoke all on function public.tfi_list_dmp_production_records(integer,integer,date,date)
from public, anon, authenticated;
grant execute on function public.tfi_list_dmp_production_records(integer,integer,date,date)
to authenticated;

commit;
