-- Add covering indexes for Phase 41 import/promotion and operational audit foreign keys.
CREATE INDEX IF NOT EXISTS tfi_module_import_batches_imported_by_idx ON public.tfi_module_import_batches (imported_by);
CREATE INDEX IF NOT EXISTS tfi_module_import_draft_revisions_actor_idx ON public.tfi_module_import_draft_revisions (actor);
CREATE INDEX IF NOT EXISTS tfi_module_import_drafts_approved_by_idx ON public.tfi_module_import_drafts (approved_by);
CREATE INDEX IF NOT EXISTS tfi_module_import_drafts_created_by_idx ON public.tfi_module_import_drafts (created_by);
CREATE INDEX IF NOT EXISTS tfi_module_import_drafts_updated_by_idx ON public.tfi_module_import_drafts (updated_by);
CREATE INDEX IF NOT EXISTS tfi_module_import_inbox_created_by_idx ON public.tfi_module_import_inbox (created_by);
CREATE INDEX IF NOT EXISTS tfi_module_import_inbox_updated_by_idx ON public.tfi_module_import_inbox (updated_by);
CREATE INDEX IF NOT EXISTS tfi_module_import_inbox_revisions_actor_idx ON public.tfi_module_import_inbox_revisions (actor);
CREATE INDEX IF NOT EXISTS tfi_production_entry_records_archived_by_idx ON public.tfi_production_entry_records (archived_by);
CREATE INDEX IF NOT EXISTS tfi_production_entry_records_updated_by_idx ON public.tfi_production_entry_records (updated_by);
CREATE INDEX IF NOT EXISTS tfi_production_schedule_forms_created_by_idx ON public.tfi_production_schedule_forms (created_by);
CREATE INDEX IF NOT EXISTS tfi_production_schedule_forms_updated_by_idx ON public.tfi_production_schedule_forms (updated_by);
CREATE INDEX IF NOT EXISTS tfi_production_schedule_revisions_changed_by_idx ON public.tfi_production_schedule_revisions (changed_by);
