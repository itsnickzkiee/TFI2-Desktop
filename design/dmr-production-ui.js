(function () {
  "use strict";

  const DATA = window.TFI_DMR_PRODUCTION_DATA;
  if (!DATA) throw new Error("DMR Production source lists were not loaded.");
  const $ = id => document.getElementById(id);
  const state = {
    catalog: null, permissions: { view: false, create: false, edit: false },
    page: 1, pageSize: 25, records: [], hasMore: false,
    editRecord: null, loading: false
  };
  let rowCount = 12;
  let toastTimer;

  const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));

  async function api(path, options) {
    const response = await fetch(path, Object.assign({
      credentials: "same-origin",
      cache: "no-store",
      headers: { "Content-Type": "application/json" }
    }, options || {}));
    let payload = {};
    try { payload = await response.json(); } catch (_) {}
    if (!response.ok) {
      const error = new Error(payload.error || (
        response.status === 401 || response.status === 403
          ? "Your TFI session or DMR Production permission is not active."
          : "TFI2 could not complete the DMR Production request."
      ));
      error.status = response.status;
      error.code = payload.code || "dmr_production_request_failed";
      throw error;
    }
    return payload;
  }

  function toast(message, error) {
    const el = $("dmr-toast");
    el.textContent = message;
    el.hidden = false;
    el.classList.toggle("is-error", !!error);
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => { el.hidden = true; }, 4500);
  }

  function setOptions(select, items, blankLabel) {
    if (!select) return;
    select.replaceChildren();
    if (blankLabel !== null) {
      const blank = document.createElement("option");
      blank.value = "";
      blank.textContent = blankLabel || "";
      select.appendChild(blank);
    }
    (items || []).forEach(item => {
      const value = typeof item === "string" ? item : item.code;
      const label = typeof item === "string"
        ? item
        : (item.code + (item.description ? " — " + item.description : ""));
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      select.appendChild(option);
    });
  }

  function fillDatalist(id, values) {
    const list = $(id);
    list.replaceChildren();
    (values || []).forEach(value => {
      const option = document.createElement("option");
      option.value = value;
      list.appendChild(option);
    });
  }

  function categoryOptions() {
    return state.catalog?.categories || DATA.categories;
  }
  function additionalOptions() {
    return state.catalog?.additional_options || DATA.additionalOptions;
  }
  function productNames() {
    return state.catalog?.product_names || DATA.productNames;
  }

  const columns = [
    { key: "A", label: "Date" }, { key: "B", label: "Product Code" },
    { key: "C", label: "Line" }, { key: "D", label: "Stop" },
    { key: "E", label: "Resume" }, { key: "F", label: "Total in Min." },
    { key: "G", label: "Total in Hrs." }, { key: "H", label: "Category" },
    { key: "I", label: "" }, { key: "J", label: "" },
    { key: "K", label: "Remarks" }, { key: "L", label: "Product Name (auto)" }
  ];

  function rowField(column, row) {
    const aria = esc((column.label || ("Source column " + column.key)) + " row " + row);
    if (column.key === "B") {
      return '<td><input class="dmr-cell dmr-code" data-col="B" type="text" list="dmr-product-codes" maxlength="100" aria-label="' + aria + '"></td>';
    }
    if (column.key === "C") {
      return '<td><input class="dmr-cell dmr-line" data-col="C" type="text" list="dmr-lines" maxlength="120" aria-label="' + aria + '"></td>';
    }
    if (column.key === "D" || column.key === "E") {
      return '<td><input class="dmr-cell dmr-time" data-col="' + column.key + '" type="time" aria-label="' + aria + '"></td>';
    }
    if (column.key === "F" || column.key === "G" || column.key === "L") {
      return '<td class="dmr-derived-cell"><input class="dmr-cell dmr-derived" data-col="' + column.key + '" type="text" readonly tabindex="-1" aria-label="' + aria + '"></td>';
    }
    if (column.key === "H") {
      return '<td><select class="dmr-cell dmr-select" data-col="H" aria-label="' + aria + '">' +
        '<option value=""></option>' + categoryOptions().map(item =>
          '<option value="' + esc(item.code) + '">' + esc(item.code + " — " + item.description) + '</option>'
        ).join("") + '</select></td>';
    }
    if (column.key === "I" || column.key === "J") {
      return '<td><select class="dmr-cell dmr-select dmr-extra" data-col="' + column.key + '" aria-label="' + aria + '" title="Original source column ' + column.key + '; header is blank">' +
        '<option value=""></option>' + additionalOptions().map(value =>
          '<option value="' + esc(value) + '">' + esc(value) + '</option>'
        ).join("") + '</select></td>';
    }
    if (column.key === "K") {
      return '<td><input class="dmr-cell dmr-remarks" data-col="K" type="text" maxlength="1000" aria-label="' + aria + '"></td>';
    }
    return "<td></td>";
  }

  function rowHtml(index) {
    return '<tr data-row="' + index + '"><th class="dmr-rownum">' + index + '</th>' +
      '<td><input class="dmr-cell dmr-date" data-col="A" type="date" aria-label="Date row ' + index + '"></td>' +
      columns.slice(1).map(column => rowField(column, index)).join("") + '</tr>';
  }

  function getTimeMinutes(value) {
    if (!value) return null;
    const match = /^(\d{2}):(\d{2})$/.exec(value);
    return match ? Number(match[1]) * 60 + Number(match[2]) : null;
  }

  function duration(stop, resume) {
    const start = getTimeMinutes(stop), end = getTimeMinutes(resume);
    if (start === null || end === null) return null;
    return (end - start + 1440) % 1440;
  }

  function recalc(row) {
    const code = row.querySelector('[data-col="B"]').value.trim();
    row.querySelector('[data-col="L"]').value = code
      ? (productNames()[code] || "Other") : "";
    const minutes = duration(
      row.querySelector('[data-col="D"]').value,
      row.querySelector('[data-col="E"]').value
    );
    row.querySelector('[data-col="F"]').value = minutes === null ? "" : String(minutes);
    row.querySelector('[data-col="G"]').value = minutes === null ? "" : (minutes / 60).toFixed(4);
  }

  function hasData(row) {
    return ["A", "B", "C", "D", "E", "H", "I", "J", "K"].some(key => {
      const element = row.querySelector('[data-col="' + key + '"]');
      return element && String(element.value || "").trim() !== "";
    });
  }

  function updateFormSummary() {
    const rows = Array.from($("dmr-tbody").querySelectorAll("tr"));
    const filled = rows.filter(hasData);
    let minutes = 0;
    rows.forEach(row => {
      const value = row.querySelector('[data-col="F"]').value;
      if (value !== "" && Number.isFinite(Number(value))) minutes += Number(value);
    });
    $("dmr-filled-rows").textContent = String(filled.length);
    $("dmr-total-min").textContent = String(Number(minutes.toFixed(2)));
    $("dmr-total-hrs").textContent = (minutes / 60).toFixed(4);
    $("dmr-table-status").textContent = filled.length + " of " + rows.length +
      " entry rows contain data · new records save to TFI2";
    $("dmr-entry-rows").textContent = String(rows.length);
  }

  function handleFormEdit(event) {
    const row = event.target.closest("tr");
    if (!row) return;
    if (["B", "D", "E"].includes(event.target.dataset.col)) recalc(row);
    updateFormSummary();
  }

  function buildRows(count) {
    $("dmr-tbody").replaceChildren();
    $("dmr-tbody").innerHTML = Array.from({ length: count }, (_, index) => rowHtml(index + 1)).join("");
    updateFormSummary();
  }

  function addRows() {
    const start = rowCount;
    rowCount += 12;
    for (let index = start; index < rowCount; index++) {
      $("dmr-tbody").insertAdjacentHTML("beforeend", rowHtml(index + 1));
    }
    updateFormSummary();
    toast("12 blank DMR entry rows added.");
  }

  function clearForm() {
    $("dmr-tbody").querySelectorAll("input,select").forEach(element => { element.value = ""; });
    updateFormSummary();
    toast("The form was cleared. No saved records were changed.");
  }

  function collectFormRecords() {
    const rows = Array.from($("dmr-tbody").querySelectorAll("tr")).filter(hasData);
    return rows.map(row => {
      const recordData = {};
      ["A", "B", "C", "D", "E", "H", "I", "J", "K"].forEach(key => {
        recordData[key] = row.querySelector('[data-col="' + key + '"]').value;
      });
      return { row_index: Number(row.dataset.row), record_data: recordData };
    });
  }

  async function saveForm() {
    if (!state.permissions.create) {
      toast("Your TFI role does not have DMR Production create permission.", true);
      return;
    }
    const records = collectFormRecords();
    if (!records.length) {
      toast("Enter at least one DMR downtime record before saving.", true);
      return;
    }
    const missing = records.find(item =>
      ["A", "B", "C", "D", "E", "H"].some(key => !String(item.record_data[key] || "").trim())
    );
    if (missing) {
      toast("Complete Date, Product Code, Line, Stop, Resume, and Category in entry row " + missing.row_index + ".", true);
      return;
    }
    const button = $("dmr-save");
    button.disabled = true;
    button.textContent = "SAVING…";
    try {
      const result = await api("/api/dmr-production/records", {
        method: "POST",
        body: JSON.stringify({ records })
      });
      const outcomes = result.results || [];
      const clearRows = new Set(outcomes
        .filter(item => item.status === "inserted" || item.status === "duplicate")
        .map(item => Number(item.row_index)));
      $("dmr-tbody").querySelectorAll("tr").forEach(row => {
        if (clearRows.has(Number(row.dataset.row))) {
          row.querySelectorAll("input,select").forEach(element => { element.value = ""; });
        }
      });
      updateFormSummary();
      toast(
        (result.inserted || 0) + " saved · " + (result.duplicates || 0) +
        " exact duplicate(s) skipped · " + (result.conflicts || 0) + " conflict(s) kept for review."
      );
      await loadRecords(1);
    } catch (error) {
      toast(error.message, true);
    } finally {
      button.disabled = !state.permissions.create;
      button.textContent = "SAVE DMR RECORD";
    }
  }

  function formatDate(value) {
    if (!value) return "";
    const raw = String(value).slice(0, 10);
    const parsed = new Date(raw + "T12:00:00");
    return Number.isNaN(parsed.getTime())
      ? raw
      : parsed.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
  }

  function formatTime(value) {
    return value ? String(value).slice(0, 5) : "";
  }

  function renderSavedRecords() {
    const body = $("dmr-saved-tbody");
    body.replaceChildren();
    if (!state.records.length) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 14;
      td.className = "dmr-empty";
      td.textContent = "No saved DMR records match these filters. New entries will appear here after saving.";
      tr.appendChild(td);
      body.appendChild(tr);
    } else {
      state.records.forEach((record,index) => {
        const tr = document.createElement("tr");
        const minutes = Number(record.downtime_minutes || 0);
        const num=document.createElement("th");num.className="dmr-rownum";num.textContent=String((state.page-1)*state.pageSize+index+1);tr.appendChild(num);
        const values = [
          formatDate(record.production_date), record.product_code,
          productNames()[record.product_code] || "Other", record.line,
          formatTime(record.stop_time), formatTime(record.resume_time),
          Number.isFinite(minutes) ? minutes.toFixed(2) : "",
          Number.isFinite(minutes) ? (minutes / 60).toFixed(4) : "",
          record.category, record.source_column_i || "", record.source_column_j || "",
          record.remarks || ""
        ];
        values.forEach(value => {
          const td = document.createElement("td");
          td.textContent = String(value ?? "");
          tr.appendChild(td);
        });
        const actionCell = document.createElement("td");
        const actions = document.createElement("div");
        actions.className = "dmr-row-actions";
        if (state.permissions.edit) {
          const edit = document.createElement("button");
          edit.type = "button";
          edit.textContent = "EDIT";
          edit.dataset.action = "edit";
          edit.dataset.id = record.id;
          actions.appendChild(edit);
        }
        const history = document.createElement("button");
        history.type = "button";
        history.textContent = "HISTORY";
        history.dataset.action = "history";
        history.dataset.id = record.id;
        actions.appendChild(history);
        actionCell.appendChild(actions);
        tr.appendChild(actionCell);
        body.appendChild(tr);
      });
    }
    $("dmr-page-label").textContent = "Page " + state.page;
    $("dmr-prev").disabled = state.loading || state.page <= 1;
    $("dmr-next").disabled = state.loading || !state.hasMore;
  }

  function buildRecordQuery(page) {
    const query = new URLSearchParams({
      page: String(page),
      page_size: String(state.pageSize)
    });
    const filters = {
      date_from: $("dmr-filter-from").value,
      date_to: $("dmr-filter-to").value,
      product_code: $("dmr-filter-code").value.trim(),
      line: $("dmr-filter-line").value.trim(),
      category: $("dmr-filter-category").value
    };
    Object.entries(filters).forEach(([key, value]) => {
      if (value) query.set(key, value);
    });
    return query;
  }

  async function loadRecords(page) {
    state.page = Math.max(1, Number(page) || 1);
    state.loading = true;
    $("dmr-saved-status").textContent = "Loading saved DMR records from TFI2…";
    renderSavedRecords();
    try {
      const query = buildRecordQuery(state.page);
      const payload = await api("/api/dmr-production/records?" + query.toString());
      state.records = payload.records || [];
      state.page = Number(payload.page || state.page);
      state.hasMore = !!payload.has_more;
      $("dmr-saved-status").textContent = state.records.length
        ? "TFI2 connected · " + state.records.length + " saved downtime record(s) on this page."
        : "TFI2 connected · no saved DMR records match the current filters.";
      document.body.dataset.tfiDmrSource = "TFI2";
      document.body.dataset.tfiDmrRows = String(state.records.length);
    } catch (error) {
      state.records = [];
      state.hasMore = false;
      $("dmr-saved-status").textContent = error.message;
      document.body.dataset.tfiDmrSource = "UNAVAILABLE";
      toast(error.message, true);
    } finally {
      state.loading = false;
      renderSavedRecords();
    }
  }

  function fillEditModal(record) {
    state.editRecord = record;
    $("dmr-edit-date").value = String(record.production_date || "").slice(0, 10);
    $("dmr-edit-code").value = record.product_code || "";
    $("dmr-edit-line").value = record.line || "";
    $("dmr-edit-stop").value = formatTime(record.stop_time);
    $("dmr-edit-resume").value = formatTime(record.resume_time);
    $("dmr-edit-category").value = record.category || "";
    $("dmr-edit-i").value = record.source_column_i || "";
    $("dmr-edit-j").value = record.source_column_j || "";
    $("dmr-edit-remarks").value = record.remarks || "";
    $("dmr-edit-reason").value = "";
    $("dmr-edit-modal").hidden = false;
    $("dmr-edit-date").focus();
  }

  function closeEditModal() {
    $("dmr-edit-modal").hidden = true;
    state.editRecord = null;
  }

  async function saveEdit(event) {
    event.preventDefault();
    const record = state.editRecord;
    if (!record) return;
    const changes = {
      A: $("dmr-edit-date").value,
      B: $("dmr-edit-code").value,
      C: $("dmr-edit-line").value,
      D: $("dmr-edit-stop").value,
      E: $("dmr-edit-resume").value,
      H: $("dmr-edit-category").value,
      I: $("dmr-edit-i").value,
      J: $("dmr-edit-j").value,
      K: $("dmr-edit-remarks").value
    };
    const button = $("dmr-edit-save");
    button.disabled = true;
    button.textContent = "SAVING…";
    try {
      const result = await api("/api/dmr-production/records/" + encodeURIComponent(record.id), {
        method: "PATCH",
        body: JSON.stringify({
          expected_version: Number(record.version),
          changes,
          change_reason: $("dmr-edit-reason").value
        })
      });
      closeEditModal();
      toast(result.changed ? "DMR record updated. A new revision was recorded." : "No changes were needed.");
      await loadRecords(state.page);
    } catch (error) {
      toast(error.message, true);
    } finally {
      button.disabled = false;
      button.textContent = "SAVE CHANGES";
    }
  }

  async function openHistory(recordId) {
    $("dmr-history-content").textContent = "Loading revision history from TFI2…";
    $("dmr-history-modal").hidden = false;
    try {
      const payload = await api("/api/dmr-production/records/" + encodeURIComponent(recordId) + "/revisions");
      const revisions = payload.revisions || [];
      const container = $("dmr-history-content");
      container.replaceChildren();
      if (!revisions.length) {
        container.textContent = "No edits have been made to this record yet.";
        return;
      }
      revisions.forEach(revision => {
        const card = document.createElement("div");
        card.className = "dmr-history-item";
        const heading = document.createElement("strong");
        heading.textContent = "Version " + revision.version + " · " + (revision.changed_fields || []).join(", ");
        const meta = document.createElement("small");
        meta.textContent = (revision.changed_at || "") + (revision.change_reason ? " · " + revision.change_reason : "");
        const detail = document.createElement("p");
        detail.textContent = "Before: " + JSON.stringify(revision.before_data || {}) +
          "\nAfter: " + JSON.stringify(revision.after_data || {});
        card.append(heading, meta, detail);
        container.appendChild(card);
      });
    } catch (error) {
      $("dmr-history-content").textContent = error.message;
    }
  }

  async function loadCatalog() {
    const payload = await api("/api/dmr-production/catalog");
    state.catalog = payload.catalog || {};
    state.permissions = payload.permissions || state.permissions;
    fillDatalist("dmr-lines", state.catalog.lines || DATA.lines);
    fillDatalist("dmr-product-codes", state.catalog.product_codes || DATA.productCodes);
    setOptions($("dmr-filter-category"), categoryOptions(), "All categories");
    setOptions($("dmr-edit-category"), categoryOptions(), "");
    setOptions($("dmr-edit-i"), additionalOptions(), "—");
    setOptions($("dmr-edit-j"), additionalOptions(), "—");
    $("dmr-save").disabled = !state.permissions.create;
    document.body.dataset.tfiDmrReady = "true";
    document.body.dataset.tfiDmrCreate = String(!!state.permissions.create);
    document.body.dataset.tfiDmrEdit = String(!!state.permissions.edit);
  }

  function setLiveTableMode(live) {
    const p = "dmr";
    document.querySelector("."+p+"-toolbar").hidden=live;
    document.querySelector("."+p+"-summary").hidden=live;
    document.querySelector("."+p+"-saved-section").hidden=!live;
    $(p+"-entry-head").hidden=live;
    $(p+"-entry-cols").hidden=live;
    $(p+"-tbody").hidden=live;
    $(p+"-live-head").hidden=!live;
    $(p+"-saved-tbody").hidden=!live;
    $(p+"-table").classList.toggle("tfi-live-table",live);
    document.querySelector("."+p+"-empty-tag").textContent=live?"LIVE RECORDS":"MANUAL ENTRY";
    $(p+"-table-status").textContent=live?"Imported and saved records":"New entry";
  }
  function bindEvents() {
    $("dmr-new-entry").addEventListener("click",()=>{if(state.permissions.create)setLiveTableMode(false);});
    $("dmr-back-live").addEventListener("click",()=>{setLiveTableMode(true);loadRecords(1);});
    window.addEventListener("focus",()=>{if(!$("dmr-saved-tbody").hidden&&!state.loading&&document.body.dataset.tfiReady==="true")loadRecords(state.page);});
    $("dmr-tbody").addEventListener("input", handleFormEdit);
    $("dmr-tbody").addEventListener("change", handleFormEdit);
    $("dmr-reset").addEventListener("click", clearForm);
    $("dmr-add-rows").addEventListener("click", addRows);
    $("dmr-save").addEventListener("click", saveForm);
    $("dmr-refresh").addEventListener("click", () => loadRecords(1));
    $("dmr-filter-apply").addEventListener("click", () => loadRecords(1));
    $("dmr-filter-reset").addEventListener("click", () => {
      ["dmr-filter-from", "dmr-filter-to", "dmr-filter-code", "dmr-filter-line", "dmr-filter-category"]
        .forEach(id => { $(id).value = ""; });
      loadRecords(1);
    });
    $("dmr-prev").addEventListener("click", () => loadRecords(Math.max(1, state.page - 1)));
    $("dmr-next").addEventListener("click", () => loadRecords(state.page + 1));
    $("dmr-saved-tbody").addEventListener("click", event => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;
      const record = state.records.find(item => item.id === button.dataset.id);
      if (!record) return;
      if (button.dataset.action === "edit") fillEditModal(record);
      if (button.dataset.action === "history") openHistory(record.id);
    });
    $("dmr-edit-form").addEventListener("submit", saveEdit);
    $("dmr-edit-close").addEventListener("click", closeEditModal);
    $("dmr-edit-cancel").addEventListener("click", closeEditModal);
    $("dmr-history-close").addEventListener("click", () => { $("dmr-history-modal").hidden = true; });
    $("dmr-edit-modal").addEventListener("click", event => {
      if (event.target === $("dmr-edit-modal")) closeEditModal();
    });
    $("dmr-history-modal").addEventListener("click", event => {
      if (event.target === $("dmr-history-modal")) $("dmr-history-modal").hidden = true;
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        closeEditModal();
        $("dmr-history-modal").hidden = true;
      }
    });
  }

  async function init() {
    buildRows(rowCount);
    bindEvents();
    setLiveTableMode(true);
    document.body.dataset.tfiNoMock = "true";
    document.body.dataset.tfiDmrModule = "dmr-production";
    try {
      await loadCatalog();
      await loadRecords(1);
    } catch (error) {
      $("dmr-saved-status").textContent = error.message;
      $("dmr-save").disabled = true;
      toast(error.message, true);
    }
    document.body.dataset.tfiReady = "true";
  }

  document.addEventListener("DOMContentLoaded", init);
})();
