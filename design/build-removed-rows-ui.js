const fs = require("fs");
const path = require("path");
const dir = "C:/Users/Rominick/Desktop/TFI_NEW/design";
const stamp = ".pre-removed-rows-20261120.bak";
function backup(name) {
  const src = path.join(dir, name), dst = src + stamp;
  if (fs.existsSync(src) && !fs.existsSync(dst)) fs.copyFileSync(src, dst);
}
[
  "reports-reconciliation-preview.html","schedule-summary-preview.html","summary-preview.html",
  "reports-reconciliation-ui.js","schedule-summary-ui.js","summary-ui.js",
  "reports-reconciliation.css","schedule-summary.css","summary.css","tfi-preview-router.js"
].forEach(backup);

const main = String.raw`<main class="content rr-content rm-content">
  <section class="rr-hero">
    <div class="rr-hero-copy">
      <span class="rr-eyebrow">REPORTS &amp; RECONCILIATION · ARCHIVE / EXCEPTION REGISTER</span>
      <h1>Removed Rows</h1>
      <p>Review records removed from the production-summary flow and retained for reference. These archived rows are not counted in Summary and must not be automatically restored to active production records.</p>
    </div>
    <div class="rr-hero-actions">
      <span class="rr-admin-tag"><i></i> ADMIN ACCESS ONLY</span>
      <button class="rr-btn rr-btn-primary" id="rm-import-open" type="button" aria-haspopup="dialog" aria-controls="rm-import-modal">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5M4 15v5h16v-5"/></svg>
        IMPORT SPREADSHEET
      </button>
    </div>
  </section>
  <nav class="rr-report-tabs" aria-label="Reports and reconciliation views">
    <button class="rr-report-tab" type="button" data-report-page="Reports">Production Summary</button>
    <button class="rr-report-tab" type="button" data-report-page="Schedule Summary">Schedule Summary</button>
    <button class="rr-report-tab" type="button" data-report-page="Summary">Summary</button>
    <button class="rr-report-tab active" type="button" data-report-page="Removed Rows" aria-current="page">Removed Rows</button>
  </nav>
  <div class="rr-source-meta" aria-label="Verified Removed Rows source details">
    <span><strong>OFFICIAL WORKBOOK</strong> <b id="rm-source-workbook">Copy of TFI - Production Monitoring Sheet 1</b></span>
    <span><strong>WORKSHEET</strong> <b id="rm-source-sheet">Removed Rows · sheetId 1842536867</b></span>
    <span><strong>STRUCTURE</strong> 18 SOURCE FIELDS · A:R</span>
    <span><strong>HEADER ROW</strong> ROW 3</span>
    <span><strong>DATA START</strong> ROW 4 · ARCHIVE / REFERENCE</span>
  </div>
  <section class="rr-kpi-grid" aria-label="Removed Rows archive metrics">
    <article class="rr-kpi"><div class="rr-kpi-top"><span class="rr-kpi-label">Archived rows</span><span class="rr-kpi-icon"><svg viewBox="0 0 24 24"><path d="M4 7h16v13H4zM3 4h18v3H3zM9 11h6"/></svg></span></div><div class="rr-kpi-value">—</div><div class="rr-kpi-note">Available after approved source connection</div></article>
    <article class="rr-kpi"><div class="rr-kpi-top"><span class="rr-kpi-label">Removal reasons</span><span class="rr-kpi-icon"><svg viewBox="0 0 24 24"><path d="M12 3 22 20H2zM12 9v5M12 17h.01"/></svg></span></div><div class="rr-kpi-value">—</div><div class="rr-kpi-note">Preserved from Removed because</div></article>
    <article class="rr-kpi"><div class="rr-kpi-top"><span class="rr-kpi-label">Old product codes</span><span class="rr-kpi-icon"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 9h10M7 13h6"/></svg></span></div><div class="rr-kpi-value">—</div><div class="rr-kpi-note">Kept as text; no code normalization</div></article>
    <article class="rr-kpi"><div class="rr-kpi-top"><span class="rr-kpi-label">Source references</span><span class="rr-kpi-icon"><svg viewBox="0 0 24 24"><path d="M4 5h16v14H4zM8 9h8M8 13h5"/></svg></span></div><div class="rr-kpi-value">—</div><div class="rr-kpi-note">Source Tab and Check retained</div></article>
  </section>
  <section class="rr-panel rr-filter-panel" aria-label="Removed Rows archive filters">
    <div class="rr-panel-head">
      <div><span class="rr-panel-kicker">ARCHIVE CONTROLS</span><h2>Find archived rows</h2><p>Search the removal reason, original product code, source tab, and preserved row details.</p></div>
      <div class="rr-filter-actions">
        <button class="rr-btn rr-btn-light" id="rm-reset" type="button">RESET FILTERS</button>
        <button class="rr-btn rr-btn-light" id="rm-export" type="button" disabled title="Available after approved archive records are connected"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v12m-5-5 5 5 5-5M4 20h16"/></svg>EXPORT CSV</button>
      </div>
    </div>
    <div class="rr-filter-grid rm-filter-grid">
      <label class="rr-field"><span>From date</span><input id="rm-from" type="date"></label>
      <label class="rr-field"><span>To date</span><input id="rm-to" type="date"></label>
      <label class="rr-field"><span>Removed because</span><input id="rm-reason" type="search" placeholder="Search removal reason" autocomplete="off"></label>
      <label class="rr-field"><span>Old product code</span><input id="rm-code" type="search" placeholder="Search old code" autocomplete="off"></label>
      <label class="rr-field"><span>Source tab</span><input id="rm-source-tab" type="search" placeholder="Search source tab" autocomplete="off"></label>
      <label class="rr-field rm-search-field"><span>Search all fields</span><input id="rm-search" type="search" placeholder="Search archived row details" autocomplete="off"></label>
    </div>
    <div class="rr-filter-foot"><span id="rm-filter-summary">No archived records are loaded in this preview.</span><span><strong>READ ONLY</strong> · ARCHIVE / EXCEPTION DATA</span></div>
  </section>
  <section class="rr-panel rr-table-panel" aria-label="Removed Rows archive register">
    <div class="rr-table-head">
      <div class="rr-table-head-copy"><strong>REMOVED ROWS ARCHIVE REGISTER</strong><span>Exact source column order A:R · Header row 3 · Data begins at row 4 · Scroll horizontally to view all 18 fields</span></div>
      <span class="rr-table-state"><i></i><b id="rm-record-state">ARCHIVE NOT CONNECTED</b></span>
    </div>
    <div class="rr-table-scroll rm-table-scroll" role="region" aria-label="Removed Rows source columns A through R" tabindex="0">
      <table class="rr-table rm-table" id="rm-table">
        <colgroup>
          <col style="width:112px"><col style="width:260px"><col style="width:170px"><col style="width:105px"><col style="width:100px"><col style="width:105px"><col style="width:85px"><col style="width:110px"><col style="width:110px"><col style="width:105px"><col style="width:135px"><col style="width:155px"><col style="width:110px"><col style="width:90px"><col style="width:90px"><col style="width:330px"><col style="width:125px"><col style="width:105px">
        </colgroup>
        <thead><tr class="rr-column-row">
          <th><button type="button" data-rm-sort="date">Date <span>↕</span></button></th>
          <th><button type="button" data-rm-sort="removedBecause">Removed because <span>↕</span></button></th>
          <th><button type="button" data-rm-sort="oldProductCode">Old Product Code (text) <span>↕</span></button></th>
          <th><button type="button" data-rm-sort="batches">No. of Batches <span>↕</span></button></th>
          <th><button type="button" data-rm-sort="target">Target <span>↕</span></button></th>
          <th><button type="button" data-rm-sort="produced">Produced <span>↕</span></button></th>
          <th><button type="button" data-rm-sort="uom">UOM <span>↕</span></button></th>
          <th><button type="button" data-rm-sort="planStart">Plan Start <span>↕</span></button></th>
          <th><button type="button" data-rm-sort="actualStart">Actual Start <span>↕</span></button></th>
          <th><button type="button" data-rm-sort="planEnd">Plan End <span>↕</span></button></th>
          <th><button type="button" data-rm-sort="actualEndProd">Actual End (Prod) <span>↕</span></button></th>
          <th><button type="button" data-rm-sort="actualEndCleaning">Actual End (Cleaning) <span>↕</span></button></th>
          <th><button type="button" data-rm-sort="manReqmt">Man Reqmt <span>↕</span></button></th>
          <th><button type="button" data-rm-sort="present">Present <span>↕</span></button></th>
          <th><button type="button" data-rm-sort="otHrs">OT Hrs <span>↕</span></button></th>
          <th><button type="button" data-rm-sort="remarks">Remarks <span>↕</span></button></th>
          <th class="rr-trace-head"><button type="button" data-rm-sort="sourceTab">Source Tab <span>↕</span></button></th>
          <th class="rr-trace-head"><button type="button" data-rm-sort="check">Check <span>↕</span></button></th>
        </tr></thead>
        <tbody id="rm-tbody"></tbody>
      </table>
    </div>
    <div class="rr-table-footer"><span id="rm-table-count">No archived rows are connected in this preview.</span><div class="rr-pagination"><button id="rm-prev" type="button" aria-label="Previous page" disabled>‹</button><span id="rm-page">—</span><button id="rm-next" type="button" aria-label="Next page" disabled>›</button></div></div>
  </section>
  <section class="rr-source-note"><span class="rr-note-icon">i</span><span><strong>Archive treatment:</strong> The source title identifies these rows as Pandayan / Others / Finishing overflow records kept for reference and not counted in Summary. Preserve the exact <strong>Removed because</strong> reason, <strong>Old Product Code (text)</strong>, <strong>Source Tab</strong>, and <strong>Check</strong> fields. Keep this archive separate from active production history. Do not automatically restore, delete, normalize, or merge archived rows into Production Summary.</span></section>
</main>`;

