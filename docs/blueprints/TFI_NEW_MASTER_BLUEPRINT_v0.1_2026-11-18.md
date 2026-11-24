# TFI New System — Master Blueprint v0.1

**Petsa:** 18 Nobyembre 2026  
**Katayuan:** Panimulang draft para sa pag-apruba  
**Project folder:** C:\Users\Rominick\Desktop\TFI_NEW  
**Uri ng proyekto:** Bagong TFI application na hiwalay sa lumang TFI project

---

## 1. Layunin ng bagong TFI

Bumuo ng bagong Production Monitoring and Management System na may maayos na disenyo, malinaw na proseso, maaasahang records, tamang calculations, at iisang sentrong database.

Hindi ito simpleng pag-aayos o paglalagay ng patch sa lumang TFI. Ito ay bagong build na gagamit ng mga napatunayang requirements, business rules, module functions, workbook mappings, at formula references mula sa dating proyekto bilang gabay lamang.

## 2. Mga desisyong kumpirmado na ng may-ari

1. Ang bagong TFI ay isang Windows application.
2. Supabase ang magiging central database at pangunahing pinagmumulan ng operational records.
3. Hiwalay ang bagong project folder sa lumang TFI.
4. Hindi gagamitin ang Google Sheets bilang live operational database o runtime dependency.
5. Hindi maglalagay ng Guide, How-to, o Tech Stack information sa user interface.
6. Kailangang propesyonal, moderno, malinis, at madaling gamitin ang UI.
7. Kailangang maayos at kaaya-aya ang tables, forms, dashboard, at reports.
8. Gagawa lamang ng system ZIP matapos makumpleto at mapatunayan ang application.

## 3. Mga pangunahing prinsipyo

- Iisang operational source of truth.
- Walang duplicate na operational records dahil lamang sa magkakaibang module.
- Malinaw ang relasyon ng bawat module sa database.
- May validation para ma-classify at maipakita ang kulang o maling impormasyon; hindi hadlang ang incomplete fields sa pag-import ng bagong record na natukoy ang tamang module.
- May history at audit trail para sa mahahalagang pagbabago.
- May role-based access at permissions.
- Nasusubukan ang bawat module bago isama sa buong system.
- Walang automatic na paglalagay o paghula ng nawawalang business data.
- Walang production database migration hangga't hindi nasusuri at naaaprubahan.
- Hiwalay ang development, testing, at release files.

## 4. Pangkalahatang konsepto ng application

Ang TFI ay bubuuin sa mga sumusunod na pangunahing bahagi:

1. Login at user access.
2. Main dashboard.
3. Production at operational modules.
4. Master data at reference management.
5. Approval at record history.
6. Formula at calculation services.
7. Reports at reconciliation.
8. Administration at system settings.

Ang aktuwal na navigation, module grouping, at user permissions ay dapat aprubahan bago simulan ang full implementation.

## 5. Paunang talaan ng modules

Ang sumusunod ay paunang inventory mula sa dating TFI requirements. Hindi pa ito final navigation list. Susuriin muna kung alin ang independent module, submodule, report, o master-data section.

1. Product Entry
2. Production Entry
3. Production Schedule
4. DMP Production
5. DMR Production
6. DMR Coding
7. Hourly Meat
8. Hourly Coding
9. Hourly Agri
10. OEE
11. Productivity
12. Yield Monitoring
13. Coding DPR
14. PR Monitoring
15. CO QA
16. NON-PROD
17. KPI Dashboard
18. Reports and Reconciliation
19. Master Data Management

Bawat module ay kailangang magkaroon ng dokumentadong layunin, users, fields, validations, actions, status flow, database records, calculations, at reports.

## 6. User interface requirements

### 6.1 Pangkalahatang estilo

- Modernong professional business application.
- Malinis na layout at malinaw na visual hierarchy.
- Consistent na typography, spacing, colors, buttons, icons, at status styles.
- Magandang desktop layout na angkop sa Windows computer.
- Responsive behavior para sa mas maliliit na screen kung kailangan.
- Iwasan ang sobrang siksik na screen at hindi kailangang dekorasyon.

### 6.2 Hindi dapat ipakita sa user interface

- Guide panel o How-to instructions.
- Developer notes.
- Tech stack labels.
- Architecture diagrams.
- Debugging information.
- Internal file paths at implementation details.
- Raw database table names o SQL details.

Ang kinakailangang technical documentation ay ilalagay sa project documentation, hindi sa ordinaryong user screens.

### 6.3 Pamantayan sa tables

