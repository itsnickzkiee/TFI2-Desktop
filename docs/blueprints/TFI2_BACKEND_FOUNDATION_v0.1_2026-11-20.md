# TFI_NEW — TFI2 Backend Foundation v0.2

**Last updated:** 21 November 2026  
**Target:** Supabase project slfjqrkxnsgdaturaguw (TFI2)  
**Local project:** C:\Users\Rominick\Desktop\TFI_NEW  
**Status:** Initial database foundation applied; localhost Flask host connected to TFI2; first administrator invited, confirmed, activated, and assigned System Administrator; local TFI_NEW sign-in test pending

## 1. Scope and safety boundary

TFI2 is the only database target for TFI_NEW.

The legacy TFI project, its Supabase project, its .env, its operational tables, and its historical records were not modified or used as a database target. The old TFI source code and migration files were inspected only as a reference for the existing Windows/Flask implementation pattern and previously validated business rules.

The new TFI2 project was verified before changes. Its public application schema had no tables or migrations. The first three migrations below were applied additively.

No operational transaction rows, sample users, sample roles, or sample business records were created.

## 2. Technology baseline

- Windows-local application host: Python 3.12 + Flask 3 served through Waitress (Windows-compatible WSGI server).
- Database and authentication: Supabase TFI2.
- Data access: Supabase Auth and PostgREST using the signed-in user's JWT and RLS.
- Client key: Supabase publishable key only.
- Session storage: server-side in-memory session vault; browser receives only an HttpOnly, SameSite=Strict session identifier.
- UI: existing TFI_NEW HTML/CSS/JS previews served from the local Flask host.
- No service-role key, database password, or privileged Supabase secret is stored in the Windows application.

The Flask host binds only to 127.0.0.1 by default. It rejects non-loopback requests and cross-origin writes.

## 3. TFI2 migrations applied

| Migration | Purpose |
|---|---|
| tfi2_identity_access_foundation | Module registry, profile table, role and permission catalogues, user-role assignments, role-permission assignments, audit event store, access helper functions, Auth profile trigger, and RLS policies |
| official_35_tab_source_registry | Authoritative source workbook metadata and all 35 verified worksheet IDs, titles, grid dimensions, header rows, import classifications, and module mappings |
| harden_rls_helper_functions | Moved security-definer access helpers into the non-API private schema, kept a public security-invoker access-context wrapper, and added foreign-key indexes |
| system_administrator_role | Seeded the approved System Administrator role with all 360 catalogued permissions; no user assignment created |
| one_time_first_admin_bootstrap | Added a private, database-owner-only, one-time bootstrap function for the first confirmed Auth user |

All nine public application tables have Row Level Security enabled.

## 4. Initial database state after migration

| Object | Verified count |
|---|---:|
| Registered application modules | 30 |
| Permission catalogue entries | 360 |
| User profiles | 1 |
| Roles | 1 (System Administrator) |
| Role-permission grants | 360 |
| User-role assignments | 1 |
| Audit events | 1 |
| Authoritative source workbooks | 1 |
| Registered source worksheets | 35 |
| Operational transaction rows | 0 |

The 30 modules and 360 permission entries are application configuration catalogues, not mock operational records. The approved System Administrator role is seeded with all 360 permissions. The first administrator account dutsrominick@gmail.com has a linked active TFI profile and one System Administrator assignment. New Supabase Auth users receive a linked TFI profile with account_status = pending and no application access automatically.

## 5. Source workbook registry

The registered source is the verified 35-tab workbook:

- Title: Copy of TFI - Production Monitoring Sheet 1
- Spreadsheet ID: 1rCbQ16wj7MRjQCFF3tA-WEMkudraJK0RkwcqayUlz7k
- Verified worksheet count: 35

The registry preserves exact sheet IDs, worksheet names, index order, grid bounds, header-row information, first-data-row information, source kind, import policy, and intended module destination.

The classification explicitly distinguishes:
- Operational/input sources.
- Saved history sources.
- Reference/master data.
- Formula-derived views.
- Helper/calculation tabs.
- Documentation.
- Archive/Removed Rows.

Derived tabs such as Summary, Yield Log, KPI Calc, Dash Calc, and Hourly Calc are not independent transaction sources. Production Summary is treated as saved Production Entry history to avoid importing the same saved run twice. Removed Rows is archive-only and is not silently restored.

The registry contains metadata only. No workbook rows, formulas, cached values, or historical records were copied into TFI2.

## 6. Security model

