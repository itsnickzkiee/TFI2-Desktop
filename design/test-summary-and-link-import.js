const puppeteer=require("C:/Users/Rominick/AppData/Local/npm-cache/_npx/4b4c857f6efdfb61/node_modules/puppeteer");
const path=require("path");const{pathToFileURL}=require("url");const dir="C:/Users/Rominick/Desktop/TFI_NEW/design";
const expectedHeaders=["Date produce","Product code","Can Size","PR#","No. of Batches","Total FG","Dented","False seam","Flipper","Bulged","Panel","Buckling","Retention","Q.A Samples","Dented/ Curl","Teardown","From Underweight","Rusty","Teardown","Dented from seamer","Dented from filler","Underweight","Dented flange (SD)","Can wshr/ Palletizer (SD)/ Dented Body/Rusty","%Lids Reject","% Empty Can Reject","%Dented","%False seam","%Flipper","%Bulged","%Panel","%Buckling"];
const workbookId="1rCbQ16wj7MRjQCFF3tA-WEMkudraJK0RkwcqayUlz7k";
const workbookUrl="https://docs.google.com/spreadsheets/d/"+workbookId+"/edit?gid=1639151211";
(async()=>{
 const browser=await puppeteer.launch({headless:true,args:["--no-sandbox","--disable-setuid-sandbox","--allow-file-access-from-files"]});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[],failed=[];
 page.on("pageerror",e=>errors.push(e.message));
 page.on("console",m=>{if(m.type()==="error")errors.push(m.text())});
 page.on("requestfailed",r=>failed.push(r.url()+" :: "+r.failure()?.errorText));
 await page.evaluateOnNewDocument(()=>{
   const realFetch=window.fetch.bind(window);
   window.fetch=(url, options)=>String(url).startsWith("/api/")
     ? Promise.resolve({ok:true,status:200,json:async()=>({records:[],total:0,summary:{saved_rows:0},catalog:{}})})
     : realFetch(url, options);
 });
 await page.goto(pathToFileURL(path.join(dir,"dashboard-preview.html")).href+"?module=Summary",{waitUntil:"load"});
 async function activeFrameContains(file){
   await page.waitForFunction(file=>{const f=document.querySelector(".tfi-module-frame.is-active");return !!f&&(f.getAttribute("src")||"").includes(file)}, {timeout:10000}, file);
   return [...page.frames()].find(f=>f.url().includes(file));
 }
 let frame=await activeFrameContains("summary-preview.html");
 await frame.waitForFunction(()=>document.body.dataset.tfiReady==="true",{timeout:10000});
 const summary=await frame.evaluate(expected=>{
   const headers=[...document.querySelectorAll(".sum-column-row th")].map(th=>th.querySelector("button").childNodes[0].textContent.trim());
   const spans=row=>[...document.querySelectorAll(row+" th")].reduce((a,x)=>a+Number(x.getAttribute("colspan")||1),0);
   return {
    ready:document.body.dataset.tfiReady,report:document.body.dataset.tfiReport,
    sheetId:document.body.dataset.tfiSourceSheetId,columns:Number(document.body.dataset.tfiColumns),
    headerRows:document.body.dataset.tfiHeaderRows,firstDataRow:Number(document.body.dataset.tfiFirstDataRow),
    frozenRows:Number(document.body.dataset.tfiFrozenRows),formulaSource:document.body.dataset.tfiFormulaSource,
    headers,headersMatch:JSON.stringify(headers)===JSON.stringify(expected),
    groupSpan:spans(".sum-group-row"),subgroupSpan:spans(".sum-subgroup-row"),
    emptyState:!!document.querySelector("#sum-tbody .rr-empty-state"),
    sampleRows:document.querySelectorAll("#sum-tbody tr:not(:has(.rr-empty-state))").length,
    tabs:[...document.querySelectorAll("[data-report-page]")].map(x=>x.dataset.reportPage),
    importLinkField:!!document.querySelector("#sum-spreadsheet-link"),
    exportDisabled:document.querySelector("#sum-export").disabled
   };
 },expectedHeaders);
 await frame.click("#sum-import-open");
 const sumModalOpen=await frame.$eval("#sum-import-modal",e=>e.classList.contains("open"));
 await frame.type("#sum-spreadsheet-link","not-a-google-link");
 await frame.click("#sum-link-validate");
 const sumInvalid=await frame.evaluate(()=>({status:document.body.dataset.tfiSpreadsheetLinkStatus,aria:document.querySelector("#sum-spreadsheet-link").getAttribute("aria-invalid"),feedback:document.querySelector("#sum-link-feedback").textContent}));
 await frame.click("#sum-spreadsheet-link"); await frame.$eval("#sum-spreadsheet-link",e=>e.value="");
 await frame.type("#sum-spreadsheet-link",workbookUrl); await frame.click("#sum-link-validate");
 const sumValid=await frame.evaluate(()=>({status:document.body.dataset.tfiSpreadsheetLinkStatus,id:document.querySelector("#sum-link-id-value").textContent,visible:!document.querySelector("#sum-link-id").hidden,feedback:document.querySelector("#sum-link-feedback").textContent}));
 const sumImportDisabled=await frame.$eval("#sum-import-modal button[disabled]",e=>e.textContent.trim());
 await frame.click("#sum-modal-dismiss");
 const sumModalClosed=await frame.$eval("#sum-import-modal",e=>!e.classList.contains("open"));
 await frame.click('[data-sum-sort="totalFg"]');
 const sumSort=await frame.$eval('[data-sum-sort="totalFg"]',e=>e.closest("th").getAttribute("aria-sort"));
 await frame.type("#sum-filter-code","MDP");
 await frame.click("#sum-reset");
 const sumReset=await frame.$eval("#sum-filter-code",e=>e.value==="");
 await page.screenshot({path:path.join(dir,"summary-desktop.png"),fullPage:true});

 async function testReportPage(file,modalId,inputId,validateId,idValueId,feedbackId,closeId,importOpenId,tabName){
   const f=await activeFrameContains(file);
   await f.waitForFunction(()=>document.body.dataset.tfiReady==="true",{timeout:10000});
   const meta=await f.evaluate(()=>({report:document.body.dataset.tfiReport,sheetId:document.body.dataset.tfiSourceSheetId,tabs:[...document.querySelectorAll("[data-report-page]")].map(x=>x.dataset.reportPage),hasLink:!!document.querySelector("[id$='-spreadsheet-link']")}));
   await f.click("#"+importOpenId);
   await f.type("#"+inputId,workbookUrl);
   await f.click("#"+validateId);
   const link=await f.evaluate(args=>({status:document.body.dataset.tfiSpreadsheetLinkStatus,id:document.getElementById(args.idValueId).textContent,visible:!document.getElementById(args.idValueId.replace("-value","")).hidden}),{idValueId});
   const disabled=await f.$eval("#"+modalId+" button[disabled]",e=>e.textContent.trim());
   await f.click("#"+closeId);
   const closed=await f.$eval("#"+modalId,e=>!e.classList.contains("open"));
   await f.click('[data-report-page="Summary"]');
   return {meta,link,disabled,closed};
 }
 await frame.click('[data-report-page="Reports"]');
 const reportsResult=await testReportPage("reports-reconciliation-preview.html","rr-import-modal","rr-spreadsheet-link","rr-link-validate","rr-link-id-value","rr-link-feedback","rr-modal-dismiss","rr-import-open");
 const summaryFrame=[...page.frames()].find(f=>f.url().includes("summary-preview.html"));
 await summaryFrame.click('[data-report-page="Schedule Summary"]');
 const scheduleResult=await testReportPage("schedule-summary-preview.html","ss-import-modal","ss-spreadsheet-link","ss-link-validate","ss-link-id-value","ss-link-feedback","ss-modal-dismiss","ss-import-open");
 await page.waitForFunction(()=>{const f=document.querySelector(".tfi-module-frame.is-active");return !!f&&f.dataset.loadedModule==="Summary"&&(f.getAttribute("src")||"").includes("summary-preview.html")},{timeout:10000});
 const finalActive=await page.evaluate(()=>({src:document.querySelector(".tfi-module-frame.is-active")?.getAttribute("src"),loaded:document.querySelector(".tfi-module-frame.is-active")?.dataset.loadedModule,sidebar:document.querySelector(".sidebar .nav-link.active")?.dataset.page}));
 await page.setViewport({width:390,height:844});
 await new Promise(r=>setTimeout(r,200));
 const mobile=await page.evaluate(()=>({viewport:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,noPageOverflow:document.documentElement.scrollWidth<=document.documentElement.clientWidth}));
 await page.screenshot({path:path.join(dir,"summary-mobile.png"),fullPage:true});
 const result={summary,sumModal:{opens:sumModalOpen,invalid:sumInvalid,valid:sumValid,importDisabled:sumImportDisabled,closes:sumModalClosed},interactions:{sort:sumSort,filterReset:sumReset},reports:reportsResult,schedule:scheduleResult,finalActive,mobile,browserErrors:errors,failedRequests:failed};
 const pass=summary.ready==="true"&&summary.report==="summary"&&summary.sheetId==="1639151211"&&summary.columns===32&&summary.headerRows==="1,2,3"&&summary.firstDataRow===4&&summary.frozenRows===3&&summary.formulaSource==="Product Entry"&&summary.headersMatch&&summary.groupSpan===32&&summary.subgroupSpan===32&&summary.emptyState&&summary.sampleRows===0&&summary.tabs.includes("Summary")&&summary.importLinkField&&summary.exportDisabled&&sumModalOpen&&sumInvalid.status==="invalid"&&sumValid.status==="valid"&&sumValid.id===workbookId&&sumValid.visible&&sumImportDisabled==="IMPORT NOT CONNECTED"&&sumModalClosed&&sumSort==="ascending"&&sumReset&&reportsResult.meta.hasLink&&reportsResult.link.status==="valid"&&reportsResult.link.id===workbookId&&reportsResult.disabled==="IMPORT NOT CONNECTED"&&reportsResult.closed&&scheduleResult.meta.hasLink&&scheduleResult.link.status==="valid"&&scheduleResult.link.id===workbookId&&scheduleResult.disabled==="IMPORT NOT CONNECTED"&&scheduleResult.closed&&finalActive.loaded==="Summary"&&finalActive.sidebar==="Reports"&&mobile.noPageOverflow&&errors.length===0&&failed.length===0;
 result.pass=pass;
 console.log(JSON.stringify(result,null,2));
 await browser.close();
 if(!pass)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
