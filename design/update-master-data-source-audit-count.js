const fs=require("fs");
const p="C:/Users/Rominick/Desktop/TFI_NEW/docs/blueprints/TFI_8_MODULE_SOURCE_ALIGNMENT_VALIDATION_v0.2_2026-11-20.md";
let s=fs.readFileSync(p,"utf8");
s=s.replace("24 family-header rows","26 family-header rows");
s=s.replace("24 family headers","26 family headers");
fs.writeFileSync(p,s,"utf8");
console.log("Reconciled the Master Data source count in the consolidated validation record.");
