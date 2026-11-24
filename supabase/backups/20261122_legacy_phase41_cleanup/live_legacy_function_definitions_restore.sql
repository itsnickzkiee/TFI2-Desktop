-- Exact live TFI2 legacy Phase 41 / source preflight function definitions captured 2026-11-22.
-- Restore reference only. These functions are retired from TFI_NEW and must not be re-exposed.

-- Signature: private.tfi_guard_historical_promotion_freeze()
CREATE OR REPLACE FUNCTION private.tfi_guard_historical_promotion_freeze()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
  v_batch uuid;
  v_payload jsonb;
  v_date date;
  v_line text;
BEGIN
  IF current_setting('tfi.phase41_8_promoting', true) = 'on' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP <> 'DELETE' THEN
    v_batch := NEW.batch_id;
    v_payload := NEW.normalized_payload;
    BEGIN
      v_date := NULLIF(v_payload->>'production_date', '')::date;
    EXCEPTION WHEN OTHERS THEN
      v_date := NULL;
    END;
    v_line := NULLIF(v_payload->>'line', '');

    IF v_batch IS NOT NULL
       AND v_date IS NOT NULL
       AND v_line IS NOT NULL
       AND EXISTS (
         SELECT 1
         FROM public.tfi_historical_promotion_groups g
         WHERE g.batch_id = v_batch
           AND g.production_date = v_date
           AND g.line = v_line
           AND EXISTS (
             SELECT 1
             FROM public.tfi_module_import_drafts promoted
             WHERE promoted.promotion_entry_batch_id = g.id
               AND promoted.status = 'promoted'
               AND promoted.promoted_record_id IS NOT NULL
           )
       ) THEN
      RAISE EXCEPTION USING
        ERRCODE = '55000',
        MESSAGE = 'historical_promotion_group_frozen';
    END IF;
  END IF;

  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    v_batch := OLD.batch_id;
    v_payload := OLD.normalized_payload;
    BEGIN
      v_date := NULLIF(v_payload->>'production_date', '')::date;
    EXCEPTION WHEN OTHERS THEN
      v_date := NULL;
    END;
    v_line := NULLIF(v_payload->>'line', '');

    IF v_batch IS NOT NULL
       AND v_date IS NOT NULL
       AND v_line IS NOT NULL
       AND EXISTS (
         SELECT 1
         FROM public.tfi_historical_promotion_groups g
         WHERE g.batch_id = v_batch
           AND g.production_date = v_date
           AND g.line = v_line
           AND EXISTS (
             SELECT 1
             FROM public.tfi_module_import_drafts promoted
             WHERE promoted.promotion_entry_batch_id = g.id
               AND promoted.status = 'promoted'
               AND promoted.promoted_record_id IS NOT NULL
           )
       ) THEN
      RAISE EXCEPTION USING
        ERRCODE = '55000',
        MESSAGE = 'historical_promotion_group_frozen';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$


