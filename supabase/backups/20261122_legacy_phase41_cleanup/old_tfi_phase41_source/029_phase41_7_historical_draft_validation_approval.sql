-- Phase 41.7 — Production Summary validation, isolated Drafts and explicit approval.
-- This migration never writes to tfi_production_entry_records.
-- Approved historical Drafts remain queued for a later, separately confirmed promotion phase.

create table if not exists public.tfi_module_import_drafts (
  id uuid primary key default gen_random_uuid(),
  inbox_id uuid not null references public.tfi_module_import_inbox(id) on delete restrict,
  batch_id uuid not null references public.tfi_module_import_batches(id) on delete restrict,
  module text not null check (module='production_summary'),
  source_spreadsheet_id text not null,
  source_sheet text not null check (source_sheet='Production Summary'),
  source_row integer not null check (source_row between 7 and 13188),
  source_slot text not null default '',
  source_key text not null,
  source_fingerprint_sha256 text not null check (source_fingerprint_sha256 ~ '^[a-f0-9]{64}$'),
  inbox_version integer not null check (inbox_version>0),
  normalized_payload jsonb not null check (jsonb_typeof(normalized_payload)='object'),
  payload_fingerprint_sha256 text not null check (payload_fingerprint_sha256 ~ '^[a-f0-9]{64}$'),
  validation_summary jsonb not null default '{}'::jsonb check (jsonb_typeof(validation_summary)='object'),
  status text not null default 'pending_approval'
    check (status in ('pending_approval','approved_for_promotion','rejected','superseded','held_review')),
  version integer not null default 1 check (version>0),
  created_by uuid not null references auth.users(id),
  updated_by uuid references auth.users(id),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  approval_note text check (approval_note is null or length(approval_note)<=500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(inbox_id),
  check (
    (status='approved_for_promotion' and approved_by is not null and approved_at is not null)
    or (status<>'approved_for_promotion' and approved_by is null and approved_at is null)
  )
);
create index if not exists tfi_module_import_drafts_batch_status_idx
  on public.tfi_module_import_drafts(batch_id,status,source_row,source_slot);
create index if not exists tfi_module_import_drafts_source_identity_idx
  on public.tfi_module_import_drafts(source_spreadsheet_id,source_sheet,source_row,source_slot);
create index if not exists tfi_module_import_drafts_payload_idx
  on public.tfi_module_import_drafts(batch_id,payload_fingerprint_sha256);

create table if not exists public.tfi_module_import_draft_revisions (
  id bigint generated always as identity primary key,
  draft_id uuid not null references public.tfi_module_import_drafts(id) on delete restrict,
  old_version integer not null,
  new_version integer not null,
  old_status text not null,
  new_status text not null,
  old_payload jsonb,
  new_payload jsonb,
  actor uuid not null references auth.users(id),
  action text not null check (length(action) between 1 and 80),
  note text check (note is null or length(note)<=500),
  created_at timestamptz not null default now()
);
create index if not exists tfi_module_import_draft_revisions_draft_idx
  on public.tfi_module_import_draft_revisions(draft_id,created_at desc);

alter table public.tfi_module_import_drafts enable row level security;
alter table public.tfi_module_import_draft_revisions enable row level security;
drop policy if exists tfi2_module_import_drafts_read on public.tfi_module_import_drafts;
create policy tfi2_module_import_drafts_read on public.tfi_module_import_drafts
  for select to authenticated using (private.tfi_has_permission('spreadsheet_import','view'));
drop policy if exists tfi2_module_import_draft_revisions_read on public.tfi_module_import_draft_revisions;
create policy tfi2_module_import_draft_revisions_read on public.tfi_module_import_draft_revisions
  for select to authenticated using (private.tfi_has_permission('spreadsheet_import','view'));
revoke all on public.tfi_module_import_drafts,public.tfi_module_import_draft_revisions from public,anon,authenticated;
grant select on public.tfi_module_import_drafts,public.tfi_module_import_draft_revisions to authenticated;
grant usage,select on sequence public.tfi_module_import_draft_revisions_id_seq to authenticated;

create or replace function public.tfi_module_import_inbox_revalidate(
  p_batch_id uuid,p_limit integer default 250
) returns jsonb
language plpgsql security definer set search_path=''
as $function$
declare
  v_actor uuid:=auth.uid();
  v_batch public.tfi_module_import_batches%rowtype;
  v_row public.tfi_module_import_inbox%rowtype;
  v_other public.tfi_module_import_inbox%rowtype;
  v_catalog jsonb;
  v_payload jsonb;
  v_new_payload jsonb;
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
      and s.source_kind='transaction_history'
      and s.destination_module_key='production_entry'
  ) then
    raise exception using errcode='42501',message='production_summary_source_registry_mismatch';
  end if;
  select catalog_data into v_catalog from public.tfi_production_entry_catalog where catalog_key='source';
  if v_catalog is null then
    raise exception using errcode='P0001',message='production_entry_catalog_missing';
  end if;

  for v_row in
    select i.* from public.tfi_module_import_inbox i
    where i.batch_id=p_batch_id and i.module='production_summary'
      and i.source_sheet='Production Summary'
      and i.disposition in ('ready_for_draft','incomplete','held_review','duplicate_existing')
      and not exists (
        select 1 from public.tfi_module_import_drafts d
        where d.inbox_id=i.id and d.status='approved_for_promotion'
      )
    order by i.source_row,i.source_slot,i.id
    limit p_limit
    for update skip locked
  loop
    v_processed:=v_processed+1;
    v_payload:=v_row.normalized_payload;
    v_new_payload:=v_payload;
    v_missing:='{}'::text[];
    v_issue_code:='phase41_7_validated_ready';
    v_issue_detail:='Historical Production Summary row passed TFI2 field, catalog, source and duplicate validation. It is eligible for a separate Pending Draft; it is not an operational record.';
    v_state:='valid';
    v_disposition:='ready_for_draft';
    v_duplicate:=false;
    v_source_collision:=false;
    v_date:=null; v_line:=null; v_product:=null; v_code:=null; v_uom:=null;

    if v_payload is null or jsonb_typeof(v_payload)<>'object' then
      v_state:='needs_review'; v_disposition:='held_review';
      v_issue_code:='phase41_7_payload_missing';
      v_issue_detail:='No normalized candidate payload is available. Keep the original source row in Import Inbox.';
    elsif exists (
      select 1 from jsonb_object_keys(v_payload) as keys(key)
      where key not in ('production_date','line','product_name','product_code','batches',
        'target','produced','uom','plan_start','actual_start','plan_end',
        'actual_end_prod','actual_end_cleaning','manpower_required','present','ot_hours','remarks')
    ) then
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
          select 1 from jsonb_array_elements_text(v_catalog->'product_names') p(value)
          where p.value=v_product
        ) then
          v_state:='invalid'; v_disposition:='held_review';
          v_issue_code:='phase41_7_unknown_product';
          v_issue_detail:='Product Name is not present in the current TFI2 Production Entry catalog.';
        elsif v_code is not null and (
          v_product is null or not exists (
            select 1 from jsonb_array_elements_text(v_catalog->'product_codes'->v_product) c(value)
            where c.value=v_code
          )
        ) then
          v_state:='invalid'; v_disposition:='held_review';
          v_issue_code:='phase41_7_product_code_mismatch';
          v_issue_detail:='Product Code does not belong to the selected Product Name in the current TFI2 catalog.';
        elsif v_uom is not null and not exists (
          select 1 from jsonb_array_elements_text(v_catalog->'uom') u(value)
          where u.value=v_uom
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
                where p.record_status='active'
                  and p.production_date=v_date and p.line=v_line
                  and (
                    (v_code is not null and upper(coalesce(p.product_code,''))=upper(v_code))
                    or (v_code is null and upper(coalesce(p.product_name,''))=upper(v_product))
                  )
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
                    and (
                      (v_code is not null and upper(coalesce(other.normalized_payload->>'product_code',''))=upper(v_code))
                      or (v_code is null and upper(coalesce(other.normalized_payload->>'product_name',''))=upper(v_product))
                    )
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
       or v_row.issue_codes is distinct from jsonb_build_array(v_issue_code)
       or v_row.issue_details is distinct from jsonb_build_array(v_issue_detail)
       or v_row.missing_fields is distinct from to_jsonb(v_missing) then
      update public.tfi_module_import_inbox
      set disposition=v_disposition,validation_state=v_state,
          issue_codes=jsonb_build_array(v_issue_code),
          issue_details=jsonb_build_array(v_issue_detail),
          missing_fields=to_jsonb(v_missing),
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
    and not exists (
      select 1 from public.tfi_module_import_drafts d
      where d.inbox_id=i.id and d.status='approved_for_promotion'
    );
  return jsonb_build_object(
    'status','revalidated','batch_id',p_batch_id,'module','production_summary',
    'processed',v_processed,'updated',v_updated,'ready_for_draft',v_ready,
    'incomplete',v_incomplete,'duplicate_existing',v_duplicates,'held_review',v_held,
    'remaining',v_remaining,'operational_writes',false
  );
end;
$function$;

create or replace function public.tfi_module_import_drafts_create(
  p_batch_id uuid,p_limit integer default 250
) returns jsonb
language plpgsql security definer set search_path=''
as $function$
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
$function$;

create or replace function public.tfi_module_import_drafts_approve(
  p_draft_ids uuid[],p_confirm_source_frozen boolean,p_note text default null
) returns jsonb
language plpgsql security definer set search_path=''
as $function$
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
$function$;

create or replace function public.tfi_module_import_drafts_status(
  p_batch_id uuid,p_page integer default 1,p_page_size integer default 50,p_status text default null
) returns jsonb
language plpgsql security definer set search_path=''
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
     or (p_status is not null and p_status not in ('pending_approval','approved_for_promotion','rejected','superseded','held_review')) then
    raise exception using errcode='22023',message='invalid_historical_draft_status_request';
  end if;
  select count(*)::integer into v_total from public.tfi_module_import_drafts d
  where d.batch_id=p_batch_id and (p_status is null or d.status=p_status);
  select jsonb_build_object(
    'pending_approval',count(*) filter(where status='pending_approval'),
    'approved_for_promotion',count(*) filter(where status='approved_for_promotion'),
    'rejected',count(*) filter(where status='rejected'),
    'superseded',count(*) filter(where status='superseded'),
    'held_review',count(*) filter(where status='held_review')
  ) into v_counts from public.tfi_module_import_drafts where batch_id=p_batch_id;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.source_row,x.source_slot),'[]'::jsonb) into v_rows
  from (
    select d.id,d.inbox_id,d.batch_id,d.module,d.source_sheet,d.source_row,d.source_slot,
      d.source_key,d.inbox_version,d.normalized_payload,d.validation_summary,d.status,
      d.version,d.created_at,d.updated_at,d.approved_at,d.approval_note
    from public.tfi_module_import_drafts d
    where d.batch_id=p_batch_id and (p_status is null or d.status=p_status)
    order by d.source_row,d.source_slot,d.id
    limit p_page_size offset (p_page-1)*p_page_size
  ) x;
  return jsonb_build_object('status','ready','batch_id',p_batch_id,
    'total',v_total,'page',p_page,'page_size',p_page_size,'counts',coalesce(v_counts,'{}'::jsonb),
    'rows',v_rows,'operational_writes',false);
end;
$function$;

revoke all on function public.tfi_module_import_inbox_revalidate(uuid,integer) from public,anon;
revoke all on function public.tfi_module_import_drafts_create(uuid,integer) from public,anon;
revoke all on function public.tfi_module_import_drafts_approve(uuid[],boolean,text) from public,anon;
revoke all on function public.tfi_module_import_drafts_status(uuid,integer,integer,text) from public,anon;
grant execute on function public.tfi_module_import_inbox_revalidate(uuid,integer) to authenticated;
grant execute on function public.tfi_module_import_drafts_create(uuid,integer) to authenticated;
grant execute on function public.tfi_module_import_drafts_approve(uuid[],boolean,text) to authenticated;
grant execute on function public.tfi_module_import_drafts_status(uuid,integer,integer,text) to authenticated;
