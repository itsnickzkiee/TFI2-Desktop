(function(){
  "use strict";
  const DATA=window.TFI_NON_PROD_DATA;
  if(!DATA)throw new Error("NON-PROD source map was not loaded.");
  const $=id=>document.getElementById(id);
  const state={rowCount:12,catalog:null,canCreate:false,canEdit:false,busy:false,records:[],editing:null};
  const esc=value=>String(value==null?"":value).replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  function options(items,label){return '<option value="">Select '+esc(label)+'</option>'+(items||[]).map(item=>'<option value="'+esc(item)+'">'+esc(item)+'</option>').join("");}
  function toast(message,error){const el=$("np-toast");el.textContent=message;el.classList.toggle("is-error",!!error);el.hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.hidden=true,4200);}
  async function api(url,opts){
    const response=await fetch(url,Object.assign({credentials:"same-origin"},opts||{}));
    let payload={};try{payload=await response.json();}catch(_e){}
    if(!response.ok)throw new Error(payload.error||"TFI2 could not complete the request.");
    return payload;
  }
  function lists(){
    const local=DATA.dropdowns;
    const c=state.catalog||{};
    return {
      names:Array.isArray(c.names)&&c.names.length?c.names:local.manpowerNames.options,
      positions:Array.isArray(c.positions)&&c.positions.length?c.positions:local.positions.options,
      activities:Array.isArray(c.activities)&&c.activities.length?c.activities:local.activities.options,
      locations:Array.isArray(c.locations)&&c.locations.length?c.locations:local.locations.options
    };
  }
  function makeRow(index){
    const n=index+1,L=lists();
    return '<tr data-row="'+n+'"><td class="np-rownum">'+n+'</td>'+
      '<td><input class="np-input" type="date" data-field="A" aria-label="Date, row '+n+'"></td>'+
      '<td><select class="np-select" data-field="B" aria-label="Name, row '+n+'">'+options(L.names,"name")+'</select></td>'+
      '<td><select class="np-select" data-field="C" aria-label="Position, row '+n+'">'+options(L.positions,"position")+'</select></td>'+
      '<td><input class="np-input" type="time" data-field="D" aria-label="Time Start, row '+n+'"></td>'+
      '<td><input class="np-input" type="time" data-field="E" aria-label="Time End, row '+n+'"></td>'+
      '<td><input class="np-input np-minutes" type="number" min="0" step="1" data-field="F" inputmode="numeric" aria-label="Total of minutes, row '+n+'"></td>'+
      '<td class="np-calc-cell"><input class="np-input np-hours" type="text" data-field="G" readonly tabindex="-1" aria-label="No. of Working Hours, row '+n+'"></td>'+
      '<td><select class="np-select" data-field="H" aria-label="Activities, row '+n+'">'+options(L.activities,"activity")+'</select></td>'+
      '<td><select class="np-select" data-field="I" aria-label="Location, row '+n+'">'+options(L.locations,"location")+'</select></td>'+
      '<td><input class="np-input" type="text" maxlength="2000" data-field="J" aria-label="Remarks, row '+n+'"></td></tr>';
  }
  function renderRows(){$("np-tbody").innerHTML=Array.from({length:state.rowCount},(_,i)=>makeRow(i)).join("");updateStatus();}
  function rowHasData(row){return Array.from(row.querySelectorAll('[data-field]:not([data-field="G"])')).some(el=>String(el.value||"").trim()!=="");}
  function readRow(row){
    const val=k=>row.querySelector('[data-field="'+k+'"]').value;
    return {work_date:val("A"),employee_name:val("B"),employee_position:val("C"),time_start:val("D"),time_end:val("E"),total_minutes:val("F"),activity:val("H"),location:val("I"),remarks:val("J")};
  }
  function updateHours(input){const out=input.closest("tr").querySelector('[data-field="G"]');out.value=input.value===""?"":(Number(input.value)/60).toFixed(2);}
  function updateStatus(){
    const rows=Array.from($("np-tbody").rows),filled=rows.filter(rowHasData).length;
    $("np-table-status").textContent=filled+" of "+state.rowCount+" entry rows contain data";
    $("np-source-status").textContent="Source sheet: NON-PROD · Sheet ID 1381857831 · no historical rows preloaded";
    $("np-add-rows").disabled=state.rowCount>=646;
    $("np-add-rows").textContent=state.rowCount>=646?"ENTRY LIMIT REACHED":"ADD 12 ROWS";
    $("np-save").disabled=(!state.canCreate&&!(state.editing&&state.canEdit))||state.busy;
  }
  function fmtDate(v){if(!v)return "";const d=new Date(v+"T00:00:00");return Number.isNaN(d.getTime())?v:d.toLocaleDateString("en-PH",{year:"numeric",month:"short",day:"2-digit"});}
  function fmtTime(v){return v?String(v).slice(0,5):"";}
  function renderRecords(){
    const body=$("np-records-tbody");
    if(!state.records.length){body.innerHTML='<tr><td colspan="12" style="padding:18px;text-align:center;color:#77857c">No NON-PROD records saved yet.</td></tr>';}
    else body.innerHTML=state.records.map((r,i)=>'<tr><td class="np-rownum">'+((page-1)*100+i+1)+'</td>'+
      '<td>'+esc(fmtDate(r.work_date))+'</td><td>'+esc(r.employee_name)+'</td><td>'+esc(r.employee_position)+'</td>'+
      '<td>'+esc(fmtTime(r.time_start))+'</td><td>'+esc(fmtTime(r.time_end))+'</td><td>'+esc(r.total_minutes)+'</td>'+
      '<td>'+esc(r.working_hours==null?"":Number(r.working_hours).toFixed(2))+'</td><td>'+esc(r.activity)+'</td>'+
      '<td>'+esc(r.location)+'</td><td>'+esc(r.remarks)+'</td><td>'+(state.canEdit?'<button type="button" class="np-btn np-record-edit" data-record-id="'+esc(r.id)+'">EDIT</button>':'—')+'</td></tr>').join("");
    $("np-records-status").textContent=state.records.length+" records shown · "+(state.records.length?"live from TFI2":"waiting for first save");
  }
  async function loadLivePage(){
    if(loading)return;loading=true;
    try{
      const params=new URLSearchParams({page:String(page),page_size:"100"});
      for(const k of ["from","to"]){const v=state.controls?.querySelector("[data-"+k+"]")?.value;if(v)params.set("date_"+k,v);}
      const result=await api("/api/nonprod/records?"+params);
      state.records=result.records||[];hasMore=Boolean(result.has_more??(page*100<Number(result.total_count??0)));
      renderRecords();
      if(state.controls){state.controls.querySelector("[data-page]").textContent="Page "+page;state.controls.querySelector("[data-prev]").disabled=page<=1;state.controls.querySelector("[data-next]").disabled=!hasMore;}
    }catch(error){toast(error.message,true);$("np-records-status").textContent=error.message;}
    finally{loading=false;}
  }
  async function loadRecords(){
    await loadLivePage();
  }
  let liveMode=true,page=1,hasMore=false,loading=false,switchMode=()=>{};
  function installLiveMode(){
    const table=$("np-table"),manual=$("np-tbody"),saved=$("np-records-tbody");
    const oldTable=saved.closest("table"),oldWrap=oldTable.parentElement;
    const originalHead=table.querySelector("thead"),cols=table.querySelector("colgroup");
    const liveHead=oldTable.querySelector("thead");const number=document.createElement("th");number.textContent="#";liveHead.rows[0].prepend(number);
    const toolbar=document.querySelector(".np-toolbar"),heading=table.closest(".np-table-scroll").previousElementSibling;
    const savedHeading=$("np-backend-status").closest("section"),savedFooter=$("np-records-status").closest("div");
    const footer=$("np-table-status").closest("div");
    const controls=document.createElement("div");controls.style.cssText="display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 0";
    controls.innerHTML='<button type="button" class="np-btn np-btn-primary" data-new>+ NEW ENTRY</button><label>From <input type="date" data-from></label><label>To <input type="date" data-to></label><button type="button" class="np-btn" data-filter>Apply</button><button type="button" class="np-btn" data-prev>Previous</button><button type="button" class="np-btn" data-next>Next</button><span data-page></span>';
    heading.before(savedHeading,controls);table.insertBefore(liveHead,manual);table.appendChild(saved);oldWrap.remove();
    const back=document.createElement("button");back.type="button";back.className="np-btn";back.textContent="BACK TO RECORDS";toolbar.querySelector(".np-actions").prepend(back);
    switchMode=function(live){
      liveMode=live;
      for(const el of [manual,originalHead,cols,toolbar,footer])if(el)el.style.display=live?"none":"";
      for(const el of [saved,liveHead,savedHeading,controls,savedFooter])if(el)el.style.display=live?"":"none";
      table.classList.toggle("np-live-table",live);
      const tag=heading.querySelector(".np-empty-tag");if(tag)tag.textContent=live?"LIVE RECORDS":"MANUAL ENTRY";
      if(live)loadRecords();
    };
    controls.querySelector("[data-new]").disabled=!state.canCreate;
    controls.querySelector("[data-new]").onclick=()=>{state.editing=null;$("np-clear").click();switchMode(false);};
    back.onclick=()=>{if(state.busy)return;if(state.editing||Array.from(manual.rows).some(rowHasData)){if(!confirm("Return to records? Unsaved entry will be cleared."))return;$("np-clear").click();}switchMode(true);};
    controls.querySelector("[data-filter]").onclick=()=>{page=1;loadRecords();};
    controls.querySelector("[data-prev]").onclick=()=>{if(page>1&&!loading){page--;loadRecords();}};
    controls.querySelector("[data-next]").onclick=()=>{if(hasMore&&!loading){page++;loadRecords();}};
    const css=document.createElement("style");css.textContent=".np-live-table{table-layout:auto!important;width:100%;min-width:1450px}.np-live-table td{padding:8px 12px!important;white-space:normal}.np-live-table td:last-child{min-width:180px;white-space:nowrap}.np-live-table td:last-child button{margin:3px}";document.head.appendChild(css);
    state.controls=controls;switchMode(true);
  }
  async function initialize(){
    try{
      const result=await api("/api/nonprod/catalog");
      state.catalog=result.catalog||{};
      state.canCreate=!!(result.permissions&&result.permissions.create);
      state.canEdit=!!(result.permissions&&result.permissions.edit);
      $("np-backend-status").innerHTML="<i></i> TFI2 CONNECTED";
      $("np-backend-status").classList.add("is-connected");
      renderRows();
      installLiveMode();
      if(!state.canCreate){$("np-save").disabled=true;toast("You have view access. Ask the administrator for NON-PROD create permission.",true);}
    }catch(error){
      $("np-backend-status").textContent="BACKEND UNAVAILABLE";
      $("np-records-tbody").innerHTML='<tr><td colspan="12" style="padding:18px;text-align:center;color:#a33">'+esc(error.message)+'</td></tr>';
      $("np-records-status").textContent="Could not load TFI2 records.";
      toast(error.message,true);
    }
  }
  $("np-tbody").addEventListener("input",event=>{
    if(event.target.matches('[data-field="F"]'))updateHours(event.target);
    if(event.target.matches("[data-field]"))updateStatus();
  });
  $("np-tbody").addEventListener("change",event=>{if(event.target.matches("[data-field]"))updateStatus();});
  $("np-records-tbody").addEventListener("click",event=>{
    const button=event.target.closest(".np-record-edit");if(!button||!state.canEdit)return;
    const record=state.records.find(item=>item.id===button.dataset.recordId);if(!record)return;
    $("np-tbody").querySelectorAll("input,select").forEach(el=>el.value="");
    const row=$("np-tbody").rows[0];
    const values={A:record.work_date,B:record.employee_name,C:record.employee_position,D:fmtTime(record.time_start),E:fmtTime(record.time_end),F:record.total_minutes,H:record.activity,I:record.location,J:record.remarks};
    Object.entries(values).forEach(([key,value])=>{row.querySelector('[data-field="'+key+'"]').value=value==null?"":value;});
    updateHours(row.querySelector('[data-field="F"]'));
    switchMode(false);state.editing=record;$("np-save").textContent="UPDATE NON-PROD RECORD";updateStatus();
    toast("Editing saved record. Update the first entry row, then save.");
    window.scrollTo({top:0,behavior:"smooth"});
  });
  $("np-add-rows").addEventListener("click",()=>{state.rowCount=Math.min(state.rowCount+12,646);renderRows();});
  $("np-clear").addEventListener("click",()=>{$("np-tbody").querySelectorAll("input,select").forEach(el=>el.value="");state.editing=null;$("np-save").textContent="SAVE NON-PROD RECORD";updateStatus();toast("Current entry form cleared. Saved TFI2 records were not changed.");});
  $("np-save").addEventListener("click",async()=>{
    if(state.busy)return;
    const first=$("np-tbody").rows[0];
    if(state.editing){
      const changes=readRow(first);
      state.busy=true;updateStatus();$("np-save").textContent="UPDATING…";
      try{
        await api("/api/nonprod/records/"+encodeURIComponent(state.editing.id),{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({expected_version:state.editing.version,changes:changes})});
        state.editing=null;
        $("np-tbody").querySelectorAll("input,select").forEach(el=>el.value="");
        await loadRecords();toast("NON-PROD record updated. Revision history was recorded.");
      }catch(error){toast(error.message,true);}
      finally{state.busy=false;$("np-save").textContent=state.editing?"UPDATE NON-PROD RECORD":"SAVE NON-PROD RECORD";updateStatus();}
      return;
    }
    const rows=Array.from($("np-tbody").rows).filter(rowHasData).map((row,i)=>({row_index:i+1,record_data:readRow(row)}));
    if(!rows.length){toast("Enter at least one NON-PROD record before saving.",true);return;}
    state.busy=true;updateStatus();$("np-save").textContent="SAVING…";
    try{
      const result=await api("/api/nonprod/records",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({records:rows})});
      const inserted=Number(result.inserted||0);
      $("np-tbody").querySelectorAll("input,select").forEach(el=>el.value="");
      updateStatus();await loadRecords();
      toast(inserted+" NON-PROD record"+(inserted===1?"":"s")+" saved to TFI2.");
    }catch(error){toast(error.message,true);}
    finally{state.busy=false;$("np-save").textContent="SAVE NON-PROD RECORD";updateStatus();}
  });
  renderRows();
  document.body.dataset.tfiReady="true";
  document.body.dataset.tfiSourceSheet=DATA.source.sheet;
  document.body.dataset.tfiSourceColumns=String(DATA.columns.length);
  document.body.dataset.tfiBackend="nonprod-v1";
  document.body.dataset.tfiHistoricalRowsLoaded="0";
  window.addEventListener("focus",()=>{if(liveMode&&state.catalog)loadRecords();});
  initialize();
})();