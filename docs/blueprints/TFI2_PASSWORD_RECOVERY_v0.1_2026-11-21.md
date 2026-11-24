# TFI_NEW — Password Recovery Flow v0.1

**Date:** 21 November 2026  
**Target:** TFI2 Supabase project slfjqrkxnsgdaturaguw  
**Local application:** http://127.0.0.1:5100  
**Status:** Recovery UI and backend implemented; Auth redirect allowlist configuration remains a manual Dashboard step; no new reset email has been sent during implementation.

## 1. Root cause found

The supplied screenshot shows the recovery callback redirecting to localhost:3000 and returning error_code=otp_expired. The old frontend port 3000 is not listening. The active TFI_NEW backend is on port 5100.

The otp_expired response means the particular one-time recovery token is invalid, expired, or already consumed. A new reset email is required after correcting the redirect configuration.

## 2. Supabase Auth URL configuration required

Open the TFI2 project's Authentication → URL Configuration page:

https://supabase.com/dashboard/project/slfjqrkxnsgdaturaguw/auth/url-configuration

Set:

- Site URL: http://127.0.0.1:5100
- Additional Redirect URL: http://127.0.0.1:5100/auth/recovery

Save the changes. The recovery endpoint explicitly requests the callback URL above. Supabase only redirects to destinations in the configured allowlist.

When TFI_NEW is deployed to a real domain, replace the local Site URL and allowlist entry with the approved HTTPS production origins. Do not leave localhost as the production Site URL.

## 3. User flow implemented

1. Administrator opens the TFI login screen.
2. Clicks Forgot password.
3. Enters the registered work email.
4. TFI_NEW calls its same-origin recovery endpoint.
5. The backend sends a Supabase Auth recovery request with the fixed callback http://127.0.0.1:5100/auth/recovery.
6. The administrator opens the newest email and clicks its reset link once.
7. The callback page reads the one-time recovery token from the URL fragment, immediately removes the fragment from the address bar, and submits the token to the local backend.
8. The backend validates the Auth user and TFI access context, then stores the token in a short-lived server-side RecoveryVault.
9. The browser receives only an opaque HttpOnly, SameSite=Strict recovery cookie.
10. The administrator enters and confirms a new password.
11. The backend updates the password through Supabase Auth, revokes the recovery session where possible, and clears the local recovery cookie.

## 4. Security controls

- No service-role key is used.
- No password is requested in chat or written to disk.
- Recovery tokens are not stored in localStorage or sessionStorage.
- URL fragments are removed immediately after token parsing.
- Recovery access tokens are kept only in the in-memory server-side RecoveryVault.
- Recovery session lifetime: 10 minutes.
- Browser cookie: HttpOnly, SameSite=Strict, 10-minute max age.
- Password length enforced by TFI_NEW: 12–128 characters.
- Recovery response does not disclose whether an email exists.
- Recovery callback only accepts type=recovery.
- The callback verifies that the Auth user matches an active TFI profile with an assigned role and permissions.
- Localhost-only and same-origin write protections remain active.

## 5. Files updated or added

Backend:
- src/tfi_backend/app.py
- src/tfi_backend/supabase_gateway.py
- src/tfi_backend/session_store.py

UI:
- design/admin-login-preview.html
- design/admin-login.css
- design/password-recovery-request.html
- design/password-recovery-request.js
- design/password-reset.html
- design/password-reset.js

Tests:
- tests/backend/test_app.py
- tests/backend/test_supabase_gateway.py
- tests/backend/test_session_store.py
- tests/backend/test-password-recovery-browser.cjs

## 6. Verification

- Python backend tests: **41 passed**.
- Python compile check: passed.
- Password-recovery request and reset JavaScript syntax: passed.
- Browser flow test: passed using mocked Auth responses (no real email or password change).
- Expired-link handling: passed; error is shown and URL fragment is cleared.
- Valid recovery token handling: passed; token is exchanged for an HttpOnly cookie.
- Password update flow: passed with mocked Auth response.
- Mobile viewport 390 px: no horizontal overflow.
- Browser errors: 0.
- Failed asset requests: 0.
- Local TFI2 health endpoint: connected.
- New real recovery email: not yet requested during implementation.

## 7. Next action

After saving the TFI2 Auth URL Configuration values above, open:

http://127.0.0.1:5100/design/admin-login-preview.html

Click Forgot password and request a new link for the registered administrator email. Open the newest message and use the link once. The existing expired email link cannot be reused.


## 8. Rate limit observed during live testing

The TFI2 Auth logs confirmed the exact cause of the current UI error:

- 00:32 Manila time: account invitation email sent successfully through the built-in Supabase sender.
- 00:40 Manila time: password-recovery email sent successfully through the same built-in sender.
- 01:03 and 01:04 Manila time: subsequent recovery requests returned HTTP 429 with error code over_email_send_rate_limit and message email rate limit exceeded.

The successful mail events used noreply@mail.app.supabase.io, confirming that the project is still using the built-in email provider. Invitation and recovery sends share the project's built-in email quota. The TFI_NEW backend now maps this specific Supabase response to a clearer email_rate_limited message, rather than the generic Too many attempts message.

Do not repeatedly retry the request. Wait for the provider's hourly allowance to reset. For ongoing use and predictable delivery, configure a verified custom SMTP provider in Supabase Auth → SMTP Settings; the built-in provider's email quota cannot be raised through the ordinary Auth rate-limit setting.