-- Signature: private.tfi_module_import_drafts_promote(uuid,uuid[],boolean,boolean)
CREATE OR REPLACE FUNCTION private.tfi_module_import_drafts_promote(p_batch_id uuid, p_draft_ids uuid[], p_confirm_source_frozen boolean, p_confirm_promotion boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid:=auth.uid();
  v_batch public.tfi_module_import_batches%rowtype;
  v_draft public.tfi_module_import_drafts%rowtype;
  v_inbox public.tfi_module_import_inbox%rowtype;
  v_group public.tfi_historical_promotion_groups%rowtype;
  v_catalog jsonb;
  v_payload jsonb;
  v_date date;
  v_line text;
  v_product text;
  v_code text;
  v_uom text;
  v_base integer;
  v_group_count integer;
  v_rank integer;
  v_slot smallint;
  v_num numeric;
  v_time time;
  v_field text;
  v_saved_on timestamptz;
  v_attainment numeric;
  v_absent numeric;
  v_attendance numeric;
  v_input_data jsonb;
  v_record_data jsonb;
  v_blank_fields text[];
  v_fingerprint text;
  v_record_id uuid;
  v_reason text;
  v_duplicate boolean;
  v_processed integer:=0;
  v_promoted integer:=0;
  v_blocked integer:=0;
  v_already integer:=0;
  v_results jsonb:='[]'::jsonb;
  v_old_version integer;
  v_new_version integer;
begin
  if v_actor is null
     or not private.tfi_has_permission('spreadsheet_import','approve')
     or not private.tfi_has_permission('production_entry','approve')
     or not private.tfi_has_permission('production_entry','create')
     or not private.tfi_has_permission('production_entry','import') then
    raise exception using errcode='42501',message='historical_production_entry_promotion_permission_required';
  end if;
  if p_batch_id is null or p_draft_ids is null
     or cardinality(p_draft_ids)<1 or cardinality(p_draft_ids)>100
     or p_confirm_source_frozen is not true or p_confirm_promotion is not true
     or (select count(distinct x) from unnest(p_draft_ids) as ids(x))<>cardinality(p_draft_ids) then
    raise exception using errcode='22023',message='invalid_historical_production_entry_promotion_request';
  end if;

  select * into v_batch from public.tfi_module_import_batches
  where id=p_batch_id for update;
  if not found or v_batch.status<>'completed' then
    raise exception using errcode='22023',message='historical_source_batch_must_be_completed';
  end if;
  if v_batch.spreadsheet_id is distinct from '1rCbQ16wj7MRjQCFF3tA-WEMkudraJK0RkwcqayUlz7k' then
    raise exception using errcode='42501',message='historical_source_workbook_not_authorized';
  end if;
  if not exists (
    select 1 from public.tfi_source_sheets s
    join public.tfi_source_workbooks w on w.id=s.workbook_id
    where w.spreadsheet_id=v_batch.spreadsheet_id and w.is_authoritative
      and s.sheet_title='Production Summary' and s.sheet_id=1846667474
      and s.source_kind='transaction_history' and s.destination_module_key='production_entry'
  ) then
    raise exception using errcode='42501',message='historical_source_registry_mismatch';
  end if;
  if exists (
    select 1 from unnest(p_draft_ids) as ids(x)
    left join public.tfi_module_import_drafts d on d.id=ids.x
    where d.id is null or d.batch_id<>p_batch_id
  ) then
    raise exception using errcode='22023',message='selected_historical_drafts_must_belong_to_source_batch';
  end if;

  select catalog_data into v_catalog
  from public.tfi_production_entry_catalog where catalog_key='source';
  if v_catalog is null then
    raise exception using errcode='P0001',message='production_entry_catalog_missing';
  end if;

  perform set_config('tfi.phase41_8_promoting','on',true);

  for v_draft in
    select d.* from public.tfi_module_import_drafts d
    where d.id=any(p_draft_ids)
    order by d.normalized_payload->>'production_date',
      d.normalized_payload->>'line',d.source_row,d.source_slot,d.id
    for update
  loop
    v_processed:=v_processed+1;
    if v_draft.status='promoted' and v_draft.promoted_record_id is not null then
      v_already:=v_already+1;
      v_results:=v_results||jsonb_build_array(jsonb_build_object(
        'draft_id',v_draft.id,'status','already_promoted',
        'record_id',v_draft.promoted_record_id,
        'source_row',v_draft.source_row,
        'production_entry_row',v_draft.promotion_source_row_number
      ));
      continue;
    end if;
    if v_draft.status<>'approved_for_promotion' then
      raise exception using errcode='22023',message='only_approved_historical_drafts_can_be_promoted';
    end if;

    v_reason:=null;
    v_date:=null; v_line:=null; v_product:=null; v_code:=null; v_uom:=null;
    v_slot:=null; v_record_id:=null; v_group:=null; v_duplicate:=false;
    v_payload:=v_draft.normalized_payload;
    select * into v_inbox from public.tfi_module_import_inbox
    where id=v_draft.inbox_id for update;
    if not found then
      v_reason:='The original Import Inbox row is missing. No Production Entry record was created.';
    elsif v_inbox.version<>v_draft.inbox_version
       or v_inbox.disposition<>'ready_for_draft'
       or v_inbox.validation_state<>'valid'
       or not (v_inbox.issue_codes @> '["phase41_7_validated_ready"]'::jsonb) then
      v_reason:='The original Inbox row changed after approval or is no longer validated. Revalidation and reapproval are required.';
    elsif v_draft.source_spreadsheet_id is distinct from v_batch.spreadsheet_id
       or v_draft.source_sheet is distinct from 'Production Summary'
       or v_draft.source_row<7 or v_draft.source_row>13188 then
      v_reason:='The Draft source reference does not match the approved Production Summary workbook.';
    else
      begin
        v_date:=nullif(btrim(v_payload->>'production_date'),'')::date;
        v_line:=nullif(btrim(v_payload->>'line'),'');
        v_product:=nullif(btrim(v_payload->>'product_name'),'');
        v_code:=nullif(btrim(v_payload->>'product_code'),'');
        v_uom:=nullif(btrim(v_payload->>'uom'),'');
        if v_date is null or v_product is null then
          v_reason:='Production date and Product Name are required. The Draft remains approved but held from promotion.';
        elsif v_line is null or v_line not in ('Agri','Meat','Finishing') then
          v_reason:='Production Line does not match the official TFI2 line catalog.';
        elsif exists (
          select 1 from jsonb_object_keys(v_payload) as keys(key)
          where key not in ('production_date','line','product_name','product_code','batches',
            'target','produced','uom','plan_start','actual_start','plan_end',
            'actual_end_prod','actual_end_cleaning','manpower_required','present','ot_hours','remarks')
        ) then
          v_reason:='The Draft contains fields outside the approved Production Entry input contract.';
        elsif not exists (
          select 1 from jsonb_array_elements_text(v_catalog->'product_names') p(value)
          where p.value=v_product
        ) then
          v_reason:='Product Name is no longer present in the current TFI2 catalog.';
        elsif v_code is not null and not exists (
          select 1 from jsonb_array_elements_text(v_catalog->'product_codes'->v_product) c(value)
          where c.value=v_code
        ) then
          v_reason:='Product Code does not belong to the selected Product Name in the current TFI2 catalog.';
        elsif v_uom is not null and not exists (
          select 1 from jsonb_array_elements_text(v_catalog->'uom') u(value)
          where u.value=v_uom
        ) then
          v_reason:='Unit of measure is not supported by the current TFI2 Production Entry catalog.';
        else
          foreach v_field in array array['batches','target','produced','manpower_required','present','ot_hours'] loop
            if nullif(btrim(v_payload->>v_field),'') is not null then
              v_num:=(v_payload->>v_field)::numeric;
              if v_num<0 then
                v_reason:='Negative numeric values cannot be promoted into Production Entry.';
                exit;
              end if;
            end if;
          end loop;
          if v_reason is null then
            foreach v_field in array array['plan_start','actual_start','plan_end','actual_end_prod','actual_end_cleaning'] loop
              if nullif(btrim(v_payload->>v_field),'') is not null then
                v_time:=(v_payload->>v_field)::time;
              end if;
            end loop;
            if length(coalesce(v_product,''))>200 or length(coalesce(v_code,''))>100
               or length(coalesce(v_payload->>'remarks',''))>1000 then
              v_reason:='One or more text values exceed the Production Entry field limits.';
            end if;
          end if;
        end if;
      exception when others then
        v_reason:='A date, numeric or time field could not be parsed using the approved Production Entry format.';
      end;
    end if;

    if v_reason is null then
      v_base:=case v_line when 'Agri' then 7 when 'Meat' then 11 when 'Finishing' then 15 else null end;

      if exists (
        select 1 from public.tfi_module_import_inbox i
        left join public.tfi_module_import_drafts other on other.inbox_id=i.id
        where i.batch_id=p_batch_id and i.module='production_summary'
          and i.source_sheet='Production Summary'
          and i.normalized_payload->>'production_date'=v_date::text
          and i.normalized_payload->>'line'=v_line
          and i.disposition not in ('duplicate_existing','excluded_derived','blank_template','imported_draft')
          and (other.id is null or other.status in ('pending_approval','held_review'))
      ) then
        v_reason:='Other source rows for this production date and line are still incomplete, held or awaiting approval. Resolve that line group before promoting any of its Drafts.';
      else
        select count(*)::integer into v_group_count
        from public.tfi_module_import_drafts d
        where d.batch_id=p_batch_id
          and d.normalized_payload->>'production_date'=v_date::text
          and d.normalized_payload->>'line'=v_line
          and d.status in ('approved_for_promotion','promoted');
        if v_group_count>4 then
          v_reason:='This date and line contain more than four approved historical rows. Review the source slots; no rows in this line group were promoted.';
        end if;
      end if;
    end if;

    if v_reason is null then
      insert into public.tfi_historical_promotion_groups(
        batch_id,production_date,line,source_spreadsheet_id,source_sha256,created_by
      ) values (
        p_batch_id,v_date,v_line,v_batch.spreadsheet_id,v_batch.source_sha256,v_actor
      ) on conflict (batch_id,production_date,line) do nothing;

      select * into v_group from public.tfi_historical_promotion_groups g
      where g.batch_id=p_batch_id and g.production_date=v_date and g.line=v_line
      for update;

      select ranked.slot_number into v_slot
      from (
        select d.id,
          (v_base+row_number() over(order by d.source_row,d.source_slot,d.id))::smallint as slot_number
        from public.tfi_module_import_drafts d
        where d.batch_id=p_batch_id
          and d.normalized_payload->>'production_date'=v_date::text
          and d.normalized_payload->>'line'=v_line
          and d.status in ('approved_for_promotion','promoted')
      ) ranked
      where ranked.id=v_draft.id;

      if v_slot is null or v_slot<v_base+1 or v_slot>v_base+4 then
        v_reason:='A valid Production Entry row slot could not be assigned to this historical Draft.';
      elsif exists (
        select 1
        from (
          select d.id,
            (v_base+row_number() over(order by d.source_row,d.source_slot,d.id))::smallint as slot_number
          from public.tfi_module_import_drafts d
          where d.batch_id=p_batch_id
            and d.normalized_payload->>'production_date'=v_date::text
            and d.normalized_payload->>'line'=v_line
            and d.status in ('approved_for_promotion','promoted')
        ) ranked
        join public.tfi_module_import_drafts prior on prior.id=ranked.id
        where prior.status='promoted'
          and (prior.promotion_entry_batch_id is distinct from v_group.id
            or prior.promotion_source_row_number is distinct from ranked.slot_number)
      ) then
        v_reason:='A previously promoted row in this date and line group no longer matches its frozen row-slot assignment.';
      elsif v_draft.promotion_entry_batch_id is not null
         and v_draft.promotion_entry_batch_id<>v_group.id then
        v_reason:='The Draft is linked to a different historical promotion group. Manual review is required.';
      elsif v_draft.promotion_source_row_number is not null
         and v_draft.promotion_source_row_number<>v_slot then
        v_reason:='The historical Production Entry row-slot assignment changed. Manual review is required.';
      else
        if v_draft.promotion_entry_batch_id is null or v_draft.promotion_source_row_number is null then
          v_old_version:=v_draft.version;
          update public.tfi_module_import_drafts
          set promotion_entry_batch_id=v_group.id,
              promotion_source_row_number=v_slot,
              version=version+1,updated_by=v_actor,updated_at=now()
          where id=v_draft.id returning * into v_draft;
          insert into public.tfi_module_import_draft_revisions(
            draft_id,old_version,new_version,old_status,new_status,old_payload,new_payload,
            actor,action,note
          ) values (
            v_draft.id,v_old_version,v_draft.version,'approved_for_promotion',
            'approved_for_promotion',v_draft.normalized_payload,v_draft.normalized_payload,
            v_actor,'assign_production_entry_slot',
            'Assigned Production Entry row '||v_slot::text||' in the frozen date/line promotion group.'
          );
        end if;

        select exists (
          select 1 from public.tfi_production_entry_records p
          where p.record_status='active' and p.production_date=v_date and p.line=v_line
            and upper(coalesce(nullif(btrim(p.product_code),''),nullif(btrim(p.product_name),'')))=
                upper(coalesce(nullif(v_code,''),nullif(v_product,'')))
        ) into v_duplicate;
        if v_duplicate then
          v_reason:='An active Production Entry record already exists for this date, line and product identity. The existing record was not changed.';
        end if;
      end if;
    end if;

    v_record_id:=null;
    if v_reason is null then
      v_saved_on:=now();
      v_input_data:=jsonb_strip_nulls(jsonb_build_object(
        'A',v_date,'C',v_product,'D',v_code,
        'E',nullif(btrim(v_payload->>'batches'),'')::numeric,
        'F',nullif(btrim(v_payload->>'target'),'')::numeric,
        'G',nullif(btrim(v_payload->>'produced'),'')::numeric,
        'H',v_uom,
        'J',nullif(btrim(v_payload->>'plan_start'),'')::time,
        'K',nullif(btrim(v_payload->>'actual_start'),'')::time,
        'L',nullif(btrim(v_payload->>'plan_end'),'')::time,
        'M',nullif(btrim(v_payload->>'actual_end_prod'),'')::time,
        'N',nullif(btrim(v_payload->>'actual_end_cleaning'),'')::time,
        'O',nullif(btrim(v_payload->>'manpower_required'),'')::numeric,
        'P',nullif(btrim(v_payload->>'present'),'')::numeric,
        'S',nullif(btrim(v_payload->>'ot_hours'),'')::numeric,
        'T',nullif(btrim(v_payload->>'remarks'),'')
      ));
      v_attainment:=case when nullif(v_payload->>'target','') is not null
          and nullif(v_payload->>'produced','') is not null
          and (v_payload->>'target')::numeric>0
        then (v_payload->>'produced')::numeric/(v_payload->>'target')::numeric else null end;
      v_absent:=case when nullif(v_payload->>'manpower_required','') is not null
          and nullif(v_payload->>'present','') is not null
        then (v_payload->>'manpower_required')::numeric-(v_payload->>'present')::numeric else null end;
      v_attendance:=case when nullif(v_payload->>'manpower_required','') is not null
          and nullif(v_payload->>'present','') is not null
          and (v_payload->>'manpower_required')::numeric>0
        then (v_payload->>'present')::numeric/(v_payload->>'manpower_required')::numeric else null end;
      v_record_data:=jsonb_build_object(
        'A',v_date,'B',v_line,'C',v_product,'D',v_code,
        'E',nullif(btrim(v_payload->>'batches'),'')::numeric,
        'F',nullif(btrim(v_payload->>'target'),'')::numeric,
        'G',nullif(btrim(v_payload->>'produced'),'')::numeric,
        'H',v_uom,'I',v_attainment,
        'J',nullif(btrim(v_payload->>'plan_start'),'')::time,
        'K',nullif(btrim(v_payload->>'actual_start'),'')::time,
        'L',nullif(btrim(v_payload->>'plan_end'),'')::time,
        'M',nullif(btrim(v_payload->>'actual_end_prod'),'')::time,
        'N',nullif(btrim(v_payload->>'actual_end_cleaning'),'')::time,
        'O',nullif(btrim(v_payload->>'manpower_required'),'')::numeric,
        'P',nullif(btrim(v_payload->>'present'),'')::numeric,
        'Q',v_absent,'R',v_attendance,
        'S',nullif(btrim(v_payload->>'ot_hours'),'')::numeric,
        'T',nullif(btrim(v_payload->>'remarks'),''),
        'U',v_saved_on,'V',null,'W',true,'X',null
      );
      v_blank_fields:=array_remove(array[
        case when v_date is null then 'A' end,
        case when v_product is null then 'C' end,
        case when v_code is null then 'D' end,
        case when nullif(btrim(v_payload->>'batches'),'') is null then 'E' end,
        case when nullif(btrim(v_payload->>'target'),'') is null then 'F' end,
        case when nullif(btrim(v_payload->>'produced'),'') is null then 'G' end,
        case when v_uom is null then 'H' end,
        case when nullif(btrim(v_payload->>'plan_start'),'') is null then 'J' end,
        case when nullif(btrim(v_payload->>'actual_start'),'') is null then 'K' end,
        case when nullif(btrim(v_payload->>'plan_end'),'') is null then 'L' end,
        case when nullif(btrim(v_payload->>'actual_end_prod'),'') is null then 'M' end,
        case when nullif(btrim(v_payload->>'actual_end_cleaning'),'') is null then 'N' end,
        case when nullif(btrim(v_payload->>'manpower_required'),'') is null then 'O' end,
        case when nullif(btrim(v_payload->>'present'),'') is null then 'P' end,
        case when nullif(btrim(v_payload->>'ot_hours'),'') is null then 'S' end,
        case when nullif(btrim(v_payload->>'remarks'),'') is null then 'T' end
      ],null);
      v_fingerprint:=private.tfi_production_entry_fingerprint(v_slot,v_input_data);

      insert into public.tfi_production_entry_records(
        entry_batch_id,source_row_number,production_date,line,product_name,product_code,
        batches,target,produced,uom,attainment,plan_start,actual_start,plan_end,
        actual_end_prod,actual_end_cleaning,manpower_required,present,absent,
        attendance,ot_hours,remarks,saved_on,check_value,has_data,day_has_data,
        record_data,record_fingerprint,completeness_status,blank_fields,
        created_by,updated_by,source_import_batch_id,source_import_draft_id,
        source_import_spreadsheet_id,source_import_sheet,source_import_sheet_row,
        source_import_source_key,source_import_fingerprint_sha256
      ) values (
        v_group.id,v_slot,v_date,v_line,v_product,v_code,
        nullif(btrim(v_payload->>'batches'),'')::numeric,
        nullif(btrim(v_payload->>'target'),'')::numeric,
        nullif(btrim(v_payload->>'produced'),'')::numeric,
        v_uom,v_attainment,
        nullif(btrim(v_payload->>'plan_start'),'')::time,
        nullif(btrim(v_payload->>'actual_start'),'')::time,
        nullif(btrim(v_payload->>'plan_end'),'')::time,
        nullif(btrim(v_payload->>'actual_end_prod'),'')::time,
        nullif(btrim(v_payload->>'actual_end_cleaning'),'')::time,
        nullif(btrim(v_payload->>'manpower_required'),'')::numeric,
        nullif(btrim(v_payload->>'present'),'')::numeric,
        v_absent,v_attendance,
        nullif(btrim(v_payload->>'ot_hours'),'')::numeric,
        nullif(btrim(v_payload->>'remarks'),''),
        v_saved_on,null,true,null,v_record_data,v_fingerprint,
        'unassessed',v_blank_fields,v_actor,v_actor,
        v_draft.batch_id,v_draft.id,v_draft.source_spreadsheet_id,v_draft.source_sheet,
        v_draft.source_row,v_draft.source_key,v_draft.source_fingerprint_sha256
      )
      on conflict do nothing
      returning id into v_record_id;

      if v_record_id is null then
        select p.id into v_record_id
        from public.tfi_production_entry_records p
        where p.source_import_draft_id=v_draft.id
        limit 1;
        if v_record_id is null then
          v_reason:='A duplicate business identity or record fingerprint was detected at final insertion. No existing Production Entry record was changed.';
        end if;
      end if;
    end if;

    if v_reason is not null then
      if v_draft.promotion_hold_reason is distinct from left(v_reason,500) then
        v_old_version:=v_draft.version;
        update public.tfi_module_import_drafts
        set promotion_hold_reason=left(v_reason,500),
            version=version+1,updated_by=v_actor,updated_at=now()
        where id=v_draft.id returning * into v_draft;
        insert into public.tfi_module_import_draft_revisions(
          draft_id,old_version,new_version,old_status,new_status,old_payload,new_payload,
          actor,action,note
        ) values (
          v_draft.id,v_old_version,v_draft.version,'approved_for_promotion',
          'approved_for_promotion',v_draft.normalized_payload,v_draft.normalized_payload,
          v_actor,'promotion_held',left(v_reason,500)
        );
        perform private.tfi_write_import_audit_event(
          'module_import.historical_draft_promotion_held','production_entry',
          'historical_import_draft',v_draft.id::text,
          jsonb_build_object('status','approved_for_promotion'),
          jsonb_build_object('status','approved_for_promotion','hold_reason',left(v_reason,500)),
          jsonb_build_object('batch_id',p_batch_id,'source_row',v_draft.source_row,
            'source_sheet',v_draft.source_sheet,'source_line',v_line)
        );
      end if;
      v_blocked:=v_blocked+1;
      v_results:=v_results||jsonb_build_array(jsonb_build_object(
        'draft_id',v_draft.id,'status','held_from_promotion',
        'source_row',v_draft.source_row,'reason',left(v_reason,500)
      ));
      continue;
    end if;

    v_old_version:=v_draft.version;
    update public.tfi_module_import_drafts
    set status='promoted',promoted_record_id=v_record_id,
        promoted_at=now(),promoted_by=v_actor,promotion_hold_reason=null,
        version=version+1,updated_by=v_actor,updated_at=now()
    where id=v_draft.id returning * into v_draft;
    insert into public.tfi_module_import_draft_revisions(
      draft_id,old_version,new_version,old_status,new_status,old_payload,new_payload,
      actor,action,note
    ) values (
      v_draft.id,v_old_version,v_draft.version,'approved_for_promotion','promoted',
      v_draft.normalized_payload,v_draft.normalized_payload,v_actor,
      'promote_to_production_entry',
      'Created Production Entry record '||v_record_id::text||
      ' at row '||v_draft.promotion_source_row_number::text||'.'
    );

    update public.tfi_module_import_inbox
    set disposition='imported_draft',target_table='tfi_production_entry_records',
        target_record_id=v_record_id,target_record_key='production_entry:'||v_record_id::text,
        version=version+1,updated_by=v_actor,updated_at=now()
    where id=v_inbox.id and version=v_inbox.version;
    if not found then
      raise exception using errcode='40001',message='historical_source_inbox_changed_during_promotion';
    end if;
    insert into public.tfi_module_import_inbox_revisions(
      inbox_id,old_version,new_version,old_payload,new_payload,
      old_validation_state,new_validation_state,old_disposition,new_disposition,actor,action
    ) values (
      v_inbox.id,v_inbox.version,v_inbox.version+1,
      v_inbox.normalized_payload,v_inbox.normalized_payload,
      v_inbox.validation_state,v_inbox.validation_state,
      v_inbox.disposition,'imported_draft',v_actor,'phase41_8_promoted'
    );

    perform private.tfi_write_import_audit_event(
      'module_import.historical_draft_promoted','production_entry',
      'production_entry_record',v_record_id::text,
      null,jsonb_build_object('record_id',v_record_id,'record_data',v_record_data),
      jsonb_build_object(
        'source_batch_id',p_batch_id,'source_sha256',v_batch.source_sha256,
        'source_spreadsheet_id',v_draft.source_spreadsheet_id,
        'source_sheet',v_draft.source_sheet,'source_sheet_row',v_draft.source_row,
        'source_key',v_draft.source_key,
        'source_fingerprint_sha256',v_draft.source_fingerprint_sha256,
        'draft_id',v_draft.id,'entry_batch_id',v_group.id,
        'production_entry_source_row_number',v_draft.promotion_source_row_number,
        'line',v_line,'historical_import',true
      )
    );

    v_promoted:=v_promoted+1;
    v_results:=v_results||jsonb_build_array(jsonb_build_object(
      'draft_id',v_draft.id,'status','promoted','record_id',v_record_id,
      'source_row',v_draft.source_row,
      'production_entry_row',v_draft.promotion_source_row_number,
      'entry_batch_id',v_group.id
    ));
  end loop;

  if v_processed<>cardinality(p_draft_ids) then
    raise exception using errcode='P0002',message='one_or_more_historical_drafts_were_not_found';
  end if;

  return jsonb_build_object(
    'status','promotion_processed','batch_id',p_batch_id,
    'processed',v_processed,'promoted',v_promoted,'blocked',v_blocked,
    'already_promoted',v_already,'operational_writes',v_promoted>0,
    'results',v_results,
    'note','Only approved Drafts were considered. Existing Production Entry records were never updated or deleted.'
  );
end;
$function$


-- Signature: tfi_module_import_batch_finish(uuid)
CREATE OR REPLACE FUNCTION public.tfi_module_import_batch_finish(p_batch_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid:=auth.uid(); v_batch public.tfi_module_import_batches%rowtype;
  v_counts jsonb;
begin
  if v_actor is null or not private.tfi_has_permission('spreadsheet_import','create') then
    raise exception using errcode='42501',message='spreadsheet_import_create_permission_required';
  end if;
  select * into v_batch from public.tfi_module_import_batches where id=p_batch_id for update;
  if not found then raise exception using errcode='P0002',message='module_import_batch_not_found'; end if;
  if v_batch.imported_by<>v_actor and not private.tfi_has_permission('spreadsheet_import','approve') then
    raise exception using errcode='42501',message='module_import_batch_owner_required';
  end if;
  select jsonb_build_object(
    'total',count(*),
    'ready_for_draft',count(*) filter(where disposition='ready_for_draft'),
    'incomplete',count(*) filter(where disposition='incomplete'),
    'held_review',count(*) filter(where disposition='held_review'),
    'duplicate_existing',count(*) filter(where disposition='duplicate_existing'),
    'excluded_derived',count(*) filter(where disposition='excluded_derived'),
    'blank_template',count(*) filter(where disposition='blank_template')
  ) into v_counts
  from public.tfi_module_import_inbox where batch_id=p_batch_id;
  update public.tfi_module_import_batches
  set status='completed',counts=coalesce(counts,'{}'::jsonb)||v_counts,completed_at=now()
  where id=p_batch_id;
  perform private.tfi_write_import_audit_event(
    'module_import.batch_completed','spreadsheet_import','module_import_batch',p_batch_id::text,
    jsonb_build_object('status',v_batch.status),
    jsonb_build_object('status','completed','counts',v_counts),
    jsonb_build_object('spreadsheet_id',v_batch.spreadsheet_id)
  );
  return jsonb_build_object('batch_id',p_batch_id,'status','completed','counts',v_counts);
end;
$function$


-- Signature: tfi_module_import_batch_manifest(uuid,jsonb)
CREATE OR REPLACE FUNCTION public.tfi_module_import_batch_manifest(p_batch_id uuid, p_manifest jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$


-- Signature: tfi_module_import_batch_start(text,text,text,text,text)
CREATE OR REPLACE FUNCTION public.tfi_module_import_batch_start(p_spreadsheet_id text, p_spreadsheet_title text, p_source_sha256 text, p_filename text, p_source_revision_id text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_id uuid; v_status text; v_actor uuid:=auth.uid(); v_authoritative boolean;
begin
  if v_actor is null or not private.tfi_has_permission('spreadsheet_import','create') then
    raise exception using errcode='42501',message='spreadsheet_import_create_permission_required';
  end if;
  if p_spreadsheet_id is null or length(p_spreadsheet_id) not between 20 and 128
     or p_source_sha256 is null or p_source_sha256 !~ '^[a-f0-9]{64}$'
     or p_filename is null or length(p_filename) not between 1 and 180
     or p_spreadsheet_title is null or length(p_spreadsheet_title) not between 1 and 180
     or (p_source_revision_id is not null and length(p_source_revision_id)>240) then
    raise exception using errcode='22023',message='invalid_module_import_batch_metadata';
  end if;
  select w.is_authoritative into v_authoritative
  from public.tfi_source_workbooks w where w.spreadsheet_id=p_spreadsheet_id;
  if coalesce(v_authoritative,false) is not true then
    raise exception using errcode='42501',message='source_workbook_not_authoritative';
  end if;
  insert into public.tfi_module_import_batches
    (spreadsheet_id,spreadsheet_title,source_sha256,source_revision_id,filename,imported_by)
  values (p_spreadsheet_id,btrim(p_spreadsheet_title),p_source_sha256,p_source_revision_id,btrim(p_filename),v_actor)
  on conflict (spreadsheet_id,source_sha256,imported_by) do update
    set spreadsheet_title=excluded.spreadsheet_title,
        source_revision_id=coalesce(excluded.source_revision_id,public.tfi_module_import_batches.source_revision_id),
        filename=excluded.filename
  returning id,status into v_id,v_status;
  perform private.tfi_write_import_audit_event(
    'module_import.batch_started','spreadsheet_import','module_import_batch',v_id::text,
    null,jsonb_build_object('spreadsheet_id',p_spreadsheet_id,'status',v_status),
    jsonb_build_object('source_sha256',p_source_sha256,'filename',p_filename)
  );
  return jsonb_build_object('batch_id',v_id,'status',v_status,'idempotent_snapshot',true);
end;
$function$


-- Signature: tfi_module_import_drafts_approve(uuid[],boolean,text)
CREATE OR REPLACE FUNCTION public.tfi_module_import_drafts_approve(p_draft_ids uuid[], p_confirm_source_frozen boolean, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid:=auth.uid();
  v_draft public.tfi_module_import_drafts%rowtype;
  v_inbox public.tfi_module_import_inbox%rowtype;
  v_batch public.tfi_module_import_batches%rowtype;
  v_date date;
  v_line text;
  v_product text;
  v_code text;
  v_duplicate boolean;
  v_processed integer:=0;
  v_approved integer:=0;
begin
  if v_actor is null
     or not private.tfi_has_permission('spreadsheet_import','approve')
     or not private.tfi_has_permission('production_entry','approve') then
    raise exception using errcode='42501',message='production_summary_draft_approval_permission_required';
  end if;
  if p_draft_ids is null or cardinality(p_draft_ids)<1 or cardinality(p_draft_ids)>100
     or p_confirm_source_frozen is not true
     or (p_note is not null and length(p_note)>500)
     or (select count(distinct x) from unnest(p_draft_ids) x)<>cardinality(p_draft_ids) then
    raise exception using errcode='22023',message='invalid_production_summary_draft_approval_request';
  end if;

  for v_draft in
    select d.* from public.tfi_module_import_drafts d
    where d.id=any(p_draft_ids)
    order by d.created_at,d.source_row
    for update
  loop
    v_processed:=v_processed+1;
    if v_draft.status<>'pending_approval' then
      raise exception using errcode='22023',message='only_pending_historical_drafts_can_be_approved';
    end if;
    select * into v_batch from public.tfi_module_import_batches
    where id=v_draft.batch_id for update;
    if not found or v_batch.status<>'completed'
       or v_batch.spreadsheet_id is distinct from v_draft.source_spreadsheet_id then
      raise exception using errcode='22023',message='historical_draft_source_batch_is_not_valid';
    end if;
    select * into v_inbox from public.tfi_module_import_inbox
    where id=v_draft.inbox_id for update;
    if not found or v_inbox.version<>v_draft.inbox_version
       or v_inbox.disposition<>'ready_for_draft'
       or v_inbox.validation_state<>'valid'
       or not (v_inbox.issue_codes @> '["phase41_7_validated_ready"]'::jsonb) then
      raise exception using errcode='40001',message='historical_draft_inbox_changed_revalidate_before_approval';
    end if;

    v_date:=nullif(v_draft.normalized_payload->>'production_date','')::date;
    v_line:=v_draft.normalized_payload->>'line';
    v_product:=v_draft.normalized_payload->>'product_name';
    v_code:=nullif(v_draft.normalized_payload->>'product_code','');
    select exists (
      select 1 from public.tfi_production_entry_records p
      where p.record_status='active' and p.production_date=v_date and p.line=v_line
        and ((v_code is not null and upper(coalesce(p.product_code,''))=upper(v_code))
          or (v_code is null and upper(coalesce(p.product_name,''))=upper(coalesce(v_product,''))))
    ) into v_duplicate;
    if v_duplicate then
      raise exception using errcode='23505',message='historical_draft_duplicate_detected_revalidate_required';
    end if;
    select exists (
      select 1 from public.tfi_module_import_drafts other
      where other.id<>v_draft.id and other.batch_id=v_draft.batch_id
        and other.status='approved_for_promotion'
        and other.normalized_payload->>'production_date'=v_draft.normalized_payload->>'production_date'
        and other.normalized_payload->>'line'=v_draft.normalized_payload->>'line'
        and (
          (v_code is not null and upper(coalesce(other.normalized_payload->>'product_code',''))=upper(v_code))
          or (v_code is null and upper(coalesce(other.normalized_payload->>'product_name',''))=upper(coalesce(v_product,'')))
        )
    ) into v_duplicate;
    if v_duplicate then
      raise exception using errcode='23505',message='another_historical_draft_with_same_business_identity_is_already_approved';
    end if;

    update public.tfi_module_import_drafts
    set status='approved_for_promotion',approved_by=v_actor,approved_at=now(),
        approval_note=nullif(btrim(p_note),''),version=version+1,
        updated_by=v_actor,updated_at=now()
    where id=v_draft.id;
    insert into public.tfi_module_import_draft_revisions(
      draft_id,old_version,new_version,old_status,new_status,old_payload,new_payload,
      actor,action,note
    ) values (
      v_draft.id,v_draft.version,v_draft.version+1,v_draft.status,
      'approved_for_promotion',v_draft.normalized_payload,v_draft.normalized_payload,
      v_actor,'approve_for_promotion',p_note
    );
    perform private.tfi_write_import_audit_event(
      'module_import.historical_draft_approved','production_entry','historical_import_draft',v_draft.id::text,
      jsonb_build_object('status',v_draft.status),
      jsonb_build_object('status','approved_for_promotion','source_row',v_draft.source_row),
      jsonb_build_object('batch_id',v_draft.batch_id,'source_sha256',v_batch.source_sha256,
        'source_frozen_confirmed',true,'note',p_note,'operational_write',false)
    );
    v_approved:=v_approved+1;
  end loop;
  if v_processed<>cardinality(p_draft_ids) then
    raise exception using errcode='P0002',message='one_or_more_historical_drafts_were_not_found';
  end if;
  return jsonb_build_object('status','approved_for_promotion','processed',v_processed,
    'approved',v_approved,'operational_writes',false,
    'note','Approved drafts remain outside Production Entry until the separate historical promotion phase.');
end;
$function$


-- Signature: tfi_module_import_drafts_create(uuid,integer)
CREATE OR REPLACE FUNCTION public.tfi_module_import_drafts_create(p_batch_id uuid, p_limit integer DEFAULT 250)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid:=auth.uid();
  v_batch public.tfi_module_import_batches%rowtype;
  v_row public.tfi_module_import_inbox%rowtype;
  v_draft public.tfi_module_import_drafts%rowtype;
  v_created integer:=0;
  v_refreshed integer:=0;
  v_unchanged integer:=0;
  v_skipped integer:=0;
  v_fingerprint text;
begin
  if v_actor is null
     or not private.tfi_has_permission('spreadsheet_import','create')
     or not private.tfi_has_permission('production_entry','create') then
    raise exception using errcode='42501',message='production_summary_draft_create_permission_required';
  end if;
  if p_batch_id is null or p_limit is null or p_limit not between 1 and 500 then
    raise exception using errcode='22023',message='invalid_production_summary_draft_create_request';
  end if;
  select * into v_batch from public.tfi_module_import_batches
  where id=p_batch_id for update;
  if not found then raise exception using errcode='P0002',message='module_import_batch_not_found'; end if;
  if v_batch.status<>'completed' then
    raise exception using errcode='22023',message='source_batch_must_be_completed_before_draft_create';
  end if;
  if v_batch.spreadsheet_id is distinct from '1rCbQ16wj7MRjQCFF3tA-WEMkudraJK0RkwcqayUlz7k' then
    raise exception using errcode='42501',message='production_summary_source_not_authorized';
  end if;

  for v_row in
    select i.* from public.tfi_module_import_inbox i
    where i.batch_id=p_batch_id and i.module='production_summary'
      and i.source_sheet='Production Summary'
      and i.disposition='ready_for_draft' and i.validation_state='valid'
      and i.issue_codes @> '["phase41_7_validated_ready"]'::jsonb
    order by i.source_row,i.source_slot,i.id
    limit p_limit
    for update skip locked
  loop
    v_fingerprint:=encode(extensions.digest(convert_to(v_row.normalized_payload::text,'UTF8'),'sha256'),'hex');
    select * into v_draft from public.tfi_module_import_drafts
    where inbox_id=v_row.id for update;
    if not found then
      insert into public.tfi_module_import_drafts(
        inbox_id,batch_id,module,source_spreadsheet_id,source_sheet,source_row,
        source_slot,source_key,source_fingerprint_sha256,inbox_version,
        normalized_payload,payload_fingerprint_sha256,validation_summary,
        status,created_by,updated_by
      ) values (
        v_row.id,p_batch_id,'production_summary',v_row.source_spreadsheet_id,
        v_row.source_sheet,v_row.source_row,v_row.source_slot,v_row.source_key,
        v_row.source_fingerprint_sha256,v_row.version,v_row.normalized_payload,
        v_fingerprint,jsonb_build_object('validation_state',v_row.validation_state,
          'issue_codes',v_row.issue_codes,'issue_details',v_row.issue_details),
        'pending_approval',v_actor,v_actor
      ) returning * into v_draft;
      v_created:=v_created+1;
      perform private.tfi_write_import_audit_event(
        'module_import.historical_draft_created','production_entry','historical_import_draft',v_draft.id::text,
        null,jsonb_build_object('status',v_draft.status,'source_row',v_draft.source_row),
        jsonb_build_object('batch_id',p_batch_id,'inbox_id',v_row.id,'payload_fingerprint',v_fingerprint)
      );
    elsif v_draft.status='pending_approval' and v_draft.inbox_version<>v_row.version then
      update public.tfi_module_import_drafts
      set inbox_version=v_row.version,normalized_payload=v_row.normalized_payload,
          payload_fingerprint_sha256=v_fingerprint,
          validation_summary=jsonb_build_object('validation_state',v_row.validation_state,
            'issue_codes',v_row.issue_codes,'issue_details',v_row.issue_details),
          version=version+1,updated_by=v_actor,updated_at=now()
      where id=v_draft.id returning * into v_draft;
      insert into public.tfi_module_import_draft_revisions(
        draft_id,old_version,new_version,old_status,new_status,old_payload,new_payload,
        actor,action,note
      ) values (
        v_draft.id,v_draft.version-1,v_draft.version,'pending_approval','pending_approval',
        null,v_row.normalized_payload,v_actor,'refresh_from_inbox','Inbox row was revalidated.'
      );
      v_refreshed:=v_refreshed+1;
    else
      v_unchanged:=v_unchanged+1;
    end if;
  end loop;

  select count(*)::integer into v_skipped
  from public.tfi_module_import_inbox i
  where i.batch_id=p_batch_id and i.module='production_summary'
    and i.disposition='ready_for_draft' and i.validation_state='valid'
    and i.issue_codes @> '["phase41_7_validated_ready"]'::jsonb
    and not exists (select 1 from public.tfi_module_import_drafts d where d.inbox_id=i.id);
  return jsonb_build_object('status','drafts_created','batch_id',p_batch_id,
    'created',v_created,'refreshed',v_refreshed,'unchanged',v_unchanged,
    'remaining',v_skipped,'operational_writes',false);
end;
$function$


-- Signature: tfi_module_import_drafts_promote(uuid,uuid[],boolean,boolean)
CREATE OR REPLACE FUNCTION public.tfi_module_import_drafts_promote(p_batch_id uuid, p_draft_ids uuid[], p_confirm_source_frozen boolean, p_confirm_promotion boolean)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select private.tfi_module_import_drafts_promote(
    p_batch_id,p_draft_ids,p_confirm_source_frozen,p_confirm_promotion
  );
$function$


-- Signature: tfi_module_import_drafts_status(uuid,integer,integer,text)
CREATE OR REPLACE FUNCTION public.tfi_module_import_drafts_status(p_batch_id uuid, p_page integer DEFAULT 1, p_page_size integer DEFAULT 50, p_status text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_actor uuid:=auth.uid();
  v_total integer;
  v_counts jsonb;
  v_rows jsonb;
begin
  if v_actor is null or not private.tfi_has_permission('spreadsheet_import','view') then
    raise exception using errcode='42501',message='spreadsheet_import_view_permission_required';
  end if;
  if p_batch_id is null or p_page is null or p_page<1
     or p_page_size is null or p_page_size not in (25,50,100)
     or (p_status is not null and p_status not in (
       'pending_approval','approved_for_promotion','promoted','rejected','superseded','held_review'
     )) then
    raise exception using errcode='22023',message='invalid_historical_draft_status_request';
  end if;
  select count(*)::integer into v_total
  from public.tfi_module_import_drafts d
  where d.batch_id=p_batch_id and (p_status is null or d.status=p_status);
  select jsonb_build_object(
    'pending_approval',count(*) filter(where status='pending_approval'),
    'approved_for_promotion',count(*) filter(where status='approved_for_promotion'),
    'promoted',count(*) filter(where status='promoted'),
    'rejected',count(*) filter(where status='rejected'),
    'superseded',count(*) filter(where status='superseded'),
    'held_review',count(*) filter(where status='held_review')
  ) into v_counts
  from public.tfi_module_import_drafts where batch_id=p_batch_id;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.source_row,x.source_slot),'[]'::jsonb)
  into v_rows
  from (
    select d.id,d.inbox_id,d.batch_id,d.module,d.source_sheet,d.source_row,d.source_slot,
      d.source_key,d.inbox_version,d.normalized_payload,d.validation_summary,d.status,
      d.version,d.created_at,d.updated_at,d.approved_at,d.approval_note,
      d.promoted_record_id,d.promoted_at,d.promotion_entry_batch_id,
      d.promotion_source_row_number,d.promotion_hold_reason
    from public.tfi_module_import_drafts d
    where d.batch_id=p_batch_id and (p_status is null or d.status=p_status)
    order by d.source_row,d.source_slot,d.id
    limit p_page_size offset (p_page-1)*p_page_size
  ) x;
  return jsonb_build_object('status','ready','batch_id',p_batch_id,
    'total',v_total,'page',p_page,'page_size',p_page_size,
    'counts',coalesce(v_counts,'{}'::jsonb),
    'rows',v_rows,'operational_writes',false);
end;
$function$


-- Signature: tfi_module_import_inbox_edit(uuid,integer,jsonb,jsonb,jsonb,jsonb,text)
CREATE OR REPLACE FUNCTION public.tfi_module_import_inbox_edit(p_id uuid, p_version integer, p_normalized_payload jsonb, p_missing_fields jsonb, p_issue_codes jsonb, p_issue_details jsonb, p_validation_state text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_old public.tfi_module_import_inbox%rowtype; v_new public.tfi_module_import_inbox%rowtype;
  v_actor uuid:=auth.uid(); v_disposition text;
begin
  if v_actor is null or not private.tfi_has_permission('spreadsheet_import','edit')
     or not private.tfi_has_permission('production_entry','edit') then
    raise exception using errcode='42501',message='production_summary_inbox_edit_permission_required';
  end if;
  if p_id is null or p_version is null or p_version<1
     or p_normalized_payload is null or jsonb_typeof(p_normalized_payload)<>'object'
     or p_missing_fields is null or jsonb_typeof(p_missing_fields)<>'array'
     or p_issue_codes is null or jsonb_typeof(p_issue_codes)<>'array'
     or p_issue_details is null or jsonb_typeof(p_issue_details)<>'array'
     or p_validation_state not in ('valid','incomplete','invalid','needs_review')
     or octet_length(p_normalized_payload::text)>100000 then
    raise exception using errcode='22023',message='invalid_production_summary_inbox_edit';
  end if;
  select * into v_old from public.tfi_module_import_inbox
  where id=p_id and module='production_summary' and version=p_version
    and disposition in ('incomplete','held_review')
  for update;
  if not found then raise exception using errcode='P0002',message='inbox_row_changed_or_not_editable'; end if;
  v_disposition:=case when p_validation_state='valid'
      and jsonb_array_length(p_missing_fields)=0 and jsonb_array_length(p_issue_codes)=0
    then 'ready_for_draft' else 'incomplete' end;
  update public.tfi_module_import_inbox set
    normalized_payload=p_normalized_payload,missing_fields=p_missing_fields,
    issue_codes=p_issue_codes,issue_details=p_issue_details,
    validation_state=p_validation_state,disposition=v_disposition,
    version=version+1,updated_by=v_actor,updated_at=now()
  where id=p_id returning * into v_new;
  insert into public.tfi_module_import_inbox_revisions(
    inbox_id,old_version,new_version,old_payload,new_payload,
    old_validation_state,new_validation_state,old_disposition,new_disposition,actor,action
  ) values (
    v_old.id,v_old.version,v_new.version,v_old.normalized_payload,v_new.normalized_payload,
    v_old.validation_state,v_new.validation_state,v_old.disposition,v_new.disposition,v_actor,'correct'
  );
  return jsonb_build_object('id',v_new.id,'version',v_new.version,
    'disposition',v_new.disposition,'validation_state',v_new.validation_state,
    'legacy_kpi_changed',false);
end;
$function$


-- Signature: tfi_module_import_inbox_revalidate(uuid,integer)
CREATE OR REPLACE FUNCTION public.tfi_module_import_inbox_revalidate(p_batch_id uuid, p_limit integer DEFAULT 250)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$


-- Signature: tfi_module_import_inbox_upsert(uuid,jsonb)
CREATE OR REPLACE FUNCTION public.tfi_module_import_inbox_upsert(p_batch_id uuid, p_rows jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$


-- Signature: tfi_source42_check_page(text,jsonb)
CREATE OR REPLACE FUNCTION public.tfi_source42_check_page(p_sheet text, p_rows jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$

