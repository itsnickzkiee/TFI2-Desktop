# TFI New System — Admin Module Blueprint v0.1

**Petsa:** 18 Nobyembre 2026  
**Katayuan:** Draft para sa pagsusuri at pag-apruba  
**Project:** TFI_NEW  
**Parent blueprint:** TFI_NEW_MASTER_BLUEPRINT_v0.1_2026-11-18.md

---

## 1. Layunin ng Admin Module

Ang unang bubuuing bahagi ng bagong TFI ay ang Admin Module. Ito ang magiging pangunahing lugar para sa system administration, spreadsheet scanning/import, data validation, review, approval, reference management, at monitoring ng import activities.

Sa unang development stage, Admin muna ang pangunahing user. Hindi muna bubuuin ang ibang user roles hangga't hindi kumpleto at nasusubukan ang Admin workflow.

## 2. Pangunahing Admin functions

Paunang listahan:

1. Admin Login and Session
2. Admin Dashboard
3. Spreadsheet Import / Scan Center
4. Import History and Scan Results
5. Central Import Inbox
6. Module Mapping and Classification
7. Validation and Duplicate Review
8. Record Review and Approval
9. Module Import Status
10. Master Data / Reference Management
11. User and Access Management — ihahanda ang design; ang final roles ay hiwalay na iaapruba.
12. Security & Activity Monitoring
13. Security Alert Rules & Notifications — hiwalay na Administration module; ang rules ay draft lamang hangga't walang aprubadong backend rule engine, recipients, at notification provider.
14. Audit Trail and Activity History
15. System Settings

Hindi kailangang ipakita ang developer guide, how-to panel, o technical stack sa Admin user interface. Ang Admin screens ay dapat nakatuon sa aktuwal na trabaho at data.

## 3. Spreadsheet Scan and Import workflow

### Step 1 — Pumili ng source workbook

Pipili ang Admin ng authorized latest workbook na i-scan.

**Hindi pa final ang paraan ng pagbibigay ng source.** Kailangang kumpirmahin kung:
- mag-a-upload ang Admin ng XLSX file na na-download mula sa Google Sheets; o
- maglalagay ang Admin ng authorized Google Sheets link para sa one-time controlled scan.

Anuman ang piliin, hindi dapat magkaroon ng tuloy-tuloy na Google Sheets synchronization para sa normal na operations. Ang workbook ay source lamang para sa controlled import, migration, at verification.

### Step 2 — Basahin ang workbook

Dapat makuha ng scanner ang:

- Workbook identity at source filename/link.
- Scan timestamp at source version/fingerprint.
- Worksheet names at sheet identifiers kung available.
- Used ranges at row/column positions.
- Raw cell values.
- Formula text at cached/displayed values kung available.
- Number/date formats kung kailangan sa interpretation.
- Source worksheet at source row ng bawat record.
- Stable source fingerprint para sa duplicate detection at safe retry.

Dapat maiba ng parser ang authored input rows, blank/template rows, formula-only rows, derived reports, at helper/reference data.

### Step 3 — I-map ang rows sa tamang module

Gagamit ang scanner ng approved module mapping rules. Hindi dapat hulaan ang destination kapag hindi malinaw ang row identity.

Mga paunang destination:
- Product Entry
- Production Entry
- Production Schedule
- DMP Production
- DMR Production
- DMR Coding
- Hourly Meat
- Hourly Coding
- Hourly Agri
- OEE
- Productivity
- Yield Monitoring
- Coding DPR
- PR Monitoring
- CO QA
- NON-PROD
- Master Data / Reference Tables

Ang bawat operational row ay kailangang may module classification. Kung hindi matukoy ang module, o derived/helper row ito, dapat may documented reason kung bakit ito held o excluded.

### Step 4 — I-save sa Supabase Central Import Inbox

Ang lahat ng captured operational rows ay ise-save muna sa Central Import Inbox bilang staging at audit ledger. Pagkatapos ng module mapping at duplicate check, ang bawat bagong record na matutukoy ang module ay ilalagay sa kaukulang module table kahit incomplete. Hindi magiging hadlang ang kulang na fields sa pagpasok ng bagong record. Mananatili sa Inbox ang source traceability at import status.

