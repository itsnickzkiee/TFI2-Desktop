-- Phase 41.6 — TFI2 module Import Inbox foundation for historical Production Summary.
-- Additive only. No source rows are imported and no operational records are modified.
-- The Production Summary is staged as reviewable Inbox data only; promotion is a later, separate approval step.

create table if not exists public.tfi_module_import_batches (
  id uuid primary key default gen_random_uuid(),
  spreadsheet_id text not null check (length(spreadsheet_id) between 20 and 128),
  spreadsheet_title text not null default 'TFI source workbook' check (length(spreadsheet_title) between 1 and 180),
  source_sha256 text not null check (source_sha256 ~ '^[a-f0-9]{64}$'),
  source_revision_id text,
  filename text not null check (length(filename) between 1 and 180),
  status text not null default 'staged' check (status in ('staged','partial','completed','failed')),
  counts jsonb not null default '{}'::jsonb check (jsonb_typeof(counts) = 'object'),
  imported_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists tfi_module_import_batches_created_idx
  on public.tfi_module_import_batches(created_at desc);
create index if not exists tfi_module_import_batches_source_idx
  on public.tfi_module_import_batches(spreadsheet_id,source_sha256);
create unique index if not exists tfi_module_import_batches_snapshot_owner_uidx
  on public.tfi_module_import_batches(spreadsheet_id,source_sha256,imported_by);

create table if not exists public.tfi_module_import_inbox (
  id uuid primary key default gen_random_uuid(),
  module text not null check (module in (
    'productivity','product_entry','production_entry','production_schedule','oee',
    'hourly_meat','hourly_coding','hourly_agri','dmr_production','dmr_coding',
    'coding_dpr','pr_planning','pr_monitoring','co_qa','nonprod','dmp_production',
    'manpower','dmp_reference','schedule_summary','production_summary','schedule_lists',
    'product_standard','dpr_legend','kpi_setup','product_codes','yield_map',
    'product_entry_mapping','lists','removed_rows'
  )),
  source_spreadsheet_id text not null check (length(source_spreadsheet_id) between 20 and 128),
  source_sheet text not null check (length(source_sheet) between 1 and 120),
  source_row integer not null check (source_row between 1 and 50000),
  source_slot text not null default '' check (length(source_slot) <= 160),
  source_key text not null check (length(source_key) between 1 and 240),
  source_fingerprint_sha256 text not null check (source_fingerprint_sha256 ~ '^[a-f0-9]{64}$'),
  raw_source_cells jsonb not null default '{}'::jsonb check (jsonb_typeof(raw_source_cells) = 'object'),
  formula_provenance jsonb not null default '{}'::jsonb check (jsonb_typeof(formula_provenance) = 'object'),
  formatted_source_cells jsonb not null default '{}'::jsonb check (jsonb_typeof(formatted_source_cells) = 'object'),
  normalized_payload jsonb check (normalized_payload is null or jsonb_typeof(normalized_payload) = 'object'),
  validation_state text not null check (validation_state in ('valid','incomplete','invalid','needs_review','duplicate','excluded')),
  issue_codes jsonb not null default '[]'::jsonb check (jsonb_typeof(issue_codes) = 'array'),
  issue_details jsonb not null default '[]'::jsonb check (jsonb_typeof(issue_details) = 'array'),
  missing_fields jsonb not null default '[]'::jsonb check (jsonb_typeof(missing_fields) = 'array'),
  disposition text not null check (disposition in (
    'ready_for_draft','imported_draft','incomplete','held_review',
    'duplicate_existing','excluded_derived','blank_template'
  )),
  target_table text check (target_table is null or length(target_table) <= 120),
  target_record_id uuid,
  target_record_key text check (target_record_key is null or length(target_record_key) <= 240),
  batch_id uuid not null references public.tfi_module_import_batches(id) on delete restrict,
  version integer not null default 1 check (version > 0),
  created_by uuid not null references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(source_spreadsheet_id,source_sheet,source_row,source_slot,source_fingerprint_sha256)
);
create index if not exists tfi_module_import_inbox_module_status_idx
  on public.tfi_module_import_inbox(module,disposition,updated_at desc);
create index if not exists tfi_module_import_inbox_source_idx
  on public.tfi_module_import_inbox(source_spreadsheet_id,source_sheet,source_row);
create index if not exists tfi_module_import_inbox_batch_idx
  on public.tfi_module_import_inbox(batch_id,source_row);
create index if not exists tfi_module_import_inbox_target_idx
  on public.tfi_module_import_inbox(target_table,target_record_id)
  where target_record_id is not null;

create table if not exists public.tfi_module_import_inbox_revisions (
  id bigint generated always as identity primary key,
  inbox_id uuid not null references public.tfi_module_import_inbox(id) on delete restrict,
  old_version integer not null,
  new_version integer not null,
  old_payload jsonb,
  new_payload jsonb,
  old_validation_state text not null,
  new_validation_state text not null,
  old_disposition text not null,
  new_disposition text not null,
  actor uuid not null references auth.users(id),
  action text not null check (length(action) between 1 and 80),
  created_at timestamptz not null default now()
);
create index if not exists tfi_module_import_inbox_revisions_inbox_idx
  on public.tfi_module_import_inbox_revisions(inbox_id,created_at desc);

alter table public.tfi_module_import_batches enable row level security;
alter table public.tfi_module_import_inbox enable row level security;
alter table public.tfi_module_import_inbox_revisions enable row level security;

drop policy if exists tfi2_module_import_batches_read on public.tfi_module_import_batches;
create policy tfi2_module_import_batches_read on public.tfi_module_import_batches
  for select to authenticated using (private.tfi_has_permission('spreadsheet_import','view'));
drop policy if exists tfi2_module_import_inbox_read on public.tfi_module_import_inbox;
create policy tfi2_module_import_inbox_read on public.tfi_module_import_inbox
  for select to authenticated using (private.tfi_has_permission('spreadsheet_import','view'));
drop policy if exists tfi2_module_import_revisions_read on public.tfi_module_import_inbox_revisions;
create policy tfi2_module_import_revisions_read on public.tfi_module_import_inbox_revisions
  for select to authenticated using (private.tfi_has_permission('spreadsheet_import','view'));

revoke all on public.tfi_module_import_batches,public.tfi_module_import_inbox,
  public.tfi_module_import_inbox_revisions from public,anon,authenticated;
grant select on public.tfi_module_import_batches,public.tfi_module_import_inbox,
  public.tfi_module_import_inbox_revisions to authenticated;
grant usage,select on sequence public.tfi_module_import_inbox_revisions_id_seq to authenticated;

create or replace function public.tfi_module_import_batch_start(
  p_spreadsheet_id text,p_spreadsheet_title text,p_source_sha256 text,
  p_filename text,p_source_revision_id text default null
) returns jsonb
language plpgsql security definer set search_path=''
as $function$
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
  v_target_id uuid; v_target_key text; v_source_sheet_ref uuid;
  v_existing_fingerprint text;
begin
  if v_actor is null or not private.tfi_has_permission('spreadsheet_import','create')
     or not private.tfi_has_permission('production_entry','import') then
    raise exception using errcode='42501',message='production_summary_import_permission_required';
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
  if v_batch.status='completed' then
    raise exception using errcode='22023',message='module_import_batch_already_completed';
  end if;
  if v_batch.spreadsheet_id is distinct from '1rCbQ16wj7MRjQCFF3tA-WEMkudraJK0RkwcqayUlz7k' then
    raise exception using errcode='42501',message='production_summary_source_not_authorized';
  end if;
  select s.id into v_source_sheet_ref
  from public.tfi_source_sheets s
  join public.tfi_source_workbooks w on w.id=s.workbook_id
  where w.spreadsheet_id=v_batch.spreadsheet_id and w.is_authoritative
    and s.sheet_title='Production Summary' and s.sheet_id=1846667474
    and s.source_kind='transaction_history'
    and s.destination_module_key='production_entry';
  if v_source_sheet_ref is null then
    raise exception using errcode='42501',message='production_summary_source_registry_mismatch';
  end if;

  for r in select value from jsonb_array_elements(p_rows) loop
    v_seen:=v_seen+1;
    v_module:=r->>'module'; v_disposition:=r->>'disposition';
    v_validation:=r->>'validation_state'; v_source_sheet:=r->>'source_sheet';
    v_source_key:=r->>'source_key'; v_source_slot:=coalesce(r->>'source_slot','');
    v_fingerprint:=r->>'source_fingerprint_sha256';
    if v_module is distinct from 'production_summary' or v_source_sheet is distinct from 'Production Summary' then
      raise exception using errcode='22023',message='phase41_6_only_production_summary_is_enabled';
    end if;
    if v_source_key is null or length(v_source_key) not between 1 and 240
       or length(v_source_slot)>160 or v_fingerprint is null
       or v_fingerprint !~ '^[a-f0-9]{64}$' or jsonb_typeof(r->'source_row')<>'number' then
      raise exception using errcode='22023',message='invalid_production_summary_source_identity';
    end if;
    v_source_row:=(r->>'source_row')::integer;
    if v_source_row<7 or v_source_row>13188 then
      raise exception using errcode='22023',message='production_summary_source_row_out_of_range';
    end if;
    if v_disposition not in ('ready_for_draft','incomplete','held_review','duplicate_existing','excluded_derived','blank_template')
       or v_validation not in ('valid','incomplete','invalid','needs_review','duplicate','excluded') then
      raise exception using errcode='22023',message='invalid_production_summary_inbox_classification';
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
      raise exception using errcode='22023',message='invalid_or_oversized_production_summary_inbox_payload';
    end if;
    select i.source_fingerprint_sha256 into v_existing_fingerprint
    from public.tfi_module_import_inbox i
    where i.source_spreadsheet_id=v_batch.spreadsheet_id
      and i.source_sheet='Production Summary' and i.source_row=v_source_row
      and i.source_slot=v_source_slot
    order by i.created_at desc limit 1;
    if v_existing_fingerprint is not null and v_existing_fingerprint<>v_fingerprint then
      raise exception using errcode='23505',message='production_summary_source_row_changed_since_previous_capture';
    end if;
    insert into public.tfi_module_import_inbox(
      module,source_spreadsheet_id,source_sheet,source_row,source_slot,source_key,
      source_fingerprint_sha256,raw_source_cells,formula_provenance,formatted_source_cells,
      normalized_payload,validation_state,issue_codes,issue_details,missing_fields,
      disposition,target_table,target_record_id,target_record_key,batch_id,created_by,updated_by
    ) values (
      v_module,v_batch.spreadsheet_id,v_source_sheet,v_source_row,v_source_slot,v_source_key,
      v_fingerprint,v_raw,v_formula,v_formatted,v_payload,v_validation,v_issues,v_details,v_missing,
      v_disposition,v_target_table,v_target_id,v_target_key,p_batch_id,v_actor,v_actor
    ) on conflict (source_spreadsheet_id,source_sheet,source_row,source_slot,source_fingerprint_sha256) do nothing;
    if found then v_created:=v_created+1; else v_unchanged:=v_unchanged+1; end if;
  end loop;
  update public.tfi_module_import_batches
  set status='partial',
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

create or replace function public.tfi_module_import_batch_finish(p_batch_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $function$
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
$function$;

create or replace function public.tfi_module_import_inbox_edit(
  p_id uuid,p_version integer,p_normalized_payload jsonb,p_missing_fields jsonb,
  p_issue_codes jsonb,p_issue_details jsonb,p_validation_state text
) returns jsonb language plpgsql security definer set search_path=''
as $function$
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
$function$;

create or replace function public.tfi_source42_check_page(p_sheet text,p_rows jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare
  v_actor uuid:=auth.uid(); v_spreadsheet_id text; v_sheet_ref uuid;
  v_item jsonb; v_fields jsonb; v_row integer; v_date date; v_line text;
  v_product text; v_code text; v_result text; v_reason text;
  v_rows jsonb:='[]'::jsonb; v_seen integer[]:='{}'::integer[];
  v_has_input boolean; v_existing boolean;
begin
  if v_actor is null or not private.tfi_has_permission('spreadsheet_import','view')
     or not private.tfi_has_permission('production_entry','import') then
    raise exception using errcode='42501',message='production_summary_preflight_permission_required';
  end if;
  if p_sheet is distinct from 'Production Summary' or p_rows is null
     or jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)<1
     or jsonb_array_length(p_rows)>100 then
    raise exception using errcode='22023',message='invalid_production_summary_preflight_request';
  end if;
  select w.spreadsheet_id into v_spreadsheet_id
  from public.tfi_source_workbooks w where w.is_authoritative
  order by w.verified_at desc limit 1;
  select s.id into v_sheet_ref
  from public.tfi_source_sheets s
  join public.tfi_source_workbooks w on w.id=s.workbook_id
  where w.spreadsheet_id=v_spreadsheet_id and w.is_authoritative
    and s.sheet_title='Production Summary' and s.sheet_id=1846667474
    and s.source_kind='transaction_history' and s.destination_module_key='production_entry';
  if v_spreadsheet_id is null or v_sheet_ref is null then
    raise exception using errcode='42501',message='production_summary_source_registry_mismatch';
  end if;
  for v_item in select value from jsonb_array_elements(p_rows) loop
    v_row:=nullif(v_item->>'source_row','')::integer;
    v_fields:=v_item->'fields';
    v_result:='new_source'; v_reason:='Source row identity is new; it remains in Import Inbox and is not an operational record.';
    if v_row is null or v_row<7 or v_row>13188 or jsonb_typeof(v_fields) is distinct from 'object' then
      v_result:='held_mapping_unverified'; v_reason:='Invalid source row identity or source field shape.';
    elsif v_row=any(v_seen) then
      v_result:='held_business_duplicate'; v_reason:='The same source row was repeated within this preflight page.';
    else
      v_seen:=array_append(v_seen,v_row);
      v_has_input:=false;
      foreach v_code in array array['A','B','C','D','E','F','G','H','J','K','L','M','N','O','P','S','T'] loop
        if nullif(btrim(coalesce(v_fields->>v_code,'')),'') is not null then v_has_input:=true; exit; end if;
      end loop;
      if not v_has_input then
        v_result:='held_placeholder'; v_reason:='No literal Production Summary input values; formula/helper-only row is not a production transaction.';
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
    'source_sheet_ref',v_sheet_ref,'read_only',true,'operational_writes',false);
end;
$function$;

revoke all on function public.tfi_module_import_batch_start(text,text,text,text,text) from public,anon;
revoke all on function public.tfi_module_import_inbox_upsert(uuid,jsonb) from public,anon;
revoke all on function public.tfi_module_import_batch_finish(uuid) from public,anon;
revoke all on function public.tfi_module_import_inbox_edit(uuid,integer,jsonb,jsonb,jsonb,jsonb,text) from public,anon;
revoke all on function public.tfi_source42_check_page(text,jsonb) from public,anon;
grant execute on function public.tfi_module_import_batch_start(text,text,text,text,text) to authenticated;
grant execute on function public.tfi_module_import_inbox_upsert(uuid,jsonb) to authenticated;
grant execute on function public.tfi_module_import_batch_finish(uuid) to authenticated;
grant execute on function public.tfi_module_import_inbox_edit(uuid,integer,jsonb,jsonb,jsonb,jsonb,text) to authenticated;
grant execute on function public.tfi_source42_check_page(text,jsonb) to authenticated;
