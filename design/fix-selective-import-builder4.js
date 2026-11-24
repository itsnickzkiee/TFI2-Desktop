const fs=require('fs');
const p='C:/Users/Rominick/Desktop/TFI_NEW/design/build-selective-import-flow.js';
let lines=fs.readFileSync(p,'utf8').split(/\r?\n/);
const importIdx=lines.findIndex(x=>x.includes('Import Center source section marker missing'));
if(importIdx<1)throw new Error('Import Center marker line not found');
lines[importIdx-1]='const marker="<div class=\\"section-body\\">";';
const scanIdx=lines.findIndex(x=>x.includes('Scan target banner insertion point missing'));
if(scanIdx<1)throw new Error('Scan banner marker line not found');
const bannerHtml='<div class="target-banner"><div><small>Selected import destination</small><strong id="target-module-name">No module selected</strong><span id="target-source-name">Mapped worksheet: Not selected</span></div><div class="target-id" id="target-source-id">sheetId —</div><p>Selective scan scope: only the selected destination module’s mapped worksheet will be read. All other workbook tabs are excluded from this import batch.</p></div>';
lines.splice(scanIdx-1,2,
 "const bannerMarker='<div class=\\"stepper\\" aria-label=\\"Import workflow\\">';",
 "const bannerHtml="+JSON.stringify(bannerHtml)+";if(!s.includes('id=\\"target-module-name\\"')){const at=s.indexOf(bannerMarker);if(at<0)throw new Error('Scan target banner insertion point missing');s=s.slice(0,at)+bannerHtml+s.slice(at);}"
);
fs.writeFileSync(p,lines.join('\n'),'utf8');
console.log('Adjusted builder to insert UI using CRLF-safe source markers.');
