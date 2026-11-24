# TFI Users & Access — UI Acceptance Record v0.1

**Date:** 20 November 2026  
**Project:** TFI_NEW  
**Screen:** Users & Access  
**Status:** UI acceptance passed; backend/authentication not connected.

## 1. Scope tested

The current local preview was tested through the shared dashboard router. No live identity provider, authentication service, database, or user directory was connected.

## 2. Empty-state verification

- User directory and role-template list start empty.
- All four account metrics display neutral values until preview accounts are created.
- CSV export is disabled with no accounts.
- The draft permission matrix save action is disabled until a draft role exists.
- No static page-one pagination control is displayed.
- The screen clearly states that preview entries do not create accounts, invitations, or live access.
- Local storage contains only the shared sidebar preference; user and role entries are held in page memory only.

## 3. User account interactions

Passed:
- Required name and valid email form checks.
- Add a local preview account and update the four metrics.
- Reject a duplicate work email without closing the form; comparison is case-insensitive.
- Edit a preview account.
- Toggle Active to Disabled and Disabled back to Active.
- Status filters for All, Active, Pending, and Disabled.
- Combined search terms across local and global search inputs.
- CSV output reflects the active search and filter criteria.
- Last sign-in remains Not recorded when no authentication event exists.

## 4. Roles and permissions interactions

Passed:
- Switch between User Accounts and Roles & Permissions using mouse and keyboard arrow navigation.
- Create a draft role and mark it Pending approval.
- Reject a duplicate role name case-insensitively.
- Build the draft permission matrix with 15 module/area rows and seven action columns: View, Create, Edit, Review, Approve, Export, and Manage access.
- Change a permission checkbox and save a preview-session snapshot.
- Keep Save draft matrix disabled when no role is selected.
- Show the selected draft role as pending approval; the preview does not grant actual access.
- Assign a draft role label to a local preview account and filter the directory by that role.

## 5. Responsive and navigation checks

- At a 390px outer viewport, the embedded page has no page-level horizontal overflow.
- Wide user and permission tables scroll inside their own containers.
- Role layout collapses to a single column on mobile.
- Users & Access → Audit Trail → Users & Access returns to the correct module through the persistent shared shell.

## 6. Browser test result

**PASS**

- No page errors.
- No console errors.
- No failed local asset requests.
- Test-only accounts and roles were created in browser memory during the test and discarded when the test browser closed. They were not written to the preview HTML, a persistent file, or a database.

Test scripts:
- design/test-users-access-acceptance.js
- design/capture-users-access-clean.js

Clean-state screenshots:
- design/users-access-verified-empty-desktop.png
- design/users-access-roles-empty-desktop.png
- design/users-access-verified-empty-mobile.png

Rollback copy:
- design/users-access-preview.html.pre-users-access-acceptance-20261120.bak

## 7. Production implementation boundary

This pass verifies only the front-end preview. Production still requires client approval of final role names, role purposes, user assignment rules, module-level permission boundaries, review/approval separation, export rights, and administrator responsibilities.

Authentication, invitation delivery, server-side authorization, permission enforcement, session revocation, and immutable audit-event generation must be implemented and tested on trusted backend services. Hiding controls or disabling buttons in the browser is not sufficient security. No live account, permission, or database record was created or changed during this UI acceptance pass.
