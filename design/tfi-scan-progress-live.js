(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const batchId = params.get("batchId");
  let currentBatch = null;
  let pollHandle = null;
  let stopped = false;

  function toast(message) {
    if (typeof window.toast === "function") window.toast(message);
    else {
      const el = $("toast");
      if (el) { el.textContent = message; el.classList.add("show"); }
    }
  }

  function setMetric(index, value) {
    const items = document.querySelectorAll(".metrics .metric-value");
    if (items[index]) items[index].textContent = value;
  }

  function setSideStat(index, value) {
    const items = document.querySelectorAll(".side-card .side-stat strong");
    if (items[index]) items[index].textContent = value;
  }

  function setPhase(index, complete) {
    const phase = $("phase-" + index);
    if (!phase) return;
    phase.classList.toggle("done", Boolean(complete));
    phase.classList.toggle("active", !complete && currentBatch && currentBatch.status === "scanning");
  }

  function renderBatch(batch, progress) {
    currentBatch = batch;
    const scanning = batch.status === "scanning";
    const completed = batch.status === "review" || batch.status === "completed" || batch.status === "completed_with_issues";
    const failed = batch.status === "failed";
    const rowsInspected = Number(progress.rows_inspected || batch.rows_inspected || 0);
    const rowsStaged = Number(progress.rows_staged || batch.rows_staged || 0);
    const statusLabel = scanning ? "Scanning selected worksheet" :
      completed ? "Scan complete · Ready for review" :
      failed ? "Scan failed" : batch.status;

    const pill = document.querySelector(".heading-actions .pill");
    if (pill) pill.textContent = scanning ? "Scanning" : completed ? "Scan complete" : failed ? "Failed" : "Awaiting scan";
    const sourceState = document.querySelector(".source-state");
    if (sourceState) sourceState.textContent = scanning ? "Reading mapped worksheet" : completed ? "Worksheet scan complete" : failed ? "Scan failed" : "Scan status";
    $("progress-label").textContent = failed
      ? (batch.error_message || progress.error || "The worksheet scan could not be completed.")
      : scanning
        ? ("Scanning " + batch.source_sheet_title + " · " + rowsInspected.toLocaleString() + " rows inspected · " + rowsStaged.toLocaleString() + " staged")
        : statusLabel;
    $("progress-value").textContent = scanning ? "Live" : completed ? "100%" : failed ? "Error" : "—";
    const fill = $("progress-fill");
    if (fill) {
      fill.classList.toggle("indeterminate", scanning);
      fill.style.width = completed ? "100%" : scanning ? "38%" : "0%";
      if (failed) fill.style.width = "100%";
    }

    setMetric(0, "1");
    setMetric(1, rowsInspected.toLocaleString());
    setMetric(2, Number(batch.formula_cells || 0).toLocaleString());
    setMetric(3, scanning ? "Running" : completed ? "Complete" : failed ? "Failed" : "—");

    setSideStat(0, batch.source_name || params.get("sourceName") || "Uploaded workbook");
    setSideStat(1, params.get("targetLabel") || batch.module_key);
    setSideStat(2, "1 mapped worksheet");
    setSideStat(3, rowsStaged.toLocaleString() + " rows staged");
    setSideStat(4, (Number(batch.derived_rows || 0) + Number(batch.unmapped_rows || 0)).toLocaleString());
    setSideStat(5, Number(batch.unmapped_rows || 0).toLocaleString());
    setSideStat(6, failed ? "Failed" : completed ? "Ready for review" : "Scanning");

    const empty = document.querySelector(".table-empty");
    const table = document.querySelector(".worksheet-table");
    if (empty) empty.style.display = "none";
    if (table) {
      let body = table.querySelector("tbody");
      if (!body) body = table.appendChild(document.createElement("tbody"));
      const classification = batch.status === "review" ? "Raw source rows staged for manual review" :
        batch.status === "failed" ? "Scan failed" : "Selective scan in progress";
      body.innerHTML = "<tr><td>" + escapeText(batch.source_sheet_title) +
        "</td><td>Mapped worksheet · sheetId " + escapeText(batch.source_sheet_id) +
        "</td><td>" + rowsInspected.toLocaleString() +
        "</td><td>" + Number(batch.formula_cells || 0).toLocaleString() +
        "</td><td>" + classification +
        "</td><td>" + escapeText(params.get("targetLabel") || batch.module_key) + "</td></tr>";
    }

    [1,2,3,4].forEach((n) => setPhase(n, completed || (scanning && n < 4)));
    const start = $("start-scan");
    if (start) {
      start.disabled = true;
      start.textContent = completed ? "Scan complete" : failed ? "Scan failed" : "Scanning automatically…";
    }
    const cancel = $("cancel-scan");
    if (cancel) {
      cancel.disabled = true;
      cancel.title = "The server-side scan is not cancellable once it has started.";
    }
    const next = $("continue-review");
    if (next) {
      next.disabled = !completed;
      next.textContent = completed ? "Continue to review" : failed ? "Review unavailable" : "Waiting for scan…";
    }
  }

  function escapeText(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
  }

  async function poll() {
    if (stopped || !batchId) return;
    try {
      const response = await fetch("/api/import/batches/" + encodeURIComponent(batchId), {
        credentials: "same-origin",
        headers: { "Accept": "application/json" }
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to retrieve the scan status.");
      renderBatch(payload.batch, payload.progress || {});
      if (payload.batch.status === "scanning") {
        pollHandle = window.setTimeout(poll, 1600);
      } else {
        stopped = true;
        if (payload.batch.status === "failed") toast(payload.batch.error_message || "The worksheet scan failed.");
      }
    } catch (error) {
      $("progress-label").textContent = error.message || "The scan status could not be retrieved.";
      $("progress-value").textContent = "—";
      pollHandle = window.setTimeout(poll, 3500);
    }
  }

  function goToInbox(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!currentBatch || currentBatch.status !== "review") {
      toast("Wait until the selected worksheet scan is complete.");
      return;
    }
    const query = new URLSearchParams({
      from: "scan-progress",
      batchId,
      targetModule: params.get("targetModule") || "",
      moduleKey: currentBatch.module_key,
      targetLabel: params.get("targetLabel") || currentBatch.module_key,
      sourceWorksheet: currentBatch.source_sheet_title,
      sourceSheetId: String(currentBatch.source_sheet_id),
      sourceName: currentBatch.source_name,
      sourceType: currentBatch.source_type || params.get("sourceType") || "xlsx",
      sourceSize: params.get("sourceSize") || ""
    });
    location.href = "central-import-inbox-preview.html?" + query.toString();
  }

  const next = $("continue-review");
  if (next) next.addEventListener("click", goToInbox, true);
  const start = $("start-scan");
  if (start) start.addEventListener("click", event => {
    event.preventDefault(); event.stopImmediatePropagation();
    toast("The scan already starts automatically after the workbook upload.");
  }, true);
  const cancel = $("cancel-scan");
  if (cancel) cancel.addEventListener("click", event => {
    event.preventDefault(); event.stopImmediatePropagation();
    toast("This scan is already running on the server and cannot be cancelled from this screen.");
  }, true);

  if (!batchId) {
    $("progress-label").textContent = "No live import batch is attached. Return to Spreadsheet Import and connect a Google Sheet or upload an .xlsx workbook.";
    $("continue-review").disabled = true;
    $("start-scan").disabled = true;
  } else {
    $("workbook-name").textContent = params.get("sourceName") || "Uploaded workbook";
    $("target-module-name").textContent = params.get("targetLabel") || "Selected destination";
    $("target-source-name").textContent = "Mapped worksheet: " + (params.get("sourceWorksheet") || "Loading…");
    $("target-source-id").textContent = "sheetId " + (params.get("sourceSheetId") || "—");
    $("workbook-meta").textContent = params.get("sourceType") === "google_sheets"
      ? "Google Sheets · Read-only selective scan"
      : "XLSX upload · Server-side selective scan";
    $("progress-label").textContent = "Connecting to the TFI2 scan service…";
    poll();
  }
  window.addEventListener("pagehide", () => {
    stopped = true;
    if (pollHandle) window.clearTimeout(pollHandle);
  });
})();