const modal = String.raw`<div class="rr-modal-backdrop" id="rm-import-modal" role="dialog" aria-modal="true" aria-labelledby="rm-modal-title" aria-hidden="true">
  <div class="rr-modal">
    <div class="rr-modal-head"><div><span class="rr-panel-kicker">ADMIN-ONLY ACTION</span><h3 id="rm-modal-title">Import Removed Rows Archive</h3></div><button class="rr-modal-close" id="rm-modal-close" type="button" aria-label="Close import dialog">×</button></div>
    <p>Paste the Google Sheets link for the source workbook. Removed Rows is an archive / exception source. Preserve its removal reason and source trace; do not automatically restore archived rows. Link validation checks URL format only.</p>
    <div class="rr-source-card"><strong>Copy of TFI - Production Monitoring Sheet 1</strong><span>Worksheet: Removed Rows · sheetId: 1842536867<br>Title row: 1 · Header row: 3 · First data row: 4<br>Source fields: A:R (18 fields) · Frozen rows: 3<br>Grid: 1,000 rows × 26 columns<br>Archive scope: Pandayan / Others / Finishing overflow · kept for reference, not counted in Summary<br>Spreadsheet ID: 1rCbQ16wj7MRjQCFF3tA-WEMkudraJK0RkwcqayUlz7k</span></div>
    <div class="rr-link-import" aria-label="Paste Google Sheets source link">
      <div class="rr-link-import-head"><div><strong>PASTE SPREADSHEET LINK</strong><span>Paste the Google Sheets URL for the source workbook.</span></div><span class="rr-link-badge">GOOGLE SHEETS</span></div>
      <label class="rr-link-label" for="rm-spreadsheet-link">Google Sheets URL</label>
      <div class="rr-link-input-row"><input id="rm-spreadsheet-link" type="url" inputmode="url" placeholder="https://docs.google.com/spreadsheets/d/..." autocomplete="off" aria-describedby="rm-link-feedback"><button class="rr-btn rr-btn-light" id="rm-link-validate" type="button">VALIDATE LINK</button></div>
      <div class="rr-link-feedback" id="rm-link-feedback" role="status" aria-live="polite">Paste a Google Sheets link, then select Validate Link.</div>
      <div class="rr-link-id" id="rm-link-id" hidden><span>DETECTED SPREADSHEET ID</span><code id="rm-link-id-value"></code></div>
    </div>
    <div class="rr-modal-warning"><strong>!</strong><span>No source link has been validated yet. No data has been scanned or imported, and no archived rows are being restored. The original workbook and active production records remain unchanged.</span></div>
    <div class="rr-modal-actions"><button class="rr-btn rr-btn-light" id="rm-modal-dismiss" type="button">CLOSE</button><button class="rr-btn rr-btn-primary" type="button" disabled title="Archive import workflow will be connected in a later phase">IMPORT NOT CONNECTED</button></div>
  </div>
</div>
<div id="rm-toast" class="toast" hidden></div>`;

