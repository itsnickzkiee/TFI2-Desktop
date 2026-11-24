const puppeteer=require("C:/Users/Rominick/AppData/Local/npm-cache/_npx/4b4c857f6efdfb61/node_modules/puppeteer");
const path=require("path");const http=require("node:http");const fs=require("node:fs");const dir="C:/Users/Rominick/Desktop/TFI_NEW/design";
const expected=["Date","Removed because","Old Product Code (text)","No. of Batches","Target","Produced","UOM","Plan Start","Actual Start","Plan End","Actual End (Prod)","Actual End (Cleaning)","Man Reqmt","Present","OT Hrs","Remarks","Source Tab","Check"];
const workbookId="1hWOI55iRBSltQnRY4S7eObnMBLstFYCPxiAp-l1UUfc";
const workbookUrl="https://docs.google.com/spreadsheets/d/"+workbookId+"/edit?gid=1842536867";
let browser, server;
(async()=>{
 server=http.createServer((req,res)=>{
  const route=new URL(req.url,"http://localhost").pathname;
  if(route==="/favicon.ico"){res.statusCode=204;return res.end();}
  if(route.startsWith("/api/")){
   res.setHeader("Content-Type","application/json");
   return res.end(JSON.stringify({records:[],summary:{saved_rows:0},modules:[],options:{}}));
  }
  const target=path.resolve(dir,"."+route);
  if(!target.startsWith(dir.replaceAll("/",path.sep)+path.sep)||!fs.existsSync(target)||!fs.statSync(target).isFile()){
   res.statusCode=404;return res.end();
  }
  res.setHeader("Content-Type",({".js":"text/javascript",".css":"text/css",".html":"text/html; charset=utf-8"})[path.extname(target)]||"application/octet-stream");
  fs.createReadStream(target).pipe(res);
 });
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 const dashboard="http://127.0.0.1:"+server.address().port+"/dashboard-preview.html";
 browser=await puppeteer.launch({headless:true,args:["--no-sandbox","--disable-setuid-sandbox","--allow-file-access-from-files"]});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[],failed=[];
 page.on("pageerror",e=>errors.push(e.message));
 page.on("console",m=>{if(m.type()==="error")errors.push(m.text())});
 page.on("requestfailed",r=>failed.push(r.url()+" :: "+r.failure()?.errorText));
 await page.goto(dashboard+"?module=Removed%20Rows",{waitUntil:"load"});
 async function active(file){
   await page.waitForFunction(f=>{const x=document.querySelector(".tfi-module-frame.is-active");return !!x&&x.dataset.loadEventSeen==="true"&&(x.getAttribute("src")||"").includes(f)},{timeout:12000},file);
   return page.frames().find(frame => frame.url().includes("/"+file+"?"));
 }
 let frame=await active("removed-rows-preview.html");
 await frame.waitForFunction(()=>document.body.dataset.tfiReady==="true",{timeout:12000});
 const base=await frame.evaluate(expected=>{
  const headers=[...document.querySelectorAll("#rm-table thead th button")].map(x=>x.childNodes[0].textContent.trim());
  return {
   ready:document.body.dataset.tfiReady,report:document.body.dataset.tfiReport,
   sheetId:document.body.dataset.tfiSourceSheetId,columns:Number(document.body.dataset.tfiColumns),
   titleRow:Number(document.body.dataset.tfiTitleRow),headerRow:Number(document.body.dataset.tfiHeaderRow),
   firstDataRow:Number(document.body.dataset.tfiFirstDataRow),frozenRows:Number(document.body.dataset.tfiFrozenRows),
   inspectedRange:document.body.dataset.tfiInspectedSourceRange,
   headers,headersMatch:JSON.stringify(headers)===JSON.stringify(expected),
   emptyState:!!document.querySelector("#rm-tbody .rr-empty-state"),
   sampleRows:document.querySelectorAll("#rm-tbody tr:not(:has(.rr-empty-state))").length,
   tabs:[...document.querySelectorAll("[data-report-page]")].map(x=>x.dataset.reportPage),
   adminImport:!!document.querySelector("#rm-import-open"),
   archiveOnly:document.body.dataset.tfiArchiveOnly
  };
 },expected);
 await frame.click("#rm-import-open");
 const modalOpen=await frame.$eval("#rm-import-modal",e=>e.classList.contains("open"));
 const sourceLink=await frame.$eval("#rm-workbook-link",e=>e.href);
 await frame.click("#rm-modal-dismiss");
 const modalClosed=await frame.$eval("#rm-import-modal",e=>!e.classList.contains("open"));
 await frame.click('[data-rm-sort="date"]');
 const sort=await frame.$eval('[data-rm-sort="date"]',e=>e.closest("th").getAttribute("aria-sort"));
 await frame.type("#rm-reason","Pandayan");
 const filtered=await frame.evaluate(()=>document.body.dataset.tfiFilterState);
 await frame.click("#rm-reset");
 const reset=await frame.evaluate(()=>document.body.dataset.tfiFilterState==="clear"&&document.querySelector("#rm-reason").value==="");
 
 await frame.evaluate(()=>document.querySelector('[data-report-page="Schedule Summary"]').click());
 frame=await active("schedule-summary-preview.html");
 await frame.waitForFunction(()=>document.body.dataset.tfiReady==="true");
 const scheduleTabs=await frame.$$eval("[data-report-page]",xs=>xs.length);
 await frame.evaluate(()=>document.querySelector('[data-report-page="Summary"]').click());
 frame=await active("summary-preview.html");
 await frame.waitForFunction(()=>document.body.dataset.tfiReady==="true");
 const summaryTabs=await frame.$$eval("[data-report-page]",xs=>xs.length);
 await frame.evaluate(()=>document.querySelector('[data-report-page="Removed Rows"]').click());
 frame=await active("removed-rows-preview.html");
 await frame.waitForFunction(()=>document.body.dataset.tfiReady==="true");
 const finalActive=await page.evaluate(()=>({module:document.querySelector(".tfi-module-frame.is-active")?.dataset.loadedModule,sidebar:document.querySelector(".sidebar .nav-link.active")?.dataset.page}));
 await page.setViewport({width:390,height:844});
 const mobile=await frame.evaluate(()=>({
  viewport:document.documentElement.clientWidth,pageWidth:document.documentElement.scrollWidth,
  tabColumns:getComputedStyle(document.querySelector(".rr-report-tabs")).gridTemplateColumns.split(" ").length,
  noPageOverflow:document.documentElement.scrollWidth<=document.documentElement.clientWidth,
  tabCount:document.querySelectorAll("[data-report-page]").length,
  tableScroll:document.querySelector(".rm-table-scroll").scrollWidth>document.querySelector(".rm-table-scroll").clientWidth
 }));
 
 const reportsPage=await browser.newPage({viewport:{width:1440,height:1000}});
 await reportsPage.goto(dashboard+"?module=Reports",{waitUntil:"load"});
 await reportsPage.waitForFunction(()=>{const x=document.querySelector(".tfi-module-frame.is-active");return !!x&&(x.getAttribute("src")||"").includes("reports-reconciliation-preview.html")},{timeout:12000});
 const reportsFrame=await (await reportsPage.$(".tfi-module-frame.is-active")).contentFrame();
 await reportsFrame.waitForFunction(()=>document.body.dataset.tfiReady==="true");
 const productionTabs=await reportsFrame.$$eval("[data-report-page]",xs=>xs.length);
 await reportsPage.close();
 const result={base,modal:{open:modalOpen,sourceLink,closed:modalClosed},interactions:{sort,filtered,reset},navigation:{productionTabs,scheduleTabs,summaryTabs,finalActive},mobile,browserErrors:errors,failedRequests:failed.filter(x=>!x.includes("ERR_ABORTED"))};
 const pass=base.ready==="true"&&base.report==="removed-rows"&&base.sheetId==="1842536867"&&base.columns===18&&base.titleRow===1&&base.headerRow===3&&base.firstDataRow===4&&base.frozenRows===3&&base.headersMatch&&base.emptyState&&base.sampleRows===0&&base.tabs.length===4&&base.tabs.includes("Removed Rows")&&base.archiveOnly==="true"&&modalOpen&&sourceLink===workbookUrl&&modalClosed&&sort==="ascending"&&filtered==="active"&&reset&&productionTabs===4&&scheduleTabs===4&&summaryTabs===4&&finalActive.module==="Removed Rows"&&finalActive.sidebar==="Reports"&&mobile.noPageOverflow&&mobile.tabCount===4&&mobile.tabColumns===4&&mobile.tableScroll&&errors.length===0&&failed.filter(x=>!x.includes("ERR_ABORTED")).length===0;
 result.pass=pass;console.log(JSON.stringify(result,null,2));await browser.close();if(!pass)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();if(server)server.close();});