Ang mga data table ay dapat may:

- Malinaw at consistent na column headers.
- Maayos na column widths at alignment.
- Search.
- Sorting.
- Filters.
- Pagination.
- Clear empty states.
- Loading at error states.
- Date, number, at currency formatting kung naaangkop.
- Consistent na status indicators.
- Row actions na may tamang permissions.
- Maayos na overflow handling para sa maraming columns.
- Export/print actions kung pinahihintulutan ng module.

Hindi lahat ng table ay kailangang magkaroon ng parehong columns o actions. Dapat nakabatay ang mga ito sa aktuwal na pangangailangan ng bawat module.

### 6.4 Forms

- Malinaw ang labels at required fields.
- May field-level validation.
- May angkop na dropdowns at reference selectors.
- May malinaw na Save, Submit, Cancel, at iba pang kinakailangang actions.
- May confirmation para sa sensitibo o hindi madaling maibalik na actions.
- Hindi dapat mawala ang user input kapag may validation error.

### 6.5 Dashboard

- Ipakita lamang ang metrics na may malinaw na business meaning.
- Gumamit ng validated database records at approved calculations.
- May date period at filters kung kinakailangan.
- Iwasan ang decorative charts na walang operational value.
- Dapat ma-trace ang totals pabalik sa source records.

## 7. Paunang workflow model

Ang sumusunod ay mungkahing workflow na kailangang i-validate kada module:

Draft → Submitted → For Review → Approved

Posibleng karagdagang statuses:
- Returned for Correction
- Rejected
- Cancelled
- Archived

Hindi dapat ipilit ang iisang status flow sa lahat ng modules. Ang final status rules ay ibabatay sa aktuwal na proseso at awtoridad ng users.

## 8. Database design principles

Bago gumawa ng final database schema, kailangang matukoy ang:

- Canonical record ng bawat business transaction.
- Primary keys at foreign-key relationships.
- Required at optional fields.
- Unique constraints at duplicate rules.
- Reference/master data.
- Record revisions at audit history.
- Approval ownership.
- Row-level security at access rules.
- Deletion, cancellation, at archival rules.
- Calculation inputs at outputs.

Hindi pa aprubado ang final table names, columns, relationships, o migrations. Hindi gagawa ng production schema hangga't hindi kumpleto ang data model at review.

## 9. Spreadsheet retirement policy

Hindi dapat mangailangan ang bagong TFI ng Google Sheets para magbukas, mag-save, mag-edit, mag-approve, magkalkula, o magpakita ng operational data.

Sa controlled workbook import, lahat ng bagong operational records na natukoy ang tamang module ay dapat mailagay sa kani-kanilang module tables kahit may kulang na fields. Ang incomplete status ay itatala at maaaring ayusin sa module. Ang napatunayang existing duplicates lamang ang hindi gagawa ng panibagong module record. Ang unmapped o hindi ligtas ma-parse na rows ay mananatili sa import review hanggang malinaw ang tamang destination.

Ang duplicate protection ay gagamit ng source-row fingerprint at module-specific business key. Ang source fingerprint ang pipigil sa paulit-ulit na pag-import ng parehong row; ang business key naman ang tutukoy kung naroon na ang parehong business record kahit ibang workbook copy o revision ang pinanggalingan. Ang eksaktong duplicate lamang ang awtomatikong haharangin; ang posibleng duplicate ay dadaan muna sa review.

Maaaring pag-aralan sa hiwalay na plano ang:
- Controlled historical workbook import.
- CSV/XLSX import para sa migration.
- Generated Excel/CSV exports para sa reporting.
- Read-only preservation ng original source files bilang audit evidence.

Ang mga ito ay hindi dapat maging pangalawang operational database.

## 10. Mga hindi pa final na desisyon

1. Eksaktong user roles at permissions.
2. Final navigation at grouping ng modules.
3. Eksaktong fields at business rules ng bawat module.
4. Approval authority at status transitions.
5. Final technical implementation choices para sa Windows application.
6. Database schema at migration strategy.
7. Formula parity acceptance rules.
8. Historical data migration scope.
9. Backup, restore, at release procedure.
10. Packaging at installation experience ng final ZIP.

## 11. Inirerekomendang pagkakasunod-sunod ng trabaho

### Yugto 1 — Requirements and Module Blueprint
I-finalize ang layunin, scope, users, fields, workflows, validations, import behavior para sa incomplete records, duplicate rules, at outputs ng bawat module.

