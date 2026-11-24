(() => {
  "use strict";
  const DATA = window.TFI_PR_MONITORING_DATA;
  const $ = id => document.getElementById(id);
  if (!DATA) return;
  const SOURCE_SHEET_ID = 867256143;
  let connected = false;
  let loading = false;
  let exportAllowed = false;

  function setConnection(message, state) {
    const el = $("pr-db-status");
    if (el) { el.textContent = message; el.dataset.state = state; }
    document.body.dataset.tfiPrBackend = state;
  }

  function updateSnapshot(summary) {
    if (!summary) return;
    const values = {
      "pr-total-required": summary.total_tins_to_produce?.formatted_value || "—",
      "pr-total-produced": summary.total_tins_produced?.formatted_value || "—",
      "pr-completion": summary.completion?.formatted_value || "—"
    };
    Object.entries(values).forEach(([id, value]) => { if ($(id)) $(id).textContent = value; });
  }

  function refreshLocalTable() {
    $("pr-search")?.dispatchEvent(new Event("input", { bubbles: true }));
    const count = Array.isArray(DATA.records) ? DATA.records.length : 0;
    const state = $("pr-record-state");
    if (state) state.textContent = connected
      ? (count ? count + " TFI2 RECORDS" : "TFI2 CONNECTED · 0 RECORDS")
      : "TFI2 NOT CONNECTED";
    const stateDot = state?.parentElement?.querySelector("i");
    if (stateDot) stateDot.style.background = connected ? "#45a779" : "#c45a49";
    const exportButton = $("pr-export");
    if (exportButton) {
      exportButton.disabled = !connected || !exportAllowed || count === 0;
      exportButton.title = !connected ? "Connect to TFI2 before exporting."
        : !exportAllowed ? "Your TFI role does not have PR Monitoring export permission."
        : count === 0 ? "Export becomes available when approved PR records are stored in TFI2."
        : "Export the filtered TFI2 PR register.";
    }
    document.body.dataset.tfiPrRecords = String(count);
    document.body.dataset.tfiPrExportAllowed = String(exportAllowed);
  }

  async function fetchJson(url) {
    const response = await fetch(url, {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
      cache: "no-store"
    });
    let payload;
    try { payload = await response.json(); }
    catch (_) { throw new Error("The TFI2 session may have expired. Sign in again and refresh this page."); }
    if (!response.ok) throw new Error(payload.error || "The TFI2 request could not be completed.");
    return payload;
  }

  async function loadRecords() {
    if(loading)return;loading=true;
    const refresh = $("pr-refresh");
    if (refresh) { refresh.disabled = true; refresh.textContent = "LOADING…"; }
    connected = false;
    exportAllowed = false;
    setConnection("CONNECTING TO TFI2…", "loading");
    try {
      const catalogResponse = await fetchJson("/api/pr-monitoring/catalog");
      const catalog = catalogResponse.catalog || {};
      if (catalog.source?.sheet_id !== SOURCE_SHEET_ID ||
          catalog.source?.spreadsheet_id !== "1rCbQ16wj7MRjQCFF3tA-WEMkudraJK0RkwcqayUlz7k") {
        throw new Error("The TFI2 PR Monitoring source does not match the approved worksheet.");
      }
      const result = await fetchJson("/api/pr-monitoring/records?page=1&page_size=1000");
      const records = result.records || [];
      if (!Array.isArray(records)) throw new Error("TFI2 returned an invalid PR Monitoring record list.");
      if (Number(result.total_count || 0) > records.length || result.has_more) {
        throw new Error("The PR Monitoring register exceeds its approved source grid range. Contact the administrator.");
      }
      DATA.records = records;
      DATA.snapshotSummary = catalog.snapshot_summary || DATA.snapshotSummary;
      DATA.permissions = catalogResponse.permissions || {};
      exportAllowed = DATA.permissions.export === true;
      updateSnapshot(DATA.snapshotSummary);
      connected = true;
      setConnection("TFI2 CONNECTED · READ-ONLY", "connected");
      document.body.dataset.tfiPrReadOnly = "true";
      document.body.dataset.tfiNoMock = "true";
      refreshLocalTable();
    } catch (error) {
      DATA.records = [];
      connected = false;
      exportAllowed = false;
      setConnection("TFI2 CONNECTION ERROR · " + error.message, "error");
      refreshLocalTable();
      const note = $("pr-filter-summary");
      if (note) note.textContent = error.message;
    } finally {
      loading=false;
      if (refresh) { refresh.disabled = false; refresh.textContent = "REFRESH"; }
    }
  }

  function exportUrl() {
    const params = new URLSearchParams();
    [
      ["pr-from", "date_from"], ["pr-to", "date_to"],
      ["pr-number", "pr_no"], ["pr-status", "status"], ["pr-search", "search"]
    ].forEach(([id, key]) => {
      const value = $(id)?.value?.trim();
      if (value) params.set(key, value);
    });
    const activeSort = [...document.querySelectorAll("[data-sort]")].find(button => {
      const value = button.closest("th")?.getAttribute("aria-sort");
      return value === "ascending" || value === "descending";
    });
    if (activeSort) {
      params.set("sort_key", activeSort.dataset.sort);
      params.set("sort_direction", activeSort.closest("th").getAttribute("aria-sort") === "descending" ? "desc" : "asc");
    }
    const query = params.toString();
    return "/api/pr-monitoring/export.csv" + (query ? "?" + query : "");
  }

  /* batch4 focus refresh */ window.addEventListener("focus",()=>{if(connected)loadRecords();});
  document.addEventListener("DOMContentLoaded", () => {
    $("pr-refresh")?.addEventListener("click", loadRecords);
    $("pr-export")?.addEventListener("click", event => {
      if (!connected || !exportAllowed || !DATA.records?.length) {
        event.preventDefault(); event.stopImmediatePropagation(); return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      window.location.assign(exportUrl());
    }, true);
    loadRecords();
  });
})();