let template = fs.readFileSync(path.join(dir, "summary-preview.html"), "utf8");
template = template.replace("<title>TFI | Summary</title>", "<title>TFI | Removed Rows</title>");
template = template.replace('<link rel="stylesheet" href="summary.css">', '<link rel="stylesheet" href="removed-rows.css">');
template = template.replace("</span><b>Summary</b></div>", "</span><b>Removed Rows</b></div>");
const mainStart = template.indexOf('<main class="content rr-content sum-content">');
const mainEnd = template.indexOf("</main>", mainStart) + "</main>".length;
if (mainStart < 0 || mainEnd < "</main>".length) throw new Error("Summary main content boundaries not found.");
template = template.slice(0, mainStart) + main + template.slice(mainEnd);
const modalStart = template.indexOf('<div class="rr-modal-backdrop" id="sum-import-modal"');
const toastEndText = '<div id="sum-toast" class="toast" hidden></div>';
const modalEnd = template.indexOf(toastEndText, modalStart) + toastEndText.length;
if (modalStart < 0 || modalEnd < toastEndText.length) throw new Error("Summary modal boundaries not found.");
template = template.slice(0, modalStart) + modal + template.slice(modalEnd);
template = template.replace('<script src="summary-ui.js"></script>', '<script src="removed-rows-ui.js"></script>');
fs.writeFileSync(path.join(dir, "removed-rows-preview.html"), template, "utf8");

