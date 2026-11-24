# TFI_NEW — Security Alert Rules & Notifications UI Specification v0.1

**Date:** 20 November 2026  
**Project:** TFI_NEW  
**Location:** Administration → Security Alert Rules & Notifications  
**Status:** UI preview implemented and interaction-tested; rule engine, identity source, and notification delivery are not connected

## 1. Purpose

Provide administrators with a dedicated workspace for defining security alert conditions, selecting severity, recording intended recipients, reviewing delivery-channel readiness, and viewing verified notification history.

This is a standalone Administration module. It is not nested under System Settings and does not replace Security & Activity, Session Management, Users & Access, or Audit Trail.

## 2. Navigation and integration

- Added **Security Alert Rules & Notifications** as a separate entry in the Administration sidebar.
- Added the route to the shared TFI preview router.
- Added the navigation item to the Dashboard, Users & Access, Security & Activity, Session Management, Audit Trail, and System Settings sidebars.
- The new page uses the existing TFI shell, Tosen Foods branding, administrator profile, green-and-white visual system, and shared module workspace.
- The header shortcut opens Security & Activity.
- The Notification History shortcut opens Audit Trail.
- The active sidebar state follows the selected module through the shared router.

## 3. Screen structure

### 3.1 Alert Rules

The default tab contains:

- Search by rule name, trigger, recipient text, category, or severity.
- Category filter: Authentication, Account & Access, Sessions, and Audit Integrity.
- Severity filter: Critical, Warning, and Informational.
- Rule table with rule name, trigger event, severity, preferred delivery channel, draft status, and local draft actions.
- Empty state when no rules are configured.

The Create Alert Rule dialog contains:

- Rule name.
- Event category.
- Trigger event.
- Severity.
- Preferred channel: In-app, Email, or Both.
- Intended recipients.
- Optional threshold.
- Optional time window in minutes.

The trigger selector includes failed sign-in thresholds, repeated failed sign-ins for one account, administrator-account creation, role/permission changes, account lock/disable, session revocation, repeated session expiry, and audit-capture unavailability.

Selecting a trigger proposes its matching category in the draft form. Administrators can still review the category before saving.

### 3.2 Delivery Channels

Two channel cards are provided:

- Email notifications.
- In-app notifications.

Both are explicitly marked **Not connected**. Configure actions remain disabled until the relevant provider/service and approved delivery policy exist.

The page does not collect provider passwords, API keys, access tokens, or other secrets.

### 3.3 Notification History

The history tab is prepared for verified delivery records, with fields for:

- Date and time.
- Rule.
- Security event.
- Recipient.
- Channel.
- Delivery result.

The initial view contains no records. Search and channel filters remain disabled while no verified history source is connected.

## 4. Draft behavior and data-integrity boundaries

- No sample alert rules, notification records, recipients, or delivery outcomes are seeded.
- A rule created in the preview is stored in browser memory for the current page session only.
- Local drafts can be edited or discarded during that session.
- Refreshing or closing the page clears the local drafts.
- Saving a draft does not enable a rule, create a server record, or send a notification.
- Enabled-rule, connected-channel, and notification-sent metrics remain neutral placeholders until verified backend sources are connected.
- The draft count reflects only drafts created in the current browser session.
- Email and in-app Configure actions remain disabled.
- Notification History remains empty until a trusted notification service records verified delivery outcomes.
- No live database, identity provider, mail provider, or notification API is contacted.

## 5. Security and production requirements

Before any rule can be enabled in production:

- Define the approved event catalogue and trigger semantics.
- Approve severity definitions and threshold/time-window policy.
- Approve recipient groups and authorization to receive sensitive security information.
- Enforce rule-management permissions server-side.
- Evaluate events in a trusted backend/rule engine; do not rely on browser-side checks.
- Deliver notifications through approved providers with retry and failure handling.
- Protect provider secrets in server-side secret storage.
- Record rule changes and notification outcomes in the append-only Audit Trail.
- Apply approved retention and privacy controls to recipient and delivery metadata.
- Prevent unauthorized users from enabling, changing, or disabling security rules.

## 6. Responsive and accessibility behavior

- Uses the shared TFI responsive shell and Administration navigation.
- Three tabs expose selected state and keyboard navigation with Left/Right Arrow, Home, and End.
- The rule form uses labelled, required fields and native validation.
- The modal closes using its close/cancel controls, backdrop click, or Escape.
- Wide tables scroll within their own containers on narrow screens.
- Empty states remain readable without horizontal page overflow.

## 7. Acceptance results — 20 November 2026

Passed browser checks:

- Direct page title, heading, and active Administration sidebar item.
- Shared-router entry from Dashboard to Security Alert Rules & Notifications.
- Sidebar link present exactly once in all six existing Administration workspaces.
- Security Alert Rules → Security & Activity navigation.
- Security Alert Rules → Audit Trail navigation.
- Alert Rules, Delivery Channels, and Notification History tab switching.
- Initial empty state with zero seeded rules and zero notification records.
- Neutral placeholders for enabled rules, connected channels, and notifications sent.
- Delivery-channel configuration actions remain disabled.
- Notification-history filters remain disabled while no history exists.
- Required-field validation blocks incomplete draft submission.
- Create, edit, and discard local draft interactions.
- Draft count updates only for the current browser session.
- Draft creation does not change enabled-rule metrics or create notification-history rows.
- Modal Escape close behavior.
- 390 × 844 and 320 × 844 viewport checks show no page-level horizontal overflow.
- Wide rule table uses its own horizontal scrolling container when a temporary browser-only test row is injected; the test fixture is not saved.
- Duplicate element IDs: 0.
- Browser page errors: 0.
- Browser console errors: 0.
- Failed local asset requests: 0.

**Test result:** Security Alert Rules & Notifications UI acceptance passed.

## 8. Implementation files

- **design/security-alert-rules-preview.html** — standalone page and shared-shell navigation.
- **design/security-alert-rules.css** — page-specific styling and responsive layout.
- **design/security-alert-rules-ui.js** — tabs, local draft form, search, filters, and navigation.
- **design/tfi-preview-router.js** — route registration.
- **design/test-security-alert-rules-ui.js** — browser acceptance tests.
- **design/security-alert-rules-verified-desktop.png** — clean desktop empty-state screenshot.
- **design/security-alert-rules-verified-mobile.png** — clean mobile empty-state screenshot.
- **design/build-security-alert-rules.js** — local page/navigation build script.

Rollback copies were retained beside the six updated Administration sidebar pages and the shared router with the suffix **.pre-security-alert-rules-20261120.bak**.

## 9. Completion boundary

The Security Alert Rules & Notifications screen is complete as a local UI preview. Production rule persistence, event evaluation, approved recipients, server-side permissions, email provider integration, in-app delivery, retries, notification history, and immutable audit capture remain backend/security implementation requirements.

No live authentication state, email provider, notification service, Google Spreadsheet, Supabase table, production record, or audit event was created or changed.