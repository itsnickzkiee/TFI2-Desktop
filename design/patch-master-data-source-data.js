const fs=require("fs");
const p="C:/Users/Rominick/Desktop/TFI_NEW/design/master-data-source-data.js";
const s=fs.readFileSync(p,"utf8");
const marker="window.TFI_MASTER_DATA = ";
const i=s.indexOf(marker);
if(i<0)throw new Error("Source data object not found");
const data=JSON.parse(s.slice(i+marker.length).trim().replace(/;$/,""));
data.sheets.dmpLegend.notes=[
 {sourceRow:5,column:"A",status:"RESIGNED"},
 {sourceRow:9,column:"A",status:"RESIGNED"},
 {sourceRow:14,column:"A",status:"RESIGNED"},
 {sourceRow:17,column:"A",status:"AWOL"},
 {sourceRow:20,column:"A",status:"RESIGNED"},
 {sourceRow:23,column:"A",status:"AWOL"},
 {sourceRow:31,column:"A",status:"RESIGNED"},
 {sourceRow:33,column:"A",status:"RESIGNED"},
 {sourceRow:36,column:"A",status:"RESIGNED"},
 {sourceRow:39,column:"A",status:"AWOL"}
];
data.sheets.productStandard.fieldNotes=[
 {column:"E",note:"EDITED BY PRODUCTION"},
 {column:"F",note:"EDITED BY PLANT IE"},
 {column:"G",note:"EDITED BY PLANT IE"}
];
data.sheets.productStandard.readOnlyColumns=["F","G","S"];
data.sheets.yieldMap.editableColumns=["B","C","D","E","F","G","H","I","J","K","L","M"];
data.sheets.yieldMap.readOnlyColumns=["A","N","P","Q","R","S","T","U","V","W"];
data.sheets.entryMap.readOnlyColumns=["A","B","C","D","E"];
data.sheets.dprLegend.readOnlyColumns=["G","H"];
data.sheets.scheduleLists.readOnlyColumns=["A","B","K","L"];
const out="/* Source-backed Master Data reference snapshot. Read-only UI fixture; values read from the official 35-tab workbook on 2026-11-20. No writes performed. */\nwindow.TFI_MASTER_DATA = "+JSON.stringify(data)+";\n";
fs.writeFileSync(p,out,"utf8");
console.log("Added source notes and field-treatment metadata to Master Data source snapshot.");
