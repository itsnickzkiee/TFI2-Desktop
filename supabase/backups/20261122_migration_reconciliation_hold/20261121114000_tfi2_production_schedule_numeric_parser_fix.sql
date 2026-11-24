-- Correct numeric parsing for Production Schedule decimal values.
create or replace function private.tfi_production_schedule_numeric(p_value text)
returns numeric
language plpgsql
immutable
set search_path to ''
as $function$
declare
  v_text text;
begin
  if p_value is null then
    return null;
  end if;
  v_text := regexp_replace(btrim(p_value), ',', '', 'g');
  if v_text = '' or v_text !~ '^[+-]?[0-9]+([.][0-9]+)?$' then
    return null;
  end if;
  return v_text::numeric;
exception when others then
  return null;
end;
$function$;
