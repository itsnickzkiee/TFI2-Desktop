const puppeteer=require("C:/Users/Rominick/AppData/Local/npm-cache/_npx/4b4c857f6efdfb61/node_modules/puppeteer");
const path=require("path"),{pathToFileURL}=require("url"),assert=require("assert");
(async()=>{
 const browser=await puppeteer.launch({headless:true,args:["--no-sandbox","--disable-setuid-sandbox","--allow-file-access-from-files"]});
 const page=await browser.newPage(),errors=[];page.on("pageerror",e=>errors.push(e.message));
 await page.evaluateOnNewDocument(()=>{
  const batch={id:"11111111-1111-4111-8111-111111111111",batch_ref:"TFI-TEST-001",module_key:"dmp_production",source_sheet_title:"DMP - Production",source_sheet_id:1312335050,source_name:"DMP Test Workbook",rows_staged:4,created_at:"2026-11-23T00:00:00Z"};
  const rows=[
   {id:"row-1",source_row_number:2,source_locator:"A2:K2",source_values:["2026-11-20","Line 1","Process A"],classification:"operational",completeness_status:"complete",missing_fields:[],duplicate_status:"none",import_status:"pending",created_at:"2026-11-23T00:00:00Z"},
   {id:"row-2",source_row_number:3,source_locator:"A3:K3",source_values:["2026-11-20","Line 2"],classification:"operational",completeness_status:"incomplete",missing_fields:["Worker"],duplicate_status:"none",import_status:"pending",created_at:"2026-11-23T00:01:00Z"},
   {id:"row-3",source_row_number:4,source_locator:"A4:K4",source_values:["2026-11-20","Line 3"],classification:"operational",completeness_status:"complete",missing_fields:[],duplicate_status:"exact_source_duplicate",import_status:"skipped_existing",created_at:"2026-11-23T00:02:00Z"},
   {id:"row-4",source_row_number:5,source_locator:"A5:K5",source_values:["2026-11-20","Unmapped row"],classification:"invalid",completeness_status:"not_assessed",missing_fields:[],duplicate_status:"none",import_status:"excluded",error_message:"Invalid classification",created_at:"2026-11-23T00:03:00Z"}
  ];
  window.__draftCalls=[];
  const drafts=[
   {id:"draft-1",import_row_id:"row-1",batch_id:batch.id,batch_ref:batch.batch_ref,source_row_number:2,source_locator:"A2:K2",source_values:rows[0].source_values,draft_values:{production_date:"2026-11-20",product_code:"P-1",process:"Process A",worker_name:"Worker A",worker_count:3,start_time:"07:00",end_time:"08:00",total_time_hours:1},classification:"operational",completeness_status:"complete",missing_fields:[],status:"draft",version:1},
   {id:"draft-2",import_row_id:"row-2",batch_id:batch.id,batch_ref:batch.batch_ref,source_row_number:3,source_locator:"A3:K3",source_values:rows[1].source_values,draft_values:{production_date:"2026-11-20",product_code:"P-2",process:"Process A",worker_name:"Worker B",worker_count:null,start_time:"07:00",end_time:"08:00",total_time_hours:1},classification:"operational",completeness_status:"incomplete",missing_fields:["worker_count"],status:"incomplete",version:1},
   {id:"draft-4",import_row_id:"row-4",batch_id:batch.id,batch_ref:batch.batch_ref,source_row_number:5,source_locator:"A5:K5",source_values:rows[3].source_values,draft_values:{production_date:"2026-11-20",product_code:"P-4",process:"Process A",worker_name:"Worker C",worker_count:1,start_time:"07:00",end_time:"08:00",total_time_hours:1},classification:"invalid",completeness_status:"unassessed",missing_fields:[],status:"review_required",version:1,review_reason:"Invalid classification"}
  ];
  window.fetch=async (url,options={})=>{
   const u=String(url),method=String(options.method||"GET").toUpperCase();
   if(u.includes("/api/import/batches?"))return new Response(JSON.stringify({batches:[batch],total:1}),{status:200,headers:{"Content-Type":"application/json"}});
   if(u.includes("/api/import/batches/11111111-1111-4111-8111-111111111111/rows"))return new Response(JSON.stringify({rows,page:1,page_size:200,has_more:false}),{status:200,headers:{"Content-Type":"application/json"}});
   if(u.includes("/api/dmp-production/import-drafts/prepare")&&method==="POST"){
    const body=JSON.parse(options.body);window.__draftCalls.push({method,url:u,body});
    return new Response(JSON.stringify({prepared:3,already_prepared:0,blocked_existing_or_duplicate:0,not_found_or_other_module:0}),{status:201,headers:{"Content-Type":"application/json"}});
   }
   if(u.includes("/api/dmp-production/import-drafts")&&method==="GET")return new Response(JSON.stringify({drafts,total:drafts.length}),{status:200,headers:{"Content-Type":"application/json"}});
   if(u.includes("/api/dmp-production/import-drafts/draft-2")&&method==="PATCH"){
    const body=JSON.parse(options.body);window.__draftCalls.push({method,url:u,body});drafts[1].draft_values={...drafts[1].draft_values,...body.values};drafts[1].version++;return new Response(JSON.stringify({draft:{id:"draft-2",version:drafts[1].version,status:"incomplete"}}),{status:200,headers:{"Content-Type":"application/json"}});
   }
   if(u.includes("/api/dmp-production/import-drafts/draft-2/approve")&&method==="POST"){
    window.__draftCalls.push({method,url:u,body:JSON.parse(options.body)});drafts[1].status="committed";drafts[1].version++;return new Response(JSON.stringify({committed:true,status:"committed",completeness_status:"incomplete",operational_record_id:"dmp-record-2"}),{status:200,headers:{"Content-Type":"application/json"}});
   }
   return new Response(JSON.stringify({error:"unexpected request "+method+" "+u}),{status:404,headers:{"Content-Type":"application/json"}});
  };
 });
 await page.setViewport({width:1440,height:1000});
 const q=new URLSearchParams({targetModule:"dmp-production"});
 await page.goto(pathToFileURL(path.join("C:/Users/Rominick/Desktop/TFI_NEW/design","module-import-inbox-preview.html")).href+"?"+q,{waitUntil:"load"});
 await page.waitForFunction(()=>document.querySelector("#metric-total").textContent==="4",{timeout:10000});
 const result=await page.evaluate(()=>({
  module:document.querySelector("#module-select").value,
  worksheet:document.querySelector("#source-worksheet").textContent,
  total:document.querySelector("#metric-total").textContent,
  ready:document.querySelector("#metric-ready").textContent,
  incomplete:document.querySelector("#metric-incomplete").textContent,
  protected:document.querySelector("#metric-existing").textContent,
  rowCount:document.querySelectorAll("#inbox-rows tr").length,
  visible:document.querySelector("#visible-count").textContent,
  heldCheckboxEnabled:!document.querySelector('[data-id="row-4"]').disabled,
  existingCheckboxDisabled:document.querySelector('[data-id="row-3"]').disabled,
  selectAllEnabled:!document.querySelector("#select-all").disabled
 }));
 await page.click("#select-all");
 const selected=await page.evaluate(()=>({count:document.querySelector("#selected-count").textContent,checked:[...document.querySelectorAll(".row-check")].filter(x=>x.checked).length,disabledExisting:document.querySelector('[data-id="row-3"]').disabled}));
 const prepareButtonEnabled=await page.$eval("#prepare-drafts",el=>!el.disabled);
 await page.click("#prepare-drafts");
 await page.waitForSelector("#dmp-import-drafts-dialog[open]",{timeout:5000});
 const draftDialog=await page.evaluate(()=>({open:document.querySelector("#dmp-import-drafts-dialog").open,rows:document.querySelectorAll("#dmp-drafts-content tbody tr").length,hasIncomplete:document.querySelector("#dmp-drafts-content").innerText.includes("incomplete")}));
 await page.click('[data-edit-draft="draft-2"]');
 await page.waitForSelector("#dmp-draft-edit-form",{timeout:5000});
 await page.$eval('input[name="worker_count"]',el=>{el.value="2";el.dispatchEvent(new Event("input",{bubbles:true}));});
 await page.click('#dmp-draft-edit-form button[type="submit"]');
 await page.waitForFunction(()=>window.__draftCalls.some(c=>c.method==="PATCH"),{timeout:5000});
 page.on("dialog",dialog=>dialog.accept());
 await page.click('[data-approve-draft="draft-2"]');
 await page.waitForFunction(()=>window.__draftCalls.some(c=>c.url.endsWith("/approve")),{timeout:5000});
 const workflow=await page.evaluate(()=>({prepare:window.__draftCalls.some(c=>c.url.endsWith("/prepare")),prepareRowCount:window.__draftCalls.find(c=>c.url.endsWith("/prepare"))?.body.row_ids.length,edited:window.__draftCalls.some(c=>c.method==="PATCH"&&c.body.values.worker_count===2),approved:window.__draftCalls.some(c=>c.url.endsWith("/approve"))}));
 await page.click("#dmp-drafts-close");
 await page.click('[data-filter="incomplete"]');
 const filter=await page.evaluate(()=>({rows:document.querySelectorAll("#inbox-rows tr").length,text:document.querySelector("#inbox-rows").innerText}));
 await page.setViewport({width:390,height:844});
 const mobile=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth}));
 await browser.close();
 const checks={module:result.module==="dmp-production",worksheet:result.worksheet==="DMP - Production",counts:result.total==="4"&&result.ready==="1"&&result.incomplete==="1"&&result.protected==="1",fourRows:result.rowCount===4,reviewRowsSelectable:result.heldCheckboxEnabled,existingRowsBlocked:result.existingCheckboxDisabled,selectAllWorks:result.selectAllEnabled&&selected.checked===3&&selected.count.includes("3 eligible"),prepareButtonEnabled,draftDialogWorks:draftDialog.open&&draftDialog.rows===3&&draftDialog.hasIncomplete,prepareCreatesThree:workflow.prepare&&workflow.prepareRowCount===3,editDraftWorks:workflow.edited,approveDraftWorks:workflow.approved,incompleteFilter:filter.rows===1&&filter.text.includes("Incomplete"),mobileNoOverflow:!mobile.overflow,noJsErrors:errors.length===0};
 console.log(JSON.stringify({result,selected,prepareButtonEnabled,draftDialog,workflow,filter,mobile,errors,checks,pass:Object.values(checks).every(Boolean)},null,2));
 if(!Object.values(checks).every(Boolean))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});