Minimum source traceability fields:
- Import batch ID
- Source workbook ID/name/fingerprint
- Source worksheet
- Source row
- Source record fingerprint
- Target module
- Raw source payload
- Parsed payload
- Formula/source-cell metadata kung naaangkop
- Validation state
- Disposition
- Review/approval history
- Created/updated timestamps

Ang Central Import Inbox ay may module filters/views para madaling makita ang records ng bawat module. Hindi kailangang magkaroon ng magkakahiwalay na disconnected import systems.

### Step 5 — Automatic validation and classification

Paunang statuses:

| Status | Kahulugan | Treatment |
|---|---|---|
| Complete | Kumpleto at pumapasa sa required checks | Ipasok sa tamang module table; eligible sa calculations ayon sa module rules |
| Incomplete | May kulang na required information | Ipasok pa rin sa module table; markahang Incomplete at payagang i-update |
| Optional fields missing | May kulang na optional information | Ipasok sa module table; huwag markahang incomplete kung hindi required ang field |
| Duplicate | Napatunayang existing na ang parehong record | Huwag gumawa ng bagong module record; i-link sa existing record kung eksaktong natukoy |
| Possible duplicate | May kahawig na record ngunit hindi pa tiyak | I-hold ang insert para sa duplicate review; huwag hulaan kung alin ang kapareho |
| Invalid / Unparseable | Hindi ligtas ma-convert ang data sa module schema | Panatilihin sa Inbox at ipakita ang error hanggang maayos ang parsing o mapping |
| For Review / Unmapped | Hindi matukoy ang tamang module o record type | Panatilihin sa Inbox; huwag maglagay sa maling module |
| Derived / Excluded | Formula/report/helper row na hindi independent transaction | Itala ang dahilan; huwag gawing duplicate transaction |

Dapat mapanatili ang original blanks at raw values. Hindi dapat awtomatikong punan o baguhin ang nawawalang petsa, product code, quantity, cost, o iba pang business data.

Ang duplicate check ay dapat gumamit ng dalawang antas: (1) source fingerprint upang maiwasan ang paulit-ulit na import ng parehong workbook row; at (2) module-specific business key upang makita kung naroon na ang parehong business record kahit galing ito sa ibang workbook copy o revision. Ang eksaktong duplicate lamang ang awtomatikong haharangin. Ang posibleng kapareho ngunit hindi tiyak ay ipapadaan sa review, hindi basta buburahin o papasukin nang walang pagsusuri.

### Step 6 — Admin review and correction

Makikita ng Admin ang:
- Batch summary.
- Counts per worksheet.
- Counts per target module.
- Complete/incomplete/duplicate/invalid/held counts.
- Source row preview.
- Raw and parsed values.
- Validation errors and warnings.
- Duplicate candidate and exact target reference, kung mayroon.
- Formula or mapping warnings.

Ang pagpasok ng bagong record sa module table ay hindi dapat nakadepende sa manual approval dahil lamang incomplete ito. Ang import ay maaaring maglagay ng bagong record bilang Draft, Imported, o Incomplete ayon sa module rules.

Ang Admin review ay gagamitin para sa:
- Pagkumpleto o pagwawasto ng kulang na fields.
- Pagresolba ng possible duplicates.
- Pag-aayos ng invalid o unmapped rows.
- Pagre-record ng Admin at timestamp sa bawat pagbabago.
- Pagpapanatili ng malinaw na dahilan sa return, exclusion, o correction.

Kung may hiwalay na business approval process ang isang module, mananatili iyon bilang hiwalay na status flow. Hindi ito dapat ipagkamali sa pahintulot na ma-import ang bagong record.

### Step 7 — Awtomatikong ilagay sa tamang module table

Kapag bagong record ito, natukoy ang tamang module, at hindi ito existing duplicate, ilalagay ito sa sariling operational table ng module nito kahit incomplete. Ang completeness status ay ise-save kasama ng record. Tanging napatunayang duplicate, unmapped, o hindi ligtas ma-parse na row ang hindi muna gagawa ng bagong module record.

