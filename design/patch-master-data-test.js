const fs=require("fs");
const p="C:/Users/Rominick/Desktop/TFI_NEW/design/test-master-data-ui.js";
let s=fs.readFileSync(p,"utf8");
s=s.replace('selected:document.querySelector("#dpr-family-select")?.selectedOptions[0]?.textContent,rows:document.querySelectorAll("#data-content tbody tr[data-source-row]").length','selected:document.querySelector("#dpr-family-select")?.selectedOptions[0]?.textContent,sourceId:document.getElementById("source-sheet-id").textContent,rows:document.querySelectorAll("#data-content tbody tr[data-source-row]").length');
s=s.replace('results.dprHelpers.headers===3','results.dprHelpers.headers===2');
s=s.replace('e.value="Preview Family Test"','e.value="Mayon GB"');
s=s.replace('includes("Preview Family Test")','includes("Mayon GB")');
fs.writeFileSync(p,s,"utf8");
console.log("Corrected DPR source ID/header assertions and preview-edit test value.");
