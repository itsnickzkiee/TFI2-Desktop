(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const batchId = params.get("batchId");
  const selectedIds = [...new Set((params.get("selectedIds") || "").split(",").filter(Boolean))];
  const state = { rows: [], active: null, filter: "all", loading: false };
  const status = row => {
    if (row.duplicate_status === "exact_source_duplicate" || row.review_decision === "skip_duplicate") return "duplicate";
    if (row.review_decision === "import_as_new" || row.duplicate_status === "distinct_new") return "distinct";
    if (row.review_decision === "hold" || row.import_status === "held") return "hold";
    if (row.duplicate_status === "possible_duplicate") return "pending";
    return "none";
  };
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[c]);
  const notify = message => {
    const el = $("review-toast");
    if (!el) return;
    el.textContent = message;
    el.classList.add("show");
    window.setTimeout(() => el.classList.remove("show"), 2800);
  };
  const shortId = value => value ? String(value).slice(0, 8).toUpperCase() + "…" : "Same-batch source match";
  const rowSummary = row => (row.source_values || [])
    .map((value, index) => value === null || value === "" ? null : String.fromCharCode(65 + index) + ": " + String(value).slice(0, 60))
    .filter(Boolean).slice(0, 4).join(" · ") || "No readable values";

  function setContext(batch) {
    const label = params.get("targetLabel") || batch.module_key;
    $("target-module").textContent = label;
    $("target-sheet").textContent = batch.source_sheet_title;
    $("target-sheet-id").textContent = String(batch.source_sheet_id);
    $("batch-title").textContent = "Duplicate review · " + label;
    $("batch-meta").textContent = "Source workbook: " + batch.source_name + " · Worksheet: " + batch.source_sheet_title;
    $("batch-id").textContent = batch.batch_ref;
    $("batch-destination").textContent = label;
    const note = document.querySelector(".preview-note");
    if (note) note.innerHTML = "<span>ⓘ</span><span><strong>Live TFI2 duplicate review.</strong> Only incoming rows are eligible for a decision. Existing operational records remain read-only and are never changed by this screen.</span>";
  }

  function render() {
    const candidates = state.rows.filter(row => row.duplicate_status === "possible_duplicate" ||
      row.duplicate_status === "distinct_new" || row.duplicate_status === "confirmed_duplicate" ||
      row.duplicate_status === "exact_source_duplicate");
    const query = ($("candidate-search")?.value || "").trim().toLowerCase();
    const filtered = candidates.filter(row => {
      const s = status(row);
      if (state.filter === "pending" && s !== "pending") return false;
      if (state.filter === "resolved" && !["duplicate", "distinct"].includes(s)) return false;
      if (state.filter === "hold" && s !== "hold") return false;
      if (state.filter === "high" || state.filter === "medium") return false;
      return !query || (String(row.source_row_number) + " " + row.source_locator + " " +
        rowSummary(row) + " " + (row.duplicate_record_id || "")).toLowerCase().includes(query);
    });

    const body = $("candidate-rows");
    body.innerHTML = filtered.map(row => {
      const s = status(row);
      const labels = {
        pending: ["Pending review", "pending-status"],
        duplicate: ["Confirmed duplicate · excluded", "duplicate-status"],
        distinct: ["Distinct new · eligible", "distinct-status"],
        hold: ["On hold · excluded", "hold-status"],
        none: ["No review needed", "hold-status"]
      };
      const meta = labels[s] || labels.none;
      const action = s === "pending" ? "Review & resolve" : "View decision";
      const evidence = row.duplicate_status === "exact_source_duplicate" ? "Exact source row already imported" : "Matching source fingerprint";
      return "<tr><td><strong class='row-primary'>" + escapeHtml(row.source_sheet_title || params.get("sourceWorksheet") || "Source") +
        " · Row " + row.source_row_number + "</strong><small class='row-secondary'>" + escapeHtml(rowSummary(row)) +
        "</small></td><td><strong class='row-primary'>" + escapeHtml(shortId(row.duplicate_record_id)) +
        "</strong><small class='row-secondary'>" + (row.duplicate_record_id ? "Existing record reference · read-only" : "Another staged row may share this fingerprint") +
        "</small></td><td><span class='confidence confidence-medium'>" +
        (row.duplicate_status === "exact_source_duplicate" ? "Exact source match" : "Potential match") +
        "</span></td><td><strong class='evidence-count'>" + evidence +
        "</strong><small class='row-secondary'>Fingerprint " + escapeHtml(String(row.source_fingerprint || "").slice(0, 12)) + "…</small></td><td><span class='review-status " +
        meta[1] + "'>" + meta[0] + "</span></td><td><button class='action-link' type='button' data-live-review='" +
        escapeHtml(row.id) + "'>" + action + "</button></td></tr>";
    }).join("") || "<tr><td colspan='6'><div class='inbox-empty'><strong>" +
      (candidates.length ? "No candidates match this filter." : "No possible duplicate candidates in the selected rows.") +
      "</strong><span>" + (candidates.length ? "Try another status or clear your search." : "Selected operational rows can proceed to final approval. Exact source duplicates are automatically excluded.") +
      "</span></div></td></tr>";

    const pending = candidates.filter(row => status(row) === "pending").length;
    const resolved = candidates.filter(row => ["duplicate", "distinct"].includes(status(row))).length;
    const held = candidates.filter(row => status(row) === "hold").length;
    const duplicates = candidates.filter(row => status(row) === "duplicate").length;
    const distinct = candidates.filter(row => status(row) === "distinct").length;
    $("candidate-count").textContent = candidates.length + " actual duplicate candidate(s)";
    $("metric-total").textContent = candidates.length;
    $("metric-high").textContent = candidates.filter(row => row.duplicate_status === "exact_source_duplicate").length;
    $("metric-medium").textContent = candidates.filter(row => row.duplicate_status === "possible_duplicate" || row.duplicate_status === "distinct_new" || row.duplicate_status === "confirmed_duplicate").length;
    $("metric-hold").textContent = held;
    $("resolution-progress").textContent = resolved + " of " + candidates.length + " candidates resolved";
    $("resolution-note").textContent = pending + " pending · " + held + " on hold · " + duplicates + " excluded as duplicates · " + distinct + " cleared as distinct new rows";
    $("queue-foot").textContent = pending ? pending + " candidate(s) still require an Admin decision." :
      held ? held + " candidate(s) remain on hold and will be excluded from this import." :
      "All possible matches have a recorded decision.";
    $("continue-approval").disabled = pending > 0 || !selectedIds.length;
    const labels = document.querySelectorAll(".duplicate-metrics .metric-label");
    ["Selected rows", "Exact source matches", "Possible matches", "On hold"].forEach((label, i) => { if (labels[i]) labels[i].textContent = label; });
  }

  async function fetchRows() {
    if (!batchId || !selectedIds.length) throw new Error("No source rows were selected. Return to Import Inbox and select the rows to review.");
    if (selectedIds.length > 1000) throw new Error("Select no more than 1,000 rows for one review batch.");
    const collected = [];
    for (let start = 0; start < selectedIds.length; start += 200) {
      const ids = selectedIds.slice(start, start + 200);
      const response = await fetch("/api/import/batches/" + encodeURIComponent(batchId) +
        "/rows?ids=" + encodeURIComponent(ids.join(",")) + "&page_size=200", {
          credentials: "same-origin", headers: { "Accept": "application/json" }
        });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to retrieve the selected import rows.");
      collected.push(...(payload.rows || []));
    }
    state.rows = collected;
  }

  function openReview(rowId) {
    const row = state.rows.find(item => item.id === rowId);
    if (!row) return;
    state.active = row;
    const s = status(row);
    $("review-modal-sub").textContent = "Source row " + row.source_row_number + " · " + row.source_locator;
    $("modal-confidence").textContent = row.duplicate_status === "exact_source_duplicate" ? "Exact source match" : "Potential fingerprint match";
    $("modal-evidence").textContent = "SHA-256 source fingerprint";
    $("modal-status").textContent = s === "pending" ? "Pending review" : s === "hold" ? "On hold" : s === "distinct" ? "Cleared as new" : "Excluded as duplicate";
    $("modal-incoming-title").textContent = (params.get("sourceWorksheet") || "Source worksheet") + " · Row " + row.source_row_number;
    $("modal-incoming-meta").textContent = rowSummary(row);
    $("modal-existing-title").textContent = row.duplicate_record_id ? "Existing record · " + row.duplicate_record_id : "Possible same-batch source row";
    $("modal-existing-meta").textContent = "Reference only · existing operational data is read-only";
    const headers = document.querySelectorAll(".comparison-table thead th");
    ["Source column", "Incoming value", "Existing record data", "Evidence"].forEach((value, i) => { if (headers[i]) headers[i].textContent = value; });
    $("comparison-rows").innerHTML = (row.source_values || []).map((value, index) =>
      "<tr><td>Column " + String.fromCharCode(65 + index) + "</td><td>" + escapeHtml(value ?? "—") +
      "</td><td>Not exposed in this review</td><td><span class='field-result field-match'>" +
      (row.source_formulas && row.source_formulas[String.fromCharCode(65 + index)] ? "Formula preserved" : "Source value captured") +
      "</span></td></tr>").join("") || "<tr><td colspan='4'>No source values available.</td></tr>";
    $("decision-reason").value = row.review_reason || "";
    $("choose-duplicate").disabled = s !== "pending";
    $("choose-distinct").disabled = s !== "pending" || row.duplicate_status === "exact_source_duplicate";
    $("choose-hold").disabled = s !== "pending";
    $("review-modal").classList.add("open");
    $("review-modal").setAttribute("aria-hidden", "false");
  }

  function closeReview() {
    $("review-modal").classList.remove("open");
    $("review-modal").setAttribute("aria-hidden", "true");
    state.active = null;
  }

  async function decide(decision) {
    const row = state.active;
    if (!row || !batchId) return;
    const reason = $("decision-reason").value.trim();
    if (decision === "import_as_new" && !reason) {
      notify("Add a short reason before clearing this possible match as a new record.");
      $("decision-reason").focus();
      return;
    }
    const buttons = ["choose-duplicate", "choose-distinct", "choose-hold"].map($);
    buttons.forEach(button => button.disabled = true);
    try {
      const response = await fetch("/api/import/batches/" + encodeURIComponent(batchId) +
        "/rows/" + encodeURIComponent(row.id) + "/decision", {
          method: "POST", credentials: "same-origin",
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
          body: JSON.stringify({ decision, reason: reason || null })
        });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "The duplicate-review decision could not be saved.");
      row.review_decision = payload.review_decision;
      row.review_reason = reason || null;
      row.duplicate_status = payload.duplicate_status;
      row.import_status = payload.import_status;
      closeReview();
      render();
      notify("The incoming source row decision was saved.");
    } catch (error) {
      notify(error.message || "Unable to save the review decision.");
    } finally {
      buttons.forEach(button => button.disabled = false);
    }
  }

  function backToInbox() {
    const query = new URLSearchParams({
      batchId, targetModule: params.get("targetModule") || "", moduleKey: params.get("moduleKey") || "",
      targetLabel: params.get("targetLabel") || "", sourceWorksheet: params.get("sourceWorksheet") || "",
      sourceSheetId: params.get("sourceSheetId") || "", sourceName: params.get("sourceName") || "",
      sourceType: params.get("sourceType") || "xlsx", selectedIds: selectedIds.join(",")
    });
    location.href = "central-import-inbox-preview.html?" + query.toString();
  }

  function continueToApproval() {
    if ($("continue-approval").disabled) return;
    const candidates = state.rows.filter(row => row.duplicate_status === "possible_duplicate");
    if (candidates.some(row => !row.review_decision)) {
      notify("Resolve every possible duplicate before final approval.");
      return;
    }
    const summary = {
      batchId, targetModule: params.get("targetModule") || "", moduleKey: params.get("moduleKey") || "",
      targetLabel: params.get("targetLabel") || "", sourceWorksheet: params.get("sourceWorksheet") || "",
      sourceSheetId: params.get("sourceSheetId") || "", sourceName: params.get("sourceName") || "",
      sourceType: params.get("sourceType") || "xlsx", selectedIds: selectedIds.join(","), duplicateReviewComplete: "1",
      confirmedDuplicates: String(state.rows.filter(row => row.review_decision === "skip_duplicate" || row.duplicate_status === "exact_source_duplicate").length),
      approvedNew: String(state.rows.filter(row => row.review_decision === "import_as_new").length),
      onHold: String(state.rows.filter(row => row.review_decision === "hold").length),
      pending: String(candidates.filter(row => !row.review_decision).length)
    };
    location.href = "import-confirmation-results-preview.html?" + new URLSearchParams(summary).toString();
  }

  document.querySelectorAll(".tabs [data-filter]").forEach(button => {
    button.addEventListener("click", event => {
      event.preventDefault(); event.stopImmediatePropagation();
      state.filter = button.dataset.filter;
      document.querySelectorAll(".tabs [data-filter]").forEach(item => item.classList.toggle("active", item === button));
      render();
    }, true);
  });
  $("candidate-search").addEventListener("input", event => { event.stopImmediatePropagation(); render(); }, true);
  $("candidate-rows").addEventListener("click", event => {
    const button = event.target.closest("[data-live-review]");
    if (!button) return;
    event.preventDefault(); event.stopImmediatePropagation();
    openReview(button.dataset.liveReview);
  }, true);
  ["back-inbox", "back-inbox-bottom"].forEach(id => $(id).addEventListener("click", event => {
    event.preventDefault(); event.stopImmediatePropagation(); backToInbox();
  }, true));
  $("continue-approval").addEventListener("click", event => {
    event.preventDefault(); event.stopImmediatePropagation(); continueToApproval();
  }, true);
  $("choose-duplicate").addEventListener("click", event => {
    event.preventDefault(); event.stopImmediatePropagation(); decide("skip_duplicate");
  }, true);
  $("choose-distinct").addEventListener("click", event => {
    event.preventDefault(); event.stopImmediatePropagation(); decide("import_as_new");
  }, true);
  $("choose-hold").addEventListener("click", event => {
    event.preventDefault(); event.stopImmediatePropagation(); decide("hold");
  }, true);

  (async () => {
    try {
      const response = await fetch("/api/import/batches/" + encodeURIComponent(batchId), {
        credentials: "same-origin", headers: { "Accept": "application/json" }
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to load the selected import batch.");
      setContext(payload.batch);
      await fetchRows();
      render();
      if (!selectedIds.length) notify("Return to Import Inbox and select the source rows you want to review.");
    } catch (error) {
      $("candidate-rows").innerHTML = "<tr><td colspan='6'><div class='inbox-empty'><strong>Live duplicate review is unavailable.</strong><span>" +
        escapeHtml(error.message || "Unable to connect to the import service.") + "</span></div></td></tr>";
      $("continue-approval").disabled = true;
      notify(error.message || "Unable to load duplicate review.");
    }
  })();
})();
