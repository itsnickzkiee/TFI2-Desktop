const fs=require("fs");
const p="C:/Users/Rominick/Desktop/TFI_NEW/design/test-master-data-ui.js";
const lines=fs.readFileSync(p,"utf8").split(/\r?\n/);
lines[43]=' const editAfter=await frame.evaluate(()=>({closed:!document.querySelector("#record-modal").classList.contains("open"),changed:document.querySelector(\'#data-content tbody tr[data-source-row="5"] td:nth-child(2)\').innerText.includes("Mayon GB")}));';
fs.writeFileSync(p,lines.join("\n"),"utf8");
console.log("Rewrote the browser test selector line.");