Mga halimbawa ng target tables mula sa dating data model (pang-reference lamang; hindi pa final schema):
- Product Entry → tfi_product_entries
- Production Entry → tfi_production_entry_days
- Production Schedule → tfi_production_schedules
- DMP → tfi_dmp_entries
- DMR / DMR Coding → tfi_dmr_events
- PR Monitoring → tfi_pr_monitoring_records
- CO QA → tfi_coqa_entries
- NON-PROD → tfi_nonprod_entries

Ang final schema at table names ay muling ididisenyo at iaapruba para sa bagong TFI. Hindi basta kokopyahin ang lumang schema.

Bawat imported module record ay dapat may link pabalik sa source Inbox row at import batch. Dapat may unique constraints/idempotency protection para hindi madoble kapag inulit ang import.

### Step 8 — Recalculate imported data

Pagkatapos mailagay ang bagong record sa module table, ang calculation engine ay gagamit ng operational records at approved reference/master data. Hindi kailangang kumpleto ang lahat ng fields ng record para manatili ito sa module table; ang bawat formula lamang ang magpapasya kung sapat ang mga input nito para makapag-compute.

Ang calculation engine ay dapat sumunod sa eksaktong eligibility rules ng bawat formula. Ang incomplete record ay nasa module table pa rin, ngunit hindi isasama sa isang partikular na computation kung kulang ang input na kailangan ng formula. Hindi dapat gamitin ang invalid/unparseable, unresolved duplicate, unmapped, o formula-only rows bilang independent transactions. Ang mga optional field na walang kinalaman sa formula ay hindi dapat humarang sa calculation.

## 4. Formula replication requirements

Ang bagong TFI ay dapat mag-reproduce ng spreadsheet business logic. Hindi sapat ang paglipat ng formula text o cached values.

Para sa bawat formula family, kailangang idokumento ang:
1. Source formula at cell/range.
2. Input fields.
3. Reference/master data dependencies.
4. Cross-sheet dependencies.
5. Conditions and filters.
6. Blank-versus-zero behavior.
7. Error handling.
8. Rounding and precision.
9. Expected output.
10. Edge cases and acceptance tests.

Mga formula patterns na kailangang suportahan kung ginagamit ng workbook:
- IF / nested IF
- IFERROR
- VLOOKUP
- INDEX / MATCH
- SUMIFS
- COUNTIFS
- ARRAYFORMULA
- FILTER / SORT
- LET
- SUBTOTAL
- Date/time and duration calculations
- Cross-sheet references

Ang formula engine ay dapat gumamit ng approved Supabase data at reference tables. Hindi ito dapat tumawag sa Google Sheets para mag-compute habang ginagamit ang application.

## 5. Derived/helper tabs at non-transactional data

Batay sa dating 35-tab workbook audit, ang mga sumusunod ay hindi dapat i-import bilang hiwalay na operational transactions:

- GUIDELINES
- KPI Dashboard
- Summary
- KPI Calc
- Yield Log
- Dash Calc
- Hourly Calc

Ang mga ito ay dapat buuing muli bilang calculated views/reports mula sa approved operational data at reference tables.

Mga partikular na dependency:
- Yield Log: derived mula sa Product Entry at Yield Map.
- Productivity: gumagamit ng DMP Production, Product Standard, at Code Map.
- Hourly Meat/Coding/Agri: gumagamit ng Code Map, Product Standard, at cumulative calculations.
- Summary at CO QA: may formula projections mula sa Product Entry; kailangang iwasan ang double counting.
- KPI Dashboard: nakadepende sa approved KPI setup, operational modules, at verified calculation outputs.
- NON-PROD: ang dating workbook logic para sa column G ay F/60; kailangang i-verify ang units at exact formula behavior bago tanggapin.

Ang listahan ay panimulang reference. Kailangang i-rescan at i-reconcile ang mismong workbook version na gagamitin sa production migration.

## 6. Admin UI requirements

### Admin Dashboard
- Malinis at professional na layout.
- Import batch summary.
- Pending review count.
- Counts by module and validation status.
- Recent admin activities.
- Alerts para sa failed scan, unresolved mapping, at import exceptions.

