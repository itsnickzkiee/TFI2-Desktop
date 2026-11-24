const fs=require("fs");
const p="C:/Users/Rominick/Desktop/TFI_NEW/design/test-removed-rows-ui.js";
let s=fs.readFileSync(p,"utf8");
s=s.replace('const productionTabs=await frame.$eval("[data-report-page]",xs=>xs.length);','const productionTabs=await frame.$$eval("[data-report-page]",xs=>xs.length);');
s=s.replace('await frame.click(\'[data-report-page="Removed Rows"]\');\n frame=await active("removed-rows-preview.html");',
'await frame.evaluate(()=>document.querySelector(\'[data-report-page="Removed Rows"]\').click());\n frame=await active("removed-rows-preview.html");');
fs.writeFileSync(p,s,"utf8");
console.log("Adjusted final report-tab activation in browser test.");
