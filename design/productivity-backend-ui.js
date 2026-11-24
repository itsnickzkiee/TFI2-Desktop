(function(){
"use strict";
const $=id=>document.getElementById(id);
const tbody=$("pr-tbody"), save=$("pr-save");
if(!tbody||!save)return;
let catalog={products:[],lines:[]}, permissions={view:false,create:false,edit:false};
let page=1,pageSize=25,totalCount=0,previewTimers=new WeakMap();
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt=v=>v===null||v===undefined||v===""?"":Number(v).toLocaleString("en-US",{maximumFractionDigits:2});
const pct=v=>v===null||v===undefined||v===""?"":(Number(v)*100).toFixed(2)+"%";
const toast=m=>{const el=$("pr-toast");if(el){el.textContent=m;el.hidden=false;setTimeout(()=>el.hidden=true,4500);}};
async function api(url,options={}){
 const response=await fetch(url,{credentials:"same-origin",...options,headers:{"Content-Type":"application/json",...(options.headers||{})}});
 let body={};try{body=await response.json();}catch(_){}
 if(!response.ok)throw new Error(body.error||body.message||("Request failed ("+response.status+")"));
 return body;
}
function status(message,kind="info"){
 let el=$("pr-live-status");
 if(!el){el=document.createElement("div");el.id="pr-live-status";el.className="pr-live-status";const banner=document.querySelector(".pr-toolbar");banner?.insertAdjacentElement("afterend",el);}
 el.className="pr-live-status "+kind;el.textContent=message;
}
function optionsFor(select,items,valueKey,labelFn){
 const current=select.value;
 select.innerHTML='<option value=""></option>'+items.map(item=>'<option value="'+esc(item[valueKey])+'">'+esc(labelFn(item))+'</option>').join("");
 if(items.some(x=>String(x[valueKey])===current))select.value=current;
}
function applyCatalog(){
 const products=catalog.products||[],lines=catalog.lines||[];
 tbody.querySelectorAll(".pr-code").forEach(s=>optionsFor(s,products,"code",p=>p.code+" — "+(p.name||"Other")));
 tbody.querySelectorAll('select[data-col="C"]').forEach(s=>optionsFor(s,lines.map(line=>({line} )),"line",x=>x.line));
}
function dataForRow(tr){
 const keys={A:"production_date",B:"product_code",C:"line",D:"planned_run_hours",E:"actual_output_tins",F:"dented",G:"false_seam",H:"flipper",I:"bulged",J:"panel",K:"buckling"};
 const data={};for(const [col,key] of Object.entries(keys))data[key]=tr.querySelector('[data-col="'+col+'"]')?.value??"";
 return data;
}
function setCell(tr,col,value,isPercent=false){
 const el=tr.querySelector('[data-col="'+col+'"]');if(!el)return;
 if(value===null||value===undefined||value===""){el.value="";return;}
 el.value=isPercent?pct(value):(el.type==="number"?String(value):fmt(value));
}
function updateSummary(){
 const rows=[...tbody.querySelectorAll("tr")],filled=rows.map(dataForRow).filter(d=>Object.values(d).some(v=>String(v??"").trim()!==""));
 const sum=(field)=>filled.reduce((a,d)=>a+(Number(d[field])||0),0);
 $("pr-filled-rows").textContent=String(filled.length);
 $("pr-total-output").textContent=fmt(sum("actual_output_tins"));
 $("pr-total-rejects").textContent=fmt(filled.reduce((a,d)=>a+["dented","false_seam","flipper","bulged","panel","buckling"].reduce((s,k)=>s+(Number(d[k])||0),0),0));
 $("pr-total-manpower").textContent=fmt(rows.reduce((a,tr)=>a+(Number(tr.querySelector('[data-col="M"]')?.value)||0),0));
}
async function previewRow(tr){
 const data=dataForRow(tr);
 if(!data.production_date||!data.product_code){
  ["L","M","N","O","P","Q","R","S","T","U","V"].forEach(c=>{const el=tr.querySelector('[data-col="'+c+'"]');if(el)el.value="";});
  updateSummary();return;
 }
 try{
  const result=await api("/api/productivity/preview",{method:"POST",body:JSON.stringify({record_data:data})});
  const c=result.calculated||{};
  setCell(tr,"L",c.total_fg_rejects);setCell(tr,"M",c.manpower_hours_dmp);
  setCell(tr,"N",c.target_output_12h_tins);setCell(tr,"O",c.standard_productivity_tins_per_mhr);
  setCell(tr,"P",c.standard_output_actual_mhr);setCell(tr,"Q",c.productivity_tins_per_mhr);
  setCell(tr,"R",c.output_attainment,true);setCell(tr,"S",c.reject_rate,true);
  setCell(tr,"T",c.iso_week);setCell(tr,"U",c.month_number);
  const nameCell=tr.querySelector('[data-col="V"]');if(nameCell)nameCell.value=c.product_name??"";
 }catch(error){
  // Avoid noisy alerts while a user is typing; the next field change retries the preview.
 }
 updateSummary();
}
function queuePreview(tr){
 const old=previewTimers.get(tr);if(old)clearTimeout(old);
 const timer=setTimeout(()=>previewRow(tr),280);previewTimers.set(tr,timer);
}
function recordRows(){
 return [...tbody.querySelectorAll("tr")].map((tr,i)=>({row_index:i+1,record_data:dataForRow(tr)}))
  .filter(x=>Object.values(x.record_data).some(v=>String(v??"").trim()!==""));
}
function insertSavedSection(){
 if($("pr-saved-records"))return;
 const section=document.createElement("section");section.id="pr-saved-records";section.className="pr-saved";
 section.innerHTML=`
 <div class="pr-saved-head"><div><span class="pr-eyebrow">TFI2 LIVE DATABASE</span><h2>Saved Productivity Records</h2><p>Actual saved entries, source-linked calculations, and revision history.</p></div><button id="pr-refresh-records" class="pr-btn pr-btn-light" type="button">REFRESH</button></div>
 <div class="pr-saved-filters">
  <label>From <input id="pr-saved-from" type="date"></label><label>To <input id="pr-saved-to" type="date"></label>
  <label>Line <select id="pr-saved-line"><option value="">All lines</option></select></label>
  <label>Product Code <select id="pr-saved-code"><option value="">All products</option></select></label>
  <label class="pr-search">Search <input id="pr-saved-search" type="search" placeholder="Code, product name or line"></label>
  <button id="pr-apply-filters" class="pr-btn pr-btn-primary" type="button">APPLY</button>
 </div>
 <div class="pr-saved-table-wrap"><table class="pr-saved-table"><thead><tr><th>Date</th><th>Product Code</th><th>Product Name</th><th>Line</th><th>Actual Output</th><th>FG Rejects</th><th>MHR</th><th>Target 12H</th><th>Productivity</th><th>Attainment</th><th>Version</th><th>Actions</th></tr></thead><tbody id="pr-saved-body"><tr><td colspan="24">Loading saved records…</td></tr></tbody></table></div>
 <div class="pr-saved-foot"><span id="pr-saved-count">0 records</span><div><button id="pr-prev-page" class="pr-btn pr-btn-light" type="button">PREVIOUS</button><span id="pr-page-label">Page 1</span><button id="pr-next-page" class="pr-btn pr-btn-light" type="button">NEXT</button></div></div>
 <dialog id="pr-edit-dialog" class="pr-dialog"><form method="dialog" id="pr-edit-form"><div class="pr-dialog-head"><div><span class="pr-eyebrow">VERSION-CONTROLLED UPDATE</span><h3>Edit Productivity Record</h3></div><button value="cancel" class="pr-dialog-close" aria-label="Close">×</button></div><div id="pr-edit-fields" class="pr-edit-grid"></div><div class="pr-dialog-actions"><button value="cancel" class="pr-btn pr-btn-light">CANCEL</button><button id="pr-edit-save" type="button" class="pr-btn pr-btn-primary">SAVE CHANGES</button></div></form></dialog>
 <dialog id="pr-history-dialog" class="pr-dialog"><form method="dialog"><div class="pr-dialog-head"><div><span class="pr-eyebrow">AUDITABLE CHANGE LOG</span><h3>Revision History</h3></div><button value="cancel" class="pr-dialog-close" aria-label="Close">×</button></div><div id="pr-history-content" class="pr-history-content"></div><div class="pr-dialog-actions"><button value="cancel" class="pr-btn pr-btn-primary">CLOSE</button></div></form></dialog>`;
 document.querySelector(".pr-table-footer")?.insertAdjacentElement("afterend",section);
 const line=$("pr-saved-line"),code=$("pr-saved-code");
 line.innerHTML+=[...catalog.lines].map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join("");
 code.innerHTML+=[...catalog.products].map(x=>'<option value="'+esc(x.code)+'">'+esc(x.code)+'</option>').join("");
 $("pr-refresh-records").addEventListener("click",()=>loadRecords());
 $("pr-apply-filters").addEventListener("click",()=>{page=1;loadRecords();});
 ["pr-saved-from","pr-saved-to","pr-saved-line","pr-saved-code"].forEach(id=>$(id).addEventListener("change",()=>{page=1;loadRecords();}));
 $("pr-saved-search").addEventListener("keydown",e=>{if(e.key==="Enter"){page=1;loadRecords();}});
 $("pr-prev-page").addEventListener("click",()=>{if(page>1){page--;loadRecords();}});
 $("pr-next-page").addEventListener("click",()=>{if(page*pageSize<totalCount){page++;loadRecords();}});
 $("pr-saved-body").addEventListener("click",onSavedAction);
 $("pr-edit-save").addEventListener("click",async()=>{
  if(!editing)return;
  const changes={};$("pr-edit-fields").querySelectorAll("[data-edit]").forEach(el=>changes[el.dataset.edit]=el.value);
  try{
   const result=await api("/api/productivity/records/"+encodeURIComponent(editing.id),{method:"PATCH",body:JSON.stringify({expected_version:editing.version,changes,change_reason:"Edited from Productivity saved records"})});
   $("pr-edit-dialog").close();toast(result.changed?"Productivity record updated.":"No changes detected.");editing=null;loadRecords();
  }catch(error){toast(error.message);}
 });
}
function renderSaved(records){
 const body=$("pr-saved-body");
 const keys=["production_date","product_code","line","planned_run_hours","actual_output_tins","dented","false_seam","flipper","bulged","panel","buckling","total_fg_rejects","manpower_hours_dmp","target_output_12h_tins","standard_productivity_tins_per_mhr","standard_output_actual_mhr","productivity_tins_per_mhr","output_attainment","reject_rate","iso_week","month_number","product_name"];
 if(!records.length){body.innerHTML='<tr><td colspan="24">No saved Productivity records found.</td></tr>';return;}
 body.innerHTML=records.map((r,i)=>'<tr><th class="pr-rownum">'+((page-1)*pageSize+i+1)+'</th>'+keys.map(k=>'<td>'+esc(r[k]==null?"":(["output_attainment","reject_rate"].includes(k)?pct(r[k]):r[k]))+'</td>').join("")+'<td><div class="pr-row-actions">'+(permissions.edit?'<button data-action="edit" data-id="'+esc(r.id)+'" class="pr-mini-btn">EDIT</button>':"")+'<button data-action="history" data-id="'+esc(r.id)+'" class="pr-mini-btn">HISTORY</button></div></td></tr>').join("");
}
async function loadRecords(){
 const params=new URLSearchParams({page:String(page),page_size:String(pageSize)});
 for(const [id,key] of [["pr-saved-from","date_from"],["pr-saved-to","date_to"],["pr-saved-line","line"],["pr-saved-code","product_code"],["pr-saved-search","search"]]){const v=$(id)?.value?.trim();if(v)params.set(key,v);}
 try{
  const data=await api("/api/productivity/records?"+params.toString());totalCount=Number(data.total_count||0);renderSaved(data.records||[]);
  $("pr-saved-count").textContent=totalCount.toLocaleString()+" saved records";
  $("pr-page-label").textContent="Page "+page;
  $("pr-prev-page").disabled=page<=1;$("pr-next-page").disabled=page*pageSize>=totalCount;
 }catch(error){$("pr-saved-body").innerHTML='<tr><td colspan="24" class="pr-empty">'+esc(error.message)+'</td></tr>';}
}
function editFields(record){
 const fields=[
 ["production_date","Production Date","date"],["product_code","Product Code","select"],["line","Line","line"],
 ["planned_run_hours","Planned Run Hrs","number"],["actual_output_tins","Actual Output (tins)","number"],
 ["dented","Dented","number"],["false_seam","False Seam","number"],["flipper","Flipper","number"],
 ["bulged","Bulged","number"],["panel","Panel","number"],["buckling","Buckling","number"]];
 $("pr-edit-fields").innerHTML=fields.map(([key,label,type])=>{
  let input="";
  if(type==="select")input='<select data-edit="'+key+'">'+catalog.products.map(p=>'<option value="'+esc(p.code)+'" '+(p.code===record[key]?"selected":"")+'>'+esc(p.code+" — "+p.name)+'</option>').join("")+'</select>';
  else if(type==="line")input='<select data-edit="'+key+'">'+catalog.lines.map(v=>'<option '+(v===record[key]?"selected":"")+'>'+esc(v)+'</option>').join("")+'</select>';
  else input='<input data-edit="'+key+'" type="'+type+'" value="'+esc(record[key]??"")+'" '+(type==="number"?'min="0" step="any"':"")+'>';
  return '<label>'+label+input+'</label>';
 }).join("");
}
let editing=null;
async function onSavedAction(event){
 const button=event.target.closest("button[data-action]");if(!button)return;
 const id=button.dataset.id;
 if(button.dataset.action==="history"){
  $("pr-history-content").textContent="Loading history…";$("pr-history-dialog").showModal();
  try{const result=await api("/api/productivity/records/"+encodeURIComponent(id)+"/revisions");const items=result.revisions||[];
   $("pr-history-content").innerHTML=items.length?items.map(x=>'<article class="pr-history-item"><strong>Version '+esc(x.version)+'</strong><small>'+esc(x.changed_at||"")+' · '+esc((x.changed_fields||[]).join(", "))+'</small><pre>'+esc(JSON.stringify({before:x.before_data,after:x.after_data,reason:x.change_reason},null,2))+'</pre></article>').join(""):'<p>No revisions yet.</p>';
  }catch(error){$("pr-history-content").textContent=error.message;}
  return;
 }
 if(button.dataset.action==="edit"){
  if(!permissions.edit)return;
  try{const result=await api("/api/productivity/records/"+encodeURIComponent(id));const record=result.record;
   if(!record){toast("Productivity record not found.");return;}
   editing=record;editFields(record);$("pr-edit-dialog").showModal();
  }catch(error){toast(error.message);}
 }
}
async function saveRows(){
 if(!permissions.create){toast("Your account does not have Productivity create permission.");return;}
 const records=recordRows();
 if(!records.length){toast("Enter at least one Productivity row.");return;}
 save.disabled=true;const old=save.textContent;save.textContent="SAVING…";
 try{
  const result=await api("/api/productivity/records",{method:"POST",body:JSON.stringify({records})});
  toast("Saved "+(result.inserted||0)+" record(s); "+(result.duplicates||0)+" duplicate(s) skipped.");
  await loadRecords();
 }catch(error){toast(error.message);}
 finally{save.disabled=false;save.textContent=old;}
}
save.addEventListener("click",event=>{event.preventDefault();event.stopImmediatePropagation();saveRows();},true);
tbody.addEventListener("input",event=>{const tr=event.target.closest("tr");if(tr)queuePreview(tr);});
tbody.addEventListener("change",event=>{const tr=event.target.closest("tr");if(tr)queuePreview(tr);});
  let mainLive=true;
  function installMainLiveTable(){
    const prefix="pr",table=$(prefix+"-table"),manual=$(prefix+"-tbody"),saved=$("pr-saved-body");
    const panel=document.querySelector("#pr-saved-records"),heading=document.querySelector("."+prefix+"-table-heading"),toolbar=document.querySelector("."+prefix+"-toolbar");
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
    open.disabled=!("pr"==="oee"?state.permissions.create:permissions.create);
    panel.querySelector(".pr-saved-head").appendChild(open);
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
 try{
  const result=await api("/api/productivity/catalog");catalog=result.catalog||catalog;permissions=result.permissions||permissions;
  applyCatalog();
  status("Connected to TFI2 · "+catalog.products.length+" live product codes · source formulas active","ok");
  save.disabled=!permissions.create;save.setAttribute("aria-disabled",String(!permissions.create));
  if(permissions.create)save.textContent="SAVE PRODUCTIVITY";
  insertSavedSection();installMainLiveTable();
  tbody.querySelectorAll("tr").forEach(queuePreview);
 }catch(error){
  status(error.message+" · Sign in to TFI first to enable live Productivity data.","warn");
  save.disabled=true;save.setAttribute("aria-disabled","true");
 }
}
const style=document.createElement("style");style.textContent=`
.pr-live-status{margin:0 0 12px;padding:10px 14px;border-radius:8px;font-size:12px;font-weight:700;background:#fff6dd;color:#795400;border:1px solid #f2d88b}.pr-live-status.ok{background:#e9f7ef;color:#126338;border-color:#b7e1c5}.pr-live-status.warn{background:#fff3e8;color:#874a11;border-color:#f1c69d}
.pr-saved{margin:22px 0;background:#fff;border:1px solid #dbe6df;border-radius:12px;padding:18px;box-shadow:0 5px 20px #143d2910}.pr-saved-head{display:flex;justify-content:space-between;align-items:center;gap:16px}.pr-saved-head h2{margin:4px 0;font-size:20px;color:#123d2b}.pr-saved-head p{margin:0;color:#6f7e75}.pr-saved-filters{display:flex;flex-wrap:wrap;gap:10px;align-items:end;margin:18px 0;padding:12px;background:#f5f8f6;border-radius:9px}.pr-saved-filters label,.pr-edit-grid label{display:flex;flex-direction:column;gap:5px;font-size:11px;font-weight:800;color:#4c5c52}.pr-saved-filters input,.pr-saved-filters select,.pr-edit-grid input,.pr-edit-grid select{min-height:34px;border:1px solid #cad8ce;border-radius:6px;padding:6px 9px;background:white;min-width:130px}.pr-saved-filters .pr-search{flex:1;min-width:190px}.pr-saved-table-wrap{overflow:auto}.pr-saved-table{width:100%;border-collapse:collapse;white-space:nowrap;font-size:11px}.pr-saved-table th{background:#0b4b3b;color:white;text-align:left;padding:10px 9px}.pr-saved-table td{padding:9px;border-bottom:1px solid #e7eee9}.pr-saved-table tbody tr:hover{background:#f6faf7}.pr-row-actions{display:flex;gap:5px}.pr-mini-btn{border:1px solid #cbd9d0;background:white;color:#15573a;border-radius:5px;padding:5px 7px;font-size:9px;font-weight:800}.pr-mini-btn:hover{background:#e9f6ee}.pr-saved-foot{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:12px;color:#637168;font-size:11px}.pr-saved-foot>div{display:flex;align-items:center;gap:10px}.pr-empty{text-align:center;padding:22px!important;color:#718078}.pr-dialog{width:min(720px,94vw);max-height:88vh;border:0;border-radius:14px;padding:20px;box-shadow:0 20px 70px #102d1e44}.pr-dialog::backdrop{background:#0b2119a8}.pr-dialog-head{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #e3ebe5;padding-bottom:12px;margin-bottom:16px}.pr-dialog-head h3{margin:3px 0;font-size:20px;color:#12442f}.pr-dialog-close{border:0;background:#eef4ef;border-radius:50%;width:32px;height:32px;font-size:22px}.pr-edit-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.pr-edit-grid input,.pr-edit-grid select{width:100%}.pr-dialog-actions{display:flex;justify-content:flex-end;gap:9px;margin-top:18px}.pr-history-content{max-height:60vh;overflow:auto}.pr-history-item{border:1px solid #e1eae3;border-radius:8px;padding:12px;margin-bottom:10px}.pr-history-item small{display:block;color:#718078;margin:5px 0}.pr-history-item pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f6f8f6;border-radius:6px;padding:10px;font-size:10px}.pr-btn:disabled{opacity:.45;cursor:not-allowed}@media(max-width:760px){.pr-saved{padding:12px}.pr-saved-head{align-items:flex-start;flex-direction:column}.pr-edit-grid{grid-template-columns:1fr}.pr-saved-foot{align-items:flex-start;flex-direction:column}}
`;document.head.appendChild(style);
init();
})();