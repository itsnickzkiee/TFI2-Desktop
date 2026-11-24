const puppeteer=require("C:/Users/Rominick/AppData/Local/npm-cache/_npx/4b4c857f6efdfb61/node_modules/puppeteer");
const path=require("path");const{pathToFileURL}=require("url");const dir="C:/Users/Rominick/Desktop/TFI_NEW/design";
const modules=[
 ["product-entry-preview.html","product-entry","Product Entry","Product Entry","545274882"],
 ["production-entry-preview.html","production-entry","Production Entry","Production Entry","1923467491"],
 ["production-schedule-preview.html","production-schedule","Production Schedule","Production Schedule","1538651320"],
 ["dmp-production-preview.html","dmp-production","DMP Production","DMP - Production","1312335050"],
 ["dmr-production-preview.html","dmr-production","DMR Production","DMR Production","2048043346"],
 ["dmr-coding-preview.html","dmr-coding","DMR Coding","DMR Coding","675328096"],
 ["hourly-meat-preview.html","hourly-meat","Hourly Meat","Hourly Meat","428082343"],
 ["hourly-coding-preview.html","hourly-coding","Hourly Coding","Hourly Coding","1916766220"],
 ["hourly-agri-preview.html","hourly-agri","Hourly Agri","Hourly Agri","534145404"],
 ["oee-preview.html","oee","OEE","OEE","1750442014"],
 ["productivity-preview.html","productivity","Productivity","Productivity","1688444278"],
 ["coding-dpr-preview.html","coding-dpr","Coding DPR","Coding DPR","1266086431"],
 ["co-qa-preview.html","co-qa","CO QA","co QA","1359678099"],
 ["non-prod-preview.html","non-prod","NON-PROD","NON-PROD","1381857831"],
 ["pr-monitoring-preview.html","pr-monitoring","PR Monitoring","PR MONITORING","867256143"]
];
(async()=>{
 const browser=await puppeteer.launch({headless:true,args:["--no-sandbox","--disable-setuid-sandbox","--allow-file-access-from-files"]});
 const page=await browser.newPage();const errors=[];page.on("pageerror",e=>errors.push(e.message));
 await page.setViewport({width:1440,height:950});
 const direct=[];
 for(const [file,value,label,sheet,sheetId] of modules){
  await page.goto(pathToFileURL(path.join(dir,file)).href,{waitUntil:"load"});
  await page.waitForSelector("#tfi-module-inbox-shortcut",{timeout:5000});
  const button=await page.evaluate(()=>({text:document.querySelector("#tfi-module-inbox-shortcut").innerText.trim(),title:document.querySelector("#tfi-module-inbox-shortcut").title,insideActions:!!document.querySelector(".tfi-topbar-actions #tfi-module-inbox-shortcut")}));
  await page.click("#tfi-module-inbox-shortcut");
  await page.waitForFunction(()=>location.pathname.endsWith("module-import-inbox-preview.html"),{timeout:8000});
  const inbox=await page.evaluate(()=>({module:new URLSearchParams(location.search).get("targetModule"),label:new URLSearchParams(location.search).get("targetLabel"),sheet:new URLSearchParams(location.search).get("sourceWorksheet"),sheetId:new URLSearchParams(location.search).get("sourceSheetId"),from:new URLSearchParams(location.search).get("from"),back:document.querySelector("#back-batch").innerText.trim()}));
  const expected={module:value,label,sheet,sheetId,from:"module-page",back:"Back to "+label};
  const passed=button.text==="Import Inbox"&&button.insideActions&&Object.keys(expected).every(k=>inbox[k]===expected[k]);
  direct.push({file,button,inbox,passed});
  await page.click("#back-batch");
  await page.waitForFunction(()=>!location.pathname.endsWith("module-import-inbox-preview.html"),{timeout:8000});
  const returned=await page.evaluate(()=>location.pathname.split("/").pop());
  direct[direct.length-1].returned=returned;
  direct[direct.length-1].passed=passed&&returned===file;
 }
 const mobile=await browser.newPage();await mobile.setViewport({width:390,height:844});await mobile.goto(pathToFileURL(path.join(dir,"dmr-production-preview.html")).href,{waitUntil:"load"});const mobileCheck=await mobile.evaluate(()=>({button:!!document.querySelector("#tfi-module-inbox-shortcut"),buttonWidth:document.querySelector("#tfi-module-inbox-shortcut")?.getBoundingClientRect().width,scrollWidth:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth,overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth,buttonTextVisible:getComputedStyle(document.querySelector("#tfi-module-inbox-shortcut span")).display!=="none"}));
 const shell=await browser.newPage();const shellErrors=[];shell.on("pageerror",e=>shellErrors.push(e.message));await shell.setViewport({width:1440,height:950});await shell.goto(pathToFileURL(path.join(dir,"dashboard-preview.html")).href,{waitUntil:"load"});await shell.waitForSelector('.sidebar .nav-link[data-page="DMR Production"]');await shell.click('.sidebar .nav-link[data-page="DMR Production"]');await shell.waitForFunction(()=>document.querySelector(".sidebar .nav-link.active")?.dataset.page==="DMR Production"&&[...document.querySelectorAll(".tfi-module-frame")].some(f=>f.classList.contains("is-active")&&f.src.includes("dmr-production-preview.html")),{timeout:10000});let child=shell.frames().find(f=>f.url().includes("dmr-production-preview.html"));if(!child)throw new Error("DMR Production iframe not found");await child.waitForSelector("#tfi-module-inbox-shortcut",{timeout:5000});await child.click("#tfi-module-inbox-shortcut");await shell.waitForFunction(()=>document.querySelector(".sidebar .nav-link.active")?.dataset.page==="Module Import Inbox"&&[...document.querySelectorAll(".tfi-module-frame")].some(f=>f.classList.contains("is-active")&&f.src.includes("module-import-inbox-preview.html")&&f.src.includes("targetModule=dmr-production")&&f.src.includes("from=module-page")),{timeout:10000});let inboxFrame=shell.frames().find(f=>f.url().includes("module-import-inbox-preview.html"));const embeddedInbox=await inboxFrame.evaluate(()=>({module:document.querySelector("#module-select").value,worksheet:document.querySelector("#source-worksheet").textContent,sheetId:document.querySelector("#source-sheet-id").textContent,back:document.querySelector("#back-batch").innerText.trim()}));await inboxFrame.click("#back-batch");await shell.waitForFunction(()=>document.querySelector(".sidebar .nav-link.active")?.dataset.page==="DMR Production"&&[...document.querySelectorAll(".tfi-module-frame")].some(f=>f.classList.contains("is-active")&&f.src.includes("dmr-production-preview.html")),{timeout:10000});const returnedToModule=await shell.evaluate(()=>({active:document.querySelector(".sidebar .nav-link.active")?.dataset.page,urlModule:new URLSearchParams(location.search).get("module"),staleContext:new URLSearchParams(location.search).has("targetModule")}));
 await shell.goBack();await shell.waitForFunction(()=>document.querySelector(".sidebar .nav-link.active")?.dataset.page==="Module Import Inbox"&&[...document.querySelectorAll(".tfi-module-frame")].some(f=>f.classList.contains("is-active")&&f.src.includes("module-import-inbox-preview.html")&&f.src.includes("targetModule=dmr-production")),{timeout:10000});
 const browserBack=await shell.evaluate(()=>({active:document.querySelector(".sidebar .nav-link.active")?.dataset.page,urlTarget:new URLSearchParams(location.search).get("targetModule"),urlFrom:new URLSearchParams(location.search).get("from")}));
 const checks={
  all15ModuleShortcutsPresent:direct.length===15&&direct.every(x=>x.passed),
  eachShortcutReturnsToOrigin:direct.every(x=>x.returned===x.file),
  mobileShortcutFits:mobileCheck.button&&mobileCheck.buttonWidth===36&&!mobileCheck.overflow&&!mobileCheck.buttonTextVisible,
  embeddedShortcutOpensCorrectInbox:embeddedInbox.module==="dmr-production"&&embeddedInbox.worksheet==="DMR Production"&&embeddedInbox.sheetId==="2048043346"&&embeddedInbox.back==="Back to DMR Production",
  embeddedBackReturnsToOrigin:returnedToModule.active==="DMR Production"&&returnedToModule.urlModule==="DMR Production"&&!returnedToModule.staleContext,
  browserBackRestoresInboxContext:browserBack.active==="Module Import Inbox"&&browserBack.urlTarget==="dmr-production"&&browserBack.urlFrom==="module-page",
  noBrowserErrors:errors.length===0&&shellErrors.length===0
 };
 await browser.close();
 console.log(JSON.stringify({direct,mobileCheck,embeddedInbox,returnedToModule,browserBack,errors,shellErrors,checks,pass:Object.values(checks).every(Boolean)},null,2));
 if(!Object.values(checks).every(Boolean))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
