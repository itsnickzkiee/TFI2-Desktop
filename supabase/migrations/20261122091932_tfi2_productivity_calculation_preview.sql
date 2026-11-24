create or replace function private.tfi_get_productivity_preview(p_record_data jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare
  v_date date; v_code text; v_planned numeric:=0; v_actual numeric:=0;
  v_dented numeric:=0; v_false_seam numeric:=0; v_flipper numeric:=0; v_bulged numeric:=0; v_panel numeric:=0; v_buckling numeric:=0;
  v_rejects numeric; v_mhr numeric:=0; v_capacity numeric:=0; v_standard numeric:=0; v_name text:='Other';
begin
  if auth.uid() is null or not private.tfi_has_permission('productivity','view') then
    raise exception using errcode='42501',message='productivity_view_permission_required';
  end if;
  if p_record_data is null or jsonb_typeof(p_record_data)<>'object'
    or exists(select 1 from jsonb_object_keys(p_record_data) k where k not in
      ('production_date','product_code','line','planned_run_hours','actual_output_tins','dented','false_seam','flipper','bulged','panel','buckling')) then
    raise exception using errcode='22023',message='productivity_preview_shape_invalid';
  end if;
  begin
    v_date:=nullif(btrim(p_record_data->>'production_date'),'')::date;
    v_code:=nullif(btrim(p_record_data->>'product_code'),'');
    v_planned:=coalesce(nullif(p_record_data->>'planned_run_hours','')::numeric,0);
    v_actual:=coalesce(nullif(p_record_data->>'actual_output_tins','')::numeric,0);
    v_dented:=coalesce(nullif(p_record_data->>'dented','')::numeric,0);
    v_false_seam:=coalesce(nullif(p_record_data->>'false_seam','')::numeric,0);
    v_flipper:=coalesce(nullif(p_record_data->>'flipper','')::numeric,0);
    v_bulged:=coalesce(nullif(p_record_data->>'bulged','')::numeric,0);
    v_panel:=coalesce(nullif(p_record_data->>'panel','')::numeric,0);
    v_buckling:=coalesce(nullif(p_record_data->>'buckling','')::numeric,0);
  exception when others then raise exception using errcode='22023',message='productivity_preview_value_invalid'; end;
  if v_date is null or v_code is null or length(v_code)>100
    or v_planned<0 or v_actual<0 or v_dented<0 or v_false_seam<0 or v_flipper<0 or v_bulged<0 or v_panel<0 or v_buckling<0 then
    raise exception using errcode='22023',message='productivity_preview_value_invalid';
  end if;

  select coalesce(sum(dp.total_time_hours),0) into v_mhr
  from public.tfi_dmp_production_records dp
  where dp.record_status='active' and dp.production_date=v_date
    and lower(btrim(coalesce(dp.product_code,'')))=lower(v_code);

  select
    case when nullif(replace(btrim(m.current_values->>5),',',''),'') ~ '^[0-9]+([.][0-9]+)?$'
      then replace(btrim(m.current_values->>5),',','')::numeric else 0::numeric end,
    case when nullif(replace(btrim(m.current_values->>7),',',''),'') ~ '^[0-9]+([.][0-9]+)?$'
      then replace(btrim(m.current_values->>7),',','')::numeric else 0::numeric end
  into v_capacity,v_standard
  from public.tfi_master_data_rows m
  where m.category_key='product_standard' and m.row_kind='data' and m.record_status='active'
    and lower(btrim(m.current_values->>0))=lower(v_code)
  order by m.source_row_number limit 1;
  v_capacity:=coalesce(v_capacity,0); v_standard:=coalesce(v_standard,0);

  select coalesce(nullif(btrim(c.current_values->>1),''),'Other') into v_name
  from public.tfi_master_data_rows c
  where c.category_key='code_map' and c.row_kind='data' and c.record_status='active'
    and lower(btrim(c.current_values->>0))=lower(v_code)
  order by c.source_row_number limit 1;
  v_name:=coalesce(v_name,'Other');
  v_rejects:=v_dented+v_false_seam+v_flipper+v_bulged+v_panel+v_buckling;

  return jsonb_build_object(
    'total_fg_rejects',v_rejects,
    'manpower_hours_dmp',v_mhr,
    'target_output_12h_tins',(v_capacity/10::numeric)*v_planned,
    'standard_productivity_tins_per_mhr',v_standard,
    'standard_output_actual_mhr',case when v_standard>0 and v_mhr>0 then v_standard*v_mhr else 0 end,
    'productivity_tins_per_mhr',case when v_mhr>0 then v_actual/v_mhr else null end,
    'output_attainment',case when (v_capacity/10::numeric)*v_planned>0 then v_actual/((v_capacity/10::numeric)*v_planned) else null end,
    'reject_rate',case when v_actual+v_rejects>0 then v_rejects/(v_actual+v_rejects) else null end,
    'iso_week',extract(week from v_date)::integer,
    'month_number',extract(month from v_date)::integer,
    'product_name',v_name
  );
end;
$function$;
revoke all on function private.tfi_get_productivity_preview(jsonb) from public,anon;
grant execute on function private.tfi_get_productivity_preview(jsonb) to authenticated;
create or replace function public.tfi_get_productivity_preview(p_record_data jsonb)
returns jsonb language sql security invoker set search_path=''
as $function$ select private.tfi_get_productivity_preview(p_record_data); $function$;
revoke all on function public.tfi_get_productivity_preview(jsonb) from public,anon;
grant execute on function public.tfi_get_productivity_preview(jsonb) to authenticated;
