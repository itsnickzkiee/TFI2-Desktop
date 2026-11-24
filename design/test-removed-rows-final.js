const puppeteer=require("C:/Users/Rominick/AppData/Local/npm-cache/_npx/4b4c857f6efdfb61/node_modules/puppeteer");
const path=require("path");const{pathToFileURL}=require("url");const dir="C:/Users/Rominick/Desktop/TFI_NEW/design";
const expected=["Date","Removed because","Old Product Code (text)","No. of Batches","Target","Produced","UOM","Plan Start","Actual Start","Plan End","Actual End (Prod)","Actual End (Cleaning)","Man Reqmt","Present","OT Hrs","Remarks","Source Tab","Check"];
const workbookId="1hWOI55iRBSltQnRY4S7eObnMBLstFYCPxiAp-l1UUfc";
const workbookUrl="https://docs.google.com/spreadsheets/d/"+workbookId+"/edit?gid=1842536867";
(async()=>{
 const browser=await puppeteer.launch({headless:true,args:["--no-sandbox","--disable-setuid-sandbox","--allow-file-access-from-files"]});
 const errors=[],failed=[];
 function watch(page){page.on("pageerror",e=>errors.push(e.message));page.on("console",m=>{if(m.type()==="error")errors.push(m.text())});page.on("requestfailed",r=>failed.push(r.url()+" :: "+r.failure()?.errorText));}
 async function openModule(module,file){
  const p=await browser.newPage({viewport:{width:1440,height:1000}});watch(p);
 await p.evaluateOnNewDocument(()=>{
  const original=window.fetch.bind(window);
  window.fetch=(url,opts)=>String(url).startsWith("/api/")?
    Promise.resolve({ok:true,status:200,json:async()=>({records:[],summary:{saved_rows:0},modules:[],options:{}})}):
    original(url,opts);
 });
  await p.goto(pathToFileURL(path.join(dir,"dashboard-preview.html")).href+"?module="+encodeURIComponent(module),{waitUntil:"load"});
  await p.waitForFunction(f=>{const x=document.querySelector(".tfi-module-frame.is-active");return !!x&&(x.getAttribute("src")||"").includes(f)},{timeout:12000},file);
  const f=await (await p.$(".tfi-module-frame.is-active")).contentFrame();
  await f.waitForFunction(()=>document.body.dataset.tfiReady==="true",{timeout:12000});
  return {page:p,frame:f};
 }
 const {page,frame}=await openModule("Removed Rows","removed-rows-preview.html");
 const base=await frame.evaluate(expected=>{
  const headers=[...document.querySelectorAll("#rm-table thead th button")].map(x=>x.childNodes[0].textContent.trim());
  return {report:document.body.dataset.tfiReport,sheetId:document.body.dataset.tfiSourceSheetId,columns:Number(document.body.dataset.tfiColumns),titleRow:Number(document.body.dataset.tfiTitleRow),headerRow:Number(document.body.dataset.tfiHeaderRow),firstDataRow:Number(document.body.dataset.tfiFirstDataRow),frozenRows:Number(document.body.dataset.tfiFrozenRows),headersMatch:JSON.stringify(headers)===JSON.stringify(expected),headers,emptyState:!!document.querySelector("#rm-tbody .rr-empty-state"),sampleRows:document.querySelectorAll("#rm-tbody tr:not(:has(.rr-empty-state))").length,tabs:[...document.querySelectorAll("[data-report-page]")].map(x=>x.dataset.reportPage),archiveOnly:document.body.dataset.tfiArchiveOnly};
 },expected);
 await frame.click("#rm-import-open");
 const modalOpen=await frame.$eval("#rm-import-modal",e=>e.classList.contains("open"));
 const sourceLink=await frame.$eval("#rm-workbook-link",e=>e.href);
 await frame.click("#rm-modal-dismiss");const modalClosed=await frame.$eval("#rm-import-modal",e=>!e.classList.contains("open"));
 await frame.click('[data-rm-sort="date"]');const sort=await frame.$eval('[data-rm-sort="date"]',e=>e.closest("th").getAttribute("aria-sort"));
 await frame.type("#rm-reason","Pandayan");const filtered=await frame.evaluate(()=>document.body.dataset.tfiFilterState);
 await frame.click("#rm-reset");const reset=await frame.evaluate(()=>document.body.dataset.tfiFilterState==="clear"&&document.querySelector("#rm-reason").value==="");
 
 await page.setViewport({width:390,height:844});
 const mobile=await frame.evaluate(()=>({viewport:document.documentElement.clientWidth,pageWidth:document.documentElement.scrollWidth,noPageOverflow:document.documentElement.scrollWidth<=document.documentElement.clientWidth,tabColumns:getComputedStyle(document.querySelector(".rr-report-tabs")).gridTemplateColumns.split(" ").length,tabCount:document.querySelectorAll("[data-report-page]").length,tableScroll:document.querySelector(".rm-table-scroll").scrollWidth>document.querySelector(".rm-table-scroll").clientWidth}));
 
 await frame.click("#rm-import-open");
 const report=await openModule("Reports","reports-reconciliation-preview.html");
 const productionTabs=await report.frame.$$eval("[data-report-page]",xs=>xs.length);
 const schedule=await openModule("Schedule Summary","schedule-summary-preview.html");
 const scheduleTabs=await schedule.frame.$$eval("[data-report-page]",xs=>xs.length);
 const summary=await openModule("Summary","summary-preview.html");
 const summaryTabs=await summary.frame.$$eval("[data-report-page]",xs=>xs.length);
 await summary.frame.evaluate(()=>document.querySelector('[data-report-page="Removed Rows"]').click());
 await summary.page.waitForFunction(()=>{const x=document.querySelector(".tfi-module-frame.is-active");return !!x&&(x.getAttribute("src")||"").includes("removed-rows-preview.html")},{timeout:12000});
 const summaryToRemoved=await summary.page.evaluate(()=>document.querySelector(".tfi-module-frame.is-active")?.dataset.loadedModule==="Removed Rows");
 const result={base,modal:{open:modalOpen,sourceLink,closed:modalClosed},interactions:{sort,filtered,reset},navigation:{productionTabs,scheduleTabs,summaryTabs,summaryToRemoved},mobile,browserErrors:errors,failedRequests:failed.filter(x=>!x.includes("ERR_ABORTED"))};
 const pass=base.report==="removed-rows"&&base.sheetId==="1842536867"&&base.columns===18&&base.titleRow===1&&base.headerRow===3&&base.firstDataRow===4&&base.frozenRows===3&&base.headersMatch&&base.emptyState&&base.sampleRows===0&&base.tabs.length===4&&base.archiveOnly==="true"&&modalOpen&&sourceLink===workbookUrl&&modalClosed&&sort==="ascending"&&filtered==="active"&&reset&&productionTabs===4&&scheduleTabs===4&&summaryTabs===4&&summaryToRemoved&&mobile.noPageOverflow&&mobile.tabColumns===4&&mobile.tabCount===4&&mobile.tableScroll&&errors.length===0&&result.failedRequests.length===0;
 result.pass=pass;console.log(JSON.stringify(result,null,2));
 await browser.close();if(!pass)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});