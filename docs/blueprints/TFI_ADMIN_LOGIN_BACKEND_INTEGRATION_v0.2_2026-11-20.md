# TFI_NEW — Admin Login Backend Integration v0.2

**Date:** 20 November 2026  
**Target:** TFI2  
**Status:** Local authentication integration implemented and browser-tested; no administrator account provisioned

## Changes from the original preview

- Login is now served through the local TFI_NEW backend at http://127.0.0.1:5100/.
- The sign-in identifier is explicitly a registered work email. Username lookup is not enabled in this increment.
- The login form sends credentials only to the same-origin local endpoint /api/auth/login.
- The local backend exchanges the credentials with Supabase Auth TFI2 using the publishable key.
- The backend obtains the signed-in user's TFI access context through the public SECURITY INVOKER RPC.
- A session is created only when the linked TFI profile is active and at least one role and permission are assigned.
- New Auth users are created with pending TFI profiles and cannot enter the application until approved.
- The browser receives an opaque HttpOnly, SameSite=Strict session identifier. Access and refresh tokens remain in the local server's memory.
- No token or password is written to localStorage, sessionStorage, SQLite, or log files.
- The module preview pages require a valid local application session.
- The local host rejects non-loopback traffic and cross-origin writes.

## Session behavior

- Access-token refresh is handled through Supabase Auth.
- Sign-out revokes the Supabase session where possible and always removes the local session.
- The local app idle-timeout setting remains 0 until the owner approves the Session Management policy. Do not treat this as the final production timeout policy.
- The session vault is in-memory. Restarting the local application clears local sessions.

## Sign-in identifier

The current login UI accepts a work email only. The original "Username or email" label was changed because direct Supabase password sign-in requires an email identifier. Username login must be implemented through a separate protected server-side resolver with anti-enumeration behavior and rate limiting; no email lookup endpoint is exposed to unauthenticated clients.

## Verification

- 29 Python backend tests passed.
- Browser login integration test passed.
- Work-email field and username rejection verified.
- Empty password validation verified.
- Show/Hide password verified.
- No authentication request is sent when local validation fails.
- TFI2 connection health verified from the running local app.
- Dashboard direct access redirects to login when no session exists.
- Desktop and mobile layouts tested; no horizontal overflow.
- Browser errors: 0.
- Failed asset requests: 0.

## Provisioning boundary

No administrator account has been created. Before a real user can sign in, the owner must identify the first authorized work email and approve the initial role and permission matrix. Do not create a role or grant permissions based on assumptions.
