const puppeteer=require("C:/Users/Rominick/AppData/Local/npm-cache/_npx/4b4c857f6efdfb61/node_modules/puppeteer");
const path=require("path");
const{pathToFileURL}=require("url");
const dir="C:/Users/Rominick/Desktop/TFI_NEW/design";
const file=name=>pathToFileURL(path.join(dir,name)).href;
const coverageFixture={
 source:"TFI2",checked_at:1795380000,total_operational_records:7,visible_module_count:3,modules_with_records:2,
 modules:[
  {module_key:"dmp_production",label:"DMP Production",record_count:5},
  {module_key:"hourly_meat",label:"Hourly Meat",record_count:2},
  {module_key:"oee",label:"OEE",record_count:0}
 ],
 imports:{batches_total:3,batches_in_review:1,staged_rows:22},audit_events:9,kpi_calculations_ready:false
};
const analyticsFixture={
 source:"TFI2",calculation_contract:"source-workbook-2026-11-22-v1",checked_at:1795380000,
 metrics:{
  total_output_tins:1000,output_attainment:.9,productivity_tins_per_mhr:100,
  oee:.85,fg_reject_pct:.02,total_downtime_hours:2,downtime_pct:.05,
  machine_downtime_hours:1.5,manpower_downtime_hours:.5,mtbf_hours:10,total_manpower_hours:8
 },
 modules:{
  productivity:{status:"available",record_count:2},
  dmr_production:{status:"available",record_count:2},
  oee:{status:"available",record_count:1},
  hourly:{hourly_meat:{status:"empty"},hourly_coding:{status:"empty"},hourly_agri:{status:"empty"}}
 },
 reports:{
  production_summary:{status:"available"},schedule_summary:{status:"available",saved_rows:1},
  product_entry_summary:{status:"pending_formula_projection"},removed_rows:{status:"archive_only"}
 },
 readiness:{
  verified_kpi_groups:["Productivity","Downtime","OEE","Hourly Production","Production Summary"],
  yield_kpis:{status:"implemented_read_only_projection"},
  pending_kpi_groups:["Product Entry Summary projection","Removed Rows archive integration"]
 }
};
const filterCatalogFixture={
 source:"TFI2",status:"available",
 options:{
  year:["2025","2026","2027","2028"],view:["Daily","Weekly","Monthly"],
  month:["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
  week:Array.from({length:53},(_,index)=>String(index+1)),
  product_name:["All","Product One","Product Two"],
  product_code:["All","CODE-1","CODE-2"],
  machine:["All","Machine A","Machine B"]
 },
 product_map:{"CODE-1":"Product One","CODE-2":"Product Two"}
};
async function mockCoverage(page){
 await page.evaluateOnNewDocument(fixtures=>{
  window.__dashboardAnalyticsUrls=[];
  window.__yieldUrls=[];
  window.fetch=async url=>{
   const target=String(url);
   if(target.includes("/api/yield/log")){
    window.__yieldUrls.push(target);
    return {ok:true,status:200,json:async()=>fixtures.yield};
   }
   if(target.includes("/api/dashboard/filter-catalog")){
    return {ok:true,status:200,json:async()=>fixtures.filters};
   }
   if(target.includes("/api/dashboard/coverage")){
    return {ok:true,status:200,json:async()=>fixtures.coverage};
   }
   if(target.includes("/api/dashboard/analytics")){
    window.__dashboardAnalyticsUrls.push(target);
    return {ok:true,status:200,json:async()=>fixtures.analytics};
   }
   throw new Error("Unexpected dashboard test fetch: "+url);
  };
 },{coverage:coverageFixture,analytics:analyticsFixture,filters:filterCatalogFixture,yield:{
  source:"TFI2",records:[],count:0,limit:100,offset:0,has_more:false,mapped_products:39,
  yield_map_note:"Other 95% targets are placeholders; change or clear them.",read_only:true
 }});
}
(async()=>{
 const browser=await puppeteer.launch({headless:true,args:["--no-sandbox","--disable-setuid-sandbox"]});
 const errors=[],failed=[],requests=[];
 function watch(page){
  page.on("pageerror",e=>errors.push(e.message));
  page.on("console",m=>{if(m.type()==="error")errors.push(m.text())});
  page.on("requestfailed",r=>failed.push(r.url()+" :: "+r.failure()?.errorText));
  page.on("request",r=>requests.push(r.url()));
 }
 const page=await browser.newPage();
 await mockCoverage(page);
 await page.setViewport({width:1440,height:1000});
 watch(page);
 await page.goto(file("dashboard-preview.html"),{waitUntil:"load"});
 await page.waitForSelector("#kpi-panel-overview");
 await page.waitForFunction(()=>document.querySelector("#kpi-live-total-records")?.textContent==="7");
 await page.waitForFunction(()=>document.querySelector("#kpi-analytics-verified")?.textContent==="5");
 await page.waitForFunction(()=>document.querySelector("#yield-record-status")?.textContent==="No Yield Log rows");
 const initial=await page.evaluate(()=>({
  title:document.title,
  heading:document.querySelector("h1")?.textContent.trim(),
  sectionTabs:[...document.querySelectorAll("[data-kpi-tab]")].map(x=>x.textContent.trim()),
  activeTab:document.querySelector("[data-kpi-tab].active")?.dataset.kpiTab,
  activePanel:document.querySelector("[data-kpi-panel].active")?.dataset.kpiPanel,
  hiddenPanels:[...document.querySelectorAll("[data-kpi-panel]")].filter(x=>x.hidden).length,
  filterCount:document.querySelectorAll(".kpi-filter").length,
  allFiltersDisabled:[...document.querySelectorAll(".kpi-filter select,.kpi-filter input")].every(x=>x.disabled),
  filterDefaults:{
   year:document.querySelector("#kpi-filter-year")?.value,
   view:document.querySelector("#kpi-filter-view")?.value,
   month:document.querySelector("#kpi-filter-month")?.value,
   week:document.querySelector("#kpi-filter-week")?.value,
   dateDisabled:document.querySelector("#kpi-filter-date")?.disabled,
   product:document.querySelector("#kpi-filter-product")?.value,
   code:document.querySelector("#kpi-filter-code")?.value,
   machine:document.querySelector("#kpi-filter-machine")?.value
  },
  metricCount:document.querySelectorAll(".kpi-stat-value").length,
  metricValues:[...document.querySelectorAll(".kpi-stat-value")].map(x=>x.textContent.trim()),
  miniMetricValues:[...document.querySelectorAll(".kpi-mini-metrics strong")].map(x=>x.textContent.trim()),
  notice:document.querySelector(".kpi-data-notice")?.innerText,
  status:document.querySelector("#kpi-data-status")?.textContent.trim(),
  liveTotal:document.querySelector("#kpi-live-total-records")?.textContent.trim(),
  liveModules:document.querySelector("#kpi-live-modules-with-records")?.textContent.trim(),
  importReview:document.querySelector("#kpi-live-import-review")?.textContent.trim(),
  auditEvents:document.querySelector("#kpi-live-audit-events")?.textContent.trim(),
  coverageRows:document.querySelectorAll("#kpi-live-module-list .kpi-live-module-row").length,
  coverageSource:document.querySelector("#kpi-live-source")?.textContent.trim(),
  analyticsVerified:document.querySelector("#kpi-analytics-verified")?.textContent.trim(),
  analyticsPending:document.querySelector("#kpi-analytics-pending")?.textContent.trim(),
  analyticsReports:document.querySelector("#kpi-analytics-reports")?.textContent.trim(),
  analyticsContract:document.querySelector("#kpi-analytics-contract")?.textContent.trim(),
  analyticsCaption:document.querySelector("#kpi-analytics-caption")?.textContent.trim(),
  analyticsUrls:window.__dashboardAnalyticsUrls||[],
  yieldUrls:window.__yieldUrls||[],
  yieldStatus:document.querySelector("#yield-record-status")?.textContent.trim(),
  yieldMain:document.querySelector("#yield-average-main")?.textContent.trim(),
  yieldEmpty:!document.querySelector("#yield-log-empty")?.hidden,
  notificationDotVisible:getComputedStyle(document.querySelector(".notification-dot")).display!=="none",
  duplicateIds:[...document.querySelectorAll("[id]")].map(x=>x.id).filter((id,i,a)=>a.indexOf(id)!==i),
  panels:[...document.querySelectorAll("[data-kpi-panel]")].map(x=>({id:x.id,hidden:x.hidden}))
 }));
 const monthlyFilterUrl=await page.evaluate(()=>window.__dashboardAnalyticsUrls[0]);
 await page.select("#kpi-filter-view","Weekly");
 await page.select("#kpi-filter-week","48");
 await page.click("#kpi-analytics-refresh");
 await page.waitForFunction(()=>window.__dashboardAnalyticsUrls?.length===2);
 const weeklyFilterUrl=await page.evaluate(()=>window.__dashboardAnalyticsUrls[1]);
 await page.select("#kpi-filter-view","Daily");
 await page.waitForFunction(()=>document.querySelector("#kpi-filter-view")?.value==="Daily"&&!document.querySelector("#kpi-filter-date")?.disabled);
 await page.$eval("#kpi-filter-date",el=>{el.value="2026-11-23";el.dispatchEvent(new Event("change",{bubbles:true}));});
 await page.select("#kpi-filter-product","Product One");
 await page.select("#kpi-filter-code","CODE-1");
 await page.select("#kpi-filter-machine","Machine A");
 await page.click("#kpi-analytics-refresh");
 await page.waitForFunction(()=>window.__dashboardAnalyticsUrls?.length===3);
 await page.waitForFunction(()=>window.__yieldUrls?.length===3);
 const dateFilterUrl=await page.evaluate(()=>window.__dashboardAnalyticsUrls[2]);
 const dateYieldUrl=await page.evaluate(()=>window.__yieldUrls[2]);
 await page.screenshot({path:path.join(dir,"dashboard-kpi-desktop.png"),fullPage:true});
 await page.click("#kpi-tab-downtime");
 const downtime=await page.evaluate(()=>({
  active:document.querySelector("[data-kpi-tab].active")?.dataset.kpiTab,
  panel:document.querySelector("[data-kpi-panel].active")?.dataset.kpiPanel,
  hidden:document.querySelector("#kpi-panel-overview").hidden
 }));
 await page.keyboard.press("Home");
 const keyboardHome=await page.evaluate(()=>document.activeElement?.dataset?.kpiTab);
 await page.keyboard.press("ArrowRight");
 const keyboardRight=await page.evaluate(()=>document.activeElement?.dataset?.kpiTab);
 await page.click("#notification-button");
 const notification=await page.$eval("#toast",el=>el.textContent);

 const searchPage=await browser.newPage();
 await mockCoverage(searchPage);
 await searchPage.setViewport({width:1440,height:900});
 watch(searchPage);
 await searchPage.goto(file("dashboard-preview.html"),{waitUntil:"load"});
 await searchPage.type("#module-search","security");
 const searchResult=await searchPage.evaluate(()=>({
  visible:[...document.querySelectorAll(".sidebar .nav-link")].filter(x=>!x.hidden).map(x=>x.dataset.page),
  hiddenGroups:[...document.querySelectorAll(".sidebar .nav-group")].filter(x=>x.hidden).length
 }));

 const shell=await browser.newPage();
 await mockCoverage(shell);
 await shell.setViewport({width:1440,height:1000});
 watch(shell);
 await shell.goto(file("dashboard-preview.html")+"?module=Dashboard",{waitUntil:"load"});
 await shell.waitForFunction(()=>[...document.querySelectorAll("iframe")].some(f=>f.classList.contains("is-active")&&f.src.includes("dashboard-preview.html")));
 const dashFrame=shell.frames().find(f=>f.url().includes("dashboard-preview.html")&&f.url().includes("embedded=1"));
 await dashFrame.waitForSelector("#kpi-open-import");
 await dashFrame.click("#kpi-open-import");
 await shell.waitForFunction(()=>[...document.querySelectorAll("iframe")].some(f=>f.classList.contains("is-active")&&f.src.includes("spreadsheet-import-center-preview.html")));
 const importRoute=await shell.evaluate(()=>[...document.querySelectorAll("iframe")].find(f=>f.classList.contains("is-active"))?.src||"");

 const mobile=await browser.newPage();
 await mockCoverage(mobile);
 await mobile.setViewport({width:390,height:844});
 watch(mobile);
 await mobile.goto(file("dashboard-preview.html"),{waitUntil:"load"});
 await mobile.waitForFunction(()=>document.querySelector("#kpi-live-total-records")?.textContent==="7");
 const mobileLayout=await mobile.evaluate(()=>({
  width:innerWidth,client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,
  overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth,
  filterColumns:getComputedStyle(document.querySelector(".kpi-filter-bar")).gridTemplateColumns,
  metricColumns:getComputedStyle(document.querySelector(".kpi-stat-grid")).gridTemplateColumns,
  coverageColumns:getComputedStyle(document.querySelector(".kpi-live-metrics")).gridTemplateColumns,
  tabsScrollable:document.querySelector(".kpi-section-tabs").scrollWidth>document.querySelector(".kpi-section-tabs").clientWidth
 }));
 await mobile.screenshot({path:path.join(dir,"dashboard-kpi-mobile.png"),fullPage:true});
 await mobile.setViewport({width:320,height:844});
 const narrow=await mobile.evaluate(()=>({width:innerWidth,client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth}));

 const result={
  initial,monthlyFilterUrl,weeklyFilterUrl,dateFilterUrl,downtime,keyboardHome,keyboardRight,notification,searchResult,importRoute,mobileLayout,narrow,
  errors,failed,requests,
  pass:initial.title==="TFI | KPI Dashboard"&&initial.heading==="KPI Dashboard"&&
   initial.sectionTabs.length===8&&initial.activeTab==="overview"&&initial.activePanel==="overview"&&initial.hiddenPanels===7&&
   initial.filterCount===8&&!initial.allFiltersDisabled&&initial.filterDefaults.year==="2026"&&
   initial.filterDefaults.view==="Monthly"&&initial.filterDefaults.month==="Nov"&&initial.filterDefaults.week==="48"&&
   initial.filterDefaults.dateDisabled&&initial.filterDefaults.product==="All"&&initial.filterDefaults.code==="All"&&
   initial.filterDefaults.machine==="All"&&initial.metricCount===39&&
   initial.metricValues.slice(0,12).join("|")==="1,000|90%|100|85%|—|2%|2|5%|1.5|0.5|10|8"&&
   initial.miniMetricValues.join("|")==="0|0|0|—|0|0|0|—|0|0|0|—"&&
   initial.notice.includes("Verified KPI calculations")&&initial.status.includes("TFI2 connected")&&
   initial.liveTotal==="7"&&initial.liveModules==="2 / 3"&&initial.importReview==="1"&&initial.auditEvents==="9"&&
   initial.coverageRows===2&&initial.coverageSource==="TFI2 · LIVE"&&
   initial.analyticsVerified==="5"&&initial.analyticsPending==="2"&&initial.analyticsReports==="2 / 4"&&
   initial.analyticsContract.includes("source-workbook-2026-11-22-v1")&&initial.analyticsUrls.length===1&&initial.yieldUrls.length===1&&initial.yieldStatus==="No Yield Log rows"&&
   initial.yieldMain==="—"&&initial.yieldEmpty&&
   monthlyFilterUrl.includes("date_from=2026-11-01")&&monthlyFilterUrl.includes("date_to=2026-11-30")&&
   weeklyFilterUrl.includes("date_from=2026-11-23")&&weeklyFilterUrl.includes("date_to=2026-11-29")&&
   dateFilterUrl.includes("date_from=2026-11-23")&&dateFilterUrl.includes("date_to=2026-11-23")&&
   dateFilterUrl.includes("product_name=Product+One")&&dateFilterUrl.includes("product_code=CODE-1")&&dateFilterUrl.includes("machine=Machine+A")&&
   dateYieldUrl.includes("product_name=Product+One")&&dateYieldUrl.includes("product_code=CODE-1")&&
   !initial.notificationDotVisible&&initial.duplicateIds.length===0&&
   downtime.active==="downtime"&&downtime.panel==="downtime"&&downtime.hidden&&
   keyboardHome==="overview"&&keyboardRight==="hourly"&&notification.includes("No verified notifications")&&
   searchResult.visible.length===2&&searchResult.visible.includes("Security & Activity")&&searchResult.visible.includes("Security Alert Rules & Notifications")&&
   importRoute.includes("spreadsheet-import-center-preview.html")&&
   !mobileLayout.overflow&&!narrow.overflow&&errors.length===0&&failed.length===0&&
   requests.some(x=>x.endsWith("/dashboard-kpi.css"))&&requests.some(x=>x.endsWith("/dashboard-kpi-ui.js"))&&
   requests.every(x=>x.startsWith("file://")||x.startsWith("data:"))
 };
 console.log(JSON.stringify(result,null,2));
 await browser.close();
 if(!result.pass)process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1});
