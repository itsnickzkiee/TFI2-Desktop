(() => {
  "use strict";
  const SOURCE = Object.freeze({
    workbook: "Copy of TFI - Production Monitoring Sheet",
    spreadsheetId: "1hWOI55iRBSltQnRY4S7eObnMBLstFYCPxiAp-l1UUfc",
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
  const state = {page:1,pageSize:10,sortKey:"",sortDirection:1,filters:{},filteredRows:[]};
  const $ = id => document.getElementById(id);
  const clean = value => String(value ?? "").trim();
  const lower = value => clean(value).toLocaleLowerCase();
  let records = [];
  let status = "loading";
  let loadError = "";
  const sourceRef = record => record.sourceTab || record.check;

  async function loadArchive() {
    if (location.protocol === "file:") {
      status = "ready";
      filterRecords();
      return;
    }
    try {
      const response = await fetch("/api/reports/removed-rows", { credentials: "same-origin", cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Could not load the archive.");
      if (!Array.isArray(payload.records)) throw new Error("The archive response could not be read.");
      records = payload.records;
      status = "ready";
      if (payload.captured_at) {
        const timestamp = new Date(payload.captured_at);
        const date = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeZone: "Asia/Manila" }).format(timestamp);
        $("rm-snapshot").textContent = "Snapshot captured " + date;
      }
    } catch (error) {
      status = "error";
      loadError = error.message;
    }
    filterRecords();
  }

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
    const parts = raw.split("-");
    if (parts.length !== 3) return "";
    if (parts[0].length === 4 && parts[1].length === 2 && parts[2].length === 2 && parts.every(part => Number.isInteger(Number(part)))) return raw;
    const day = Number(parts[0]), monthText = parts[1].toLowerCase(), yearText = parts[2];
    const months = {jan:"01",feb:"02",mar:"03",apr:"04",may:"05",jun:"06",jul:"07",aug:"08",sep:"09",oct:"10",nov:"11",dec:"12"};
    const month = months[monthText];
    if (!month || !Number.isInteger(day) || day < 1 || day > 31 || !Number.isInteger(Number(yearText)) || (yearText.length !== 2 && yearText.length !== 4)) return "";
    let year = Number(yearText);
    if (yearText.length === 2) year += year < 50 ? 2000 : 1900;
    return String(year).padStart(4,"0")+"-"+month+"-"+String(day).padStart(2,"0");
  }
  function renderEmpty() {
    const tr = document.createElement("tr"), td = document.createElement("td");
    td.colSpan = SOURCE.columns.length; td.className = "rr-empty-cell";
    const wrap = document.createElement("div"); wrap.className = "rr-empty-state";
    const icon = document.createElement("div"); icon.className = "rr-empty-icon"; icon.textContent = "▤";
    const title = document.createElement("strong");
    title.textContent = status === "loading" ? "Loading archive" : status === "error" ? "Archive unavailable" :
      records.length ? "No archived rows match the filters" : "The archive is empty";
    const detail = document.createElement("span");
    detail.textContent = status === "error" ? loadError : "";
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
    $("rm-record-state").textContent = status === "ready" ? total+" ARCHIVED ROWS" : status === "loading" ? "LOADING" : "UNAVAILABLE";
    $("rm-filter-summary").textContent = status === "ready" ? total+" archived row(s) match the current filters." : "";
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
    if (state.sortKey) rows.sort((a,b) => {
      const key = state.sortKey;
      const left = key === "date" ? parseSourceDate(a[key]) : clean(a[key]);
      const right = key === "date" ? parseSourceDate(b[key]) : clean(b[key]);
      return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" }) * state.sortDirection;
    });
    const counts = [rows.length, ...["removedBecause","oldProductCode"].map(key =>
      new Set(rows.map(record => record[key]).filter(Boolean)).size
    ), rows.filter(sourceRef).length];
    document.querySelectorAll(".rr-kpi-value").forEach((node, index) => {
      node.textContent = status === "ready" ? counts[index].toLocaleString() : "—";
    });
    state.page = 1; state.filteredRows = rows; renderTable(rows);
    document.body.dataset.tfiFilterState = Object.values(state.filters).some(Boolean) ? "active" : "clear";
  }
  function resetFilters() {
    ["rm-from","rm-to","rm-reason","rm-code","rm-source-tab","rm-search"].forEach(id => { $(id).value = ""; });
    state.sortKey = ""; state.sortDirection = 1; filterRecords();
  }
  function exportCsv() {
    const rows = state.filteredRows;
    if (!rows.length) return;
    const escape = value => {
      let text = String(value ?? "");
      if (/^[\s\uFEFF]*[=+@-]|^[\t\r\n]/.test(text)) text = "'" + text;
      return '"' + text.replaceAll('"', '""') + '"';
    };
    const lines = [SOURCE.columns.map(([,label])=>escape(label)).join(","),...rows.map(record=>SOURCE.columns.map(([key])=>escape(record[key])).join(","))];
    const blob = new Blob([String.fromCharCode(65279)+lines.join(String.fromCharCode(13,10))],{type:"text/csv;charset=utf-8"});
    const url = URL.createObjectURL(blob), anchor = document.createElement("a");
    anchor.href = url; anchor.download = "removed-rows-archive.csv"; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 0);
  }
  function init() {
    document.querySelectorAll("[data-report-page]").forEach(button => button.addEventListener("click",()=>navigateReport(button.dataset.reportPage)));
    $("rm-workbook-link").href = "https://docs.google.com/spreadsheets/d/" + SOURCE.spreadsheetId + "/edit?gid=" + SOURCE.sheetId;
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
    $("rm-prev").addEventListener("click",()=>{state.page--;renderTable(state.filteredRows);});
    $("rm-next").addEventListener("click",()=>{state.page++;renderTable(state.filteredRows);});
    filterRecords();
    void loadArchive();
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
    document.body.dataset.tfiArchiveOnly="true";
  }
  document.addEventListener("DOMContentLoaded",init);
})();