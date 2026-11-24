# TFI Users & Access — UI Specification v0.1

**Date:** 18 November 2026  
**Project:** TFI_NEW  
**Screen:** Users & Access  
**Status:** UI acceptance refinements applied; identity provider and backend authorization remain unconnected.

## 1. Purpose

Users & Access is the Administration workspace for maintaining user account records and preparing role-based access controls for the TFI production system.

The initial Admin development stage remains the priority. The screen is being prepared now, but final user roles, permission scope, and approval rules are still subject to separate review and approval.

## 2. Screen structure

- TFI-branded sidebar with Users & Access selected under Administration.
- Breadcrumb: TFI / Administration / Users & Access.
- Account summary cards: total accounts, active accounts, pending invitations, and disabled accounts.
- User Accounts view.
- Roles & Permissions view.
- Add User form.
- Edit User form.
- Add Draft Role form.
- Draft module-permission matrix.
- CSV export of the currently filtered user directory.

## 3. User Accounts view

The directory displays:
- User ID.
- Full name and initials/avatar.
- Work email.
- Assigned role.
- Department or operating area.
- Account status.
- Last sign-in.
- Account actions.

Filters:
- All users.
- Active.
- Pending.
- Disabled.
- Search by name, email, username, or user ID.
- Filter by assigned role.
- Filter by department / area.

Account actions in this preview:
- Add a user record.
- Edit a user record.
- Toggle Active / Disabled status.
- Export the filtered directory to CSV.

A pending invitation is a preview state only. The prototype does not send an email or create an authentication identity.

## 4. Roles & Permissions view

The page includes:
- No role templates or approved production roles are preloaded in the current preview.
- Draft roles may be added for planning and are marked Pending approval.
- The permission matrix remains disabled until a draft role is created.
- Ability to add additional draft role labels.
- Module/area permission matrix.
- Permission action types: View, Create, Edit, Review, Approve, Export, and Manage Access.

The matrix is a planning aid. Permission selections are local preview state only and do not grant access.

The following must be confirmed before production implementation:
- Final role names and role purposes.
- Which users may be assigned to each role.
- Module-level permission boundaries.
- Whether Review and Approve are separate permissions in each workflow.
- Whether export is allowed per module.
- Who may manage accounts and role definitions.
- Whether multiple administrators are required.

## 5. Account statuses

**Active** — account is enabled in the application.

**Pending** — account invitation or activation has not yet been completed.

**Disabled** — account access is disabled.

The live system must distinguish account status from business-record approval status. Disabling an account must not delete its historical activity or records.

## 6. Security and authorization requirements

- Authentication and authorization must be enforced by trusted server-side services and database policies.
- Hiding a menu item or disabling a browser button is not sufficient authorization.
- Users must only be able to access modules and actions permitted by their approved role and explicit permissions.
- Role changes, account creation, account disabling, invitation, and permission changes must generate Audit Trail events.
- Passwords, access tokens, session secrets, and authentication credentials must never be displayed or written to the audit log.
- Account deactivation must revoke or invalidate active sessions according to the approved security policy.
- Role assignment and permission changes must be validated server-side.
- Do not grant elevated access by default when a user has no assigned role.
- Preserve historical actor identity and role snapshots in audit events when a user's role later changes.

## 7. Prototype boundary

- users-access-preview.html is a local visual and interaction prototype.
- No user records or role templates are preloaded; the directory and role list start empty.
- User accounts and draft role definitions created during testing remain in page memory only and disappear when the page is reloaded.
- No identity provider, authentication account, invitation, or live permission is created.
- Add, edit, disable/activate, role selection, permission toggles, and CSV export work only in the local browser preview.
- The prototype does not create real user accounts, authenticate users, send invitations, or update live permissions.
- No live database reads or writes occur.

## 8. Related UI pages

- Admin Dashboard
- Users & Access
- Audit Trail
- Master Data
- Spreadsheet Import Center
- Import History

Users & Access navigation is connected from the existing Admin preview pages where the sidebar contains the Users & Access item.

## 9. Approval gate

Before production implementation, the client must approve the final role catalogue, permission matrix, account lifecycle, invitation method, and administrator responsibilities. The current Admin-only development workflow must remain intact until those decisions are confirmed.

## 10. UI acceptance refinements — 20 November 2026

- The Users & Access directory now starts with a verified empty state; no sample accounts or role templates are preloaded.
- User and role summary metrics remain neutral until local preview entries are created.
- User search and CSV export now apply independent search terms consistently across the local and global search fields.
- Duplicate work emails are rejected case-insensitively; the form remains open so the entry can be corrected.
- The Last sign-in preview label is set to Not recorded when an account is changed from Pending to Active/Disabled without an actual authentication event.
- Removed the static page-one pagination control because paging is not implemented in the preview.
- Added accessible tab roles, selected states, keyboard navigation, status-filter pressed states, and live-region feedback.
- Draft permission save is disabled until a draft role is selected; saving records a preview-session snapshot only and does not grant access.
- The role matrix currently contains 15 module/area rows and seven permission action columns (105 draft controls per selected role).
- Browser tests cover add/edit/disable/activate, duplicate account and role validation, filtering, multi-term search, CSV output, draft role creation, permission selection, mobile layout, and shared-shell navigation.
- All acceptance tests passed with no browser page errors, console errors, or failed local asset requests. Test-only users and roles existed only in the temporary browser session and were not written to files or a database.
- Verified clean-state screenshots: design/users-access-verified-empty-desktop.png, design/users-access-roles-empty-desktop.png, and design/users-access-verified-empty-mobile.png.
- Rollback copy: design/users-access-preview.html.pre-users-access-acceptance-20261120.bak.

**Boundary remains unchanged:** live account provisioning, invitation delivery, authentication, server-side authorization, session revocation, and audit-event generation require approved backend/security implementation. Final role names and permission boundaries remain subject to client approval.
