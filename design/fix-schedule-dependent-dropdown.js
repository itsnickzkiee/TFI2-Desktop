const fs=require('fs'),path=require('path'),dir='C:/Users/Rominick/Desktop/TFI_NEW/design/';
function once(s,a,b,label){const n=s.split(a).length-1;if(n!==1)throw new Error(label+' expected once, found '+n);return s.replace(a,b)}
const file='production-schedule-preview.html',p=path.join(dir,file),bak=p+'.pre-source-mapping-corrections-20261120.bak';
let s=fs.readFileSync(p,'utf8');if(!fs.existsSync(bak))fs.copyFileSync(p,bak);
const oldCodeOptions=` const codeOptions=()=>{
  const grouped=new Map();
  Object.entries(DATA.groupCodes||{}).forEach(([group,codes])=>{
   const valid=(codes||[]).filter(code=>byCode[code]);
   if(valid.length)grouped.set(group,valid);
  });
  const seen=new Set();let html='<option value=""></option>';
  grouped.forEach((codes,group)=>{
   html+='<optgroup label="'+esc(group)+'">'+codes.map(code=>{seen.add(code);return '<option value="'+esc(code)+'">'+esc(code)+'</option>';}).join("")+'</optgroup>';
  });
  const extra=products.filter(p=>!seen.has(p.code));
  if(extra.length)html+='<optgroup label="OTHER SOURCE CODES">'+extra.map(p=>'<option value="'+esc(p.code)+'">'+esc(p.code)+'</option>').join("")+'</optgroup>';
  return html;
 };
 const codeOptionsHtml=codeOptions();`;
const newCodeOptions=` const codeOptionsForGroup=group=>{
  const codes=DATA.groupCodes?.[group]||[];
  return '<option value=""></option>'+codes.filter(code=>byCode[code]).map(code=>'<option value="'+esc(code)+'">'+esc(code)+'</option>').join("");
 };`;
s=once(s,oldCodeOptions,newCodeOptions,'grouped product-code options');
s=once(s,`  '<td><select class="cell-select" data-field="code" aria-label="Production code row '+(i+1)+'">'+codeOptionsHtml+'</select></td>'+',`  '<td><select class="cell-select" data-field="code" aria-label="Production code row '+(i+1)+'" disabled><option value=""></option></select></td>'+','initial product-code select');
s=once(s,` rows.forEach(row=>{
  row.addEventListener("input",updateAll);
  row.addEventListener("change",updateAll);
  get(row,"code").addEventListener("change",()=>{`,` rows.forEach(row=>{
  row.addEventListener("input",updateAll);
  row.addEventListener("change",updateAll);
  get(row,"productName").addEventListener("change",()=>{
   const group=value(row,"productName");
   const codeSelect=get(row,"code");
   const codes=DATA.groupCodes?.[group]||[];
   codeSelect.innerHTML=codeOptionsForGroup(group);
   codeSelect.disabled=!codes.some(code=>byCode[code]);
   codeSelect.value="";
   get(row,"shift").value="";
   updateAll();
  });
  get(row,"code").addEventListener("change",()=>{`,'product group dependent dropdown handler');
s=once(s,` function resetForm(){
  rows.forEach(row=>row.querySelectorAll("input,select").forEach(el=>el.value=""));
  $("available-total").value="";
  updateAll();toast("Schedule form cleared. All 10 source entry rows are blank and ready.");
 }`,` function resetForm(){
  rows.forEach(row=>{
   row.querySelectorAll("input,select").forEach(el=>el.value="");
   const codeSelect=get(row,"code");
   codeSelect.innerHTML='<option value=""></option>';
   codeSelect.disabled=true;
  });
  $("available-total").value="";
  updateAll();toast("Schedule form cleared. All 10 source entry rows are blank and ready.");
 }`,'schedule reset dependent dropdown');
fs.writeFileSync(p,s,'utf8');
const dataPath=path.join(dir,'production-schedule-data.js');let d=fs.readFileSync(dataPath,'utf8');
const oldNote='"note":"Do not replace with one global product-code list; the allowed codes depend on the selected product group."';
const newNote='"note":"Do not replace with one global product-code list; the allowed codes depend on the selected product group.","unassignedCodeGroup":"NEW PRODUCT / NOT YET GROUPED  (bagong product - i-type dito, tapos ilipat sa sariling group kung gusto)","unassignedCodeGroupSelectable":false';
d=once(d,oldNote,newNote,'schedule unassigned helper note');
fs.writeFileSync(dataPath,d,'utf8');
console.log(JSON.stringify({updated:[file,'production-schedule-data.js'],backupExists:fs.existsSync(bak),groupSpecificCodeSelect:true,unassignedGroupSelectable:false}));
fs.unlinkSync(__filename);