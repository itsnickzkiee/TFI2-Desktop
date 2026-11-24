const fs=require("fs");
const p="C:/Users/Rominick/Desktop/TFI_NEW/design/build-summary-and-link-import.js";
let s=fs.readFileSync(p,"utf8");
const old='<button class="rr-report-tab" type="button" data-report-page="Schedule Summary" aria-current="page">Schedule Summary</button>';
const neu='<button class="rr-report-tab active" type="button" data-report-page="Schedule Summary" aria-current="page">Schedule Summary</button>';
if(!s.includes(old)) throw new Error("Expected schedule tab marker not found in builder.");
s=s.replace(old,neu);
fs.writeFileSync(p,s,"utf8");
console.log("Updated Schedule Summary tab marker.");
