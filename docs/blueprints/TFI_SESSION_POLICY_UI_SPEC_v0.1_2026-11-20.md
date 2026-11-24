# TFI_NEW — Session Policy Settings UI Specification v0.1

**Date:** 20 November 2026  
**Project:** TFI_NEW  
**Location:** Administration → Settings → Security & Access → Session Policy  
**Status:** UI preview implemented and interaction-tested; policy approval and authentication enforcement are not connected

## 1. Purpose

Provide a dedicated administrator interface for reviewing and drafting session-duration, warning, expiry, and concurrent-session rules before the live authentication system is implemented.

## 2. Navigation and integration

- Added **Session Policy** as a seventh configuration area inside System Settings.
- Added a **Manage policy** entry point from Security & Access.
- Added a **Back to Security & Access** control from Session Policy.
- Added direct section navigation support using the query parameter section=session.
- The page retains the shared TFI sidebar, topbar, Administrator profile menu, and responsive shell.
- The section also works inside the dashboard's embedded module workspace.

## 3. Draft policy controls

The following values are illustrative starting points only and must be approved by the client before implementation.

| Control | Initial draft value | Available choices |
|---|---|---|
| Inactivity timeout | 30 minutes | 15, 30, 45, 60 minutes |
| Warning before expiry | 2 minutes | 1, 2, 3, 5 minutes |
| Maximum session lifetime | 8 hours | 4, 8, 12 hours; no fixed maximum (review required) |
| Concurrent sessions per account | 1 active session | 1, 2, 3 sessions |
| One-time extension from warning | Enabled | On / Off |
| Require sign-in after browser restart | Enabled | On / Off |
| Revoke other sessions after password change | Enabled | On / Off |
| Record session events in Audit Trail | Enabled | On / Off |

The preview includes a live policy snapshot that updates when a control changes. Saving and resetting only affect the current browser preview session; no live policy or authentication state is changed.

## 4. Session lifecycle reference

1. Administrator signs in.
2. The trusted backend monitors inactivity and absolute session age.
3. The application presents the warning and countdown.
4. An approved extension is validated, or the session is revoked and the user is returned to sign in.
5. Session events are recorded in the Audit Trail without storing passwords or access tokens.

## 5. Preview links

- **Preview timeout warning** opens session-timeout-preview.html.
- **Preview expired screen** opens session-expired-preview.html.
- The existing sign-out UI remains accessible from the Administrator profile menu in the portal shell.

## 6. Security boundaries

- All values are unapproved draft proposals, not configured security controls.
- No API, database, or authentication provider is contacted.
- The preview does not monitor, extend, expire, or revoke a real session.
- Final inactivity and maximum-lifetime enforcement must be performed by the trusted backend.
- The approved authentication design must handle secure session storage, expiry validation, revocation, browser restart behavior, and audit events.
- A browser countdown alone must never be treated as the security boundary.

## 7. Responsive and accessibility behavior

- The Session Policy section is available through the System Settings category navigation.
- Desktop and mobile layouts use responsive form and summary columns.
- The live summary exposes the selected values in readable text.
- Native selects and checkboxes retain keyboard operation and accessible labels.
- The design preserves the shared TFI shell and existing profile controls.

## 8. Acceptance results — 20 November 2026

- Session Policy appears as the seventh settings group.
- Session Policy opens from the category navigation.
- Session Policy opens from the Security & Access Manage policy action.
- Back to Security & Access returns to the parent settings section.
- Draft controls update the live policy snapshot.
- Save policy draft updates the preview status.
- Reset draft restores the last saved preview values.
- Timeout warning preview opens the existing Session Timeout Warning page.
- Expired screen preview opens the existing Session Expired page.
- Embedded System Settings preview supports Session Policy navigation.
- Mobile viewport 390 × 844: no horizontal overflow.
- Narrow viewport 320 × 844: no horizontal overflow.
- Browser page errors: 0.
- Browser console errors: 0.
- Failed asset requests: 0.
- All loaded resources in the test were local file assets.

**Test result:** Session Policy UI flow passed.

## 9. Implementation files

- design/system-settings-preview.html — section, controls, navigation, and preview behavior
- design/session-policy.css — Session Policy styling
- design/test-session-policy-ui.js — browser interaction and responsive tests
- design/session-policy-desktop.png — desktop screenshot
- design/session-policy-mobile.png — mobile screenshot
- design/session-policy-after-save-desktop.png — saved draft screenshot

## 10. Completion boundary

The Session Policy Settings UI is complete as a design preview. Final timeout values, warning duration, concurrent-session rules, and related security behavior remain subject to client approval and backend implementation.