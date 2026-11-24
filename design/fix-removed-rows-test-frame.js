const fs=require("fs");
const p="C:/Users/Rominick/Desktop/TFI_NEW/design/test-removed-rows-ui.js";
let s=fs.readFileSync(p,"utf8");
s=s.replace('return [...page.frames()].find(x=>x.url().includes(file));','const activeElement=await page.$(".tfi-module-frame.is-active");\n   return activeElement ? await activeElement.contentFrame() : null;');
s=s.replace('const productionTabs=await frame.$eval("[data-report-page]",xs=>xs.length);','const productionTabs=await frame.$$eval("[data-report-page]",xs=>xs.length);');
fs.writeFileSync(p,s,"utf8");
console.log("Test now resolves the active iframe directly.");
