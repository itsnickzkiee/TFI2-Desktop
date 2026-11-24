const puppeteer=require("C:/Users/Rominick/AppData/Local/npm-cache/_npx/4b4c857f6efdfb61/node_modules/puppeteer");const path=require("path");const{pathToFileURL}=require("url");const dir="C:/Users/Rominick/Desktop/TFI_NEW/design";
const base={targetLabel:"DMR Production",sourceWorksheet:"DMR Production",sourceSheetId:"2048043346",sourceName:"Sample workbook",sourceType:"google_sheets",batchId:"UI-AUDIT"};
const url=(file,params={})=>pathToFileURL(path.join(dir,file)).href+"?"+new URLSearchParams({...base,...params});
(async()=>{
 const b=await puppeteer.launch({headless:true,args:["--no-sandbox","--disable-setuid-sandbox","--allow-file-access-from-files"]});
 const errors=[];
 async function inspect(file,params={},width=1440){const p=await b.newPage();await p.setViewport({width,height:950});p.on("pageerror",e=>errors.push(file+": "+e.message));await p.goto(url(file,params),{waitUntil:"load"});const data=await p.evaluate(()=>({title:document.title,steps:document.querySelectorAll('[aria-label="Import workflow"] > div').length||(document.querySelector("#confirm-view")?.querySelectorAll(".steps .step").length||0),active:[...document.querySelectorAll('[aria-label="Import workflow"] .active, .steps .current')].map(x=>x.textContent.replace(/\s+/g," ").trim()),width:document.documentElement.scrollWidth,viewport:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,moduleFilter:!!document.querySelector("#module-filter"),moduleOptions:[...document.querySelectorAll("#target-module option")].map(x=>x.textContent.trim()),approvalDisabled:document.querySelector("#confirm-import")?.disabled,duplicateSummary:document.querySelector("#duplicate-approval-context")?.classList.contains("show")}));await p.close();return data}
 const center=await inspect("spreadsheet-import-center-preview.html");
 const scan=await inspect("scan-progress-worksheet-detection-preview.html");
 const inbox=await inspect("central-import-inbox-preview.html");
 const duplicate=await inspect("duplicate-review-resolution-preview.html");
 const approval=await inspect("import-confirmation-results-preview.html",{duplicateReviewComplete:"1",confirmedDuplicates:"1",approvedNew:"2",onHold:"0",pending:"0"});
 const mobile=[];
 for(const f of ["spreadsheet-import-center-preview.html","scan-progress-worksheet-detection-preview.html","central-import-inbox-preview.html","duplicate-review-resolution-preview.html","import-confirmation-results-preview.html"]){const d=await inspect(f,{duplicateReviewComplete:"1",confirmedDuplicates:"1",approvedNew:"2",onHold:"0",pending:"0"},390);mobile.push({file:f,width:d.width,viewport:d.viewport,overflow:d.overflow,steps:d.steps})}
 const p=await b.newPage();await p.setViewport({width:1440,height:950});p.on("pageerror",e=>errors.push("duplicate interaction: "+e.message));await p.goto(url("duplicate-review-resolution-preview.html"),{waitUntil:"load"});
 await p.click('[data-review="1"]');await p.click("#choose-duplicate");await p.click('[data-review="2"]');await p.click("#choose-distinct");await p.click('[data-review="3"]');await p.click("#choose-distinct");await p.click("#continue-approval");await p.waitForFunction(()=>location.pathname.endsWith("import-confirmation-results-preview.html"),{timeout:10000});
 const flow=await p.evaluate(()=>({path:location.pathname,steps:document.querySelectorAll("#confirm-view .steps .step").length,summary:document.querySelector("#duplicate-approval-context").classList.contains("show"),duplicateCount:document.querySelector("#approval-duplicates").textContent,newCount:document.querySelector("#approval-new").textContent,hold:document.querySelector("#approval-hold").textContent,pending:document.querySelector("#approval-pending").textContent,disabled:document.querySelector("#confirm-import").disabled}));
 await b.close();
 const moduleOptions=center.moduleOptions;
 const checks={
  centerSixSteps:center.steps===6,
  scanSixSteps:scan.steps===6,
  inboxSixSteps:inbox.steps===6,
  duplicateSixSteps:duplicate.steps===6,
  approvalSixSteps:approval.steps===6,
  selectiveModuleChoices:moduleOptions.length>=10&&!moduleOptions.some(x=>/import all|master data|reports/i.test(x)),
  inboxNoAllModuleFilter:!inbox.moduleFilter,
  finalApprovalShowsReviewSummary:approval.duplicateSummary===true&&approval.approvalDisabled===true,
  duplicateResolutionCarriesForward:flow.steps===6&&flow.summary&&flow.duplicateCount==="1"&&flow.newCount==="2"&&flow.hold==="0"&&flow.pending==="0"&&flow.disabled,
  allMobilePagesFit:mobile.every(x=>!x.overflow),
  noBrowserErrors:errors.length===0
 };
 console.log(JSON.stringify({center,scan,inbox,duplicate,approval,mobile,flow,errors,checks,pass:Object.values(checks).every(Boolean)},null,2));
 if(!Object.values(checks).every(Boolean))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});