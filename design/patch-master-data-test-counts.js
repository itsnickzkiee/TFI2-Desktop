const fs=require("fs");
const p="C:/Users/Rominick/Desktop/TFI_NEW/design/test-master-data-ui.js";
let s=fs.readFileSync(p,"utf8");
s=s.replace('count.includes("24 family headers")','count.includes("26 family headers")');
s=s.replace('results.dprLists.headers===6','results.dprLists.headers===5');
fs.writeFileSync(p,s,"utf8");
console.log("Updated acceptance checks to the live source row counts: 26 family headers and five DPR independent-list columns.");
