const puppeteer=require("C:/Users/Rominick/AppData/Local/npm-cache/_npx/4b4c857f6efdfb61/node_modules/puppeteer");
const path=require("path");const{pathToFileURL}=require("url");const dir="C:/Users/Rominick/Desktop/TFI_NEW/design";
(async()=>{
 const browser=await puppeteer.launch({headless:true,args:["--no-sandbox","--disable-setuid-sandbox","--allow-file-access-from-files"]});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[],failed=[];page.on("pageerror",e=>errors.push(e.message));page.on("console",m=>{if(m.type()==="error")errors.push(m.text())});page.on("requestfailed",r=>failed.push(r.url()+" :: "+r.failure()?.errorText));
 await page.goto(pathToFileURL(path.join(dir,"dashboard-preview.html")).href+"?module=Yield%20Monitoring",{waitUntil:"load"});
 await page.waitForFunction(()=>{const f=document.querySelector(".tfi-module-frame.is-active");return !!f&&(f.getAttribute("src")||"").includes("yield-monitoring-preview.html")},{timeout:15000});
 const frame=await (await page.$(".tfi-module-frame.is-active")).contentFrame();
 await frame.waitForFunction(()=>document.body.dataset.tfiReady==="true",{timeout:10000});
 const meta=await frame.evaluate(()=>{
  const d=window.TFI_YIELD_MONITORING_DATA;
  const headers=[...document.querySelectorAll("#ym-table thead th button")].map(x=>x.innerText.replace("↕","").replace(/\s+/g," ").trim());
  return {report:document.title,ready:document.body.dataset.tfiReady,readOnly:document.body.dataset.tfiYieldReadOnly,noMock:document.body.dataset.tfiNoMock,recordCount:d.records.length,recordAttr:document.body.dataset.tfiYieldRecords,columnCount:headers.length,headers,productCount:d.reference.products.length,productOptions:document.querySelectorAll("#ym-product option").length-1,source:d.source,emptyState:!!document.querySelector("#ym-tbody .ym-empty-state"),exportDisabled:document.querySelector("#ym-export").disabled,sidebarActive:window.parent.document.querySelector('.nav-link.active[data-page="Yield Monitoring"]')!==null};
 });
 await frame.click('[data-sort="date"]');const sort=await frame.$eval('[data-sort="date"]',e=>e.closest("th").getAttribute("aria-sort"));
 await frame.type("#ym-code","TEST");const filtered=await frame.$eval("#ym-filter-summary",e=>e.textContent);
 await frame.click("#ym-reset");const reset=await frame.evaluate(()=>document.querySelector("#ym-code").value===""&&document.querySelector("#ym-product").value==="");
 await page.screenshot({path:path.join(dir,"yield-monitoring-verified-desktop.png"),fullPage:true});
 await page.setViewport({width:390,height:844});
 const mobile=await frame.evaluate(()=>({viewport:document.documentElement.clientWidth,pageWidth:document.documentElement.scrollWidth,noPageOverflow:document.documentElement.scrollWidth<=document.documentElement.clientWidth,tableScroll:document.querySelector(".ym-table-scroll").scrollWidth>document.querySelector(".ym-table-scroll").clientWidth,sourceCards:getComputedStyle(document.querySelector(".ym-source-strip")).gridTemplateColumns.trim().split(/\s+/).length,headerOverlap:(()=>{const c=document.querySelector(".crumb").getBoundingClientRect(),p=document.querySelector(".profile").getBoundingClientRect();return c.right<=p.left})()}));
 await page.screenshot({path:path.join(dir,"yield-monitoring-verified-mobile.png"),fullPage:true});
 const pass=meta.ready==="true"&&meta.readOnly==="true"&&meta.noMock==="true"&&meta.recordCount===0&&meta.recordAttr==="0"&&meta.columnCount===12&&meta.productCount===39&&meta.productOptions===39&&meta.emptyState&&meta.exportDisabled&&meta.sidebarActive&&sort==="descending"&&filtered.includes("No source records")&&reset&&mobile.noPageOverflow&&mobile.tableScroll&&mobile.sourceCards===1&&mobile.headerOverlap&&errors.length===0&&failed.filter(x=>!x.includes("ERR_ABORTED")).length===0;
 console.log(JSON.stringify({meta,interactions:{sort,filtered,reset},mobile,browserErrors:errors,failedRequests:failed.filter(x=>!x.includes("ERR_ABORTED")),pass},null,2));
 await browser.close();if(!pass)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});