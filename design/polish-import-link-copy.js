const fs=require("fs");
const dir="C:/Users/Rominick/Desktop/TFI_NEW/design";
function once(s,a,b,label){const i=s.indexOf(a);if(i<0)throw new Error(label+" marker not found");if(s.indexOf(a,i+a.length)>=0)throw new Error(label+" marker repeated");return s.slice(0,i)+b+s.slice(i+a.length);}
let r=fs.readFileSync(dir+"/reports-reconciliation-preview.html","utf8");
r=once(r,
'This is the dedicated import entry point for the Production Summary worksheet. The interface is being prepared first; scanning, file upload, validation, and database import are not connected in this UI preview.',
'This is the dedicated import entry point for the Production Summary worksheet. Paste a Google Sheets URL below and validate its format. Access checking, scanning, file upload, and database import are not connected in this UI preview.',
"Production Summary modal description");
r=once(r,
'No spreadsheet has been uploaded or scanned. The original Google Sheet and existing production records remain unchanged.',
'No source link has been validated, and no data has been scanned or imported. The original Google Sheet and existing production records remain unchanged.',
"Production Summary warning");
let s=fs.readFileSync(dir+"/schedule-summary-preview.html","utf8");
s=once(s,
'This is the dedicated import entry point for the Schedule Summary worksheet. The interface is being prepared first; file upload, scanning, validation, and database import are not connected in this UI preview.',
'This is the dedicated import entry point for the Schedule Summary worksheet. Paste a Google Sheets URL below and validate its format. Access checking, scanning, file upload, and database import are not connected in this UI preview.',
"Schedule Summary modal description");
s=once(s,
'No spreadsheet has been uploaded or scanned. No populated records were found in the inspected source range A3:S1000. The original workbook remains unchanged.',
'No source link has been validated, and no data has been scanned or imported. No populated records were found in the inspected source range A3:S1000. The original workbook remains unchanged.',
"Schedule Summary warning");
fs.writeFileSync(dir+"/reports-reconciliation-preview.html",r,"utf8");
fs.writeFileSync(dir+"/schedule-summary-preview.html",s,"utf8");
console.log("Updated both modal descriptions and initial status warnings.");