const js = String.raw`(() => {
  "use strict";
  const SOURCE = Object.freeze({
    workbook: "Copy of TFI - Production Monitoring Sheet 1",
    spreadsheetId: "1rCbQ16wj7MRjQCFF3tA-WEMkudraJK0RkwcqayUlz7k",
    worksheet: "Removed Rows",
    sheetId: 1842536867,
    titleRow: 1, headerRow: 3, firstDataRow: 4,
    gridRows: 1000, gridColumns: 26, frozenRows: 3,
    inspectedRange: "A4:R1000",
    columns: [
      ["date","Date","date"],["removedBecause","Removed because","text"],
      ["oldProductCode","Old Product Code (text)","text"],["batches","No. of Batches","number"],
      ["target","Target","number"],["produced","Produced","number"],["uom","UOM","text"],
      ["planStart","Plan Start","time"],["actualStart","Actual Start","time"],["planEnd","Plan End","time"],
      ["actualEndProd","Actual End (Prod)","time"],["actualEndCleaning","Actual End (Cleaning)","time"],
      ["manReqmt","Man Reqmt","number"],["present","Present","number"],["otHrs","OT Hrs","number"],
      ["remarks","Remarks","text"],["sourceTab","Source Tab","text"],["check","Check","text"]
    ]
  });
  const state = {page:1,pageSize:10,sortKey:"",sortDirection:1,filters:{}};
  const $ = id => document.getElementById(id);
  const clean = value => String(value ?? "").trim();
  const lower = value => clean(value).toLocaleLowerCase();
  const records = [];

  function openImportModal() {
    $("rm-import-modal").classList.add("open");
    $("rm-import-modal").setAttribute("aria-hidden","false");
    $("rm-modal-close").focus();
  }
  function closeImportModal() {
    $("rm-import-modal").classList.remove("open");
    $("rm-import-modal").setAttribute("aria-hidden","true");
    $("rm-import-open").focus();
  }
  function spreadsheetIdFromUrl(raw) {
    try {
      const url = new URL(raw);
      if (url.protocol !== "https:" || url.hostname.toLowerCase() !== "docs.google.com") return "";
      const match = url.pathname.match(/^\\/spreadsheets\\/(?:u\\/\\d+\\/)?d\\/([A-Za-z0-9_-]+)/);
      return match ? match[1] : "";
    } catch (_) { return ""; }
  }
  function bindSpreadsheetLink() {
    const input = $("rm-spreadsheet-link"), button = $("rm-link-validate");
    const feedback = $("rm-link-feedback"), idBox = $("rm-link-id"), idValue = $("rm-link-id-value");
    input.addEventListener("input", () => {
      input.setAttribute("aria-invalid","false");
      feedback.className = "rr-link-feedback";
      feedback.textContent = "Link changed. Select Validate Link to check its URL format.";
      idBox.hidden = true; idValue.textContent = "";
      document.body.dataset.tfiSpreadsheetLinkStatus = "pending";
      delete document.body.dataset.tfiDetectedSpreadsheetId;
    });
    button.addEventListener("click", () => {
      const raw = clean(input.value);
      if (!raw) {
        input.setAttribute("aria-invalid","true");
        feedback.className = "rr-link-feedback is-invalid";
        feedback.textContent = "Paste a Google Sheets URL first.";
        idBox.hidden = true;
        document.body.dataset.tfiSpreadsheetLinkStatus = "empty";
        input.focus(); return;
      }
      const id = spreadsheetIdFromUrl(raw);
      if (!id) {
        input.setAttribute("aria-invalid","true");
        feedback.className = "rr-link-feedback is-invalid";
        feedback.textContent = "That link format is not recognized. Paste the full Google Sheets URL beginning with https://docs.google.com/spreadsheets/d/.";
        idBox.hidden = true; idValue.textContent = "";
        document.body.dataset.tfiSpreadsheetLinkStatus = "invalid";
        delete document.body.dataset.tfiDetectedSpreadsheetId; return;
      }
      input.setAttribute("aria-invalid","false");
      feedback.className = "rr-link-feedback is-valid";
      feedback.textContent = "Link format looks valid. Access permissions and sheet contents have not been checked.";
      idValue.textContent = id; idBox.hidden = false;
      document.body.dataset.tfiSpreadsheetLinkStatus = "valid";
      document.body.dataset.tfiDetectedSpreadsheetId = id;
    });
  }
  function navigateReport(page) {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({type:"TFI_NAVIGATE_MODULE",page},"*"); return;
    }
    const routes = {"Production Summary":"Reports","Schedule Summary":"Schedule Summary","Summary":"Summary","Removed Rows":"Removed Rows"};
    const module = routes[page] || "Reports";
    window.location.assign("dashboard-preview.html?module=" + encodeURIComponent(module));
  }
  function activeFilters() {
    return {
      from:$("rm-from").value,to:$("rm-to").value,
      reason:lower($("rm-reason").value),code:lower($("rm-code").value),
      sourceTab:lower($("rm-source-tab").value),query:lower($("rm-search").value)
    };
  }
  function parseSourceDate(value) {
    const raw = clean(value);
    if (!raw) return "";
    if (/^\\d{4}-\\d{2}-\\d{2}$/.test(raw)) return raw;
    const match = raw.match(/^(\\d{1,2})-([A-Za-z]{3})-(\\d{2}|\\d{4})$/);
    if (!match) return "";
    const months = {jan:"01",feb:"02",mar:"03",apr:"04",may:"05",jun:"06",jul:"07",aug:"08",sep:"09",oct:"10",nov:"11",dec:"12"};
    const month = months[match[2].toLowerCase()];
    if (!month) return "";
    let year = Number(match[3]);
    if (match[3].length === 2) year += year < 50 ? 2000 : 1900;
    return String(year).padStart(4,"0")+"-"+month+"-"+match[1].padStart(2,"0");
  }
  function renderEmpty() {
    const tr = document.createElement("tr"), td = document.createElement("td");
    td.colSpan = SOURCE.columns.length; td.className = "rr-empty-cell";
    const wrap = document.createElement("div"); wrap.className = "rr-empty-state";
    const icon = document.createElement("div"); icon.className = "rr-empty-icon"; icon.textContent = "▤";
    const title = document.createElement("strong"); title.textContent = "No archived rows connected";
    const detail = document.createElement("span");
    detail.textContent = "The official Removed Rows worksheet is a reference archive excluded from Summary. No historical rows or sample records are loaded in this preview.";
    wrap.append(icon,title,detail); td.appendChild(wrap); tr.appendChild(td); $("rm-tbody").appendChild(tr);
  }
  function renderTable(rows) {
    const total = rows.length, pages = Math.max(1,Math.ceil(total/state.pageSize));
    state.page = Math.min(state.page,pages);
    const start = (state.page-1)*state.pageSize, visible = rows.slice(start,start+state.pageSize);
    const body = $("rm-tbody"); body.replaceChildren();
    if (!visible.length) renderEmpty();
    else visible.forEach(record => {
      const tr = document.createElement("tr");
      SOURCE.columns.forEach(([key,label,type],index) => {
        const td = document.createElement("td");
        td.textContent = record[key] === null || record[key] === undefined ? "" : String(record[key]);
        if (type === "number") td.classList.add("rr-numeric");
        if (type === "date" || type === "time") td.classList.add("rr-center");
        if (index === 1) td.classList.add("rm-reason");
        if (index === 2) td.classList.add("rm-old-code");
        if (index >= 16) td.classList.add("rr-trace");
        tr.appendChild(td);
      });
      body.appendChild(tr);
    });
    $("rm-table-count").textContent = total ? "Showing "+(start+1)+"–"+Math.min(start+state.pageSize,total)+" of "+total+" archived rows" : "No archived rows match the current filters.";
    $("rm-page").textContent = total ? state.page+" / "+pages : "—";
    $("rm-prev").disabled = !total || state.page <= 1;
    $("rm-next").disabled = !total || state.page >= pages;
    $("rm-export").disabled = !total;
    $("rm-record-state").textContent = total ? total+" ARCHIVED ROWS" : "ARCHIVE NOT CONNECTED";
    $("rm-filter-summary").textContent = total ? total+" archived row(s) match the current filters." : "No archived records are loaded in this preview.";
    document.querySelectorAll("[data-rm-sort]").forEach(button => {
      const active = button.dataset.rmSort === state.sortKey;
      button.closest("th").setAttribute("aria-sort",active?(state.sortDirection===1?"ascending":"descending"):"none");
      button.querySelector("span").textContent = active?(state.sortDirection===1?"↑":"↓"):"↕";
    });
  }
  function filterRecords() {
    state.filters = activeFilters();
    let rows = records.filter(record => {
      const date = parseSourceDate(record.date);
      if (state.filters.from && (!date || date < state.filters.from)) return false;
      if (state.filters.to && (!date || date > state.filters.to)) return false;
      if (state.filters.reason && !lower(record.removedBecause).includes(state.filters.reason)) return false;
      if (state.filters.code && !lower(record.oldProductCode).includes(state.filters.code)) return false;
      if (state.filters.sourceTab && !lower(record.sourceTab).includes(state.filters.sourceTab)) return false;
      if (state.filters.query && !SOURCE.columns.some(([key]) => lower(record[key]).includes(state.filters.query))) return false;
      return true;
    });
    if (state.sortKey) rows.sort((a,b) => String(a[state.sortKey]??"").localeCompare(String(b[state.sortKey]??""),undefined,{numeric:true,sensitivity:"base"})*state.sortDirection);
    state.page = 1; renderTable(rows);
    document.body.dataset.tfiFilterState = Object.values(state.filters).some(Boolean) ? "active" : "clear";
  }
  function resetFilters() {
    ["rm-from","rm-to","rm-reason","rm-code","rm-source-tab","rm-search"].forEach(id => { $(id).value = ""; });
    state.sortKey = ""; state.sortDirection = 1; filterRecords();
  }
  function exportCsv() {
    if (!records.length) return;
    const escape = value => '"'+String(value??"").replace(/"/g,'""')+'"';
    const lines = [SOURCE.columns.map(([,label])=>escape(label)).join(","),...records.map(record=>SOURCE.columns.map(([key])=>escape(record[key])).join(","))];
    const blob = new Blob(["\\uFEFF"+lines.join("\\r\\n")],{type:"text/csv;charset=utf-8"});
    const url = URL.createObjectURL(blob), anchor = document.createElement("a");
    anchor.href = url; anchor.download = "removed-rows-archive.csv"; anchor.click(); URL.revokeObjectURL(url);
  }
  function init() {
    document.querySelectorAll("[data-report-page]").forEach(button => button.addEventListener("click",()=>navigateReport(button.dataset.reportPage)));
    bindSpreadsheetLink();
    $("rm-import-open").addEventListener("click",openImportModal);
    $("rm-modal-close").addEventListener("click",closeImportModal);
    $("rm-modal-dismiss").addEventListener("click",closeImportModal);
    $("rm-import-modal").addEventListener("click",event=>{if(event.target===$("rm-import-modal"))closeImportModal();});
    document.addEventListener("keydown",event=>{if(event.key==="Escape"&&$("rm-import-modal").classList.contains("open"))closeImportModal();});
    ["rm-from","rm-to","rm-reason","rm-code","rm-source-tab","rm-search"].forEach(id=>{ $(id).addEventListener("input",filterRecords); $(id).addEventListener("change",filterRecords); });
    document.querySelectorAll("[data-rm-sort]").forEach(button=>button.addEventListener("click",()=>{
      if(state.sortKey===button.dataset.rmSort)state.sortDirection*=-1;else{state.sortKey=button.dataset.rmSort;state.sortDirection=1;}filterRecords();
    }));
    $("rm-reset").addEventListener("click",resetFilters);
    $("rm-export").addEventListener("click",exportCsv);
    $("rm-prev").addEventListener("click",()=>{state.page--;renderTable(records);});
    $("rm-next").addEventListener("click",()=>{state.page++;renderTable(records);});
    filterRecords();
    $("rm-source-workbook").textContent=SOURCE.workbook;
    $("rm-source-sheet").textContent=SOURCE.worksheet+" · sheetId "+SOURCE.sheetId;
    document.body.dataset.tfiReady="true";
    document.body.dataset.tfiReport="removed-rows";
    document.body.dataset.tfiSourceSheetId=String(SOURCE.sheetId);
    document.body.dataset.tfiColumns=String(SOURCE.columns.length);
    document.body.dataset.tfiTitleRow=String(SOURCE.titleRow);
    document.body.dataset.tfiHeaderRow=String(SOURCE.headerRow);
    document.body.dataset.tfiFirstDataRow=String(SOURCE.firstDataRow);
    document.body.dataset.tfiFrozenRows=String(SOURCE.frozenRows);
    document.body.dataset.tfiInspectedSourceRange=SOURCE.inspectedRange;
    document.body.dataset.tfiNoMock="true";
    document.body.dataset.tfiAdminImportEntry="true";
    document.body.dataset.tfiArchiveOnly="true";
  }
  document.addEventListener("DOMContentLoaded",init);
})();`;

