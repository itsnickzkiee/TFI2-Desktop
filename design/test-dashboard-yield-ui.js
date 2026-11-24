const puppeteer=require("C:/Users/Rominick/AppData/Local/npm-cache/_npx/4b4c857f6efdfb61/node_modules/puppeteer");
const path=require("path");
const{pathToFileURL}=require("url");
const dir="C:/Users/Rominick/Desktop/TFI_NEW/design";
const file=pathToFileURL(path.join(dir,"dashboard-preview.html")).href;
const records=[
 {id:"y1",block_key:"BLK_01",product_key:"DPGP",product_name:"Green Peas",production_date:"2026-11-23",product_code:"CODE-1",total_fg_tins:10000,main_yield:.95,stage2_yield:.90,stage3_yield:null,bloom_rate:1.3,lid_reject:.01,can_reject:.02,box_reject:.03,label_reject:.04},
 {id:"y2",block_key:"BLK_01",product_key:"DPGP",product_name:"Green Peas",production_date:"2026-11-22",product_code:"CODE-1",total_fg_tins:12000,main_yield:.97,stage2_yield:.92,stage3_yield:.88,bloom_rate:1.5,lid_reject:.02,can_reject:.01,box_reject:.04,label_reject:.03},
 {id:"y3",block_key:"BLK_02",product_key:"CORN",product_name:"Corn",production_date:"2026-11-21",product_code:"CODE-2",total_fg_tins:5000,main_yield:.90,stage2_yield:null,stage3_yield:.85,bloom_rate:1.2,lid_reject:.03,can_reject:.04,box_reject:.02,label_reject:.01}
];
(async()=>{
 const browser=await puppeteer.launch({headless:true,args:["--no-sandbox","--disable-setuid-sandbox"]});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[],failed=[];
 page.on("pageerror",error=>errors.push(error.message));
 page.on("console",message=>{if(message.type()==="error")errors.push(message.text())});
 page.on("requestfailed",request=>failed.push(request.url()+" :: "+request.failure()?.errorText));
 await page.evaluateOnNewDocument(data=>{
  window.__yieldUrls=[];
  window.fetch=async input=>{
   const url=String(input);
   if(url.includes("/api/dashboard/coverage"))return{ok:true,status:200,json:async()=>({source:"TFI2",total_operational_records:3,visible_module_count:3,modules_with_records:2,modules:[],imports:{batches_in_review:0},audit_events:0})};
   if(url.includes("/api/dashboard/filter-catalog"))return{ok:true,status:200,json:async()=>({source:"TFI2",status:"available",options:{year:["2026"],view:["Daily","Weekly","Monthly"],month:["Nov"],week:["48"],product_name:["All","Green Peas","Corn"],product_code:["All","CODE-1","CODE-2"],machine:["All"]},product_map:{"CODE-1":"Green Peas","CODE-2":"Corn"}})};
   if(url.includes("/api/dashboard/analytics"))return{ok:true,status:200,json:async()=>({source:"TFI2",calculation_contract:"source-workbook",metrics:{},modules:{},reports:{},readiness:{verified_kpi_groups:[],pending_kpi_groups:[]}})};
   if(url.includes("/api/yield/log")){
    window.__yieldUrls.push(url);
    const query=new URL(url,"http://tfi.local");
    const offset=Number(query.searchParams.get("offset")||0);
    const filtered=query.searchParams.has("product_name");
    const selected=filtered?data.records.slice(0,2):offset===0?data.records.slice(0,2):data.records.slice(2);
    return{ok:true,status:200,json:async()=>({source:"TFI2",records:selected,count:selected.length,limit:100,offset,has_more:!filtered&&offset===0,mapped_products:39,yield_map_note:"Other 95% targets are placeholders; change or clear them.",read_only:true})};
   }
   throw new Error("Unexpected dashboard Yield UI request: "+url);
  };
 },{records});
 await page.goto(file,{waitUntil:"load"});
 await page.waitForFunction(()=>document.querySelector("#yield-record-status")?.textContent==="2 Yield Log rows loaded");
 await page.click("#kpi-tab-yield");
 const firstPage=await page.evaluate(()=>({
  active:document.querySelector("[data-kpi-tab].active")?.dataset.kpiTab,
  main:document.querySelector("#yield-average-main")?.textContent,
  stage2:document.querySelector("#yield-average-stage2")?.textContent,
  bloom:document.querySelector("#yield-average-bloom")?.textContent,
  detailRows:document.querySelectorAll("#yield-log-rows tr").length,
  detailColumns:document.querySelector("#yield-log-rows tr")?.children.length,
  moreVisible:!document.querySelector("#yield-log-load-more").hidden,
  sourceNote:document.querySelector("#yield-source-copy")?.textContent
 }));
 await page.click("#yield-log-load-more");
 await page.waitForFunction(()=>document.querySelector("#yield-record-status")?.textContent==="3 Yield Log rows loaded");
 const complete=await page.evaluate(()=>({
  main:document.querySelector("#yield-average-main")?.textContent,
  overviewMain:document.querySelector("#kpi-panel-overview .kpi-stat-card .kpi-stat-value:nth-child(2)")?.textContent,
  stage2:document.querySelector("#yield-average-stage2")?.textContent,
  stage3:document.querySelector("#yield-average-stage3")?.textContent,
  bloom:document.querySelector("#yield-average-bloom")?.textContent,
  lid:document.querySelector("#yield-average-lid")?.textContent,
  can:document.querySelector("#yield-average-can")?.textContent,
  box:document.querySelector("#yield-average-box")?.textContent,
  label:document.querySelector("#yield-average-label")?.textContent,
  scoreRows:[...document.querySelectorAll("#yield-scorecard-rows tr")].map(row=>[...row.children].map(cell=>cell.textContent)),
  detailRows:document.querySelectorAll("#yield-log-rows tr").length,
  detailColumns:document.querySelector("#yield-log-rows tr")?.children.length,
  moreHidden:document.querySelector("#yield-log-load-more").hidden,
  overviewAverage:[...document.querySelectorAll("#kpi-panel-overview .kpi-stat-card")].find(card=>card.querySelector(".kpi-stat-label")?.textContent.trim().startsWith("AVG % YIELD"))?.querySelector(".kpi-stat-value")?.textContent
 }));
 await page.select("#kpi-filter-product","Green Peas");
 await page.select("#kpi-filter-code","CODE-1");
 await page.click("#kpi-analytics-refresh");
 await page.waitForFunction(()=>window.__yieldUrls?.length>=3);
 const filteredUrl=await page.evaluate(()=>window.__yieldUrls[window.__yieldUrls.length-1]);
 await page.screenshot({path:path.join(dir,"dashboard-yield-desktop.png"),fullPage:true});
 await page.setViewport({width:390,height:844});
 const mobile=await page.evaluate(()=>({
  width:innerWidth,client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,
  overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth,
  tableScrollable:document.querySelector("#yield-log-wrap").scrollWidth>document.querySelector("#yield-log-wrap").clientWidth,
  yieldCards:getComputedStyle(document.querySelector("#kpi-panel-yield .kpi-stat-grid")).gridTemplateColumns
 }));
 await page.screenshot({path:path.join(dir,"dashboard-yield-mobile.png"),fullPage:true});
 const result={firstPage,complete,filteredUrl,mobile,errors,failed};
 result.pass=firstPage.active==="yield"&&firstPage.main==="96%"&&firstPage.stage2==="91%"&&firstPage.bloom==="1.4x"&&
  firstPage.detailRows===2&&firstPage.detailColumns===12&&firstPage.moreVisible&&firstPage.sourceNote.includes("95% targets are placeholders")&&
  complete.main==="94%"&&complete.stage2==="91%"&&complete.stage3==="86.5%"&&complete.bloom==="1.33x"&&
  complete.lid==="2%"&&complete.can==="2.33%"&&complete.box==="3%"&&complete.label==="2.67%"&&
  complete.scoreRows.length===2&&complete.scoreRows[0][0]==="Green Peas"&&complete.scoreRows[0][1]==="22,000"&&
  complete.detailRows===3&&complete.detailColumns===12&&complete.moreHidden&&complete.overviewAverage==="94%"&&
  filteredUrl.includes("product_name=Green+Peas")&&filteredUrl.includes("product_code=CODE-1")&&
  !mobile.overflow&&mobile.tableScrollable&&errors.length===0&&failed.length===0;
 console.log(JSON.stringify(result,null,2));
 await browser.close();
 if(!result.pass)process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1});
