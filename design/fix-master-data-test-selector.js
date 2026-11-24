const fs=require("fs");
const p="C:/Users/Rominick/Desktop/TFI_NEW/design/test-master-data-ui.js";
let s=fs.readFileSync(p,"utf8");
s=s.replace('changed:document.querySelector("#data-content tbody tr[data-source-row=\\\\\\"5\\\\\\"] td:nth-child(2)").innerText.includes("Mayon GB")',
'changed:document.querySelector(\'#data-content tbody tr[data-source-row="5"] td:nth-child(2)\').innerText.includes("Mayon GB")');
fs.writeFileSync(p,s,"utf8");
console.log("Fixed the browser test selector quoting.");
