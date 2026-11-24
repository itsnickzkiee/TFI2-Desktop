const fs=require("fs");
const file="C:/Users/Rominick/Desktop/TFI_NEW/design/build-schedule-summary-preview.js";
let s=fs.readFileSync(file,"utf8");
const lines=s.split(/\r?\n/);
const idx=lines.findIndex(line=>line.startsWith("router=replaceOnce(router,'    const key="));
if(idx<0) throw new Error("Router patch line not found.");
lines[idx]='router=replaceOnce(router,\'function setActive(page){\\n    const nav=document.querySelector(".sidebar nav");\\n    if(!nav)return;\\n    const key=String(page||"").trim().toLowerCase();\',\'function setActive(page){\\n    const nav=document.querySelector(".sidebar nav");\\n    if(!nav)return;\\n    const rawKey=String(page||"").trim().toLowerCase();\\n    const key=["production summary","schedule summary","summary","removed rows"].includes(rawKey)?"reports":rawKey;\',"keep Reports sidebar active for report subviews");';
fs.writeFileSync(file,lines.join("\n"),"utf8");
console.log("Builder router patch updated.");
