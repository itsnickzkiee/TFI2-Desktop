(() => {
  "use strict";

  const SOURCE = Object.freeze({
    workbook: "Copy of TFI - Production Monitoring Sheet 1",
    worksheet: "Production Summary",
    sheetId: 1846667474,
    headerRow: 6,
    firstDataRow: 7,
    columns: [
      ["date","Date","date","A"],["line","Line","text","B"],["productName","Product Name","text","C"],
      ["productCode","Product Code","text","D"],["batches","No. of Batches","number","E"],["target","Target","number","F"],
      ["produced","Produced","number","G"],["uom","UOM","text","H"],["attainment","% Attainment","percent","I"],
      ["planStart","Plan Start","time","J"],["actualStart","Actual Start","time","K"],["planEnd","Plan End","time","L"],
      ["actualEndProd","Actual End (Prod)","time","M"],["actualEndCleaning","Actual End (Cleaning)","time","N"],
      ["manReqmt","Man Reqmt","number","O"],["present","Present","number","P"],["absent","Absent","number","Q"],
      ["attendance","% Attendance","percent","R"],["otHrs","OT Hrs","number","S"],
      ["remarks","Remarks / Reasons (Delay, <95%, Co-run, PD)","text","T"],["savedOn","Saved on","dateTime","U"],
      ["check","Check","text","V"],["hasData","Has data","flag","W"],["dayHasData","Day has data","flag","X"]
    ]
  });
  const $ = id => document.getElementById(id);
  const state = {
    page:1,pageSize:10,total:0,sortKey:"date",sortDirection:"desc",
    records:[],catalog:null,selectedRecord:null,canEdit:false,
    requestId:0,debounce:null,connected:false
  };
  const clean=value=>String(value??"").trim();
  const lower=value=>clean(value).toLocaleLowerCase();
  const esc=value=>String(value??"").replace(/[&<>"']/g,ch=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[ch]));
  const COLUMN_BY_KEY=Object.fromEntries(SOURCE.columns.map(([key,, ,column])=>[key,column]));
  const COLUMN_LABEL=Object.fromEntries(SOURCE.columns.map(([,label,,column])=>[column,label]));

  async function api(url,options){
    const response=await fetch(url,Object.assign({
      credentials:"same-origin",cache:"no-store"
    },options||{}));
    let payload={};
    try{payload=await response.json();}catch(_error){}
    if(!response.ok){
      const error=new Error(payload.error||(
        response.status===401||response.status===403
          ?"Your session or Production Entry permission is no longer active. Sign in again or contact the administrator."
          :"TFI2 could not complete the Production Summary request. Try again."
      ));
      error.status=response.status;
      error.code=payload.code||"production_entry_request_failed";
      throw error;
    }
    return payload;
  }
  function showToast(message,error){
    const toast=$("rr-toast");
    toast.textContent=message;
    toast.hidden=false;
    toast.classList.add("show");
    toast.style.background=error?"#8e3028":"";
    window.clearTimeout(showToast.timer);
    showToast.timer=window.setTimeout(()=>{
      toast.classList.remove("show");
      toast.hidden=true;
    },3600);
  }
  function setConnection(message,error){
    const status=$("rr-connection");
    status.textContent=message;
    status.classList.toggle("is-error",!!error);
    status.setAttribute("role","status");
  }
  function formatDate(value){
    if(!value)return "";
    const parsed=new Date(String(value).slice(0,10)+"T12:00:00");
    return Number.isNaN(parsed.getTime())?String(value):parsed.toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"2-digit"});
  }
  function formatDateTime(value){
    if(!value)return "";
    const parsed=new Date(value);
    return Number.isNaN(parsed.getTime())?String(value):parsed.toLocaleString("en-GB",{day:"2-digit",month:"short",year:"2-digit",hour:"2-digit",minute:"2-digit"});
  }
  function displayValue(value,type){
    if(value===null||value===undefined||value==="")return "";
    if(type==="percent"){
      const n=Number(value);
      return Number.isFinite(n)?(n*100).toFixed(1)+"%":String(value);
    }
    if(type==="date")return formatDate(value);
    if(type==="dateTime")return formatDateTime(value);
    if(type==="flag")return value===true||value==="true"||value===1?"1":value===false||value==="false"||value===0?"0":String(value);
    return String(value);
  }
  function toReportRecord(row){
    const data=row.record_data||{};
    const result={id:row.id,version:Number(row.version||1),sourceRowNumber:row.source_row_number,recordData:data};
    SOURCE.columns.forEach(([key,,type,column])=>{
      result[key]=displayValue(data[column],type);
    });
    return result;
  }
  function activeFilters(){
    return {
      date_from:$("rr-from").value,
      date_to:$("rr-to").value,
      line:clean($("rr-line").value),
      product_name:clean($("rr-product").value),
      product_code:clean($("rr-code").value),
      search:clean($("rr-search").value)
    };
  }
  function filterSummary(){
    const filters=activeFilters();
    return Object.values(filters).some(Boolean);
  }
  function renderEmpty(){
    const tr=document.createElement("tr");
    const td=document.createElement("td");
    td.colSpan=SOURCE.columns.length;
    td.className="rr-empty-cell";
    const wrap=document.createElement("div");
    wrap.className="rr-empty-state";
    const icon=document.createElement("div");
    icon.className="rr-empty-icon";
    icon.textContent="▤";
    const title=document.createElement("strong");
    title.textContent=filterSummary()?"No saved runs match these filters":"No saved production runs yet";
    const detail=document.createElement("span");
    detail.textContent=filterSummary()
      ?"Try a wider date range or clear one or more filters."
      :"New Production Entry runs saved to TFI2 will appear here. No historical worksheet rows or sample transactions are preloaded.";
    wrap.append(icon,title,detail);
    td.appendChild(wrap);
    tr.appendChild(td);
    $("rr-tbody").appendChild(tr);
  }
  function renderTable(){
    const body=$("rr-tbody");
    body.replaceChildren();
    if(!state.records.length){
      renderEmpty();
    }else{
      state.records.forEach(record=>{
        const tr=document.createElement("tr");
        tr.dataset.recordId=record.id;
        tr.dataset.version=String(record.version);
        if(state.selectedRecord?.id===record.id)tr.classList.add("is-selected");
        SOURCE.columns.forEach(([key,,type],index)=>{
          const td=document.createElement("td");
          td.textContent=record[key]??"";
          if(["number","percent"].includes(type))td.classList.add("rr-numeric");
          if(index===8||index===17)td.classList.add("rr-derived");
          if(["date","time","dateTime","flag"].includes(type))td.classList.add("rr-center");
          if(index>=20)td.classList.add("rr-trace");
          tr.appendChild(td);
        });
        tr.addEventListener("click",()=>selectRecord(record));
        body.appendChild(tr);
      });
    }
    const start=state.total?(state.page-1)*state.pageSize+1:0;
    const end=Math.min(state.page*state.pageSize,state.total);
    $("rr-table-count").textContent=state.total
      ?"Showing "+start+"–"+end+" of "+state.total+" saved production runs"
      :"No saved production runs match the current filters.";
    const pages=Math.max(1,Math.ceil(state.total/state.pageSize));
    $("rr-page").textContent=state.total?state.page+" / "+pages:"—";
    $("rr-prev").disabled=!state.total||state.page<=1;
    $("rr-next").disabled=!state.total||state.page>=pages;
    $("rr-export").disabled=!state.total;
    $("rr-record-state").textContent=state.total?state.total+" SAVED RUNS":"NO SAVED RUNS";
    $("rr-filter-summary").textContent=state.total
      ?state.total+" saved production run(s) match the current filters."
      :"No saved production records are available for the current filters.";
    document.querySelectorAll("[data-rr-sort]").forEach(button=>{
      const active=button.dataset.rrSort===state.sortKey;
      button.closest("th").setAttribute("aria-sort",active
        ?(state.sortDirection==="asc"?"ascending":"descending"):"none");
      button.querySelector("span").textContent=active
        ?(state.sortDirection==="asc"?"↑":"↓"):"↕";
    });
    $("rr-edit-selected").disabled=!state.selectedRecord||!state.canEdit;
    $("rr-history-selected").disabled=!state.selectedRecord;
  }
  function selectRecord(record){
    state.selectedRecord=record;
    $("rr-selected-label").textContent=
      [record.date,record.line,record.productName,record.productCode].filter(Boolean).join(" · ")||
      "Selected saved production run";
    renderTable();
  }
  function updateSummary(summary){
    $("rr-kpi-runs").textContent=String(summary.saved_rows??0);
    $("rr-kpi-days").textContent=String(summary.days_saved??0);
    $("rr-kpi-attainment").textContent=summary.avg_attainment===null||summary.avg_attainment===undefined
      ?"—":displayValue(summary.avg_attainment,"percent");
    $("rr-kpi-last").textContent=summary.last_saved?formatDateTime(summary.last_saved):"—";
  }
  async function refreshSummary(){
    const payload=await api("/api/production-entry/summary");
    updateSummary(payload.summary||{});
  }
  async function loadRecords(page){
    const requestId=++state.requestId;
    state.page=page||1;
    $("rr-table-count").textContent="Loading saved Production Entry runs…";
    $("rr-record-state").textContent="LOADING TFI2";
    $("rr-prev").disabled=true;
    $("rr-next").disabled=true;
    const filters=activeFilters();
    const query=new URLSearchParams({
      page:String(state.page),
      page_size:String(state.pageSize),
      sort:state.sortKey,
      direction:state.sortDirection
    });
    Object.entries(filters).forEach(([key,value])=>{if(value)query.set(key,value);});
    document.body.dataset.tfiRequestedQuery=query.toString();
    try{
      const payload=await api("/api/production-entry/records?"+query.toString());
      if(requestId!==state.requestId)return;
      state.records=(payload.records||[]).map(toReportRecord);
      state.total=Number(payload.total||0);
      state.page=Number(payload.page||1);
      document.body.dataset.tfiLoadedQuery=query.toString();
      state.selectedRecord=null;
      $("rr-selected-label").textContent="Select a saved production run to edit it or inspect its revision history.";
      renderTable();
      document.body.dataset.tfiRecordCount=String(state.total);
    }catch(error){
      if(requestId!==state.requestId)return;
      state.records=[];
      state.total=0;
      renderTable();
      setConnection("TFI2 CONNECTION ISSUE",true);
      showToast(error.message,true);
    }
  }
  function scheduleFilter(){
    window.clearTimeout(state.debounce);
    state.debounce=window.setTimeout(()=>loadRecords(1),260);
  }
  function resetFilters(){
    ["rr-from","rr-to","rr-line","rr-product","rr-code","rr-search"].forEach(id=>{$(id).value="";});
    state.sortKey="date";
    state.sortDirection="desc";
    loadRecords(1);
  }
  function openModal(id){
    $(id).classList.add("open");
    $(id).setAttribute("aria-hidden","false");
  }
  function closeModal(id){
    $(id).classList.remove("open");
    $(id).setAttribute("aria-hidden","true");
  }
  function openImportModal(){
    openModal("rr-import-modal");
    $("rr-modal-close").focus();
  }
  function closeImportModal(){
    closeModal("rr-import-modal");
    $("rr-import-open").focus();
  }
  function spreadsheetIdFromUrl(raw){
    try{
      const url=new URL(raw);
      if(url.protocol!=="https:"||url.hostname.toLowerCase()!=="docs.google.com")return "";
      const match=url.pathname.match(/^\/spreadsheets\/(?:u\/\d+\/)?d\/([A-Za-z0-9_-]+)/);
      return match?match[1]:"";
    }catch(_error){return "";}
  }
  function bindSpreadsheetLink(){
    const input=$("rr-spreadsheet-link");
    const feedback=$("rr-link-feedback");
    const idBox=$("rr-link-id");
    const idValue=$("rr-link-id-value");
    input.addEventListener("input",()=>{
      input.setAttribute("aria-invalid","false");
      feedback.className="rr-link-feedback";
      feedback.textContent="Link changed. Select Validate Link to check its URL format.";
      idBox.hidden=true;
      idValue.textContent="";
      document.body.dataset.tfiSpreadsheetLinkStatus="pending";
      delete document.body.dataset.tfiDetectedSpreadsheetId;
    });
    $("rr-link-validate").addEventListener("click",()=>{
      const raw=clean(input.value);
      const id=raw?spreadsheetIdFromUrl(raw):"";
      if(!id){
        input.setAttribute("aria-invalid","true");
        feedback.className="rr-link-feedback is-invalid";
        feedback.textContent=raw
          ?"That link format is not recognized. Paste the full Google Sheets URL."
          :"Paste a Google Sheets URL first.";
        idBox.hidden=true;
        document.body.dataset.tfiSpreadsheetLinkStatus=raw?"invalid":"empty";
        delete document.body.dataset.tfiDetectedSpreadsheetId;
        return;
      }
      input.setAttribute("aria-invalid","false");
      feedback.className="rr-link-feedback is-valid";
      feedback.textContent="Link format looks valid. Access permissions and sheet contents have not been checked.";
      idValue.textContent=id;
      idBox.hidden=false;
      document.body.dataset.tfiSpreadsheetLinkStatus="valid";
      document.body.dataset.tfiDetectedSpreadsheetId=id;
    });
  }
  function fieldOptions(values,current){
    const all=Array.from(new Set([...(values||[]),...(current?[current]:[])]));
    return '<option value=""></option>'+all.map(value=>
      '<option value="'+esc(value)+'"'+(String(value)===String(current??"")?" selected":"")+'>'+esc(value)+'</option>'
    ).join("");
  }
  const EDIT_FIELDS=[
    {column:"A",label:"Production Date",type:"date"},
    {column:"C",label:"Product Name",type:"product"},
    {column:"D",label:"Product Code",type:"code"},
    {column:"E",label:"No. of Batches",type:"number"},
    {column:"F",label:"Target",type:"number"},
    {column:"G",label:"Produced",type:"number"},
    {column:"H",label:"UOM",type:"uom"},
    {column:"J",label:"Plan Start",type:"time"},
    {column:"K",label:"Actual Start",type:"time"},
    {column:"L",label:"Plan End",type:"time"},
    {column:"M",label:"Actual End (Production)",type:"time"},
    {column:"N",label:"Actual End (Cleaning)",type:"time"},
    {column:"O",label:"Manpower Requirement",type:"number"},
    {column:"P",label:"Present",type:"number"},
    {column:"S",label:"OT Hours",type:"number"},
    {column:"T",label:"Remarks / Reasons",type:"text"}
  ];
  function editControl(field,record){
    const value=record.recordData?.[field.column]??"";
    let control="";
    if(field.type==="product"){
      control='<select data-edit-column="C">'+fieldOptions(state.catalog?.product_names,value)+'</select>';
    }else if(field.type==="code"){
      control='<select data-edit-column="D">'+fieldOptions(state.catalog?.product_codes?.[record.recordData?.C]||[],value)+'</select>';
    }else if(field.type==="uom"){
      control='<select data-edit-column="H">'+fieldOptions(state.catalog?.uom,value)+'</select>';
    }else{
      const type=field.type==="number"?"number":field.type==="time"?"time":field.type==="date"?"date":"text";
      const min=type==="number"?' min="0" step="any"':"";
      const max=type==="text"?' maxlength="1000"':"";
      control='<input data-edit-column="'+field.column+'" type="'+type+'"'+min+max+' value="'+esc(value)+'">';
    }
    return '<label class="rr-field"><span>'+esc(field.label)+'</span>'+control+'</label>';
  }
  function openEditModal(){
    const record=state.selectedRecord;
    if(!record||!state.canEdit)return;
    $("rr-edit-fields").innerHTML=EDIT_FIELDS.map(field=>editControl(field,record)).join("");
    $("rr-change-reason").value="";
    const product=$("rr-edit-fields").querySelector('[data-edit-column="C"]');
    const code=$("rr-edit-fields").querySelector('[data-edit-column="D"]');
    product.addEventListener("change",()=>{
      const options=state.catalog?.product_codes?.[product.value]||[];
      code.innerHTML=fieldOptions(options,"");
    });
    openModal("rr-edit-modal");
  }
  async function saveEdit(event){
    event.preventDefault();
    const record=state.selectedRecord;
    if(!record||!state.canEdit)return;
    const changes={};
    $("rr-edit-fields").querySelectorAll("[data-edit-column]").forEach(field=>{
      const column=field.dataset.editColumn;
      const current=clean(field.value);
      const before=clean(record.recordData?.[column]);
      if(current!==before)changes[column]=current===""?null:current;
    });
    if(!Object.keys(changes).length){
      showToast("No changes detected for this production run.");
      closeModal("rr-edit-modal");
      return;
    }
    const button=$("rr-edit-save");
    button.disabled=true;
    button.textContent="SAVING…";
    try{
      await api("/api/production-entry/records/"+encodeURIComponent(record.id),{
        method:"PATCH",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          expected_version:record.version,
          changes,
          change_reason:clean($("rr-change-reason").value)||null
        })
      });
      closeModal("rr-edit-modal");
      showToast("Production Entry run updated. Revision history was recorded.");
      await Promise.all([refreshSummary(),loadRecords(state.page)]);
    }catch(error){
      showToast(error.message,true);
      if(error.status===409)await loadRecords(state.page);
    }finally{
      button.disabled=false;
      button.textContent="SAVE CHANGES";
    }
  }
  function revisionValue(value,column){
    const meta=SOURCE.columns.find(item=>item[3]===column);
    return displayValue(value,meta?.[2]||"text");
  }
  async function openHistoryModal(){
    const record=state.selectedRecord;
    if(!record)return;
    $("rr-history-content").innerHTML='<div class="rr-history-empty">Loading revision history…</div>';
    openModal("rr-history-modal");
    try{
      const payload=await api("/api/production-entry/records/"+encodeURIComponent(record.id)+"/revisions");
      const revisions=payload.revisions||[];
      if(!revisions.length){
        $("rr-history-content").innerHTML='<div class="rr-history-empty">No edits have been recorded for this production run.</div>';
        return;
      }
      $("rr-history-content").innerHTML=revisions.map(revision=>{
        const before=revision.before_data||{};
        const after=revision.after_data||{};
        const columns=revision.changed_columns||[];
        const rows=columns.map(column=>{
          const label=COLUMN_LABEL[column]||column;
          return '<tr><th>'+esc(column+" · "+label)+'</th><td>'+esc(revisionValue(before[column],column)||"—")+'</td><td>'+esc(revisionValue(after[column],column)||"—")+'</td></tr>';
        }).join("");
        return '<article class="rr-history-item"><div class="rr-history-item-head"><strong>Version '+esc(revision.version)+'</strong><span>'+esc(formatDateTime(revision.changed_at))+'</span></div>'+
          (revision.change_reason?'<p>'+esc(revision.change_reason)+'</p>':"")+
          '<table class="rr-history-table"><thead><tr><th>Field</th><th>Before</th><th>After</th></tr></thead><tbody>'+rows+'</tbody></table></article>';
      }).join("");
    }catch(error){
      $("rr-history-content").innerHTML='<div class="rr-history-empty">'+esc(error.message)+'</div>';
    }
  }
  async function exportCsv(){
    if(!state.total)return;
    const filters=activeFilters();
    const rows=[];
    const totalPages=Math.ceil(state.total/100);
    try{
      for(let page=1;page<=totalPages;page++){
        const query=new URLSearchParams({page:String(page),page_size:"100",sort:state.sortKey,direction:state.sortDirection});
        Object.entries(filters).forEach(([key,value])=>{if(value)query.set(key,value);});
        const payload=await api("/api/production-entry/records?"+query.toString());
        rows.push(...(payload.records||[]).map(toReportRecord));
      }
      const quote=value=>'"'+String(value??"").replace(/"/g,'""')+'"';
      const lines=[SOURCE.columns.map(([,label])=>quote(label)).join(",")];
      rows.forEach(record=>{
        lines.push(SOURCE.columns.map(([key])=>quote(record[key]??"")).join(","));
      });
      const blob=new Blob(["\uFEFF"+lines.join("\r\n")],{type:"text/csv;charset=utf-8"});
      const url=URL.createObjectURL(blob);
      const link=document.createElement("a");
      link.href=url;
      link.download="TFI-Production-Summary-"+new Date().toISOString().slice(0,10)+".csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      showToast(rows.length+" saved Production Summary record(s) exported.");
    }catch(error){
      showToast(error.message,true);
    }
  }
  function setAnalyticsSource(id,label,state){
    const node=$(id);
    if(!node)return;
    node.textContent=label;
    node.dataset.state=state||"";
  }
  async function refreshAnalyticsSnapshot(){
    const params=new URLSearchParams();
    const from=$("rr-from")?.value||"";
    const to=$("rr-to")?.value||"";
    if(from)params.set("date_from",from);
    if(to)params.set("date_to",to);
    const suffix=params.toString()?"?"+params.toString():"";
    try{
      const response=await fetch("/api/dashboard/analytics"+suffix,{credentials:"same-origin",cache:"no-store",headers:{Accept:"application/json"}});
      const payload=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(payload.error||"Dashboard analytics are unavailable.");
      const metrics=payload.metrics||{},modules=payload.modules||{},reports=payload.reports||{};
      const prod=modules.productivity||{},dmr=modules.dmr_production||{},oee=modules.oee||{};
      const num=value=>value===null||value===undefined||!Number.isFinite(Number(value))?"—":new Intl.NumberFormat(undefined,{maximumFractionDigits:2}).format(Number(value));
      const pct=value=>value===null||value===undefined||!Number.isFinite(Number(value))?"—":(Number(value)*100).toFixed(2)+"%";
      $("rr-analytics-output").textContent=prod.status==="available"?num(metrics.total_output_tins):"—";
      $("rr-analytics-attainment").textContent=prod.status==="available"?pct(metrics.output_attainment):"—";
      $("rr-analytics-productivity").textContent=prod.status==="available"?num(metrics.productivity_tins_per_mhr):"—";
      $("rr-analytics-oee").textContent=oee.status==="available"?pct(metrics.oee):"—";
      $("rr-analytics-downtime").textContent=dmr.status==="available"?num(metrics.total_downtime_hours):"—";
      const yieldStatus=payload.readiness?.yield_kpis?.status||"pending";
      $("rr-analytics-yield").textContent=yieldStatus==="implemented_read_only_projection"?"Available · read-only":"Pending";
      const production=reports.production_summary||{};
      const schedule=reports.schedule_summary||{};
      const productEntry=reports.product_entry_summary||{};
      const removed=reports.removed_rows||{};
      setAnalyticsSource("rr-source-production",production.status==="available"?"LIVE":production.status==="empty"?"CONNECTED · EMPTY":"RESTRICTED",production.status);
      setAnalyticsSource("rr-source-schedule",Number(schedule.saved_rows)>0?"LIVE":schedule.status==="restricted"?"RESTRICTED":"CONNECTED · EMPTY",schedule.status||"empty");
      const summaryAvailable=productEntry.status==="implemented_read_only_projection";
      const summaryLabel=summaryAvailable?"AVAILABLE · READ ONLY":productEntry.status==="restricted"?"RESTRICTED":"PENDING FORMULAS";
      setAnalyticsSource("rr-source-summary",summaryLabel,summaryAvailable?"available":productEntry.status||"pending");
      const archiveAvailable=removed.status==="available_read_only_archive";
      setAnalyticsSource("rr-source-removed",archiveAvailable?"AVAILABLE · READ ONLY":removed.status==="restricted"?"RESTRICTED":"UNAVAILABLE",archiveAvailable?"archive":removed.status);
      $("rr-analytics-source").textContent="TFI2 · "+(payload.calculation_contract||"SOURCE VERIFIED");
      const pendingCount=(payload.readiness?.pending_kpi_groups||[]).length;
      $("rr-analytics-caption").textContent=(payload.readiness?.verified_kpi_groups||[]).length+" calculation groups verified; "+pendingCount+" source projection"+(pendingCount===1?"":"s")+" pending.";
    }catch(error){
      $("rr-analytics-source").textContent="TFI2 · UNAVAILABLE";
      $("rr-analytics-caption").textContent=error.message||"Could not load cross-module calculations.";
      ["rr-analytics-output","rr-analytics-attainment","rr-analytics-productivity","rr-analytics-oee","rr-analytics-downtime"].forEach(id=>$(id).textContent="—");
    }
  }

  function refreshLiveReportRows(){
    if(!state.connected||document.hidden||document.querySelector("#rr-edit-modal.open"))return;
    void Promise.allSettled([refreshSummary(),loadRecords(state.page)]);
  }
  function handleDashboardDataSaved(detail){
    void refreshAnalyticsSnapshot();
    if(/^\/api\/(production-entry|import)\//.test(String(detail?.endpoint||""))){
      void Promise.allSettled([refreshSummary(),loadRecords(1)]);
    }
  }
  window.addEventListener("tfi:data-saved",event=>handleDashboardDataSaved(event.detail||{}));
  window.addEventListener("message",event=>{
    if(event.origin!==window.location.origin||event.data?.type!=="TFI_DATA_SAVED")return;
    handleDashboardDataSaved(event.data);
  });
  window.addEventListener("focus",()=>{void refreshAnalyticsSnapshot();refreshLiveReportRows();});
  document.addEventListener("visibilitychange",()=>{
    if(!document.hidden)void refreshAnalyticsSnapshot();
  });
  window.setInterval(()=>{
    if(!document.hidden)void refreshAnalyticsSnapshot();
  },15000);

  function init(){
    document.querySelectorAll("[data-report-page]").forEach(button=>button.addEventListener("click",()=>{
      const page=button.dataset.reportPage;
      if(window.parent&&window.parent!==window)window.parent.postMessage({type:"TFI_NAVIGATE_MODULE",page},"*");
      else window.location.assign("dashboard-preview.html?module="+encodeURIComponent(page==="Reports"?"Reports":page));
    }));
    $("rr-import-open").addEventListener("click",openImportModal);
    $("rr-modal-close").addEventListener("click",closeImportModal);
    $("rr-modal-dismiss").addEventListener("click",closeImportModal);
    $("rr-import-modal").addEventListener("click",event=>{if(event.target===$("rr-import-modal"))closeImportModal();});
    $("rr-edit-close").addEventListener("click",()=>closeModal("rr-edit-modal"));
    $("rr-edit-cancel").addEventListener("click",()=>closeModal("rr-edit-modal"));
    $("rr-edit-modal").addEventListener("click",event=>{if(event.target===$("rr-edit-modal"))closeModal("rr-edit-modal");});
    $("rr-history-close").addEventListener("click",()=>closeModal("rr-history-modal"));
    $("rr-history-dismiss").addEventListener("click",()=>closeModal("rr-history-modal"));
    $("rr-history-modal").addEventListener("click",event=>{if(event.target===$("rr-history-modal"))closeModal("rr-history-modal");});
    document.addEventListener("keydown",event=>{
      if(event.key==="Escape"){
        ["rr-import-modal","rr-edit-modal","rr-history-modal"].forEach(id=>{
          if($(id).classList.contains("open"))closeModal(id);
        });
      }
    });
    ["rr-from","rr-to","rr-line"].forEach(id=>{
      $(id).addEventListener("change",()=>{
        loadRecords(1);
        if(id==="rr-from"||id==="rr-to")void refreshAnalyticsSnapshot();
      });
    });
    ["rr-product","rr-code","rr-search"].forEach(id=>{
      $(id).addEventListener("input",scheduleFilter);
      $(id).addEventListener("change",()=>loadRecords(1));
    });
    document.querySelectorAll("[data-rr-sort]").forEach(button=>button.addEventListener("click",()=>{
      if(state.sortKey===button.dataset.rrSort)state.sortDirection=state.sortDirection==="asc"?"desc":"asc";
      else{state.sortKey=button.dataset.rrSort;state.sortDirection="asc";}
      loadRecords(1);
    }));
    $("rr-reset").addEventListener("click",resetFilters);
    $("rr-export").addEventListener("click",exportCsv);
    $("rr-prev").addEventListener("click",()=>loadRecords(Math.max(1,state.page-1)));
    $("rr-next").addEventListener("click",()=>loadRecords(state.page+1));
    $("rr-edit-selected").addEventListener("click",openEditModal);
    $("rr-history-selected").addEventListener("click",openHistoryModal);
    $("rr-edit-form").addEventListener("submit",saveEdit);
    bindSpreadsheetLink();
    void refreshAnalyticsSnapshot();

    document.body.dataset.tfiReport="production-summary";
    document.body.dataset.tfiSourceSheetId=String(SOURCE.sheetId);
    document.body.dataset.tfiColumns=String(SOURCE.columns.length);
    document.body.dataset.tfiNoMock="true";
    document.body.dataset.tfiAdminImportEntry="true";

    Promise.all([
      api("/api/production-entry/catalog"),
      refreshSummary()
    ]).then(async([catalogPayload])=>{
      state.catalog=catalogPayload.catalog;
      state.canEdit=!!catalogPayload.permissions?.edit;
      state.connected=true;
      setConnection("TFI2 CONNECTED · LIVE SAVED RUNS",false);
      await loadRecords(1);
    }).catch(error=>{
      state.connected=false;
      setConnection("TFI2 UNAVAILABLE · LIVE REGISTER NOT LOADED",true);
      state.records=[];
      state.total=0;
      renderTable();
      showToast(error.message,true);
    }).finally(()=>{
      document.body.dataset.tfiReady="true";
      document.body.dataset.tfiDataSource=state.connected?"TFI2":"UNAVAILABLE";
      document.body.dataset.tfiEditPermission=String(state.canEdit);
    });
  }
  document.addEventListener("DOMContentLoaded",init);
})();
