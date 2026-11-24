const fs=require("fs");
const file="C:/Users/Rominick/Desktop/TFI_NEW/design/test-schedule-summary.js";
let s=fs.readFileSync(file,"utf8");
s=s.replace('const returnToProductionSummary = !!reportFrame && await reportFrame.evaluate(() => document.body.dataset.tfiReport === "production-summary");','const returnToProductionSummary = !!reportFrame && reportFrame.url().includes("reports-reconciliation-preview.html");');
fs.writeFileSync(file,s,"utf8");
console.log("Navigation route assertion updated.");
