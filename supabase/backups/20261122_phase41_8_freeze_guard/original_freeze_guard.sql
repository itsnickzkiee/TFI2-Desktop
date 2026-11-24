-- Pre-repair snapshot of the live TFI2 historical promotion freeze guard.
-- Captured before migration: phase41_8_freeze_guard_requires_promoted_row.
-- Restore only if an explicit rollback is required.
CREATE OR REPLACE FUNCTION private.tfi_guard_historical_promotion_freeze()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
