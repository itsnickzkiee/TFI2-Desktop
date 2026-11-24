const fs=require('fs');
const p='C:/Users/Rominick/Desktop/TFI_NEW/design/build-selective-import-flow.js';
let lines=fs.readFileSync(p,'utf8').split(/\r?\n/);
const at=lines.findIndex(x=>x.includes("if(!h.includes('function updateTarget()'))"));
if(at<0)throw new Error('target updater insertion point missing');
if(!lines.some(x=>x.startsWith('const targetCode='))){
 lines.splice(at,0,"const targetCode=\"function updateTarget(){const m=moduleMap[$('target-module').value];if(!m){$('target-sheet-name').textContent='No module selected';$('target-sheet-meta').textContent='Choose a module to see its verified worksheet and sheetId.';$('readiness-destination').textContent='Not selected';return null}$('target-sheet-name').textContent=m.sheet;$('target-sheet-meta').textContent='Verified sheetId '+m.sheetId+' · '+m.group+' destination';$('readiness-destination').textContent=m.label;return m} $('target-module').addEventListener('change',updateTarget);\";");
}
fs.writeFileSync(p,lines.join('\n'),'utf8');
console.log('Added the missing target-module display updater to the builder.');
