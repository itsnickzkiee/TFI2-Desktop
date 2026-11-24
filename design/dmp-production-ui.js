(function(){
  "use strict";

  const DATA = window.TFI_DMP_PRODUCTION_DATA;
  if(!DATA) throw new Error("DMP Production source lists were not loaded.");

  const $ = id => document.getElementById(id);
  const ROW_COUNT = 12;
  const PAGE_SIZE = 100;
  const FIELD_COLUMNS = ["A","B","C","D","E","F","G","H"];
  const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  const optionList = items => '<option value=""></option>' + items.map(item => '<option value="'+esc(item)+'">'+esc(item)+'</option>').join("");

  let canCreate = false;
  let canEdit = false;
  let backendReady = false;
  let editing = null;
  let savedRecords = [];
  let currentPage = 1;
  let hasMore = false;
  let viewMode = "records";

  const columns = [
    {key:"A",label:"Production Date0",type:"date"},
    {key:"B",label:"Product Code",type:"text",maxlength:100,placeholder:"Enter product code"},
    {key:"C",label:"Process",type:"select",items:DATA.processes},
    {key:"D",label:"Regular's Name/Casual",type:"select",items:DATA.workers},
    {key:"E",label:"Count",type:"number",step:"any",min:"0"},
    {key:"F",label:"Start",type:"time"},
    {key:"G",label:"End",type:"time"},
    {key:"H",label:"Total Time",type:"number",step:"any",min:"0"},
    {key:"I",label:"Position",type:"position"}
  ];

  function showToast(message,error){
    const toast=$("dmp-toast");
    toast.textContent=message;
    toast.classList.toggle("is-error",!!error);
    toast.hidden=false;
    window.clearTimeout(showToast.timer);
    showToast.timer=window.setTimeout(()=>{toast.hidden=true;},4800);
  }

  async function api(url,options){
    const response=await fetch(url,Object.assign({credentials:"same-origin"},options||{}));
    let payload={};
    try{payload=await response.json();}catch(_error){}
    if(!response.ok){
      if(response.status===401||response.status===403){
        throw new Error(payload.error||"Your session or DMP Production permission is no longer active. Sign in again or contact the administrator.");
      }
      throw new Error(payload.error||"TFI2 could not complete the request. Try again.");
    }
    return payload;
  }

  function setMode(mode){
    viewMode=mode;
    const recordsMode=mode==="records";
    $("dmp-record-toolbar").hidden=!recordsMode;
    $("dmp-toolbar").hidden=recordsMode;
    $("dmp-summary").hidden=!recordsMode;
    $("dmp-table-heading-title").textContent=recordsMode?"DMP PRODUCTION RECORDS":(editing?"EDIT DMP PRODUCTION RECORD":"NEW MANUAL DMP ENTRY");
    $("dmp-table-heading-note").textContent=recordsMode?"Imported spreadsheet records · original DMP columns A:I":"Manpower and process details · original DMP columns A:I";
    $("dmp-table-mode-tag").innerHTML=recordsMode?"<i></i> LIVE RECORDS":"<i></i> MANUAL ENTRY";
    $("dmp-table").setAttribute("aria-label",recordsMode?"DMP Production records table":"DMP Production manual entry table");
  }

  function cellMarkup(col,index){
    const aria=esc(col.label+" row "+(index+1));
    if(col.type==="select"){
      const items=col.key==="C"?DATA.processes:DATA.workers;
      return '<td><select class="dmp-cell dmp-select" data-col="'+col.key+'" aria-label="'+aria+'">'+optionList(items)+'</select></td>';
    }
    if(col.type==="position"){
      return '<td class="dmp-position-cell"><input class="dmp-cell dmp-position" data-col="I" type="text" readonly tabindex="-1" aria-label="'+aria+'"></td>';
    }
    return '<td><input class="dmp-cell" data-col="'+col.key+'" type="'+col.type+'"'+(col.step?' step="'+col.step+'"':'')+(col.min?' min="'+col.min+'"':'')+(col.maxlength?' maxlength="'+col.maxlength+'"':'')+(col.placeholder?' placeholder="'+esc(col.placeholder)+'"':'')+' aria-label="'+aria+'"></td>';
  }

  function buildRows(){
    $("dmp-tbody").innerHTML=Array.from({length:ROW_COUNT},(_,i)=>
      '<tr data-row="'+(i+1)+'"><th class="dmp-rownum">'+(i+1)+'</th>'+
      columns.map(col=>cellMarkup(col,i)).join("")+
      '<td class="dmp-entry-actions">—</td></tr>'
    ).join("");

    $("dmp-tbody").addEventListener("input",updateSummary);
    $("dmp-tbody").addEventListener("change",event=>{
      const row=event.target.closest("tr");
      if(!row)return;
      if(event.target.dataset.col==="D"){
        const worker=event.target.value;
        row.querySelector('[data-col="I"]').value=DATA.positions[worker]||"";
      }
      updateSummary();
    });
  }

  function rowHasData(row){
    return FIELD_COLUMNS.some(key=>{
      const el=row.querySelector('[data-col="'+key+'"]');
      return el&&String(el.value||"").trim()!=="";
    });
  }

  function readRow(row){
    const value=key=>row.querySelector('[data-col="'+key+'"]')?.value??"";
    return {
      production_date:value("A"),
      product_code:value("B"),
      process:value("C"),
      worker_name:value("D"),
      worker_count:value("E"),
      start_time:value("F"),
      end_time:value("G"),
      total_time_hours:value("H")
    };
  }

  function updateSummary(){
    if(viewMode!=="entry")return;
    const rows=Array.from($("dmp-tbody").querySelectorAll("tr"));
    const filled=rows.filter(row=>row.querySelector("[data-col]")&&rowHasData(row));
    $("dmp-table-status").textContent=filled.length+" of "+ROW_COUNT+" manual entry rows contain data · incomplete rows can be saved for later completion";
  }

  async function loadLiveSummary(from,to){
    try{
      const query=new URLSearchParams();
      if(from)query.set("date_from",from);
      if(to)query.set("date_to",to);
      const payload=await api("/api/dmp-production/summary?"+query.toString());
      const summary=payload.summary||{};
      const integer=value=>Number(value||0).toLocaleString();
      const hours=Number(summary.total_time_hours||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
      $("dmp-total-records").textContent=integer(summary.total_records);
      $("dmp-complete-records").textContent=integer(summary.complete_records);
      $("dmp-incomplete-records").textContent=integer(summary.incomplete_records);
      $("dmp-unique-workers").textContent=integer(summary.unique_workers);
      $("dmp-live-total-time").textContent=hours;
      $("dmp-summary").setAttribute("aria-label","Live database summary: "+integer(summary.total_records)+" total records, "+integer(summary.incomplete_records)+" incomplete records");
    }catch(error){
      ["dmp-total-records","dmp-complete-records","dmp-incomplete-records","dmp-unique-workers","dmp-live-total-time"].forEach(id=>$(id).textContent="—");
      $("dmp-saved-status").textContent="Records are loading, but the live database summary could not be refreshed.";
      showToast("Live DMP summary unavailable: "+error.message,true);
    }
  }

  function setEditingState(value){
    editing=value;
    $("dmp-save").textContent=editing?"UPDATE DMP RECORD":"SAVE DMP RECORD";
    $("dmp-save").disabled=editing?!canEdit:!canCreate;
    $("dmp-form-mode").textContent=editing?"EDITING SAVED RECORD · VERSION "+editing.version:"NEW DMP ENTRY";
    $("dmp-form-mode").classList.toggle("is-editing",!!editing);
    $("dmp-table-heading-title").textContent=editing?"EDIT DMP PRODUCTION RECORD":"NEW MANUAL DMP ENTRY";
  }

  function clearForm(quiet){
    $("dmp-tbody").querySelectorAll("input,select").forEach(el=>{el.value="";});
    $("dmp-tbody").querySelectorAll("tr").forEach(row=>row.classList.remove("dmp-duplicate-row"));
    setEditingState(null);
    updateSummary();
    if(!quiet)showToast("Form cleared. No saved records were changed.");
  }

  function setRowValues(row,record){
    const values={
      A:record.production_date||"",
      B:record.product_code||"",
      C:record.process||"",
      D:record.worker_name||"",
      E:record.worker_count??"",
      F:record.start_time?String(record.start_time).slice(0,5):"",
      G:record.end_time?String(record.end_time).slice(0,5):"",
      H:record.total_time_hours??"",
      I:record.worker_position||""
    };
    Object.entries(values).forEach(([key,value])=>{
      const el=row.querySelector('[data-col="'+key+'"]');
      if(!el)return;
      if(el.tagName==="SELECT"&&value&&!Array.from(el.options).some(option=>option.value===String(value))){
        const option=document.createElement("option");
        option.value=String(value);
        option.textContent=String(value);
        el.add(option);
      }
      el.value=value;
    });
  }

  function beginEdit(recordId){
    if(!canEdit)return;
    const record=savedRecords.find(item=>item.id===recordId);
    if(!record)return;
    setMode("entry");
    buildRows();
    clearForm(true);
    const rows=$("dmp-tbody").querySelectorAll("tr");
    setRowValues(rows[0],record);
    setEditingState({id:record.id,version:Number(record.version)});
    updateSummary();
    $("dmp-table-scroll").scrollIntoView({behavior:"smooth",block:"start"});
    showToast("Record loaded for editing. Position remains controlled by DMP LEGEND.");
  }

  function formatDate(value){
    if(!value)return "—";
    const text=String(value).slice(0,10);
    const parts=text.split("-").map(Number);
    if(parts.length!==3||!parts[0]||!parts[1]||!parts[2])return text;
    return new Date(parts[0],parts[1]-1,parts[2]).toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"});
  }

  function formatTime(value){
    if(!value)return "—";
    const match=String(value).match(/^(\d{1,2}):(\d{2})/);
    if(!match)return String(value);
    const hour=Number(match[1]);
    const suffix=hour>=12?"PM":"AM";
    const displayHour=hour%12||12;
    return displayHour+":"+match[2]+" "+suffix;
  }

  function formatNumber(value){
    if(value===null||value===undefined||value==="")return "—";
    return Number(value).toLocaleString(undefined,{maximumFractionDigits:4});
  }

  function renderSavedRecords(records){
    const tbody=$("dmp-tbody");
    if(!records.length){
      tbody.innerHTML='<tr><td colspan="11" class="dmp-no-records">No DMP Production records found for this date range. Imported spreadsheet records will appear here automatically after import approval.</td></tr>';
      return;
    }
    const startIndex=(currentPage-1)*PAGE_SIZE;
    tbody.innerHTML=records.map((record,index)=>{
      const actions=[
        canEdit?'<button class="dmp-row-action" type="button" data-edit-record="'+esc(record.id)+'">Edit</button>':"",
        '<button class="dmp-row-action dmp-row-history" type="button" data-history-record="'+esc(record.id)+'">History</button>'
      ].filter(Boolean).join("");
      const completeness=String(record.completeness_status||"unassessed").toLowerCase();
      const completenessLabel=completeness==="complete"?"Complete":completeness==="incomplete"?"Incomplete":"Unassessed";
      return '<tr data-record-id="'+esc(record.id)+'">'+
        '<th class="dmp-rownum">'+(startIndex+index+1)+'</th>'+
        '<td class="dmp-date-cell">'+esc(formatDate(record.production_date))+'</td>'+
        '<td>'+esc(record.product_code||"—")+'</td>'+
        '<td>'+esc(record.process||"—")+'</td>'+
        '<td>'+esc(record.worker_name||"—")+'</td>'+
        '<td class="num">'+esc(formatNumber(record.worker_count))+'</td>'+
        '<td>'+esc(formatTime(record.start_time))+'</td>'+
        '<td>'+esc(formatTime(record.end_time))+'</td>'+
        '<td class="num">'+esc(formatNumber(record.total_time_hours))+'</td>'+
        '<td class="dmp-position-cell">'+esc(record.worker_position||"—")+'</td>'+
        '<td class="dmp-action-cell"><span class="dmp-completeness '+esc(completeness)+'">'+esc(completenessLabel)+'</span>'+actions+'</td>'+
      '</tr>';
    }).join("");
  }

  async function loadSavedRecords(reset){
    if(reset){
      currentPage=1;
      savedRecords=[];
    }
    $("dmp-saved-status").textContent="Loading imported and saved DMP records from TFI2…";
    try{
      const from=$("dmp-date-from").value;
      const to=$("dmp-date-to").value;
      if(reset)await loadLiveSummary(from,to);
      const query=new URLSearchParams({page:String(currentPage),page_size:String(PAGE_SIZE)});
      if(from)query.set("date_from",from);
      if(to)query.set("date_to",to);
      const payload=await api("/api/dmp-production/records?"+query.toString());
      const records=payload.records||[];
      savedRecords=reset?records:savedRecords.concat(records);
      hasMore=!!payload.has_more;
      renderSavedRecords(savedRecords);
      const incompleteLoaded=savedRecords.filter(record=>record.completeness_status==="incomplete").length;
      $("dmp-saved-status").textContent=savedRecords.length.toLocaleString()+" DMP record(s) loaded from TFI2 · "+incompleteLoaded.toLocaleString()+" incomplete record(s) in loaded rows";
      $("dmp-table-status").textContent=savedRecords.length.toLocaleString()+" record(s) displayed in the DMP Production table"+(hasMore?" · More records are available below":" · All matching records are loaded");
      $("dmp-load-more").hidden=!hasMore;
    }catch(error){
      $("dmp-saved-status").textContent="Could not load DMP Production records.";
      $("dmp-tbody").innerHTML='<tr><td colspan="11" class="dmp-no-records">'+esc(error.message)+'</td></tr>';
      $("dmp-table-status").textContent="TFI2 records could not be loaded.";
      $("dmp-load-more").hidden=true;
      showToast(error.message,true);
    }
  }

  async function saveForm(){
    if(!backendReady){
      showToast("TFI2 is not ready. Refresh the page and sign in again.",true);
      return;
    }
    const rows=Array.from($("dmp-tbody").querySelectorAll("tr"));
    if(editing){
      const row=rows[0];
      if(!row||!rowHasData(row)){
        showToast("Enter at least one field before updating the record.",true);
        return;
      }
      const changes=readRow(row);
      $("dmp-save").disabled=true;
      try{
        const result=await api("/api/dmp-production/records/"+encodeURIComponent(editing.id),{
          method:"PATCH",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({expected_version:editing.version,changes,change_reason:"Updated through DMP Production entry"})
        });
        setMode("records");
        showToast(result.changed?"DMP Production record updated. Revision history was recorded.":"No changes were detected.");
        await loadSavedRecords(true);
      }catch(error){
        showToast(error.message,true);
      }finally{
        $("dmp-save").disabled=editing?!canEdit:!canCreate;
      }
      return;
    }

    if(!canCreate){
      showToast("Your TFI role does not have DMP Production create permission.",true);
      return;
    }
    if(!rows.some(row=>row.querySelector("[data-col]")&&rowHasData(row))){
      showToast("Enter at least one field in a row before saving.",true);
      return;
    }

    const records=rows.map(readRow);
    $("dmp-save").disabled=true;
    try{
      const result=await api("/api/dmp-production/records",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({records})
      });
      const rowResults=result.results||[];
      rowResults.forEach(item=>{
        if(item.status==="inserted"||item.status==="empty"){
          const row=rows[item.row_index-1];
          if(row)row.querySelectorAll("input,select").forEach(el=>{el.value="";});
        }else if(item.status==="duplicate"){
          const row=rows[item.row_index-1];
          if(row)row.classList.add("dmp-duplicate-row");
        }
      });
      setMode("records");
      await loadSavedRecords(true);
      if(result.inserted){
        showToast(result.inserted+" DMP record(s) saved · "+(result.duplicates||0)+" exact duplicate(s) skipped.");
      }else if(result.duplicates){
        showToast("No new records saved. "+result.duplicates+" exact duplicate row(s) were blocked.",true);
      }else{
        showToast("No nonblank rows were submitted.");
      }
    }catch(error){
      showToast(error.message,true);
    }finally{
      $("dmp-save").disabled=!canCreate;
    }
  }

  async function showHistory(recordId){
    $("dmp-history-content").textContent="Loading revision history…";
    $("dmp-history-panel").hidden=false;
    try{
      const payload=await api("/api/dmp-production/records/"+encodeURIComponent(recordId)+"/revisions");
      const revisions=payload.revisions||[];
      if(!revisions.length){
        $("dmp-history-content").textContent="No edits have been recorded for this DMP record.";
        return;
      }
      $("dmp-history-content").innerHTML=revisions.map(revision=>
        '<article class="dmp-history-item">'+
          '<strong>Version '+esc(revision.version)+'</strong>'+
          '<span>'+esc(revision.changed_at||"")+'</span>'+
          '<p>Changed fields: '+esc((revision.changed_fields||[]).join(", "))+'</p>'+
          (revision.change_reason?'<p>Reason: '+esc(revision.change_reason)+'</p>':"")+
        '</article>'
      ).join("");
    }catch(error){
      $("dmp-history-content").textContent=error.message;
    }
  }

  async function initialize(){
    $("dmp-save").disabled=true;
    setMode("records");
    try{
      const me=await api("/api/auth/me");
      const permissions=new Set(me.permissions||[]);
      canCreate=permissions.has("dmp_production.create");
      canEdit=permissions.has("dmp_production.edit");
      $("dmp-save").disabled=!canCreate;
      $("dmp-save").title=canCreate?"Save new DMP Production records":"Your role does not have create permission";

      try{
        const optionPayload=await api("/api/dmp-production/options");
        const options=optionPayload.options||{};
        DATA.workers=(options.workers||[]).map(item=>item.name).filter(Boolean);
        DATA.processes=(options.processes||[]).filter(Boolean);
        DATA.positions={};
        (options.workers||[]).forEach(item=>{
          if(item.name)DATA.positions[item.name]=item.position||"";
        });
      }catch(optionError){
        showToast("DMP records are available, but manual-entry reference lists could not be loaded: "+optionError.message,true);
      }

      backendReady=true;
      $("dmp-saved-status").textContent="Connected to TFI2 · loading imported records…";
      await loadSavedRecords(true);
    }catch(error){
      $("dmp-saved-status").textContent="Sign in again or ask the administrator to check DMP Production access.";
      $("dmp-tbody").innerHTML='<tr><td colspan="11" class="dmp-no-records">'+esc(error.message)+'</td></tr>';
      $("dmp-table-status").textContent="TFI2 connection or DMP Production access is unavailable.";
      $("dmp-load-more").hidden=true;
      showToast(error.message,true);
    }
    document.body.dataset.tfiReady="true";
    document.body.dataset.tfiRows=String(ROW_COUNT);
    document.body.dataset.tfiWorkers=String(DATA.workers.length);
    document.body.dataset.tfiProcesses=String(DATA.processes.length);
    document.body.dataset.tfiProductCodeReferenceCount=String(DATA.productCodes.length);
    document.body.dataset.tfiNoMock="true";
  }

  $("dmp-new-entry").addEventListener("click",()=>{
    if(!canCreate){
      showToast("Your TFI role does not have DMP Production create permission.",true);
      return;
    }
    editing=null;
    setMode("entry");
    buildRows();
    clearForm(true);
    $("dmp-save").disabled=false;
    $("dmp-table-scroll").scrollIntoView({behavior:"smooth",block:"start"});
  });
  $("dmp-back-records").addEventListener("click",()=>{
    setMode("records");
    loadSavedRecords(true);
  });
  $("dmp-reset").addEventListener("click",()=>clearForm(false));
  $("dmp-save").addEventListener("click",saveForm);
  $("dmp-refresh-records").addEventListener("click",()=>loadSavedRecords(true));
  $("dmp-filter-records").addEventListener("click",()=>loadSavedRecords(true));
  $("dmp-load-more").addEventListener("click",()=>{
    if(!hasMore)return;
    currentPage+=1;
    loadSavedRecords(false);
  });
  $("dmp-tbody").addEventListener("click",event=>{
    const editButton=event.target.closest("[data-edit-record]");
    const historyButton=event.target.closest("[data-history-record]");
    if(editButton)beginEdit(editButton.dataset.editRecord);
    if(historyButton)showHistory(historyButton.dataset.historyRecord);
  });
  $("dmp-history-close").addEventListener("click",()=>{$("dmp-history-panel").hidden=true;});

  window.addEventListener("focus",()=>{
    if(viewMode==="records"&&backendReady)loadSavedRecords(true);
  });

  initialize();
})();
