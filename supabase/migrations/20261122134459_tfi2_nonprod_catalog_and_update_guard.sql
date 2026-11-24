create or replace function private.tfi_get_nonprod_catalog()
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_names jsonb; v_positions jsonb; v_activities jsonb; v_locations jsonb;
begin
 if auth.uid() is null or not private.tfi_has_permission('nonprod','view') then raise exception using errcode='42501',message='nonprod_view_permission_required'; end if;
 select coalesce(jsonb_agg(value order by source_row_number),'[]'::jsonb) into v_names from (
  select source_row_number,current_values->>0 as value from public.tfi_master_data_rows where category_key='manpower' and row_kind='data' and record_status='active' and nullif(current_values->>0,'') is not null and source_row_number between 4 and 500) v;
 select coalesce(jsonb_agg(value order by first_row),'[]'::jsonb) into v_positions from (
  select btrim(current_values->>1) value,min(source_row_number) first_row from public.tfi_master_data_rows where category_key='manpower' and row_kind='data' and record_status='active' and source_row_number between 4 and 16 and nullif(btrim(current_values->>1),'') is not null group by btrim(current_values->>1)) v;
 select coalesce(jsonb_agg(value order by first_row),'[]'::jsonb) into v_activities from (
  select btrim(current_values->>2) value,min(source_row_number) first_row from public.tfi_master_data_rows where category_key='manpower' and row_kind='data' and record_status='active' and source_row_number between 4 and 60 and nullif(btrim(current_values->>2),'') is not null group by btrim(current_values->>2)) v;
 select coalesce(jsonb_agg(value order by first_row),'[]'::jsonb) into v_locations from (
  select btrim(current_values->>3) value,min(source_row_number) first_row from public.tfi_master_data_rows where category_key='manpower' and row_kind='data' and record_status='active' and source_row_number between 4 and 39 and nullif(btrim(current_values->>3),'') is not null group by btrim(current_values->>3)) v;
 return jsonb_build_object('source',jsonb_build_object('workbook_id','1rCbQ16wj7MRjQCFF3tA-WEMkudraJK0RkwcqayUlz7k','sheet_name','NON-PROD','sheet_id',1381857831,'header_rows',jsonb_build_array(1,2),'first_data_row',3,'working_hours_formula','Total of minutes / 60'),'names',v_names,'positions',v_positions,'activities',v_activities,'locations',v_locations);
end; $$;

create or replace function private.tfi_update_nonprod_record(p_record_id uuid,p_expected_version integer,p_changes jsonb,p_change_reason text default null)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid(); v_row public.tfi_nonprod_records%rowtype; v_before jsonb; v_after jsonb; v_changed text[];
begin
 if v_user is null or not private.tfi_has_permission('nonprod','edit') then raise exception using errcode='42501',message='nonprod_edit_permission_required'; end if;
 if p_expected_version is null or p_expected_version<1 or p_changes is null or jsonb_typeof(p_changes)<>'object' or p_changes='{}'::jsonb then raise exception using errcode='22023',message='nonprod_changes_required'; end if;
 if exists(select 1 from jsonb_object_keys(p_changes) as x(k) where k not in ('work_date','employee_name','employee_position','time_start','time_end','total_minutes','activity','location','remarks')) then raise exception using errcode='22023',message='nonprod_derived_or_unknown_field'; end if;
 if p_change_reason is not null and length(p_change_reason)>500 then raise exception using errcode='22023',message='nonprod_change_reason_invalid'; end if;
 select * into v_row from public.tfi_nonprod_records where id=p_record_id and record_status='active' for update;
 if not found then raise exception using errcode='P0002',message='nonprod_record_not_found'; end if;
 if v_row.version<>p_expected_version then raise exception using errcode='40001',message='nonprod_version_conflict'; end if;
 v_before:=jsonb_build_object('work_date',v_row.work_date,'employee_name',v_row.employee_name,'employee_position',v_row.employee_position,'time_start',v_row.time_start,'time_end',v_row.time_end,'total_minutes',v_row.total_minutes,'working_hours',v_row.working_hours,'activity',v_row.activity,'location',v_row.location,'remarks',v_row.remarks);
 update public.tfi_nonprod_records set work_date=case when p_changes?'work_date' then nullif(btrim(p_changes->>'work_date'),'')::date else work_date end,
 employee_name=case when p_changes?'employee_name' then nullif(btrim(p_changes->>'employee_name'),'') else employee_name end,
 employee_position=case when p_changes?'employee_position' then nullif(btrim(p_changes->>'employee_position'),'') else employee_position end,
 time_start=case when p_changes?'time_start' then nullif(btrim(p_changes->>'time_start'),'')::time else time_start end,
 time_end=case when p_changes?'time_end' then nullif(btrim(p_changes->>'time_end'),'')::time else time_end end,
 total_minutes=case when p_changes?'total_minutes' then nullif(btrim(p_changes->>'total_minutes'),'')::integer else total_minutes end,
 activity=case when p_changes?'activity' then nullif(btrim(p_changes->>'activity'),'') else activity end,
 location=case when p_changes?'location' then nullif(btrim(p_changes->>'location'),'') else location end,
 remarks=case when p_changes?'remarks' then nullif(btrim(p_changes->>'remarks'),'') else remarks end,
 version=version+1,updated_by=v_user,updated_at=now() where id=p_record_id returning * into v_row;
 v_after:=jsonb_build_object('work_date',v_row.work_date,'employee_name',v_row.employee_name,'employee_position',v_row.employee_position,'time_start',v_row.time_start,'time_end',v_row.time_end,'total_minutes',v_row.total_minutes,'working_hours',v_row.working_hours,'activity',v_row.activity,'location',v_row.location,'remarks',v_row.remarks);
 select array_agg(b.key order by b.key) into v_changed from jsonb_each(v_before) b join jsonb_each(v_after) a using(key) where b.value is distinct from a.value;
 if coalesce(cardinality(v_changed),0)>0 then insert into public.tfi_nonprod_revisions(nonprod_record_id,version,before_data,after_data,changed_fields,change_reason,changed_by) values(p_record_id,v_row.version,v_before,v_after,v_changed,p_change_reason,v_user); end if;
 return jsonb_build_object('id',p_record_id,'version',v_row.version,'changed_fields',coalesce(to_jsonb(v_changed),'[]'::jsonb));
end; $$;