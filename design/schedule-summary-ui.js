(() => {
  "use strict";

  const SOURCE = Object.freeze({
    workbook: "Copy of TFI - Production Monitoring Sheet 1",
    spreadsheetId: "1rCbQ16wj7MRjQCFF3tA-WEMkudraJK0RkwcqayUlz7k",
    worksheet: "Schedule Summary",
    sheetId: 720094137,
    headerRow: 2,
    firstDataRow: 3,
    inspectedRange: "A3:S1000",
    upstreamWorksheet: "Production Schedule",
    upstreamSheetId: 1538651320,
    columns: [
      ["date","DATE","date"],["day","DAY","text"],["line","LINE","text"],["area","AREA","text"],
      ["productName","PRODUCT NAME","text"],["productionCode","PRODUCTION CODE","text"],
      ["batches","# OF BATCHES","number"],["target","TARGET","number"],["revisedTarget","REVISED TARGET","number"],
      ["um","UM","text"],["quantityTins","QUANTITY (tins/ends)","number"],["quantityBox","QUANTITY (box)","number"],
      ["requiredPax","REQUIRED NO. OF PAX","number"],["pr","PR#","text"],["remarks","REMARKS","text"],
      ["fcIdcRef","FC/IDC REF","text"],["shiftHrs","SHIFT HRS","number"],["availablePax","AVAILABLE PAX (day)","number"],
      ["savedOn","SAVED ON","dateTime"]
    ]
  });

  const SORT_KEYS = Object.freeze({
    date: "date",
    day: "day",
    line: "line",
    area: "area",
    productName: "product_name",
    productionCode: "production_code",
    batches: "batches",
    target: "target",
    revisedTarget: "revised_target",
    um: "um",
    quantityTins: "quantity_tins",
    quantityBox: "quantity_box",
    requiredPax: "required_pax",
    pr: "pr_number",
    remarks: "remarks",
    fcIdcRef: "fc_idc_ref",
    shiftHrs: "shift_hours",
    availablePax: "available_pax_day",
    savedOn: "saved_on"
  });

  const state = {
    page: 1,
    pageSize: 10,
    sortKey: "date",
    sortDirection: "desc",
    filters: {},
    records: [],
    total: 0,
    summary: {},
    connected: false,
    loading: false,
    exporting: false,
    error: "",
    requestId: 0,
    debounce: null,
    toastTimer: null
  };

  const $ = id => document.getElementById(id);
  const clean = value => String(value ?? "").trim();
  const lower = value => clean(value).toLocaleLowerCase();
  const numberFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

  async function api(url, options) {
    const response = await fetch(url, Object.assign({
      credentials: "same-origin",
      cache: "no-store"
    }, options || {}));
    let payload = {};
    try { payload = await response.json(); } catch (_) {}
    if (!response.ok) {
      const error = new Error(payload.error || (
        response.status === 401 || response.status === 403
          ? "Your session or Schedule Summary permission is not active. Sign in again or contact the administrator."
          : "TFI2 could not load the Schedule Summary register. Please try again."
      ));
      error.status = response.status;
      error.code = payload.code || "schedule_summary_request_failed";
      throw error;
    }
    return payload;
  }

  function formatNumber(value) {
    if (value === null || value === undefined || value === "") return "—";
    const parsed = Number(value);
    return Number.isFinite(parsed) ? numberFormat.format(parsed) : String(value);
  }

  function formatDate(value) {
    if (!value) return "";
    const raw = String(value).slice(0, 10);
    const parsed = new Date(raw + "T12:00:00");
    return Number.isNaN(parsed.getTime())
      ? String(value)
      : parsed.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
  }

  function formatDateTime(value) {
    if (!value) return "";
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime())
      ? String(value)
      : parsed.toLocaleString("en-US", {
          month: "2-digit", day: "2-digit", year: "numeric",
          hour: "2-digit", minute: "2-digit"
        });
  }

  function mapRecord(row) {
    return {
      formId: row.form_id || "",
      formVersion: Number(row.form_version || 1),
      sourceRowNumber: row.source_row_number,
      date: formatDate(row.date),
      day: row.day || "",
      line: row.line || "",
      area: row.area || "",
      productName: row.product_name || "",
      productionCode: row.production_code || "",
      batches: formatNumber(row.batches),
      target: formatNumber(row.target),
      revisedTarget: formatNumber(row.revised_target),
      um: row.um || "",
      quantityTins: formatNumber(row.quantity_tins),
      quantityBox: formatNumber(row.quantity_box),
      requiredPax: formatNumber(row.required_pax),
      pr: row.pr_number || "",
      remarks: row.remarks || "",
      fcIdcRef: row.fc_idc_ref || "",
      shiftHrs: formatNumber(row.shift_hours),
      availablePax: formatNumber(row.available_pax_day),
      savedOn: formatDateTime(row.saved_on)
    };
  }

  function showToast(message, error) {
    const toast = $("ss-toast");
    if (!toast) return;
    toast.textContent = message;
    toast.hidden = false;
    toast.classList.toggle("is-error", !!error);
    toast.style.background = error ? "#8e3028" : "";
    window.clearTimeout(state.toastTimer);
    state.toastTimer = window.setTimeout(() => { toast.hidden = true; }, 4200);
  }

  function setRecordState(message, error) {
    const el = $("ss-record-state");
    el.textContent = message;
    el.dataset.state = error ? "error" : "connected";
    document.body.dataset.tfiConnection = error ? "error" : "connected";
  }

  function openImportModal() {
    $("ss-import-modal").classList.add("open");
    $("ss-import-modal").setAttribute("aria-hidden", "false");
    $("ss-modal-close").focus();
  }

  function closeImportModal() {
    $("ss-import-modal").classList.remove("open");
    $("ss-import-modal").setAttribute("aria-hidden", "true");
    $("ss-import-open").focus();
  }

  function spreadsheetIdFromUrl(raw) {
    try {
      const url = new URL(raw);
      if (url.protocol !== "https:" || url.hostname.toLowerCase() !== "docs.google.com") return "";
      const match = url.pathname.match(/^\/spreadsheets\/(?:u\/\d+\/)?d\/([A-Za-z0-9_-]+)/);
      return match ? match[1] : "";
    } catch (_) { return ""; }
  }

  function bindSpreadsheetLink() {
    const input = $("ss-spreadsheet-link");
    const button = $("ss-link-validate");
    const feedback = $("ss-link-feedback");
    const idBox = $("ss-link-id");
    const idValue = $("ss-link-id-value");
    const reset = () => {
      input.setAttribute("aria-invalid", "false");
      feedback.className = "rr-link-feedback";
      feedback.textContent = "Link changed. Select Validate Link to check its URL format.";
      idBox.hidden = true;
      idValue.textContent = "";
      document.body.dataset.tfiSpreadsheetLinkStatus = "pending";
      delete document.body.dataset.tfiDetectedSpreadsheetId;
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
        delete document.body.dataset.tfiDetectedSpreadsheetId;
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
    const routes = {
      "Production Summary": "Reports",
      "Schedule Summary": "Schedule Summary",
      "Summary": "Summary",
      "Removed Rows": "Removed Rows"
    };
    const module = routes[page] || "Reports";
    window.location.assign("dashboard-preview.html?module=" + encodeURIComponent(module));
  }

  function activeFilters() {
    return {
      date_from: $("ss-from").value,
      date_to: $("ss-to").value,
      day: clean($("ss-day").value),
      line: clean($("ss-line").value),
      area: clean($("ss-area").value),
      product_name: clean($("ss-product").value),
      production_code: clean($("ss-code").value),
      pr_number: clean($("ss-pr").value),
      search: clean($("ss-search").value)
    };
  }

  function hasActiveFilters(filters) {
    return Object.values(filters || state.filters).some(Boolean);
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
    const detail = document.createElement("span");

    if (state.loading) {
      title.textContent = "Loading saved schedules";
      detail.textContent = "Connecting to TFI2 and retrieving the Schedule Summary register.";
    } else if (state.error) {
      title.textContent = "Schedule Summary is unavailable";
      detail.textContent = state.error;
    } else if (hasActiveFilters()) {
      title.textContent = "No saved schedules match these filters";
      detail.textContent = "Try a wider date range or clear one or more filters.";
    } else {
      title.textContent = "No saved schedule history yet";
      detail.textContent = "New daily forms saved from Production Schedule will appear here. No historical worksheet rows or sample transactions are preloaded.";
    }

    wrap.append(icon, title, detail);
    td.appendChild(wrap);
    tr.appendChild(td);
    $("ss-tbody").appendChild(tr);
  }

  function renderTable() {
    const body = $("ss-tbody");
    body.replaceChildren();

    if (!state.records.length) {
      renderEmpty();
    } else {
      state.records.forEach(record => {
        const tr = document.createElement("tr");
        tr.dataset.formId = record.formId;
        tr.dataset.formVersion = String(record.formVersion);
        tr.dataset.sourceRowNumber = String(record.sourceRowNumber || "");
        SOURCE.columns.forEach(([key,,type], index) => {
          const td = document.createElement("td");
          td.textContent = record[key] ?? "";
          if (type === "number") td.classList.add("rr-numeric");
          if (type === "date" || type === "dateTime") td.classList.add("rr-center");
          if (index === 18) td.classList.add("rr-trace");
          tr.appendChild(td);
        });
        body.appendChild(tr);
      });
    }

    const pages = Math.max(1, Math.ceil(state.total / state.pageSize));
    const start = state.total ? (state.page - 1) * state.pageSize + 1 : 0;
    const end = Math.min(state.page * state.pageSize, state.total);

    $("ss-table-count").textContent = state.loading && !state.total
      ? "Loading saved Schedule Summary records from TFI2…"
      : state.total
        ? "Showing " + start + "–" + end + " of " + state.total + " saved schedule lines"
        : state.error
          ? "The saved schedule register could not be loaded."
          : hasActiveFilters()
            ? "No saved schedule records match the current filters."
            : "No saved schedule records are available yet.";

    $("ss-page").textContent = state.total ? state.page + " / " + pages : "—";
    $("ss-prev").disabled = state.loading || !state.total || state.page <= 1;
    $("ss-next").disabled = state.loading || !state.total || state.page >= pages;
    $("ss-export").disabled = state.loading || state.exporting || !state.total;

    if (state.error) setRecordState("TFI2 CONNECTION ISSUE", true);
    else if (state.loading) setRecordState("LOADING TFI2", false);
    else setRecordState(state.total ? state.total + " SAVED SCHEDULE LINES" : "NO SAVED SCHEDULES", false);

    $("ss-filter-summary").textContent = state.error
      ? "The saved Schedule Summary register could not be loaded."
      : state.total
        ? state.total + " saved schedule line(s) match the current filters."
        : hasActiveFilters()
          ? "No saved schedule records match the current filters."
          : "No saved schedule records are available yet.";

    document.querySelectorAll("[data-ss-sort]").forEach(button => {
      const active = button.dataset.ssSort === state.sortKey;
      button.closest("th").setAttribute("aria-sort", active
        ? (state.sortDirection === "asc" ? "ascending" : "descending") : "none");
      button.querySelector("span").textContent = active
        ? (state.sortDirection === "asc" ? "↑" : "↓") : "↕";
    });

    document.body.dataset.tfiRecordCount = String(state.total);
    document.body.dataset.tfiCurrentPage = String(state.page);
    document.body.dataset.tfiPageSize = String(state.pageSize);
  }

  function updateSummary(summary) {
    state.summary = summary || {};
    $("ss-kpi-lines").textContent = formatNumber(state.summary.saved_rows ?? 0);
    $("ss-kpi-days").textContent = formatNumber(state.summary.days_saved ?? 0);
    $("ss-kpi-target").textContent = formatNumber(state.summary.target_total ?? 0);
    $("ss-kpi-manpower").textContent = formatNumber(state.summary.required_manpower_total ?? 0);
    document.body.dataset.tfiSavedRows = String(state.summary.saved_rows ?? 0);
    document.body.dataset.tfiSavedDays = String(state.summary.days_saved ?? 0);
    document.body.dataset.tfiTargetTotal = String(state.summary.target_total ?? 0);
    document.body.dataset.tfiRequiredManpower = String(state.summary.required_manpower_total ?? 0);
  }

  function buildQuery(page, pageSize, filters) {
    const query = new URLSearchParams({
      page: String(page),
      page_size: String(pageSize),
      sort: SORT_KEYS[state.sortKey] || "date",
      direction: state.sortDirection
    });
    Object.entries(filters).forEach(([key, value]) => {
      if (value) query.set(key, value);
    });
    return query;
  }

  async function loadRecords(page) {
    const requestId = ++state.requestId;
    state.page = Math.max(1, Number(page) || 1);
    state.filters = activeFilters();
    state.error = "";
    state.loading = true;
    const query = buildQuery(state.page, state.pageSize, state.filters);
    document.body.dataset.tfiRequestedQuery = query.toString();
    renderTable();

    try {
      const payload = await api("/api/production-schedule/records?" + query.toString());
      if (requestId !== state.requestId) return;
      state.records = (payload.records || []).map(mapRecord);
      state.total = Number(payload.total || 0);
      state.page = Number(payload.page || 1);
      state.connected = true;
      state.error = "";
      document.body.dataset.tfiLoadedQuery = query.toString();
      document.body.dataset.tfiDataSource = "TFI2";
    } catch (error) {
      if (requestId !== state.requestId) return;
      state.records = [];
      state.total = 0;
      state.connected = false;
      state.error = error.message;
      document.body.dataset.tfiDataSource = "UNAVAILABLE";
      showToast(error.message, true);
    } finally {
      if (requestId === state.requestId) {
        state.loading = false;
        renderTable();
      }
    }
  }

  function scheduleFilter() {
    window.clearTimeout(state.debounce);
    $("ss-export").disabled = true;
    state.debounce = window.setTimeout(() => loadRecords(1), 280);
  }

  function resetFilters() {
    ["ss-from","ss-to","ss-day","ss-line","ss-area","ss-product","ss-code","ss-pr","ss-search"]
      .forEach(id => { $(id).value = ""; });
    state.sortKey = "date";
    state.sortDirection = "desc";
    loadRecords(1);
  }

  async function exportCsv() {
    if (!state.total || state.exporting) return;
    state.exporting = true;
    $("ss-export").disabled = true;
    const filters = activeFilters();
    const rows = [];
    const totalPages = Math.ceil(state.total / 100);
    try {
      for (let page = 1; page <= totalPages; page++) {
        const query = buildQuery(page, 100, filters);
        const payload = await api("/api/production-schedule/records?" + query.toString());
        rows.push(...(payload.records || []).map(mapRecord));
      }
      const quote = value => '"' + String(value ?? "").replace(/"/g, '""') + '"';
      const lines = [
        SOURCE.columns.map(([,label]) => quote(label)).join(","),
        ...rows.map(record => SOURCE.columns.map(([key]) => quote(record[key] ?? "")).join(","))
      ];
      const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "TFI-Schedule-Summary-" + new Date().toISOString().slice(0, 10) + ".csv";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      showToast(rows.length + " saved Schedule Summary line(s) exported.");
    } catch (error) {
      showToast(error.message, true);
    } finally {
      state.exporting = false;
      $("ss-export").disabled = !state.total;
    }
  }

  async function refreshLiveScheduleSummary(){
    if(state.loading||document.hidden)return;
    try{const payload=await api("/api/production-schedule/summary");updateSummary(payload.summary||{});await loadRecords(state.page);}
    catch(error){showToast(error.message,true);}
  }
  function init() {
    bindSpreadsheetLink();
    window.addEventListener("focus",refreshLiveScheduleSummary);
    window.addEventListener("message",e=>{if(e.origin===location.origin&&e.data?.type==="TFI_DATA_SAVED"&&/^\/api\/(import|production-schedule)\//.test(e.data.endpoint||""))refreshLiveScheduleSummary();});
    $("ss-import-open").addEventListener("click", openImportModal);
    $("ss-modal-close").addEventListener("click", closeImportModal);
    $("ss-modal-dismiss").addEventListener("click", closeImportModal);
    $("ss-import-modal").addEventListener("click", event => {
      if (event.target === $("ss-import-modal")) closeImportModal();
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && $("ss-import-modal").classList.contains("open")) closeImportModal();
    });

    ["ss-from","ss-to"].forEach(id => {
      $(id).addEventListener("change", () => loadRecords(1));
    });
    ["ss-day","ss-line","ss-area","ss-product","ss-code","ss-pr","ss-search"].forEach(id => {
      $(id).addEventListener("input", scheduleFilter);
      $(id).addEventListener("change", () => loadRecords(1));
    });

    document.querySelectorAll("[data-ss-sort]").forEach(button => button.addEventListener("click", () => {
      const nextKey = button.dataset.ssSort;
      if (state.sortKey === nextKey) {
        state.sortDirection = state.sortDirection === "asc" ? "desc" : "asc";
      } else {
        state.sortKey = nextKey;
        state.sortDirection = "asc";
      }
      loadRecords(1);
    }));

    document.querySelectorAll("[data-report-page]").forEach(button => button.addEventListener("click", () => {
      if (button.dataset.reportPage) navigateReport(button.dataset.reportPage);
    }));

    $("ss-reset").addEventListener("click", resetFilters);
    $("ss-export").addEventListener("click", exportCsv);
    $("ss-prev").addEventListener("click", () => loadRecords(Math.max(1, state.page - 1)));
    $("ss-next").addEventListener("click", () => loadRecords(state.page + 1));

    document.body.dataset.tfiReport = "schedule-summary";
    document.body.dataset.tfiSourceSheetId = String(SOURCE.sheetId);
    document.body.dataset.tfiColumns = String(SOURCE.columns.length);
    document.body.dataset.tfiHeaderRow = String(SOURCE.headerRow);
    document.body.dataset.tfiFirstDataRow = String(SOURCE.firstDataRow);
    document.body.dataset.tfiUpstreamSheetId = String(SOURCE.upstreamSheetId);
    document.body.dataset.tfiInspectedSourceRange = SOURCE.inspectedRange;
    document.body.dataset.tfiNoMock = "true";
    document.body.dataset.tfiAdminImportEntry = "true";

    updateSummary({});
    renderTable();
    setRecordState("CONNECTING TO TFI2", false);

    api("/api/production-schedule/summary")
      .then(payload => {
        updateSummary(payload.summary || {});
        document.body.dataset.tfiSummaryLoaded = "true";
        return loadRecords(1);
      })
      .catch(error => {
        state.connected = false;
        state.error = error.message;
        state.loading = false;
        document.body.dataset.tfiDataSource = "UNAVAILABLE";
        showToast(error.message, true);
        renderTable();
      })
      .finally(() => {
        document.body.dataset.tfiReady = "true";
        document.body.dataset.tfiDataSource = state.connected ? "TFI2" : "UNAVAILABLE";
      });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
