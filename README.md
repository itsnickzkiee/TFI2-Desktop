# TFI_NEW — TFI2 Backend

TFI_NEW is a local Flask application served by Waitress and connected only to the Supabase project named TFI2.

## Start the local application

1. Double-click RUN_TFI_NEW.bat.
2. The local backend starts on http://127.0.0.1:5100.
3. The browser opens the administrator sign-in screen.
4. Close the separate minimized TFI_NEW Backend console window to stop the local server.

## Run backend tests

Open PowerShell in this folder and run:

    $env:PYTHONPATH = "$PWD\src"
    .\.venv\Scripts\python.exe -m pytest tests\backend -q

The browser-based password recovery test can be run with:

    node tests\backend\test-password-recovery-browser.cjs

Latest validation: Python compile check passed, 97 automated backend tests passed, all six live import JavaScript files passed Node syntax checks, and the DMP Production UI JavaScript/HTML ID checks passed.

## Environment and security

- Local connection settings are in .env.
- .env is excluded by .gitignore; .env.example contains placeholders only.
- The Windows app uses the TFI2 Supabase publishable key only.
- Never add a service-role key, database password, or secret key to this project.
- The Flask host binds to localhost only and rejects cross-origin writes.
- Supabase Auth tokens are held in the server-side in-memory session vault; they are not written to browser localStorage, SQLite, or log files.
- Supabase Security Advisor currently reports leaked-password protection disabled. Enable it in Supabase Auth before production use.

## Authentication

The first administrator account dutsrominick@gmail.com has an active TFI profile, the System Administrator role, and all 360 catalogued permissions. New Auth users receive a pending profile and no application role automatically.

Sign-in uses the registered work email. Username login is not enabled. Never share the administrator password in chat or project documentation.

Before sending a real password-recovery email, confirm that http://127.0.0.1:5100/auth/recovery is in the TFI2 Auth redirect allowlist.

## Database

TFI2 is the only database target. The legacy TFI Supabase project and its operational records are not used by this application.

The live TFI2 project contains the identity/access foundation, 35-tab source registry, System Administrator role, Master Data backend, selective import tables/functions, and the first Phase 5 operational table for DMP Production. The 35-tab workbook registry is metadata only; it does not copy the original workbook into the database.

Current live import data counts are zero batches, zero staged rows, and zero generic imported operational records. The new DMP Production module table is also empty. Existing operational records have no update, merge, replace, or overwrite path in the import workflow.

## Selective import status

The earlier import implementation (previously tracked as Phase 5A/5B) is retained as a partial Phase 6 component under the current roadmap. It connects the Spreadsheet Import Center, Scan Progress, Central Import Inbox, Duplicate Review, Final Import Approval, and Import History to the local Flask API and TFI2 RPC functions.

The current ingestion method is Excel .xlsx upload only. Direct Google Sheets OAuth and URL-based live reading are not connected. Only the worksheet registered for the selected module is scanned; one module is processed per batch. Reports & Reconciliation and Master Data are excluded from operational import. CO QA remains blocked pending its business rule.

Fourteen destinations are raw_capture_only and have no required-column contracts yet. The workflow captures source values and formulas but does not claim complete business validation or formula parity.

See docs/blueprints/TFI_SELECTIVE_IMPORT_EXECUTION_v0.4_2026-11-21.md for the current import implementation, safeguards, verification, and next acceptance gate.

## Phase 5 — Operational Modules Backend

Phase 5 is in progress. DMP Production is the first operational module implemented because it supplies manpower-hour inputs used by Productivity.

- DMP Production table and append-only revision table are live in TFI2.
- Create, read, update, options, and revision-history APIs are wired in the Flask backend.
- DMP LEGEND worker/process options are loaded from TFI2 Master Data; Position is derived server-side.
- Incomplete entries are accepted and marked unassessed; exact duplicate entries are blocked.
- Direct table writes and hard deletes are not exposed.
- DMP Production UI now has live entry, saved-record listing, date filters, edit, and history controls.
- No DMP Production records have been saved; no historical workbook rows were imported.

See docs/blueprints/TFI2_PHASE5_OPERATIONAL_MODULES_ROADMAP_v0.1_2026-11-21.md for the approved module sequence and docs/blueprints/TFI2_DMP_PRODUCTION_BACKEND_BLUEPRINT_v0.1_2026-11-21.md for the first module contract.

## Migration tracking

Ten migration versions are currently recorded in the live TFI2 history. The Phase 5 DMP Production migrations are 20261121043254 (backend) and 20261121043319 (foreign-key index).

The local file supabase/migrations/20261121022314_tfi2_operational_import_foundation.sql exists and its database objects are present in TFI2, but version 20261121022314 is not listed in the live migration history. Do not run a blanket migration push or reapply that non-idempotent file until the migration history is reconciled.

## Next gate

Sign in at http://127.0.0.1:5100/, open DMP Production, verify the live DMP LEGEND dropdowns and saved-record list, then perform one owner-approved controlled test entry and edit. Inspect its revision history. Do not import historical workbook rows or finalize an Import Center batch during this Phase 5 acceptance test.

After DMP Production acceptance, proceed to the Product Entry field contract. The separate Phase 6 import acceptance test remains pending.

## Official seven-phase implementation sequence

The original TFI2 phase order is maintained. See docs/blueprints/TFI2_PHASE_ALIGNMENT_TRACKER_v1.0_2026-11-21.md for the authoritative status and completion boundaries.

| Phase | Scope | Status |
|---|---|---|
| 1 | System Foundation | Completed |
| 2 | Authentication & Authorization | Core implemented |
| 3 | Audit Trail & Security | Foundation implemented; live monitoring partial |
| 4 | Master Data Backend | Implemented |
| 5 | Operational Modules Backend | In progress — DMP Production first |
| 6 | Import Center | Partially implemented early; final module integration pending |
| 7 | Dashboard, Reports & Final System-wide Testing | Pending |

The Import Center work was started early, but its official place remains Phase 6. It does not change the sequence. Phase 5 operational module backends must be completed before Phase 6 destination integration is finalized.

**Final testing policy:** Focused developer checks may be performed during implementation. Comprehensive end-to-end testing, final acceptance, security/recovery/performance verification, and release readiness are reserved for Phase 7.
