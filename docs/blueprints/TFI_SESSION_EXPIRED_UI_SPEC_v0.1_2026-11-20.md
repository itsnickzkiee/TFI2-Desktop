# TFI_NEW — Session Expired UI Specification v0.1

**Date:** 20 November 2026  
**Project:** TFI_NEW  
**Module:** Admin Login and Session  
**Status:** UI preview implemented and interaction-tested; authentication and session services are not connected

## 1. Purpose

The Session Expired screen is the destination shown after an administrator session has reached its inactivity limit. It explains why the user can no longer continue and provides a direct route back to the administrator sign-in screen.

## 2. UI composition

- Existing Tosen Foods logo and TFI green/red brand palette.
- Existing TFI dashboard preview used as a dimmed, blurred background.
- Centered, responsive session-expired card.
- Account Security label and clear **Your session has expired** heading.
- Concise explanation that the administrator session was inactive.
- Session status row showing **Expired**.
- Primary **Return to sign in** link.
- Preview-only disclaimer and TFI Admin Portal footer.

## 3. Interaction behavior

| Element | Preview behavior |
|---|---|
| Return to sign in | Opens the local admin-login-preview.html screen |
| Session status | Displays a static Expired state |
| Preview disclaimer | Explains that no real session is expired or signed out |

The return link is navigation between local preview pages only. It does not authenticate a user or create a new session.

## 4. Accessibility and responsive behavior

- Semantic main and section landmarks.
- Heading and description are programmatically associated.
- Session state is exposed with a status role and accessible label.
- Return action is a native link with visible keyboard focus.
- Reduced-motion preference is respected.
- Desktop, 390px mobile, and 320px narrow layouts have no page-level horizontal overflow.

## 5. Security and implementation boundaries

- No real session is monitored, expired, revoked, or signed out.
- No authentication provider, API, database, or backend is contacted.
- No credentials are requested or stored.
- The return link opens the local administrator login preview only.
- The dashboard background is a static screenshot, not a live embedded application.
- Actual session expiry and sign-out behavior remain subject to the approved authentication and security policy.

## 6. Acceptance results — 20 November 2026

- Tosen Foods logo loaded successfully.
- Static dashboard backdrop loaded successfully.
- Desktop viewport 1440 × 900: no page-level horizontal overflow.
- Mobile viewport 390 × 844: no page-level horizontal overflow.
- Narrow viewport 320 × 844: no page-level horizontal overflow.
- Session status visibly reports Expired.
- Return to sign in opens the local Administrator Sign In preview.
- Preview notice clearly states that no real session is expired.
- All requests are local file assets only.
- Browser page errors: 0.
- Browser console errors: 0.
- Failed asset requests: 0.

**Test result:** Session Expired UI preview passed.

## 7. Implementation files

- design/session-expired-preview.html
- design/session-expired.css
- design/test-session-expired.js
- design/session-expired-desktop.png
- design/session-expired-mobile.png

## 8. Completion boundary

This deliverable is a visual and navigation prototype only. The next planned UI item is the secure sign-out confirmation or transition state, depending on the approved login/session flow. Backend authentication, expiry enforcement, and session revocation remain out of scope until the UI sequence and security policy are approved.