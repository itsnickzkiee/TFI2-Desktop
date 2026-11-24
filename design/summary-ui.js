(() => {
  "use strict";
  const SOURCE = Object.freeze({
    workbook: "Copy of TFI - Production Monitoring Sheet 1",
    spreadsheetId: "1rCbQ16wj7MRjQCFF3tA-WEMkudraJK0RkwcqayUlz7k",
    worksheet: "Summary",
    sheetId: 1639151211,
    headerRows: [1,2,3],
    firstDataRow: 4,
    gridRows: 1201,
    gridColumns: 32,
    frozenRows: 3,
    formulaSource: "Product Entry",
    columns: [
      ["dateProduce","Date produce","text"],["productCode","Product code","text"],["canSize","Can Size","text"],["pr","PR#","text"],
      ["batches","No. of Batches","number"],["totalFg","Total FG","number"],["dented","Dented","number"],["falseSeam","False seam","number"],
      ["flipper","Flipper","number"],["bulged","Bulged","number"],["panel","Panel","number"],["buckling","Buckling","number"],
      ["retention","Retention","number"],["qaSamples","Q.A Samples","number"],["dentedCurl","Dented/ Curl","number"],["canTeardown","Teardown","number"],
      ["underweightCan","From Underweight","number"],["rusty","Rusty","number"],["emptyCanTeardown","Teardown","number"],["seamerDented","Dented from seamer","number"],
      ["fillerDented","Dented from filler","number"],["underweight","Underweight","number"],["dentedFlange","Dented flange (SD)","number"],
      ["canWasherPalletizer","Can wshr/ Palletizer (SD)/ Dented Body/Rusty","number"],["lidsReject","%Lids Reject","percent"],
      ["emptyCanReject","% Empty Can Reject","percent"],["dentedPct","%Dented","percent"],["falseSeamPct","%False seam","percent"],
      ["flipperPct","%Flipper","percent"],["bulgedPct","%Bulged","percent"],["panelPct","%Panel","percent"],["bucklingPct","%Buckling","percent"]
    ]
  });
  const state = { page: 1, pageSize: 10, sortKey: "", sortDirection: 1, filters: {} };
  const $ = id => document.getElementById(id);
  const clean = value => String(value ?? "").trim();
  const lower = value => clean(value).toLocaleLowerCase();
  let records = [];
  let filteredRows = [];
  let loadStatus = "loading";
  let errorMessage = "";
  let refreshAgain = false;
  let loading = false;
  const numberFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
  const percentFormat = new Intl.NumberFormat(undefined, { style: "percent", maximumFractionDigits: 2 });

  function cellText(value, type) {
    if (value == null) return "";
    if (type === "percent") return percentFormat.format(value);
    if (type === "number") return numberFormat.format(value);
    return String(value);
  }

  async function refreshRecords() {
    if (location.protocol === "file:") {
      loadStatus = "ready";
      filterRecords(false);
      return;
    }
    if (loading) {
      refreshAgain = true;
      return;
    }
    loading = true;
    try {
      const loaded = [];
      let offset = 0;
      do {
        const response = await fetch("/api/reports/summary?offset=" + offset, {
          credentials: "same-origin", cache: "no-store", headers: { Accept: "application/json" }
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || "Could not load Product Entry records.");
        if (!Array.isArray(payload.records)) throw new Error("Summary records could not be read.");
        loaded.push(...payload.records);
        offset = payload.next_offset;
      } while (offset != null);
      records = loaded;
      loadStatus = "ready";
    } catch (error) {
      records = [];
      loadStatus = "error";
      errorMessage = error.message;
    } finally {
      loading = false;
      filterRecords(false);
      if (refreshAgain) {
        refreshAgain = false;
        void refreshRecords();
      }
    }
  }

  function renderMetrics(rows) {
    $("sum-kpi-records").textContent = loadStatus === "ready" ? numberFormat.format(rows.length) : "—";
    for (const [id, key] of [["sum-kpi-fg","totalFg"], ["sum-kpi-batches","batches"], ["sum-kpi-qa","qaSamples"]]) {
      const amounts = rows.map(row => row[key]).filter(Number.isFinite);
      $(id).textContent = amounts.length ? numberFormat.format(amounts.reduce((total, value) => total + value, 0)) : "—";
      $(id + "-coverage").textContent = rows.length ? numberFormat.format(amounts.length) + " of " + numberFormat.format(rows.length) + " records have a value" : "—";
    }
  }

  function exportFilteredRows() {
    const quote = value => {
      let text = String(value ?? "");
      if (typeof value === "string" && /^[\s\uFEFF]*[=+@-]|^[\t\r\n]/.test(text)) text = "'" + text;
      return '"' + text.replaceAll('"', '""') + '"';
    };
    const lines = [SOURCE.columns.map(([, label]) => quote(label)).join(",")];
    for (const row of filteredRows) {
      lines.push(SOURCE.columns.map(([key,,type]) =>
        quote(type === "percent" ? cellText(row[key], type) : row[key])
      ).join(","));
    }
    const url = URL.createObjectURL(new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "product-entry-summary.csv";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function openImportModal() {
    $("sum-import-modal").classList.add("open");
    $("sum-import-modal").setAttribute("aria-hidden", "false");
    $("sum-modal-close").focus();
  }
  function closeImportModal() {
    $("sum-import-modal").classList.remove("open");
    $("sum-import-modal").setAttribute("aria-hidden", "true");
    $("sum-import-open").focus();
  }
  function spreadsheetIdFromUrl(raw) {
    try {
      const url = new URL(raw);
      if (url.protocol !== "https:" || url.hostname.toLowerCase() !== "docs.google.com") return "";
      const match = url.pathname.match(/^\/spreadsheets\/(?:u\/\d+\/)?d\/([A-Za-z0-9_-]+)/);
      return match ? match[1] : "";
    } catch (_) { return ""; }
  }
  function bindSpreadsheetLink(prefix) {
    const input = $(prefix + "-spreadsheet-link");
    const button = $(prefix + "-link-validate");
    const feedback = $(prefix + "-link-feedback");
    const idBox = $(prefix + "-link-id");
    const idValue = $(prefix + "-link-id-value");
    const reset = () => {
      input.setAttribute("aria-invalid", "false");
      feedback.className = "rr-link-feedback";
      feedback.textContent = "Link changed. Select Validate Link to check its URL format.";
      idBox.hidden = true;
      idValue.textContent = "";
      document.body.dataset.tfiSpreadsheetLinkStatus = "pending";
    };
    input.addEventListener("input", reset);
    button.addEventListener("click", () => {
      const raw = clean(input.value);
      if (!raw) {
        input.setAttribute("aria-invalid", "true");
        feedback.className = "rr-link-feedback is-invalid";
        feedback.textContent = "Paste a Google Sheets URL first.";
        idBox.hidden = true;
        document.body.dataset.tfiSpreadsheetLinkStatus = "empty";
        input.focus();
        return;
      }
      const id = spreadsheetIdFromUrl(raw);
      if (!id) {
        input.setAttribute("aria-invalid", "true");
        feedback.className = "rr-link-feedback is-invalid";
        feedback.textContent = "That link format is not recognized. Paste the full Google Sheets URL beginning with https://docs.google.com/spreadsheets/d/.";
        idBox.hidden = true;
        idValue.textContent = "";
        document.body.dataset.tfiSpreadsheetLinkStatus = "invalid";
        return;
      }
      input.setAttribute("aria-invalid", "false");
      feedback.className = "rr-link-feedback is-valid";
      feedback.textContent = "Link format looks valid. Access permissions and sheet contents have not been checked.";
      idValue.textContent = id;
      idBox.hidden = false;
      document.body.dataset.tfiSpreadsheetLinkStatus = "valid";
      document.body.dataset.tfiDetectedSpreadsheetId = id;
    });
  }
  function navigateReport(page) {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: "TFI_NAVIGATE_MODULE", page }, "*");
      return;
    }
    const routes = {"Production Summary":"Reports","Schedule Summary":"Schedule Summary","Summary":"Summary","Removed Rows":"Removed Rows"};
    const module = routes[page] || "Reports";
    window.location.assign("dashboard-preview.html?module=" + encodeURIComponent(module));
  }
  function activeFilters() {
    return {
      date: lower($("sum-filter-date").value),
      code: lower($("sum-filter-code").value),
      can: lower($("sum-filter-can").value),
      pr: lower($("sum-filter-pr").value),
      query: lower($("sum-search").value)
    };
  }
  function renderEmpty() {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = SOURCE.columns.length;
    td.className = "rr-empty-cell";
    const wrap = document.createElement("div");
    wrap.className = "rr-empty-state";
    const icon = document.createElement("div");
    icon.className = "rr-empty-icon";
    icon.textContent = "▤";
    const title = document.createElement("strong");
    title.textContent = loadStatus === "error" ? "Summary unavailable" :
      loadStatus === "loading" ? "Loading Summary" : records.length ? "No records match the filters" : "No saved Product Entry records";
    const detail = document.createElement("span");
    detail.textContent = loadStatus === "error" ? errorMessage :
      loadStatus === "ready" && !records.length ? "Summary will show saved Product Entry rows with a product code." : "";
    wrap.append(icon, title, detail);
    td.appendChild(wrap);
    tr.appendChild(td);
    $("sum-tbody").appendChild(tr);
  }
  function renderTable(rows) {
    const total = rows.length;
    const pages = Math.max(1, Math.ceil(total / state.pageSize));
    state.page = Math.min(state.page, pages);
    const start = (state.page - 1) * state.pageSize;
    const visible = rows.slice(start, start + state.pageSize);
    const body = $("sum-tbody");
    body.replaceChildren();
    if (!visible.length) renderEmpty();
    else visible.forEach(record => {
      const tr = document.createElement("tr");
      SOURCE.columns.forEach(([key,label,type]) => {
        const td = document.createElement("td");
        td.textContent = cellText(record[key], type);
        if (type === "number") td.classList.add("sum-number");
        if (type === "percent") td.classList.add("sum-percent");
        tr.appendChild(td);
      });
      body.appendChild(tr);
    });
    $("sum-table-count").textContent = total
      ? "Showing " + (start + 1) + "–" + Math.min(start + state.pageSize,total) + " of " + total + " records"
      : "No Summary records match the current filters.";
    $("sum-page").textContent = total ? state.page + " / " + pages : "—";
    $("sum-prev").disabled = !total || state.page <= 1;
    $("sum-next").disabled = !total || state.page >= pages;
    $("sum-export").disabled = !total;
    $("sum-record-state").textContent = loadStatus === "error" ? "UNAVAILABLE" :
      loadStatus === "loading" ? "LOADING" : "READ ONLY";
    $("sum-filter-summary").textContent = total
      ? total + " summary record(s) match the current filters."
      : "";
    document.querySelectorAll("[data-sum-sort]").forEach(button => {
      const active = button.dataset.sumSort === state.sortKey;
      button.closest("th").setAttribute("aria-sort", active
        ? (state.sortDirection === 1 ? "ascending" : "descending") : "none");
      button.querySelector("span").textContent = active
        ? (state.sortDirection === 1 ? "↑" : "↓") : "↕";
    });
  }
  function filterRecords(resetPage = true) {
    state.filters = activeFilters();
    let rows = records.filter(record => {
      if (state.filters.date && !lower(record.dateProduce).includes(state.filters.date)) return false;
      if (state.filters.code && !lower(record.productCode).includes(state.filters.code)) return false;
      if (state.filters.can && !lower(record.canSize).includes(state.filters.can)) return false;
      if (state.filters.pr && !lower(record.pr).includes(state.filters.pr)) return false;
      if (state.filters.query && !SOURCE.columns.some(([key,,type]) => lower(cellText(record[key], type)).includes(state.filters.query))) return false;
      return true;
    });
    if (state.sortKey) rows.sort((a,b) => {
      const left = a[state.sortKey];
      const right = b[state.sortKey];
      if (left == null || right == null) return Number(left == null) - Number(right == null);
      const comparison = typeof left === "number" && typeof right === "number" ? left - right :
        String(left).localeCompare(String(right), undefined, {numeric:true,sensitivity:"base"});
      return comparison * state.sortDirection;
    });
    if (resetPage !== false) state.page = 1;
    filteredRows = rows;
    renderMetrics(rows);
    renderTable(rows);
    document.body.dataset.tfiFilterState = Object.values(state.filters).some(Boolean) ? "active" : "clear";
  }
  function resetFilters() {
    ["sum-filter-date","sum-filter-code","sum-filter-can","sum-filter-pr","sum-search"].forEach(id => { $(id).value = ""; });
    state.sortKey = "";
    state.sortDirection = 1;
    filterRecords();
  }
  function init() {
    bindSpreadsheetLink("sum");
    $("sum-import-open").addEventListener("click", openImportModal);
    $("sum-modal-close").addEventListener("click", closeImportModal);
    $("sum-modal-dismiss").addEventListener("click", closeImportModal);
    $("sum-import-modal").addEventListener("click", event => {
      if (event.target === $("sum-import-modal")) closeImportModal();
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && $("sum-import-modal").classList.contains("open")) closeImportModal();
    });
    ["sum-filter-date","sum-filter-code","sum-filter-can","sum-filter-pr","sum-search"].forEach(id => {
      $(id).addEventListener("input", filterRecords);
      $(id).addEventListener("change", filterRecords);
    });
    document.querySelectorAll("[data-sum-sort]").forEach(button => button.addEventListener("click", () => {
      if (state.sortKey === button.dataset.sumSort) state.sortDirection *= -1;
      else { state.sortKey = button.dataset.sumSort; state.sortDirection = 1; }
      filterRecords();
    }));
    document.querySelectorAll("[data-report-page]").forEach(button => button.addEventListener("click", () => {
      if (button.dataset.reportPage) navigateReport(button.dataset.reportPage);
    }));
    $("sum-reset").addEventListener("click", resetFilters);
    $("sum-prev").addEventListener("click", () => { state.page--; renderTable(filteredRows); });
    $("sum-next").addEventListener("click", () => { state.page++; renderTable(filteredRows); });
    $("sum-export").addEventListener("click", exportFilteredRows);
    window.addEventListener("tfi:data-saved", event => {
      if (String(event.detail?.endpoint || "").startsWith("/api/product-entry/")) void refreshRecords();
    });
    window.addEventListener("focus", () => void refreshRecords());
    /* batch5 cross-module refresh */ window.addEventListener("message",e=>{if(e.origin===location.origin&&e.data?.type==="TFI_DATA_SAVED"&&/^\/api\/(import|product-entry)\//.test(e.data.endpoint||""))void refreshRecords();});
    filterRecords();
    void refreshRecords();

    $("sum-source-workbook").textContent = SOURCE.workbook;
    $("sum-source-sheet").textContent = SOURCE.worksheet + " · sheetId " + SOURCE.sheetId;
    document.body.dataset.tfiReady = "true";
    document.body.dataset.tfiReport = "summary";
    document.body.dataset.tfiSourceSheetId = String(SOURCE.sheetId);
    document.body.dataset.tfiColumns = String(SOURCE.columns.length);
    document.body.dataset.tfiHeaderRows = SOURCE.headerRows.join(",");
    document.body.dataset.tfiFirstDataRow = String(SOURCE.firstDataRow);
    document.body.dataset.tfiFrozenRows = String(SOURCE.frozenRows);
    document.body.dataset.tfiFormulaSource = SOURCE.formulaSource;
    document.body.dataset.tfiNoMock = "true";
    document.body.dataset.tfiAdminImportEntry = "true";
  }
  document.addEventListener("DOMContentLoaded", init);
})();