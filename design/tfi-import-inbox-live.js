(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const batchId = params.get("batchId");
  const selectedDbIds = new Set((params.get("selectedIds") || "").split(",").filter(Boolean));
  let page = 1;
  let hasMore = false;
  let loading = false;
  let currentBatch = null;
  let numericId = 0;

  function toast(message) {
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = message;
    document.body.appendChild(el);
    window.setTimeout(() => el.remove(), 2600);
  }

  function safe(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
  }

  function valueSummary(values) {
    const clean = (values || []).filter(value => value !== null && value !== undefined && String(value).trim() !== "");
    return clean.slice(0, 5).map(value => String(value).slice(0, 80)).join(" · ") || "No readable cell values";
  }

  function mapRow(row) {
    let status;
    if (row.classification === "derived" || row.classification === "summary") status = "derived";
    else if (row.classification === "invalid") status = "invalid";
    else if (row.classification === "helper" || row.classification === "unmapped") status = "unmapped";
    else if (row.duplicate_status === "exact_source_duplicate" || row.import_status === "skipped_existing") status = "existing";
    else if (["oee", "dmp_production", "dmr_production", "product_entry", "production_entry", "production_schedule"].includes(currentBatch.module_key) && row.completeness_status === "incomplete") status = "incomplete";
    else if (["product_entry", "production_entry", "production_schedule", "dmr_production"].includes(currentBatch.module_key) && row.import_status === "held") status = "unmapped";
    else if (row.duplicate_status === "possible_duplicate" || row.import_status === "held") status = "possible";
    else if (row.completeness_status === "incomplete") status = "incomplete";
    else if (row.classification === "operational" && row.import_status === "pending") status = "ready";
    else status = "unmapped";

    const completeness = row.completeness_status === "complete" ? "Complete" :
      row.completeness_status === "incomplete" ? "Incomplete" : "Not assessed";
    const values = row.source_values || [];
    const first = valueSummary(values);
    return {
      id: ++numericId,
      dbId: row.id,
      row: row.source_row_number,
      sheet: safe(currentBatch.source_sheet_title),
      source: safe(row.source_locator),
      name: safe(first),
      detail: safe("Classification: " + row.classification + " · " + (row.source_formulas && Object.keys(row.source_formulas).length ? Object.keys(row.source_formulas).length + " formula cell(s)" : "No formulas recorded")),
      module: safe(params.get("targetLabel") || currentBatch.module_key),
      complete: completeness,
      status,
      fingerprint: safe(String(row.source_fingerprint || "").slice(0, 16)),
      reason: safe(row.review_reason || (row.missing_fields || []).join(", ") || "—"),
      rawValues: values
    };
  }

  function updateMetrics() {
    const metricLabels = document.querySelectorAll(".metrics .metric-label");
    ["Total staged", "Eligible rows loaded", "Incomplete loaded", "Duplicate candidates loaded", "Needs review loaded"].forEach((label, index) => { if (metricLabels[index]) metricLabels[index].textContent = label; });
    const count = Number(currentBatch && currentBatch.rows_staged || records.length);
    const ready = records.filter(row => row.status === "ready" ||
      (!["oee", "dmp_production", "dmr_production"].includes(currentBatch.module_key) && row.status === "incomplete")).length;
    const incomplete = records.filter(row => row.status === "incomplete").length;
    const existing = records.filter(row => ["existing", "possible"].includes(row.status)).length;
    const review = records.filter(row => ["unmapped", "invalid"].includes(row.status)).length;
    const metrics = document.querySelectorAll(".metrics .metric-value");
    [count, ready, incomplete, existing, review].forEach((value, index) => {
      if (metrics[index]) metrics[index].textContent = value.toLocaleString();
    });
  }

  function updateBatchHeader(batch) {
    currentBatch = batch;
    const title = document.querySelector(".batch-left strong");
    const meta = document.querySelector(".batch-left small");
    if (title) title.textContent = batch.batch_ref + " · " + (params.get("targetLabel") || batch.module_key);
    if (meta) meta.textContent = "Source workbook: " + batch.source_name + " · Worksheet: " + batch.source_sheet_title + " · " + batch.status;
    const metaItems = document.querySelectorAll(".batch-meta b");
    if (metaItems[0]) metaItems[0].textContent = batch.batch_ref;
    if (metaItems[1]) metaItems[1].textContent = batch.scanned_at ? new Date(batch.scanned_at).toLocaleString() : "Scan complete";
    if (metaItems[2]) metaItems[2].textContent = batch.source_type === "google_sheets" ? "GOOGLE SHEETS" : "XLSX";
    $("inbox-target-module").textContent = params.get("targetLabel") || batch.module_key;
    $("inbox-target-sheet").textContent = batch.source_sheet_title;
    $("inbox-target-id").textContent = String(batch.source_sheet_id);
    const note = document.querySelector(".preview-note");
    if (note) note.innerHTML = "<svg viewBox='0 0 24 24'><circle cx='12' cy='12' r='9'/><path d='M12 11v5M12 7h.01'/></svg><span><strong>Live TFI2 scan results.</strong> Only the approved worksheet for this destination was scanned. Source rows remain traceable to their original row numbers.</span>";
  }

  function ensureLoadMoreButton() {
    let button = $("load-more-import-rows");
    if (!button) {
      button = document.createElement("button");
      button.id = "load-more-import-rows";
      button.type = "button";
      button.className = "btn outline";
      button.style.cssText = "display:block;margin:14px auto 0";
      button.textContent = "Load next 200 rows";
      const tableCard = document.querySelector(".table-card");
      if (tableCard) tableCard.appendChild(button);
      button.addEventListener("click", loadNextPage);
    }
    button.hidden = !hasMore;
    button.disabled = loading;
    return button;
  }

  async function loadNextPage() {
    if (loading || (!hasMore && page > 1) || !batchId) return;
    loading = true;
    ensureLoadMoreButton().disabled = true;
    try {
      const response = await fetch("/api/import/batches/" + encodeURIComponent(batchId) + "/rows?page=" + page + "&page_size=200", {
        credentials: "same-origin",
        headers: { "Accept": "application/json" }
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to load the staged source rows.");
      (payload.rows || []).forEach(row => {
        const mapped = mapRow(row);
        records.push(mapped);
        if (selectedDbIds.has(row.id)) selected.add(mapped.id);
      });
      hasMore = Boolean(payload.has_more);
      page += 1;
      updateMetrics();
      render();
      const visible = $("visible-count");
      if (visible) visible.textContent = "Showing " + records.length.toLocaleString() + " loaded of " + Number(currentBatch.rows_staged || records.length).toLocaleString() + " staged rows";
      ensureLoadMoreButton();
    } catch (error) {
      toast(error.message || "The import inbox could not be loaded.");
    } finally {
      loading = false;
      ensureLoadMoreButton();
    }
  }

  function navigateToDuplicateReview(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!currentBatch) {
      toast("Open a completed scan batch before continuing.");
      return;
    }
    const selectedIds = Array.from(selected)
      .map(id => records.find(row => row.id === id))
      .filter(Boolean)
      .map(row => row.dbId);
    const query = new URLSearchParams({
      batchId,
      targetModule: params.get("targetModule") || "",
      moduleKey: currentBatch.module_key,
      targetLabel: params.get("targetLabel") || currentBatch.module_key,
      sourceWorksheet: currentBatch.source_sheet_title,
      sourceSheetId: String(currentBatch.source_sheet_id),
      sourceName: currentBatch.source_name,
      sourceType: currentBatch.source_type || params.get("sourceType") || "xlsx",
      selectedIds: selectedIds.join(",")
    });
    location.href = "duplicate-review-resolution-preview.html?" + query.toString();
  }

  const prepare = $("import-selected");
  if (prepare) prepare.addEventListener("click", navigateToDuplicateReview, true);
  const duplicate = $("open-duplicate-review");
  if (duplicate) duplicate.addEventListener("click", navigateToDuplicateReview, true);

  if (!batchId) {
    toast("No live batch was selected. Start a module-specific scan first.");
  } else {
    (async () => {
      try {
        const response = await fetch("/api/import/batches/" + encodeURIComponent(batchId), {
          credentials: "same-origin",
          headers: { "Accept": "application/json" }
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Unable to load the selected import batch.");
        updateBatchHeader(payload.batch);
        if (payload.batch.status !== "review") {
          toast(payload.batch.status === "scanning" ? "The scan is still running. Return to Scan Progress to monitor it." : "This batch is not ready for record review.");
          return;
        }
        await loadNextPage();
        if (!records.length) toast("The selected worksheet scan completed with no nonblank source rows.");
      } catch (error) {
        toast(error.message || "The import inbox could not be connected to TFI2.");
      }
    })();
  }
})();
