(function(){
"use strict";
const DATA=window.TFI_HOURLY_MEAT_DATA;if(!DATA)throw new Error("Hourly Meat source lists were not loaded.");
const $=id=>document.getElementById(id);let rowCount=12;
const esc=v=>String(v??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const fmt=v=>Number(v||0).toLocaleString("en-US",{maximumFractionDigits:0});
const products=DATA.products,productMap=Object.fromEntries(products.map(p=>[p.code,p.name]));
const productOptions='<option value=""></option>'+products.map(p=>'<option value="'+esc(p.code)+'">'+esc(p.code+" — "+p.name)+'</option>').join("");
const hourOptions='<option value=""></option>'+DATA.hours.map(h=>'<option value="'+h.value+'">'+esc(h.label)+'</option>').join("");
function rowHtml(index,defaultDate=""){
return '<tr data-row="'+index+'"><th class="hm-rownum">'+index+'</th>'+
'<td><input class="hm-cell hm-date" data-col="A" type="date" min="2000-01-02" value="'+esc(defaultDate)+'" aria-label="Date row '+index+'"></td>'+
'<td><select class="hm-cell hm-select hm-hour" data-col="B" aria-label="Hour row '+index+'">'+hourOptions+'</select></td>'+
'<td><select class="hm-cell hm-select hm-code" data-col="C" aria-label="Product Code row '+index+'">'+productOptions+'</select></td>'+
'<td><input class="hm-cell hm-number" data-col="D" type="number" min="0" step="1" inputmode="numeric" aria-label="Target for the hour row '+index+'"></td>'+
'<td><input class="hm-cell hm-number" data-col="E" type="number" min="0" step="1" inputmode="numeric" aria-label="Actual output row '+index+'"></td>'+
'<td><input class="hm-cell hm-remarks" data-col="F" type="text" aria-label="Remarks row '+index+'"></td>'+
'<td class="hm-auto-cell"><input class="hm-cell hm-auto" data-col="G" type="text" readonly tabindex="-1" aria-label="Product Name row '+index+'"></td>'+
'<td class="hm-auto-cell"><input class="hm-cell hm-auto hm-time-slot" data-col="H" type="text" readonly tabindex="-1" aria-label="Time slot row '+index+'"></td>'+
'<td class="hm-auto-cell"><input class="hm-cell hm-auto hm-numeric-auto" data-col="I" type="text" readonly tabindex="-1" aria-label="Variance row '+index+'"></td>'+
'<td class="hm-auto-cell"><input class="hm-cell hm-auto hm-numeric-auto" data-col="J" type="text" readonly tabindex="-1" aria-label="Cumulative target row '+index+'"></td>'+
'<td class="hm-auto-cell"><input class="hm-cell hm-auto hm-numeric-auto" data-col="K" type="text" readonly tabindex="-1" aria-label="Cumulative actual row '+index+'"></td>'+
'<td class="hm-auto-cell"><input class="hm-cell hm-auto hm-percent-auto" data-col="L" type="text" readonly tabindex="-1" aria-label="Hour attainment row '+index+'"></td></tr>';
}
function value(row,key){return row.querySelector('[data-col="'+key+'"]').value;}
function numberValue(raw){if(raw===null||raw===undefined||String(raw).trim()==="")return null;const n=Number(raw);return Number.isFinite(n)?n:null;}
function set(row,key,text){const cell=row.querySelector('[data-col="'+key+'"]');cell.value=text;if(["I","J","K"].includes(key))cell.classList.toggle("hm-negative",text!==""&&Number(String(text).replace(/,/g,""))<0);}
function sameDayCode(a,b){return a.date===b.date&&a.code===b.code;}
function readRows(){return Array.from($("hm-tbody").querySelectorAll("tr")).map((row,index)=>({
el:row,index,date:value(row,"A"),hour:numberValue(value(row,"B")),code:value(row,"C"),
target:numberValue(value(row,"D")),actual:numberValue(value(row,"E")),
remarks:value(row,"F")
}));}
function computeAll(){
const rows=readRows();
rows.forEach(r=>{
set(r.el,"G",r.code?(productMap[r.code]||"Other"):"");
set(r.el,"H",r.hour===null?"":String(r.hour).padStart(2,"0")+":00-"+String((r.hour+1)%24).padStart(2,"0")+":00");
set(r.el,"I",r.target===null||r.actual===null?"":fmt(r.actual-r.target));
if(!r.date||r.hour===null||!r.code){set(r.el,"J","");set(r.el,"K","");}
else{
const same=rows.filter(x=>sameDayCode(x,r)&&x.hour!==null&&x.hour<=r.hour);
const target=same.reduce((sum,x)=>sum+(x.target??0),0);
const actual=same.reduce((sum,x)=>sum+(x.actual??0),0);
set(r.el,"J",fmt(target));
set(r.el,"K",r.actual===null?"":fmt(actual));
}
set(r.el,"L",r.target===null||r.actual===null||r.target===0?"":Math.round((r.actual/r.target)*100)+"%");
});
updateSummary(rows);
}
function hasData(r){return !!(r.hour!==null||r.code||r.target!==null||r.actual!==null||String(r.remarks||"").trim());}
function updateSummary(rows=readRows()){
const filterDate=$("hm-filter-date").value;
const visible=filterDate?rows.filter(r=>r.date===filterDate):rows;
const filled=visible.filter(hasData);
const target=visible.reduce((s,r)=>s+(r.target??0),0);
const actual=visible.reduce((s,r)=>s+(r.actual??0),0);
const variance=actual-target;
const attainment=target>0?Math.round(actual/target*100):null;
$("hm-filled-rows").textContent=String(filled.length);
$("hm-total-target").textContent=fmt(target);
$("hm-total-actual").textContent=fmt(actual);
$("hm-total-variance").textContent=fmt(variance);
$("hm-total-attainment").textContent=attainment===null?"—":attainment+"%";
$("hm-summary-caption").textContent=filterDate?"Summary for selected date":"Summary for current form";
$("hm-table-status").textContent=filled.length+" of "+rows.length+" entry rows contain data"+(filterDate?" for selected date":"")+" · no sample transactions are preloaded";

}
function onEdit(event){const row=event.target.closest("tr");if(!row)return;computeAll();}
function onFilterDate(){
const date=$("hm-filter-date").value;
if(date)$("hm-tbody").querySelectorAll("tr").forEach(row=>{const untouched=["B","C","D","E","F"].every(key=>!row.querySelector('[data-col="'+key+'"]').value);if(untouched)row.querySelector('[data-col="A"]').value=date;});
computeAll();
}
let toastTimer;function toast(msg){const el=$("hm-toast");el.textContent=msg;el.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.hidden=true,3600);}
function buildRows(count=rowCount,defaultDate=""){$("hm-tbody").innerHTML=Array.from({length:count},(_,i)=>rowHtml(i+1,defaultDate)).join("");$("hm-row-count").textContent=count+" blank entry rows";$("hm-tbody").addEventListener("input",onEdit);$("hm-tbody").addEventListener("change",onEdit);computeAll();}
function addRows(){const old=rowCount;rowCount+=12;$("hm-row-count").textContent=rowCount+" blank entry rows";document.body.dataset.tfiRows=String(rowCount);const date=$("hm-filter-date").value;const tbody=$("hm-tbody");for(let i=old;i<rowCount;i++)tbody.insertAdjacentHTML("beforeend",rowHtml(i+1,date));computeAll();toast("12 blank hourly entry rows added.");}
function clearForm(){$("hm-tbody").querySelectorAll("input,select").forEach(el=>el.value="");$("hm-filter-date").value="";computeAll();toast("Hourly Meat form cleared. No records were saved.");}
$("hm-add-rows").addEventListener("click",addRows);
$("hm-reset").addEventListener("click",clearForm);

$("hm-filter-date").addEventListener("change",onFilterDate);
buildRows();
document.body.dataset.tfiReady="true";
document.body.dataset.tfiRows=String(rowCount);
document.body.dataset.tfiProducts=String(products.length);
document.body.dataset.tfiNoMock="true";
})();