const fs=require("fs");
const p="C:/Users/Rominick/Desktop/TFI_NEW/design/master-data-preview.html";
let h=fs.readFileSync(p,"utf8");
const marker='<div class="link-feedback" id="link-feedback">Paste the approved TFI Google Spreadsheet link, then validate its source ID.</div>';
const add=marker+'<div class="detected-id"><small>Detected Spreadsheet ID</small><strong id="import-detected-id">Not validated</strong></div>';
if(!h.includes(marker))throw new Error("Import link feedback marker missing");
if(!h.includes('id="import-detected-id"'))h=h.replace(marker,add);
fs.writeFileSync(p,h,"utf8");
console.log("Added the detected Spreadsheet ID field to the import modal.");
