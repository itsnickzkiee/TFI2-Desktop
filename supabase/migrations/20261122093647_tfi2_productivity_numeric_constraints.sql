create or replace function private.tfi_productivity_nonnegative(p_value numeric)
returns boolean language sql immutable set search_path=''
as $function$
  select p_value is not null and p_value::text ~ '^[0-9]+([.][0-9]{1,4})?$';
$function$;
revoke all on function private.tfi_productivity_nonnegative(numeric) from public,anon,authenticated;

alter table public.tfi_productivity_records
  add constraint tfi_productivity_numeric_finite_check check (
    private.tfi_productivity_nonnegative(planned_run_hours)
    and private.tfi_productivity_nonnegative(actual_output_tins)
    and private.tfi_productivity_nonnegative(dented)
    and private.tfi_productivity_nonnegative(false_seam)
    and private.tfi_productivity_nonnegative(flipper)
    and private.tfi_productivity_nonnegative(bulged)
    and private.tfi_productivity_nonnegative(panel)
    and private.tfi_productivity_nonnegative(buckling)
  );
