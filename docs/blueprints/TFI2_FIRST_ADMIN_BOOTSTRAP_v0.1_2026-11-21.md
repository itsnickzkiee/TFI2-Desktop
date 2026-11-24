# TFI2 — First Administrator Bootstrap Completion

**Status:** Completed and verified  
**Last updated:** 21 November 2026  
**Target:** TFI2 Supabase project slfjqrkxnsgdaturaguw

## Administrator account

- Confirmed work email: dutsrominick@gmail.com
- Auth user ID: 42728da9-f174-45bb-a1a8-dfd7797655e6
- Invitation: accepted
- Email confirmation: complete
- Email identity: present
- Password credential: present (credential value is never read or stored here)
- TFI profile status: active
- Assigned role: System Administrator (system_admin)
- Granted role permissions: 360 / 360
- Bootstrap audit event: recorded

## Completed provisioning sequence

1. The project owner confirmed the authorized administrator email.
2. The owner sent the Supabase Auth invitation through the TFI2 Dashboard.
3. TFI2 Auth created the user record and the linked TFI profile.
4. The invitation was accepted and the email identity was confirmed.
5. The one-time bootstrap function validated that TFI2 contained exactly one Auth user, that the supplied UUID matched that user, that the linked profile existed and was not disabled, and that the System Administrator role had all 360 permission grants.
6. The function atomically activated the TFI profile, assigned the System Administrator role, and recorded an audit event.
7. Read-back verification confirmed one active profile, one System Administrator assignment, 360 permissions, and one bootstrap audit event.

## Security properties

- The bootstrap function is in the non-API private schema.
- It is SECURITY DEFINER with an empty search path and fully qualified object references.
- EXECUTE is revoked from PUBLIC, anon, authenticated, and service_role.
- The function does not create Auth users or send invitations.
- The function refuses to run if a System Administrator assignment already exists.
- The Windows application uses the Supabase publishable key only. No service-role key is stored in .env or source code.
- The administrator password is not requested, copied, logged, or stored in project documentation.
- The local TFI_NEW session is created only after the application verifies the user's active profile, role, and explicit permissions.

## Verification snapshot

- Auth users in TFI2: 1
- Matching administrator account: 1
- Email confirmed: yes
- Password credential present: yes
- TFI profile status: active
- System Administrator assignments: 1
- System Administrator permission grants: 360 / 360
- Bootstrap audit events for this user: 1
- Local application health: connected to TFI2
- Backend tests: 29 passed
- Supabase security advisor: one warning — leaked-password protection is disabled

## Remaining gates

1. Sign in through the local TFI_NEW page at http://127.0.0.1:5100/ with the administrator's own password and verify the HttpOnly session flow. Never share the password in chat.
2. Configure and verify the production session idle timeout and concurrent-session policy.
3. Enable Supabase Auth leaked-password protection before production use.
4. Continue with protected module endpoints, audit coverage, and operational tables.

The first administrator bootstrap is complete. The local application sign-in and session test is the next checkpoint.
