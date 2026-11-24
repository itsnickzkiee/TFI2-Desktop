/* Shared TFI2 adapter for Hourly Meat, Hourly Coding and Hourly Agri. */
(function () {
  "use strict";
  const moduleKey = document.body.dataset.tfiHourlyModule;
  const configs = {
    hourly_meat: { prefix: "hm", label: "Hourly Meat", pageSize: 100, mode: "meat" },
    hourly_coding: { prefix: "hc", label: "Hourly Coding", pageSize: 100, mode: "coding" },
    hourly_agri: { prefix: "ha", label: "Hourly Agri", pageSize: 100, mode: "agri" }
  };
  const cfg = configs[moduleKey];
  if (!cfg) return;
  const $ = id => document.getElementById(id);
  const state = { catalog: null, permissions: {}, page: 1, records: [], total: 0, hasMore: false, loading: false };
  let toastTimer;

  async function api(path, options) {
    const response = await fetch(path, Object.assign({
      credentials: "same-origin", cache: "no-store",
      headers: { "Content-Type": "application/json" }
    }, options || {}));
    let payload = {};
    try { payload = await response.json(); } catch (_) {}
    if (!response.ok) {
      const error = new Error(payload.error || (response.status === 401 || response.status === 403
        ? "Your TFI session or module permission is not active."
        : "TFI2 could not complete the Hourly Production request."));
      error.status = response.status; error.code = payload.code || "hourly_request_failed"; throw error;
    }
    return payload;
  }

  function toast(message, isError) {
    const el = $(cfg.prefix + "-toast") || $("toast");
    if (!el) return;
    el.textContent = message; el.hidden = false;
    el.classList.toggle("is-error", !!isError);
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 4500);
  }
  const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[ch]));
  const clean = value => value === "" || value === undefined ? null : value;
  const number = value => value === "" || value === null || value === undefined ? null : Number(value);

  function productOptions() {
    return (state.catalog?.products || []).map(item => ({
      code: String(item.code), name: String(item.name || "")
    }));
  }
  function updateProductOptions() {
    const options = productOptions();
    if (cfg.mode === "meat") {
      const selectOptions = '<option value=""></option>' + options.map(p =>
        '<option value="' + esc(p.code) + '">' + esc(p.code + " — " + p.name) + "</option>").join("");
      document.querySelectorAll("#hm-tbody .hm-code").forEach(select => {
        const selected = select.value; select.innerHTML = selectOptions; select.value = selected;
      });
    } else {
      const select = $("hc-filter-code") || $("ha-filter-code");
      if (select) {
        const current = select.value;
        select.innerHTML = '<option value="">All product codes</option>' + options.map(p =>
          '<option value="' + esc(p.code) + '">' + esc(p.code + " — " + p.name) + "</option>").join("");
        select.value = current;
      }
      document.querySelectorAll("#" + cfg.prefix + "-draft-rows select[data-field='code']").forEach(el => {
        const current = el.value;
        el.innerHTML = '<option value=""></option>' + options.map(p =>
          '<option value="' + esc(p.code) + '">' + esc(p.code + " — " + p.name) + "</option>").join("");
        el.value = current;
      });
    }
  }
  function permissions() {
    const p = state.permissions;
    if (cfg.mode === "meat") {
      if ($("hm-save")) $("hm-save").disabled = !p.create;
    } else {
      const save = $(cfg.prefix + "-save-draft");
      if (save) {
        save.disabled = !p.create;
        save.classList.toggle(cfg.prefix + "-save-locked", !p.create);
        save.textContent = p.create ? "SAVE RECORDS TO TFI2" : "SAVE NOT PERMITTED";
      }
    }
    document.body.dataset.tfiHourlyView = String(!!p.view);
    document.body.dataset.tfiHourlyCreate = String(!!p.create);
    document.body.dataset.tfiHourlyEdit = String(!!p.edit);
  }
  function summaryData(payload) {
    const s = payload.summary || {};
    return Object.assign({}, s, { product_codes_available: state.catalog?.product_code_count || productOptions().length });
  }
  function normalizedRecord(row) {
    return Object.assign({}, row, { record_date: row.production_date });
  }
  function setRows(payload) {
    const rows = (payload.records || []).map(normalizedRecord);
    state.records = rows; state.page = Number(payload.page || state.page);
    state.total = Number(payload.total_count || 0); state.hasMore = !!payload.has_more;
    const s = summaryData(payload);
    if (cfg.mode === "coding" && window.TFI_HOURLY_CODING_UI) {
      window.TFI_HOURLY_CODING_UI.setRecords(rows, s, state.page, state.total, state.hasMore);
    } else if (cfg.mode === "agri" && window.TFI_HOURLY_AGRI_UI) {
      window.TFI_HOURLY_AGRI_UI.setRecords(rows, s, state.page, state.total, state.hasMore);
    } else if (cfg.mode === "meat") {
      renderMeatRecords(rows, payload);
    }
    document.body.dataset.tfiHourlySource = "TFI2";
    const status = $("hm-saved-status") || $(cfg.prefix + "-history-meta");
    if (status) status.textContent = state.total
      ? "TFI2 connected · " + state.total.toLocaleString() + " saved record(s)."
      : "TFI2 connected · no saved records match the current filters.";
  }
  function queryForPage(page) {
    const prefix = cfg.prefix, q = new URLSearchParams({ page: String(page), page_size: String(cfg.pageSize) });
    const from = cfg.mode === "meat" ? $("hm-saved-from")?.value : $(prefix + "-filter-from")?.value;
    const to = cfg.mode === "meat" ? $("hm-saved-to")?.value : $(prefix + "-filter-to")?.value;
    const code = cfg.mode === "meat" ? $("hm-saved-code")?.value : $(prefix + "-filter-code")?.value;
    const search = cfg.mode === "meat" ? $("hm-saved-search")?.value : $(prefix + "-filter-search")?.value;
    if (from) q.set("date_from", from);
    if (to) q.set("date_to", to);
    if (code) q.set("product_code", code);
    if (search) q.set("search", search.trim());
    return q;
  }
  async function loadRecords(page) {
    if (state.loading) return;
    state.loading = true; state.page = Math.max(1, Number(page) || 1);
    const status = $("hm-saved-status") || $(cfg.prefix + "-history-meta");
    if (status) status.textContent = "Loading saved " + cfg.label + " records from TFI2…";
    try {
      const payload = await api("/api/hourly/" + moduleKey + "/records?" + queryForPage(state.page));
      setRows(payload);
    } catch (error) {
      document.body.dataset.tfiHourlySource = "UNAVAILABLE";
      if (status) status.textContent = error.message;
      toast(error.message, true);
    } finally { state.loading = false; }
  }

  function collectMeatRows() {
    return Array.from($("hm-tbody").querySelectorAll("tr")).map((row, index) => {
      const value = key => row.querySelector('[data-col="' + key + '"]').value;
      const data = {
        production_date: clean(value("A")), hour: number(value("B")),
        product_code: clean(value("C")), target_tins: number(value("D")),
        actual_tins: number(value("E")), remarks: clean(value("F").trim())
      };
      const filled = Object.values(data).some(v => v !== null && v !== "");
      return filled ? { row_index: index + 1, record_data: data } : null;
    }).filter(Boolean);
  }
  function collectDraftRows() {
    const body = $(cfg.prefix + "-draft-rows");
    return Array.from(body.querySelectorAll("tr")).map((row, index) => {
      const value = key => row.querySelector('[data-field="' + key + '"]').value;
      const data = {
        production_date: clean(value("date")), hour: number(value("hour")),
        product_code: clean(value("code").trim().toUpperCase()),
        target_tins: number(value("target")), actual_tins: number(value("actual")),
        remarks: clean(value("remarks").trim())
      };
      const filled = Object.values(data).some(v => v !== null && v !== "");
      return filled ? { row_index: index + 1, record_data: data } : null;
    }).filter(Boolean);
  }
  async function saveRecords() {
    if (!state.permissions.create) return toast("Your role does not have permission to create " + cfg.label + " records.", true);
    const records = cfg.mode === "meat" ? collectMeatRows() : collectDraftRows();
    if (!records.length) return toast("Enter at least one hourly production field before saving.", true);
    const button = $(cfg.mode === "meat" ? "hm-save" : cfg.prefix + "-save-draft");
    if (button) { button.disabled = true; button.textContent = "SAVING…"; }
    try {
      const result = await api("/api/hourly/" + moduleKey + "/records", {
        method: "POST", body: JSON.stringify({ records })
      });
      const outcomes = result.results || [];
      const cleared = new Set(outcomes.filter(x => x.status === "inserted" || x.status === "duplicate").map(x => Number(x.row_index)));
      if (cfg.mode === "meat") {
        $("hm-tbody").querySelectorAll("tr").forEach((row, i) => {
          if (cleared.has(i + 1)) row.querySelectorAll("input,select").forEach(el => { el.value = ""; });
        });
        $("hm-tbody").dispatchEvent(new Event("input", { bubbles: true }));
      } else {
        const body = $(cfg.prefix + "-draft-rows");
        Array.from(body.querySelectorAll("tr")).forEach((row, i) => {
          if (cleared.has(i + 1)) row.remove();
        });
        if (window.TFI_HOURLY_AGRI_UI || window.TFI_HOURLY_CODING_UI) {
          const remaining = body.querySelectorAll("tr");
          remaining.forEach((row, i) => {
            const numberCell = row.querySelector(".ha-rownum,.hc-rownum");
            if (numberCell) numberCell.textContent = i + 1;
          });
        }
        if (body.children.length === 0) $(cfg.prefix + "-draft-panel").hidden = true;
      }
      toast((result.inserted || 0) + " saved · " + (result.duplicates || 0) +
        " duplicate row(s) skipped · " + (result.empty || 0) + " blank row(s) ignored.");
      await loadRecords(1);
      if (window.TFI_HOURLY_ANALYTICS) await window.TFI_HOURLY_ANALYTICS.refresh();
    } catch (error) { toast(error.message, true); }
    finally {
      if (button) {
        button.disabled = !state.permissions.create;
        button.textContent = cfg.mode === "meat" ? "SAVE HOURLY RECORDS" : "SAVE RECORDS TO TFI2";
      }
    }
  }

  function modal(title, content) {
    let overlay = $("tfi-hourly-modal");
    if (!overlay) {
      overlay = document.createElement("div"); overlay.id = "tfi-hourly-modal";
      overlay.className = "tfi-hourly-modal"; overlay.hidden = true;
      overlay.innerHTML = '<div class="tfi-hourly-modal-card" role="dialog" aria-modal="true" aria-labelledby="tfi-hourly-modal-title"><div class="tfi-hourly-modal-head"><strong id="tfi-hourly-modal-title"></strong><button type="button" id="tfi-hourly-modal-close" aria-label="Close">×</button></div><div id="tfi-hourly-modal-body"></div></div>';
      document.body.appendChild(overlay);
      $("tfi-hourly-modal-close").addEventListener("click", () => { overlay.hidden = true; });
      overlay.addEventListener("click", event => { if (event.target === overlay) overlay.hidden = true; });
    }
    $("tfi-hourly-modal-title").textContent = title;
    $("tfi-hourly-modal-body").replaceChildren();
    $("tfi-hourly-modal-body").append(content);
    overlay.hidden = false;
    return overlay;
  }
  function createField(label, name, type, value, options) {
    const wrap = document.createElement("label"); wrap.className = "tfi-hourly-field";
    const span = document.createElement("span"); span.textContent = label; wrap.appendChild(span);
    let input;
    if (type === "select") {
      input = document.createElement("select");
      const blank = document.createElement("option"); blank.value = ""; blank.textContent = "Select product code"; input.appendChild(blank);
      productOptions().forEach(p => { const option = document.createElement("option"); option.value = p.code; option.textContent = p.code + " — " + p.name; input.appendChild(option); });
    } else { input = document.createElement("input"); input.type = type; }
    input.name = name;
    input.id = name === "actual_tins" ? "tfi-hourly-edit-actual" : "tfi-hourly-edit-" + name;
    input.value = value ?? "";
    if (type === "number") { input.min = "0"; input.step = "0.01"; }
    if (name === "hour") { input.min = "0"; input.max = "23"; }
    if (name === "remarks") input.maxLength = 400;
    wrap.appendChild(input); return wrap;
  }
  function openEdit(record) {
    if (!state.permissions.edit) return toast("Your role does not have edit permission for this module.", true);
    const form = document.createElement("form"); form.className = "tfi-hourly-edit-form";
    const fields = [
      ["Production Date", "production_date", "date", record.production_date],
      ["Hour (0–23)", "hour", "number", record.hour],
      ["Product Code", "product_code", "select", record.product_code],
      ["Target (tins)", "target_tins", "number", record.target_tins],
      ["Actual (tins)", "actual_tins", "number", record.actual_tins],
      ["Remarks", "remarks", "text", record.remarks]
    ];
    const grid = document.createElement("div"); grid.className = "tfi-hourly-field-grid";
    fields.forEach(item => grid.appendChild(createField(...item)));
    form.appendChild(grid);
    form.appendChild(createField("Reason for change (optional)", "change_reason", "text", ""));
    const actions = document.createElement("div"); actions.className = "tfi-hourly-modal-actions";
    const cancel = document.createElement("button"); cancel.type = "button"; cancel.textContent = "CANCEL";
    cancel.addEventListener("click", () => { $("tfi-hourly-modal").hidden = true; });
    const save = document.createElement("button"); save.type = "submit"; save.id = "tfi-hourly-edit-save"; save.textContent = "SAVE CHANGES";
    actions.append(cancel, save); form.appendChild(actions);
    form.addEventListener("submit", async event => {
      event.preventDefault(); save.disabled = true; save.textContent = "SAVING…";
      const formData = new FormData(form);
      const changes = {};
      fields.forEach(([, key, type]) => { changes[key] = formData.get(key); });
      try {
        const result = await api("/api/hourly/" + moduleKey + "/records/" + encodeURIComponent(record.id), {
          method: "PATCH",
          body: JSON.stringify({
            expected_version: Number(record.version), changes,
            change_reason: formData.get("change_reason") || null
          })
        });
        $("tfi-hourly-modal").hidden = true;
        toast(result.changed ? "Record updated. Revision history saved." : "No changes were needed.");
        await loadRecords(state.page);
        if (window.TFI_HOURLY_ANALYTICS) await window.TFI_HOURLY_ANALYTICS.refresh();
      } catch (error) { toast(error.message, true); save.disabled = false; save.textContent = "SAVE CHANGES"; }
    });
    modal("EDIT " + cfg.label.toUpperCase() + " RECORD", form);
  }
  async function openHistory(record) {
    const content = document.createElement("div"); content.className = "tfi-hourly-history"; content.id = "tfi-hourly-history-content";
    content.textContent = "Loading revision history…";
    modal(cfg.label.toUpperCase() + " · REVISION HISTORY", content);
    try {
      const result = await api("/api/hourly/" + moduleKey + "/records/" + encodeURIComponent(record.id) + "/revisions");
      content.replaceChildren();
      if (!result.revisions?.length) { content.textContent = "No revisions yet. The original saved record is unchanged."; return; }
      result.revisions.forEach(revision => {
        const card = document.createElement("article"); card.className = "tfi-hourly-revision";
        const title = document.createElement("strong");
        title.textContent = "Version " + revision.version + " · " + (revision.changed_fields || []).join(", ");
        const meta = document.createElement("small");
        meta.textContent = (revision.changed_at || "") + (revision.change_reason ? " · " + revision.change_reason : "");
        const detail = document.createElement("pre");
        detail.textContent = "BEFORE\n" + JSON.stringify(revision.before_data || {}, null, 2) +
          "\n\nAFTER\n" + JSON.stringify(revision.after_data || {}, null, 2);
        card.append(title, meta, detail); content.appendChild(card);
      });
    } catch (error) { content.textContent = error.message; }
  }

  function renderMeatRecords(rows, payload) {
    const body = $("hm-saved-tbody");
    if (!body) return;
    if (!rows.length) body.innerHTML = '<tr><td colspan="14">No saved Hourly Meat records match these filters.</td></tr>';
    else body.innerHTML = rows.map((r, i) => {
      const cells = [
        (i + 1 + (state.page - 1) * cfg.pageSize), r.production_date || "—",
        r.hour === null ? "—" : String(r.hour).padStart(2, "0"),
        r.product_code || "—", r.target_tins ?? "—", r.actual_tins ?? "—",
        r.remarks || "—", r.product_name || "—", r.time_slot || "—",
        r.variance_tins ?? "—", r.cumulative_target_tins ?? "—",
        r.cumulative_actual_tins ?? "—", r.hour_attainment == null ? "—" : Math.round(Number(r.hour_attainment) * 100) + "%"
      ];
      return '<tr>' + cells.map(value => '<td>' + esc(value) + '</td>').join("") +
        '<td><button type="button" data-hourly-action="edit" data-id="' + esc(r.id) + '">EDIT</button> ' +
        '<button type="button" data-hourly-action="history" data-id="' + esc(r.id) + '">HISTORY</button></td></tr>';
    }).join("");
    $("hm-saved-meta").textContent = (payload.total_count || 0) + " saved records";
    $("hm-saved-page").textContent = "Page " + state.page;
    $("hm-saved-prev").disabled = state.page <= 1;
    $("hm-saved-next").disabled = !state.hasMore;
    const filter = $("hm-saved-code");
    if (filter && filter.options.length <= 1) {
      filter.innerHTML = '<option value="">All product codes</option>' + productOptions().map(p =>
        '<option value="' + esc(p.code) + '">' + esc(p.code + " — " + p.name) + "</option>").join("");
    }
  }
  function loadPage(direction) {
    const next = direction === "prev" ? Math.max(1, state.page - 1) : state.page + 1;
    return loadRecords(next);
  }

  let meatLive=true;
  async function installMeatLiveMode(){
    const table=$("hm-table"), manual=$("hm-tbody"), saved=$("hm-saved-tbody");
    const oldTable=saved.closest("table"), oldWrap=oldTable.parentElement;
    const originalHead=table.querySelector("thead"), columns=table.querySelector("colgroup"), liveHead=oldTable.querySelector("thead");
    const controls=document.querySelector(".hm-saved-section"), toolbar=document.querySelector(".hm-toolbar");
    const summary=document.querySelector(".hm-summary"), footer=document.querySelector(".hm-table-footer");
    const heading=document.querySelector(".hm-table-heading");
    heading.before(controls);
    table.insertBefore(liveHead,manual);
    table.appendChild(saved);
    oldWrap.remove();
    const newButton=document.createElement("button");
    newButton.type="button";newButton.className="hm-btn hm-btn-primary";newButton.textContent="+ NEW ENTRY";
    newButton.disabled=!state.permissions.create;
    controls.querySelector(".hm-saved-heading").appendChild(newButton);
    const back=document.createElement("button");
    back.type="button";back.className="hm-btn hm-btn-light";back.textContent="BACK TO RECORDS";
    toolbar.querySelector(".hm-actions").prepend(back);
    async function mode(live){
      meatLive=live;
      for(const el of [manual,originalHead,columns,toolbar,summary,footer])el.style.display=live?"none":"";
      for(const el of [saved,liveHead,controls])el.style.display=live?"":"none";
      table.classList.toggle("tfi-hourly-live",live);
      heading.querySelector(".hm-empty-tag").textContent=live?"LIVE RECORDS":"MANUAL ENTRY";
      if(live)await loadRecords(1);
    }
    newButton.onclick=()=>mode(false);
    back.onclick=()=>mode(true);
    await mode(true);
  }
  async function init() {
    document.body.dataset.tfiHourlySource = "CONNECTING";
    try {
      const result = await api("/api/hourly/" + moduleKey + "/catalog");
      state.catalog = result.catalog || {};
      state.permissions = result.permissions || {};
      updateProductOptions(); permissions();
      document.body.dataset.tfiHourlyCatalog = String(state.catalog.product_code_count || 0);
      if (cfg.mode === "meat") await installMeatLiveMode(); else await loadRecords(1);
      if (window.TFI_HOURLY_ANALYTICS) await window.TFI_HOURLY_ANALYTICS.init({moduleKey, prefix:cfg.prefix, api, productOptions});
    } catch (error) {
      document.body.dataset.tfiHourlySource = "UNAVAILABLE";
      const status = $("hm-saved-status") || $(cfg.prefix + "-history-meta");
      if (status) status.textContent = error.message;
      permissions(); toast(error.message, true);
    } finally {
      document.body.dataset.tfiHourlyReady = "true";
    }
  }

  if (cfg.mode === "meat") {
    $("hm-save")?.addEventListener("click", saveRecords);
    $("hm-refresh")?.addEventListener("click", () => loadRecords(1));
    $("hm-saved-apply")?.addEventListener("click", () => loadRecords(1));
    $("hm-saved-prev")?.addEventListener("click", () => loadPage("prev"));
    $("hm-saved-next")?.addEventListener("click", () => loadPage("next"));
  } else {
    $(cfg.prefix + "-save-draft")?.addEventListener("click", saveRecords);
    $(cfg.prefix + "-apply-filters")?.addEventListener("click", () => loadRecords(1));
    $(cfg.prefix + "-reset-filters")?.addEventListener("click", () => loadRecords(1));
    $(cfg.prefix + "-filter-search")?.addEventListener("keydown", event => {
      if (event.key === "Enter") loadRecords(1);
    });
    $(cfg.prefix + "-page-prev")?.addEventListener("click", () => loadPage("prev"));
    $(cfg.prefix + "-page-next")?.addEventListener("click", () => loadPage("next"));
    $(cfg.prefix + "-history-rows")?.addEventListener("click", event => {
      const button = event.target.closest("button[data-hourly-action]");
      if (!button) return;
      const record = state.records.find(item => item.id === button.dataset.id);
      if (!record) return;
      if (button.dataset.hourlyAction === "edit") openEdit(record);
      if (button.dataset.hourlyAction === "history") openHistory(record);
    });
  }
  if (cfg.mode === "meat") {
    $("hm-saved-tbody")?.addEventListener("click", event => {
      const button = event.target.closest("button[data-hourly-action]");
      if (!button) return;
      const record = state.records.find(item => item.id === button.dataset.id);
      if (!record) return;
      if (button.dataset.hourlyAction === "edit") openEdit(record);
      if (button.dataset.hourlyAction === "history") openHistory(record);
    });
  }
  window.TFI_HOURLY_BACKEND = { loadPage, reload: () => loadRecords(1) };
  window.addEventListener("focus",()=>{if(state.permissions.view&&(cfg.mode!=="meat"||meatLive))loadRecords(state.page);});
  init();
})();