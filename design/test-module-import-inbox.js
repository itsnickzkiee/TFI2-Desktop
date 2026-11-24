const puppeteer=require("C:/Users/Rominick/AppData/Local/npm-cache/_npx/4b4c857f6efdfb61/node_modules/puppeteer");
const path=require("path");const{pathToFileURL}=require("url");
const dir="C:/Users/Rominick/Desktop/TFI_NEW/design";
(async()=>{
 const browser=await puppeteer.launch({headless:true,args:["--no-sandbox","--disable-setuid-sandbox","--allow-file-access-from-files"]});
 const page=await browser.newPage();const errors=[];page.on("pageerror",e=>errors.push(e.message));
 await page.setViewport({width:1440,height:1000});
 await page.evaluateOnNewDocument(()=>{window.fetch=async()=>new Response(JSON.stringify({batches:[],total:0}),{status:200,headers:{"Content-Type":"application/json"}});});
 const q=new URLSearchParams({targetModule:"dmr-production",targetLabel:"DMR Production",sourceWorksheet:"DMR Production",sourceSheetId:"2048043346",sourceName:"UI test workbook",sourceType:"google_sheets",batchId:"UI-TEST",from:"central-inbox"});
 await page.goto(pathToFileURL(path.join(dir,"module-import-inbox-preview.html")).href+"?"+q.toString(),{waitUntil:"load"});
 const initial=await page.evaluate(()=>({
  title:document.querySelector("#page-title").textContent,
  module:document.querySelector("#module-select").value,
  label:document.querySelector("#module-select option:checked").textContent,
  worksheet:document.querySelector("#source-worksheet").textContent,
  sheetId:document.querySelector("#source-sheet-id").textContent,
  moduleOptions:document.querySelectorAll("#module-select option").length,
  empty:document.querySelector("#inbox-rows").innerText,
  metrics:[...document.querySelectorAll(".metric-value")].map(x=>x.textContent.trim()),
  navActive:document.querySelector(".nav-link.active")?.dataset.page||null
 }));
 await page.select("#module-select","oee");
 const switched=await page.evaluate(()=>({module:document.querySelector("#module-select").value,worksheet:document.querySelector("#source-worksheet").textContent,sheetId:document.querySelector("#source-sheet-id").textContent,urlModule:new URLSearchParams(location.search).get("targetModule"),scope:document.querySelector("#scope-chip").textContent,sourceName:new URLSearchParams(location.search).get("sourceName"),batchId:new URLSearchParams(location.search).get("batchId")}));
 await page.click('[data-filter="incomplete"]');
 const filter=await page.evaluate(()=>({active:document.querySelector(".tab.active")?.dataset.filter,empty:document.querySelector("#inbox-rows").innerText}));
 await page.type("#record-search","nonexistent");
 const search=await page.evaluate(()=>document.querySelector("#visible-count").textContent);
 await page.setViewport({width:390,height:844});
 const mobile=await page.evaluate(()=>({width:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth,tableWidth:document.querySelector(".table-wrap").scrollWidth,overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth}));
 await page.setViewport({width:1440,height:1000});
 await page.click("#new-import");
 await page.waitForFunction(()=>location.pathname.endsWith("spreadsheet-import-center-preview.html"),{timeout:10000});
 const importCenter=await page.evaluate(()=>({target:document.querySelector("#target-module")?.value||null,url:new URLSearchParams(location.search).get("targetModule")}));
 await page.goto(pathToFileURL(path.join(dir,"module-import-inbox-preview.html")).href+"?"+q.toString(),{waitUntil:"load"});
 await page.click("#back-batch");
 await page.waitForFunction(()=>location.pathname.endsWith("central-import-inbox-preview.html"),{timeout:10000});
 const back=await page.evaluate(()=>({module:new URLSearchParams(location.search).get("targetModule"),label:new URLSearchParams(location.search).get("targetLabel"),from:new URLSearchParams(location.search).get("from")}));
 await browser.close();
 const checks={
  correctTitle:initial.title==="Module Import Inbox",
  correctInitialModule:initial.module==="dmr-production"&&initial.label==="DMR Production",
  correctSourceMapping:initial.worksheet==="DMR Production"&&initial.sheetId==="2048043346",
  moduleInboxNavActive:initial.navActive==="Module Import Inbox",
  fifteenDestinations:initial.moduleOptions===16,
  noFabricatedTransactions:initial.metrics.every(x=>x==="0")&&initial.empty.includes("No staged records"),
  moduleSwitchUpdatesMapping:switched.module==="oee"&&switched.worksheet==="OEE"&&switched.sheetId==="1750442014"&&switched.urlModule==="oee",
  moduleSwitchClearsOldBatchContext:switched.sourceName===null&&switched.batchId===null,
  statusTabsWork:filter.active==="incomplete",
  searchUpdatesEmptyState:search.includes("No records loaded"),
  mobileNoPageOverflow:!mobile.overflow,
  newImportCarriesModule:importCenter.url==="oee",
  backToBatchPreservesModule:back.module==="dmr-production"&&back.label==="DMR Production"&&back.from==="module-inbox",
  noBrowserErrors:errors.length===0
 };
 console.log(JSON.stringify({initial,switched,filter,search,mobile,importCenter,back,errors,checks,pass:Object.values(checks).every(Boolean)},null,2));
 if(!Object.values(checks).every(Boolean))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
