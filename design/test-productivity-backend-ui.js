const http=require("http"),fs=require("fs"),path=require("path");
const puppeteer=require("C:/Users/Rominick/AppData/Local/npm-cache/_npx/4b4c857f6efdfb61/node_modules/puppeteer");
const designDir="C:/Users/Rominick/Desktop/TFI_NEW/design";
const mime={".html":"text/html; charset=utf-8",".js":"application/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".webp":"image/webp"};
let posted=null,patched=null,saved=null,previewCalls=0;
const record={id:"00000000-0000-0000-0000-000000000921",production_date:"2026-11-22",product_code:"MDP-100-155",line:"AGRILINE",planned_run_hours:10,actual_output_tins:85847,dented:151,false_seam:1,flipper:0,bulged:0,panel:0,buckling:0,total_fg_rejects:152,manpower_hours_dmp:120,target_output_12h_tins:102600,standard_productivity_tins_per_mhr:712.5,standard_output_actual_mhr:85500,productivity_tins_per_mhr:715.39,output_attainment:0.8369,reject_rate:0.00176,iso_week:47,month_number:11,product_name:"MAYON DRY PEAS 155G X 100",version:1,record_status:"active"};
const catalog={products:[{code:"MDP-100-155",name:"MAYON DRY PEAS 155G X 100",capacity:102600,std:712.5}],lines:["AGRILINE","MEATLINE"],source:{sheet_name:"Productivity",sheet_id:1688444278}};
function respond(req,data,status=200){return req.respond({status,contentType:"application/json",headers:{"Cache-Control":"no-store"},body:JSON.stringify(data)});}
async function mock(page){
 await page.setRequestInterception(true);
 page.on("request",async req=>{
  const url=new URL(req.url()),p=url.pathname;
  try{
   if(p==="/api/productivity/catalog")return respond(req,{catalog,permissions:{view:true,create:true,edit:true}});
   if(p==="/api/productivity/preview"){previewCalls++;return respond(req,{calculated:{total_fg_rejects:152,manpower_hours_dmp:120,target_output_12h_tins:102600,standard_productivity_tins_per_mhr:712.5,standard_output_actual_mhr:85500,productivity_tins_per_mhr:715.39,output_attainment:0.8369,reject_rate:0.00176,iso_week:47,month_number:11,product_name:"MAYON DRY PEAS 155G X 100"}});}
   if(p==="/api/productivity/records"&&req.method()==="GET")return respond(req,{records:saved?[record]:[],page:1,page_size:25,total_count:saved?1:0,has_more:false});
   if(p==="/api/productivity/records"&&req.method()==="POST"){posted=JSON.parse(req.postData());saved=true;return respond(req,{inserted:1,duplicates:0,empty:0,results:[{row_index:1,status:"inserted",id:record.id}]},201);}
   if(p==="/api/productivity/records/"+record.id&&req.method()==="GET")return respond(req,{record});
   if(p==="/api/productivity/records/"+record.id&&req.method()==="PATCH"){patched=JSON.parse(req.postData());record.actual_output_tins=Number(patched.changes.actual_output_tins);record.version++;return respond(req,{changed:true,id:record.id,version:record.version});}
   if(p==="/api/productivity/records/"+record.id+"/revisions")return respond(req,{record_id:record.id,revisions:[{version:2,changed_fields:["actual_output_tins"],changed_at:"2026-11-22T10:00:00Z",before_data:{actual_output_tins:85847},after_data:{actual_output_tins:85848},change_reason:"test"}]});
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
 await new Promise(r=>server.listen(8766,"127.0.0.1",r));
 const browser=await puppeteer.launch({headless:true,args:["--no-sandbox","--disable-setuid-sandbox"]});
 const page=await browser.newPage();await page.setViewport({width:1440,height:1000});
 const errors=[];page.on("pageerror",e=>errors.push(e.message));page.on("console",m=>{if(m.type()==="error")errors.push(m.text());});
 await mock(page);await page.goto("http://127.0.0.1:8766/productivity-preview.html",{waitUntil:"networkidle0"});
 await page.waitForFunction(()=>document.querySelector("#pr-live-status")?.classList.contains("ok"));
 await page.select('#pr-tbody tr:first-child [data-col="B"]',"MDP-100-155");
 await page.$eval('#pr-tbody tr:first-child [data-col="A"]',e=>{e.value="2026-11-22";e.dispatchEvent(new Event("input",{bubbles:true}));});
 await page.$eval('#pr-tbody tr:first-child [data-col="C"]',e=>{e.value="AGRILINE";e.dispatchEvent(new Event("change",{bubbles:true}));});
 await page.$eval('#pr-tbody tr:first-child [data-col="D"]',e=>{e.value="10";e.dispatchEvent(new Event("input",{bubbles:true}));});
 await page.$eval('#pr-tbody tr:first-child [data-col="E"]',e=>{e.value="85847";e.dispatchEvent(new Event("input",{bubbles:true}));});
 await page.waitForFunction(()=>document.querySelector('#pr-tbody tr:first-child [data-col="M"]').value==="120");
 await new Promise(r=>setTimeout(r,700));
 const previewState=await page.evaluate(()=>Object.fromEntries(["L","M","N","O","P","Q","R","S","T","U","V"].map(k=>[k,document.querySelector('#pr-tbody tr:first-child [data-col="'+k+'"]').value])));
 const preview=previewState.N;
 await page.$eval("#pr-save",e=>e.click());await page.waitForFunction(()=>document.querySelector("#pr-saved-count")?.textContent.includes("1 saved"));
 const saveState={enabled:await page.$eval("#pr-save",e=>!e.disabled),posted,previewTarget:preview,previewCalls};
 await page.waitForSelector('#pr-saved-body button[data-action="edit"]');
 await page.$eval('#pr-saved-body button[data-action="edit"]',e=>e.click());await page.waitForFunction(()=>document.querySelector("#pr-edit-dialog")?.open);
 await page.$eval('[data-edit="actual_output_tins"]',e=>{e.value="85848";});
 await page.$eval("#pr-edit-save",e=>e.click());await page.waitForFunction(()=>!document.querySelector("#pr-edit-dialog").open);
 await page.waitForSelector('#pr-saved-body button[data-action="history"]');
 await page.$eval('#pr-saved-body button[data-action="history"]',e=>e.click());await page.waitForFunction(()=>document.querySelector("#pr-history-dialog")?.open);
 const history=await page.$eval("#pr-history-content",e=>e.textContent);
 const mobile=await browser.newPage();await mobile.setViewport({width:390,height:844});await mock(mobile);
 await mobile.goto("http://127.0.0.1:8766/productivity-preview.html",{waitUntil:"networkidle0"});
 await mobile.waitForFunction(()=>document.querySelector("#pr-live-status")?.classList.contains("ok"));
 const mobileState=await mobile.evaluate(()=>({width:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,savedSection:!!document.querySelector("#pr-saved-records")}));
 console.log(JSON.stringify({saveState,previewState,patched,historyVisible:history.includes("Version 2"),mobileState,errors},null,2));
 await browser.close();await new Promise(r=>server.close(r));
 if(!saveState.enabled||!posted||posted.records.length!==1||previewState.N!=="102600"||previewState.V!=="MAYON DRY PEAS 155G X 100"||Object.keys(posted.records[0].record_data).some(k=>["total_fg_rejects","manpower_hours_dmp","target_output_12h_tins"].includes(k))||!patched||!history.includes("Version 2")||errors.length)process.exitCode=1;
}
run().catch(e=>{console.error(e);process.exitCode=1;});
