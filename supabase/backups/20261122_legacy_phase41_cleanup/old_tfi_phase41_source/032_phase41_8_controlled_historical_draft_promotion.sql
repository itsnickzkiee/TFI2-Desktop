-- Phase 41.8 — controlled, provenance-preserving historical Production Summary promotion.
-- Approved Drafts only. Existing Production Entry records are never updated or deleted.
-- Each date/line group is frozen at first promotion so row-slot assignments cannot drift.

create table if not exists public.tfi_historical_promotion_groups (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.tfi_module_import_batches(id) on delete restrict,
  production_date date not null,
  line text not null check (line in ('Agri','Meat','Finishing')),
  source_spreadsheet_id text not null,
  source_sha256 text not null check (source_sha256 ~ '^[a-f0-9]{64}$'),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique(batch_id,production_date,line)
);
create index if not exists tfi_historical_promotion_groups_batch_idx
  on public.tfi_historical_promotion_groups(batch_id,production_date,line);

alter table public.tfi_module_import_drafts
  add column if not exists promoted_record_id uuid,
  add column if not exists promoted_at timestamptz,
  add column if not exists promoted_by uuid,
  add column if not exists promotion_entry_batch_id uuid,
  add column if not exists promotion_source_row_number smallint,
  add column if not exists promotion_hold_reason text;

alter table public.tfi_module_import_drafts
  drop constraint if exists tfi_module_import_drafts_status_check,
  drop constraint if exists tfi_module_import_drafts_check,
  drop constraint if exists tfi_module_import_drafts_promoted_state_check,
  drop constraint if exists tfi_module_import_drafts_promotion_source_row_number_check,
  drop constraint if exists tfi_module_import_drafts_promotion_hold_reason_check,
  drop constraint if exists tfi_module_import_drafts_promoted_by_fkey,
  drop constraint if exists tfi_module_import_drafts_promoted_record_id_fkey,
  drop constraint if exists tfi_module_import_drafts_promotion_entry_batch_id_fkey;

alter table public.tfi_module_import_drafts
  add constraint tfi_module_import_drafts_status_check
    check (status in ('pending_approval','approved_for_promotion','promoted','rejected','superseded','held_review')),
  add constraint tfi_module_import_drafts_check
    check (
      (status in ('approved_for_promotion','promoted') and approved_by is not null and approved_at is not null)
      or (status not in ('approved_for_promotion','promoted') and approved_by is null and approved_at is null)
    ),
  add constraint tfi_module_import_drafts_promoted_state_check
    check (
      (status='promoted' and promoted_record_id is not null and promoted_at is not null
        and promoted_by is not null and promotion_entry_batch_id is not null
        and promotion_source_row_number is not null)
      or
      (status<>'promoted' and promoted_record_id is null and promoted_at is null and promoted_by is null)
    ),
  add constraint tfi_module_import_drafts_promotion_source_row_number_check
    check (promotion_source_row_number is null or promotion_source_row_number between 8 and 19),
  add constraint tfi_module_import_drafts_promotion_hold_reason_check
    check (promotion_hold_reason is null or length(promotion_hold_reason)<=500),
  add constraint tfi_module_import_drafts_promoted_by_fkey
    foreign key (promoted_by) references auth.users(id),
  add constraint tfi_module_import_drafts_promoted_record_id_fkey
    foreign key (promoted_record_id) references public.tfi_production_entry_records(id) on delete restrict,
  add constraint tfi_module_import_drafts_promotion_entry_batch_id_fkey
    foreign key (promotion_entry_batch_id) references public.tfi_historical_promotion_groups(id) on delete restrict;

alter table public.tfi_production_entry_records
  add column if not exists source_import_batch_id uuid,
  add column if not exists source_import_draft_id uuid,
  add column if not exists source_import_spreadsheet_id text,
  add column if not exists source_import_sheet text,
  add column if not exists source_import_sheet_row integer,
  add column if not exists source_import_source_key text,
  add column if not exists source_import_fingerprint_sha256 text;

alter table public.tfi_production_entry_records
  drop constraint if exists tfi_production_entry_records_source_import_batch_id_fkey,
  drop constraint if exists tfi_production_entry_records_source_import_draft_id_fkey,
  drop constraint if exists tfi_production_entry_records_source_import_provenance_check;

alter table public.tfi_production_entry_records
  add constraint tfi_production_entry_records_source_import_batch_id_fkey
    foreign key (source_import_batch_id) references public.tfi_module_import_batches(id) on delete restrict,
  add constraint tfi_production_entry_records_source_import_draft_id_fkey
    foreign key (source_import_draft_id) references public.tfi_module_import_drafts(id) on delete restrict,
  add constraint tfi_production_entry_records_source_import_provenance_check
    check (
      (source_import_draft_id is null and source_import_batch_id is null
        and source_import_spreadsheet_id is null and source_import_sheet is null
        and source_import_sheet_row is null and source_import_source_key is null
        and source_import_fingerprint_sha256 is null)
      or
      (source_import_draft_id is not null and source_import_batch_id is not null
        and source_import_spreadsheet_id is not null and length(source_import_spreadsheet_id) between 20 and 128
        and source_import_sheet='Production Summary'
        and source_import_sheet_row between 7 and 13188
        and source_import_source_key is not null and length(source_import_source_key) between 1 and 240
        and source_import_fingerprint_sha256 ~ '^[a-f0-9]{64}$')
    );

