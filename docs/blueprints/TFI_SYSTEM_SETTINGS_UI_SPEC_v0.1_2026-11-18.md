# TFI System Settings — UI Specification v0.1

**Date:** 18 November 2026  
**Project:** TFI_NEW  
**Screen:** System Settings  
**Status:** First visual prototype

## 1. Purpose

System Settings provides a single Administration workspace for reviewing application preferences, operational data policies, security decisions, backup planning, and system information.

The page is a configuration design preview. It does not connect to live application services or change production settings.

## 2. Screen structure

- TFI-branded sidebar with System Settings selected under Administration.
- Breadcrumb: TFI / Administration / System Settings.
- Summary cards for settings groups, confirmed data policies, pending decisions, and live connections.
- Configuration navigation:
  - General
  - Appearance
  - Data & Import
  - Security & Access
  - Backup & Recovery
  - System Information

## 3. General preferences

Fields included:
- Application name — read-only preview identity.
- Organization — read-only preview identity.
- Time zone — proposed Asia/Manila selection, pending confirmation.
- Date format — display preference.
- Number format — display preference.
- Default landing page — proposed navigation preference.

Regional display preferences do not change stored timestamps or business values.

## 4. Appearance and workspace

Draft preferences:
- Color theme.
- Table density.
- Expanded sidebar.
- Warning before leaving forms with unsaved changes.
- Reduced motion.

These are preview controls only. They do not alter the current application shell or save preferences to a live user profile.

## 5. Data and import policies

The following rules are derived from the TFI Admin Module Blueprint and are displayed as confirmed design requirements:

1. New readable records with a known module destination are inserted into the correct module table even when required fields are incomplete; they are marked Incomplete.
2. Exact verified duplicates do not create a second module record.
3. Possible duplicates are held for review rather than automatically inserted or deleted.
4. Unmapped or unparseable rows remain in the Central Import Inbox.
5. Formula-only, report, and helper rows are not treated as independent operational transactions; the reason for exclusion is recorded.

The source method remains undecided:
- XLSX upload; or
- One-time authorized Google Sheets link scan.

Continuous Google Sheets synchronization is not part of normal operations. The page does not connect to either source.

## 6. Security and access

The screen distinguishes confirmed development requirements from policies that need approval.

Confirmed requirements:
- Admin remains the primary user during the first development stage.
- Authorization must be enforced server-side and through database policies, not only through menu visibility.
- Important account and permission changes must be audited.
- Passwords, access tokens, and authentication secrets must not be written to the audit log.
- Unassigned users must not receive elevated access by default.

Pending decisions:
- Password policy.
- Multi-factor authentication.
- Session timeout.
- Account recovery.
- Invitation method.
- Final administrator responsibilities and role catalogue.

The session and MFA selectors are planning notes only. They do not configure authentication.

## 7. Backup and recovery

The page shows the following as not configured or not confirmed:
- Backup schedule.
- Backup destination.
- Recovery test evidence.
- Retention period.
- Backup owner.
- Restore test cadence.

The prototype does not create backup jobs, claim that backups exist, or perform restores. Backup frequency, retention, encryption, restore procedures, and recovery objectives require approval and testing before production use.

## 8. System information

The preview identifies:
- Application: TFI Production Management System.
- Preview version: Admin UI v0.1.
- Environment: Local design preview.
- Central database: Not connected.
- Operational source: Not connected.
- Build status: UI prototype.

Supabase remains the planned central database. Google Sheets is not a live operational database or runtime dependency.

## 9. Interaction and prototype boundary

- Section navigation works within the page.
- Draft selectors and switches are interactive.
- Save draft and Save section actions retain values in the current page session only.
- Reset draft restores the most recently saved in-session draft.
- No live settings, database, authentication, backup, or import configuration is changed.
- No production service health is inferred or reported.

## 10. Related UI pages

- Admin Dashboard
- Users & Access
- Audit Trail
- Master Data
- Spreadsheet Import Center
- Import History
- System Settings

The System Settings sidebar destination is connected from the existing Admin preview pages where the shared sidebar is present.

## 11. Approval gate

Before production implementation, confirm:
- Official operating time zone and regional formats.
- Approved default landing page and appearance options.
- XLSX upload versus one-time authorized Google Sheets link.
- Final authentication and account-security policy.
- Backup schedule, storage, retention, encryption, and recovery objectives.
- Responsible owners and approval authority.

No pending item in this specification should be treated as an approved production configuration.
