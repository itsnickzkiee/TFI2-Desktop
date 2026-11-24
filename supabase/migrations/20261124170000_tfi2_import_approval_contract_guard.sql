-- Phase 5 import approval hardening.
-- Every import-origin write must target an active destination with an approved contract.
-- Manual operational inserts without import provenance remain unaffected.

begin;

create or replace function private.tfi_guard_approved_import_destination()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_module_key text;
  v_provenance_column text := TG_ARGV[1];
  v_contract_status text;
begin
  if TG_ARGV[0] = 'module_key' then
    v_module_key := nullif(to_jsonb(NEW)->>'module_key', '');
  else
    v_module_key := nullif(TG_ARGV[0], '');
  end if;

  if v_provenance_column is not null and v_provenance_column <> '' then
    if nullif(to_jsonb(NEW)->>v_provenance_column, '') is null then
      return NEW;
    end if;
  end if;

  if v_module_key is null then
    raise exception using errcode='23514', message='import_destination_module_key_missing';
  end if;

  select d.contract_status
    into v_contract_status
  from public.tfi_import_destinations d
  where d.module_key = v_module_key
    and d.is_active
  for share;

  if not found or v_contract_status is distinct from 'approved' then
    raise exception using errcode='42501', message='import_destination_not_approved';
  end if;

  return NEW;
end;
$function$;

revoke all on function private.tfi_guard_approved_import_destination() from public, anon, authenticated;

drop trigger if exists tfi_guard_approved_import_destination on public.tfi_operational_records;
create trigger tfi_guard_approved_import_destination
before insert on public.tfi_operational_records
for each row execute function private.tfi_guard_approved_import_destination('module_key', '');

drop trigger if exists tfi_guard_approved_import_destination on public.tfi_dmp_production_records;
create trigger tfi_guard_approved_import_destination
before insert on public.tfi_dmp_production_records
for each row execute function private.tfi_guard_approved_import_destination('dmp_production', 'source_import_row_id');

drop trigger if exists tfi_guard_approved_import_destination on public.tfi_dmr_production_records;
create trigger tfi_guard_approved_import_destination
before insert on public.tfi_dmr_production_records
for each row execute function private.tfi_guard_approved_import_destination('dmr_production', 'source_import_row_id');

drop trigger if exists tfi_guard_approved_import_destination on public.tfi_dmr_coding_records;
create trigger tfi_guard_approved_import_destination
before insert on public.tfi_dmr_coding_records
for each row execute function private.tfi_guard_approved_import_destination('dmr_coding', 'source_import_row_id');

drop trigger if exists tfi_guard_approved_import_destination on public.tfi_coding_dpr_entries;
create trigger tfi_guard_approved_import_destination
before insert on public.tfi_coding_dpr_entries
for each row execute function private.tfi_guard_approved_import_destination('coding_dpr', 'source_import_row_id');

drop trigger if exists tfi_guard_approved_import_destination on public.tfi_hourly_production_records;
create trigger tfi_guard_approved_import_destination
before insert on public.tfi_hourly_production_records
for each row execute function private.tfi_guard_approved_import_destination('module_key', 'source_import_row_id');

drop trigger if exists tfi_guard_approved_import_destination on public.tfi_oee_records;
create trigger tfi_guard_approved_import_destination
before insert on public.tfi_oee_records
for each row execute function private.tfi_guard_approved_import_destination('oee', 'source_import_row_id');

drop trigger if exists tfi_guard_approved_import_destination on public.tfi_production_schedule_forms;
create trigger tfi_guard_approved_import_destination
before insert on public.tfi_production_schedule_forms
for each row execute function private.tfi_guard_approved_import_destination('production_schedule', 'source_import_batch_id');

drop trigger if exists tfi_guard_approved_import_destination on public.tfi_pr_monitoring_records;
create trigger tfi_guard_approved_import_destination
before insert on public.tfi_pr_monitoring_records
for each row execute function private.tfi_guard_approved_import_destination('pr_monitoring', 'source_import_row_id');

drop trigger if exists tfi_guard_approved_import_destination on public.tfi_productivity_records;
create trigger tfi_guard_approved_import_destination
before insert on public.tfi_productivity_records
for each row execute function private.tfi_guard_approved_import_destination('productivity', 'source_import_row_id');

commit;