fs.writeFileSync(path.join(dir,"removed-rows-ui.js"),js,"utf8");
const css = String.raw`/* Removed Rows archive view — inherits shared Reports & Reconciliation shell */
.rm-table{min-width:2450px;table-layout:fixed}
.rm-table thead tr.rr-column-row th{top:0;height:64px;padding:6px 5px}
.rm-table thead tr.rr-column-row th.rr-trace-head{background:#eaf0f2;color:#4b6570}
.rm-table thead tr.rr-column-row th button{min-height:48px}
.rm-table tbody td{height:42px}
.rm-table tbody td.rm-reason{white-space:normal;min-width:260px;line-height:1.4;color:#765a2e}
.rm-table tbody td.rm-old-code{font-weight:800;color:#284e43;letter-spacing:.1px}
.rm-table tbody td.rr-trace{background:#f2f6f7;color:#627a82}
.rm-filter-grid{grid-template-columns:repeat(6,minmax(0,1fr))}
.rm-search-field{grid-column:span 1}
.rm-table-scroll{max-height:650px}
.rm-content .rr-kpi-grid{grid-template-columns:repeat(4,minmax(0,1fr))}
.rm-content .rr-kpi-value{color:#476a56}
.rm-content .rr-hero{border-color:#dce8df}
.rm-content .rr-source-meta{row-gap:10px}
.rm-content .rr-table-state i{background:#b99b62}
.rm-content .rr-source-note{border-color:#eadfc8;background:#fffdf8}
.rm-content .rr-note-icon{background:#f5edda;color:#8a6a2e}
@media(max-width:1300px){.rm-filter-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.rm-search-field{grid-column:span 3}}
@media(max-width:900px){.rm-filter-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.rm-search-field{grid-column:span 2}.rm-content .rr-kpi-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:620px){
  .rr-report-tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));width:100%;overflow:visible}
  .rr-report-tab{min-width:0;flex:none;padding:7px 4px;font-size:8px;line-height:1.2;white-space:normal;text-align:center}
  .rm-filter-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
  .rm-search-field{grid-column:span 2}
  .rm-table-scroll{max-height:560px}
  .rm-content .rr-kpi-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
}`;
fs.writeFileSync(path.join(dir,"removed-rows.css"),css,"utf8");

