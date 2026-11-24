(function () {
  "use strict";
  const DATA = window.TFI_DMR_CODING_DATA;
  if (!DATA) throw new Error("DMR Coding source lists were not loaded.");
  const $ = id => document.getElementById(id);
  const state = {
    catalog: null, permissions: { view: false, create: false, edit: false },
    page: 1, pageSize: 25, records: [], hasMore: false,
    editRecord: null, loading: false
  };
  let rowCount = Number(DATA.blankTemplate.initialRows) || 12;
  let floatingHead = null;
  let toastTimer;

  const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));

  async function api(path, options) {
    const response = await fetch(path, Object.assign({
      credentials: "same-origin", cache: "no-store",
      headers: { "Content-Type": "application/json" }
    }, options || {}));
    let payload = {};
    try { payload = await response.json(); } catch (_) {}
    if (!response.ok) {
      const error = new Error(payload.error || (
        response.status === 401 || response.status === 403
          ? "Your TFI session or DMR Coding permission is not active."
          : "TFI2 could not complete the DMR Coding request."
      ));
      error.status = response.status;
      error.code = payload.code || "dmr_coding_request_failed";
      throw error;
    }
    return payload;
  }

  function toast(message, isError) {
    const element = $("dmc-toast");
    element.textContent = message;
    element.hidden = false;
    element.classList.toggle("is-error", !!isError);
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => { element.hidden = true; }, 4500);
  }

  function catalog() {
    return state.catalog || {
      product_codes: DATA.productCodes, product_names: DATA.productNames,
      lines: DATA.lines, categories: DATA.categories, factors: DATA.factors,
      historical_codes_not_in_master_list: ["TMWKC-6-2950"]
    };
  }

  function setOptions(select, values, blankLabel) {
    if (!select) return;
    select.replaceChildren();
    if (blankLabel !== null) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = blankLabel || "";
      select.appendChild(option);
    }
    (values || []).forEach(item => {
      const value = typeof item === "string" ? item : item.code;
      const label = typeof item === "string"
        ? item
        : item.code + (item.description ? " — " + item.description : "");
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

  const cols = [
    { key: "A", label: "Date" }, { key: "B", label: "Product Code" },
    { key: "C", label: "Line" }, { key: "D", label: "Stop" },
    { key: "E", label: "Resume" }, { key: "F", label: "Time in Mins" },
    { key: "G", label: "Time in Hours" }, { key: "H", label: "Category" },
    { key: "I", label: "Factor" }, { key: "J", label: "Reason" },
    { key: "K", label: "Product Name (auto)" }
  ];

  function field(column, index) {
    const label = esc(column.label + " row " + index);
    if (column.key === "A")
      return '<td><input class="dmc-cell dmc-date" data-col="A" type="date" aria-label="' + label + '"></td>';
    if (column.key === "B")
      return '<td><input class="dmc-cell dmc-code" data-col="B" type="text" list="dmc-product-codes" maxlength="100" aria-label="' + label + '"></td>';
    if (column.key === "C")
      return '<td><input class="dmc-cell dmc-line" data-col="C" type="text" list="dmc-lines" maxlength="80" aria-label="' + label + '"></td>';
    if (column.key === "D" || column.key === "E")
      return '<td><input class="dmc-cell dmc-time" data-col="' + column.key + '" type="time" aria-label="' + label + '"></td>';
    if (column.key === "F" || column.key === "G" || column.key === "K")
      return '<td class="dmc-derived-cell"><input class="dmc-cell dmc-derived" data-col="' + column.key + '" type="text" readonly tabindex="-1" aria-label="' + label + '"></td>';
    if (column.key === "H")
      return '<td><select class="dmc-cell dmc-select" data-col="H" aria-label="' + label + '">' +
        '<option value=""></option>' + catalog().categories.map(item =>
          '<option value="' + esc(item.code) + '">' + esc(item.code + (item.description ? " — " + item.description : "")) + '</option>'
        ).join("") + '</select></td>';
    if (column.key === "I")
      return '<td><select class="dmc-cell dmc-select" data-col="I" aria-label="' + label + '">' +
        '<option value=""></option>' + catalog().factors.map(value =>
          '<option value="' + esc(value) + '">' + esc(value) + '</option>'
        ).join("") + '</select></td>';
    if (column.key === "J")
      return '<td><input class="dmc-cell dmc-reason" data-col="J" type="text" maxlength="1000" aria-label="' + label + '"></td>';
    return "<td></td>";
  }

  function rowHtml(index) {
    const sourceRow = Number(DATA.blankTemplate.firstSourceRow) + index - 1;
    return '<tr data-row="' + index + '" data-source-row="' + sourceRow + '">' +
      '<th class="dmc-rownum">' + index + '</th>' +
      cols.map(column => field(column, index)).join("") + '</tr>';
  }

  function timeMinutes(value) {
    if (!value) return null;
    const match = /^(\d{2}):(\d{2})$/.exec(value);
    return match ? Number(match[1]) * 60 + Number(match[2]) : null;
  }

  function elapsedMinutes(stop, resume) {
    const start = timeMinutes(stop), end = timeMinutes(resume);
    if (start === null || end === null) return null;
    return (end - start + 1440) % 1440;
  }

  function recalc(row) {
    const code = row.querySelector('[data-col="B"]').value.trim();
    row.querySelector('[data-col="K"]').value = code
      ? (catalog().product_names[code] || "Other") : "";
    const minutes = elapsedMinutes(
      row.querySelector('[data-col="D"]').value,
      row.querySelector('[data-col="E"]').value
    );
    row.querySelector('[data-col="F"]').value = minutes === null ? "" : String(minutes);
    row.querySelector('[data-col="G"]').value = minutes === null ? "" : (minutes / 60).toFixed(4);
  }

  function hasData(row) {
    return ["A", "B", "C", "D", "E", "H", "I", "J"].some(key => {
      const element = row.querySelector('[data-col="' + key + '"]');
      return element && String(element.value || "").trim() !== "";
    });
  }

  function updateSummary() {
    const rows = Array.from($("dmc-tbody").querySelectorAll("tr"));
    const filled = rows.filter(hasData).length;
    let minutes = 0;
    rows.forEach(row => {
      const value = row.querySelector('[data-col="F"]').value;
      if (value !== "" && Number.isFinite(Number(value))) minutes += Number(value);
    });
    $("dmc-entry-rows").textContent = String(rows.length);
    $("dmc-filled-rows").textContent = String(filled);
    $("dmc-total-min").textContent = String(Number(minutes.toFixed(2)));
    $("dmc-total-hrs").textContent = (minutes / 60).toFixed(4);
    $("dmc-table-status").textContent = filled + " of " + rows.length +
      " entry rows contain data · blank template starts at source row " + DATA.blankTemplate.firstSourceRow;
  }

  function handleEdit(event) {
    const row = event.target.closest("tr");
    if (!row) return;
    if (["B", "D", "E"].includes(event.target.dataset.col)) recalc(row);
    updateSummary();
  }

  function buildRows() {
    $("dmc-tbody").replaceChildren();
    $("dmc-tbody").innerHTML = Array.from({ length: rowCount }, (_, index) => rowHtml(index + 1)).join("");
    updateSummary();
  }

  function addRows() {
    const start = rowCount;
    rowCount += 12;
    for (let index = start; index < rowCount; index++)
      $("dmc-tbody").insertAdjacentHTML("beforeend", rowHtml(index + 1));
    updateSummary();
    toast("12 blank DMR Coding rows added.");
  }

  function clearForm() {
    $("dmc-tbody").querySelectorAll("input,select").forEach(element => { element.value = ""; });
    $("dmc-tbody").querySelectorAll("tr").forEach(recalc);
    updateSummary();
    toast("The DMR Coding form was cleared. No saved records were changed.");
  }

  function collectFormRecords() {
    return Array.from($("dmc-tbody").querySelectorAll("tr")).filter(hasData).map(row => {
      const recordData = {};
      ["A", "B", "C", "D", "E", "H", "I", "J"].forEach(key => {
        recordData[key] = row.querySelector('[data-col="' + key + '"]').value;
      });
      return {
        row_index: Number(row.dataset.row),
        source_row_number: Number(row.dataset.sourceRow),
        record_data: recordData
      };
    });
  }

  async function saveForm() {
    if (!state.permissions.create) {
      toast("Your TFI role does not have DMR Coding create permission.", true);
      return;
    }
    const records = collectFormRecords();
    if (!records.length) {
      toast("Enter at least one DMR Coding field before saving.", true);
      return;
    }
    const button = $("dmc-save");
    button.disabled = true;
    button.textContent = "SAVING…";
    try {
      const result = await api("/api/dmr-coding/records", {
        method: "POST",
        body: JSON.stringify({ records })
      });
      const outcomes = result.results || [];
      const clearRows = new Set(outcomes
        .filter(item => item.status === "inserted" || item.status === "duplicate")
        .map(item => Number(item.row_index)));
      $("dmc-tbody").querySelectorAll("tr").forEach(row => {
        if (clearRows.has(Number(row.dataset.row))) {
          row.querySelectorAll("input,select").forEach(element => { element.value = ""; });
        }
      });
      updateSummary();
      toast((result.inserted || 0) + " saved · " + (result.duplicates || 0) +
        " exact duplicate(s) skipped · " + (result.empty || 0) + " blank row(s) ignored.");
      await loadRecords(1);
    } catch (error) {
      toast(error.message, true);
    } finally {
      button.disabled = !state.permissions.create;
      button.textContent = "SAVE DMR CODING";
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

  function formatTime(value) { return value ? String(value).slice(0, 5) : ""; }

  function renderSavedRecords() {
    const body = $("dmc-saved-tbody");
    body.replaceChildren();
    if (!state.records.length) {
      const tr = document.createElement("tr"), td = document.createElement("td");
      td.colSpan = 15;
      td.className = "dmc-empty";
      td.textContent = "No saved DMR Coding records match these filters. Partial manual entries are retained as unassessed.";
      tr.appendChild(td);
      body.appendChild(tr);
    } else {
      state.records.forEach((record,index) => {
        const tr = document.createElement("tr");
        const num=document.createElement("th");num.className="dmc-rownum";num.textContent=String((state.page-1)*state.pageSize+index+1);tr.appendChild(num);
        const values = [
          formatDate(record.production_date), record.product_code || "",
          record.product_code ? (catalog().product_names[record.product_code] || "Other") : "",
          record.line || "", formatTime(record.stop_time), formatTime(record.resume_time),
          record.downtime_minutes ?? "", record.downtime_hours ?? "",
          record.category || "", record.factor || "", record.reason || "",
          record.product_code_reference_status || "not_entered",
          record.completeness_status || "unassessed"
        ];
        values.forEach((value, index) => {
          const td = document.createElement("td");
          td.textContent = String(value ?? "");
          if (index === 11 && value === "unmatched") td.className = "dmc-code-unmatched";
          if (index === 12) td.className = "dmc-unassessed";
          tr.appendChild(td);
        });
        const actionCell = document.createElement("td");
        const actions = document.createElement("div");
        actions.className = "dmc-row-actions";
        if (state.permissions.edit) {
          const edit = document.createElement("button");
          edit.type = "button"; edit.textContent = "EDIT";
          edit.dataset.action = "edit"; edit.dataset.id = record.id;
          actions.appendChild(edit);
        }
        const history = document.createElement("button");
        history.type = "button"; history.textContent = "HISTORY";
        history.dataset.action = "history"; history.dataset.id = record.id;
        actions.appendChild(history);
        actionCell.appendChild(actions);
        tr.appendChild(actionCell);
        body.appendChild(tr);
      });
    }
    $("dmc-page-label").textContent = "Page " + state.page;
    $("dmc-prev").disabled = state.loading || state.page <= 1;
    $("dmc-next").disabled = state.loading || !state.hasMore;
  }

  function buildRecordQuery(page) {
    const query = new URLSearchParams({ page: String(page), page_size: String(state.pageSize) });
    const filters = {
      date_from: $("dmc-filter-from").value,
      date_to: $("dmc-filter-to").value,
      product_code: $("dmc-filter-code").value.trim(),
      line: $("dmc-filter-line").value.trim(),
      category: $("dmc-filter-category").value,
      factor: $("dmc-filter-factor").value
    };
    Object.entries(filters).forEach(([key, value]) => { if (value) query.set(key, value); });
    return query;
  }

  async function loadRecords(page) {
    state.page = Math.max(1, Number(page) || 1);
    state.loading = true;
    $("dmc-saved-status").textContent = "Loading saved DMR Coding records from TFI2…";
    renderSavedRecords();
    try {
      const payload = await api("/api/dmr-coding/records?" + buildRecordQuery(state.page).toString());
      state.records = payload.records || [];
      state.page = Number(payload.page || state.page);
      state.hasMore = !!payload.has_more;
      $("dmc-saved-status").textContent = state.records.length
        ? "TFI2 connected · " + state.records.length + " saved record(s) on this page."
        : "TFI2 connected · no saved DMR Coding records match the current filters.";
      document.body.dataset.tfiDmcSource = "TFI2";
    } catch (error) {
      state.records = [];
      state.hasMore = false;
      $("dmc-saved-status").textContent = error.message;
      document.body.dataset.tfiDmcSource = "UNAVAILABLE";
      toast(error.message, true);
    } finally {
      state.loading = false;
      renderSavedRecords();
    }
  }

  function fillEditModal(record) {
    state.editRecord = record;
    $("dmc-edit-date").value = String(record.production_date || "").slice(0, 10);
    $("dmc-edit-code").value = record.product_code || "";
    $("dmc-edit-line").value = record.line || "";
    $("dmc-edit-stop").value = formatTime(record.stop_time);
    $("dmc-edit-resume").value = formatTime(record.resume_time);
    $("dmc-edit-category").value = record.category || "";
    $("dmc-edit-factor").value = record.factor || "";
    $("dmc-edit-reason").value = record.reason || "";
    $("dmc-edit-change-reason").value = "";
    $("dmc-edit-modal").hidden = false;
    $("dmc-edit-date").focus();
  }

  function closeEditModal() {
    $("dmc-edit-modal").hidden = true;
    state.editRecord = null;
  }

  async function saveEdit(event) {
    event.preventDefault();
    const record = state.editRecord;
    if (!record) return;
    const changes = {
      A: $("dmc-edit-date").value, B: $("dmc-edit-code").value,
      C: $("dmc-edit-line").value, D: $("dmc-edit-stop").value,
      E: $("dmc-edit-resume").value, H: $("dmc-edit-category").value,
      I: $("dmc-edit-factor").value, J: $("dmc-edit-reason").value
    };
    const button = $("dmc-edit-save");
    button.disabled = true; button.textContent = "SAVING…";
    try {
      const result = await api("/api/dmr-coding/records/" + encodeURIComponent(record.id), {
        method: "PATCH",
        body: JSON.stringify({
          expected_version: Number(record.version), changes,
          change_reason: $("dmc-edit-change-reason").value
        })
      });
      closeEditModal();
      toast(result.changed ? "DMR Coding record updated. A new revision was recorded." : "No changes were needed.");
      await loadRecords(state.page);
    } catch (error) {
      toast(error.message, true);
    } finally {
      button.disabled = false; button.textContent = "SAVE CHANGES";
    }
  }

  async function openHistory(recordId) {
    $("dmc-history-content").textContent = "Loading revision history from TFI2…";
    $("dmc-history-modal").hidden = false;
    try {
      const payload = await api("/api/dmr-coding/records/" + encodeURIComponent(recordId) + "/revisions");
      const container = $("dmc-history-content");
      container.replaceChildren();
      const revisions = payload.revisions || [];
      if (!revisions.length) {
        container.textContent = "No edits have been made to this record yet.";
        return;
      }
      revisions.forEach(revision => {
        const card = document.createElement("div");
        card.className = "dmc-history-item";
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
      $("dmc-history-content").textContent = error.message;
    }
  }

  function buildFloatingHeader() {
    if (floatingHead) return;
    floatingHead = document.createElement("div");
    floatingHead.className = "dmc-floating-head";
    floatingHead.setAttribute("aria-hidden", "true");
    document.body.appendChild(floatingHead);
    const table = $("dmc-table"), clone = document.createElement("table");
    clone.className = "dmc-table";
    clone.appendChild(table.querySelector("colgroup").cloneNode(true));
    clone.appendChild(table.querySelector("thead").cloneNode(true));
    floatingHead.appendChild(clone);
    syncFloatingHeader();
  }

  function syncFloatingHeader() {
    if (!floatingHead) return;
    const wrap = $("dmc-table-scroll"), table = $("dmc-table"), rect = wrap.getBoundingClientRect();
    const topbar = document.querySelector(".topbar");
    const top = Math.max(0, topbar ? topbar.getBoundingClientRect().bottom : 0);
    const headerHeight = table.querySelector("thead").getBoundingClientRect().height;
    const show = rect.top < top && rect.bottom > top + headerHeight + 8;
    floatingHead.style.display = show ? "block" : "none";
    if (!show) return;
    floatingHead.style.top = top + "px";
    floatingHead.style.left = rect.left + "px";
    floatingHead.style.width = wrap.clientWidth + "px";
    floatingHead.style.height = headerHeight + "px";
    const clone = floatingHead.firstElementChild;
    if (clone) {
      clone.style.width = table.scrollWidth + "px";
      clone.style.transform = "translateX(-" + wrap.scrollLeft + "px)";
    }
  }

  async function loadCatalog() {
    const payload = await api("/api/dmr-coding/catalog");
    state.catalog = payload.catalog || null;
    state.permissions = payload.permissions || state.permissions;
    fillDatalist("dmc-lines", catalog().lines);
    fillDatalist("dmc-product-codes", catalog().product_codes);
    setOptions($("dmc-filter-category"), catalog().categories, "All categories");
    setOptions($("dmc-filter-factor"), catalog().factors, "All factors");
    setOptions($("dmc-edit-category"), catalog().categories, "");
    setOptions($("dmc-edit-factor"), catalog().factors, "");
    $("dmc-save").disabled = !state.permissions.create;
    document.body.dataset.tfiDmcReady = "true";
    document.body.dataset.tfiDmcCreate = String(!!state.permissions.create);
    document.body.dataset.tfiDmcEdit = String(!!state.permissions.edit);
  }

  function setLiveTableMode(live) {
    const p = "dmc";
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
    $("dmc-new-entry").addEventListener("click",()=>{if(state.permissions.create)setLiveTableMode(false);});
    $("dmc-back-live").addEventListener("click",()=>{setLiveTableMode(true);loadRecords(1);});
    window.addEventListener("focus",()=>{if(!$("dmc-saved-tbody").hidden&&!state.loading&&document.body.dataset.tfiReady==="true")loadRecords(state.page);});
    $("dmc-tbody").addEventListener("input", handleEdit);
    $("dmc-tbody").addEventListener("change", handleEdit);
    $("dmc-reset").addEventListener("click", clearForm);
    $("dmc-add-rows").addEventListener("click", addRows);
    $("dmc-save").addEventListener("click", saveForm);
    $("dmc-refresh").addEventListener("click", () => loadRecords(1));
    $("dmc-filter-apply").addEventListener("click", () => loadRecords(1));
    $("dmc-filter-reset").addEventListener("click", () => {
      ["dmc-filter-from", "dmc-filter-to", "dmc-filter-code", "dmc-filter-line", "dmc-filter-category", "dmc-filter-factor"]
        .forEach(id => { $(id).value = ""; });
      loadRecords(1);
    });
    $("dmc-prev").addEventListener("click", () => loadRecords(Math.max(1, state.page - 1)));
    $("dmc-next").addEventListener("click", () => loadRecords(state.page + 1));
    $("dmc-saved-tbody").addEventListener("click", event => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;
      const record = state.records.find(item => item.id === button.dataset.id);
      if (!record) return;
      if (button.dataset.action === "edit") fillEditModal(record);
      if (button.dataset.action === "history") openHistory(record.id);
    });
    $("dmc-edit-form").addEventListener("submit", saveEdit);
    $("dmc-edit-close").addEventListener("click", closeEditModal);
    $("dmc-edit-cancel").addEventListener("click", closeEditModal);
    $("dmc-history-close").addEventListener("click", () => { $("dmc-history-modal").hidden = true; });
    $("dmc-edit-modal").addEventListener("click", event => { if (event.target === $("dmc-edit-modal")) closeEditModal(); });
    $("dmc-history-modal").addEventListener("click", event => { if (event.target === $("dmc-history-modal")) $("dmc-history-modal").hidden = true; });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        closeEditModal();
        $("dmc-history-modal").hidden = true;
      }
    });
    $("dmc-table-scroll").addEventListener("scroll", syncFloatingHeader, { passive: true });
    window.addEventListener("scroll", syncFloatingHeader, { passive: true });
    window.addEventListener("resize", syncFloatingHeader, { passive: true });
  }

  async function init() {
    document.body.dataset.tfiNoMock = "true";
    document.body.dataset.tfiDmcModule = "dmr-coding";
    try {
      await loadCatalog();
    } catch (error) {
      state.catalog = null;
      $("dmc-saved-status").textContent = error.message;
      $("dmc-save").disabled = true;
      toast(error.message, true);
    }
    buildRows();
    bindEvents();
    setLiveTableMode(true);
    buildFloatingHeader();
    try { await loadRecords(1); } catch (_) {}
    document.body.dataset.tfiRows = String(rowCount);
    document.body.dataset.tfiReady = "true";
  }

  document.addEventListener("DOMContentLoaded", init);
})();
