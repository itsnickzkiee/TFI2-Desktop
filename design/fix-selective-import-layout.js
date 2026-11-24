const fs=require('fs');
const dir='C:/Users/Rominick/Desktop/TFI_NEW/design';
const p=dir+'/spreadsheet-import-center-preview.html';
let h=fs.readFileSync(p,'utf8');
h=h.replace(/<div class="method-grid">\s*<div class="method-grid">/,'<div class="method-grid">');
fs.writeFileSync(p,h,'utf8');
const sp=dir+'/scan-progress-worksheet-detection-preview.html';
let s=fs.readFileSync(sp,'utf8');
s=s.replace('<div class="side-stat"><span>Workbook</span><strong>Not selected</strong></div><div class="side-stat"><span>Worksheets</span>',
'<div class="side-stat"><span>Workbook</span><strong>Not selected</strong></div><div class="side-stat"><span>Destination module</span><strong id="scan-destination">Not selected</strong></div><div class="side-stat"><span>Worksheets</span>');
s=s.replace("if(importSource.targetLabel){const summary=document.querySelectorAll('.side-card .side-stat strong');if(summary[1])summary[1].textContent=importSource.targetLabel;}",
"if(importSource.targetLabel){$('scan-destination').textContent=importSource.targetLabel;}");
fs.writeFileSync(sp,s,'utf8');
console.log('Removed duplicated import-method wrapper and added a dedicated destination field to Scan Summary.');
