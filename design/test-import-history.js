const puppeteer=require("C:/Users/Rominick/AppData/Local/npm-cache/_npx/4b4c857f6efdfb61/node_modules/puppeteer");const path=require("path");const{pathToFileURL}=require("url");const dir="C:/Users/Rominick/Desktop/TFI_NEW/design";
(async()=>{
 const b=await puppeteer.launch({headless:true,args:["--no-sandbox","--disable-setuid-sandbox","--allow-file-access-from-files"]});
 const errors=[];const p=await b.newPage();p.on("pageerror",e=>errors.push(e.message));await p.setViewport({width:1440,height:950});
 await p.goto(pathToFileURL(path.join(dir,"import-history-preview.html")).href,{waitUntil:"load"});
 const initial=await p.evaluate(()=>({title:document.title,active:document.querySelector(".nav-link.active")?.dataset.page,metrics:[...document.querySelectorAll(".metric-value")].map(x=>x.textContent.trim()),rowCount:document.querySelectorAll("#history-rows tr").length,empty:document.querySelector(".history-empty")?.innerText,readOnly:document.querySelector(".pill")?.innerText,note:document.querySelector(".preview-note")?.innerText,staticPageControls:!!document.querySelector(".page-btn"),scrollWidth:document.documentElement.scrollWidth,viewport:innerWidth}));
 await p.click('.tab[data-filter="completed"]');const statusFilter=await p.evaluate(()=>({active:document.querySelector(".tab.active")?.dataset.filter,rows:document.querySelectorAll("#history-rows tr").length}));
 await p.click('.tab[data-filter="failed"]');await p.type("#batch-search","unknown");await p.select("#period-filter","week");const searchFilter=await p.evaluate(()=>({active:document.querySelector(".tab.active")?.dataset.filter,rows:document.querySelectorAll("#history-rows tr").length,search:document.querySelector("#batch-search").value,period:document.querySelector("#period-filter").value}));
 await p.click("#empty-new-import");await p.waitForFunction(()=>location.pathname.endsWith("spreadsheet-import-center-preview.html"),{timeout:8000});const directNewImport=await p.evaluate(()=>location.pathname.split("/").pop());
 const mobile=await b.newPage();mobile.on("pageerror",e=>errors.push(e.message));await mobile.setViewport({width:390,height:844});await mobile.goto(pathToFileURL(path.join(dir,"import-history-preview.html")).href,{waitUntil:"load"});const mobileCheck=await mobile.evaluate(()=>({width:document.documentElement.scrollWidth,viewport:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,emptyHeight:document.querySelector(".history-empty")?.getBoundingClientRect().height}));
 const stageChecks=[];
 for(const [source,file] of [["Spreadsheet Import","spreadsheet-import-center-preview.html"],["Scan Progress","scan-progress-worksheet-detection-preview.html"],["Central Import Inbox","central-import-inbox-preview.html"]]){
  const stage=await b.newPage();stage.on("pageerror",e=>errors.push(e.message));await stage.setViewport({width:1440,height:950});await stage.goto(pathToFileURL(path.join(dir,file)).href,{waitUntil:"load"});
  await stage.waitForSelector('.sidebar .nav-link[data-page="Import History"]',{timeout:5000});
  await stage.click('.sidebar .nav-link[data-page="Import History"]');
  await stage.waitForFunction(()=>document.querySelector(".sidebar .nav-link.active")?.dataset.page==="Import History"&&[...document.querySelectorAll(".tfi-module-frame")].some(f=>f.classList.contains("is-active")&&f.src.includes("import-history-preview.html")),{timeout:10000});
  const child=stage.frames().find(f=>f.url().includes("import-history-preview.html"));
  const state=await child.evaluate(()=>({title:document.title,empty:!!document.querySelector(".history-empty")}));
  stageChecks.push({source,state,passed:state.title==="TFI | Import History"&&state.empty});await stage.close();
 }
 const shell=await b.newPage();shell.on("pageerror",e=>errors.push(e.message));await shell.setViewport({width:1440,height:950});await shell.goto(pathToFileURL(path.join(dir,"dashboard-preview.html")).href,{waitUntil:"load"});
 await shell.click('.sidebar .nav-link[data-page="Import History"]');
 await shell.waitForFunction(()=>document.querySelector(".sidebar .nav-link.active")?.dataset.page==="Import History"&&[...document.querySelectorAll(".tfi-module-frame")].some(f=>f.classList.contains("is-active")&&f.src.includes("import-history-preview.html")),{timeout:10000});
 const child=shell.frames().find(f=>f.url().includes("import-history-preview.html"));await child.click("#new-import");
 await shell.waitForFunction(()=>document.querySelector(".sidebar .nav-link.active")?.dataset.page==="Spreadsheet Import"&&[...document.querySelectorAll(".tfi-module-frame")].some(f=>f.classList.contains("is-active")&&f.src.includes("spreadsheet-import-center-preview.html")),{timeout:10000});
 const embeddedNewImport=await shell.evaluate(()=>({active:document.querySelector(".sidebar .nav-link.active")?.dataset.page,frame:[...document.querySelectorAll(".tfi-module-frame")].find(f=>f.classList.contains("is-active"))?.src.split("/").pop().split("?")[0]}));
 await shell.goBack();await shell.waitForFunction(()=>document.querySelector(".sidebar .nav-link.active")?.dataset.page==="Import History"&&[...document.querySelectorAll(".tfi-module-frame")].some(f=>f.classList.contains("is-active")&&f.src.includes("import-history-preview.html")),{timeout:10000});
 const browserBack=await shell.evaluate(()=>({active:document.querySelector(".sidebar .nav-link.active")?.dataset.page,frame:[...document.querySelectorAll(".tfi-module-frame")].find(f=>f.classList.contains("is-active"))?.src.split("/").pop().split("?")[0]}));
 const checks={
  correctPageAndEmptyState:initial.title==="TFI | Import History"&&initial.active==="Import History"&&initial.rowCount===1&&initial.empty.includes("No import batches recorded yet"),
  noFabricatedMetrics:initial.metrics.every(v=>v==="—"),
  readOnlyProtectionVisible:initial.readOnly==="Read-only history"&&initial.note.includes("does not modify operational records"),
  noFakePagination:!initial.staticPageControls,
  filtersRemainResponsive:statusFilter.active==="completed"&&searchFilter.active==="failed"&&searchFilter.search==="unknown"&&searchFilter.period==="week",
  directNewImportWorks:directNewImport==="spreadsheet-import-center-preview.html",
  mobileFits:!mobileCheck.overflow&&mobileCheck.emptyHeight>150,
  historyAccessibleFromImportStages:stageChecks.length===3&&stageChecks.every(x=>x.passed),
  embeddedNewImportKeepsShell:embeddedNewImport.active==="Spreadsheet Import"&&embeddedNewImport.frame==="spreadsheet-import-center-preview.html",
  browserBackRestoresHistory:browserBack.active==="Import History"&&browserBack.frame==="import-history-preview.html",
  noBrowserErrors:errors.length===0
 };
 console.log(JSON.stringify({initial,statusFilter,searchFilter,directNewImport,mobileCheck,stageChecks,embeddedNewImport,browserBack,errors,checks,pass:Object.values(checks).every(Boolean)},null,2));
 await b.close();if(!Object.values(checks).every(Boolean))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});