const fs=require("fs");
const file="C:/Users/Rominick/Desktop/TFI_NEW/design/test-schedule-summary.js";
const lines=fs.readFileSync(file,"utf8").split(/\r?\n/);
const wi=lines.findIndex(line=>line.startsWith("  await page.waitForFunction")&&line.includes("schedule-summary-preview.html"));
if(wi<0) throw new Error("Schedule route wait not found.");
lines[wi]='  await page.waitForFunction(() => { const active=document.querySelector(".tfi-module-frame.is-active"); return !!active && (active.getAttribute("src")||"").includes("schedule-summary-preview.html"); }, { timeout: 10000 });';
fs.writeFileSync(file,lines.join("\n"),"utf8");
console.log("Schedule active-frame wait updated.");
