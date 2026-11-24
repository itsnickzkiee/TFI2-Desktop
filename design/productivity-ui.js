(function(){
"use strict";
const DATA=window.TFI_PRODUCTIVITY_DATA;if(!DATA)throw new Error("Productivity source lists were not loaded.");
const $=id=>document.getElementById(id);let rowCount=12;
const esc=v=>String(v??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const fmt0=v=>Number(v||0).toLocaleString("en-US",{maximumFractionDigits:0});
const fmt1=v=>Number(v||0).toLocaleString("en-US",{minimumFractionDigits:1,maximumFractionDigits:1});
const pct1=v=>Number.isFinite(v)?(v*100).toFixed(1)+"%":"";
const pct2=v=>Number.isFinite(v)?(v*100).toFixed(2)+"%":"";
const products=DATA.products,productMap=Object.fromEntries(products.map(p=>[p.code,p.name]));
const productOptions='<option value=""></option>'+products.map(p=>'<option value="'+esc(p.code)+'">'+esc(p.code+" — "+p.name)+'</option>').join("");
const lineOptions='<option value=""></option>'+DATA.lines.map(line=>'<option value="'+esc(line)+'">'+esc(line)+'</option>').join("");
function rowHtml(index,defaultDate=""){
return '<tr data-row="'+index+'"><th class="pr-rownum">'+index+'</th>'+
'<td><input class="pr-cell" data-col="A" type="date" min="2020-01-02" value="'+esc(defaultDate)+'" aria-label="Date row '+index+'"></td>'+
'<td><select class="pr-cell pr-select pr-code" data-col="B" aria-label="Product Code row '+index+'">'+productOptions+'</select></td>'+
'<td><select class="pr-cell pr-select" data-col="C" aria-label="Line row '+index+'">'+lineOptions+'</select></td>'+
'<td><input class="pr-cell pr-number" data-col="D" type="number" min="0" step="any" inputmode="decimal" aria-label="Planned Run Hours row '+index+'"></td>'+
'<td><input class="pr-cell pr-number" data-col="E" type="number" min="0" step="any" inputmode="decimal" aria-label="Actual Output tins row '+index+'"></td>'+
'<td><input class="pr-cell pr-number pr-reject" data-col="F" type="number" min="0" step="any" inputmode="decimal" aria-label="Dented rejects row '+index+'"></td>'+
'<td><input class="pr-cell pr-number pr-reject" data-col="G" type="number" min="0" step="any" inputmode="decimal" aria-label="False Seam rejects row '+index+'"></td>'+
'<td><input class="pr-cell pr-number pr-reject" data-col="H" type="number" min="0" step="any" inputmode="decimal" aria-label="Flipper rejects row '+index+'"></td>'+
'<td><input class="pr-cell pr-number pr-reject" data-col="I" type="number" min="0" step="any" inputmode="decimal" aria-label="Bulged rejects row '+index+'"></td>'+
'<td><input class="pr-cell pr-number pr-reject" data-col="J" type="number" min="0" step="any" inputmode="decimal" aria-label="Panel rejects row '+index+'"></td>'+
'<td><input class="pr-cell pr-number pr-reject" data-col="K" type="number" min="0" step="any" inputmode="decimal" aria-label="Buckling rejects row '+index+'"></td>'+
'<td class="pr-calc-cell"><input class="pr-cell pr-calc pr-calc-number" data-col="L" readonly tabindex="-1" aria-label="Total FG Rejects row '+index+'"></td>'+
'<td class="pr-source-cell"><input class="pr-cell pr-source pr-number" data-col="M" type="number" readonly tabindex="-1" aria-label="Manpower Hours from DMP row '+index+'"></td>'+
'<td class="pr-source-cell"><input class="pr-cell pr-source pr-number" data-col="N" type="number" readonly tabindex="-1" aria-label="Target Output 12H row '+index+'"></td>'+
'<td class="pr-source-cell"><input class="pr-cell pr-source pr-number" data-col="O" type="number" readonly tabindex="-1" aria-label="Standard Productivity row '+index+'"></td>'+
'<td class="pr-calc-cell"><input class="pr-cell pr-calc pr-calc-number" data-col="P" readonly tabindex="-1" aria-label="Standard Output at Actual MHR row '+index+'"></td>'+
'<td class="pr-calc-cell"><input class="pr-cell pr-calc pr-calc-number" data-col="Q" readonly tabindex="-1" aria-label="Productivity tins per MHR row '+index+'"></td>'+
'<td class="pr-calc-cell"><input class="pr-cell pr-calc pr-calc-percent" data-col="R" readonly tabindex="-1" aria-label="Output Attainment Percent row '+index+'"></td>'+
'<td class="pr-calc-cell"><input class="pr-cell pr-calc pr-calc-percent" data-col="S" readonly tabindex="-1" aria-label="Reject Percent row '+index+'"></td>'+
'<td class="pr-calc-cell"><input class="pr-cell pr-calc" data-col="T" readonly tabindex="-1" aria-label="ISO Week row '+index+'"></td>'+
'<td class="pr-calc-cell"><input class="pr-cell pr-calc" data-col="U" readonly tabindex="-1" aria-label="Month row '+index+'"></td>'+
'<td><input class="pr-cell pr-product-name" data-col="V" readonly tabindex="-1" aria-label="Product Name auto row '+index+'"></td></tr>';
}
function value(row,key){return row.querySelector('[data-col="'+key+'"]').value;}
function num(raw){if(raw===null||raw===undefined||String(raw).trim()==="")return null;const n=Number(raw);return Number.isFinite(n)?n:null;}
function set(row,key,text){const el=row.querySelector('[data-col="'+key+'"]');el.value=text;el.classList.toggle("pr-negative",text!==""&&Number(String(text).replace(/,/g,""))<0);}
function productFor(row){return products.find(p=>p.code===value(row,"B"))||null;}
function refreshStandards(row){
const code=value(row,"B"),date=value(row,"A"),product=productFor(row);
const n=row.querySelector('[data-col="N"]'),o=row.querySelector('[data-col="O"]');
if(!date){n.value="";o.value="";return;}
const planned=num(value(row,"D"))??0;
n.value=code?String(Math.round((product?.capacity??0)/DATA.assumptions.standardCapacityBaseHours*planned)):"0";
o.value=code?String(product?.std??0):"0";
}
function isoWeek(dateText){
if(!dateText)return null;const a=dateText.split("-").map(Number);if(a.length!==3)return null;
const d=new Date(Date.UTC(a[0],a[1]-1,a[2]));if(Number.isNaN(d.getTime()))return null;
d.setUTCDate(d.getUTCDate()+4-(d.getUTCDay()||7));const y=new Date(Date.UTC(d.getUTCFullYear(),0,1));
return Math.ceil((((d-y)/86400000)+1)/7);
}
function readRows(){return Array.from($("pr-tbody").querySelectorAll("tr")).map((el,index)=>({
el,index,date:value(el,"A"),code:value(el,"B"),line:value(el,"C"),planned:num(value(el,"D")),
actual:num(value(el,"E")),rejects:["F","G","H","I","J","K"].map(k=>num(value(el,k))??0),
manpower:num(value(el,"M")),target:num(value(el,"N")),standard:num(value(el,"O"))
}));}
function hasData(r){return !!(r.code||r.line||r.planned!==null||r.actual!==null||r.rejects.some(v=>v!==0)||r.manpower!==null||r.target!==null||r.standard!==null);}
function updateSummary(rows=readRows()){
const filter=$("pr-filter-date").value,visible=filter?rows.filter(r=>r.date===filter):rows,filled=visible.filter(hasData);
const output=filled.reduce((s,r)=>s+(r.actual??0),0);
const rejects=filled.reduce((s,r)=>s+r.rejects.reduce((a,b)=>a+b,0),0);
const manpower=filled.reduce((s,r)=>s+(r.manpower??0),0);
$("pr-filled-rows").textContent=String(filled.length);
$("pr-total-output").textContent=fmt0(output);
$("pr-total-rejects").textContent=fmt0(rejects);
$("pr-total-manpower").textContent=fmt1(manpower);
$("pr-summary-caption").textContent=filter?"Current form · selected date":"Current form · all dates";
}
function computeAll(){
const rows=readRows();rows.forEach(r=>{
const el=r.el,product=productFor(el);
set(el,"V",r.code?(product?.name||"Other"):"");
if(r.date){
const totalRejects=r.rejects.reduce((a,b)=>a+b,0),manpower=r.manpower??0,planned=r.planned??0;
const target=r.target??0,standard=r.standard??0,actual=r.actual??0;
set(el,"L",fmt0(totalRejects));
set(el,"P",fmt0(standard>0&&manpower>0?standard*manpower:0));
set(el,"Q",manpower>0?fmt1(actual/manpower):"");
set(el,"R",target>0?pct1(actual/target):"");
set(el,"S",actual+totalRejects>0?pct2(totalRejects/(actual+totalRejects)):"");
set(el,"T",String(isoWeek(r.date)??""));
set(el,"U",String(Number(r.date.slice(5,7))));
}else{
["L","P","Q","R","S","T","U"].forEach(k=>set(el,k,""));
}
});
const seen=new Map();rows.forEach(r=>{r.el.classList.remove("pr-duplicate");if(r.date&&r.code){const k=r.date+"|"+r.code;seen.set(k,(seen.get(k)||0)+1);}});
let duplicateCount=0;rows.forEach(r=>{if(r.date&&r.code&&seen.get(r.date+"|"+r.code)>1){r.el.classList.add("pr-duplicate");duplicateCount++;}});
updateSummary(rows);
const filled=rows.filter(hasData).length;
$("pr-table-status").innerHTML=filled+" of "+rows.length+" entry rows contain data"+(duplicateCount?' <span class="pr-warning">· '+duplicateCount+' rows share a duplicate date and product code</span>':"")+" · no sample transactions are preloaded";
}
function onEdit(event){
const row=event.target.closest("tr");if(!row)return;
const col=event.target.dataset.col;
if(col==="B"||col==="A"||col==="D")refreshStandards(row);
computeAll();
}
function onFilterDate(){
const date=$("pr-filter-date").value;
if(date)$("pr-tbody").querySelectorAll("tr").forEach(row=>{
const untouched=["B","C","D","E","F","G","H","I","J","K","M","N","O"].every(k=>!row.querySelector('[data-col="'+k+'"]').value);
if(untouched)row.querySelector('[data-col="A"]').value=date;
});
$("pr-tbody").querySelectorAll("tr").forEach(row=>refreshStandards(row,false));
computeAll();
}
let toastTimer;function toast(message){const el=$("pr-toast");el.textContent=message;el.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.hidden=true,3600);}
function buildRows(){const date=$("pr-filter-date").value;$("pr-tbody").innerHTML=Array.from({length:rowCount},(_,i)=>rowHtml(i+1,date)).join("");$("pr-row-count").textContent=rowCount+" blank entry rows";$("pr-tbody").addEventListener("input",onEdit);$("pr-tbody").addEventListener("change",onEdit);computeAll();}
function addRows(){const start=rowCount;rowCount+=12;const date=$("pr-filter-date").value;for(let i=start;i<rowCount;i++)$("pr-tbody").insertAdjacentHTML("beforeend",rowHtml(i+1,date));$("pr-row-count").textContent=rowCount+" blank entry rows";computeAll();toast("12 blank Productivity entry rows added.");}
function clearForm(){$("pr-tbody").querySelectorAll("input,select").forEach(el=>{el.value="";});$("pr-filter-date").value="";computeAll();toast("Productivity form cleared. No records were saved.");}
$("pr-add-rows").addEventListener("click",addRows);
$("pr-clear").addEventListener("click",clearForm);
$("pr-filter-date").addEventListener("change",onFilterDate);
$("pr-save").addEventListener("click",()=>toast("Saving is not enabled in this preview."));
buildRows();
document.body.dataset.tfiReady="true";document.body.dataset.tfiRows=String(rowCount);
document.body.dataset.tfiProducts=String(products.length);document.body.dataset.tfiLines=String(DATA.lines.length);
document.body.dataset.tfiSourceRecords=String(DATA.source.records);document.body.dataset.tfiNoMock="true";
})();