create unique index if not exists tfi_production_entry_source_import_draft_uidx
  on public.tfi_production_entry_records(source_import_draft_id)
  where source_import_draft_id is not null;

-- Match the same date + line + product identity rule used by historical duplicate preflight.
-- The existing table was checked before adding this index; it currently has no active records.
create unique index if not exists tfi_production_entry_active_business_identity_uidx
  on public.tfi_production_entry_records(
    production_date,line,
    upper(coalesce(nullif(btrim(product_code),''),nullif(btrim(product_name),'')))
  )
  where record_status='active' and production_date is not null and product_name is not null;

alter table public.tfi_historical_promotion_groups enable row level security;
revoke all on public.tfi_historical_promotion_groups from public,anon,authenticated;

create or replace function private.tfi_guard_historical_promotion_freeze()
returns trigger
language plpgsql
set search_path=''
as $function$
declare
  v_batch uuid;
  v_payload jsonb;
  v_date date;
  v_line text;
begin
  if current_setting('tfi.phase41_8_promoting',true)='on' then
    if tg_op='DELETE' then return old; else return new; end if;
  end if;

  if tg_op<>'DELETE' then
    v_batch:=new.batch_id;
    v_payload:=new.normalized_payload;
    begin
      v_date:=nullif(v_payload->>'production_date','')::date;
    exception when others then
      v_date:=null;
    end;
    v_line:=nullif(v_payload->>'line','');
    if v_batch is not null and v_date is not null and v_line is not null
       and exists (
         select 1 from public.tfi_historical_promotion_groups g
         where g.batch_id=v_batch and g.production_date=v_date and g.line=v_line
       ) then
      raise exception using errcode='55000',message='historical_promotion_group_frozen';
    end if;
  end if;

  if tg_op in ('UPDATE','DELETE') then
    v_batch:=old.batch_id;
    v_payload:=old.normalized_payload;
    begin
      v_date:=nullif(v_payload->>'production_date','')::date;
    exception when others then
      v_date:=null;
    end;
    v_line:=nullif(v_payload->>'line','');
    if v_batch is not null and v_date is not null and v_line is not null
       and exists (
         select 1 from public.tfi_historical_promotion_groups g
         where g.batch_id=v_batch and g.production_date=v_date and g.line=v_line
       ) then
      raise exception using errcode='55000',message='historical_promotion_group_frozen';
    end if;
  end if;

  if tg_op='DELETE' then return old; else return new; end if;
end;
$function$;
revoke all on function private.tfi_guard_historical_promotion_freeze() from public,anon,authenticated;

drop trigger if exists tfi_module_import_inbox_historical_promotion_freeze
  on public.tfi_module_import_inbox;
create trigger tfi_module_import_inbox_historical_promotion_freeze
before insert or update or delete on public.tfi_module_import_inbox
for each row execute function private.tfi_guard_historical_promotion_freeze();

drop trigger if exists tfi_module_import_drafts_historical_promotion_freeze
  on public.tfi_module_import_drafts;
create trigger tfi_module_import_drafts_historical_promotion_freeze
before insert or update or delete on public.tfi_module_import_drafts
for each row execute function private.tfi_guard_historical_promotion_freeze();

create or replace function private.tfi_module_import_drafts_promote(
  p_batch_id uuid,
  p_draft_ids uuid[],
  p_confirm_source_frozen boolean,
  p_confirm_promotion boolean
) returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
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
$function$;

revoke all on function private.tfi_module_import_drafts_promote(uuid,uuid[],boolean,boolean)
  from public,anon,authenticated;
grant usage on schema private to authenticated;
grant execute on function private.tfi_module_import_drafts_promote(uuid,uuid[],boolean,boolean)
  to authenticated;

create or replace function public.tfi_module_import_drafts_promote(
  p_batch_id uuid,p_draft_ids uuid[],
  p_confirm_source_frozen boolean,p_confirm_promotion boolean
) returns jsonb
language sql
security invoker
set search_path=''
as $function$
  select private.tfi_module_import_drafts_promote(
    p_batch_id,p_draft_ids,p_confirm_source_frozen,p_confirm_promotion
  );
$function$;
revoke all on function public.tfi_module_import_drafts_promote(uuid,uuid[],boolean,boolean)
  from public,anon;
grant execute on function public.tfi_module_import_drafts_promote(uuid,uuid[],boolean,boolean)
  to authenticated;

create or replace function public.tfi_module_import_drafts_status(
  p_batch_id uuid,p_page integer default 1,p_page_size integer default 50,p_status text default null
) returns jsonb
language plpgsql
security invoker
set search_path=''
as $function$
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
$function$;
revoke all on function public.tfi_module_import_drafts_status(uuid,integer,integer,text)
  from public,anon;
grant execute on function public.tfi_module_import_drafts_status(uuid,integer,integer,text)
  to authenticated;
