# TFI_NEW — Priority 1 Mock Data Cleanup v0.1

**Date:** 20 November 2026  
**Status:** Complete  
**Scope:** Remove seeded/sample transaction, batch, event, account and KPI data from the six preview screens identified in the TFI UI/source audit.

## 1. Files cleaned

| Preview page | Cleanup |
|---|---|
| dashboard-preview.html | Removed illustrative KPI values, trend percentages, chart plots, production-mix distribution and sample module activity. Replaced with neutral em-dash values and empty states. Import card no longer shows a fabricated imported-record count. |
| central-import-inbox-preview.html | Removed all eight illustrative scan records, sample batch reference, workbook name, scan date, fingerprints and fabricated classification counts. Inbox now shows a no-scan empty state; select-all and import actions remain disabled until real scan records exist. |
| import-confirmation-results-preview.html | Removed the three hardcoded selected records and automatic ID fallback. Confirmation and acknowledgement remain disabled without a real selection and connected import service. Results view now shows an unavailable/empty state instead of simulated success. |
| import-history-preview.html | Removed all six fabricated import batches, sample totals, fake actors, workbook filenames, dates and outcomes. History table now shows a neutral empty state; period filtering uses a dynamic date window for future real records. |
| audit-trail-preview.html | Removed all ten illustrative audit events, fictitious actors, record references, change values and sample counts. Audit metrics show neutral placeholders; CSV export is disabled while no verified events are available. |
| users-access-preview.html | Removed all nine fictitious user accounts and the two seeded draft-role placeholders. User directory and role matrix now start empty. Identity provider status is shown as not connected. User/role entries created manually in this preview remain local to the page and do not create real accounts or permissions. |

## 2. Empty-state and interaction safeguards

- Dashboard charts, KPI cards and module activity no longer display fabricated operational values.
- Import Inbox cannot select or confirm any records until a real scan result is supplied.
- Import Confirmation does not default to sample IDs and cannot simulate a successful import.
- Import History and Audit Trail display no fabricated history.
- Audit CSV export remains disabled while no verified events are loaded.
- Users & Access starts with no seeded accounts or role templates. Preview-only user and draft-role controls are explicitly identified as local-only and do not grant access.
- Existing layouts, colors, navigation, page structure and source-derived reference options were preserved.

## 3. Validation performed

All six pages were opened in a headless Chromium browser using Puppeteer.

| Check | Result |
|---|---|
| Dashboard KPI/chart/mix/module empty states | Pass |
| Import Inbox empty state and disabled selection | Pass |
| Import Confirmation empty state and disabled confirmation | Pass |
| Import History empty state and neutral metrics | Pass |
| Audit Trail empty state and disabled export | Pass |
| Users & Access empty directory and empty role state | Pass |
| Users & Access Add User modal opens | Pass |
| Users & Access Roles tab opens | Pass |
| Inline JavaScript syntax | 6/6 pass |
| Browser page errors / console errors | 0 |
| Missing DOM IDs referenced by page scripts | 0 |
| Duplicate element IDs | 0 |
| Targeted mock-data marker scan | 0 remaining |

## 4. Backups

Before editing, an original backup was created for each of the six HTML files using the suffix:

.pre-mock-cleanup-20261120.bak

The backups remain in the design folder for rollback.

## 5. Change boundaries

- No source Google Spreadsheet cells or worksheet protections were modified.
- No historical production data was imported, deleted, or overwritten.
- No Supabase schema, table, row, or permission was modified.
- No live authentication account, invitation, or user permission was created.
- This cleanup only changed the six local UI preview HTML files and added their rollback backups.

**Result:** Priority 1 Mock Data Cleanup is complete for the six screens in scope. The pages now present neutral empty states instead of fabricated records. They are still UI previews; real values will appear only after the approved scan, database, identity and audit connections are implemented.