function patchFile(name, transform, label) {
  const file=path.join(dir,name); const text=fs.readFileSync(file,"utf8"); const next=transform(text);
  if(next===text)console.log("UNCHANGED "+label);else{fs.writeFileSync(file,next,"utf8");console.log("PATCHED "+label);}
}
const removedTab='<button class="rr-report-tab" type="button" data-report-page="Removed Rows">Removed Rows</button>';
function addTab(text,marker,label){
  if(text.includes('data-report-page="Removed Rows"'))return text;
  if(!text.includes(marker))throw new Error(label+" tab insertion marker missing");
  return text.replace(marker,marker+"\n    "+removedTab);
}
patchFile("reports-reconciliation-preview.html",t=>{
  t=addTab(t,'<button class="rr-report-tab" type="button" data-report-page="Summary">Summary</button>',"Production Summary");
  return t.replace(/\.rr-report-tabs\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/g,'.rr-report-tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr))');
},"reports-reconciliation-preview.html");
patchFile("schedule-summary-preview.html",t=>addTab(t,'<button class="rr-report-tab" type="button" data-report-page="Summary">Summary</button>',"Schedule Summary"),"schedule-summary-preview.html");
patchFile("summary-preview.html",t=>addTab(t,'<button class="rr-report-tab active" type="button" data-report-page="Summary" aria-current="page">Summary</button>',"Summary"),"summary-preview.html");
const routeExpr='const url = page === "Schedule Summary"\n      ? "dashboard-preview.html?module=Schedule%20Summary"\n      : page === "Summary"\n        ? "dashboard-preview.html?module=Summary"\n        : "dashboard-preview.html?module=Reports";\n    window.location.assign(url);';
const routeNew='const routes = {"Production Summary":"Reports","Schedule Summary":"Schedule Summary","Summary":"Summary","Removed Rows":"Removed Rows"};\n    const module = routes[page] || "Reports";\n    window.location.assign("dashboard-preview.html?module=" + encodeURIComponent(module));';
for(const name of ["reports-reconciliation-ui.js","schedule-summary-ui.js","summary-ui.js"]){
  patchFile(name,t=>{if(t.includes(routeNew))return t;if(!t.includes(routeExpr))throw new Error(name+" route expression not found");return t.replace(routeExpr,routeNew);},name);
}
patchFile("tfi-preview-router.js",t=>{
  if(t.includes('"removed rows":"removed-rows-preview.html"'))return t;
  const marker='    "summary":"summary-preview.html",';
  if(!t.includes(marker))throw new Error("Router Summary route not found");
  return t.replace(marker,marker+'\n    "removed rows":"removed-rows-preview.html",');
},"tfi-preview-router.js");
patchFile("reports-reconciliation.css",t=>t.replace(/\.rr-report-tabs\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/g,'.rr-report-tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr))'),"reports-reconciliation.css");
for(const name of ["schedule-summary.css","summary.css"]){
  patchFile(name,t=>t+'\n/* Four report views, including the archive. */\n@media(max-width:620px){.rr-report-tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));width:100%;overflow:visible}.rr-report-tab{min-width:0;flex:none;padding:7px 4px;font-size:8px;line-height:1.2;white-space:normal;text-align:center}}\n',name);
}
console.log("Removed Rows UI generated; source pages backed up before edits.");
