const puppeteer=require("C:/Users/Rominick/AppData/Local/npm-cache/_npx/4b4c857f6efdfb61/node_modules/puppeteer");
const path=require("path");
const{pathToFileURL}=require("url");
const dir="C:/Users/Rominick/Desktop/TFI_NEW/design";
const analyticsFixture={
 source:"TFI2",calculation_contract:"source-workbook-2026-11-22-v1",
 metrics:{total_output_tins:1200,output_attainment:.92,productivity_tins_per_mhr:110,oee:.81,total_downtime_hours:3,fg_reject_pct:.015},
 modules:{productivity:{status:"available"},dmr_production:{status:"available"},oee:{status:"available"}},
 reports:{
  production_summary:{status:"available",saved_rows:2},
  schedule_summary:{status:"available",saved_rows:1},
  product_entry_summary:{status:"implemented_read_only_projection"},
  removed_rows:{status:"available_read_only_archive"}
 },
 readiness:{
  verified_kpi_groups:["Productivity","Downtime","OEE","Hourly Production","Production Summary"],
  yield_kpis:{status:"implemented_read_only_projection"},
  pending_kpi_groups:[]
 }
};
(async()=>{
 const browser=await puppeteer.launch({headless:true,args:["--no-sandbox","--disable-setuid-sandbox"]});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[],failed=[];
 page.on("pageerror",e=>errors.push(e.message));
 page.on("console",m=>{if(m.type()==="error")errors.push(m.text())});
 page.on("requestfailed",r=>failed.push(r.url()+" :: "+r.failure()?.errorText));
 await page.evaluateOnNewDocument(fixture=>{
  window.__reportAnalyticsUrls=[];
  window.fetch=async url=>{
   const target=String(url);
   if(target.includes("/api/dashboard/analytics")){
    window.__reportAnalyticsUrls.push(target);
    return {ok:true,status:200,json:async()=>fixture};
   }
   if(target.includes("/api/production-entry/catalog"))
    return {ok:true,status:200,json:async()=>({catalog:{},permissions:{edit:false}})};
   if(target.includes("/api/production-entry/summary"))
    return {ok:true,status:200,json:async()=>({summary:{saved_rows:0,days_saved:0,avg_attainment:null,last_saved:null}})};
   if(target.includes("/api/production-entry/records"))
    return {ok:true,status:200,json:async()=>({records:[],total:0,page:1})};
   return {ok:true,status:200,json:async()=>({})};
  };
 },analyticsFixture);
 await page.goto(pathToFileURL(path.join(dir,"reports-reconciliation-preview.html")).href,{waitUntil:"load"});
 await page.waitForFunction(()=>document.body.dataset.tfiReady==="true"&&document.querySelector("#rr-analytics-source")?.textContent.includes("source-workbook-2026-11-22-v1"));
 const snapshot=await page.evaluate(()=>({
  output:document.querySelector("#rr-analytics-output")?.textContent,
  attainment:document.querySelector("#rr-analytics-attainment")?.textContent,
  productivity:document.querySelector("#rr-analytics-productivity")?.textContent,
  oee:document.querySelector("#rr-analytics-oee")?.textContent,
  downtime:document.querySelector("#rr-analytics-downtime")?.textContent,
  yield:document.querySelector("#rr-analytics-yield")?.textContent,
  production:document.querySelector("#rr-source-production")?.textContent,
  schedule:document.querySelector("#rr-source-schedule")?.textContent,
  summary:document.querySelector("#rr-source-summary")?.textContent,
  removed:document.querySelector("#rr-source-removed")?.textContent,
  caption:document.querySelector("#rr-analytics-caption")?.textContent,
  ids:[...document.querySelectorAll("[id]")].map(x=>x.id)
 }));
 await page.$eval("#rr-from",el=>{el.value="2026-11-01";el.dispatchEvent(new Event("change",{bubbles:true}));});
 await page.waitForFunction(()=>window.__reportAnalyticsUrls?.length>=2);
 const dateFilterUrl=await page.evaluate(()=>window.__reportAnalyticsUrls[1]);
 const result={
  snapshot,dateFilterUrl,errors,failed,
  pass:snapshot.output==="1,200"&&snapshot.attainment==="92.00%"&&snapshot.productivity==="110"&&
   snapshot.oee==="81.00%"&&snapshot.downtime==="3"&&snapshot.yield==="Available · read-only"&&
   snapshot.production==="LIVE"&&snapshot.schedule==="LIVE"&&snapshot.summary==="AVAILABLE · READ ONLY"&&
   snapshot.removed==="AVAILABLE · READ ONLY"&&snapshot.caption.includes("0 source projections pending")&&
   dateFilterUrl.includes("date_from=2026-11-01")&&errors.length===0&&failed.length===0&&
   snapshot.ids.length===new Set(snapshot.ids).size
 };
 console.log(JSON.stringify(result,null,2));
 await browser.close();
 if(!result.pass)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
