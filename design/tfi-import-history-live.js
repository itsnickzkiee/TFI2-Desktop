(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[c]);
  function mapBatch(batch) {
    const created = batch.created_at ? new Date(batch.created_at) : new Date();
    const finished = batch.completed_at || batch.scanned_at;
    const duration = finished
      ? Math.max(0, Math.round((new Date(finished).getTime() - created.getTime()) / 1000)) + " sec"
      : "In progress";
    const status = batch.status === "completed" ? "completed" :
      batch.status === "failed" ? "failed" : "partial";
    const userId = batch.created_by ? String(batch.created_by) : "";
    return {
      id: batch.batch_ref || batch.id,
      file: batch.source_name || "Workbook",
      source: String(batch.source_type || "xlsx").toUpperCase(),
      date: created.toLocaleDateString(),
      time: created.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      timestamp: created.toISOString(),
      user: userId ? "User · " + userId.slice(0, 8) : "Authenticated user",
      rows: Number(batch.rows_staged || 0),
      imported: Number(batch.rows_inserted || 0),
      incomplete: Number(batch.rows_incomplete || 0),
      duplicates: Number(batch.rows_duplicates || 0),
      held: Number(batch.rows_held || 0),
      failed: Number(batch.rows_failed || 0),
      status,
      duration,
      modules: [[batch.module_key, Number(batch.rows_inserted || 0), Number(batch.rows_incomplete || 0),
        Number(batch.rows_duplicates || 0) + Number(batch.rows_held || 0), Number(batch.rows_failed || 0)]],
      sourceSheet: batch.source_sheet_title,
      error: batch.error_message || ""
    };
  }

  async function loadHistory() {
    const body = $("history-rows");
    if (body) body.innerHTML = "<tr><td colspan='10'><div class='history-empty'><strong>Loading import history…</strong><span>Retrieving batches available to your TFI account.</span></div></td></tr>";
    try {
      const response = await fetch("/api/import/batches?limit=200", {
        credentials: "same-origin", headers: { "Accept": "application/json" }
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to retrieve import history.");
      const mapped = (payload.batches || []).map(mapBatch);
      batches.splice(0, batches.length, ...mapped);
      labels.partial = "Review / issues";
      render();
      $("metric-batches").textContent = mapped.length.toLocaleString();
      $("metric-imported").textContent = mapped.reduce((sum, batch) => sum + batch.imported, 0).toLocaleString();
      $("metric-incomplete").textContent = mapped.reduce((sum, batch) => sum + batch.incomplete, 0).toLocaleString();
      $("metric-exceptions").textContent = mapped.reduce((sum, batch) => sum + batch.duplicates + batch.held + batch.failed, 0).toLocaleString();
      const note = document.querySelector(".preview-note");
      if (note) note.innerHTML = "<span>ⓘ</span><span><strong>Live, read-only import history.</strong> " + mapped.length + " batch(es) are available from TFI2. This page only displays recorded outcomes and never modifies operational data.</span>";
      if (!mapped.length) {
        const foot = $("table-foot-note");
        if (foot) foot.textContent = "No import batches have been recorded for modules available to your account.";
      }
    } catch (error) {
      if (body) body.innerHTML = "<tr><td colspan='10'><div class='history-empty'><strong>Import history could not be loaded.</strong><span>" + escapeHtml(error.message) + "</span></div></td></tr>";
      const foot = $("table-foot-note");
      if (foot) foot.textContent = error.message || "Import history service unavailable.";
    }
  }
  loadHistory();
})();
