(function(){
"use strict";
const DATA=window.TFI_HOURLY_AGRI_DATA;if(!DATA)throw new Error("Hourly Agri source snapshot is unavailable.");
const $=id=>document.getElementById(id);
const esc=v=>String(v??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const fmt=v=>v===null||v===undefined||v===""||!Number.isFinite(Number(v))?"—":Number(v).toLocaleString("en-US",{maximumFractionDigits:0});
const pct=v=>v===null||v===undefined||!Number.isFinite(Number(v))?"—":Math.round(Number(v)*100)+"%";
const products=DATA.codeMap.products,productMap=Object.fromEntries(products.map(p=>[p.code,p.name]));
const productOptions='<option value=""></option>'+products.map(p=>'<option value="'+esc(p.code)+'">'+esc(p.code+" — "+p.name)+'</option>').join("");
const filterOptions='<option value="">All product codes</option>'+products.map(p=>'<option value="'+esc(p.code)+'">'+esc(p.code+" — "+p.name)+'</option>').join("");
const records=DATA.records.slice();let pageOffset=0,rowSeq=0,toastTimer=null;
function dateLabel(value){if(!value)return"—";const p=String(value).slice(0,10).split("-");const m=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];return p.length===3?p[2]+"-"+m[Number(p[1])-1]+"-"+p[0]:String(value);}
function timeSlot(hour){if(hour===null||hour===undefined||hour==="")return"—";const h=Number(hour);return String(h).padStart(2,"0")+":00-"+String((h+1)%24).padStart(2,"0")+":00";}
function numberOrNull(v){if(v===null||v===undefined||String(v).trim()==="")return null;const n=Number(v);return Number.isFinite(n)?n:null;}
function toast(msg){const el=$("ha-toast");el.textContent=msg;el.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.hidden=true,3500);}
function renderSummary(){const s=DATA.summary;$("ha-sum-rows").textContent=fmt(s.record_count);$("ha-sum-samples").textContent=fmt(s.product_codes_available);$("ha-sum-operational").textContent=fmt(s.total_target_tins);$("ha-sum-codes").textContent=fmt(s.total_actual_tins);$("ha-sum-actual").textContent=fmt(s.total_variance_tins);$("ha-sum-date").textContent=pct(s.attainment);}
function filters(){return{from:$("ha-filter-from").value,to:$("ha-filter-to").value,code:$("ha-filter-code").value,search:$("ha-filter-search").value.trim().toLowerCase()};}
function filteredRows(){const f=filters();return records.filter(r=>{if(f.from&&(!r.record_date||r.record_date<f.from))return false;if(f.to&&(!r.record_date||r.record_date>f.to))return false;if(f.code&&r.product_code!==f.code)return false;if(f.search){const hay=[r.record_date,r.hour,r.product_code,r.product_name,r.remarks,r.time_slot,r.source_row].join(" ").toLowerCase();if(!hay.includes(f.search))return false;}return true;});}
let liveRowBase=0;
function renderHistory(){const filtered=filteredRows(),total=filtered.length,shown=filtered.slice(pageOffset,pageOffset+100),body=$("ha-history-rows");if(!shown.length){body.innerHTML='<tr><td colspan="14" class="ha-empty">No Hourly Agri records match the current filters.</td></tr>';}else{body.innerHTML=shown.map((r,i)=>{const cells=[dateLabel(r.record_date),r.hour===null?"—":String(r.hour).padStart(2,"0"),r.product_code||"—",fmt(r.target_tins),fmt(r.actual_tins),r.remarks||"—",r.product_name||"Unmapped",r.time_slot||"—",fmt(r.variance_tins),fmt(r.cumulative_target_tins),fmt(r.cumulative_actual_tins),pct(r.hour_attainment)];return'<tr class="ha-record-row" data-record-id="'+esc(r.id)+'"><th class="ha-rownum">'+(liveRowBase+pageOffset+i+1)+'</th>'+cells.map((v,j)=>'<td class="'+([3,4,8,9,10,11].includes(j)?"ha-number ":"")+(j===2?"ha-code-cell ":"")+(j>=6?"ha-auto-cell":"")+'">'+esc(v)+'</td>').join("")+'<td class="ha-actions-cell"><button type="button" data-hourly-action="edit" data-id="'+esc(r.id)+'">EDIT</button><button type="button" data-hourly-action="history" data-id="'+esc(r.id)+'">HISTORY</button></td></tr>';}).join("");}
const start=total?pageOffset+1:0,end=Math.min(pageOffset+shown.length,total);$("ha-history-meta").textContent="Showing "+fmt(start)+"–"+fmt(end)+" of "+fmt(total)+" records";$("ha-page-label").textContent="Page "+(Math.floor(pageOffset/100)+1);$("ha-page-prev").disabled=pageOffset===0;$("ha-page-next").disabled=pageOffset+100>=total;}
function todayLocal(){const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");}
function rowHtml(index){const hours='<option value=""></option>'+Array.from({length:24},(_,h)=>'<option value="'+h+'">'+String(h).padStart(2,"0")+' · '+timeSlot(h)+'</option>').join("");return'<tr data-row-id="'+index+'"><th class="ha-rownum">'+index+'</th>'+
'<td><input class="ha-cell" data-field="date" type="date" min="2000-01-01" value="'+todayLocal()+'" aria-label="Date row '+index+'"></td>'+
'<td><select class="ha-cell ha-select" data-field="hour" aria-label="Hour row '+index+'">'+hours+'</select></td>'+
'<td><select class="ha-cell ha-select" data-field="code" aria-label="Product code row '+index+'">'+productOptions+'</select></td>'+
'<td><input class="ha-cell" data-field="target" type="number" min="0" step="1" aria-label="Target row '+index+'"></td>'+
'<td><input class="ha-cell" data-field="actual" type="number" min="0" step="1" aria-label="Actual row '+index+'"></td>'+
'<td><input class="ha-cell ha-remarks" data-field="remarks" type="text" maxlength="400" placeholder="Optional" aria-label="Remarks row '+index+'"></td>'+
'<td class="ha-auto-cell"><span class="ha-auto" data-calc="product">—</span></td>'+
'<td class="ha-auto-cell"><span class="ha-auto center" data-calc="slot">—</span></td>'+
'<td class="ha-auto-cell"><span class="ha-auto number" data-calc="variance">—</span></td>'+
'<td class="ha-auto-cell"><span class="ha-auto number" data-calc="cumTarget">—</span></td>'+
'<td class="ha-auto-cell"><span class="ha-auto number" data-calc="cumActual">—</span></td>'+
'<td class="ha-auto-cell"><span class="ha-auto center" data-calc="attainment">—</span></td>'+
'<td><button class="ha-remove" type="button" data-remove="'+index+'" aria-label="Remove row">×</button></td></tr>';}
function payload(row){const val=k=>row.querySelector('[data-field="'+k+'"]').value;return{date:val("date"),hour:numberOrNull(val("hour")),code:val("code").trim().toUpperCase(),target:numberOrNull(val("target")),actual:numberOrNull(val("actual")),remarks:val("remarks").trim()};}
function readDraftRows(){return Array.from($("ha-draft-rows").querySelectorAll("tr")).map(row=>({row,p:payload(row)}));}
function cumulativePreview(current,entries){const matching=entries.filter(x=>x.date===current.date&&x.code===current.code&&x.hour!==null&&x.hour!==undefined&&current.hour!==null&&Number(x.hour)<=Number(current.hour));return{target:matching.reduce((s,x)=>s+(Number(x.target)||0),0),actual:matching.reduce((s,x)=>s+(Number(x.actual)||0),0)};}
function recalculateDrafts(){const rows=readDraftRows(),entries=rows.map(x=>x.p);let target=0,actual=0,variance=0,actualComplete=true;let duplicates=new Set(),duplicate=false;
rows.forEach(item=>{const p=item.p,put=(k,v)=>{item.row.querySelector('[data-calc="'+k+'"]').textContent=v;};put("product",p.code?(productMap[p.code]||"Other"):"—");put("slot",p.hour===null?"—":timeSlot(p.hour));put("variance",p.target!==null&&p.actual!==null?fmt(p.actual-p.target):"—");put("attainment",p.target>0&&p.actual!==null?pct(p.actual/p.target):"—");if(!p.date||p.hour===null||!p.code){put("cumTarget","—");put("cumActual","—");}else{const sum=cumulativePreview(p,entries);put("cumTarget",fmt(sum.target));put("cumActual",p.actual===null?"—":fmt(sum.actual));}
if(p.target!==null)target+=p.target;if(p.actual!==null)actual+=p.actual;else if(p.target!==null)actualComplete=false;if(p.target!==null&&p.actual!==null)variance+=p.actual-p.target;
if(p.date&&p.hour!==null&&p.code){const key=[p.date,p.hour,p.code].join("|");if(duplicates.has(key))duplicate=true;duplicates.add(key);}
});
$("ha-draft-count").textContent=fmt(rows.filter(x=>x.p.date||x.p.hour!==null||x.p.code||x.p.target!==null||x.p.actual!==null||x.p.remarks).length);$("ha-draft-target").textContent=fmt(target);$("ha-draft-actual").textContent=fmt(actual);$("ha-draft-variance").textContent=fmt(variance);$("ha-draft-attainment").textContent=target>0&&actualComplete?pct(actual/target):"—";
$("ha-draft-status").textContent=rows.length+" unsaved Agri row(s) · "+(duplicate?"Duplicate date/hour/product combination detected · ":"")+"cumulative preview uses only this draft · no historical or sample data included.";
}
function addDraftRow(){rowSeq++;$("ha-draft-rows").insertAdjacentHTML("beforeend",rowHtml(rowSeq));recalculateDrafts();}
function openDraft(){const panel=$("ha-draft-panel");panel.hidden=false;if(!$("ha-draft-rows").children.length)addDraftRow();panel.scrollIntoView({behavior:"smooth",block:"start"});}
function cancelDraft(){const n=$("ha-draft-rows").children.length;$("ha-draft-rows").innerHTML="";$("ha-draft-panel").hidden=true;toast(n?"Local Agri draft discarded. No source or database records were changed.":"Draft panel closed.");}
function resetFilters(){$("ha-filter-from").value="";$("ha-filter-to").value="";$("ha-filter-code").value="";$("ha-filter-search").value="";pageOffset=0;renderHistory();toast("Filters reset.");}
$("ha-apply-filters").addEventListener("click",()=>{pageOffset=0;renderHistory();});
$("ha-reset-filters").addEventListener("click",resetFilters);
$("ha-page-prev").addEventListener("click",()=>{if(window.TFI_HOURLY_BACKEND)window.TFI_HOURLY_BACKEND.loadPage("prev");else{pageOffset=Math.max(0,pageOffset-100);renderHistory();}});
$("ha-page-next").addEventListener("click",()=>{if(window.TFI_HOURLY_BACKEND)window.TFI_HOURLY_BACKEND.loadPage("next");else{pageOffset+=100;renderHistory();}});
$("ha-new").addEventListener("click",openDraft);
$("ha-add-row").addEventListener("click",addDraftRow);
$("ha-cancel-draft").addEventListener("click",cancelDraft);
$("ha-draft-rows").addEventListener("input",e=>{if(e.target.closest("tr"))recalculateDrafts();});
$("ha-draft-rows").addEventListener("change",e=>{if(e.target.closest("tr"))recalculateDrafts();});
$("ha-draft-rows").addEventListener("click",e=>{const btn=e.target.closest("[data-remove]");if(!btn)return;btn.closest("tr").remove();Array.from($("ha-draft-rows").querySelectorAll("tr")).forEach((r,i)=>r.querySelector(".ha-rownum").textContent=i+1);recalculateDrafts();});
$("ha-filter-search").addEventListener("keydown",e=>{if(e.key==="Enter"){pageOffset=0;renderHistory();}});
$("ha-filter-code").innerHTML=filterOptions;
renderSummary();renderHistory();
window.TFI_HOURLY_AGRI_UI={
  setRecords:function(rows,summary,page,totalCount,hasMore){
    records.splice(0,records.length,...(rows||[]));
    Object.assign(DATA.summary,summary||{});
    liveRowBase=(Number(page)-1)*100;pageOffset=0;renderSummary();renderHistory();
    $("ha-page-label").textContent="Page "+page;
    $("ha-page-prev").disabled=page<=1;
    $("ha-page-next").disabled=!hasMore;
    $("ha-history-meta").textContent="Showing "+(totalCount?((page-1)*100+1):0)+"?"+Math.min(page*100,totalCount)+" of "+totalCount+" records";
  }
};
document.body.dataset.tfiReady="true";document.body.dataset.tfiRecordRows=String(records.length);document.body.dataset.tfiProductCodes=String(products.length);document.body.dataset.tfiTableEmpty=String(records.length===0);
})();