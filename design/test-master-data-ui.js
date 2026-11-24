const puppeteer=require("C:/Users/Rominick/AppData/Local/npm-cache/_npx/4b4c857f6efdfb61/node_modules/puppeteer");
const path=require("path");const{pathToFileURL}=require("url");const dir="C:/Users/Rominick/Desktop/TFI_NEW/design";
(async()=>{
 const browser=await puppeteer.launch({headless:true,args:["--no-sandbox","--disable-setuid-sandbox","--allow-file-access-from-files"]});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[],failed=[];page.on("pageerror",e=>errors.push(e.message));page.on("console",m=>{if(m.type()==="error")errors.push(m.text())});page.on("requestfailed",r=>failed.push(r.url()+" :: "+r.failure()?.errorText));
 await page.goto(pathToFileURL(path.join(dir,"dashboard-preview.html")).href+"?module=Master%20Data",{waitUntil:"load"});
 await page.waitForFunction(()=>{const f=document.querySelector(".tfi-module-frame.is-active");return !!f&&(f.getAttribute("src")||"").includes("master-data-preview.html")},{timeout:15000});
 const frame=await (await page.$(".tfi-module-frame.is-active")).contentFrame();
 await frame.waitForFunction(()=>document.body.dataset.tfiReady==="true",{timeout:10000});
 const inspect=async()=>frame.evaluate(()=>({
  category:document.body.dataset.tfiMasterDataCategory,
  sourceId:document.getElementById("source-sheet-id")?.textContent,
  sourceName:document.getElementById("source-sheet-name")?.textContent,
  range:document.getElementById("source-range")?.textContent,
  title:document.getElementById("panel-name")?.textContent,
  rowCount:document.querySelectorAll("#data-content tbody tr[data-source-row]").length,
  headers:document.querySelectorAll("#data-content thead th").length,
  dataContent:document.querySelector("#data-content")?.innerText.slice(0,450),
  count:document.getElementById("record-count")?.textContent,
  sidebar:!!window.parent.document.querySelector('.sidebar .nav-link.active[data-page="Master Data"]')
 }));
 const results={};
 results.product=await inspect();
 await frame.click('.cat[data-category="code"]');results.code=await inspect();
 await frame.select("#filter-select","unmatched");results.codeUnmatched=await inspect();
 await frame.click('.cat[data-category="yield"]');results.yield=await inspect();
 await frame.click('.cat[data-category="entry"]');results.entry=await inspect();
 await frame.click('.cat[data-category="kpi"]');results.kpi=await frame.evaluate(()=>({category:document.body.dataset.tfiMasterDataCategory,cards:document.querySelectorAll(".kpi-reference-card").length,rows:[...document.querySelectorAll(".kpi-reference-card")].map(x=>x.querySelector(".kpi-card-head strong").textContent),protected:[...document.querySelectorAll(".protected-tag")].length,sourceId:document.getElementById("source-sheet-id").textContent}));
 await frame.click('.cat[data-category="dpr"]');results.dpr=await frame.evaluate(()=>({category:document.body.dataset.tfiMasterDataCategory,subtabs:document.querySelectorAll("[data-dpr-view]").length,families:document.querySelectorAll("#dpr-family-select option").length,selected:document.querySelector("#dpr-family-select")?.selectedOptions[0]?.textContent,sourceId:document.getElementById("source-sheet-id").textContent,rows:document.querySelectorAll("#data-content tbody tr[data-source-row]").length}));
 await frame.click('[data-dpr-view="lists"]');results.dprLists=await inspect();
 await frame.click('[data-dpr-view="helpers"]');results.dprHelpers=await inspect();
 await frame.click('.cat[data-category="dmp"]');results.dmp=await inspect();
 await frame.select("#filter-select","awol");results.dmpAwol=await inspect();
 await frame.click('.cat[data-category="manpower"]');results.manpower=await inspect();
 await frame.click('.cat[data-category="schedule"]');results.schedule=await inspect();
 await frame.click('[data-schedule-view="references"]');results.scheduleRefs=await frame.evaluate(()=>({cards:document.querySelectorAll(".schedule-reference-card").length,items:[...document.querySelectorAll(".schedule-reference-card")].map(x=>({name:x.querySelector("strong").textContent,count:x.querySelectorAll(".schedule-reference-item").length}))}));
 await frame.click('[data-schedule-view="mapping"]');results.scheduleMapping=await inspect();
 await frame.click('.cat[data-category="code"]');
 await frame.click('[data-source-edit="codeMap:5"]');
 const editBefore=await frame.evaluate(()=>({open:document.querySelector("#record-modal").classList.contains("open"),readonly:document.querySelector('#form-fields [name="field_0"]').readOnly,editable:!document.querySelector('#form-fields [name="field_1"]').disabled}));
 await frame.$eval('#form-fields [name="field_1"]',e=>e.value="Mayon GB");
 await frame.click('#record-form button[type="submit"]');
 const editAfter=await frame.evaluate(()=>({closed:!document.querySelector("#record-modal").classList.contains("open"),changed:document.querySelector('#data-content tbody tr[data-source-row="5"] td:nth-child(2)').innerText.includes("Mayon GB")}));
 results.edit={before:editBefore,after:editAfter};
 await frame.click("#open-import");
 const modalOpen=await frame.$eval("#import-modal",e=>e.classList.contains("open"));
 await frame.type("#spreadsheet-link","not-a-google-link");await frame.click("#link-validate");
 const invalid=await frame.evaluate(()=>({status:document.body.dataset.tfiSpreadsheetLinkStatus,feedback:document.querySelector("#link-feedback").textContent,disabled:document.querySelector("#import-submit").disabled}));
 await frame.$eval("#spreadsheet-link",e=>e.value="https://docs.google.com/spreadsheets/d/1rCbQ16wj7MRjQCFF3tA-WEMkudraJK0RkwcqayUlz7k/edit?gid=2098561343");
 await frame.click("#link-validate");
 const valid=await frame.evaluate(()=>({status:document.body.dataset.tfiSpreadsheetLinkStatus,id:document.querySelector("#import-detected-id").textContent,disabled:document.querySelector("#import-submit").disabled,sheet:document.querySelector("#import-sheet-name").textContent}));
 await frame.click("#cancel-import");
 results.import={modalOpen,invalid,valid,closed:await frame.$eval("#import-modal",e=>!e.classList.contains("open"))};
 await page.screenshot({path:path.join(dir,"master-data-full-source-desktop.png"),fullPage:true});
 await page.setViewport({width:390,height:844});
 results.mobile=await frame.evaluate(()=>({viewport:document.documentElement.clientWidth,pageWidth:document.documentElement.scrollWidth,noPageOverflow:document.documentElement.scrollWidth<=document.documentElement.clientWidth,sourceCards:getComputedStyle(document.querySelector(".source-strip")).gridTemplateColumns.trim().split(/\s+/).length,tableScroll:!!document.querySelector(".table-wrap")&&document.querySelector(".table-wrap").scrollWidth>document.querySelector(".table-wrap").clientWidth}));
 await page.screenshot({path:path.join(dir,"master-data-full-source-mobile.png"),fullPage:true});
 const checks={
  product:results.product.sourceId==="2138697021"&&results.product.headers===22&&results.product.count.includes("58 product variants")&&results.product.count.includes("26 family headers")&&results.product.count.includes("25 reserved"),
  code:results.code.sourceId==="2098561343"&&results.code.headers===4&&results.code.count.includes("68 source mappings"),
  codeUnmatched:results.codeUnmatched.count.includes("0 matching and 36 unmatched"),
  yield:results.yield.sourceId==="854969610"&&results.yield.headers===24,
  entry:results.entry.sourceId==="1628314566"&&results.entry.headers===5&&results.entry.count.includes("39 populated"),
  kpi:results.kpi.cards===10&&results.kpi.sourceId==="1955006742",
  dpr:results.dpr.families===32&&results.dpr.subtabs===3&&results.dpr.sourceId==="508797580",
  dprLists:results.dprLists.headers===5,
  dprHelpers:results.dprHelpers.headers===2,
  dmp:results.dmp.sourceId==="1070169465"&&results.dmp.count.includes("10 source notes"),
  dmpAwol:results.dmpAwol.rowCount===3,
  manpower:results.manpower.sourceId==="583741906"&&results.manpower.count.includes("445 source records")&&results.manpower.rowCount===25,
  schedule:results.schedule.sourceId==="156467196"&&results.schedule.count.includes("100 production-code"),
  scheduleRefs:results.scheduleRefs.cards===4,
  scheduleMapping:results.scheduleMapping.headers===2,
  edit:results.edit.before.open&&results.edit.before.readonly&&!results.edit.before.editable===false&&results.edit.after.closed&&results.edit.after.changed,
  import:results.import.modalOpen&&results.import.invalid.status==="invalid"&&results.import.valid.status==="valid"&&results.import.valid.id==="1rCbQ16wj7MRjQCFF3tA-WEMkudraJK0RkwcqayUlz7k"&&results.import.valid.disabled&&results.import.closed,
  mobile:results.mobile.noPageOverflow&&results.mobile.sourceCards===1&&results.mobile.tableScroll,
  errors:errors.length===0&&failed.filter(x=>!x.includes("ERR_ABORTED")).length===0
 };
 const pass=Object.values(checks).every(Boolean);
 console.log(JSON.stringify({results,checks,errors,failed:failed.filter(x=>!x.includes("ERR_ABORTED")),pass},null,2));
 await browser.close();if(!pass)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});