const fs=require('fs');
const p='C:/Users/Rominick/Desktop/TFI_NEW/design/spreadsheet-import-center-preview.html';
let h=fs.readFileSync(p,'utf8');
h=h.replace('<h2 class="card-title">Choose source workbook</h2><p class="card-sub">Select one of the available source methods for this controlled scan.</p>',
'<h2 class="card-title">Choose import destination &amp; source</h2><p class="card-sub">Select one operational module, then choose its source workbook or Google Sheets link.</p>');
fs.writeFileSync(p,h,'utf8');console.log('Polished the Import Center card heading to match the module-first flow.');
