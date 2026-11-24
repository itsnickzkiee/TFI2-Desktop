-- Phase 41.8 repair: freeze a historical date/line group only after
-- at least one draft in that group has actually been promoted.
-- This keeps an empty/orphan promotion-group row from locking drafts
-- after a promotion attempt is held or blocked.
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
$function$;
