const puppeteer=require("C:/Users/Rominick/AppData/Local/npm-cache/_npx/4b4c857f6efdfb61/node_modules/puppeteer");
const path=require("path");
const{pathToFileURL}=require("url");
const dir="C:/Users/Rominick/Desktop/TFI_NEW/design";
const file=name=>pathToFileURL(path.join(dir,name)).href;
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
 await page.setViewport({width:1440,height:1000});
 watch(page);
 await page.goto(file("dashboard-preview.html"),{waitUntil:"load"});
 await page.waitForSelector("#kpi-panel-overview");
 const initial=await page.evaluate(()=>({
  title:document.title,
  heading:document.querySelector("h1")?.textContent.trim(),
  sectionTabs:[...document.querySelectorAll("[data-kpi-tab]")].map(x=>x.textContent.trim()),
  activeTab:document.querySelector("[data-kpi-tab].active")?.dataset.kpiTab,
  activePanel:document.querySelector("[data-kpi-panel].active")?.dataset.kpiPanel,
  hiddenPanels:[...document.querySelectorAll("[data-kpi-panel]")].filter(x=>x.hidden).length,
  filterCount:document.querySelectorAll(".kpi-filter select").length,
  allFiltersDisabled:[...document.querySelectorAll(".kpi-filter select")].every(x=>x.disabled),
  metricCount:document.querySelectorAll(".kpi-stat-value").length,
  metricValues:[...document.querySelectorAll(".kpi-stat-value")].map(x=>x.textContent.trim()),
  miniMetricValues:[...document.querySelectorAll(".kpi-mini-metrics strong")].map(x=>x.textContent.trim()),
  notice:document.querySelector(".kpi-data-notice")?.innerText,
  notificationDotVisible:getComputedStyle(document.querySelector(".notification-dot")).display!=="none",
  duplicateIds:[...document.querySelectorAll("[id]")].map(x=>x.id).filter((id,i,a)=>a.indexOf(id)!==i),
  panels:[...document.querySelectorAll("[data-kpi-panel]")].map(x=>({id:x.id,hidden:x.hidden}))
 }));
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
 await searchPage.setViewport({width:1440,height:900});
 watch(searchPage);
 await searchPage.goto(file("dashboard-preview.html"),{waitUntil:"load"});
 await searchPage.type("#module-search","security");
 const searchResult=await searchPage.evaluate(()=>({
  visible:[...document.querySelectorAll(".sidebar .nav-link")].filter(x=>!x.hidden).map(x=>x.dataset.page),
  hiddenGroups:[...document.querySelectorAll(".sidebar .nav-group")].filter(x=>x.hidden).length
 }));

 const shell=await browser.newPage();
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
 await mobile.setViewport({width:390,height:844});
 watch(mobile);
 await mobile.goto(file("dashboard-preview.html"),{waitUntil:"load"});
 const mobileLayout=await mobile.evaluate(()=>({
  width:innerWidth,client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,
  overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth,
  filterColumns:getComputedStyle(document.querySelector(".kpi-filter-bar")).gridTemplateColumns,
  metricColumns:getComputedStyle(document.querySelector(".kpi-stat-grid")).gridTemplateColumns,
  tabsScrollable:document.querySelector(".kpi-section-tabs").scrollWidth>document.querySelector(".kpi-section-tabs").clientWidth
 }));
 await mobile.screenshot({path:path.join(dir,"dashboard-kpi-mobile.png"),fullPage:true});
 await mobile.setViewport({width:320,height:844});
 const narrow=await mobile.evaluate(()=>({width:innerWidth,client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth}));

 const result={
  initial,downtime,keyboardHome,keyboardRight,notification,searchResult,importRoute,mobileLayout,narrow,
  errors,failed,requests,
  pass:initial.title==="TFI | KPI Dashboard"&&initial.heading==="KPI Dashboard"&&
   initial.sectionTabs.length===8&&initial.activeTab==="overview"&&initial.activePanel==="overview"&&initial.hiddenPanels===7&&
   initial.filterCount===8&&initial.allFiltersDisabled&&initial.metricCount===39&&
   initial.metricValues.every(x=>x==="—")&&initial.miniMetricValues.every(x=>x==="—")&&
   initial.notice.includes("No verified operational records")&&!initial.notificationDotVisible&&initial.duplicateIds.length===0&&
   downtime.active==="downtime"&&downtime.panel==="downtime"&&downtime.hidden&&
   keyboardHome==="overview"&&keyboardRight==="hourly"&&notification.includes("No verified notifications")&&
   searchResult.visible.length===1&&searchResult.visible[0]==="Security & Activity"&&
   importRoute.includes("spreadsheet-import-center-preview.html")&&
   !mobileLayout.overflow&&!narrow.overflow&&errors.length===0&&failed.length===0&&
   requests.some(x=>x.endsWith("/dashboard-kpi.css"))&&requests.some(x=>x.endsWith("/dashboard-kpi-ui.js"))&&
   requests.every(x=>x.startsWith("file://"))
 };
 console.log(JSON.stringify(result,null,2));
 await browser.close();
 if(!result.pass)process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1});