const http=require("http"),fs=require("fs"),path=require("path");
const puppeteer=require("C:/Users/Rominick/AppData/Local/npm-cache/_npx/4b4c857f6efdfb61/node_modules/puppeteer");
const designDir="C:/Users/Rominick/Desktop/TFI_NEW/design";
const mime={".html":"text/html; charset=utf-8",".js":"application/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".webp":"image/webp"};
const id="00000000-0000-0000-0000-000000000931";
const codes=["MDP-100-155","TMRMB-24-380",...Array.from({length:114},(_,i)=>"TEST-CODE-"+String(i+1).padStart(3,"0"))];
const catalog={product_codes:codes,line_numbers:["1","2","3"],source:{worksheet:"Coding DPR",sheet_id:1266086431,batch_slots:7,input_columns:"A:W",derived_column:"X",source_total_batch_slots:[1,2,3,4,5,6],batch_7_included_in_source_total:false}};
const record={id,coding_date:"2026-11-22",line_number:"2",lots:[
 {lot_number:1,production_date:"2026-11-21",product_code:"MDP-100-155",quantity:1000,product_code_reference_status:"matched"},
 {lot_number:7,production_date:"2026-11-21",product_code:"TMRMB-24-380",quantity:700,product_code_reference_status:"matched"}
],total_quantity:1000,batch7_quantity:700,lot_count:2,review_status:"unassessed",review_reasons:[],version:1,record_status:"active"};
const inboxRecord={...record,id:"00000000-0000-0000-0000-000000000932",line_number:null,review_status:"needs_review",review_reasons:["missing_line_number","incomplete_lot_2"]};
let posted=null,patched=null,saved=false,revisionOpened=0;
function respond(req,data,status=200){return req.respond({status,contentType:"application/json",headers:{"Cache-Control":"no-store"},body:JSON.stringify(data)});}
async function mock(page){
 await page.setRequestInterception(true);
 page.on("request",async req=>{
  const url=new URL(req.url()),p=url.pathname;
  try{
   if(p==="/api/coding-dpr/catalog")return respond(req,{catalog,permissions:{view:true,create:true,edit:true}});
   if(p==="/api/coding-dpr/records"&&req.method()==="GET"){
    const inbox=url.searchParams.get("review_status")==="needs_review";
    const records=inbox?[inboxRecord]:(saved?[record]:[]);
    return respond(req,{records,total_count:records.length,page:1,page_size:25,has_more:false});
   }
   if(p==="/api/coding-dpr/records"&&req.method()==="POST"){
    posted=JSON.parse(req.postData());saved=true;
    return respond(req,{inserted:1,duplicates:0,empty:0,results:[{row_index:1,status:"inserted",id}]},201);
   }
   if(p==="/api/coding-dpr/records/"+id&&req.method()==="GET")return respond(req,{record});
   if(p==="/api/coding-dpr/records/"+id&&req.method()==="PATCH"){
    patched=JSON.parse(req.postData());record.version++;record.total_quantity=1250;
    record.lots[0].quantity=1250;
    return respond(req,{changed:true,id,version:record.version,review_status:"unassessed"});
   }
   if(p==="/api/coding-dpr/records/"+id+"/revisions"){
    revisionOpened++;return respond(req,{record_id:id,revisions:[{version:2,changed_fields:["lots"],changed_at:"2026-11-22T10:00:00Z",change_reason:"test",before_data:{total_quantity:1000},after_data:{total_quantity:1250}}]});
   }
   if(p.startsWith("/api/"))return respond(req,{error:"Unexpected API request: "+p},404);
   return req.continue();
  }catch(e){try{return respond(req,{error:e.message},500);}catch{}}
 });
}
async function run(){
 const server=http.createServer((req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,"http://127.0.0.1").pathname);
  if(pathname==="/favicon.ico"){res.writeHead(204);res.end();return;}
  const file=path.resolve(designDir,"."+pathname);
  if(!file.startsWith(path.resolve(designDir)+path.sep)){res.writeHead(403);res.end();return;}
  fs.readFile(file,(e,b)=>{if(e){res.writeHead(404);res.end("Not found");return;}res.writeHead(200,{"Content-Type":mime[path.extname(file)]||"application/octet-stream"});res.end(b);});
 });
 await new Promise(r=>server.listen(8767,"127.0.0.1",r));
 const browser=await puppeteer.launch({headless:true,args:["--no-sandbox","--disable-setuid-sandbox"]});
 const page=await browser.newPage();await page.setViewport({width:1440,height:1000});
 const errors=[];page.on("pageerror",e=>errors.push(e.message));page.on("console",m=>{if(m.type()==="error")errors.push(m.text());});
 await mock(page);await page.goto("http://127.0.0.1:8767/coding-dpr-preview.html",{waitUntil:"domcontentloaded"});
 await page.waitForFunction(()=>document.body.dataset.codingDprBackend==="connected",{timeout:10000});
 const initial=await page.evaluate(()=>({rows:document.querySelectorAll("#cdpr-tbody tr").length,codes:document.querySelectorAll("#cdpr-product-codes option").length,lines:document.querySelectorAll('#cdpr-tbody tr:first-child [data-col="B"] option').length,saveEnabled:!document.querySelector("#cdpr-save").disabled}));
 await page.$eval('#cdpr-tbody tr:first-child [data-col="A"]',e=>{e.value="2026-11-22";e.dispatchEvent(new Event("input",{bubbles:true}));});
 await page.select('#cdpr-tbody tr:first-child [data-col="B"]',"2");
 await page.$eval('#cdpr-tbody tr:first-child [data-col="C"]',e=>{e.value="2026-11-21";e.dispatchEvent(new Event("input",{bubbles:true}));});
 await page.$eval('#cdpr-tbody tr:first-child [data-col="D"]',e=>{e.value="MDP-100-155";e.dispatchEvent(new Event("input",{bubbles:true}));});
 await page.$eval('#cdpr-tbody tr:first-child [data-col="E"]',e=>{e.value="1000";e.dispatchEvent(new Event("input",{bubbles:true}));});
 await page.$eval('#cdpr-tbody tr:first-child [data-col="U"]',e=>{e.value="2026-11-21";e.dispatchEvent(new Event("input",{bubbles:true}));});
 await page.$eval('#cdpr-tbody tr:first-child [data-col="V"]',e=>{e.value="TMRMB-24-380";e.dispatchEvent(new Event("input",{bubbles:true}));});
 await page.$eval('#cdpr-tbody tr:first-child [data-col="W"]',e=>{e.value="700";e.dispatchEvent(new Event("input",{bubbles:true}));});
 const totals=await page.evaluate(()=>({x:document.querySelector('#cdpr-tbody tr:first-child [data-col="X"]').value,source:document.querySelector("#cdpr-total-tins").textContent,batch7:document.querySelector("#cdpr-batch7-tins").textContent}));
 await page.$eval("#cdpr-save",e=>e.click());
 await new Promise(r=>setTimeout(r,1000));

 const savedPayload=posted;
 await page.$eval("#cdpr-toggle-register",e=>e.click());
 await page.waitForFunction(()=>document.querySelector("#cdpr-records-body")?.textContent.includes("1,000"));
 await page.$eval("#cdpr-tab-inbox",e=>e.click());
 await page.waitForFunction(()=>document.querySelector("#cdpr-records-body")?.textContent.includes("NEEDS REVIEW"));
 await page.$eval("#cdpr-tab-saved",e=>e.click());
 await page.waitForFunction(()=>document.querySelector('#cdpr-records-body button[data-action="edit"]'));
 await page.$eval('#cdpr-records-body button[data-action="edit"]',e=>e.click());
 await page.waitForFunction(()=>document.querySelector("#cdpr-edit-dialog")?.open);
 await page.$eval('[data-edit="E"]',e=>{e.value="1250";});
 await page.$eval("#cdpr-edit-save",e=>e.click());
 await page.waitForFunction(()=>!document.querySelector("#cdpr-edit-dialog").open);
 await page.$eval('#cdpr-records-body button[data-action="history"]',e=>e.click());
 await page.waitForFunction(()=>document.querySelector("#cdpr-history-dialog")?.open);
 const history=await page.$eval("#cdpr-history-content",e=>e.textContent);
 const mobile=await browser.newPage();await mobile.setViewport({width:390,height:844});await mock(mobile);
 await mobile.goto("http://127.0.0.1:8767/coding-dpr-preview.html",{waitUntil:"domcontentloaded"});
 await mobile.waitForFunction(()=>document.body.dataset.codingDprBackend==="connected");
 const mobileState=await mobile.evaluate(()=>({width:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,registerHidden:document.querySelector("#cdpr-register").hidden}));
 console.log(JSON.stringify({initial,totals,savedPayload,patched,revisionOpened,historyVisible:history.includes("Version 2"),mobileState,errors},null,2));
 await browser.close();await new Promise(r=>server.close(r));
 if(initial.rows!==12||initial.codes!==116||initial.lines!==4||!initial.saveEnabled||totals.x!=="1,000"||!savedPayload||savedPayload.records[0].record_data.X!==undefined||savedPayload.records[0].record_data.U!=="2026-11-21"||savedPayload.records[0].record_data.W!=="700"||!patched||!history.includes("Version 2")||revisionOpened!==1||errors.length)process.exitCode=1;
}
run().catch(e=>{console.error(e);process.exitCode=1;});
