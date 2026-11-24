(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const batchId = params.get("batchId");
  const rowIds = [...new Set((params.get("selectedIds") || "").split(",").filter(Boolean))];
  const state = { batch: null, rows: [], submitted: false };

  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[c]);
  const notify = message => {
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = message;
    document.body.appendChild(el);
    window.setTimeout(() => el.remove(), 3200);
  };
  const label = () => params.get("targetLabel") || (state.batch && state.batch.module_key) || "Selected module";
  const valuesText = row => (row.source_values || []).map((v, i) =>
    v === null || v === "" ? null : String.fromCharCode(65 + i) + ": " + String(v).slice(0, 50)
  ).filter(Boolean).slice(0, 4).join(" · ") || "No source values";

  function rowDecision(row) {
    if (row.import_status === "inserted") return "Imported";
    if (row.import_status === "skipped_existing" || row.duplicate_status === "exact_source_duplicate" || row.duplicate_status === "confirmed_duplicate") return "Excluded · duplicate";
    if (row.import_status === "held" || row.review_decision === "hold") return "On hold · not imported";
    if (row.import_status === "failed") return "Failed";
    if (row.import_status === "excluded" || row.classification !== "operational") return "Excluded · " + row.classification;
    if (row.duplicate_status === "possible_duplicate" && !row.review_decision) return "Pending duplicate review";
    if (row.completeness_status === "incomplete") return "Ready · incomplete";
    return "Ready for import";
  }

  function setPreviewNote(message) {
    const note = document.querySelector("#confirm-view .preview-note");
    if (note) note.innerHTML = "<span>ⓘ</span><span><strong>Live TFI2 import confirmation.</strong> " + esc(message) + "</span>";
  }

  function renderRows() {
    const complete = state.rows.filter(row => row.completeness_status === "complete").length;
    const incomplete = state.rows.filter(row => row.completeness_status === "incomplete").length;
    const operational = state.rows.filter(row => row.classification === "operational").length;
    const modules = new Set(state.rows.map(row => state.batch.module_key));
    $("metric-selected").textContent = state.rows.length.toLocaleString();
    $("metric-complete").textContent = complete.toLocaleString();
    $("metric-incomplete").textContent = incomplete.toLocaleString();
    $("metric-modules").textContent = modules.size.toLocaleString();
    $("summary-selected").textContent = state.rows.length.toLocaleString();
    $("bottom-selected").textContent = state.rows.length.toLocaleString() + " selected source row(s) · " + operational.toLocaleString() + " operational";
    $("confirm-rows").innerHTML = state.rows.map(row => {
      const status = rowDecision(row);
      const css = status.startsWith("Ready") ? (row.completeness_status === "incomplete" ? "incomplete" : "ready") : "";
      return "<tr><td><span class='name'>" + esc(state.batch.source_sheet_title) + " · Row " + row.source_row_number +
        "</span><span class='sub'>" + esc(row.source_locator) + "</span></td><td>" + esc(valuesText(row)) +
        "<span class='sub'>" + esc(row.classification) + " · " + esc(row.completeness_status) + "</span></td><td><span class='module'>" +
        esc(label()) + "</span></td><td><span class='status " + css + "'>" + esc(row.completeness_status) +
        "</span></td><td><span class='status " + css + "'>" + esc(status) + "</span></td></tr>";
    }).join("") || "<tr><td colspan='5'><div class='confirm-empty'><strong>No selected rows are available.</strong><span>Return to Import Inbox and select rows before final approval.</span></div></td></tr>";
    $("module-breakdown").innerHTML = "<div class='summary-row'><span>" + esc(label()) + "</span><strong>" +
      operational.toLocaleString() + " operational · " + (state.rows.length - operational).toLocaleString() + " excluded from insert</strong></div>";
    const summaries = document.querySelectorAll("#confirm-view .side-content .summary-row strong");
    if (summaries[0]) summaries[0].textContent = state.batch.source_name;
    if (summaries[1]) summaries[1].textContent = state.batch.batch_ref;
    $("ack-check").disabled = false;
    $("ack-check").checked = false;
    $("ack-check").nextElementSibling.textContent = "I confirm that the selected incoming rows are intended for " + label() + ". Existing records will not be updated, merged, replaced, or overwritten.";
    $("confirm-import").disabled = true;
    $("confirm-import").textContent = "Confirm import of " + state.rows.length.toLocaleString() + " selected rows";
    const cardStatus = document.querySelector("#confirm-view .card-head .status");
    if (cardStatus) cardStatus.textContent = state.rows.length + " selected";
    setPreviewNote(state.batch.module_key === "production_schedule"
      ? "Select all populated slots. The schedule saves as one daily form after every slot passes validation."
      : ["oee", "dmp_production", "dmr_production"].includes(state.batch.module_key)
      ? "Valid rows can be saved. Incomplete rows stay in the Import Inbox. Invalid rows and existing duplicates are excluded."
      : "The selected source rows are loaded from the staged batch. Incomplete operational rows remain eligible; derived, helper, invalid, and existing duplicate rows are excluded by the server.");
  }

  async function loadRows() {
    if (!batchId) throw new Error("No import batch was selected. Return to Import Inbox and choose a batch.");
    if (!rowIds.length) throw new Error("No source rows were selected. Return to Import Inbox and select the records to import.");
    if (rowIds.length > 1000) throw new Error("Select no more than 1,000 rows for one final approval.");
    const detailResponse = await fetch("/api/import/batches/" + encodeURIComponent(batchId), {
      credentials: "same-origin", headers: { "Accept": "application/json" }
    });
    const detail = await detailResponse.json();
    if (!detailResponse.ok) throw new Error(detail.error || "Unable to load the selected batch.");
    state.batch = detail.batch;
    const destinationsResponse = await fetch("/api/import/destinations", {
      credentials: "same-origin", headers: { "Accept": "application/json" }
    });
    const destinationsPayload = await destinationsResponse.json();
    if (!destinationsResponse.ok) {
      throw new Error(destinationsPayload.error || "Unable to verify the destination approval contract.");
    }
    const destination = (destinationsPayload.destinations || []).find(
      item => item.module_key === state.batch.module_key
    );
    if (!destination) {
      throw new Error("This module is not registered as an active import destination.");
    }
    if (destination.contract_status !== "approved") {
      const title = destination.source_sheet_title || state.batch.module_key;
      if (destination.contract_status === "hold_pending_business_rule") {
        throw new Error(title + " is not open for final import. Its business-rule mapping must be approved first.");
      }
      throw new Error(title + " is available for source review in the Import Inbox. Operational approval is pending.");
    }
    const collected = [];
    for (let start = 0; start < rowIds.length; start += 200) {
      const ids = rowIds.slice(start, start + 200);
      const response = await fetch("/api/import/batches/" + encodeURIComponent(batchId) +
        "/rows?ids=" + encodeURIComponent(ids.join(",")) + "&page_size=200", {
          credentials: "same-origin", headers: { "Accept": "application/json" }
        });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to load selected source rows.");
      collected.push(...(payload.rows || []));
    }
    state.rows = collected;
    if (state.rows.length !== rowIds.length) {
      throw new Error("Some selected rows are no longer available in this batch. Return to the inbox and refresh your selection.");
    }
    if (state.batch.status !== "review") throw new Error("This batch is not in the review state required for final approval.");
    renderRows();
  }

  function backToInbox() {
    const query = new URLSearchParams({
      batchId, targetModule: params.get("targetModule") || "", moduleKey: params.get("moduleKey") || state.batch?.module_key || "",
      targetLabel: params.get("targetLabel") || "", sourceWorksheet: params.get("sourceWorksheet") || "",
      sourceSheetId: params.get("sourceSheetId") || "", sourceName: params.get("sourceName") || "",
      sourceType: state.batch?.source_type || params.get("sourceType") || "xlsx", selectedIds: rowIds.join(",")
    });
    location.href = "central-import-inbox-preview.html?" + query.toString();
  }

  async function finalize() {
    if (state.submitted || !state.batch) return;
    const unresolved = state.rows.filter(row => row.duplicate_status === "possible_duplicate" && !row.review_decision);
    if (unresolved.length) {
      notify("Resolve all possible duplicates before final import approval.");
      return;
    }
    state.submitted = true;
    $("confirm-import").disabled = true;
    $("confirm-import").textContent = "Submitting approved rows…";
    try {
      const response = await fetch("/api/import/batches/" + encodeURIComponent(batchId) + "/finalize", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ row_ids: rowIds })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "The final import could not be completed.");
      const refreshedRows = [];
      for (let start = 0; start < rowIds.length; start += 200) {
        const ids = rowIds.slice(start, start + 200);
        const refreshResponse = await fetch("/api/import/batches/" + encodeURIComponent(batchId) +
          "/rows?ids=" + encodeURIComponent(ids.join(",")) + "&page_size=200", {
            credentials: "same-origin", headers: { "Accept": "application/json" }
          });
        const refreshed = await refreshResponse.json();
        if (refreshResponse.ok) refreshedRows.push(...(refreshed.rows || []));
      }
      if (refreshedRows.length) state.rows = refreshedRows;
      showResults(result);
    } catch (error) {
      state.submitted = false;
      $("confirm-import").disabled = !$("ack-check").checked;
      $("confirm-import").textContent = "Confirm import of " + state.rows.length.toLocaleString() + " selected rows";
      notify(error.message || "The import service could not be reached.");
    }
  }

  function showResults(result) {
    $("confirm-view").style.display = "none";
    $("results-view").style.display = "block";
    $("crumb-current").textContent = "Import Results";
    const statusText = result.status === "completed" ? "Completed successfully" :
      result.status === "completed_with_issues" ? "Completed with issues" : "Batch remains in review";
    const heading = document.querySelector("#results-view .heading h1");
    if (heading) heading.textContent = "Import Results · " + result.batch_ref;
    const bannerTitle = document.querySelector("#results-view .result-banner h2");
    if (bannerTitle) bannerTitle.textContent = statusText;
    $("result-message").textContent =
      (result.rows_inserted || 0) + " new operational row(s) inserted; " +
      (result.rows_duplicates || 0) + " duplicate(s) excluded; " +
      (result.rows_held || 0) + " row(s) held; " +
      (result.rows_incomplete || 0) + (["oee", "dmp_production", "dmr_production"].includes(state.batch.module_key)
        ? " incomplete record(s) retained in the Import Inbox. "
        : " incomplete record(s) included. ") +
      ((result.rows_pending || 0) ? "Unselected rows remain pending in this batch." : "");
    $("result-success").textContent = Number(result.rows_inserted || 0).toLocaleString();
    $("result-incomplete").textContent = Number(result.rows_incomplete || 0).toLocaleString();
    const resultCards = document.querySelectorAll("#results-view .result-card small");
    if (resultCards[0]) resultCards[0].textContent = "Rows inserted into the selected module";
    if (resultCards[1]) resultCards[1].textContent = "Incomplete records safely retained";
    if (resultCards[2]) resultCards[2].textContent = Number(result.rows_failed || 0).toLocaleString() + " failed";
    const statusPill = document.querySelector("#results-view .heading .status");
    if (statusPill) statusPill.textContent = result.status;
    $("result-rows").innerHTML = state.rows.map(row => {
      const outcome = rowDecision(row);
      return "<tr><td><span class='name'>" + esc(state.batch.source_sheet_title) + " · Row " + row.source_row_number +
        "</span><span class='sub'>" + esc(valuesText(row)) + "</span></td><td>" + esc(label()) +
        "</td><td>" + esc(row.completeness_status) + "</td><td>" + esc(outcome) + "</td></tr>";
    }).join("") || "<tr><td colspan='4'>No row-level outcomes were returned.</td></tr>";
    const note = document.querySelector("#results-view .preview-note");
    if (note) note.innerHTML = "<span>ⓘ</span><span><strong>Verified server result.</strong> The final import used only the selected row IDs. Existing destination records were not updated or overwritten.</span>";
    notify(statusText);
  }

  $("ack-check").addEventListener("change", event => {
    if (!state.submitted) $("confirm-import").disabled = !event.target.checked;
  }, true);
  $("confirm-import").addEventListener("click", event => {
    event.preventDefault(); event.stopImmediatePropagation();
    if (!$("ack-check").checked) {
      notify("Check the confirmation box before importing.");
      return;
    }
    finalize();
  }, true);
  ["back-inbox", "cancel-confirm", "result-inbox"].forEach(id => $(id).addEventListener("click", event => {
    event.preventDefault(); event.stopImmediatePropagation(); backToInbox();
  }, true));
  $("result-scan").addEventListener("click", event => {
    event.preventDefault(); event.stopImmediatePropagation();
    location.href = "spreadsheet-import-center-preview.html";
  }, true);

  loadRows().catch(error => {
    setPreviewNote(error.message || "The import confirmation service is unavailable.");
    $("confirm-rows").innerHTML = "<tr><td colspan='5'><div class='confirm-empty'><strong>Final approval is unavailable.</strong><span>" + esc(error.message) + "</span></div></td></tr>";
    $("ack-check").disabled = true;
    $("confirm-import").disabled = true;
    notify(error.message || "Unable to load final import approval.");
  });
})();
