const puppeteer=require("C:/Users/Rominick/AppData/Local/npm-cache/_npx/4b4c857f6efdfb61/node_modules/puppeteer");
const path=require("path");
const{pathToFileURL}=require("url");
const dir="C:/Users/Rominick/Desktop/TFI_NEW/design";
(async()=>{
 const browser=await puppeteer.launch({headless:true,args:["--no-sandbox","--disable-setuid-sandbox","--allow-file-access-from-files"]});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[];
 page.on("pageerror",error=>errors.push(error.message));
 await page.evaluateOnNewDocument(()=>{
  window.__hourlyScenario="all";
  window.__hourlySaved=false;
  window.__dashboardAnalyticsUrls=[];
  window.__reportAnalyticsUrls=[];
  window.__tfiDataSavedMessages=[];
  window.__tfiDataSavedEvents=[];
  window.addEventListener("tfi:data-saved",event=>window.__tfiDataSavedEvents.push(event.detail));
  window.addEventListener("message",event=>{
   if(event.data?.type==="TFI_DATA_SAVED"){
    window.__tfiDataSavedMessages.push({origin:event.origin,data:event.data});
    if(event.data.endpoint==="/api/hourly/hourly_meat/records")window.__hourlySaved=true;
   }
  });
  window.fetch=async(input,init={})=>{
   const url=String(input),method=String(init.method||"GET").toUpperCase();
   if(url.includes("/api/dashboard/coverage"))return{ok:true,status:200,json:async()=>({source:"TFI2",checked_at:1795380000,total_operational_records:0,visible_module_count:3,modules_with_records:0,modules:[],imports:{batches_in_review:0},audit_events:0})};
   if(url.includes("/api/dashboard/analytics")){
    window.__dashboardAnalyticsUrls.push(url);
    return{ok:true,status:200,json:async()=>({source:"TFI2",calculation_contract:"source-workbook-2026-11-22-v1",metrics:{},modules:{hourly:{
     ...(window.__hourlyScenario==="restricted"?{}:{hourly_meat:{status:"available",record_count:2,target_tins:100,actual_tins:window.__hourlySaved?95:90,variance_tins:window.__hourlySaved?-5:-10,attainment:window.__hourlySaved?.95:.9,hourly_series:[{hour:8,target_tins:100,actual_tins:window.__hourlySaved?95:90}],product_breakdown:[{product_code:"A",product_name:"Alpha",record_count:1,target_tins:100,actual_tins:window.__hourlySaved?80:75,variance_tins:window.__hourlySaved?-20:-25},{product_code:"B",product_name:"<Beta>",record_count:1,target_tins:0,actual_tins:15,variance_tins:15}]} }),
     hourly_coding:{status:"available",record_count:1,target_tins:50,actual_tins:55,variance_tins:5,attainment:1.1,hourly_series:[{hour:8,target_tins:50,actual_tins:55}],product_breakdown:[{product_code:"A",product_name:"Alpha",record_count:1,target_tins:50,actual_tins:55,variance_tins:5}]},
     hourly_agri:{status:"available",record_count:1,target_tins:20,actual_tins:10,variance_tins:-10,attainment:.5,hourly_series:[{hour:8,target_tins:20,actual_tins:10}],product_breakdown:[{product_code:"A",product_name:"Alpha",record_count:1,target_tins:20,actual_tins:10,variance_tins:-10}]}
    }},reports:{production_summary:{status:"empty"},schedule_summary:{status:"empty",saved_rows:0},product_entry_summary:{status:"pending_formula_projection"},removed_rows:{status:"archive_only"}},readiness:{verified_kpi_groups:[],pending_kpi_groups:[]}})};
   }
   if(url.includes("/api/productivity/catalog"))return{ok:true,status:200,json:async()=>({catalog:{},permissions:{edit:true}})};
   if(url.includes("/api/productivity/records")&&method==="GET")return{ok:true,status:200,json:async()=>({records:[],total_count:0,page:1,page_size:25})};
   if(url.includes("/api/productivity/records")&&method==="POST")return{ok:true,status:201,json:async()=>({saved:1,records:[{id:"test-record"}]})};
   if(url.includes("/api/production-entry/catalog"))return{ok:true,status:200,json:async()=>({catalog:{},permissions:{edit:false}})};
   if(url.includes("/api/production-entry/summary"))return{ok:true,status:200,json:async()=>({summary:{saved_rows:0,days_saved:0,avg_attainment:null,last_saved:null}})};
   if(url.includes("/api/production-entry/records"))return{ok:true,status:200,json:async()=>({records:[],total:0,page:1})};
   return{ok:true,status:200,json:async()=>({})};
  };
 });
 await page.goto("http://127.0.0.1:8001/dashboard-preview.html",{waitUntil:"load"});
 await page.waitForFunction(()=>window.__dashboardAnalyticsUrls?.length>=1);
 await page.click("#kpi-tab-hourly");
 await page.waitForFunction(()=>document.querySelector("#hourly-total-records")?.textContent==="4",{timeout:12000});
 const hourly=await page.evaluate(()=>({
  records:document.querySelector("#hourly-total-records")?.textContent,
  target:document.querySelector("#hourly-total-target")?.textContent,
  actual:document.querySelector("#hourly-total-actual")?.textContent,
  variance:document.querySelector("#hourly-total-variance")?.textContent,
  attainment:document.querySelector("#hourly-total-attainment")?.textContent,
  lineRows:document.querySelectorAll("#hourly-line-summary-rows tr").length,
  actualLines:document.querySelectorAll("#hourly-combined-chart .kpi-hourly-actual-line").length,
  targetLine:document.querySelectorAll("#hourly-combined-chart .kpi-hourly-target-line").length,
  agriStatus:document.querySelector("#hourly-agri-status")?.textContent
 }));
 if(hourly.records!=="4"||hourly.target!=="170"||hourly.actual!=="155"||hourly.variance!=="-15"||hourly.attainment!=="91.18%"||hourly.lineRows!==3||hourly.actualLines!==3||hourly.targetLine!==1)
  throw new Error("Consolidated hourly dashboard failed: "+JSON.stringify(hourly));
 const productRows=()=>page.$$eval("#hourly-product-rows tr",rows=>rows.map(row=>[...row.cells].map(cell=>cell.textContent)));
 const assertProducts=async expected=>{
  const rows=await productRows();
  if(JSON.stringify(rows)!==JSON.stringify(expected))throw new Error("Unexpected product rows: "+JSON.stringify(rows));
 };
 const combined=[["1","A","Alpha","3","170","140","-30","82.35%"],["2","B","<Beta>","1","0","15","15","\u2014"]];
 await assertProducts(combined);
 await page.select("#hourly-product-line","hourly_meat");
 await assertProducts([["1","A","Alpha","1","100","75","-25","75%"],combined[1]]);
 await page.evaluate(()=>{
  window.__hourlyScenario="restricted";
  window.dispatchEvent(new Event("focus"));
 });
 await page.waitForFunction(()=>!document.querySelector('#hourly-product-line option[value="hourly_meat"]'));
 await assertProducts([["1","A","Alpha","2","70","65","-5","92.86%"]]);
 await page.evaluate(()=>{
  window.__hourlyScenario="all";
  window.dispatchEvent(new Event("focus"));
 });
 await page.waitForFunction(()=>document.querySelector('#hourly-product-line option[value="hourly_meat"]'));
 await assertProducts(combined);
 await page.setViewport({width:390,height:844});
 const mobile=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,chartScrollable:document.querySelector("#hourly-combined-chart .kpi-hourly-chart-scroll")?.scrollWidth||0}));
 if(mobile.scrollWidth>mobile.width)throw new Error("Hourly dashboard mobile layout overflows: "+JSON.stringify(mobile));
 await page.setViewport({width:1440,height:1000});
 await page.click('.sidebar .nav-link[data-page="Hourly Meat"]');
 await page.waitForFunction(()=>[...document.querySelectorAll(".tfi-module-frame")].some(frame=>frame.classList.contains("is-active")&&frame.src.includes("hourly-meat-preview.html")));
 const hourlyFrame=page.frames().find(frame=>frame.url().includes("hourly-meat-preview.html"));
 await hourlyFrame.waitForFunction(()=>window.__tfiWriteWatchInstalled);
 await hourlyFrame.evaluate(async()=>{
  const response=await fetch("/api/hourly/hourly_meat/records",{method:"POST"});
  if(!response.ok)throw new Error("Mock Hourly Meat save failed");
 });
 await page.waitForFunction(()=>document.querySelector("#hourly-product-rows tr")?.cells[5]?.textContent==="145");
 await assertProducts([["1","A","Alpha","3","170","145","-25","85.29%"],combined[1]]);
 await page.click('.sidebar .nav-link[data-page="Reports"]');
 await page.waitForFunction(()=>[...document.querySelectorAll(".tfi-module-frame")].some(f=>f.classList.contains("is-active")&&(f.getAttribute("src")||"").includes("reports-reconciliation-preview.html")),{timeout:12000});
 const reportFrame=page.frames().find(frame=>frame.url().includes("reports-reconciliation-preview.html"));
 await reportFrame.waitForFunction(()=>document.body.dataset.tfiReady==="true",{timeout:12000});
 await reportFrame.waitForFunction(()=>window.__dashboardAnalyticsUrls?.length>=1,{timeout:12000}).catch(()=>{});
 const reportInitial=await reportFrame.evaluate(()=>window.__dashboardAnalyticsUrls?.length||0);
 await page.click('.sidebar .nav-link[data-page="Productivity"]');
 await page.waitForFunction(()=>[...document.querySelectorAll(".tfi-module-frame")].some(f=>f.classList.contains("is-active")&&(f.getAttribute("src")||"").includes("productivity-preview.html")),{timeout:12000});
 const productivityFrame=page.frames().find(frame=>frame.url().includes("productivity-preview.html"));
 await productivityFrame.waitForFunction(()=>document.body.dataset.tfiReady==="true"||document.querySelector("form")||document.body.innerText.length>0,{timeout:12000});
 const before=await page.evaluate(()=>window.__dashboardAnalyticsUrls.length);
 await productivityFrame.evaluate(async()=>{
  const response=await fetch("/api/productivity/records",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({records:[{production_date:"2026-11-22"}]})});
  if(!response.ok)throw new Error("Mock module save failed");
 });
 await new Promise(resolve=>setTimeout(resolve,1200));
 await new Promise(resolve=>setTimeout(resolve,1200));
 const result=await page.evaluate(()=>({
  dashboardAnalyticsCalls:window.__dashboardAnalyticsUrls.length,
  dashboardUpdateReason:document.body.dataset.tfiDashboardUpdateReason,
  savedModule:document.body.dataset.tfiLastSavedModule,
  savedEndpoint:document.body.dataset.tfiLastSavedEndpoint,
  messageReceived:document.body.dataset.tfiDataSaveMessageReceived,
  messageOrigin:document.body.dataset.tfiDataSaveMessageOrigin,
  originValid:document.body.dataset.tfiDataSaveOriginValid,
  sourceFrameFound:document.body.dataset.tfiDataSaveFrameFound,
  savedEvents:window.__tfiDataSavedEvents
 }));
 const reportAfter=await reportFrame.evaluate(()=>window.__dashboardAnalyticsUrls?.length||0);
 result.reportInitialCalls=reportInitial;
 result.productivityFrameWatch=await productivityFrame.evaluate(()=>({watch:window.__tfiWriteWatchInstalled,origin:location.origin,urls:window.__dashboardAnalyticsUrls||[]}));
 result.parentMessages=await page.evaluate(()=>window.__tfiDataSavedMessages||[]);
 result.reportFrameOrigin=await reportFrame.evaluate(()=>location.origin);
 result.reportMessages=await reportFrame.evaluate(()=>({urls:window.__dashboardAnalyticsUrls||[],messages:window.__tfiDataSavedMessages||[]}));
 result.reportCallsAfterModuleSave=reportAfter;
 result.browserErrors=errors;
 result.pass=result.dashboardAnalyticsCalls>=2&&result.dashboardUpdateReason==="module-save"&&
  result.savedModule==="Productivity"&&result.savedEndpoint==="/api/productivity/records"&&
  reportAfter>reportInitial&&errors.length===0;
 console.log(JSON.stringify(result,null,2));
 await browser.close();
 if(!result.pass)process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1});
