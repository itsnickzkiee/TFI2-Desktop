/* TFI2 OEE adapter: live catalog, manual CRUD, saved records and revision history. */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const state = {
    catalog: null, permissions: { view: false, create: false, edit: false },
    page: 1, pageSize: 100, total: 0, hasMore: false, loading: false,
    records: [], activeRecord: null
  };
  let toastTimer;

  const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
  const fmt = value => value === null || value === undefined || value === ""
    ? "—" : Number.isFinite(Number(value)) ? Number(value).toLocaleString("en-US", { maximumFractionDigits: 3 }) : String(value);
  const pct = value => value === null || value === undefined || value === "" ? "—" : (Number(value) * 100).toFixed(1) + "%";
  const clean = value => String(value ?? "").trim();

  async function api(path, options) {
    const response = await fetch(path, Object.assign({
      credentials: "same-origin", cache: "no-store",
      headers: { "Content-Type": "application/json" }
    }, options || {}));
    let payload = {};
    try { payload = await response.json(); } catch (_) {}
    if (!response.ok) {
      const error = new Error(payload.error || (response.status === 401 || response.status === 403
        ? "Your TFI session or OEE permission is not active."
        : "TFI2 could not complete the OEE request."));
      error.status = response.status;
      error.code = payload.code || "oee_request_failed";
      throw error;
    }
    return payload;
  }

  function toast(message, isError) {
    const el = $("oee-toast") || $("toast");
    if (!el) return;
    el.textContent = message;
    el.hidden = false;
    el.classList.toggle("is-error", !!isError);
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => { el.hidden = true; }, 4500);
  }

  function optionsHtml(items, valueKey, labelFn) {
    return '<option value=""></option>' + (items || []).map(item => {
      const value = typeof item === "string" ? item : item[valueKey];
      const label = labelFn ? labelFn(item) : value;
      return '<option value="' + esc(value) + '">' + esc(label) + '</option>';
    }).join("");
  }

  function machineOptionsHtml() {
    return optionsHtml(state.catalog?.machines || [], "name");
  }
  function lineOptionsHtml() {
    return optionsHtml(state.catalog?.lines || [], "name");
  }
  function productOptionsHtml() {
    return optionsHtml(state.catalog?.products || [], "code", item =>
      item.code + (item.name ? " — " + item.name : ""));
  }
  function productName(code) {
    const item = (state.catalog?.products || []).find(p => String(p.code) === String(code));
    return item ? (item.name || "Other") : "Other";
  }
  window.TFI_OEE_BACKEND = { machineOptionsHtml, lineOptionsHtml, productOptionsHtml, productName };

  function replaceOptions(select, html, keepValue) {
    if (!select) return;
    const current = keepValue ? select.value : "";
    select.innerHTML = html;
    if (current) select.value = current;
  }
  function applyCatalog() {
    if (!state.catalog) return;
    const machineHtml = machineOptionsHtml();
    const lineHtml = lineOptionsHtml();
    const productHtml = productOptionsHtml();
    document.querySelectorAll("#oee-tbody select.oee-machine").forEach(el => replaceOptions(el, machineHtml, true));
    document.querySelectorAll('#oee-tbody select[data-col="C"]').forEach(el => replaceOptions(el, lineHtml, true));
    document.querySelectorAll("#oee-tbody select.oee-code").forEach(el => replaceOptions(el, productHtml, true));
    replaceOptions($("oee-saved-machine"), '<option value="">All machines</option>' + machineHtml.replace(/^<option value=""><\/option>/, ""), true);
    replaceOptions($("oee-saved-line"), '<option value="">All lines</option>' + lineHtml.replace(/^<option value=""><\/option>/, ""), true);
    replaceOptions($("oee-saved-code"), '<option value="">All product codes</option>' + productHtml.replace(/^<option value=""><\/option>/, ""), true);
    if (window.TFI_OEE_UI) window.TFI_OEE_UI.recompute();
  }

  function setPermissions() {
    const p = state.permissions;
    const save = $("oee-save");
    if (save) {
      save.disabled = !p.create;
      save.title = p.create ? "" : "Your role does not have OEE create permission.";
    }
    document.body.dataset.tfiOeeSource = "TFI2";
    document.body.dataset.tfiOeeView = String(!!p.view);
    document.body.dataset.tfiOeeCreate = String(!!p.create);
    document.body.dataset.tfiOeeEdit = String(!!p.edit);
  }

  async function loadCatalog() {
    const result = await api("/api/oee/catalog");
    state.catalog = result.catalog || {};
    state.permissions = result.permissions || {};
    applyCatalog();
    setPermissions();
  }

  function query(page) {
    const q = new URLSearchParams({
      page: String(page || 1), page_size: String(state.pageSize)
    });
    const from = $("oee-saved-from")?.value;
    const to = $("oee-saved-to")?.value;
    const machine = $("oee-saved-machine")?.value;
    const line = $("oee-saved-line")?.value;
    const code = $("oee-saved-code")?.value;
    const search = clean($("oee-saved-search")?.value);
    if (from) q.set("date_from", from);
    if (to) q.set("date_to", to);
    if (machine) q.set("machine", machine);
    if (line) q.set("line", line);
    if (code) q.set("product_code", code);
    if (search) q.set("search", search);
    return q;
  }

  function renderRecords(payload) {
    const rows = payload.records || [];
    state.records = rows;
    state.page = Number(payload.page || state.page);
    state.total = Number(payload.total_count || 0);
    state.hasMore = !!payload.has_more;
    const body = $("oee-saved-tbody");
    if (!rows.length) {
      body.innerHTML = '<tr><td colspan="23" class="oee-empty">No saved OEE records match these filters.</td></tr>';
    } else {
      body.innerHTML = rows.map((r, i) => '<tr data-record-id="' + esc(r.id) + '">' +
        '<td>' + ((state.page - 1) * state.pageSize + i + 1) + '</td>' +
        '<td>' + esc(r.production_date) + '</td><td>' + esc(r.machine) + '</td><td>' + esc(r.line) + '</td>' +
        '<td>' + esc(r.product_code) + '</td>' +
        '<td>' + esc(fmt(r.planned_hours)) + '</td><td>' + esc(fmt(r.downtime_hours)) + '</td>' +
        '<td>' + esc(fmt(r.ideal_rate)) + '</td><td>' + esc(fmt(r.total_count)) + '</td>' +
        '<td>' + esc(fmt(r.reject_count)) + '</td><td>' + esc(r.include_in_overall) + '</td>' +
        '<td>' + esc(fmt(r.run_time_hours)) + '</td><td>' + esc(fmt(r.good_count)) + '</td>' +
        '<td>' + esc(pct(r.availability)) + '</td><td>' + esc(pct(r.performance)) + '</td>' +
        '<td>' + esc(pct(r.quality)) + '</td><td><strong>' + esc(pct(r.oee)) + '</strong></td>' +
        '<td>' + esc(fmt(r.ideal_output)) + '</td><td>' + esc(fmt(r.capped_count)) + '</td>' +
        '<td>' + esc(fmt(r.week)) + '</td><td>' + esc(fmt(r.month)) + '</td><td>' + esc(r.product_name || "Other") + '</td>' +
        '<td class="oee-row-actions">' +
          (state.permissions.edit ? '<button type="button" data-action="edit" data-id="' + esc(r.id) + '">EDIT</button>' : '') +
          '<button type="button" data-action="history" data-id="' + esc(r.id) + '">HISTORY</button>' +
        '</td></tr>').join("");
    }
    $("oee-saved-status").textContent = "TFI2 connected · " + state.total.toLocaleString() + " saved record(s).";
    $("oee-saved-meta").textContent = state.total.toLocaleString() + " record(s)";
    $("oee-saved-page").textContent = "Page " + state.page;
    $("oee-saved-prev").disabled = state.page <= 1;
    $("oee-saved-next").disabled = !state.hasMore;
  }

  async function loadRecords(page) {
    if (state.loading) return;
    state.loading = true;
    state.page = Math.max(1, Number(page) || 1);
    $("oee-saved-status").textContent = "Loading saved OEE records from TFI2…";
    try {
      renderRecords(await api("/api/oee/records?" + query(state.page)));
    } catch (error) {
      $("oee-saved-status").textContent = error.message;
      document.body.dataset.tfiOeeSource = "UNAVAILABLE";
      toast(error.message, true);
    } finally { state.loading = false; }
  }

  function collectRows() {
    return Array.from($("oee-tbody").querySelectorAll("tr")).map((row, index) => {
      const get = key => row.querySelector('[data-col="' + key + '"]')?.value ?? "";
      const data = {
        production_date: clean(get("A")), machine: clean(get("B")), line: clean(get("C")),
        product_code: clean(get("D")), planned_hours: clean(get("E")), downtime_hours: clean(get("F")),
        ideal_rate: clean(get("G")), total_count: clean(get("H")), reject_count: clean(get("I")),
        include_in_overall: clean(get("J"))
      };
      const filled = Object.values(data).some(value => value !== "");
      return filled ? { row_index: index + 1, record_data: data } : null;
    }).filter(Boolean);
  }

  async function saveRows() {
    if (!state.permissions.create) return toast("Your role does not have permission to create OEE records.", true);
    const records = collectRows();
    if (!records.length) return toast("Enter at least one OEE input row before saving.", true);
    const button = $("oee-save");
    button.disabled = true;
    const original = button.textContent;
    button.textContent = "SAVING…";
    try {
      const result = await api("/api/oee/records", {
        method: "POST", body: JSON.stringify({ records })
      });
      const inserted = Number(result.inserted || 0);
      const duplicates = Number(result.duplicates || 0);
      const outcomes = new Map((result.results || []).map(item => [Number(item.row_index), item.status]));
      $("oee-tbody").querySelectorAll("tr").forEach((row, i) => {
        if (outcomes.get(i + 1) === "inserted" || outcomes.get(i + 1) === "duplicate") {
          row.querySelectorAll("input,select").forEach(el => { el.value = ""; });
        }
      });
      if (window.TFI_OEE_UI) window.TFI_OEE_UI.recompute();
      toast(inserted + " record(s) saved · " + duplicates + " exact duplicate(s) skipped.");
      await loadRecords(1);
    } catch (error) {
      toast(error.message, true);
    } finally {
      button.textContent = original;
      button.disabled = !state.permissions.create;
    }
  }

  function ensureModal() {
    if ($("oee-modal")) return;
    const modal = document.createElement("div");
    modal.id = "oee-modal";
    modal.className = "oee-modal";
    modal.hidden = true;
    modal.innerHTML = '<section class="oee-modal-card" role="dialog" aria-modal="true" aria-labelledby="oee-modal-title">' +
      '<header class="oee-modal-head"><strong id="oee-modal-title">OEE RECORD</strong>' +
      '<button type="button" id="oee-modal-close" aria-label="Close">×</button></header>' +
      '<div id="oee-modal-body" class="oee-modal-body"></div></section>';
    document.body.appendChild(modal);
    $("oee-modal-close").addEventListener("click", closeModal);
    modal.addEventListener("click", event => { if (event.target === modal) closeModal(); });
  }
  function openModal(title, html) {
    ensureModal();
    $("oee-modal-title").textContent = title;
    $("oee-modal-body").innerHTML = html;
    $("oee-modal").hidden = false;
  }
  function closeModal() {
    if ($("oee-modal")) $("oee-modal").hidden = true;
    state.activeRecord = null;
  }

  function editForm(record) {
    state.activeRecord = record;
    const fields = [
      ["production_date", "Production Date", "date", record.production_date],
      ["machine", "Machine", "select-machine", record.machine],
      ["line", "Line", "select-line", record.line],
      ["product_code", "Product Code", "select-code", record.product_code],
      ["planned_hours", "Planned Time (hrs)", "number", record.planned_hours],
      ["downtime_hours", "Downtime (hrs)", "number", record.downtime_hours],
      ["ideal_rate", "Ideal Rate (units/hr)", "number", record.ideal_rate],
      ["total_count", "Total Count", "number", record.total_count],
      ["reject_count", "Reject Count", "number", record.reject_count],
      ["include_in_overall", "Include in Overall OEE", "select-include", record.include_in_overall]
    ];
    const fieldHtml = fields.map(([key, label, type, value]) => {
      let control;
      if (type === "select-machine") control = '<select name="' + key + '">' + machineOptionsHtml() + '</select>';
      else if (type === "select-line") control = '<select name="' + key + '">' + lineOptionsHtml() + '</select>';
      else if (type === "select-code") control = '<select name="' + key + '">' + productOptionsHtml() + '</select>';
      else if (type === "select-include") control = '<select name="' + key + '"><option value="Y">Y</option><option value="N">N</option></select>';
      else control = '<input name="' + key + '" type="' + type + '" ' + (type === "number" ? 'min="0" step="any"' : '') + '>';
      return '<label class="oee-edit-field"><span>' + esc(label) + '</span>' + control + '</label>';
    }).join("");
    openModal("EDIT OEE RECORD · VERSION " + record.version,
      '<form id="oee-edit-form"><div class="oee-edit-grid">' + fieldHtml + '</div>' +
      '<label class="oee-edit-reason"><span>Reason for change (optional)</span><input name="change_reason" maxlength="500" type="text" placeholder="Explain why this record is being corrected"></label>' +
      '<div class="oee-modal-actions"><button type="button" class="oee-btn oee-btn-light" id="oee-edit-cancel">CANCEL</button>' +
      '<button type="submit" class="oee-btn oee-btn-primary" id="oee-edit-submit">SAVE CHANGES</button></div></form>');
    const form = $("oee-edit-form");
    fields.forEach(([key, , , value]) => { form.elements[key].value = value ?? ""; });
    $("oee-edit-cancel").addEventListener("click", closeModal);
    form.addEventListener("submit", submitEdit);
  }

  async function submitEdit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const record = state.activeRecord;
    if (!record || !state.permissions.edit) return toast("You do not have permission to edit OEE records.", true);
    const changes = {};
    ["production_date", "machine", "line", "product_code", "planned_hours", "downtime_hours",
      "ideal_rate", "total_count", "reject_count", "include_in_overall"].forEach(key => {
      changes[key] = form.elements[key].value;
    });
    const reason = form.elements.change_reason.value.trim();
    const button = $("oee-edit-submit");
    button.disabled = true;
    button.textContent = "SAVING…";
    try {
      await api("/api/oee/records/" + encodeURIComponent(record.id), {
        method: "PATCH",
        body: JSON.stringify({ expected_version: Number(record.version), changes, change_reason: reason || null })
      });
      closeModal();
      toast("OEE record updated. Revision history was recorded.");
      await loadRecords(state.page);
    } catch (error) {
      button.disabled = false;
      button.textContent = "SAVE CHANGES";
      toast(error.message, true);
    }
  }

  async function showHistory(recordId) {
    openModal("OEE REVISION HISTORY", '<p class="oee-modal-loading">Loading revision history…</p>');
    try {
      const result = await api("/api/oee/records/" + encodeURIComponent(recordId) + "/revisions");
      const revisions = result.revisions || [];
      if (!revisions.length) {
        $("oee-modal-body").innerHTML = '<p class="oee-modal-empty">No revisions have been recorded for this OEE entry.</p>';
        return;
      }
      $("oee-modal-body").innerHTML = '<div class="oee-history-list">' + revisions.map(rev =>
        '<article class="oee-revision"><strong>Version ' + esc(rev.version) + '</strong>' +
        '<small>' + esc(rev.changed_at || "") + ' · ' + esc(rev.change_reason || "No reason supplied") + '</small>' +
        '<p>Changed fields: ' + esc((rev.changed_fields || []).join(", ")) + '</p>' +
        '<details><summary>Before and after values</summary><pre>' +
        esc(JSON.stringify({ before: rev.before_data, after: rev.after_data }, null, 2)) +
        '</pre></details></article>').join("") + '</div>';
    } catch (error) {
      $("oee-modal-body").innerHTML = '<p class="oee-modal-error">' + esc(error.message) + '</p>';
    }
  }

  function bind() {
    $("oee-save")?.addEventListener("click", saveRows);
    $("oee-refresh")?.addEventListener("click", () => loadRecords(1));
    $("oee-saved-apply")?.addEventListener("click", () => loadRecords(1));
    $("oee-saved-prev")?.addEventListener("click", () => loadRecords(state.page - 1));
    $("oee-saved-next")?.addEventListener("click", () => loadRecords(state.page + 1));
    $("oee-saved-tbody")?.addEventListener("click", event => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;
      const id = button.dataset.id;
      const record = state.records.find(item => String(item.id) === String(id));
      if (button.dataset.action === "edit" && record) editForm(record);
      if (button.dataset.action === "history") showHistory(id);
    });
    $("oee-saved-search")?.addEventListener("keydown", event => {
      if (event.key === "Enter") loadRecords(1);
    });
  }

  let mainLive=true;
  function installMainLiveTable(){
    const prefix="oee",table=$(prefix+"-table"),manual=$(prefix+"-tbody"),saved=$("oee-saved-tbody");
    const panel=document.querySelector(".oee-saved-section"),heading=document.querySelector("."+prefix+"-table-heading"),toolbar=document.querySelector("."+prefix+"-toolbar");
    const summary=document.querySelector("."+prefix+"-summary"),footer=document.querySelector("."+prefix+"-table-footer");
    const oldTable=saved.closest("table"),oldWrap=oldTable.parentElement;
    const manualHead=table.querySelector("thead"),cols=table.querySelector("colgroup"),liveHead=manualHead.cloneNode(true);
    const top=liveHead.rows[0],bottom=liveHead.rows[liveHead.rows.length-1];
    const action=document.createElement("th");action.textContent="Actions";
    if(top!==bottom){action.rowSpan=liveHead.rows.length;top.appendChild(action);}else bottom.appendChild(action);
    const liveCols=cols?.cloneNode(true);
    if(liveCols){const c=document.createElement("col");c.style.width="200px";liveCols.appendChild(c);table.insertBefore(liveCols,manualHead);}
    table.insertBefore(liveHead,manual);table.appendChild(saved);oldWrap.remove();heading.before(panel);
    const open=document.createElement("button"),back=document.createElement("button");
    for(const b of [open,back]){b.type="button";b.className=prefix+"-btn "+prefix+"-btn-light";}
    open.textContent="+ NEW ENTRY";back.textContent="BACK TO RECORDS";
    open.disabled=!("oee"==="oee"?state.permissions.create:permissions.create);
    panel.querySelector(".oee-saved-heading").appendChild(open);
    toolbar.querySelector("."+prefix+"-actions").prepend(back);
    const legacy=$(prefix+"-toggle-register");if(legacy)legacy.style.display="none";
    function mode(live){
      mainLive=live;
      for(const el of [manual,manualHead,cols,toolbar,summary,footer])if(el)el.style.display=live?"none":"";
      for(const el of [saved,liveHead,liveCols])if(el)el.style.display=live?"":"none";
      panel.hidden=!live;panel.style.display=live?"":"none";
      table.classList.toggle("tfi-main-live-table",live);
      const tag=heading.querySelector("."+prefix+"-empty-tag");if(tag)tag.textContent=live?"LIVE RECORDS":"MANUAL ENTRY";
      if(live)loadRecords(1);
    }
    open.onclick=()=>mode(false);back.onclick=()=>mode(true);
    const css=document.createElement("style");css.textContent=".tfi-main-live-table td{padding:8px!important;white-space:normal}.tfi-main-live-table td:last-child{min-width:190px;white-space:nowrap}.tfi-main-live-table td:last-child button{margin:3px;padding:6px 9px}.tfi-main-live-table{width:max-content!important;min-width:100%;table-layout:fixed!important}";document.head.appendChild(css);
    mode(true);
    window.addEventListener("focus",()=>{if(mainLive)loadRecords(1);});
  }
  async function init() {
    bind();
    try {
      await loadCatalog(); installMainLiveTable();
    } catch (error) {
      $("oee-saved-status").textContent = error.message;
      document.body.dataset.tfiOeeSource = "UNAVAILABLE";
      toast(error.message, true);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