- RLS is enabled on all nine public tables.
- No direct INSERT/UPDATE/DELETE privileges are granted to anon or authenticated on the foundation tables.
- Authenticated users can read only the rows permitted by RLS.
- Users can read their own profile even while pending; other profiles require the Users & Access view permission.
- Module metadata is readable only by active application users.
- Role and permission administration is permission-gated.
- Audit events are readable only with the Audit Trail view permission.
- Audit event direct writes are not granted to browser clients.
- Permission evaluation checks active profile, active role, non-expired assignment, and explicit role-permission grant.
- New Auth users default to pending and do not receive an automatic role.
- The public access-context RPC is SECURITY INVOKER. SECURITY DEFINER helpers are kept in the non-API private schema.
- The one-time first-administrator bootstrap function is in the private schema and is not executable by anon, authenticated, or service_role. It can be run by the database owner from the TFI2 SQL Editor after the owner confirms and invites the sole first Auth user.

### Advisor verification

- Latest Supabase security advisor: one warning — leaked-password protection is disabled. Enable Supabase Auth leaked-password protection before production use.
- Performance advisor: only unused-index informational notices remain because the new tables have not yet accumulated application traffic. Foreign-key indexes were added for the initial access-control relationships.

## 7. Local application host

The following files have been created:

- src/tfi_backend/config.py
- src/tfi_backend/supabase_gateway.py
- src/tfi_backend/session_store.py
- src/tfi_backend/app.py
- .env.example
- .gitignore
- requirements.txt
- tests/backend/test_config.py
- tests/backend/test_session_store.py
- tests/backend/test_supabase_gateway.py
- tests/backend/test_app.py

The local .env contains only the TFI2 project URL and publishable key. It is excluded by .gitignore. No service-role or secret key is present.

The app provides:
- TFI2 Auth health check.
- Email/password sign-in endpoint.
- Account/profile/role/permission gate before a local session is created.
- HttpOnly, SameSite=Strict session cookie.
- In-memory access/refresh token vault.
- Token refresh through Supabase Auth.
- Sign-out and local session removal.
- Protected delivery of the module preview pages.
- Localhost-only and same-origin write checks.

The login screen now requests a registered work email and includes a password-recovery link. Recovery requests use an explicit TFI_NEW callback URL, validate the one-time recovery token, keep the token in a short-lived server-side vault, and update the password through Supabase Auth. The TFI2 Auth redirect allowlist still requires the local callback URL before a real reset email is sent. Username login is not enabled in this first backend increment; a secure username-to-email resolver requires a separate server-side design and rate-limit policy.

The configured local idle-timeout value is 0, meaning no app-level idle timeout is enforced yet. This is intentional until the owner approves the Session Management policy. Supabase access-token expiry and refresh remain active.

## 8. Verification completed

- Python 3.12 virtual environment created under TFI_NEW/.venv.
- Dependencies installed from requirements.txt.
- Backend tests: **41 passed**.
- Browser login integration test: **passed**.
- Password recovery browser integration test: **passed** using mocked Auth responses; no real email or password was changed.
- Python compile check and login/password-recovery JavaScript syntax checks: **passed**.
- TFI2 Auth health endpoint: HTTP 200.
- Local /api/health: status=ok, connected=true, database_project=TFI2.
- Login page served by the Flask host: HTTP 200.
- Direct dashboard access without a session is redirected to the login page.
- Latest Supabase security advisor: one warning — leaked-password protection is disabled.
- One Auth user exists for dutsrominick@gmail.com; the invitation was accepted and email confirmation is complete.
- TFI profile status: active.
- System Administrator role assignment: 1.
- Effective role permission grants: 360/360.
- One-time first-admin bootstrap function executed successfully and is inaccessible to authenticated and service-role clients.
- One administrator bootstrap audit event recorded.

## 9. Not yet implemented

- Add http://127.0.0.1:5100/auth/recovery to the TFI2 Auth redirect allowlist and set the local Site URL as documented in TFI2_PASSWORD_RECOVERY_v0.1_2026-11-21.md; then request a real reset email and verify the flow.
- Local TFI_NEW sign-in and server-side session acceptance test using the administrator's own password (never share the password with support or in chat).
- Admin-only RPCs for subsequent user creation/invitation, profile activation, role assignment, and role-permission management.
- Username login.
- Production session idle timeout and concurrent-session policy.
- Audit triggers for account, role, permission, and operational changes.
- Operational module tables and module-specific CRUD/workflow RPCs.
- Controlled import batches, source-row ledger, duplicate review, and draft promotion.
- Formula parity and dashboard/report calculation services.

These remain separate implementation gates. The source workbook is not the live operational database.

## 10. Current administrator and next gate

The project owner confirmed dutsrominick@gmail.com as the first administrator. The Auth invitation was accepted, email confirmation completed, the TFI profile activated, the System Administrator role assigned, all 360 permissions verified, and the bootstrap audit event recorded. Supabase Auth confirms an email identity and password credential are present. The next gate is to sign in through http://127.0.0.1:5100/ and verify the local application session. Never request or store the administrator password in chat or project documentation.
