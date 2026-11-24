-- Phase 41.6 follow-up — source manifest support and safe all-sheet raw staging.
-- Production Summary is the only worksheet eligible for mapped Ready-for-Draft classification.
-- Other mapped sheets are preserved as Held for Review until their TFI2 module contracts are implemented.

create or replace function public.tfi_module_import_batch_manifest(p_batch_id uuid,p_manifest jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare v_batch public.tfi_module_import_batches%rowtype; v_actor uuid:=auth.uid();
begin
  if v_actor is null or not private.tfi_has_permission('spreadsheet_import','create') then
    raise exception using errcode='42501',message='spreadsheet_import_create_permission_required';
  end if;
  if p_batch_id is null or p_manifest is null or jsonb_typeof(p_manifest)<>'object'
     or octet_length(p_manifest::text)>200000
     or coalesce(jsonb_typeof(p_manifest->'sheets'),'')<>'array'
     or jsonb_array_length(p_manifest->'sheets')>35 then
    raise exception using errcode='22023',message='invalid_universal_source_manifest';
  end if;
  select * into v_batch from public.tfi_module_import_batches where id=p_batch_id for update;
  if not found then raise exception using errcode='P0002',message='module_import_batch_not_found'; end if;
  if v_batch.imported_by<>v_actor and not private.tfi_has_permission('spreadsheet_import','approve') then
    raise exception using errcode='42501',message='module_import_batch_owner_required';
  end if;
  if p_manifest->>'spreadsheet_id' is distinct from v_batch.spreadsheet_id
     or p_manifest->>'source_sha256' is distinct from v_batch.source_sha256 then
    raise exception using errcode='22023',message='source_manifest_batch_identity_mismatch';
  end if;
  update public.tfi_module_import_batches
  set counts=coalesce(counts,'{}'::jsonb)||jsonb_build_object('source_manifest',p_manifest),
      status=case when status='completed' then status else 'partial' end
  where id=p_batch_id;
  return jsonb_build_object('batch_id',p_batch_id,'manifest_saved',true,
    'sheet_count',jsonb_array_length(p_manifest->'sheets'));
end;
$function$;

create or replace function public.tfi_module_import_inbox_upsert(p_batch_id uuid,p_rows jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare
  r jsonb; v_actor uuid:=auth.uid(); v_batch public.tfi_module_import_batches%rowtype;
  v_created integer:=0; v_unchanged integer:=0; v_seen integer:=0;
  v_module text; v_disposition text; v_validation text; v_source_row integer;
  v_source_slot text; v_source_sheet text; v_source_key text; v_fingerprint text;
  v_raw jsonb; v_formula jsonb; v_formatted jsonb; v_payload jsonb;
  v_issues jsonb; v_details jsonb; v_missing jsonb; v_target_table text;
  v_target_id uuid; v_target_key text; v_sheet public.tfi_source_sheets%rowtype;
  v_expected_module text; v_permission_module text; v_existing_fingerprint text;
  v_final_disposition text; v_final_validation text; v_final_issues jsonb; v_final_details jsonb;
begin
  if v_actor is null or not private.tfi_has_permission('spreadsheet_import','create') then
    raise exception using errcode='42501',message='spreadsheet_import_create_permission_required';
  end if;
  if p_batch_id is null or p_rows is null or jsonb_typeof(p_rows)<>'array'
     or jsonb_array_length(p_rows)<1 or jsonb_array_length(p_rows)>100 then
    raise exception using errcode='22023',message='invalid_module_import_inbox_batch';
  end if;
  select * into v_batch from public.tfi_module_import_batches where id=p_batch_id for update;
  if not found then raise exception using errcode='P0002',message='module_import_batch_not_found'; end if;
  if v_batch.imported_by<>v_actor and not private.tfi_has_permission('spreadsheet_import','approve') then
    raise exception using errcode='42501',message='module_import_batch_owner_required';
  end if;
  if v_batch.spreadsheet_id is distinct from '1rCbQ16wj7MRjQCFF3tA-WEMkudraJK0RkwcqayUlz7k' then
    raise exception using errcode='42501',message='source_workbook_not_authorized_for_tfi2_import';
  end if;

  for r in select value from jsonb_array_elements(p_rows) loop
    v_seen:=v_seen+1;
    v_module:=r->>'module'; v_disposition:=r->>'disposition';
    v_validation:=r->>'validation_state'; v_source_sheet:=r->>'source_sheet';
    v_source_key:=r->>'source_key'; v_source_slot:=coalesce(r->>'source_slot','');
    v_fingerprint:=r->>'source_fingerprint_sha256';
    if v_module is null or v_module not in (
      'productivity','product_entry','production_entry','production_schedule','oee',
      'hourly_meat','hourly_coding','hourly_agri','dmr_production','dmr_coding',
      'coding_dpr','pr_planning','pr_monitoring','co_qa','nonprod','dmp_production',
      'manpower','dmp_reference','schedule_summary','production_summary','schedule_lists',
      'product_standard','dpr_legend','kpi_setup','product_codes','yield_map',
      'product_entry_mapping','lists','removed_rows'
    ) then raise exception using errcode='22023',message='unsupported_source_module'; end if;
    if v_source_sheet is null or length(v_source_sheet) not between 1 and 120
       or v_source_key is null or length(v_source_key) not between 1 and 240
       or length(v_source_slot)>160 or v_fingerprint is null
       or v_fingerprint !~ '^[a-f0-9]{64}$' or jsonb_typeof(r->'source_row')<>'number' then
      raise exception using errcode='22023',message='invalid_module_import_source_identity';
    end if;
    v_source_row:=(r->>'source_row')::integer;
    if v_source_row<1 or v_source_row>50000 then
      raise exception using errcode='22023',message='source_row_out_of_range';
    end if;
    select s.* into v_sheet
    from public.tfi_source_sheets s
    join public.tfi_source_workbooks w on w.id=s.workbook_id
    where w.spreadsheet_id=v_batch.spreadsheet_id and w.is_authoritative
      and s.sheet_title=v_source_sheet;
    if not found then
      raise exception using errcode='42501',message='source_sheet_not_registered_for_authoritative_workbook';
    end if;
    if v_sheet.import_policy in ('none','derived_only') then
      raise exception using errcode='42501',message='derived_or_documentation_sheet_cannot_be_imported';
    end if;
    v_expected_module:=case v_source_sheet
      when 'Production Summary' then 'production_summary'
      when 'Production Entry' then 'production_entry'
      when 'Product Entry' then 'product_entry'
      when 'Production Schedule' then 'production_schedule'
      when 'OEE' then 'oee'
      when 'Hourly Meat' then 'hourly_meat'
      when 'Hourly Coding' then 'hourly_coding'
      when 'Hourly Agri' then 'hourly_agri'
      when 'DMR Production' then 'dmr_production'
      when 'DMR Coding' then 'dmr_coding'
      when 'Coding DPR' then 'coding_dpr'
      when 'PR MONITORING' then 'pr_monitoring'
      when 'co QA' then 'co_qa'
      when 'NON-PROD' then 'nonprod'
      when 'DMP - Production' then 'dmp_production'
      when 'MANPOWER' then 'manpower'
      when 'DMP LEGEND' then 'dmp_reference'
      when 'Schedule Summary' then 'schedule_summary'
      when 'Schedule Lists' then 'schedule_lists'
      when 'Product Standard and Specificat' then 'product_standard'
      when 'DPR LEGEND' then 'dpr_legend'
      when 'KPI Setup' then 'kpi_setup'
      when 'Code Map' then 'product_codes'
      when 'Yield Map' then 'yield_map'
      when 'Entry Map' then 'product_entry_mapping'
      when 'Lists' then 'lists'
      when 'Removed Rows' then 'removed_rows'
      else null end;
    if v_expected_module is null or v_module is distinct from v_expected_module then
      raise exception using errcode='22023',message='source_sheet_module_mapping_mismatch';
    end if;
    if v_source_row < coalesce(v_sheet.first_data_row,1) or v_source_row > v_sheet.grid_rows then
      raise exception using errcode='22023',message='source_row_outside_registered_sheet_range';
    end if;
    if v_source_sheet='Production Summary' then
      if not private.tfi_has_permission('production_entry','import') then
        raise exception using errcode='42501',message='production_entry_import_permission_required';
      end if;
      if v_sheet.source_kind<>'transaction_history' or v_sheet.destination_module_key<>'production_entry' then
        raise exception using errcode='42501',message='production_summary_source_registry_mismatch';
      end if;
    end if;
    if v_disposition not in ('ready_for_draft','imported_draft','incomplete','held_review',
       'duplicate_existing','excluded_derived','blank_template')
       or v_validation not in ('valid','incomplete','invalid','needs_review','duplicate','excluded') then
      raise exception using errcode='22023',message='invalid_module_inbox_classification';
    end if;

    v_raw:=coalesce(r->'raw_source_cells','{}'::jsonb);
    v_formula:=coalesce(r->'formula_provenance','{}'::jsonb);
    v_formatted:=coalesce(r->'formatted_source_cells','{}'::jsonb);
    v_payload:=r->'normalized_payload';
    if jsonb_typeof(v_payload)='null' then v_payload:=null; end if;
    v_issues:=coalesce(r->'issue_codes','[]'::jsonb);
    v_details:=coalesce(r->'issue_details','[]'::jsonb);
    v_missing:=coalesce(r->'missing_fields','[]'::jsonb);
    v_target_table:=nullif(r->>'target_table','');
    v_target_id:=nullif(r->>'target_record_id','')::uuid;
    v_target_key:=nullif(r->>'target_record_key','');
    if jsonb_typeof(v_raw) is distinct from 'object'
       or jsonb_typeof(v_formula) is distinct from 'object'
       or jsonb_typeof(v_formatted) is distinct from 'object'
       or (v_payload is not null and jsonb_typeof(v_payload) is distinct from 'object')
       or jsonb_typeof(v_issues) is distinct from 'array'
       or jsonb_typeof(v_details) is distinct from 'array'
       or jsonb_typeof(v_missing) is distinct from 'array'
       or octet_length(v_raw::text)>100000 or octet_length(v_formula::text)>100000
       or octet_length(v_formatted::text)>100000
       or (v_payload is not null and octet_length(v_payload::text)>100000)
       or octet_length(v_issues::text)>20000 or octet_length(v_details::text)>30000
       or octet_length(v_missing::text)>10000 then
      raise exception using errcode='22023',message='invalid_or_oversized_module_inbox_payload';
    end if;

    select i.source_fingerprint_sha256 into v_existing_fingerprint
    from public.tfi_module_import_inbox i
    where i.source_spreadsheet_id=v_batch.spreadsheet_id
      and i.source_sheet=v_source_sheet and i.source_row=v_source_row
      and i.source_slot=v_source_slot
    order by i.created_at desc limit 1;
    if v_existing_fingerprint is not null and v_existing_fingerprint<>v_fingerprint then
      raise exception using errcode='23505',message='source_row_changed_since_previous_capture_review_existing_inbox_row';
    end if;

    v_final_disposition:=v_disposition;
    v_final_validation:=v_validation;
    v_final_issues:=v_issues;
    v_final_details:=v_details;
    if v_source_sheet<>'Production Summary'
       and v_disposition not in ('duplicate_existing','excluded_derived','blank_template') then
      v_final_disposition:='held_review';
      v_final_validation:='needs_review';
      v_final_issues:=v_issues||jsonb_build_array('phase41_6_module_backend_pending');
      v_final_details:=v_details||jsonb_build_array('Raw source preserved in TFI2 Import Inbox. Module-specific validation and promotion are not yet enabled; no operational record was written.');
    end if;

    insert into public.tfi_module_import_inbox(
      module,source_spreadsheet_id,source_sheet,source_row,source_slot,source_key,
      source_fingerprint_sha256,raw_source_cells,formula_provenance,formatted_source_cells,
      normalized_payload,validation_state,issue_codes,issue_details,missing_fields,
      disposition,target_table,target_record_id,target_record_key,batch_id,created_by,updated_by
    ) values (
      v_module,v_batch.spreadsheet_id,v_source_sheet,v_source_row,v_source_slot,v_source_key,
      v_fingerprint,v_raw,v_formula,v_formatted,v_payload,v_final_validation,v_final_issues,v_final_details,v_missing,
      v_final_disposition,v_target_table,v_target_id,v_target_key,p_batch_id,v_actor,v_actor
    ) on conflict (source_spreadsheet_id,source_sheet,source_row,source_slot,source_fingerprint_sha256) do nothing;
    if found then v_created:=v_created+1; else v_unchanged:=v_unchanged+1; end if;
  end loop;

  update public.tfi_module_import_batches
  set status=case when status='completed' and v_created=0 then 'completed' else 'partial' end,
      counts=coalesce(counts,'{}'::jsonb)||jsonb_build_object(
        'received',coalesce((counts->>'received')::integer,0)+v_seen,
        'created',coalesce((counts->>'created')::integer,0)+v_created,
        'unchanged',coalesce((counts->>'unchanged')::integer,0)+v_unchanged
      )
  where id=p_batch_id;
  return jsonb_build_object('received',v_seen,'created',v_created,'unchanged',v_unchanged,
    'status','saved','legacy_kpi_changed',false);
end;
$function$;

create or replace function public.tfi_source42_check_page(p_sheet text,p_rows jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare
  v_actor uuid:=auth.uid(); v_spreadsheet_id text; v_sheet public.tfi_source_sheets%rowtype;
  v_item jsonb; v_fields jsonb; v_row integer; v_date date; v_line text;
  v_product text; v_code text; v_result text; v_reason text;
  v_rows jsonb:='[]'::jsonb; v_seen integer[]:='{}'::integer[];
  v_has_input boolean; v_existing boolean; v_col text;
begin
  if v_actor is null or not private.tfi_has_permission('spreadsheet_import','view') then
    raise exception using errcode='42501',message='spreadsheet_import_view_permission_required';
  end if;
  if p_sheet is null or length(p_sheet) not between 1 and 120 or p_rows is null
     or jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)<1
     or jsonb_array_length(p_rows)>100 then
    raise exception using errcode='22023',message='invalid_source_preflight_request';
  end if;
  select w.spreadsheet_id into v_spreadsheet_id
  from public.tfi_source_workbooks w where w.is_authoritative
  order by w.verified_at desc limit 1;
  select s.* into v_sheet
  from public.tfi_source_sheets s
  join public.tfi_source_workbooks w on w.id=s.workbook_id
  where w.spreadsheet_id=v_spreadsheet_id and w.is_authoritative
    and s.sheet_title=p_sheet;
  if v_spreadsheet_id is null or not found then
    raise exception using errcode='42501',message='source_sheet_not_registered_for_authoritative_workbook';
  end if;
  for v_item in select value from jsonb_array_elements(p_rows) loop
    v_row:=nullif(v_item->>'source_row','')::integer;
    v_fields:=v_item->'fields';
    v_result:='held_mapping_unverified';
    v_reason:='This worksheet has not yet completed its TFI2 module-specific duplicate and validation contract. The row can be preserved as Held for Review only.';
    if v_row is null or v_row<coalesce(v_sheet.first_data_row,1) or v_row>v_sheet.grid_rows
       or jsonb_typeof(v_fields) is distinct from 'object' then
      v_result:='held_header'; v_reason:='Source row is outside the registered data range or has an invalid field shape.';
    elsif v_row=any(v_seen) then
      v_result:='held_business_duplicate'; v_reason:='The same source row was repeated within this preflight page.';
    else
      v_seen:=array_append(v_seen,v_row);
      v_has_input:=false;
      if p_sheet='Production Summary' then
        foreach v_col in array array['A','B','C','D','E','F','G','H','J','K','L','M','N','O','P','S','T'] loop
          if nullif(btrim(coalesce(v_fields->>v_col,'')),'') is not null then
            v_has_input:=true; exit;
          end if;
        end loop;
      else
        for v_col in select jsonb_object_keys(v_fields) loop
          if nullif(btrim(coalesce(v_fields->>v_col,'')),'') is not null then
            v_has_input:=true; exit;
          end if;
        end loop;
      end if;
      if not v_has_input then
        v_result:='held_placeholder'; v_reason:='No literal source values; formula/helper-only row is not a source transaction.';
      elsif p_sheet='Production Summary' then
        if not private.tfi_has_permission('production_entry','import') then
          v_result:='held_mapping_unverified'; v_reason:='Production Entry import permission is required for Production Summary.';
        else
          if v_row<7 then
            v_result:='held_header'; v_reason:='Production Summary header or pre-data row.';
          else
            select exists(
              select 1 from public.tfi_module_import_inbox i
              where i.source_spreadsheet_id=v_spreadsheet_id
                and i.source_sheet='Production Summary' and i.source_row=v_row
            ) into v_existing;
            if v_existing then
              v_result:='existing_production'; v_reason:='This Production Summary source row has already been captured. Reconcile the existing Inbox row instead of importing it again.';
            else
              begin
                if coalesce(v_fields->>'A','') ~ '^[0-9]+([.][0-9]+)?$' then
                  v_date:=date '1899-12-30'+floor((v_fields->>'A')::numeric)::integer;
                elsif coalesce(v_fields->>'A','') ~ '^[0-9]{1,2}-[A-Za-z]{3}-[0-9]{2,4}$' then
                  v_date:=to_date(btrim(v_fields->>'A'),
                    case when length(split_part(btrim(v_fields->>'A'),'-',3))=2 then 'DD-Mon-YY' else 'DD-Mon-YYYY' end);
                else
                  v_date:=nullif(btrim(v_fields->>'A'),'')::date;
                end if;
              exception when others then v_date:=null;
              end;
              v_line:=case lower(btrim(coalesce(v_fields->>'B','')))
                when 'agri' then 'Agri' when 'agri line' then 'Agri'
                when 'meat' then 'Meat' when 'meat line' then 'Meat'
                when 'finishing' then 'Finishing' when 'finishing line' then 'Finishing'
                else null end;
              v_product:=nullif(btrim(coalesce(v_fields->>'C','')),'');
              v_code:=nullif(upper(btrim(coalesce(v_fields->>'D',''))),'');
              if v_date is not null and v_line is not null and (v_code is not null or v_product is not null)
                 and exists(
                   select 1 from public.tfi_production_entry_records p
                   where p.record_status='active' and p.production_date=v_date and p.line=v_line
                     and ((v_code is not null and upper(coalesce(p.product_code,''))=v_code)
                       or (v_code is null and upper(coalesce(p.product_name,''))=upper(v_product)))
                 ) then
                v_result:='held_business_duplicate';
                v_reason:='A Production Entry record already exists with the same date, line and product identity. Manual reconciliation is required.';
              else
                v_result:='new_source';
                v_reason:='Source row identity is new. The mapped historical record remains a reviewable Inbox Draft; no operational record is written.';
              end if;
            end if;
          end if;
        end if;
      end if;
    end if;
    v_rows:=v_rows||jsonb_build_array(jsonb_build_object(
      'source_row',v_row,'check_result',v_result,'reason',v_reason,
      'reconciliation',jsonb_build_object('state',case when v_result='new_source' then 'new_source_identity' else 'held_for_review' end),
      'archive_match',jsonb_build_object('found',false),
      'duplicate_probe',jsonb_build_object('status',case when v_result='held_business_duplicate' then 'possible_business_match' else 'not_found' end)
    ));
  end loop;
  return jsonb_build_object('rows',v_rows,'sheet',p_sheet,'source_spreadsheet_id',v_spreadsheet_id,
    'source_sheet_id',v_sheet.sheet_id,'read_only',true,'operational_writes',false);
end;
$function$;

revoke all on function public.tfi_module_import_batch_manifest(uuid,jsonb) from public,anon;
revoke all on function public.tfi_module_import_inbox_upsert(uuid,jsonb) from public,anon;
revoke all on function public.tfi_source42_check_page(text,jsonb) from public,anon;
grant execute on function public.tfi_module_import_batch_manifest(uuid,jsonb) to authenticated;
grant execute on function public.tfi_module_import_inbox_upsert(uuid,jsonb) to authenticated;
grant execute on function public.tfi_source42_check_page(text,jsonb) to authenticated;
