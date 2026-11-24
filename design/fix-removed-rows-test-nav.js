const fs=require("fs");
const p="C:/Users/Rominick/Desktop/TFI_NEW/design/test-removed-rows-ui.js";
let s=fs.readFileSync(p,"utf8");
s=s.replace('await frame.click(\'[data-report-page="Reports"]\');','await frame.evaluate(()=>document.querySelector(\'[data-report-page="Reports"]\').click());');
s=s.replace('frame.$eval("[data-report-page]",xs=>xs.length)','frame.$$eval("[data-report-page]",xs=>xs.length)');
fs.writeFileSync(p,s,"utf8");
console.log("Use DOM activation for the Reports tab and fix tab-count query.");
