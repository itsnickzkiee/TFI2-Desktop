const fs=require("fs");
const p="C:/Users/Rominick/Desktop/TFI_NEW/design/test-removed-rows-ui.js";
let s=fs.readFileSync(p,"utf8");
s=s.replace('const productionTabs=await frame.$eval("[data-report-page]",xs=>xs.length);','const productionTabs=await frame.$$eval("[data-report-page]",xs=>xs.length);');
fs.writeFileSync(p,s,"utf8");
console.log("Fixed Production Summary tab count assertion.");
