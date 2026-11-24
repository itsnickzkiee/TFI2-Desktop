const fs=require("fs");
const p="C:/Users/Rominick/Desktop/TFI_NEW/design/test-summary-and-link-import.js";
let s=fs.readFileSync(p,"utf8");
s=s.replace(" const reportsResult=await testReportPage(\"reports-reconciliation-preview.html\"", " await frame.click('[data-report-page=\"Reports\"]');\n const reportsResult=await testReportPage(\"reports-reconciliation-preview.html\"");
s=s.replace(" const scheduleResult=await testReportPage(\"schedule-summary-preview.html\"", " const summaryFrame=[...page.frames()].find(f=>f.url().includes(\"summary-preview.html\"));\n await summaryFrame.click('[data-report-page=\"Schedule Summary\"]');\n const scheduleResult=await testReportPage(\"schedule-summary-preview.html\"");
fs.writeFileSync(p,s,"utf8");
console.log("Added explicit report tab navigation steps to the browser test.");
