(() => {
"use strict";
const $=id=>document.getElementById(id);
const moduleKeys={"product-entry":"product_entry","production-entry":"production_entry","production-schedule":"production_schedule","dmp-production":"dmp_production","dmr-production":"dmr_production","dmr-coding":"dmr_coding","hourly-meat":"hourly_meat","hourly-coding":"hourly_coding","hourly-agri":"hourly_agri","oee":"oee","productivity":"productivity","coding-dpr":"coding_dpr","co-qa":"co_qa","non-prod":"nonprod","pr-monitoring":"pr_monitoring"};
const moduleMeta={"product-entry":["Product Entry","545274882"],"production-entry":["Production Entry","1923467491"],"production-schedule":["Production Schedule","1538651320"],"dmp-production":["DMP - Production","1312335050"],"dmr-production":["DMR Production","2048043346"],"dmr-coding":["DMR Coding","675328096"],"hourly-meat":["Hourly Meat","428082343"],"hourly-coding":["Hourly Coding","1916766220"],"hourly-agri":["Hourly Agri","534145404"],"oee":["OEE","1750442014"],"productivity":["Productivity","1688444278"],"coding-dpr":["Coding DPR","1266086431"],"co-qa":["co QA","1359678099"],"non-prod":["NON-PROD","1381857831"],"pr-monitoring":["PR MONITORING","867256143"]};
const state={batches:[],records:[],drafts:[],selected:new Set(),filter:"all",search:"",batchId:"all",batchIndex:0,pageByBatch:new Map(),loading:false,hasMore:false};
// Only confirmed existing records and confirmed duplicates are blocked from selection.
const eligible=new Set(["ready","incomplete","held"]);
const labels={ready:"Ready for Draft",incomplete:"Incomplete · Eligible",existing:"Imported / Protected",held:"Review required · Eligible"};
const safe=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt=n=>Number(n||0).toLocaleString();
function toast(msg){let el=document.querySelector(".toast");if(!el){el=document.createElement("div");el.className="toast";document.body.appendChild(el);}el.textContent=msg;el.hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.hidden=true,3200);}
function batches(){return state.batchId==="all"?state.batches:state.batches.filter(b=>b.id===state.batchId);}
function classify(r){
 if(r.import_status==="inserted"||r.import_status==="skipped_existing"||r.duplicate_status==="exact_source_duplicate"||r.duplicate_status==="confirmed_duplicate")return "existing";
 if(r.classification!=="operational"||["helper","summary","derived","unmapped","invalid"].includes(r.classification))return "held";
 if(r.duplicate_status==="possible_duplicate")return "held";
 if(r.completeness_status==="incomplete")return "incomplete";
 if(["held","failed","excluded"].includes(r.import_status))return "held";
 if(r.import_status==="pending"&&r.completeness_status==="complete")return "ready";
 return "held";
}
function rowKey(r){const v=(r.source_values||[]).filter(x=>x!==null&&x!==undefined&&String(x).trim()!=="");return v.slice(0,4).map(x=>String(x).slice(0,55)).join(" · ")||("Source row "+r.source_row_number);}
function updateMetrics(){
 const c={ready:0,incomplete:0,existing:0,held:0};state.records.forEach(r=>c[r.status]++);
 $("metric-total").textContent=fmt(batches().reduce((n,b)=>n+Number(b.rows_staged||0),0));
 ["ready","incomplete","existing","held"].forEach((k,i)=>$("metric-"+(i===0?"ready":i===1?"incomplete":i===2?"existing":"held")).textContent=fmt(c[k]));
 const names=["Total staged records","Ready for Draft · loaded","Incomplete · eligible","Imported / protected · blocked","Review required · eligible"];
 document.querySelectorAll(".metric-label").forEach((e,i)=>{if(names[i])e.textContent=names[i];});
 const notes=["Across selected import batches","Complete new rows","Incomplete new rows remain selectable","Confirmed existing / duplicate records are locked","Review-required rows remain selectable"];
 document.querySelectorAll(".metric-note").forEach((e,i)=>{if(notes[i])e.textContent=notes[i];});
}
function filteredRecords(){
 const q=state.search.toLowerCase();
 return state.records.filter(r=>(state.filter==="all"||r.status===state.filter)&&(!q||(r.key+" "+r.sheet+" "+r.row+" "+r.batch+" "+r.reason).toLowerCase().includes(q)));
}
function updateSelection(){
 const count=state.records.filter(r=>state.selected.has(r.id)&&eligible.has(r.status)).length;
 const isDmp=$("module-select").value==="dmp-production";
 $("selected-count").textContent=count?fmt(count)+" eligible records selected":"No records selected";
 const visible=filteredRecords().filter(r=>eligible.has(r.status));
 const selectedVisible=visible.filter(r=>state.selected.has(r.id)).length;
 $("select-all").disabled=visible.length===0;
 $("select-all").checked=visible.length>0&&selectedVisible===visible.length;
 $("select-all").indeterminate=selectedVisible>0&&selectedVisible<visible.length;
 $("prepare-drafts").disabled=!isDmp||count===0;
 $("prepare-drafts").title=!isDmp?"Draft preparation is currently enabled for DMP Production only.":count?"Create Draft records from the selected source rows.":"Select eligible records to prepare Drafts.";
 $("review-drafts").hidden=!isDmp;
 const saveButton=$("save-all-dmp");
 const targetBatch=state.batchId!=="all"?state.batches.find(b=>b.id===state.batchId):(state.batches.length===1?state.batches[0]:null);
 saveButton.hidden=!isDmp;
 saveButton.disabled=!isDmp||!targetBatch||state.loading;
 saveButton.title=!isDmp?"Available only for DMP Production.":!targetBatch?"Select one source batch to save its operational rows.":"Save every eligible operational row in this batch. Incomplete rows are saved with blank fields; duplicates remain protected.";
}
function updateMore(){
 let b=$("load-more-inbox-records");
 if(!b){b=document.createElement("button");b.id="load-more-inbox-records";b.className="btn outline";b.style.cssText="display:block;margin:14px auto 0";b.type="button";b.addEventListener("click",loadNextPage);$("inbox-rows").closest(".table-card").appendChild(b);}
 b.hidden=!state.hasMore;b.disabled=state.loading;b.textContent=state.loading?"Loading records…":"Load next 200 records";
}
function render(){
 const rows=filteredRecords();
 $("inbox-rows").innerHTML=rows.length?rows.map(r=>'<tr><td><input type="checkbox" class="check row-check" data-id="'+safe(r.id)+'" '+(state.selected.has(r.id)?"checked":"")+' '+(eligible.has(r.status)?"":"disabled")+' aria-label="Select record"></td><td><span class="record-name">'+safe(r.key)+'</span><span class="record-sub">'+safe(r.detail)+'</span></td><td><span class="source-cell"><strong>'+safe(r.sheet)+'</strong><small>Row '+safe(r.row)+' · '+safe(r.source)+'</small></span></td><td>'+safe(r.batch)+'</td><td>'+safe(r.completeness)+'</td><td><span class="status '+r.status+'">'+labels[r.status]+'</span></td><td>'+safe(r.captured)+'</td><td><button class="action-link" data-view="'+safe(r.id)+'">View details</button></td></tr>').join(""):'<tr><td colspan="8"><div class="empty-state"><strong>'+(state.batches.length?"No records match this filter.":"No staged records for this module yet.")+'</strong><span>'+(state.batches.length?"Try another status, batch, or search term.":"A successful module-specific scan will appear here automatically.")+'</span></div></td></tr>';
 const total=batches().reduce((n,b)=>n+Number(b.rows_staged||0),0);
 $("visible-count").textContent=state.records.length?"Showing "+fmt(rows.length)+" filtered · "+fmt(state.records.length)+" loaded of "+fmt(total)+" staged":"No records loaded";
 $("table-foot").textContent=state.batches.length?"Live TFI2 records · "+state.batches.length+" source batch(es) · Loaded in pages of 200. Source row traceability retained.":"No import batches found for this destination.";
 document.querySelectorAll(".row-check").forEach(x=>x.addEventListener("change",()=>{if(x.checked)state.selected.add(x.dataset.id);else state.selected.delete(x.dataset.id);updateSelection();}));
 document.querySelectorAll("[data-view]").forEach(x=>x.addEventListener("click",()=>{
  const r=state.records.find(z=>z.id===x.dataset.view);if(!r)return;
  let dlg=$("inbox-record-detail-dialog");
  if(!dlg){
   dlg=document.createElement("dialog");dlg.id="inbox-record-detail-dialog";
   dlg.style.cssText="width:min(760px,92vw);max-height:85vh;overflow:auto;border:1px solid #dce5df;border-radius:14px;padding:0;box-shadow:0 18px 60px #0003";
   dlg.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center;padding:18px 22px;border-bottom:1px solid #e5ece7"><strong>Staged record details</strong><button type="button" id="close-inbox-detail" style="border:0;border-radius:8px;padding:8px 12px;cursor:pointer">Close</button></div><div id="inbox-detail-content" style="padding:20px 22px"></div>';
   document.body.appendChild(dlg);dlg.querySelector("#close-inbox-detail").addEventListener("click",()=>dlg.close());
   dlg.addEventListener("click",e=>{if(e.target===dlg)dlg.close();});
  }
  const raw= r.raw||{};
  const fields=[
   ["Destination module", $("module-select").selectedOptions[0]?.textContent||""],
   ["Source worksheet",r.sheet],["Source row",r.row],["Source locator",r.source],
   ["Import batch",r.batch],["Classification",raw.classification||"—"],
   ["Completeness",r.completeness],["Inbox status",labels[r.status]],
   ["Missing fields",(raw.missing_fields||[]).join(", ")||"None recorded"],
   ["Duplicate status",raw.duplicate_status||"—"],["Import status",raw.import_status||"—"],
   ["Review reason",r.reason],["Captured",r.captured]
  ];
  const values=raw.source_values||[];
  $("inbox-detail-content").innerHTML='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px">'+fields.map(([k,v])=>'<div style="border:1px solid #e5ece7;border-radius:9px;padding:10px"><small style="display:block;color:#718078;margin-bottom:5px">'+safe(k)+'</small><strong style="font-size:13px;overflow-wrap:anywhere">'+safe(v)+'</strong></div>').join("")+'</div><h4 style="margin:20px 0 8px">Original spreadsheet values</h4><div style="overflow:auto"><table style="width:100%;border-collapse:collapse"><tbody>'+values.map((v,i)=>'<tr><td style="padding:8px;border-bottom:1px solid #edf1ee;color:#718078;width:70px">Cell '+(i+1)+'</td><td style="padding:8px;border-bottom:1px solid #edf1ee;overflow-wrap:anywhere">'+safe(v??"")+'</td></tr>').join("")+'</tbody></table></div>';
  dlg.showModal();
 }));
 updateMetrics();updateSelection();updateMore();
}
async function api(url,options={}){const headers={"Accept":"application/json",...(options.headers||{})};if(options.body&&!headers["Content-Type"])headers["Content-Type"]="application/json";const res=await fetch(url,{credentials:"same-origin",...options,headers});const p=await res.json().catch(()=>({}));if(!res.ok)throw new Error(p.error||p.message||("TFI2 request failed ("+res.status+")."));return p;}
function populateBatchFilter(){
 const s=$("batch-filter");s.innerHTML='<option value="all">All source batches</option>';
 state.batches.forEach(b=>{const o=document.createElement("option");o.value=b.id;o.textContent=(b.batch_ref||b.id)+" · "+(b.source_name||"Workbook")+" · "+fmt(b.rows_staged)+" rows";s.appendChild(o);});
 s.disabled=!state.batches.length;s.value=state.batchId;
}
async function loadBatches(){
 const module=$("module-select").value,key=moduleKeys[module];
 state.records=[];state.selected.clear();state.batches=[];state.pageByBatch.clear();state.batchIndex=0;state.batchId="all";state.hasMore=false;
 $("batch-filter").disabled=true;$("batch-filter").innerHTML='<option>Loading source batches…</option>';
 $("table-title").textContent=($("module-select").selectedOptions[0]?.textContent||"Module")+" staged records";
 $("scope-description").textContent="Connecting to live TFI2 import staging records…";$("table-foot").textContent="Loading authorized module-scoped batches…";render();
 if(!key){$("scope-description").textContent="Select an operational module to view its staged source records.";return;}
 try{
  const p=await api("/api/import/batches?module_key="+encodeURIComponent(key)+"&limit=200");state.batches=p.batches||[];populateBatchFilter();
  const first=state.batches[0],meta=moduleMeta[module]||[];
  $("scope-description").textContent="Live staging records for "+($("module-select").selectedOptions[0]?.textContent||module)+". Only rows mapped to this destination are shown.";
  $("scope-chip").textContent=state.batches.length+" batch(es) · "+($("module-select").selectedOptions[0]?.textContent||module);
  $("source-worksheet").textContent=first?.source_sheet_title||meta[0]||"No imported worksheet yet";$("source-sheet-id").textContent=first?.source_sheet_id?String(first.source_sheet_id):(meta[1]||"—");
  if(!state.batches.length){render();toast("No import batches found for this module yet.");return;}
  await loadNextPage();
 }catch(e){$("scope-description").textContent="The live import inbox could not be loaded.";$("table-foot").textContent=e.message;$("inbox-rows").innerHTML='<tr><td colspan="8"><div class="empty-state"><strong>Unable to load live staging records</strong><span>'+safe(e.message)+'</span></div></td></tr>';toast(e.message);}
}
async function loadNextPage(){
 if(state.loading)return;const bs=batches();if(!bs.length){state.hasMore=false;updateMore();return;}
 state.loading=true;state.hasMore=true;updateMore();
 try{
  let loaded=0;
  while(state.batchIndex<bs.length&&loaded<200){
   const batch=bs[state.batchIndex],page=state.pageByBatch.get(batch.id)||1;
   const p=await api("/api/import/batches/"+encodeURIComponent(batch.id)+"/rows?page="+page+"&page_size="+Math.min(200,200-loaded));
   const rs=p.rows||[];
   rs.forEach(r=>{const values=(r.source_values||[]).filter(v=>v!==null&&v!==undefined&&String(v).trim()!=="");const id=String(r.id);
    state.records.push({id,key:rowKey(r),detail:(r.classification||"unclassified")+" · "+values.length+" populated cell(s)",sheet:batch.source_sheet_title||"Source worksheet",row:r.source_row_number,source:r.source_locator||"",batch:batch.batch_ref||batch.id,completeness:r.completeness_status==="complete"?"Complete":r.completeness_status==="incomplete"?"Incomplete":"Not assessed",status:classify(r),captured:r.created_at?new Date(r.created_at).toLocaleString():"—",reason:r.review_reason||(r.missing_fields||[]).join(", ")||r.error_message||"—",raw:r});
   });
   loaded+=rs.length;if(rs.length===0||!p.has_more){state.batchIndex++;state.pageByBatch.delete(batch.id);}else state.pageByBatch.set(batch.id,page+1);
   if(rs.length&&loaded>=200)break;
  }
  state.hasMore=state.batchIndex<bs.length;render();if(!loaded&&!state.records.length)toast("The selected module has batches but no staged source rows.");
 }catch(e){toast(e.message||"Unable to load the next page of staged rows.");state.hasMore=true;}
 finally{state.loading=false;updateMore();updateSelection();}
}
function ensureDraftDialog(){
 let dlg=$("dmp-import-drafts-dialog");
 if(!dlg){
  dlg=document.createElement("dialog");dlg.id="dmp-import-drafts-dialog";
  dlg.style.cssText="width:min(1120px,94vw);max-height:88vh;overflow:auto;border:1px solid #dce5df;border-radius:14px;padding:0;box-shadow:0 18px 60px #0003";
  dlg.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;padding:18px 22px;border-bottom:1px solid #e5ece7;position:sticky;top:0;background:white;z-index:2"><div><strong>DMP Production Import Drafts</strong><div style="font-size:12px;color:#718078;margin-top:4px">Edit incomplete values, confirm row mapping, then approve to save into DMP Production</div></div><button type="button" class="btn outline" id="dmp-drafts-close">Close</button></div><div id="dmp-drafts-content" style="padding:18px 22px"></div>';
  document.body.appendChild(dlg);
  dlg.querySelector("#dmp-drafts-close").addEventListener("click",()=>dlg.close());
  dlg.addEventListener("click",e=>{if(e.target===dlg)dlg.close();});
 }
 return dlg;
}
function draftInputValue(key,value){
 if(value===null||value===undefined)return "";
 if(key==="production_date"&&typeof value==="number"){
  return new Date(Date.UTC(1899,11,30)+Math.round(value)*86400000).toISOString().slice(0,10);
 }
 if((key==="start_time"||key==="end_time")&&typeof value==="number"&&value>=0&&value<1){
  const mins=Math.round(value*1440);return String(Math.floor(mins/60)%24).padStart(2,"0")+":"+String(mins%60).padStart(2,"0");
 }
 if((key==="start_time"||key==="end_time")&&typeof value==="string"){
  const m=value.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i);
  if(m){let h=Number(m[1])%12+(m[3].toUpperCase()==="PM"?12:0);return String(h).padStart(2,"0")+":"+m[2];}
 }
 return String(value);
}
function renderDraftList(){
 const dlg=ensureDraftDialog(),content=dlg.querySelector("#dmp-drafts-content"),drafts=state.drafts||[];
 if(!drafts.length){content.innerHTML='<div class="empty-state"><strong>No DMP drafts found.</strong><span>Select eligible rows in the Import Inbox and choose Prepare selected Drafts.</span></div>';return;}
 content.innerHTML='<div style="display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:12px"><strong>'+fmt(drafts.length)+' draft records loaded</strong><span style="font-size:12px;color:#718078">Original source rows remain traceable</span></div><div style="overflow:auto"><table style="width:100%;border-collapse:collapse;min-width:850px"><thead><tr style="text-align:left;background:#f5f8f6"><th style="padding:10px">Source row</th><th style="padding:10px">Batch</th><th style="padding:10px">Classification</th><th style="padding:10px">Completeness</th><th style="padding:10px">Draft status</th><th style="padding:10px">Missing fields / issue</th><th style="padding:10px">Action</th></tr></thead><tbody>'+drafts.map(d=>{
  const locked=["committed","duplicate","rejected"].includes(d.status);
  const canApprove=d.classification==="operational"&&!locked;
  return '<tr style="border-top:1px solid #e5ece7"><td style="padding:10px">Row '+safe(d.source_row_number)+'</td><td style="padding:10px">'+safe(d.batch_ref||d.batch_id)+'</td><td style="padding:10px">'+safe(d.classification)+'</td><td style="padding:10px">'+safe(d.completeness_status)+'</td><td style="padding:10px"><strong>'+safe(d.status.replace(/_/g," "))+'</strong></td><td style="padding:10px;max-width:260px;white-space:normal">'+safe((d.missing_fields||[]).join(", ")||d.review_reason||"—")+'</td><td style="padding:10px;white-space:nowrap"><button type="button" class="btn outline" data-edit-draft="'+safe(d.id)+'" '+(locked?"disabled":"")+'>Edit</button> <button type="button" class="btn primary" data-approve-draft="'+safe(d.id)+'" '+(!canApprove?"disabled":"")+'>Approve & Save</button></td></tr>';
 }).join("")+'</tbody></table></div><p style="font-size:12px;color:#718078;margin-top:12px">Incomplete operational drafts may be approved into DMP Production with blank fields recorded. Rows not yet mapped as operational must be corrected before approval.</p>';
 content.querySelectorAll("[data-edit-draft]").forEach(b=>b.addEventListener("click",()=>openDraftEditor(state.drafts.find(d=>d.id===b.dataset.editDraft))));
 content.querySelectorAll("[data-approve-draft]").forEach(b=>b.addEventListener("click",()=>approveDraft(state.drafts.find(d=>d.id===b.dataset.approveDraft))));
}
async function loadAndShowDrafts(){
 try{
  const p=await api("/api/dmp-production/import-drafts?limit=200");
  state.drafts=p.drafts||[];renderDraftList();ensureDraftDialog().showModal();
 }catch(e){toast(e.message||"Unable to load DMP drafts.");}
}
function openDraftEditor(d){
 if(!d)return;
 let dlg=$("dmp-draft-editor");
 if(dlg)dlg.remove();
 dlg=document.createElement("dialog");dlg.id="dmp-draft-editor";
 dlg.style.cssText="width:min(760px,94vw);max-height:90vh;overflow:auto;border:1px solid #dce5df;border-radius:14px;padding:0;box-shadow:0 18px 60px #0003";
 const fields=[
  ["production_date","Production date","date"],["product_code","Product code","text"],["process","Process","text"],
  ["worker_name","Worker name","text"],["worker_count","Worker count","number"],["start_time","Start time","text"],
  ["end_time","End time","text"],["total_time_hours","Total time (hours)","number"]
 ];
 const inputs=fields.map(([key,label,type])=>'<label style="display:block;font-size:12px;font-weight:700;color:#53635a">'+label+'<input name="'+key+'" type="'+type+'" '+(type==="number"?'step="any" min="0"':'')+' value="'+safe(draftInputValue(key,(d.draft_values||{})[key]))+'" style="display:block;width:100%;box-sizing:border-box;margin-top:5px;padding:10px;border:1px solid #dce5df;border-radius:8px;font-size:14px"></label>').join("");
 dlg.innerHTML='<form id="dmp-draft-edit-form"><div style="display:flex;justify-content:space-between;align-items:center;padding:18px 22px;border-bottom:1px solid #e5ece7"><strong>Edit DMP Draft · Source row '+safe(d.source_row_number)+'</strong><button type="button" class="btn outline" id="dmp-edit-close">Close</button></div><div style="padding:20px 22px"><p style="font-size:12px;color:#718078;margin-top:0">Original source row: '+safe(d.source_locator)+' · '+safe(d.batch_ref||"")+'</p><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px">'+inputs+'</div><label style="display:block;margin-top:14px;font-size:12px;font-weight:700;color:#53635a">Row classification<select name="classification" style="display:block;width:100%;padding:10px;margin-top:5px;border:1px solid #dce5df;border-radius:8px"><option value="operational" '+(d.classification==="operational"?"selected":"")+'>Operational DMP record</option><option value="invalid" '+(d.classification==="invalid"?"selected":"")+'>Invalid / needs correction</option><option value="unmapped" '+(d.classification==="unmapped"?"selected":"")+'>Unmapped</option><option value="helper" '+(d.classification==="helper"?"selected":"")+'>Helper row</option><option value="summary" '+(d.classification==="summary"?"selected":"")+'>Summary row</option><option value="derived" '+(d.classification==="derived"?"selected":"")+'>Derived row</option></select></label><div style="display:flex;justify-content:flex-end;gap:8px;margin-top:20px"><button type="button" class="btn outline" id="dmp-edit-cancel">Cancel</button><button type="submit" class="btn primary">Save Draft</button></div></div></form>';
 document.body.appendChild(dlg);
 const close=()=>dlg.close();
 dlg.querySelector("#dmp-edit-close").addEventListener("click",close);
 dlg.querySelector("#dmp-edit-cancel").addEventListener("click",close);
 dlg.querySelector("form").addEventListener("submit",async e=>{
  e.preventDefault();const fd=new FormData(e.currentTarget),values={};
  fields.forEach(([key,,type])=>{const v=String(fd.get(key)||"").trim();values[key]=v===""?null:type==="number"?Number(v):v;});
  const classification=String(fd.get("classification")||d.classification);
  try{
   await api("/api/dmp-production/import-drafts/"+encodeURIComponent(d.id),{method:"PATCH",body:JSON.stringify({expected_version:d.version,values,classification})});
   close();toast("Draft updated. Review missing fields before approval.");await loadDraftsIntoOpenDialog();
  }catch(err){toast(err.message||"Unable to save the DMP draft.");}
 });
 dlg.showModal();
}
async function loadDraftsIntoOpenDialog(){
 const p=await api("/api/dmp-production/import-drafts?limit=200");
 state.drafts=p.drafts||[];renderDraftList();
}
async function approveDraft(d){
 if(!d)return;
 if(!window.confirm("Approve this DMP draft and save it to the operational DMP Production module?"))return;
 try{
  const p=await api("/api/dmp-production/import-drafts/"+encodeURIComponent(d.id)+"/approve",{method:"POST",body:JSON.stringify({expected_version:d.version})});
  if(p.committed)toast(p.completeness_status==="incomplete"?"Saved to DMP Production as an incomplete record.":"Approved and saved to DMP Production.");
  else toast(p.reason||"This draft still needs review.");
  await loadDraftsIntoOpenDialog();
  if(p.committed)await loadBatches();
 }catch(e){toast(e.message||"Unable to approve the DMP draft.");}
}
async function saveAllDmpOperationalRows(){
 if($("module-select").value!=="dmp-production"){toast("This action is available only for DMP Production.");return;}
 const batch=state.batchId!=="all"?state.batches.find(b=>b.id===state.batchId):(state.batches.length===1?state.batches[0]:null);
 if(!batch){toast("Choose one source batch first.");return;}
 const confirmed=window.confirm("Save ALL eligible operational rows from "+(batch.batch_ref||"this batch")+" directly into the DMP Production records table? Complete and incomplete rows will be saved. Confirmed duplicates and existing records will be skipped. Invalid / non-operational rows will remain in review.");
 if(!confirmed)return;
 const button=$("save-all-dmp");
 const newTab=window.open("about:blank","_blank");
 button.disabled=true;button.textContent="Saving records…";
 try{
  const p=await api("/api/dmp-production/import-batches/"+encodeURIComponent(batch.id)+"/save-all",{method:"POST",body:JSON.stringify({})});
  toast(fmt(p.rows_inserted)+" DMP records saved · "+fmt(p.rows_incomplete)+" incomplete · "+fmt(p.rows_duplicates)+" duplicates protected · "+fmt(p.rows_held)+" held for review");
  state.selected.clear();
  await loadBatches();
  if(newTab&&!newTab.closed)newTab.location.href="/design/dashboard-preview.html?sidebar=collapsed&module=DMP+Production";
 }catch(err){
  if(newTab&&!newTab.closed)newTab.close();
  toast(err.message||"Unable to save the DMP import batch.");
 }finally{
  button.textContent="Save all to DMP Production";
  updateSelection();
 }
}
async function prepareSelectedDrafts(e){
 e.preventDefault();
 if($("module-select").value!=="dmp-production"){toast("Draft preparation is currently available for DMP Production only.");return;}
 const row_ids=state.records.filter(r=>state.selected.has(r.id)&&eligible.has(r.status)).map(r=>r.id);
 if(!row_ids.length){toast("Select at least one eligible source row.");return;}
 if(row_ids.length>1000){toast("Prepare no more than 1,000 selected rows at a time.");return;}
 const button=$("prepare-drafts");button.disabled=true;button.textContent="Preparing Drafts…";
 try{
  const p=await api("/api/dmp-production/import-drafts/prepare",{method:"POST",body:JSON.stringify({row_ids})});
  state.selected.clear();render();
  toast(fmt(p.prepared)+" Drafts prepared · "+fmt(p.already_prepared)+" already prepared · "+fmt(p.blocked_existing_or_duplicate)+" protected");
  await loadAndShowDrafts();
 }catch(err){toast(err.message||"Unable to prepare selected DMP drafts.");}
 finally{button.textContent="Prepare selected Drafts →";updateSelection();}
}

$("module-select").addEventListener("change",loadBatches);
$("batch-filter").addEventListener("change",async e=>{state.batchId=e.target.value;state.records=[];state.selected.clear();state.batchIndex=0;state.pageByBatch.clear();state.hasMore=false;await loadNextPage();});
document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>{state.filter=b.dataset.filter;state.selected.clear();document.querySelectorAll(".tab").forEach(x=>{const active=x===b;x.classList.toggle("active",active);x.setAttribute("aria-selected",String(active));});render();}));
$("record-search").addEventListener("input",e=>{state.search=e.target.value;render();});
$("global-search").addEventListener("input",e=>{state.search=e.target.value;$("record-search").value=e.target.value;render();});
$("select-all").addEventListener("change",e=>{filteredRecords().filter(r=>eligible.has(r.status)).forEach(r=>e.target.checked?state.selected.add(r.id):state.selected.delete(r.id));render();});
$("clear-selection").addEventListener("click",()=>{state.selected.clear();render();});
$("prepare-drafts").addEventListener("click",prepareSelectedDrafts);
$("review-drafts").addEventListener("click",loadAndShowDrafts);
$("save-all-dmp").addEventListener("click",saveAllDmpOperationalRows);
if($("module-select").value)loadBatches();
})();