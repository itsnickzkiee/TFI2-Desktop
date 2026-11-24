# TFI_NEW — Session Timeout Warning UI Specification v0.1

**Date:** 20 November 2026  
**Project:** TFI_NEW  
**Module:** Admin Login and Session  
**Status:** UI preview implemented and interaction-tested; session service is not connected

## 1. Purpose

This screen previews the warning shown before an administrator session reaches its inactivity limit. It is a standalone UI artifact and is not connected to authentication, session refresh, sign-out, or server-side timeout enforcement.

## 2. UI composition

- Existing Tosen Foods logo and TFI green/red brand palette.
- Existing TFI dashboard preview used as a dimmed, blurred background.
- Centered warning dialog with accessible dialog semantics.
- Session security heading and concise inactivity explanation.
- Simulated 90-second countdown and progress indicator.
- Primary **Stay signed in** action.
- Secondary **Sign out now** action.
- Preview-only disclaimer and TFI Admin Portal footer.
- Responsive desktop and mobile presentation.

## 3. Interaction behavior

| Element | Preview behavior |
|---|---|
| Countdown | Starts at 01:30 and decreases once per second |
| Progress indicator | Updates its accessible value and visual width with the countdown |
| Stay signed in | Shows a notice that session extension is not connected |
| Sign out now | Shows a notice that sign-out is not connected |
| Escape key | Keeps the security warning open and displays a preview notice |
| Countdown reaches 00:00 | Shows a notice that no real session was expired |

The 90-second duration is illustrative only. It is not a confirmed TFI security policy or a recommendation for the final inactivity timeout.

## 4. Accessibility and responsive behavior

- Dialog uses role=dialog, aria-modal, aria-labelledby, and aria-describedby.
- Countdown is announced through a polite live region.
- Progress indicator exposes minimum, maximum, and current values.
- Keyboard focus remains within the dialog's two actions when tabbing.
- Escape does not dismiss the security warning.
- Visible keyboard focus and reduced-motion support are included.
- Desktop, 390px mobile, and 320px narrow layouts have no page-level horizontal overflow.

## 5. Security and implementation boundaries

- No real session is monitored.
- No session refresh or revocation request is sent.
- No authentication provider, API, database, or backend is contacted.
- No credentials are requested or stored.
- Browser localStorage and sessionStorage remain empty.
- The dashboard background is a static screenshot, not a live embedded application.
- Final inactivity duration, warning lead time, refresh policy, session expiry, and revocation rules remain subject to approval.

## 6. Acceptance results — 20 November 2026

- Tosen Foods logo loaded successfully.
- Static dashboard backdrop loaded successfully.
- Desktop viewport 1440 × 900: no page-level horizontal overflow.
- Mobile viewport 390 × 844: no page-level horizontal overflow.
- Narrow viewport 320 × 844: no page-level horizontal overflow.
- Countdown starts at 01:30 and advances to 01:29.
- Accessible progress value starts at 90 and updates with the timer.
- Stay signed in displays the no-session-refresh notice.
- Sign out now displays the no-session-ended notice.
- Escape keeps the warning dialog open.
- localStorage and sessionStorage remain empty.
- All requests are local file assets only.
- Browser page errors: 0.
- Browser console errors: 0.
- Failed asset requests: 0.

**Test result:** Session Timeout Warning UI preview passed.

## 7. Implementation files

- design/session-timeout-preview.html
- design/session-timeout.css
- design/session-timeout-ui.js
- design/test-session-timeout.js
- design/session-timeout-desktop.png
- design/session-timeout-mobile.png

## 8. Completion boundary

This deliverable is a visual and interaction prototype only. The next UI screen in the planned sequence is Session Expired. Secure sign-out UI will follow. Backend authentication and session handling remain out of scope until the UI sequence and security policy are approved.