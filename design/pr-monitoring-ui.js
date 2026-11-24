(() => {
  "use strict";
  const DATA = window.TFI_PR_MONITORING_DATA || { records: [], snapshotSummary: {} };
  const FIELDS = [
    ["column_a", "", "text"],
    ["pr_no", "PR No.", "text"],
    ["date_pr_received", "Date PR Recieved", "date"],
    ["pr_required_quantity_tins", "PR Required Quantity (tins)", "number"],
    ["production_produced_tins", "Production Produced (tins)", "number"],
    ["for_production_quantity_tins", "For Production Quantity (tins)", "number"],
    ["status", "Status", "status"]
  ];
  const state = { page: 1, pageSize: 10, sortKey: "", sortDirection: 1, filtered: [] };
  const $ = id => document.getElementById(id);
  const raw = value => value === null || value === undefined ? "" : String(value);
  const clean = value => raw(value).trim();
  const lower = value => clean(value).toLocaleLowerCase();

  function dateKey(value) {
    if (value === null || value === undefined || value === "") return "";
    if (typeof value === "number" && Number.isFinite(value)) {
      const date = new Date(Date.UTC(1899, 11, 30) + value * 86400000);
      return date.toISOString().slice(0, 10);
    }
    const text = clean(value);
    if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
  }

  function formatDate(value) {
    const key = dateKey(value);
    if (!key) return raw(value);
    const parts = key.split("-").map(Number);
    const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    return new Intl.DateTimeFormat("en-US", {
      month: "long", day: "numeric", year: "numeric", timeZone: "UTC"
    }).format(date);
  }

  function formatNumber(value) {
    if (value === null || value === undefined || value === "") return "";
    const number = Number(value);
    return Number.isFinite(number)
      ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(number)
      : raw(value);
  }

  function formatValue(key, value) {
    if (value === null || value === undefined || value === "") return "";
    if (key === "date_pr_received") return formatDate(value);
    if (key === "pr_required_quantity_tins" ||
        key === "production_produced_tins" ||
        key === "for_production_quantity_tins") return formatNumber(value);
    return raw(value);
  }

  function statusClass(value) {
    if (value === "Pending for Production") return "pending";
    if (value === "Complete") return "complete";
    if (value === "Over Produce") return "over";
    return "";
  }

  function applyFilters() {
    const from = $("pr-from").value;
    const to = $("pr-to").value;
    const prNo = lower($("pr-number").value);
    const status = $("pr-status").value;
    const query = lower($("pr-search").value);
    let rows = (Array.isArray(DATA.records) ? DATA.records : []).filter(row => {
      const date = dateKey(row.date_pr_received);
      if ((from || to) && !date) return false;
      if (from && date && date < from) return false;
      if (to && date && date > to) return false;
      if (prNo && !lower(row.pr_no).includes(prNo)) return false;
      if (status && raw(row.status) !== status) return false;
      if (query && !FIELDS.some(([key]) => lower(formatValue(key, row[key])).includes(query))) return false;
      return true;
    });

    if (state.sortKey) {
      const field = FIELDS.find(item => item[0] === state.sortKey);
      rows = rows.slice().sort((a, b) => {
        let av = a[state.sortKey], bv = b[state.sortKey];
        if (field && field[2] === "date") { av = dateKey(av); bv = dateKey(bv); }
        const aBlank = av === null || av === undefined || av === "";
        const bBlank = bv === null || bv === undefined || bv === "";
        if (aBlank || bBlank) return aBlank === bBlank ? 0 : (aBlank ? 1 : -1);
        const numeric = field && field[2] === "number";
        const result = numeric
          ? (Number(av) || 0) - (Number(bv) || 0)
          : clean(av).localeCompare(clean(bv), undefined, { numeric: true, sensitivity: "base" });
        return result * state.sortDirection;
      });
    }
    state.filtered = rows;
    renderTable();
  }

  function renderEmpty(message) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 7;
    td.className = "pr-empty-cell";
    const empty = document.createElement("div");
    empty.className = "pr-empty-state";
    const icon = document.createElement("div");
    icon.className = "pr-empty-icon";
    icon.textContent = "▤";
    const title = document.createElement("strong");
    title.textContent = message;
    const detail = document.createElement("span");
    detail.textContent = "No approved PR records are currently stored in TFI2. Historical source rows remain in the Import Center until reviewed and approved.";
    empty.append(icon, title, detail);
    td.appendChild(empty);
    tr.appendChild(td);
    $("pr-tbody").appendChild(tr);
  }

  function renderTable() {
    const total = state.filtered.length;
    const pages = Math.max(1, Math.ceil(total / state.pageSize));
    state.page = Math.min(state.page, pages);
    const start = (state.page - 1) * state.pageSize;
    const visible = state.filtered.slice(start, start + state.pageSize);
    const body = $("pr-tbody");
    body.replaceChildren();

    if (!visible.length) {
      renderEmpty(DATA.records?.length ? "No records match these filters" : "No PR records loaded in this preview");
    } else {
      visible.forEach(row => {
        const tr = document.createElement("tr");
        FIELDS.forEach(([key]) => {
          const td = document.createElement("td");
          if (key === "status" && row[key]) {
            const pill = document.createElement("span");
            pill.className = "pr-status-pill " + statusClass(row[key]);
            pill.textContent = raw(row[key]);
            td.appendChild(pill);
          } else {
            td.textContent = formatValue(key, row[key]);
          }
          tr.appendChild(td);
        });
        body.appendChild(tr);
      });
    }

    $("pr-table-count").textContent = total
      ? "Showing " + (start + 1) + "–" + Math.min(start + state.pageSize, total) + " of " + total + " records"
      : (DATA.records?.length ? "No records match the current filters." : "No approved PR records stored in TFI2.");
    $("pr-page").textContent = total ? state.page + " / " + pages : "—";
    $("pr-prev").disabled = !total || state.page <= 1;
    $("pr-next").disabled = !total || state.page >= pages;
    $("pr-export").disabled = !total;
    $("pr-record-state").textContent = total ? total + " SOURCE RECORDS" : "NO PREVIEW DATA";
    $("pr-record-state").parentElement.querySelector("i").style.background = total ? "#45a779" : "#a6b7ad";
    $("pr-filter-summary").textContent = total
      ? total + " record(s) match the current filters."
      : (DATA.records?.length ? "No records match the current filters." : "No approved PR records stored in TFI2.");

    document.querySelectorAll("[data-sort]").forEach(button => {
      const active = button.dataset.sort === state.sortKey;
      button.closest("th").setAttribute("aria-sort", active
        ? (state.sortDirection === 1 ? "ascending" : "descending")
        : "none");
      button.querySelector("span").textContent = active
        ? (state.sortDirection === 1 ? "↑" : "↓")
        : "↕";
    });
  }

  function exportCsv() {
    if (!state.filtered.length) return;
    const quote = value => '"' + String(value ?? "").replaceAll('"', '""') + '"';
    const lines = [FIELDS.map(([, label]) => quote(label)).join(",")];
    state.filtered.forEach(row => {
      lines.push(FIELDS.map(([key]) => quote(formatValue(key, row[key]))).join(","));
    });
    const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "TFI-PR-Monitoring-Export.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  function resetFilters() {
    ["pr-from", "pr-to", "pr-number", "pr-status", "pr-search"].forEach(id => { $(id).value = ""; });
    state.page = 1;
    applyFilters();
  }

  function init() {
    const summary = DATA.snapshotSummary || {};
    $("pr-total-required").textContent = summary.totalTinsToProduce?.formattedValue || "—";
    $("pr-total-produced").textContent = summary.totalTinsProduced?.formattedValue || "—";
    $("pr-completion").textContent = summary.completion?.formattedValue || "—";

    ["pr-from", "pr-to", "pr-number", "pr-status", "pr-search"].forEach(id => {
      $(id).addEventListener("input", () => { state.page = 1; applyFilters(); });
      $(id).addEventListener("change", () => { state.page = 1; applyFilters(); });
    });
    document.querySelectorAll("[data-sort]").forEach(button => button.addEventListener("click", () => {
      if (state.sortKey === button.dataset.sort) state.sortDirection *= -1;
      else { state.sortKey = button.dataset.sort; state.sortDirection = button.dataset.sort === "date_pr_received" ? -1 : 1; }
      state.page = 1;
      applyFilters();
    }));
    $("pr-reset").addEventListener("click", resetFilters);
    $("pr-export").addEventListener("click", exportCsv);
    $("pr-prev").addEventListener("click", () => { state.page--; renderTable(); });
    $("pr-next").addEventListener("click", () => { state.page++; renderTable(); });
    applyFilters();

    document.body.dataset.tfiReady = "true";
    document.body.dataset.tfiPrReadOnly = "true";
    document.body.dataset.tfiPrRecords = String(DATA.records?.length || 0);
    document.body.dataset.tfiPrColumns = String(FIELDS.length);
    document.body.dataset.tfiNoMock = "true";
  }

  document.addEventListener("DOMContentLoaded", init);
})();