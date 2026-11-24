# TFI_NEW — Security & Activity Dashboard UI Specification v0.1

**Date:** 20 November 2026  
**Project:** TFI_NEW  
**Location:** Administration → Security & Activity  
**Status:** UI preview implemented and interaction-tested; identity provider, live sessions, and audit capture are not connected

## 1. Purpose

Provide a centralized administrator monitoring screen for reviewing active sessions, successful and failed sign-ins, current security readiness, and recent security events.

The dashboard is an overview and monitoring surface. It does not replace Users & Access, Audit Trail, or Session Policy Settings.

## 2. Navigation and integration

- Added **Security & Activity** to the Administration navigation group.
- Added the separate **Security Alert Rules & Notifications** module to the Administration navigation group; alert configuration is not nested inside System Settings.
- Added the route to the shared TFI preview router.
- Added the navigation entry to the Dashboard, Users & Access, Security & Activity, Session Management, Audit Trail, and System Settings sidebars.
- The page uses the shared TFI shell, official Tosen Foods logo, administrator profile menu, and responsive layout.
- The dashboard opens inside the shared module workspace.
- The **Manage session policy** action opens System Settings directly at the Session Policy section.
- The Users & Access and Audit Trail actions open their existing modules.

## 3. Dashboard sections

### Security metrics

- Active Sessions
- Successful Sign-ins Today
- Failed Sign-in Attempts
- Security Events · 24h

All metrics remain neutral placeholders until verified identity and audit data are connected.

### Active Sessions

The table is prepared for:
- Account
- Role
- Device / Browser
- IP address
- Session start
- Last activity
- Session status
- Revoke action

Search and session-status filters are included. The Revoke selected action remains disabled because no verified active sessions or trusted revocation service is available.

### Login History

The section includes:
- All sign-ins
- Successful
- Failed
- Account/device search
- Date filter: All dates, Today, Last 7 days, Last 30 days

The table is prepared for date/time, account, event, device/browser, IP address, and result.

### Security Posture

Displays current readiness for:
- Identity provider
- Session policy
- Audit capture
- Server-side session revocation
- Last approved security review

The current preview correctly identifies the identity provider and audit capture as not connected, Session Policy as draft/not active, server-side revocation as not implemented, and the review date as not recorded.

### Failed Login Attempts

A dedicated panel is provided for unsuccessful authentication attempts. It remains in an empty state until trusted authentication logging is available.

### Recent Security Events

A dedicated panel is provided for account and session events, including sign-in, sign-out, session expiry, revocation, and access changes. The complete immutable event record remains in the existing Audit Trail module.

## 4. Data integrity and empty-state rules

- No sample administrator accounts, sessions, IP addresses, login events, or security events are seeded.
- Metrics display an em dash while the corresponding source is not connected.
- Active Sessions and Login History use explicit empty states instead of fabricated table rows.
- Session revocation controls remain disabled until verified session records and trusted backend revocation are available.
- Refresh displays a clear notice that no live security data was refreshed because authentication is not connected.
- The dashboard does not claim to monitor or protect a real account in this preview.

## 5. Security and implementation boundaries

- No API, database, identity provider, or authentication service is contacted.
- No active session is read, created, refreshed, extended, or revoked.
- No password, token, or credential is stored.
- Live session monitoring must be sourced from the trusted authentication/session service.
- Failed sign-in monitoring must be recorded server-side and protected against tampering.
- Security event records must flow into the existing append-only Audit Trail.
- Session revocation must be enforced by the backend, not by browser-only controls.
- IP addresses and device metadata should be collected and retained only under the approved privacy and security policy.

## 6. Responsive and accessibility behavior

- Responsive two-column desktop layout and single-column mobile layout.
- Active Sessions and Login History tables use their own horizontal overflow containers when live data is available.
- Empty states are displayed outside the wide table containers to remain readable on mobile.
- Login History tabs expose selected state and keyboard navigation using Left/Right Arrow, Home, and End.
- Search fields, filters, buttons, and status messages have accessible labels or live-region semantics.
- Revoke action is disabled until a verified session can be selected.

## 7. Acceptance results — 20 November 2026

Passed checks:
- Security & Activity opens from the Dashboard Administration navigation.
- The new page is selected in the shared sidebar.
- All four security metrics remain neutral placeholders.
- No active-session or login-history sample rows are present.
- Empty states display correctly for active sessions and login history.
- Revoke selected remains disabled.
- Security Posture displays the current connection and implementation states.
- Successful and Failed login tabs update the selected state and empty-state message.
- Refresh displays the correct not-connected message.
- Manage session policy opens System Settings at the Session Policy section.
- The same navigation works through the embedded dashboard module workspace.
- Back to Security & Access works in the Session Policy section.
- Desktop, 390 × 844 mobile, and 320 × 844 narrow viewport have no page-level horizontal overflow.
- Duplicate element IDs: 0.
- Browser page errors: 0.
- Browser console errors: 0.
- Failed local asset requests: 0.
- Loaded resources are local preview files only.

**Test result:** Security & Activity UI flow passed.

## 8. Implementation files

- design/security-activity-preview.html — dashboard structure and shared shell
- design/security-activity.css — dashboard layout and responsive styling
- design/security-activity-ui.js — local preview interactions and empty-state behavior
- design/tfi-preview-router.js — route and Session Policy section context
- design/test-security-activity-ui.js — browser acceptance tests
- design/security-activity-desktop.png — desktop screenshot
- design/security-activity-mobile.png — mobile screenshot

## 9. Completion boundary

The Security & Activity dashboard is complete as a UI preview. Real login history, active-session monitoring, failed-login detection, security-event capture, and session revocation remain dependent on the approved identity provider, backend session service, and append-only Audit Trail implementation. No live data or authentication state was changed.