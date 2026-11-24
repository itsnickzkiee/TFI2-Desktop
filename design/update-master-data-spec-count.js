const fs=require("fs");
const p="C:/Users/Rominick/Desktop/TFI_NEW/docs/blueprints/TFI_MASTER_DATA_UI_SPEC_v0.1_2026-11-18.md";
let s=fs.readFileSync(p,"utf8");
s=s.replace("24 family headers","26 family headers");
s=s.replace("24 family-header rows","26 family-header rows");
fs.writeFileSync(p,s,"utf8");
console.log("Updated the prior Master Data spec to the directly revalidated 26 Product Standard family headers.");