### Spreadsheet Import Center
- Clear source selection.
- Scan action.
- Scan progress.
- Worksheet list.
- Row counts and classification summary.
- Preview ng detected data.
- Clear warnings bago i-save ang batch.

### Central Import Inbox
- Search, sort, filter, pagination.
- Filter by batch, module, worksheet, status, and date.
- Maayos na column spacing at readable values.
- Side panel o detail view para sa raw source at parsed record.
- Clear actions para sa review, correction, duplicate resolution, return, at exclusion ayon sa permission.
- Makikita at mae-edit sa module table ang mga bagong imported records na may Incomplete status.

### Tables and forms
- Consistent typography, spacing, alignment, and status badges.
- Readable dates, quantities, percentages, and currency.
- Hindi siksik ang columns.
- May loading, empty, success, and error states.
- Walang guide/how-to o tech stack content.

## 7. Auditability and safety requirements

- Preserve raw source data.
- Preserve source workbook/sheet/row identity.
- Preserve import batch and fingerprint.
- No silent overwrite.
- Ang automatic import ng bagong record ay hiwalay sa business approval; huwag awtomatikong markahang Approved ang transaction kung may approval workflow ito.
- No automatic deletion of invalid/incomplete/duplicate rows.
- Safe retry and idempotent promotion.
- Log every admin review and approval.
- Use role checks and database authorization, not UI-only hiding.
- Back up and test before any production migration.
- Keep the old TFI and its database untouched during new-system development.

## 8. Acceptance tests for the Admin import workflow

Bago ideklarang kumpleto ang Admin import feature, kailangang pumasa ang mga sumusunod:

1. Ma-scan ang lahat ng aprubadong workbook tabs.
2. Tama ang worksheet, row, at source fingerprint na naitatala.
3. Napapanatili ang raw values at formula metadata.
4. Tama ang module mapping ng bawat suportadong row type.
5. Natutukoy ang blank/template/derived rows at naitatala ang dahilan ng exclusion.
6. Ang incomplete ngunit nababasang bagong rows na may malinaw na module ay naisasama sa tamang module tables at namamarkahang Incomplete.
7. Ang kulang na optional fields ay hindi awtomatikong nagiging dahilan para markahang Incomplete ang record.
8. Ang napatunayang existing duplicates ay hindi gumagawa ng panibagong module record at nali-link sa existing record kung eksaktong matukoy.
9. Ang posibleng duplicate na hindi pa tiyak ay ipinapadaan muna sa duplicate review.
10. Ang unmapped o hindi ligtas ma-parse na rows ay nananatili sa Inbox hanggang maitama ang mapping o parsing.
11. Walang duplicate module record kapag inulit ang scan o muling in-import ang parehong workbook.
12. Ang imported transaction ay hindi awtomatikong nagiging Approved; hiwalay ang business approval kung kailangan.
13. May source link ang bawat imported module record.
14. Hindi nababago ang existing records kapag may duplicate.
15. Nananatili sa module tables ang incomplete records; ang bawat calculation ay sumusunod sa sariling formula-specific input requirements.
16. Magkatugma ang outputs ng bagong calculation engine at original workbook sa lahat ng aprubadong parity test cases.
17. May audit trail para sa bawat Admin action.
18. Nananatiling buo ang data kapag nagkaroon ng scan/import interruption.

## 9. Mga desisyong kailangan pang kumpirmahin

1. Source method: XLSX upload ba o one-time authorized Google Sheets link scan?
2. Eksaktong latest workbook identity at version na gagamiting authoritative source sa bawat import.
3. Final module mapping at schema para sa bawat tab.
4. Aling records ang kailangan ng explicit approval bago maging operational.
5. Aling reference/master tabs ang dapat i-import at paano i-version ang mga ito.
6. Final Admin permissions at kung may higit sa isang Admin.
7. Final formula parity thresholds at rounding rules.

---

**Development rule:** Admin module muna ang bubuuin. Hindi muna sisimulan ang full module UI at operational forms hangga't hindi malinaw at nasusubukan ang Admin scanning, inbox, mapping, duplicate protection, automatic module insertion, incomplete-record handling, at formula verification workflow.
