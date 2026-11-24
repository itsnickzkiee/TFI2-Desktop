const fs=require("fs");
const p="C:/Users/Rominick/Desktop/TFI_NEW/design/removed-rows-ui.js";
let s=fs.readFileSync(p,"utf8");
s=s.replace('const state = {page:1,pageSize:10,sortKey:"",sortDirection:1,filters:{}};',
'const state = {page:1,pageSize:10,sortKey:"",sortDirection:1,filters:{},filteredRows:[]};');
s=s.replace('    state.page = 1; renderTable(rows);',
'    state.page = 1; state.filteredRows = rows; renderTable(rows);');
s=s.replace('    if (!records.length) return;\n    const escape', '    const rows = state.filteredRows;\n    if (!rows.length) return;\n    const escape');
s=s.replace('...records.map(record=>SOURCE.columns.map(([key])=>escape(record[key])).join(","))',
'...rows.map(record=>SOURCE.columns.map(([key])=>escape(record[key])).join(","))');
s=s.replace('$("rm-prev").addEventListener("click",()=>{state.page--;renderTable(records);});',
'$("rm-prev").addEventListener("click",()=>{state.page--;renderTable(state.filteredRows);});');
s=s.replace('$("rm-next").addEventListener("click",()=>{state.page++;renderTable(records);});',
'$("rm-next").addEventListener("click",()=>{state.page++;renderTable(state.filteredRows);});');
fs.writeFileSync(p,s,"utf8");
console.log("Aligned pagination and CSV export with the active archive filters.");
