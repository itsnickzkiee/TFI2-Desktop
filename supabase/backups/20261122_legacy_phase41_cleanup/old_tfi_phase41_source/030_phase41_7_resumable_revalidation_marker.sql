-- Phase 41.7 follow-up: mark processed rows so chunked revalidation advances.
create or replace function public.tfi_module_import_inbox_revalidate(
  p_batch_id uuid,p_limit integer default 250
) returns jsonb
language plpgsql security definer set search_path=''
as $function$
declare
  v_actor uuid:=auth.uid();
  v_batch public.tfi_module_import_batches%rowtype;
  v_row public.tfi_module_import_inbox%rowtype;
  v_catalog jsonb;
  v_payload jsonb;
  v_date date;
  v_line text;
  v_product text;
  v_code text;
  v_uom text;
  v_num numeric;
  v_time time;
  v_missing text[];
  v_issue_code text;
  v_issue_detail text;
  v_state text;
  v_disposition text;
  v_duplicate boolean;
  v_source_collision boolean;
  v_processed integer:=0;
  v_ready integer:=0;
  v_incomplete integer:=0;
  v_duplicates integer:=0;
  v_held integer:=0;
  v_remaining integer:=0;
  v_updated integer:=0;
begin
  if v_actor is null
     or not private.tfi_has_permission('spreadsheet_import','review')
     or not private.tfi_has_permission('production_entry','import') then
    raise exception using errcode='42501',message='production_summary_revalidation_permission_required';
  end if;
  if p_batch_id is null or p_limit is null or p_limit not between 1 and 500 then
    raise exception using errcode='22023',message='invalid_production_summary_revalidation_request';
  end if;
  select * into v_batch from public.tfi_module_import_batches
  where id=p_batch_id for update;
  if not found then raise exception using errcode='P0002',message='module_import_batch_not_found'; end if;
  if v_batch.status<>'completed' then
    raise exception using errcode='22023',message='source_batch_must_be_completed_before_revalidation';
  end if;
  if v_batch.spreadsheet_id is distinct from '1rCbQ16wj7MRjQCFF3tA-WEMkudraJK0RkwcqayUlz7k' then
    raise exception using errcode='42501',message='production_summary_source_not_authorized';
  end if;
  if not exists (
    select 1 from public.tfi_source_sheets s
    join public.tfi_source_workbooks w on w.id=s.workbook_id
    where w.spreadsheet_id=v_batch.spreadsheet_id and w.is_authoritative
      and s.sheet_title='Production Summary' and s.sheet_id=1846667474
      and s.source_kind='transaction_history' and s.destination_module_key='production_entry'
  ) then
    raise exception using errcode='42501',message='production_summary_source_registry_mismatch';
  end if;
  select catalog_data into v_catalog from public.tfi_production_entry_catalog where catalog_key='source';
  if v_catalog is null then raise exception using errcode='P0001',message='production_entry_catalog_missing'; end if;

  for v_row in
    select i.* from public.tfi_module_import_inbox i
    where i.batch_id=p_batch_id and i.module='production_summary'
      and i.source_sheet='Production Summary'
      and i.disposition in ('ready_for_draft','incomplete','held_review','duplicate_existing')
      and not (i.issue_codes @> '["phase41_7_revalidated"]'::jsonb)
      and not exists (select 1 from public.tfi_module_import_drafts d
        where d.inbox_id=i.id and d.status='approved_for_promotion')
    order by i.source_row,i.source_slot,i.id
    limit p_limit for update skip locked
  loop
    v_processed:=v_processed+1;
    v_payload:=v_row.normalized_payload;
    v_missing:='{}'::text[];
    v_issue_code:='phase41_7_validated_ready';
    v_issue_detail:='Historical Production Summary row passed TFI2 field, catalog, source and duplicate validation. It is eligible for a separate Pending Draft; it is not an operational record.';
    v_state:='valid'; v_disposition:='ready_for_draft';
    v_duplicate:=false; v_source_collision:=false;
    v_date:=null; v_line:=null; v_product:=null; v_code:=null; v_uom:=null;

    if v_payload is null or jsonb_typeof(v_payload)<>'object' then
      v_state:='needs_review'; v_disposition:='held_review';
      v_issue_code:='phase41_7_payload_missing';
      v_issue_detail:='No normalized candidate payload is available. Keep the original source row in Import Inbox.';
    elsif exists (select 1 from jsonb_object_keys(v_payload) as keys(key)
      where key not in ('production_date','line','product_name','product_code','batches',
        'target','produced','uom','plan_start','actual_start','plan_end',
        'actual_end_prod','actual_end_cleaning','manpower_required','present','ot_hours','remarks')) then
      v_state:='invalid'; v_disposition:='held_review';
      v_issue_code:='phase41_7_unknown_payload_fields';
      v_issue_detail:='The normalized candidate contains fields outside the approved Production Entry contract.';
    else
      begin
        v_date:=nullif(btrim(v_payload->>'production_date'),'')::date;
        v_line:=nullif(btrim(v_payload->>'line'),'');
        v_product:=nullif(btrim(v_payload->>'product_name'),'');
        v_code:=nullif(btrim(v_payload->>'product_code'),'');
        v_uom:=nullif(btrim(v_payload->>'uom'),'');
        if v_date is null then v_missing:=array_append(v_missing,'production_date'); end if;
        if v_line is null then v_missing:=array_append(v_missing,'line'); end if;
        if v_product is null then v_missing:=array_append(v_missing,'product_name'); end if;

        if v_line is not null and v_line not in ('Agri','Meat','Finishing') then
          v_state:='invalid'; v_disposition:='held_review';
          v_issue_code:='phase41_7_invalid_line';
          v_issue_detail:='Line must match the official TFI2 Production Entry line catalog.';
        elsif v_product is not null and not exists (
          select 1 from jsonb_array_elements_text(v_catalog->'product_names') p(value) where p.value=v_product
        ) then
          v_state:='invalid'; v_disposition:='held_review';
          v_issue_code:='phase41_7_unknown_product';
          v_issue_detail:='Product Name is not present in the current TFI2 Production Entry catalog.';
        elsif v_code is not null and v_product is not null and not exists (
          select 1 from jsonb_array_elements_text(v_catalog->'product_codes'->v_product) c(value) where c.value=v_code
        ) then
          v_state:='invalid'; v_disposition:='held_review';
          v_issue_code:='phase41_7_product_code_mismatch';
          v_issue_detail:='Product Code does not belong to the selected Product Name in the current TFI2 catalog.';
        elsif v_uom is not null and not exists (
          select 1 from jsonb_array_elements_text(v_catalog->'uom') u(value) where u.value=v_uom
        ) then
          v_state:='invalid'; v_disposition:='held_review';
          v_issue_code:='phase41_7_invalid_uom';
          v_issue_detail:='Unit of measure is not supported by the current TFI2 Production Entry contract.';
        else
          foreach v_issue_detail in array array['batches','target','produced','manpower_required','present','ot_hours'] loop
            if nullif(btrim(v_payload->>v_issue_detail),'') is not null then
              v_num:=(v_payload->>v_issue_detail)::numeric;
              if v_num<0 then
                v_state:='invalid'; v_disposition:='held_review';
                v_issue_code:='phase41_7_negative_quantity';
                v_issue_detail:='Numeric input fields cannot contain negative values.';
                exit;
              end if;
            end if;
          end loop;
          if v_state='valid' then
            foreach v_issue_detail in array array['plan_start','actual_start','plan_end','actual_end_prod','actual_end_cleaning'] loop
              if nullif(btrim(v_payload->>v_issue_detail),'') is not null then
                v_time:=(v_payload->>v_issue_detail)::time;
              end if;
            end loop;
            if length(coalesce(v_product,''))>200 or length(coalesce(v_code,''))>100
               or length(coalesce(v_payload->>'remarks',''))>1000 then
              v_state:='invalid'; v_disposition:='held_review';
              v_issue_code:='phase41_7_text_limit_exceeded';
              v_issue_detail:='One or more text values exceed the Production Entry field limit.';
            elsif cardinality(v_missing)>0 then
              v_state:='incomplete'; v_disposition:='incomplete';
              v_issue_code:='phase41_7_required_fields_missing';
              v_issue_detail:='Required identity fields are missing. Preserve the row as Incomplete; do not infer values.';
            else
              select exists (
                select 1 from public.tfi_production_entry_records p
                where p.record_status='active' and p.production_date=v_date and p.line=v_line
                  and ((v_code is not null and upper(coalesce(p.product_code,''))=upper(v_code))
                    or (v_code is null and upper(coalesce(p.product_name,''))=upper(v_product)))
              ) into v_duplicate;
              if v_duplicate then
                v_state:='duplicate'; v_disposition:='duplicate_existing';
                v_issue_code:='phase41_7_existing_production_match';
                v_issue_detail:='An active Production Entry record already has the same date, line and product identity. No Draft was created.';
              else
                select exists (
                  select 1 from public.tfi_module_import_inbox other
                  where other.batch_id=p_batch_id and other.module='production_summary'
                    and other.source_sheet='Production Summary' and other.id<>v_row.id
                    and other.disposition not in ('excluded_derived','blank_template')
                    and jsonb_typeof(other.normalized_payload)='object'
                    and other.normalized_payload->>'production_date'=v_payload->>'production_date'
                    and other.normalized_payload->>'line'=v_payload->>'line'
                    and ((v_code is not null and upper(coalesce(other.normalized_payload->>'product_code',''))=upper(v_code))
                      or (v_code is null and upper(coalesce(other.normalized_payload->>'product_name',''))=upper(v_product)))
                ) into v_source_collision;
                if v_source_collision then
                  v_state:='needs_review'; v_disposition:='held_review';
                  v_issue_code:='phase41_7_source_business_collision';
                  v_issue_detail:='Another Production Summary row in this batch has the same date, line and product identity. Review both source rows before Draft creation.';
                end if;
              end if;
            end if;
          end if;
        end if;
      exception when others then
        v_state:='invalid'; v_disposition:='held_review';
        v_issue_code:='phase41_7_field_parse_failed';
        v_issue_detail:='A date, numeric or time field could not be parsed using the approved Production Entry format.';
      end;
    end if;

    if v_disposition='ready_for_draft' then v_ready:=v_ready+1;
    elsif v_disposition='incomplete' then v_incomplete:=v_incomplete+1;
    elsif v_disposition='duplicate_existing' then v_duplicates:=v_duplicates+1;
    else v_held:=v_held+1; end if;

    if v_row.disposition is distinct from v_disposition
       or v_row.validation_state is distinct from v_state
       or v_row.issue_codes is distinct from jsonb_build_array('phase41_7_revalidated',v_issue_code)
       or v_row.issue_details is distinct from jsonb_build_array(v_issue_detail)
       or v_row.missing_fields is distinct from to_jsonb(v_missing) then
      update public.tfi_module_import_inbox
      set disposition=v_disposition,validation_state=v_state,
          issue_codes=jsonb_build_array('phase41_7_revalidated',v_issue_code),
          issue_details=jsonb_build_array(v_issue_detail),missing_fields=to_jsonb(v_missing),
          version=version+1,updated_by=v_actor,updated_at=now()
      where id=v_row.id;
      insert into public.tfi_module_import_inbox_revisions(
        inbox_id,old_version,new_version,old_payload,new_payload,
        old_validation_state,new_validation_state,old_disposition,new_disposition,actor,action
      ) values (
        v_row.id,v_row.version,v_row.version+1,v_row.normalized_payload,v_row.normalized_payload,
        v_row.validation_state,v_state,v_row.disposition,v_disposition,v_actor,'phase41_7_revalidate'
      );
      v_updated:=v_updated+1;
    end if;
  end loop;

  select count(*)::integer into v_remaining
  from public.tfi_module_import_inbox i
  where i.batch_id=p_batch_id and i.module='production_summary'
    and i.source_sheet='Production Summary'
    and i.disposition in ('ready_for_draft','incomplete','held_review','duplicate_existing')
    and not (i.issue_codes @> '["phase41_7_revalidated"]'::jsonb)
    and not exists (select 1 from public.tfi_module_import_drafts d
      where d.inbox_id=i.id and d.status='approved_for_promotion');
  return jsonb_build_object(
    'status','revalidated','batch_id',p_batch_id,'module','production_summary',
    'processed',v_processed,'updated',v_updated,'ready_for_draft',v_ready,
    'incomplete',v_incomplete,'duplicate_existing',v_duplicates,'held_review',v_held,
    'remaining',v_remaining,'operational_writes',false
  );
end;
$function$;
revoke all on function public.tfi_module_import_inbox_revalidate(uuid,integer) from public,anon;
grant execute on function public.tfi_module_import_inbox_revalidate(uuid,integer) to authenticated;
