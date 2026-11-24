-- TFI2 cleanup: retire the OLD TFI Phase 41.6-41.8 historical Production Summary import/promotion subsystem.
-- TFI_NEW uses the separate tfi_import_* workflow. This migration intentionally preserves:
--   tfi_import_destinations, tfi_import_batches, tfi_import_rows, tfi_operational_records,
--   tfi_source_workbooks, tfi_source_sheets, Production Entry tables, shared permission/audit helpers.
-- No CASCADE is used. The migration aborts if any legacy table contains data or if the new import
-- foundation is absent. Applied Phase 41 migration-ledger rows are retained as historical records.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '45s';

DO $preflight$
BEGIN
  IF EXISTS (SELECT 1 FROM public.tfi_module_import_batches)
     OR EXISTS (SELECT 1 FROM public.tfi_module_import_inbox)
     OR EXISTS (SELECT 1 FROM public.tfi_module_import_inbox_revisions)
     OR EXISTS (SELECT 1 FROM public.tfi_module_import_drafts)
     OR EXISTS (SELECT 1 FROM public.tfi_module_import_draft_revisions)
     OR EXISTS (SELECT 1 FROM public.tfi_historical_promotion_groups) THEN
    RAISE EXCEPTION 'legacy_phase41_cleanup_aborted_nonempty_legacy_tables';
  END IF;

  IF to_regclass('public.tfi_import_destinations') IS NULL
     OR to_regclass('public.tfi_import_batches') IS NULL
     OR to_regclass('public.tfi_import_rows') IS NULL
     OR to_regclass('public.tfi_operational_records') IS NULL
     OR to_regprocedure('public.tfi_stage_import_rows(uuid,jsonb)') IS NULL THEN
    RAISE EXCEPTION 'legacy_phase41_cleanup_aborted_new_import_foundation_missing';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tfi_production_entry_records'
      AND column_name LIKE 'source_import_%'
  ) THEN
    RAISE EXCEPTION 'legacy_phase41_cleanup_aborted_production_entry_legacy_provenance_still_present';
  END IF;
END;
$preflight$;

-- Remove legacy freeze triggers before dropping their trigger function.
DROP TRIGGER IF EXISTS tfi_module_import_drafts_historical_promotion_freeze
  ON public.tfi_module_import_drafts;
DROP TRIGGER IF EXISTS tfi_module_import_inbox_historical_promotion_freeze
  ON public.tfi_module_import_inbox;

-- Remove the old public RPC surface, including the Phase 42 preflight RPC that
-- still probes the retired Phase 41 Inbox. The TFI_NEW app does not call these.
DROP FUNCTION IF EXISTS public.tfi_source42_check_page(text,jsonb);
DROP FUNCTION IF EXISTS public.tfi_module_import_batch_finish(uuid);
DROP FUNCTION IF EXISTS public.tfi_module_import_batch_manifest(uuid,jsonb);
DROP FUNCTION IF EXISTS public.tfi_module_import_batch_start(text,text,text,text,text);
DROP FUNCTION IF EXISTS public.tfi_module_import_drafts_approve(uuid[],boolean,text);
DROP FUNCTION IF EXISTS public.tfi_module_import_drafts_create(uuid,integer);
DROP FUNCTION IF EXISTS public.tfi_module_import_drafts_promote(uuid,uuid[],boolean,boolean);
DROP FUNCTION IF EXISTS public.tfi_module_import_drafts_status(uuid,integer,integer,text);
DROP FUNCTION IF EXISTS public.tfi_module_import_inbox_edit(uuid,integer,jsonb,jsonb,jsonb,jsonb,text);
DROP FUNCTION IF EXISTS public.tfi_module_import_inbox_revalidate(uuid,integer);
DROP FUNCTION IF EXISTS public.tfi_module_import_inbox_upsert(uuid,jsonb);

-- Remove the private promotion engine and its trigger guard.
DROP FUNCTION IF EXISTS private.tfi_module_import_drafts_promote(uuid,uuid[],boolean,boolean);
DROP FUNCTION IF EXISTS private.tfi_guard_historical_promotion_freeze();

-- Assert no remaining database routine references the retired table family.
DO $routine_check$
DECLARE
  v_remaining text[];
BEGIN
  SELECT array_agg(format('%I.%I(%s)', n.nspname, p.proname,
                         pg_get_function_identity_arguments(p.oid)))
    INTO v_remaining
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname IN ('public','private')
    AND p.prokind IN ('f','p')
    AND (
      pg_get_functiondef(p.oid) ILIKE '%tfi_module_import_batches%'
      OR pg_get_functiondef(p.oid) ILIKE '%tfi_module_import_inbox%'
      OR pg_get_functiondef(p.oid) ILIKE '%tfi_module_import_drafts%'
      OR pg_get_functiondef(p.oid) ILIKE '%tfi_historical_promotion_groups%'
    );

  IF v_remaining IS NOT NULL THEN
    RAISE EXCEPTION 'legacy_phase41_cleanup_aborted_remaining_routine_refs: %', v_remaining;
  END IF;
END;
$routine_check$;

-- Drop child tables first. RESTRICT is intentional: unexpected dependencies abort the migration.
DROP TABLE IF EXISTS public.tfi_module_import_draft_revisions RESTRICT;
DROP TABLE IF EXISTS public.tfi_module_import_drafts RESTRICT;
DROP TABLE IF EXISTS public.tfi_historical_promotion_groups RESTRICT;
DROP TABLE IF EXISTS public.tfi_module_import_inbox_revisions RESTRICT;
DROP TABLE IF EXISTS public.tfi_module_import_inbox RESTRICT;
DROP TABLE IF EXISTS public.tfi_module_import_batches RESTRICT;

DO $postflight$
BEGIN
  IF to_regclass('public.tfi_module_import_batches') IS NOT NULL
     OR to_regclass('public.tfi_module_import_inbox') IS NOT NULL
     OR to_regclass('public.tfi_module_import_inbox_revisions') IS NOT NULL
     OR to_regclass('public.tfi_module_import_drafts') IS NOT NULL
     OR to_regclass('public.tfi_module_import_draft_revisions') IS NOT NULL
     OR to_regclass('public.tfi_historical_promotion_groups') IS NOT NULL
     OR to_regprocedure('public.tfi_source42_check_page(text,jsonb)') IS NOT NULL
     OR to_regprocedure('public.tfi_module_import_batch_start(text,text,text,text,text)') IS NOT NULL
     OR to_regprocedure('private.tfi_module_import_drafts_promote(uuid,uuid[],boolean,boolean)') IS NOT NULL
     OR to_regprocedure('private.tfi_guard_historical_promotion_freeze()') IS NOT NULL THEN
    RAISE EXCEPTION 'legacy_phase41_cleanup_postflight_failed';
  END IF;

  IF to_regclass('public.tfi_import_destinations') IS NULL
     OR to_regclass('public.tfi_import_batches') IS NULL
     OR to_regclass('public.tfi_import_rows') IS NULL
     OR to_regclass('public.tfi_operational_records') IS NULL
     OR to_regprocedure('public.tfi_stage_import_rows(uuid,jsonb)') IS NULL THEN
    RAISE EXCEPTION 'legacy_phase41_cleanup_new_import_foundation_missing_after_cleanup';
  END IF;
END;
$postflight$;

NOTIFY pgrst, 'reload schema';
COMMIT;
