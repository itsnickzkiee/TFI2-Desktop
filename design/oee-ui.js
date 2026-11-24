(function(){
"use strict";
const DATA=window.TFI_OEE_DATA;if(!DATA)throw new Error("OEE source lists were not loaded.");
const $=id=>document.getElementById(id);let rowCount=12;
const esc=v=>String(v??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const fmtInt=v=>Number(v||0).toLocaleString("en-US",{maximumFractionDigits:0});
const fmtOne=v=>Number(v).toLocaleString("en-US",{minimumFractionDigits:1,maximumFractionDigits:1});
const fmtTwo=v=>Number(v).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
const pct=v=>Number.isFinite(v)?(v*100).toFixed(1)+"%":"";
const machineOptions='<option value=""></option>'+DATA.machines.map(v=>'<option value="'+esc(v)+'">'+esc(v)+'</option>').join("");
const lineOptions='<option value=""></option>'+DATA.lines.map(v=>'<option value="'+esc(v)+'">'+esc(v)+'</option>').join("");
const productOptions='<option value=""></option>'+DATA.products.map(p=>'<option value="'+esc(p.code)+'">'+esc(p.code+" — "+p.name)+'</option>').join("");
const productMap=Object.fromEntries(DATA.products.map(p=>[p.code,p.name]));
function rowHtml(index,defaultDate=""){
return '<tr data-row="'+index+'"><th class="oee-rownum">'+index+'</th>'+
'<td><input class="oee-cell" data-col="A" type="date" value="'+esc(defaultDate)+'" aria-label="Date row '+index+'"></td>'+
'<td><select class="oee-cell oee-select oee-machine" data-col="B" aria-label="Machine row '+index+'">'+(window.TFI_OEE_BACKEND?window.TFI_OEE_BACKEND.machineOptionsHtml():machineOptions)+'</select></td>'+
'<td><select class="oee-cell oee-select" data-col="C" aria-label="Line row '+index+'">'+(window.TFI_OEE_BACKEND?window.TFI_OEE_BACKEND.lineOptionsHtml():lineOptions)+'</select></td>'+
'<td><select class="oee-cell oee-select oee-code" data-col="D" aria-label="Product Code row '+index+'">'+(window.TFI_OEE_BACKEND?window.TFI_OEE_BACKEND.productOptionsHtml():productOptions)+'</select></td>'+
'<td><input class="oee-cell oee-number" data-col="E" type="number" min="0" step="any" inputmode="decimal" aria-label="Planned Time hours row '+index+'"></td>'+
'<td><input class="oee-cell oee-number" data-col="F" type="number" min="0" step="any" inputmode="decimal" aria-label="Downtime hours row '+index+'"></td>'+
'<td><input class="oee-cell oee-number" data-col="G" type="number" min="0" step="any" inputmode="decimal" aria-label="Ideal Rate units per hour row '+index+'"></td>'+
'<td><input class="oee-cell oee-number" data-col="H" type="number" min="0" step="1" inputmode="numeric" aria-label="Total Count units row '+index+'"></td>'+
'<td><input class="oee-cell oee-number" data-col="I" type="number" min="0" step="1" inputmode="numeric" aria-label="Reject Count units row '+index+'"></td>'+
'<td><select class="oee-cell oee-select oee-include" data-col="J" aria-label="Include in Overall OEE row '+index+'"><option value=""></option><option value="Y">Y</option><option value="N">N</option></select></td>'+
'<td class="oee-auto-cell"><input class="oee-cell oee-auto oee-numeric-auto" data-col="K" readonly tabindex="-1" aria-label="Run Time hours row '+index+'"></td>'+
'<td class="oee-auto-cell"><input class="oee-cell oee-auto oee-numeric-auto" data-col="L" readonly tabindex="-1" aria-label="Good Count row '+index+'"></td>'+
'<td class="oee-auto-cell"><input class="oee-cell oee-auto oee-percent-auto" data-col="M" readonly tabindex="-1" aria-label="Availability row '+index+'"></td>'+
'<td class="oee-auto-cell"><input class="oee-cell oee-auto oee-percent-auto" data-col="N" readonly tabindex="-1" aria-label="Performance row '+index+'"></td>'+
'<td class="oee-auto-cell"><input class="oee-cell oee-auto oee-percent-auto" data-col="O" readonly tabindex="-1" aria-label="Quality row '+index+'"></td>'+
'<td class="oee-auto-cell"><input class="oee-cell oee-auto oee-percent-auto" data-col="P" readonly tabindex="-1" aria-label="OEE row '+index+'"></td>'+
'<td class="oee-auto-cell"><input class="oee-cell oee-auto oee-numeric-auto" data-col="Q" readonly tabindex="-1" aria-label="Ideal Output row '+index+'"></td>'+
'<td class="oee-auto-cell"><input class="oee-cell oee-auto oee-numeric-auto" data-col="R" readonly tabindex="-1" aria-label="Count capped to ideal row '+index+'"></td>'+
'<td class="oee-auto-cell"><input class="oee-cell oee-auto oee-numeric-auto" data-col="S" readonly tabindex="-1" aria-label="Week row '+index+'"></td>'+
'<td class="oee-auto-cell"><input class="oee-cell oee-auto oee-numeric-auto" data-col="T" readonly tabindex="-1" aria-label="Month row '+index+'"></td>'+
'<td class="oee-auto-cell"><input class="oee-cell oee-auto" data-col="U" readonly tabindex="-1" aria-label="Product Name row '+index+'"></td></tr>';
}
function value(row,key){return row.querySelector('[data-col="'+key+'"]').value;}
function numberValue(raw){if(raw===null||raw===undefined||String(raw).trim()==="")return null;const n=Number(raw);return Number.isFinite(n)?n:null;}
function set(row,key,text){const cell=row.querySelector('[data-col="'+key+'"]');cell.value=text;cell.classList.toggle("oee-negative",text!==""&&Number(String(text).replace(/,/g,""))<0);}
function isoWeek(dateText){
if(!dateText)return null;const parts=dateText.split("-").map(Number);if(parts.length!==3)return null;
const d=new Date(Date.UTC(parts[0],parts[1]-1,parts[2]));if(Number.isNaN(d.getTime()))return null;
d.setUTCDate(d.getUTCDate()+4-(d.getUTCDay()||7));const yearStart=new Date(Date.UTC(d.getUTCFullYear(),0,1));
return Math.ceil((((d-yearStart)/86400000)+1)/7);
}
function readRows(){
return Array.from($("oee-tbody").querySelectorAll("tr")).map((el,index)=>({
el,index,date:value(el,"A"),machine:value(el,"B"),line:value(el,"C"),code:value(el,"D"),
planned:numberValue(value(el,"E")),downtime:numberValue(value(el,"F")),rate:numberValue(value(el,"G")),
total:numberValue(value(el,"H")),reject:numberValue(value(el,"I")),include:value(el,"J")
}));
}
function hasData(r){return !!(r.machine||r.line||r.code||r.planned!==null||r.downtime!==null||r.rate!==null||r.total!==null||r.reject!==null||r.include);}
function computeAll(){
const rows=readRows();
rows.forEach(r=>{
const dated=!!r.date;
const run=dated?(r.planned??0)-(r.downtime??0):null;
const good=dated?(r.total??0)-(r.reject??0):null;
const ideal=dated?run*(r.rate??0):null;
const capped=dated?Math.min(r.total??0,ideal??0):null;
const availability=dated&&(r.planned??0)>0?run/r.planned:null;
const performance=dated&&ideal>0?capped/ideal:null;
const quality=dated&&(r.total??0)>0?good/r.total:null;
const oee=Number.isFinite(availability)&&Number.isFinite(performance)&&Number.isFinite(quality)?availability*performance*quality:null;
set(r.el,"K",dated?fmtTwo(run):"");set(r.el,"L",dated?fmtInt(good):"");
set(r.el,"M",pct(availability));set(r.el,"N",pct(performance));set(r.el,"O",pct(quality));set(r.el,"P",pct(oee));
set(r.el,"Q",dated?fmtInt(ideal):"");set(r.el,"R",dated?fmtInt(capped):"");
set(r.el,"S",dated?String(isoWeek(r.date)??""):"");
set(r.el,"T",dated?String(Number(r.date.slice(5,7))):"");
set(r.el,"U",r.code?(window.TFI_OEE_BACKEND?window.TFI_OEE_BACKEND.productName(r.code):(productMap[r.code]||"Other")):"");
});
updateSummary(rows);
}
function updateSummary(rows=readRows()){
const filterDate=$("oee-filter-date").value;
const visible=filterDate?rows.filter(r=>r.date===filterDate):rows;
const filled=visible.filter(hasData);
const included=visible.filter(r=>r.include==="Y"&&r.date&&r.machine&&r.code);
const sum=(key)=>included.reduce((s,r)=>s+(r[key]??0),0);
const planned=sum("planned"),run=sum("planned")-sum("downtime"),total=sum("total"),good=sum("total")-sum("reject");
const ideal=included.reduce((s,r)=>s+((r.planned??0)-(r.downtime??0))*(r.rate??0),0);
const capped=included.reduce((s,r)=>s+Math.min(r.total??0,((r.planned??0)-(r.downtime??0))*(r.rate??0)),0);
const availability=planned>0?run/planned:null;
const performance=ideal>0?capped/ideal:null;
const quality=total>0?good/total:null;
const overall=Number.isFinite(availability)&&Number.isFinite(performance)&&Number.isFinite(quality)?availability*performance*quality:null;
$("oee-overall").textContent=pct(overall)||"—";
$("oee-availability").textContent=pct(availability)||"—";
$("oee-performance").textContent=pct(performance)||"—";
$("oee-quality").textContent=pct(quality)||"—";
$("oee-included-rows").textContent=String(included.length);
$("oee-summary-caption").textContent=filterDate?"Selected date · Y records only":"Current form · Y records only";
$("oee-table-status").textContent=filled.length+" of "+rows.length+" entry rows contain data"+(filterDate?" for selected date":"")+" · historical source records are not loaded here";
}
function onEdit(event){if(!event.target.closest("tr"))return;computeAll();}
function onFilterDate(){
const date=$("oee-filter-date").value;
if(date)$("oee-tbody").querySelectorAll("tr").forEach(row=>{
const untouched=["B","C","D","E","F","G","H","I","J"].every(key=>!row.querySelector('[data-col="'+key+'"]').value);
if(untouched)row.querySelector('[data-col="A"]').value=date;
});
computeAll();
}
let toastTimer;function toast(msg){const el=$("oee-toast");el.textContent=msg;el.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.hidden=true,3600);}
function buildRows(count=rowCount,defaultDate=""){
$("oee-tbody").innerHTML=Array.from({length:count},(_,i)=>rowHtml(i+1,defaultDate)).join("");
$("oee-row-count").textContent=count+" blank entry rows";
$("oee-tbody").addEventListener("input",onEdit);$("oee-tbody").addEventListener("change",onEdit);computeAll();
}
function addRows(){
const old=rowCount;rowCount+=12;$("oee-row-count").textContent=rowCount+" blank entry rows";
const date=$("oee-filter-date").value,tbody=$("oee-tbody");
for(let i=old;i<rowCount;i++)tbody.insertAdjacentHTML("beforeend",rowHtml(i+1,date));
computeAll();toast("12 blank OEE entry rows added.");
}
function clearForm(){
$("oee-tbody").querySelectorAll("input,select").forEach(el=>el.value="");
$("oee-filter-date").value="";computeAll();toast("OEE form cleared. Historical spreadsheet records were not changed.");
}
$("oee-add-rows").addEventListener("click",addRows);
$("oee-reset").addEventListener("click",clearForm);
$("oee-filter-date").addEventListener("change",onFilterDate);
buildRows();
window.TFI_OEE_UI={recompute:computeAll,readRows:readRows};
document.body.dataset.tfiReady="true";document.body.dataset.tfiRows=String(rowCount);
document.body.dataset.tfiMachines=String(DATA.machines.length);document.body.dataset.tfiProducts=String(DATA.products.length);
document.body.dataset.tfiHistoryPreserved="true";
})();