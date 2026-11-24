(function(){
"use strict";
const DATA=window.TFI_HOURLY_CODING_DATA;if(!DATA)throw new Error("Hourly Coding source snapshot is unavailable.");
const $=id=>document.getElementById(id);
const esc=v=>String(v??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const fmt=v=>v===null||v===undefined||v===""||!Number.isFinite(Number(v))?"—":Number(v).toLocaleString("en-US",{maximumFractionDigits:0});
const pct=v=>v===null||v===undefined||!Number.isFinite(Number(v))?"—":Math.round(Number(v)*100)+"%";
const products=DATA.codeMap.products,productMap=Object.fromEntries(products.map(p=>[p.code,p.name]));
const productOptions='<option value=""></option>'+products.map(p=>'<option value="'+esc(p.code)+'">'+esc(p.code+" — "+p.name)+'</option>').join("");
const filterOptions='<option value="">All product codes</option>'+products.map(p=>'<option value="'+esc(p.code)+'">'+esc(p.code+" — "+p.name)+'</option>').join("");
const history=DATA.records.slice(),pageSize=100;let pageOffset=0,rowSeq=0,toastTimer=null;
function dateLabel(value){if(!value)return"—";const p=String(value).slice(0,10).split("-");const m=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];return p.length===3?p[2]+"-"+m[Number(p[1])-1]+"-"+p[0]:String(value);}
function timeSlot(hour){if(hour===null||hour===undefined||hour==="")return"—";const h=Number(hour);return String(h).padStart(2,"0")+":00-"+String((h+1)%24).padStart(2,"0")+":00";}
function numberOrNull(v){if(v===null||v===undefined||String(v).trim()==="")return null;const n=Number(v);return Number.isFinite(n)?n:null;}
function toast(msg){const el=$("hc-toast");el.textContent=msg;el.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.hidden=true,3500);}
function renderSummary(){const s=DATA.summary;$("hc-sum-rows").textContent=fmt(s.record_count);$("hc-sum-eligible").textContent=fmt(products.length);$("hc-sum-codes").textContent=fmt(s.product_codes_in_use);$("hc-sum-target").textContent=fmt(s.total_target_tins);$("hc-sum-actual").textContent=fmt(s.total_actual_tins);$("hc-sum-attainment").textContent=pct(s.attainment);$("hc-sum-dates").textContent="Awaiting records";}
function currentFilters(){return{from:$("hc-filter-from").value,to:$("hc-filter-to").value,code:$("hc-filter-code").value,search:$("hc-filter-search").value.trim().toLowerCase()};}
function filteredHistory(){const f=currentFilters();return history.filter(r=>{if(f.from&&(!r.record_date||r.record_date<f.from))return false;if(f.to&&(!r.record_date||r.record_date>f.to))return false;if(f.code&&r.product_code!==f.code)return false;if(f.search){const hay=[r.record_date,r.hour,r.product_code,r.product_name,r.remarks,r.time_slot,r.source_row].join(" ").toLowerCase();if(!hay.includes(f.search))return false;}return true;});}
let liveRowBase=0;
function renderHistory(){const filtered=filteredHistory(),total=filtered.length,shown=filtered.slice(pageOffset,pageOffset+pageSize),body=$("hc-history-rows");if(!shown.length){body.innerHTML='<tr><td colspan="14" class="hc-empty">No Hourly Coding records match the current filters.</td></tr>';}else{body.innerHTML=shown.map((r,i)=>{const cells=[dateLabel(r.record_date),r.hour===null?"—":String(r.hour).padStart(2,"0"),r.product_code||"—",fmt(r.target_tins),fmt(r.actual_tins),r.remarks||"—",r.product_name||"—",r.time_slot||"—",fmt(r.variance_tins),fmt(r.cumulative_target_tins),fmt(r.cumulative_actual_tins),pct(r.hour_attainment)];return'<tr class="hc-record-row" data-record-id="'+esc(r.id)+'"><th class="hc-rownum">'+(liveRowBase+pageOffset+i+1)+'</th>'+cells.map((v,j)=>'<td class="'+([3,4,8,9,10,11].includes(j)?"hc-number ":"")+(j===2?"hc-code-cell":"")+(j>=6?"hc-auto-cell":"")+'">'+esc(v)+'</td>').join("")+'<td class="hc-actions-cell"><button type="button" data-hourly-action="edit" data-id="'+esc(r.id)+'">EDIT</button><button type="button" data-hourly-action="history" data-id="'+esc(r.id)+'">HISTORY</button></td></tr>';}).join("");}
const start=total?pageOffset+1:0,end=Math.min(pageOffset+shown.length,total);$("hc-history-meta").textContent="Showing "+fmt(start)+"–"+fmt(end)+" of "+fmt(total)+" records";$("hc-page-label").textContent="Page "+(Math.floor(pageOffset/pageSize)+1);$("hc-page-prev").disabled=pageOffset===0;$("hc-page-next").disabled=pageOffset+pageSize>=total;}
function todayLocal(){const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");}
function rowHtml(index){const hours='<option value=""></option>'+Array.from({length:24},(_,h)=>'<option value="'+h+'">'+String(h).padStart(2,"0")+' · '+timeSlot(h)+'</option>').join("");return'<tr data-row-id="'+index+'"><th class="hc-rownum">'+index+'</th>'+
'<td><input class="hc-cell" data-field="date" type="date" min="2000-01-01" value="'+todayLocal()+'" aria-label="Date row '+index+'"></td>'+
'<td><select class="hc-cell hc-select" data-field="hour" aria-label="Hour row '+index+'">'+hours+'</select></td>'+
'<td><select class="hc-cell hc-select" data-field="code" aria-label="Product code row '+index+'">'+productOptions+'</select></td>'+
'<td><input class="hc-cell" data-field="target" type="number" min="0" step="1" aria-label="Target row '+index+'"></td>'+
'<td><input class="hc-cell" data-field="actual" type="number" min="0" step="1" aria-label="Actual row '+index+'"></td>'+
'<td><input class="hc-cell hc-remarks" data-field="remarks" type="text" maxlength="400" placeholder="Optional" aria-label="Remarks row '+index+'"></td>'+
'<td class="hc-auto-cell"><span class="hc-auto" data-calc="product">—</span></td>'+
'<td class="hc-auto-cell"><span class="hc-auto center" data-calc="slot">—</span></td>'+
'<td class="hc-auto-cell"><span class="hc-auto number" data-calc="variance">—</span></td>'+
'<td class="hc-auto-cell"><span class="hc-auto number" data-calc="cumTarget">—</span></td>'+
'<td class="hc-auto-cell"><span class="hc-auto number" data-calc="cumActual">—</span></td>'+
'<td class="hc-auto-cell"><span class="hc-auto center" data-calc="attainment">—</span></td>'+
'<td><button class="hc-remove" type="button" data-remove="'+index+'" aria-label="Remove row">×</button></td></tr>';}
function payload(row){const val=k=>row.querySelector('[data-field="'+k+'"]').value;return{date:val("date"),hour:numberOrNull(val("hour")),code:val("code"),target:numberOrNull(val("target")),actual:numberOrNull(val("actual")),remarks:val("remarks")};}
function readDraftRows(){return Array.from($("hc-draft-rows").querySelectorAll("tr")).map(row=>({row,p:payload(row)}));}
function cumulativeBase(p){const prior=history.filter(r=>r.record_date===p.date&&r.product_code===p.code&&r.hour!==null&&Number(r.hour)<=Number(p.hour));return{target:prior.reduce((s,r)=>s+(Number(r.target_tins)||0),0),actual:prior.reduce((s,r)=>s+(Number(r.actual_tins)||0),0)};}
function cumulativePreview(base,entries,current){const matching=entries.filter(x=>x.date===current.date&&x.code===current.code&&x.hour!==null&&x.hour!==undefined&&Number(x.hour)<=Number(current.hour));return{target:base.target+matching.reduce((s,x)=>s+(Number(x.target)||0),0),actual:base.actual+matching.reduce((s,x)=>s+(Number(x.actual)||0),0)};}
function recalculateDrafts(){const rows=readDraftRows(),entries=rows.map(x=>x.p);rows.forEach(item=>{const p=item.p,put=(k,v)=>{item.row.querySelector('[data-calc="'+k+'"]').textContent=v;};put("product",p.code?(productMap[p.code]||"Other"):"—");put("slot",p.hour===null?"—":timeSlot(p.hour));put("variance",p.target!==null&&p.actual!==null?fmt(p.actual-p.target):"—");put("attainment",p.target>0&&p.actual!==null?pct(p.actual/p.target):"—");if(!p.date||p.hour===null||!p.code){put("cumTarget","—");put("cumActual","—");}else{const base=cumulativeBase(p),sum=cumulativePreview(base,entries,p);put("cumTarget",fmt(sum.target));put("cumActual",fmt(sum.actual));}});$("hc-draft-status").textContent=rows.length+" unsaved Coding row(s) · cumulative preview uses only this draft · no historical or sample data included.";}
function addDraftRow(){rowSeq++;$("hc-draft-rows").insertAdjacentHTML("beforeend",rowHtml(rowSeq));recalculateDrafts();}
function openDraft(){const panel=$("hc-draft-panel");panel.hidden=false;if(!$("hc-draft-rows").children.length)addDraftRow();panel.scrollIntoView({behavior:"smooth",block:"start"});}
function cancelDraft(){const n=$("hc-draft-rows").children.length;$("hc-draft-rows").innerHTML="";$("hc-draft-panel").hidden=true;toast(n?"Local draft rows discarded. No historical or TFI records were changed.":"Draft panel closed.");}
function resetFilters(){["from","to","code","search"].forEach(k=>$("hc-filter-"+k).value="");pageOffset=0;renderHistory();toast("Filters reset.");}
$("hc-apply-filters").addEventListener("click",()=>{pageOffset=0;renderHistory();});
$("hc-reset-filters").addEventListener("click",resetFilters);
$("hc-page-prev").addEventListener("click",()=>{if(window.TFI_HOURLY_BACKEND)window.TFI_HOURLY_BACKEND.loadPage("prev");else{pageOffset=Math.max(0,pageOffset-pageSize);renderHistory();}});
$("hc-page-next").addEventListener("click",()=>{if(window.TFI_HOURLY_BACKEND)window.TFI_HOURLY_BACKEND.loadPage("next");else{pageOffset+=pageSize;renderHistory();}});
$("hc-new").addEventListener("click",openDraft);
$("hc-add-row").addEventListener("click",addDraftRow);
$("hc-cancel-draft").addEventListener("click",cancelDraft);
$("hc-draft-rows").addEventListener("input",e=>{if(e.target.closest("tr"))recalculateDrafts();});
$("hc-draft-rows").addEventListener("change",e=>{if(e.target.closest("tr"))recalculateDrafts();});
$("hc-draft-rows").addEventListener("click",e=>{const btn=e.target.closest("[data-remove]");if(!btn)return;btn.closest("tr").remove();Array.from($("hc-draft-rows").querySelectorAll("tr")).forEach((r,i)=>r.querySelector(".hc-rownum").textContent=i+1);recalculateDrafts();});
$("hc-filter-search").addEventListener("keydown",e=>{if(e.key==="Enter"){pageOffset=0;renderHistory();}});
$("hc-filter-code").innerHTML=filterOptions;
renderSummary();renderHistory();
window.TFI_HOURLY_CODING_UI={
  setRecords:function(rows,summary,page,totalCount,hasMore){
    history.splice(0,history.length,...(rows||[]));
    Object.assign(DATA.summary,summary||{});
    liveRowBase=(Number(page)-1)*100;pageOffset=0;renderSummary();renderHistory();
    $("hc-page-label").textContent="Page "+page;
    $("hc-page-prev").disabled=page<=1;
    $("hc-page-next").disabled=!hasMore;
    $("hc-history-meta").textContent="Showing "+(totalCount?((page-1)*pageSize+1):0)+"?"+Math.min(page*pageSize,totalCount)+" of "+totalCount+" records";
  }
};
document.body.dataset.tfiReady="true";document.body.dataset.tfiHistoryRows=String(history.length);document.body.dataset.tfiProductCodes=String(products.length);document.body.dataset.tfiHistoryReadOnly="true";document.body.dataset.tfiTableEmpty=String(history.length===0);
})();