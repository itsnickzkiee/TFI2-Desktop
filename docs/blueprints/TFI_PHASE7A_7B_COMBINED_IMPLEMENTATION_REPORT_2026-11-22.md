# TFI — Phase 7A + 7B Combined Workstream Report

**Date:** 22 November 2026  
**Project:** TFI_NEW / TFI2  
**Workstream:** 7A System Integration Audit + 7B Dashboard Integration  
**Status:** First implementation pass complete; authenticated live-session acceptance remains pending after local app restart.

## Roadmap checkpoint

- Phase 5 — Operational Modules Backend: owner-confirmed complete; not reopened.
- Phase 6 — Google Sheets Import Center: owner-confirmed complete; not reopened.
- Phase 7A and 7B are being executed as one combined workstream.
- The official seven-phase roadmap remains unchanged.

## 7A — System integration audit

### TFI2 project and access

- TFI2 project is active and healthy.
- The database contains the TFI module registry and module-specific permission catalogue.
- The active System Administrator account has `dashboard.view` and the operational module view permissions.
- The dashboard endpoint requires `dashboard.view`; it does not bypass module permissions.
- The data-count queries use the signed-in user's JWT and PostgREST RLS policies.
- CO QA read access is gated by both `co_qa.view` and `product_entry.view`, matching its database SELECT policy.
- Audit event counts are requested only when `audit_trail.view` is present.
- Import counts are requested only when `spreadsheet_import.view` is present and remain subject to module import permissions.

### Operational record availability observed during audit

| Source table / module | Current rows |
|---|---:|
| Product Entry | 0 |
| Production Entry | 0 |
| Production Schedule | 0 |
| DMP Production | 0 |
| DMR Production | 0 |
| DMR Coding | 0 |
| Hourly Production (Agri / Coding / Meat) | 0 |
| OEE | 0 |
| Productivity | 0 |
| Coding DPR | 0 |
| PR Monitoring | 0 |
| CO QA Cost Records | 0 |
| NON-PROD | 0 |
| Import batches | 0 |
| Import rows | 0 |
| Audit events | 1 |

The live database therefore has no operational records from which the KPI dashboard can calculate production values yet. The single audit event is not treated as production data.

### Calculation boundary

The existing KPI Dashboard UI specification explicitly prohibits cached spreadsheet values, fabricated values, sample chart series, and silent Google Sheets fallbacks. The database currently has production-entry and production-schedule summary functions, but no consolidated dashboard KPI calculation contract. Therefore KPI formulas, charts, comparisons, and filters remain blank until Phase 7C validates their source fields and calculations.

## 7B — Dashboard integration implemented

### Backend

- Added `GET /api/dashboard/coverage`.
- Added a dashboard permission guard that validates the active session and `dashboard.view`.
- Added exact PostgREST row counts using `Prefer: count=exact` and `Range: 0-0`.
- Each query selects only the relevant primary-key column.
- Queries are limited to modules the current user is permitted to view; database RLS remains active.
- Hourly counts are separated by `module_key`.
- CO QA uses its actual primary key, `product_entry_record_id`.

### Dashboard UI

- Reused the existing KPI Dashboard shell and responsive layout.
- Added live TFI2 connection status.
- Added coverage figures for saved operational records, modules with records, import batches in review, and audit events.
- Added a module coverage list when active records exist.
- Preserved all 39 KPI display slots and 12 hourly metric slots as em dashes.
- Kept dashboard filters disabled until verified calculation data is available.
- No sample KPI figures, cached spreadsheet values, or fabricated chart data were added.

## Verification

- Backend test suite: **335 passed**.
- Dashboard browser acceptance test: **passed**.
- Desktop layout: passed.
- Mobile layout at 390 × 844 and 320 × 844: no horizontal overflow.
- Browser console/page errors: none.
- Failed local asset requests: none.
- Duplicate HTML IDs: none.
- Existing dashboard tabs, keyboard navigation, module search, notification empty state, and Import Center navigation: passed.

## Backup

Pre-change copies of the edited application, gateway, dashboard, and test files are stored in:

`docs/backups/phase7a7b_20261122/`

## Runtime deployment check

- The local app was restarted successfully using the project virtual environment.
- `GET /api/health` returns `status=ok`, `connected=true`, and `database_project=TFI2`.
- An unauthenticated request to `GET /api/dashboard/coverage` returns HTTP 401, confirming the new route is loaded and session-protected.
- Restarting the local server cleared its in-memory sessions. Sign in again to complete the authenticated live-count check.
- No database rows or schemas were changed by this workstream.

## Next

1. Sign in again and verify the authenticated `/api/dashboard/coverage` response against TFI2.
2. Complete the 7B dashboard live-session acceptance.
3. Proceed to Phase 7C — KPI and computation verification, using approved source-field and formula definitions.
