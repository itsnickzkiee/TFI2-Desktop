# TFI_NEW — Secure Sign-out UI Specification v0.1

**Date:** 20 November 2026  
**Project:** TFI_NEW  
**Module:** Admin Login and Session  
**Status:** UI preview implemented and interaction-tested; authentication and session revocation are not connected

## 1. Purpose

Provide a consistent administrator sign-out entry point across the TFI Admin Portal, confirm the user's intent, and show a clear sign-out completion transition before returning to the administrator sign-in preview.

## 2. Shared administrator profile menu

The shared TFI shell controls add the same account menu to the existing Administrator profile area on the dashboard and module workspaces.

- Administrator profile trigger with accessible button semantics.
- Dropdown identifies the current preview role as Administrator / System Admin.
- Sign out menu item with a destructive-action visual treatment.
- Keyboard support for Enter, Space, Arrow Down, and Escape.
- Outside click closes the dropdown.
- Responsive layout preserves the profile control and dropdown on mobile.

## 3. Sign-out confirmation dialog

The confirmation dialog appears after selecting Sign out.

- Account Security heading: **Sign out of TFI?**
- Clear explanation that the user will return to the sign-in screen.
- **Cancel** closes the dialog and returns focus to the profile control.
- **Sign out** opens the sign-out completion preview.
- Escape and backdrop click close the dialog.
- Keyboard focus is kept within the two dialog actions.
- A visible preview notice states that no real session is revoked and account access is unchanged.

## 4. Sign-out completion screen

The completion page includes:

- Tosen Foods branding and TFI green visual identity.
- **You've been signed out** confirmation heading.
- Static Sign-out Status: Complete indicator.
- Four-second illustrative redirect countdown and progress bar.
- **Return to sign in now** action.
- Automatic navigation to admin-login-preview.html when the countdown completes.
- Preview-only notice clarifying that no actual session was revoked.

## 5. Interaction flow

1. Open the Administrator profile menu from the dashboard or any module workspace.
2. Select **Sign out**.
3. Review the confirmation dialog.
4. Select **Cancel** to remain in the portal, or **Sign out** to continue the preview.
5. The sign-out completion screen appears.
6. The screen automatically returns to the local Admin Login preview after four seconds, or the user can return immediately.

## 6. Security and implementation boundaries

- This is a UI/navigation prototype only.
- No authentication provider, API, database, or backend is contacted.
- No active session is read, refreshed, revoked, or destroyed.
- No credentials, tokens, or authentication state are stored.
- The completion page is a simulated visual state; it does not prove that a real account was signed out.
- Actual sign-out must later be implemented by the approved authentication/session service, followed by server-side session revocation and safe redirect handling.

## 7. Accessibility and responsive behavior

- Profile trigger exposes role, expanded state, and menu relationship.
- Confirmation dialog uses dialog role, aria-modal, labelled heading, and description.
- Initial dialog focus moves to Cancel; Escape closes the dialog; Tab and Shift+Tab remain within its actions.
- Visible focus states and reduced-motion support are included.
- Desktop and mobile profile menus, confirmation dialog, and completion screen are supported.

## 8. Acceptance results — 20 November 2026

- Dashboard profile menu opens and closes.
- Confirmation dialog opens from the profile menu.
- Cancel returns to the portal without navigation.
- Sign out opens the completion preview.
- Completion page displays Signed Out / Complete state.
- Manual Return to sign in opens the local Admin Login preview.
- Automatic redirect after four seconds opens the local Admin Login preview.
- Same profile menu and confirmation dialog are available on an embedded Audit Trail module preview.
- Mobile viewport 390 × 844: no horizontal overflow.
- Narrow viewport 320 × 844: no horizontal overflow.
- Escape closes the confirmation dialog.
- All requests are local file assets only.
- Browser page errors: 0.
- Browser console errors: 0.
- Failed asset requests: 0.

**Test result:** Sign-out UI flow passed.

## 9. Implementation files

### Shared shell

- design/tfi-shell-controls.js
- design/tfi-shell-standard.css

### Sign-out completion

- design/sign-out-success-preview.html
- design/sign-out-success.css
- design/sign-out-success-ui.js

### Tests and screenshots

- design/test-sign-out-flow.js
- design/sign-out-confirm-desktop.png
- design/sign-out-confirm-mobile.png
- design/sign-out-success-desktop.png
- design/sign-out-success-mobile.png

## 10. Completion boundary

The administrator sign-out UI flow is complete. Authentication, session expiry enforcement, and server-side session revocation remain out of scope until the UI sequence and security policy are approved.