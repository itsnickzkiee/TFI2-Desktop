CREATE OR REPLACE FUNCTION private.tfi_update_coding_dpr_record(p_record_id uuid, p_expected_version integer, p_changes jsonb, p_change_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_row public.tfi_coding_dpr_entries%rowtype;v_user_id uuid:=auth.uid();v_context jsonb;
  v_date date;v_line text;v_lot jsonb;v_lots jsonb;v_lot_index integer;v_lot_date date;v_code text;v_quantity numeric;
  v_fingerprint text;v_before jsonb;v_after jsonb;v_changed text[]:=array[]::text[];v_version integer;
begin
  if v_user_id is null or not private.tfi_has_permission('coding_dpr','view')
    or not private.tfi_has_permission('coding_dpr','edit') then
    raise exception using errcode='42501',message='coding_dpr_edit_permission_required';
  end if;
  if p_expected_version is null or p_expected_version<1 or p_changes is null or jsonb_typeof(p_changes)<>'object'
    or exists(select 1 from jsonb_object_keys(p_changes) k where k not in ('coding_date','line_number','lots')) then
    raise exception using errcode='22023',message='coding_dpr_update_request_invalid';
  end if;
  select * into v_row from public.tfi_coding_dpr_entries where id=p_record_id and record_status='active' for update;
  if not found then raise exception using errcode='P0002',message='coding_dpr_record_not_found'; end if;
  if v_row.version<>p_expected_version then raise exception using errcode='40001',message='coding_dpr_version_conflict'; end if;
  begin
    v_date:=nullif(btrim(p_changes->>'coding_date'),'')::date;
    v_line:=nullif(btrim(p_changes->>'line_number'),'');
  exception when others then raise exception using errcode='22023',message='coding_dpr_invalid_field_value'; end;
  if v_line is not null and (length(v_line)>20 or not exists(
    select 1 from public.tfi_master_data_rows m where m.category_key='dmp_legend' and m.row_kind='data'
      and m.record_status='active' and btrim(coalesce(m.current_values->>3,''))=v_line
  )) then raise exception using errcode='22023',message='coding_dpr_invalid_line_number'; end if;
  if jsonb_typeof(p_changes->'lots')<>'array' or jsonb_array_length(p_changes->'lots')<>7 then
    raise exception using errcode='22023',message='coding_dpr_requires_seven_lot_slots';
  end if;
  v_lots:='[]'::jsonb;
  for v_lot,v_lot_index in select value,ordinality::integer from jsonb_array_elements(p_changes->'lots') with ordinality loop
    if jsonb_typeof(v_lot)<>'object' or exists(select 1 from jsonb_object_keys(v_lot) k where k not in ('lot_number','production_date','product_code','quantity')) then
      raise exception using errcode='22023',message='coding_dpr_lot_shape_invalid';
    end if;
    begin
      if (v_lot->>'lot_number')::integer<>v_lot_index then raise exception using errcode='22023',message='coding_dpr_lot_order_invalid'; end if;
      v_lot_date:=nullif(btrim(v_lot->>'production_date'),'')::date;
      v_code:=nullif(btrim(v_lot->>'product_code'),'');
      v_quantity:=nullif(v_lot->>'quantity','')::numeric;
    exception when others then raise exception using errcode='22023',message='coding_dpr_invalid_lot_value'; end;
    if (v_code is not null and length(v_code)>100)
      or (v_quantity is not null and (v_quantity<0 or v_quantity::text !~ '^[0-9]+([.][0-9]{1,4})?$')) then
      raise exception using errcode='22023',message='coding_dpr_invalid_lot_value';
    end if;
    v_lots:=v_lots||jsonb_build_array(jsonb_build_object(
      'lot_number',v_lot_index,'production_date',v_lot_date,'product_code',v_code,'quantity',v_quantity
    ));
  end loop;
  v_fingerprint:=md5(jsonb_build_object(
    'coding_date',v_date,'line_number',lower(coalesce(v_line,'')),'lots',v_lots
  )::text);
  if v_fingerprint=v_row.record_fingerprint then
    return jsonb_build_object('changed',false,'id',v_row.id,'version',v_row.version);
  end if;
  v_before:=private.tfi_coding_dpr_record_payload(v_row.id);
  if v_date is distinct from v_row.coding_date then v_changed:=array_append(v_changed,'coding_date'); end if;
  if v_line is distinct from v_row.line_number then v_changed:=array_append(v_changed,'line_number'); end if;
  v_version:=v_row.version+1;
  update public.tfi_coding_dpr_entries set coding_date=v_date,line_number=v_line,
    record_fingerprint=v_fingerprint,version=v_version,updated_at=now(),updated_by=v_user_id
  where id=v_row.id;
  delete from public.tfi_coding_dpr_items where coding_dpr_entry_id=v_row.id;
  insert into public.tfi_coding_dpr_items(coding_dpr_entry_id,lot_number,production_date,product_code,quantity)
  select v_row.id,x.lot_number,x.production_date,x.product_code,x.quantity
  from jsonb_to_recordset(v_lots) as x(lot_number smallint,production_date date,product_code text,quantity numeric)
  where x.production_date is not null or x.product_code is not null or x.quantity is not null;
  v_after:=private.tfi_coding_dpr_record_payload(v_row.id);
  if v_before->'lots' is distinct from v_after->'lots' then v_changed:=array_append(v_changed,'lots'); end if;
  insert into public.tfi_coding_dpr_revisions(
    coding_dpr_entry_id,version,before_data,after_data,changed_fields,change_reason,changed_by
  ) values(
    v_row.id,v_version,v_before,v_after,v_changed,
    nullif(left(btrim(coalesce(p_change_reason,'')),500),''),v_user_id
  );
  v_context:=private.tfi_get_my_access_context();
  insert into public.tfi_audit_events(
    actor_user_id,actor_email_snapshot,actor_roles_snapshot,action_key,module_key,entity_type,entity_id,
    before_data,after_data,metadata,occurred_at
  ) values(
    v_user_id,v_context #>> '{profile,email}',coalesce(v_context->'roles','[]'::jsonb),
    'coding_dpr.update','coding_dpr','coding_dpr_entry',v_row.id::text,
    v_before,v_after,jsonb_build_object('changed_fields',to_jsonb(v_changed),
      'change_reason',nullif(left(btrim(coalesce(p_change_reason,'')),500),'')),now()
  );
  return jsonb_build_object('changed',true,'id',v_row.id,'version',v_version,'review_status',v_after->>'review_status');
exception when unique_violation then
  raise exception using errcode='23505',message='coding_dpr_duplicate_record';
end;
$function$
;
