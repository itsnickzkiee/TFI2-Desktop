(() => {
  "use strict";
  const DATA = window.TFI_YIELD_MONITORING_DATA || { records: [], reference: { products: [] } };
  const FIELDS = [
    ["date","Date"],["product_name","Product Name"],["product_code","Product Code"],
    ["total_fg_tins","Total FG (tins)"],["main_yield_pct","Main % Yield"],
    ["stage2_yield_pct","Stage 2 % Yield"],["stage3_yield_pct","Stage 3 % Yield"],
    ["bloom_rate","Bloom Rate (x)"],["lid_reject_pct","Lid reject %"],
    ["can_reject_pct","Can reject %"],["box_reject_pct","Box reject %"],["label_reject_pct","Label reject %"]
  ];
  const state = { page: 1, pageSize: 10, sortKey: "", sortDirection: 1, filtered: [] };
  const $ = id => document.getElementById(id);
  const clean = value => value === null || value === undefined ? "" : String(value).trim();
  const lower = value => clean(value).toLocaleLowerCase();

  function dateKey(value) {
    const raw = clean(value);
    if (!raw) return "";
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0,10);
    const match = raw.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})$/);
    if (match) {
      const months = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
      const month = months.indexOf(match[2].toLowerCase());
      if (month >= 0) return `${match[3].length===2?"20"+match[3]:match[3]}-${String(month+1).padStart(2,"0")}-${String(Number(match[1])).padStart(2,"0")}`;
    }
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0,10);
  }

  function formatDate(value) {
    const key = dateKey(value);
    if (!key) return clean(value);
    const [year,month,day] = key.split("-").map(Number);
    const date = new Date(Date.UTC(year,month-1,day));
    return new Intl.DateTimeFormat("en-GB",{day:"2-digit",month:"short",year:"2-digit",timeZone:"UTC"}).format(date).replaceAll(" ","-");
  }

  function formatValue(key,value) {
    if (value === null || value === undefined || value === "") return "";
    if (key === "date") return formatDate(value);
    if (typeof value === "string" && value.includes("%")) return value;
    const number = Number(value);
    if (!Number.isFinite(number)) return String(value);
    if (key === "total_fg_tins") return new Intl.NumberFormat("en-US",{maximumFractionDigits:0}).format(number);
    if (key.endsWith("_yield_pct") || key.endsWith("_reject_pct")) {
      const pct = number * 100;
      return new Intl.NumberFormat("en-US",{minimumFractionDigits:1,maximumFractionDigits:1}).format(pct) + "%";
    }
    if (key === "bloom_rate") return new Intl.NumberFormat("en-US",{minimumFractionDigits:2,maximumFractionDigits:2}).format(number);
    return String(value);
  }
  function populateProducts() {
    const select = $("ym-product");
    [...new Set((DATA.reference?.products || []).filter(Boolean))].forEach(name => {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      select.appendChild(option);
    });
  }

  function applyFilters() {
    const from = $("ym-from").value;
    const to = $("ym-to").value;
    const product = lower($("ym-product").value);
    const code = lower($("ym-code").value);
    const query = lower($("ym-search").value);
    let rows = (Array.isArray(DATA.records) ? DATA.records : []).filter(row => {
      const date = dateKey(row.date);
      if ((from || to) && !date) return false;
      if (from && date && date < from) return false;
      if (to && date && date > to) return false;
      if (product && lower(row.product_name) !== product) return false;
      if (code && !lower(row.product_code).includes(code)) return false;
      if (query && !FIELDS.some(([key]) => lower(formatValue(key,row[key])).includes(query))) return false;
      return true;
    });

    if (state.sortKey) {
      const key = state.sortKey;
      rows = rows.slice().sort((a,b) => {
        let av = a[key], bv = b[key];
        if (key === "date") { av = dateKey(av); bv = dateKey(bv); }
        const aBlank = av === null || av === undefined || av === "";
        const bBlank = bv === null || bv === undefined || bv === "";
        if (aBlank || bBlank) return aBlank === bBlank ? 0 : (aBlank ? 1 : -1);
        const an = Number(av), bn = Number(bv);
        const numeric = Number.isFinite(an) && Number.isFinite(bn);
        const result = numeric ? an - bn : lower(av).localeCompare(lower(bv),undefined,{numeric:true});
        return result * state.sortDirection;
      });
    }
    state.filtered = rows;
    renderTable();
  }

  function renderEmpty(message) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 12;
    td.className = "ym-empty-cell";
    const empty = document.createElement("div");
    empty.className = "ym-empty-state";
    const icon = document.createElement("div");
    icon.className = "ym-empty-icon";
    icon.textContent = "▤";
    const title = document.createElement("strong");
    title.textContent = message;
    const detail = document.createElement("span");
    detail.textContent = DATA.records?.length
      ? "Change or reset the selected filters to see other source rows."
      : "No eligible source-derived records are available for these filters.";
    empty.append(icon,title,detail);
    td.appendChild(empty);
    tr.appendChild(td);
    $("ym-tbody").appendChild(tr);
  }

  function renderTable() {
    const total = state.filtered.length;
    const pages = Math.max(1,Math.ceil(total/state.pageSize));
    state.page = Math.min(state.page,pages);
    const start = (state.page-1)*state.pageSize;
    const visible = state.filtered.slice(start,start+state.pageSize);
    const body = $("ym-tbody");
    body.replaceChildren();

    if (!visible.length) {
      renderEmpty(DATA.records?.length ? "No records match these filters" : "No eligible Yield Log records");
    } else {
      visible.forEach(row => {
        const tr = document.createElement("tr");
        FIELDS.forEach(([key]) => {
          const td = document.createElement("td");
          td.textContent = formatValue(key,row[key]);
          tr.appendChild(td);
        });
        body.appendChild(tr);
      });
    }
    $("ym-table-count").textContent = total
      ? `Showing ${start+1}–${Math.min(start+state.pageSize,total)} of ${total} records`
      : (DATA.records?.length ? "No matching records" : "No live records returned");
    $("ym-page").textContent = total ? `${state.page} / ${pages}` : "—";
    $("ym-prev").disabled = !total || state.page <= 1;
    $("ym-next").disabled = !total || state.page >= pages;
    $("ym-export").disabled = !total;
    $("ym-record-state").textContent = total ? `${total} SOURCE RECORDS` : "NO LIVE RECORDS";
    $("ym-record-state").parentElement.querySelector("i").style.background = total ? "#45a779" : "#a6b7ad";
    $("ym-filter-summary").textContent = total
      ? `${total} record(s) match the current filters.`
      : (DATA.records?.length ? "No records match the current filters." : "No live source records returned.");

    document.querySelectorAll("[data-sort]").forEach(button => {
      const th = button.closest("th");
      const active = button.dataset.sort === state.sortKey;
      th.setAttribute("aria-sort",active ? (state.sortDirection===1?"ascending":"descending") : "none");
      button.querySelector("span").textContent = active ? (state.sortDirection===1?"↑":"↓") : "↕";
    });
  }

  function exportCsv() {
    if (!state.filtered.length) return;
    if(liveMore&&!confirm("Export currently loaded records only? More records are available."))return;
    const quote = value => '"' + String(value ?? "").replaceAll('"','""') + '"';
    const lines = [FIELDS.map(([,label])=>quote(label)).join(",")];
    state.filtered.forEach(row => lines.push(FIELDS.map(([key])=>quote(formatValue(key,row[key]))).join(",")));
    const blob = new Blob(["\ufeff"+lines.join("\r\n")],{type:"text/csv;charset=utf-8;"});
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "TFI-Yield-Log-Export.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  function resetFilters() {
    ["ym-from","ym-to","ym-product","ym-code","ym-search"].forEach(id => $(id).value = "");
    state.page = 1;
    applyFilters();
  }

  let liveOffset=0,liveMore=false,liveLoading=false,liveError="",liveGeneration=0;
  function mapYield(r){
    return {date:r.production_date,product_name:r.product_name,product_code:r.product_code,total_fg_tins:r.total_fg_tins,main_yield_pct:r.main_yield,stage2_yield_pct:r.stage2_yield,stage3_yield_pct:r.stage3_yield,bloom_rate:r.bloom_rate,lid_reject_pct:r.lid_reject,can_reject_pct:r.can_reject,box_reject_pct:r.box_reject,label_reject_pct:r.label_reject};
  }
  async function loadLiveYield(reset=true){
    if(reset){++liveGeneration;liveOffset=0;liveMore=false;DATA.records=[];state.page=1;}
    else if(liveLoading||!liveMore)return;
    const generation=liveGeneration;
    liveLoading=true;liveError="";
    const more=$("ym-live-more");if(more)more.disabled=true;
    $("ym-record-state").textContent="LOADING LIVE RECORDS";
    try{
      const params=new URLSearchParams({limit:"100",offset:String(liveOffset)});
      for(const [id,key] of [["ym-from","date_from"],["ym-to","date_to"],["ym-product","product_name"],["ym-code","product_code"]]){
        const value=$(id).value.trim();if(value)params.set(key,value);
      }
      const response=await fetch("/api/yield/log?"+params,{credentials:"same-origin",cache:"no-store",headers:{Accept:"application/json"}});
      const payload=await response.json();if(!response.ok)throw new Error(payload.error||"Yield Log unavailable.");
      if(generation!==liveGeneration)return;
      const rows=(payload.records||[]).map(mapYield);
      DATA.records=DATA.records.concat(rows);
      // Offset must advance by requested source page size, not projected row count.
      liveOffset=Number(payload.offset||0)+Number(payload.limit||100);
      liveMore=!!payload.has_more;
      document.body.dataset.tfiYieldSource="TFI2";
      document.body.dataset.tfiYieldRecords=String(DATA.records.length);
      applyFilters();
    }catch(error){
      if(generation!==liveGeneration)return;
      liveError=error.message;document.body.dataset.tfiYieldSource="UNAVAILABLE";
      if(reset){DATA.records=[];state.filtered=[];renderTable();}
      $("ym-filter-summary").textContent=liveError;
      $("ym-record-state").textContent="CONNECTION ERROR";
    }finally{
      if(generation===liveGeneration){liveLoading=false;if(more){more.disabled=false;more.hidden=!liveMore;}}
    }
  }
  function bindLiveYield(){
    const more=document.createElement("button");more.id="ym-live-more";more.type="button";more.className="ym-btn ym-btn-light";more.textContent="LOAD MORE RECORDS";more.hidden=true;
    $("ym-table-count").after(more);more.onclick=()=>loadLiveYield(false);
    let timer;
    for(const id of ["ym-from","ym-to","ym-product","ym-code"]){
      $(id).addEventListener("input",()=>{clearTimeout(timer);timer=setTimeout(()=>loadLiveYield(true),350);});
      $(id).addEventListener("change",()=>{clearTimeout(timer);timer=setTimeout(()=>loadLiveYield(true),350);});
    }
    $("ym-reset").addEventListener("click",()=>{clearTimeout(timer);loadLiveYield(true);});
    const refresh=()=>{if(!document.hidden&&!liveLoading)loadLiveYield(true);};
    window.addEventListener("focus",refresh);
    window.addEventListener("message",event=>{if(event.origin===location.origin&&event.data?.type==="TFI_DATA_SAVED"&&/^\/api\/(import|product-entry|dmr-production)\//.test(event.data.endpoint||""))refresh();});
    loadLiveYield(true);
  }
  function init() {
    populateProducts();
    ["ym-from","ym-to","ym-product","ym-code","ym-search"].forEach(id => {
      $(id).addEventListener("input",()=>{state.page=1;applyFilters();});
      $(id).addEventListener("change",()=>{state.page=1;applyFilters();});
    });
    document.querySelectorAll("[data-sort]").forEach(button => button.addEventListener("click",()=>{
      if (state.sortKey === button.dataset.sort) state.sortDirection *= -1;
      else { state.sortKey = button.dataset.sort; state.sortDirection = button.dataset.sort==="date" ? -1 : 1; }
      state.page = 1;
      applyFilters();
    }));
    $("ym-reset").addEventListener("click",resetFilters);
    $("ym-export").addEventListener("click",exportCsv);
    $("ym-prev").addEventListener("click",()=>{state.page--;renderTable();});
    $("ym-next").addEventListener("click",()=>{state.page++;renderTable();});
    applyFilters();
    document.body.dataset.tfiReady = "true";
    document.body.dataset.tfiYieldReadOnly = "true";
    document.body.dataset.tfiYieldRecords = String(DATA.records?.length || 0);
    document.body.dataset.tfiYieldColumns = String(FIELDS.length);
    document.body.dataset.tfiNoMock = "true";
    bindLiveYield();
  }

  document.addEventListener("DOMContentLoaded",init);
})();
