# TFI_NEW — Session Management UI Specification v0.1

**Date:** 20 November 2026  
**Project:** TFI_NEW  
**Location:** Administration → Session Management  
**Status:** UI preview implemented and regression-tested; identity provider, live session service, and authentication audit capture are not connected

## 1. Purpose

Provide one administrator-facing entry point for reviewing session-service readiness, opening proposed session policy settings, checking the session lifecycle screens, and accessing secure sign-out confirmation.

The page is a navigation and readiness dashboard. It is not a live session monitor and does not replace Security & Activity or System Settings.

## 2. Navigation and integration

- Added **Session Management** under the global Administration navigation group.
- The shared tfi-shell-controls.js inserts the navigation item after Security & Activity when it is not already present.
- Added the route session-management-preview.html to tfi-preview-router.js.
- Session Management opens in the shared TFI module workspace and retains the existing sidebar.
- The route is available from the main Dashboard and the other modules using the shared shell.
- The Session Policy actions open System Settings directly at the Session Policy section.
- The Security & Activity action opens the existing Security & Activity module.
- Timeout Warning and Session Expired actions open their existing preview screens.
- Secure Sign-out opens the existing profile-menu confirmation modal. Embedded requests are forwarded to the parent shell and accepted only from its active module frame.

## 3. Session service readiness

Four readiness cards are displayed:

1. **Identity Provider — Not connected**
2. **Session Policy — Draft only**
3. **Session Revocation — Not implemented**
4. **Session Audit — Not connected**

The status descriptions explicitly distinguish draft configuration from approved, active, or enforced security rules.

## 4. Active Sessions

- The page reserves a dedicated Active Sessions section.
- No accounts, usernames, roles, IP addresses, device details, session identifiers, or session counts are fabricated.
- The empty state explains that verified records require the identity provider and server-side session monitoring.
- A direct action opens Security & Activity for the detailed active-session and login-history view.
- No refresh, extend, terminate, or revoke action is presented as operational.

## 5. Session Policy

The policy card summarizes the available configuration areas without duplicating the proposed values:

- Idle timeout
- Expiry warning
- Maximum lifetime
- Concurrent sessions
- Browser restart
- Password-change revocation
- Session audit events

The policy remains marked **Draft · not active**. Both policy actions open System Settings at section=session. Proposed values in System Settings remain review-only and are not enforced by this UI.

## 6. Session Lifecycle previews

Three lifecycle entries are available:

- **Timeout Warning** — opens session-timeout-preview.html. The countdown is explicitly simulated; Stay signed in and Sign out now do not extend or terminate a real session.
- **Session Expired** — opens session-expired-preview.html. The screen provides a return-to-sign-in link and states that it does not expire a real session.
- **Secure Sign-out** — opens the existing administrator profile-menu confirmation modal. The modal and sign-out completion page are explicitly preview-only and do not revoke access or change account state.

## 7. Implementation readiness

The page lists the backend services required before live session controls can be enabled:

- Identity provider integration — not connected
- Server-side session store — not connected
- Session expiry enforcement — not implemented
- Session revocation endpoint — not implemented
- Authentication audit capture — not connected

No live session operations are attempted from the browser preview.

## 8. No-mock and security boundaries

- No sample or fabricated active-session records are present.
- No mock usernames, devices, browsers, IP addresses, login events, session IDs, or counts are seeded.
- No session data is read from the browser, spreadsheet, or database.
- No authentication tokens, passwords, or session identifiers are stored.
- No session is created, refreshed, extended, expired, or revoked.
- The preview-only countdown is not connected to authentication state.
- Sign-out confirmation and completion are visual demonstrations only.
- Live session records must come from a trusted server-side session service.
- Session termination must be enforced server-side.
- Authentication and session events must be written to the approved append-only Audit Trail.
- Session policy values must be approved before enforcement.

## 9. Responsive and accessibility behavior

- Uses the existing Tosen Foods green administration shell and shared navigation.
- Desktop layout uses a two-column content grid with readiness cards.
- Tablet and mobile layouts stack the main and lifecycle columns.
- No page-level horizontal overflow at 390 × 844 or 320 × 844 viewports.
- Status information is exposed through semantic text, not color alone.
- Actions are native buttons with descriptive labels.
- Preview actions preserve the existing confirmation and keyboard behavior.

## 10. Acceptance and regression results — 20 November 2026

**Session Management acceptance test: passed.**

Verified:
- Session Management opens through the global sidebar.
- Exactly one Session Management navigation item is present.
- The route loads inside the persistent module workspace.
- Four readiness cards render with the correct disconnected/draft/not-implemented states.
- Active-session empty state appears with no fabricated records or counts.
- Session Policy links open System Settings at the Session Policy section.
- Security & Activity link opens the existing monitoring page.
- Timeout Warning and Session Expired previews open correctly.
- Secure Sign-out opens the existing confirmation modal in standalone and embedded modes.
- Cancel closes the sign-out confirmation without navigating.
- Desktop, 390 × 844 mobile, and 320 × 844 narrow viewport layouts have no page-level horizontal overflow.
- Duplicate element IDs: 0.
- Browser page errors: 0.
- Browser console errors: 0.
- Failed local asset requests: 0.
- All requests during the tests were local preview assets.

**Related regression tests: passed**
- Session Policy UI
- Session Timeout Warning
- Session Expired
- Secure Sign-out flow

## 11. Implementation files

- design/session-management-preview.html — Session Management screen and shared TFI shell
- design/session-management.css — responsive layout and component styling
- design/session-management-ui.js — navigation and lifecycle preview actions
- design/tfi-preview-router.js — route and secure sign-out message handling
- design/tfi-shell-controls.js — global Session Management navigation insertion
- design/test-session-management.js — browser acceptance tests
- design/session-management-desktop.png — desktop screenshot
- design/session-management-mobile.png — mobile screenshot

Related existing screens:
- design/system-settings-preview.html — Session Policy configuration
- design/session-timeout-preview.html — Timeout Warning
- design/session-expired-preview.html — Session Expired
- design/sign-out-success-preview.html — Sign-out completion preview

## 12. Completion boundary

The Session Management UI is complete as a local design preview. Live active-session monitoring, policy enforcement, automatic expiry, session extension, server-side revocation, and trusted authentication audit capture remain dependent on the approved identity provider and backend session services. No real authentication or session state was changed.