### Yugto 2 — UI/UX Design Blueprint
I-finalize ang visual direction, navigation, dashboard, table standards, forms, dialogs, at reusable UI components.

### Yugto 3 — Database Blueprint
I-finalize ang data model, relationships, security, audit history, at migration plan.

### Yugto 4 — Application Foundation
Buuin ang login, shell, navigation, shared components, user access, at error handling.

### Yugto 5 — Module Development
Buuin at subukan ang bawat module nang paisa-isa.

### Yugto 6 — Calculations and Reporting
I-implement at i-verify ang formulas, KPI, dashboard, at reports.

### Yugto 7 — Integration and Acceptance Testing
Subukan ang end-to-end workflows, permissions, data integrity, recovery, at performance.

### Yugto 8 — Release Packaging
Gumawa ng sanitized, reproducible, at tested na Windows system ZIP.

## 12. Unang kailangang kumpletuhin

Ang unang aktuwal na deliverable ay ang **Requirements and Module Blueprint**.

Para sa bawat module, gagawa tayo ng iisang standard specification:

1. Pangalan ng module.
2. Layunin.
3. Sino ang gagamit.
4. Data na ini-input.
5. Fields at field definitions.
6. Validation rules.
7. Available actions.
8. Status workflow.
9. Database records na kailangan.
10. Calculations at dependencies.
11. Reports at outputs.
12. Acceptance tests.

Kapag kumpleto at aprubado ang module specifications, saka tayo magdidisenyo ng UI at database.

---

**Paalala:** Draft v0.1 pa lamang ito. Ang mga kumpirmadong desisyon ay hindi babaguhin nang walang malinaw na pag-apruba. Ang mga hindi pa final na bagay ay hindi huhulaan; idodokumento at ipapadesisyon muna.


## 11. Official spreadsheet source baseline — 20 November 2026

The approved source reference for new TFI_NEW spreadsheet scanning, source mapping, and historical import planning is now:

- Workbook: `Copy of TFI - Production Monitoring Sheet 1`
- Spreadsheet ID: `1rCbQ16wj7MRjQCFF3tA-WEMkudraJK0RkwcqayUlz7k`
- Worksheet count: 35
- Full source-to-UI inventory: `docs/blueprints/TFI_35_TAB_SOURCE_TO_UI_AUDIT_v0.1_2026-11-20.md`

The former 28-tab workbook is a legacy comparison source only. Do not use it as the current source baseline for new UI mapping or import readiness. Google Sheets remains a controlled source for scan/import/migration only, not the live operational database. The audit does not approve any database migration or change to the source workbook.


## 12. Consolidated module validation reference — 20 November 2026

The coordinated source alignment and UI revalidation for DMR Coding, Coding DPR, NON-PROD, CO QA, OEE, Productivity, Yield Monitoring, and Master Data is documented in docs/blueprints/TFI_8_MODULE_SOURCE_ALIGNMENT_VALIDATION_v0.2_2026-11-20.md. Use this as the current module-level source fidelity reference before import readiness or database integration. It records unresolved legacy product codes, source formula/validation issues, Product Standard/Code Map mismatches, and the CO QA manual-field decision. No live data transfer is authorized by this validation note.


## 13. Phase 5 operational backend progress — 21 November 2026

Phase 5 is now in progress. DMP Production is the first operational module because its manpower-hour records are an upstream dependency for Productivity.

Implemented in TFI2:
- DMP Production current-record and revision tables.
- Permission-checked create/read/update API and RPC functions.
- Server-side DMP LEGEND lookup for worker/process options and Position snapshot.
- Incomplete-row capture marked unassessed.
- Exact duplicate fingerprint protection.
- Optimistic version checks, append-only revisions, and audit events.
- Local UI wiring for entry, saved records, date filters, edit, and revision history.

Local automated verification: 97 backend tests passed; Python compile, DMP JavaScript syntax, and UI element-ID checks passed. Live TFI2 RPC behavior was exercised under an authenticated test context inside rolled-back transactions. No DMP Production records or test audit events were persisted.

The authenticated browser acceptance test remains pending. The next module after DMP Production acceptance is Product Entry. See:
- docs/blueprints/TFI2_PHASE5_OPERATIONAL_MODULES_ROADMAP_v0.1_2026-11-21.md
- docs/blueprints/TFI2_DMP_PRODUCTION_BACKEND_BLUEPRINT_v0.1_2026-11-21.md

Phase 6 Import Center implementation was started earlier and remains a separate historical-import workflow. Its generic operational import store must later be integrated with module-specific records before historical imports are considered complete.
