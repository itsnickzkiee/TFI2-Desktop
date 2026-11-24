(function(){
"use strict";
const $=id=>document.getElementById(id);
const tbody=$("cdpr-tbody"),save=$("cdpr-save");
if(!tbody||!save)return;
let catalog={product_codes:[],line_numbers:[]},permissions={view:false,create:false,edit:false};
let page=1,pageSize=25,totalCount=0,activeTab="saved",panelLoaded=false,editing=null;
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt=v=>v===null||v===undefined||v===""?"":Number(v).toLocaleString("en-US",{maximumFractionDigits:4});
const columns=["A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W"];
const toast=message=>{const el=$("cdpr-toast");el.textContent=message;el.hidden=false;clearTimeout(toast._timer);toast._timer=setTimeout(()=>el.hidden=true,4200);};
async function api(path,options={}){
 const response=await fetch(path,{credentials:"same-origin",...options,headers:{"Content-Type":"application/json",...(options.headers||{})}});
 let body={};try{body=await response.json();}catch(_){}
 if(!response.ok)throw new Error(body.error||body.message||("Request failed ("+response.status+")"));
 return body;
}
function status(message,kind="info"){
 let el=$("cdpr-live-status");
 if(!el){el=document.createElement("div");el.id="cdpr-live-status";el.className="cdpr-live-status";document.querySelector(".cdpr-toolbar")?.insertAdjacentElement("afterend",el);}
 el.className="cdpr-live-status "+kind;el.textContent=message;
}
function applyCatalog(){
 $("cdpr-product-codes").innerHTML=(catalog.product_codes||[]).map(code=>'<option value="'+esc(code)+'"></option>').join("");
 tbody.querySelectorAll('[data-col="B"]').forEach(select=>{
  const current=select.value;
  select.innerHTML='<option value=""></option>'+(catalog.line_numbers||[]).map(line=>'<option value="'+esc(line)+'">'+esc(line)+'</option>').join("");
  if((catalog.line_numbers||[]).includes(current))select.value=current;
 });
 const filter=$("cdpr-filter-line");
 if(filter){
  const current=filter.value;
  filter.innerHTML='<option value="">All lines</option>'+(catalog.line_numbers||[]).map(line=>'<option value="'+esc(line)+'">'+esc(line)+'</option>').join("");
  if((catalog.line_numbers||[]).includes(current))filter.value=current;
 }
}
function recordDataFromRow(tr){
 const data={};columns.forEach(col=>{data[col]=tr.querySelector('[data-col="'+col+'"]')?.value??"";});
 return {row_index:Number(tr.dataset.row)||1,record_data:data};
}
function collectRows(){
 return [...tbody.querySelectorAll("tr")].map(recordDataFromRow)
  .filter(item=>Object.values(item.record_data).some(value=>String(value??"").trim()!==""));
}
function insertRegister(){
 if($("cdpr-register"))return;
 const panel=document.createElement("section");
 panel.id="cdpr-register";panel.className="cdpr-register";panel.hidden=true;
 panel.innerHTML=`
 <div class="cdpr-register-head">
  <div><span class="cdpr-eyebrow">TFI2 LIVE DATABASE</span><h2>Saved Coding DPR Records</h2><p>Saved entries, seven separate lot slots, source-aligned totals, and revision history.</p></div>
  <button id="cdpr-refresh" class="cdpr-btn cdpr-btn-light" type="button">REFRESH</button>
 </div>
 <div class="cdpr-register-tabs">
  <button id="cdpr-tab-saved" class="cdpr-tab active" type="button">SAVED RECORDS</button>
  <button id="cdpr-tab-inbox" class="cdpr-tab" type="button">CODING DPR INBOX <span id="cdpr-inbox-count">0</span></button>
 </div>
 <div class="cdpr-register-filters">
  <label>From <input id="cdpr-filter-from" type="date"></label>
  <label>To <input id="cdpr-filter-to" type="date"></label>
  <label>Line Number <select id="cdpr-filter-line"><option value="">All lines</option></select></label>
  <label class="cdpr-filter-code">Product Code <input id="cdpr-filter-code" type="search" placeholder="Search a product code"></label>
  <button id="cdpr-apply-filter" class="cdpr-btn cdpr-btn-primary" type="button">APPLY FILTERS</button>
 </div>
 <div class="cdpr-register-table-wrap"><table class="cdpr-register-table">
  <thead><tr><th>Coding Date</th><th>Line</th><th>Lots</th><th>Source Total · Slots 1–6</th><th>Batch 7</th><th>Review Status</th><th>Version</th><th>Actions</th></tr></thead>
  <tbody id="cdpr-records-body"><tr><td colspan="26">Open this section to load saved records.</td></tr></tbody>
 </table></div>
 <div class="cdpr-register-foot"><span id="cdpr-record-count">0 records</span><div><button id="cdpr-prev" class="cdpr-btn cdpr-btn-light" type="button">PREVIOUS</button><span id="cdpr-page">Page 1</span><button id="cdpr-next" class="cdpr-btn cdpr-btn-light" type="button">NEXT</button></div></div>
 <dialog id="cdpr-edit-dialog" class="cdpr-dialog"><form method="dialog" id="cdpr-edit-form">
  <div class="cdpr-dialog-head"><div><span class="cdpr-eyebrow">VERSION-CONTROLLED UPDATE</span><h3>Edit Coding DPR Entry</h3></div><button value="cancel" class="cdpr-dialog-close" aria-label="Close">×</button></div>
  <div id="cdpr-edit-fields" class="cdpr-edit-fields"></div>
  <div class="cdpr-dialog-actions"><button value="cancel" class="cdpr-btn cdpr-btn-light">CANCEL</button><button id="cdpr-edit-save" type="button" class="cdpr-btn cdpr-btn-primary">SAVE CHANGES</button></div>
 </form></dialog>
 <dialog id="cdpr-history-dialog" class="cdpr-dialog"><form method="dialog">
  <div class="cdpr-dialog-head"><div><span class="cdpr-eyebrow">AUDITABLE CHANGE LOG</span><h3>Coding DPR Revision History</h3></div><button value="cancel" class="cdpr-dialog-close" aria-label="Close">×</button></div>
  <div id="cdpr-history-content" class="cdpr-history-content"></div>
  <div class="cdpr-dialog-actions"><button value="cancel" class="cdpr-btn cdpr-btn-primary">CLOSE</button></div>
 </form></dialog>`;
 document.querySelector(".cdpr-source-note")?.insertAdjacentElement("afterend",panel);
 const actions=document.querySelector(".cdpr-actions");
 const toggle=document.createElement("button");toggle.id="cdpr-toggle-register";toggle.type="button";toggle.className="cdpr-btn cdpr-btn-light";toggle.textContent="VIEW SAVED RECORDS";
 actions?.insertBefore(toggle,save);
 toggle.addEventListener("click",()=>{
  panel.hidden=!panel.hidden;toggle.textContent=panel.hidden?"VIEW SAVED RECORDS":"HIDE SAVED RECORDS";
  if(!panel.hidden&&!panelLoaded){panelLoaded=true;loadRecords();}
 });
 $("cdpr-refresh").addEventListener("click",loadRecords);
 $("cdpr-tab-saved").addEventListener("click",()=>setTab("saved"));
 $("cdpr-tab-inbox").addEventListener("click",()=>setTab("inbox"));
 $("cdpr-apply-filter").addEventListener("click",()=>{page=1;loadRecords();});
 ["cdpr-filter-from","cdpr-filter-to","cdpr-filter-line"].forEach(id=>$(id).addEventListener("change",()=>{page=1;loadRecords();}));
 $("cdpr-filter-code").addEventListener("keydown",e=>{if(e.key==="Enter"){page=1;loadRecords();}});
 $("cdpr-prev").addEventListener("click",()=>{if(page>1){page--;loadRecords();}});
 $("cdpr-next").addEventListener("click",()=>{if(page*pageSize<totalCount){page++;loadRecords();}});
 $("cdpr-records-body").addEventListener("click",onRecordAction);
 $("cdpr-edit-save").addEventListener("click",saveEdit);
}
function setTab(tab){
 activeTab=tab;page=1;
 $("cdpr-tab-saved").classList.toggle("active",tab==="saved");
 $("cdpr-tab-inbox").classList.toggle("active",tab==="inbox");
 loadRecords();
}
function queryParams(){
 const params=new URLSearchParams({page:String(page),page_size:String(pageSize)});
 for(const [id,key] of [["cdpr-filter-from","date_from"],["cdpr-filter-to","date_to"],["cdpr-filter-line","line_number"],["cdpr-filter-code","product_code"]]){
  const value=$(id)?.value?.trim();if(value)params.set(key,value);
 }
 if(activeTab==="inbox")params.set("review_status","needs_review");
 return params;
}
function renderRecords(records){
 const body=$("cdpr-records-body");
 if(!records.length){body.innerHTML='<tr><td colspan="26">No saved Coding DPR records match these filters.</td></tr>';return;}
 body.innerHTML=records.map((r,i)=>{
  const lots=new Map((r.lots||[]).map(l=>[Number(l.lot_number),l]));
  const values=[r.coding_date,r.line_number];
  for(let n=1;n<=7;n++){const l=lots.get(n)||{};values.push(l.production_date,l.product_code,l.quantity);}
  values.push(r.total_quantity);
  return '<tr><th class="cdpr-rownum">'+((page-1)*pageSize+i+1)+'</th>'+values.map(v=>'<td>'+esc(v??"")+'</td>').join("")+'<td><small>'+esc(r.review_status??"")+'</small><div class="cdpr-row-actions">'+(permissions.edit?'<button class="cdpr-mini-btn" data-action="edit" data-id="'+esc(r.id)+'">EDIT</button>':"")+'<button class="cdpr-mini-btn" data-action="history" data-id="'+esc(r.id)+'">HISTORY</button></div></td></tr>';
 }).join("");
}
async function loadRecords(){
 if($("cdpr-register").hidden)return;
 const body=$("cdpr-records-body");body.innerHTML='<tr><td colspan="26">Loading TFI2 records…</td></tr>';
 try{
  const result=await api("/api/coding-dpr/records?"+queryParams().toString());
  totalCount=Number(result.total_count||0);renderRecords(result.records||[]);
  $("cdpr-record-count").textContent=totalCount.toLocaleString()+" "+(activeTab==="inbox"?"records needing review":"saved records");
  $("cdpr-inbox-count").textContent=activeTab==="inbox"?String(totalCount):"";
  $("cdpr-page").textContent="Page "+page;
  $("cdpr-prev").disabled=page<=1;$("cdpr-next").disabled=page*pageSize>=totalCount;
 }catch(error){body.innerHTML='<tr><td colspan="26" class="cdpr-register-empty">'+esc(error.message)+'</td></tr>';}
}
async function saveRows(){
 if(!permissions.create){toast("Your account does not have Coding DPR create permission.");return;}
 const records=collectRows();
 if(!records.length){toast("Enter at least one Coding DPR field before saving.");return;}
 save.disabled=true;const original=save.textContent;save.textContent="SAVING…";
 try{
  const result=await api("/api/coding-dpr/records",{method:"POST",body:JSON.stringify({records})});
  toast("Saved "+(result.inserted||0)+" record(s); "+(result.duplicates||0)+" exact duplicate(s) skipped.");
  status("TFI2 save complete · "+(result.inserted||0)+" inserted · "+(result.duplicates||0)+" duplicates skipped","ok");
  if(!$("cdpr-register").hidden)loadRecords();
 }catch(error){toast(error.message);status(error.message,"warn");}
 finally{save.disabled=false;save.textContent=original;}
}
function buildEditFields(record){
 const lots=new Map((record.lots||[]).map(lot=>[Number(lot.lot_number),lot]));
 let html='<div class="cdpr-edit-parent"><label>Coding / Labelling Date<input data-edit="A" type="date" value="'+esc(record.coding_date||"")+'"></label><label>Line Number<select data-edit="B"><option value=""></option>'+(catalog.line_numbers||[]).map(line=>'<option value="'+esc(line)+'" '+(String(record.line_number||"")===String(line)?"selected":"")+'>'+esc(line)+'</option>').join("")+'</select></label></div>';
 html+='<div class="cdpr-edit-lots">';
 const dateCols=["C","F","I","L","O","R","U"],codeCols=["D","G","J","M","P","S","V"],qtyCols=["E","H","K","N","Q","T","W"];
 for(let n=1;n<=7;n++){
  const lot=lots.get(n)||{};
  html+='<fieldset class="cdpr-edit-lot"><legend>BATCH '+n+'</legend>'+
   '<label>Production Date<input data-edit="'+dateCols[n-1]+'" type="date" value="'+esc(lot.production_date||"")+'"></label>'+
   '<label>Product Code<input data-edit="'+codeCols[n-1]+'" type="text" list="cdpr-product-codes" value="'+esc(lot.product_code||"")+'" autocomplete="off"></label>'+
   '<label>Quantity (tins)<input data-edit="'+qtyCols[n-1]+'" type="number" min="0" step="any" value="'+esc(lot.quantity??"")+'"></label>'+
  '</fieldset>';
 }
 html+='</div>';$("cdpr-edit-fields").innerHTML=html;
}
async function onRecordAction(event){
 const button=event.target.closest("button[data-action]");if(!button)return;
 const id=button.dataset.id;
 if(button.dataset.action==="history"){
  $("cdpr-history-content").textContent="Loading revision history…";$("cdpr-history-dialog").showModal();
  try{
   const result=await api("/api/coding-dpr/records/"+encodeURIComponent(id)+"/revisions");
   const revisions=result.revisions||[];
   $("cdpr-history-content").innerHTML=revisions.length?revisions.map(revision=>'<article class="cdpr-history-item"><strong>Version '+esc(revision.version)+'</strong><small>'+esc(revision.changed_at||"")+' · '+esc((revision.changed_fields||[]).join(", "))+'</small><p>'+esc(revision.change_reason||"No change note supplied")+'</p><pre>'+esc(JSON.stringify({before:revision.before_data,after:revision.after_data},null,2))+'</pre></article>').join(""):'<p>No revisions yet. The original version is shown in the saved record.</p>';
  }catch(error){$("cdpr-history-content").textContent=error.message;}
  return;
 }
 if(button.dataset.action==="edit"){
  if(!permissions.edit)return;
  try{
   const result=await api("/api/coding-dpr/records/"+encodeURIComponent(id));
   editing=result.record;if(!editing){toast("Coding DPR record not found.");return;}
   buildEditFields(editing);$("cdpr-edit-dialog").showModal();
  }catch(error){toast(error.message);}
 }
}
async function saveEdit(){
 if(!editing)return;
 const changes={};$("cdpr-edit-fields").querySelectorAll("[data-edit]").forEach(el=>changes[el.dataset.edit]=el.value);
 const button=$("cdpr-edit-save");button.disabled=true;
 try{
  const result=await api("/api/coding-dpr/records/"+encodeURIComponent(editing.id),{
   method:"PATCH",body:JSON.stringify({expected_version:editing.version,changes,change_reason:"Edited from Coding DPR saved records"})
  });
  $("cdpr-edit-dialog").close();editing=null;
  toast(result.changed===false?"No changes detected.":"Coding DPR record updated to version "+result.version+".");
  await loadRecords();
 }catch(error){toast(error.message);}
 finally{button.disabled=false;}
}
  let mainLive=true;
  function installMainLiveTable(){
    const prefix="cdpr",table=$(prefix+"-table"),manual=$(prefix+"-tbody"),saved=$("cdpr-records-body");
    const panel=document.querySelector("#cdpr-register"),heading=document.querySelector("."+prefix+"-table-heading"),toolbar=document.querySelector("."+prefix+"-toolbar");
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
    open.disabled=!("cdpr"==="oee"?state.permissions.create:permissions.create);
    panel.querySelector(".cdpr-register-head").appendChild(open);
    toolbar.querySelector("."+prefix+"-actions").prepend(back);
    const legacy=$(prefix+"-toggle-register");if(legacy)legacy.style.display="none";
    function mode(live){
      mainLive=live;
      for(const el of [manual,manualHead,cols,toolbar,summary,footer])if(el)el.style.display=live?"none":"";
      for(const el of [saved,liveHead,liveCols])if(el)el.style.display=live?"":"none";
      panel.hidden=!live;panel.style.display=live?"":"none";
      table.classList.toggle("tfi-main-live-table",live);
      const tag=heading.querySelector("."+prefix+"-empty-tag");if(tag)tag.textContent=live?"LIVE RECORDS":"MANUAL ENTRY";
      if(live)loadRecords();
    }
    open.onclick=()=>mode(false);back.onclick=()=>mode(true);
    const css=document.createElement("style");css.textContent=".tfi-main-live-table td{padding:8px!important;white-space:normal}.tfi-main-live-table td:last-child{min-width:190px;white-space:nowrap}.tfi-main-live-table td:last-child button{margin:3px;padding:6px 9px}.tfi-main-live-table{width:max-content!important;min-width:100%;table-layout:fixed!important}";document.head.appendChild(css);
    mode(true);
    window.addEventListener("focus",()=>{if(mainLive)loadRecords();});
  }
async function init(){
 insertRegister();
 try{
  const result=await api("/api/coding-dpr/catalog");
  catalog=result.catalog||catalog;permissions=result.permissions||permissions;
  applyCatalog();
  save.disabled=!permissions.create;save.setAttribute("aria-disabled",String(!permissions.create));
  if(!permissions.create)save.title="Your account does not have Coding DPR create permission.";
  status("Connected to TFI2 · "+catalog.product_codes.length+" current product codes · "+catalog.line_numbers.length+" line numbers · X totals batch slots 1–6 only","ok");
  installMainLiveTable();
  document.body.dataset.codingDprBackend="connected";
  document.body.dataset.codingDprProductCodes=String(catalog.product_codes.length);
  document.body.dataset.codingDprLineNumbers=String(catalog.line_numbers.length);
  document.body.dataset.codingDprNoMock="true";
 }catch(error){
  save.disabled=true;save.setAttribute("aria-disabled","true");
  status(error.message+" · Sign in to TFI first to enable Coding DPR live data.","warn");
 }
}
save.addEventListener("click",event=>{event.preventDefault();event.stopImmediatePropagation();saveRows();},true);
init();
const style=document.createElement("style");style.textContent=`
.cdpr-live-status{margin:0 0 12px;padding:10px 14px;border-radius:8px;font-size:11px;font-weight:800;background:#fff6dd;color:#795400;border:1px solid #f2d88b}.cdpr-live-status.ok{background:#e9f7ef;color:#126338;border-color:#b7e1c5}.cdpr-live-status.warn{background:#fff3e8;color:#874a11;border-color:#f1c69d}
.cdpr-register{margin:18px 0 0;padding:17px;background:#fff;border:1px solid #d4e0d8;border-radius:11px;box-shadow:0 7px 22px #143d2910}.cdpr-register[hidden]{display:none}.cdpr-register-head{display:flex;align-items:center;justify-content:space-between;gap:15px}.cdpr-register-head h2{margin:4px 0;font-size:18px;color:#123d2b}.cdpr-register-head p{margin:0;color:#718078;font-size:10px}.cdpr-register-tabs{display:flex;gap:6px;margin:15px 0 0;border-bottom:1px solid #dce6df}.cdpr-tab{border:0;border-bottom:3px solid transparent;background:transparent;color:#64756b;padding:10px 12px;font-size:10px;font-weight:900;letter-spacing:.4px}.cdpr-tab.active{color:#086333;border-color:#0b8050}.cdpr-tab span{display:inline-block;min-width:18px;margin-left:5px;padding:2px 5px;border-radius:10px;background:#edf3ef;color:#315746}.cdpr-register-filters{display:flex;flex-wrap:wrap;align-items:end;gap:9px;margin:14px 0;padding:11px;background:#f5f8f6;border-radius:8px}.cdpr-register-filters label,.cdpr-edit-parent label,.cdpr-edit-lot label{display:flex;flex-direction:column;gap:5px;font-size:9px;font-weight:850;color:#4c5c52}.cdpr-register-filters input,.cdpr-register-filters select,.cdpr-edit-parent input,.cdpr-edit-parent select,.cdpr-edit-lot input{min-height:33px;border:1px solid #cad8ce;border-radius:6px;padding:6px 8px;background:#fff;min-width:115px;font:inherit;color:#183128}.cdpr-register-filters .cdpr-filter-code{flex:1;min-width:180px}.cdpr-register-table-wrap{overflow:auto}.cdpr-register-table{width:100%;border-collapse:collapse;white-space:nowrap;font-size:10px}.cdpr-register-table th{background:#0b3c45;color:#fff;text-align:left;padding:10px 9px}.cdpr-register-table td{padding:9px;border-bottom:1px solid #e5ece7;vertical-align:middle}.cdpr-register-table tbody tr:hover{background:#f4faf6}.cdpr-register-empty{text-align:center;padding:22px!important;color:#718078}.cdpr-register-foot{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:12px;color:#64756b;font-size:10px}.cdpr-register-foot>div{display:flex;align-items:center;gap:9px}.cdpr-status-pill{display:inline-block;padding:4px 6px;border-radius:5px;font-size:8px;font-weight:900;background:#eef3ef;color:#52675b}.cdpr-status-pill.needs-review{background:#fff0dd;color:#8a4b0c}.cdpr-reasons{display:block;max-width:230px;white-space:normal;color:#8a4b0c;font-size:8px;margin-top:3px}.cdpr-row-actions{display:flex;gap:5px}.cdpr-mini-btn{border:1px solid #cbd9d0;background:#fff;color:#15573a;border-radius:5px;padding:5px 7px;font-size:8px;font-weight:900}.cdpr-mini-btn:hover{background:#e9f6ee}.cdpr-dialog{width:min(850px,95vw);max-height:90vh;border:0;border-radius:13px;padding:18px;box-shadow:0 20px 70px #102d1e44}.cdpr-dialog::backdrop{background:#0b2119a8}.cdpr-dialog-head{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #e3ebe5;padding-bottom:12px;margin-bottom:14px}.cdpr-dialog-head h3{margin:3px 0;font-size:18px;color:#12442f}.cdpr-dialog-close{border:0;background:#eef4ef;border-radius:50%;width:30px;height:30px;font-size:21px}.cdpr-edit-parent{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px}.cdpr-edit-parent input,.cdpr-edit-parent select{width:100%}.cdpr-edit-lots{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;max-height:58vh;overflow:auto;padding-right:4px}.cdpr-edit-lot{border:1px solid #dbe6df;border-radius:8px;padding:10px;display:grid;grid-template-columns:1fr;gap:8px;min-width:0}.cdpr-edit-lot legend{font-size:9px;font-weight:900;color:#0b7650;padding:0 5px}.cdpr-edit-lot input{width:100%;min-width:0}.cdpr-dialog-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}.cdpr-history-content{max-height:65vh;overflow:auto}.cdpr-history-item{border:1px solid #e1eae3;border-radius:8px;padding:11px;margin-bottom:9px}.cdpr-history-item small{display:block;color:#718078;margin:5px 0}.cdpr-history-item p{font-size:10px;color:#58675e}.cdpr-history-item pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f6f8f6;border-radius:6px;padding:9px;font-size:9px}.cdpr-btn:disabled{opacity:.45;cursor:not-allowed}
@media(max-width:760px){.cdpr-register{padding:11px}.cdpr-register-head{align-items:flex-start;flex-direction:column}.cdpr-register-head #cdpr-refresh{align-self:flex-end}.cdpr-register-foot{align-items:flex-start;flex-direction:column}.cdpr-edit-lots{grid-template-columns:1fr}.cdpr-edit-parent{grid-template-columns:1fr}.cdpr-register-filters{align-items:stretch}.cdpr-register-filters label,.cdpr-register-filters .cdpr-filter-code{width:100%;min-width:0}.cdpr-register-filters input,.cdpr-register-filters select{width:100%}}
`;
document.head.appendChild(style);
})();