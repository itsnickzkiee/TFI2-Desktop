-- Exact live TFI2 definition captured before legacy cleanup on 2026-11-22.
-- Restore reference only; this SECURITY DEFINER preflight RPC depends on the retired Phase 41 import inbox.
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

