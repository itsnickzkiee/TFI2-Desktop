const fs=require("fs");
const path=require("path");
const http=require("http");
const root=path.resolve(__dirname,"../..");
const designDir=path.join(root,"design");
const manifest=JSON.parse(fs.readFileSync(path.join(root,"src/tfi_backend/dmr_coding_manifest.json"),"utf8"));
const calls={create:[],updates:[],history:0,filters:[]};
const saved=[],revisions=[];
function send(res,status,payload){const body=JSON.stringify(payload);res.writeHead(status,{"Content-Type":"application/json; charset=utf-8","Content-Length":Buffer.byteLength(body),"Cache-Control":"no-store"});res.end(body);}
async function readBody(req){let body="";for await(const chunk of req)body+=chunk;return JSON.parse(body||"{}");}
function duration(stop,resume){if(!stop||!resume)return null;const toMin=v=>{const [h,m]=String(v).slice(0,5).split(":").map(Number);return h*60+m;};return (toMin(resume)-toMin(stop)+1440)%1440;}
const catalog={product_codes:manifest.productCodes,product_names:manifest.productNames,lines:manifest.lines,categories:manifest.categories.map(code=>({code,description:code})),factors:manifest.factors,historical_codes_not_in_master_list:["TMWKC-6-2950"],source:{worksheet:manifest.sourceSheet,sheet_id:manifest.sourceSheetId,range:manifest.sourceRange,blank_template_first_row:4775}};
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,"http://127.0.0.1:5116"),pathname=decodeURIComponent(url.pathname);
 if(pathname==="/api/dmr-coding/catalog"&&req.method==="GET")return send(res,200,{catalog,permissions:{view:true,create:true,edit:true}});
 if(pathname==="/api/dmr-coding/records"&&req.method==="GET"){
  calls.filters.push(Object.fromEntries(url.searchParams.entries()));const page=Number(url.searchParams.get("page")||1),size=Number(url.searchParams.get("page_size")||25);
  return send(res,200,{records:saved.slice((page-1)*size,page*size),page,page_size:size,has_more:false});
 }
 if(pathname==="/api/dmr-coding/records"&&req.method==="POST"){
  const body=await readBody(req);calls.create.push(body);const results=[];
  for(const item of body.records){const d=item.record_data,id="00000000-0000-0000-0000-"+String(saved.length+1).padStart(12,"0");
   const code=d.B||null,matched=!!code&&catalog.product_codes.includes(code);
   const record={id,production_date:d.A||null,product_code:code,line:d.C||null,stop_time:d.D||null,resume_time:d.E||null,
    downtime_minutes:duration(d.D,d.E),downtime_hours:duration(d.D,d.E)===null?null:duration(d.D,d.E)/60,
    category:d.H||null,factor:d.I||null,reason:d.J||null,product_code_reference_status:!code?"not_entered":matched?"matched":"unmatched",
    completeness_status:"unassessed",source_import_row_id:null,entry_source:"manual",version:1,record_status:"active",created_at:"2026-11-22T10:00:00Z"};
   saved.push(record);results.push({row_index:item.row_index,status:"inserted",id,product_code_reference_status:record.product_code_reference_status});
  }
  return send(res,201,{inserted:results.length,duplicates:0,empty:0,results});
 }
 const historyMatch=pathname.match(/^\/api\/dmr-coding\/records\/([0-9a-f-]+)\/revisions$/);
 if(historyMatch&&req.method==="GET"){calls.history++;return send(res,200,{record_id:historyMatch[1],revisions});}
 const recordMatch=pathname.match(/^\/api\/dmr-coding\/records\/([0-9a-f-]+)$/);
 if(recordMatch&&req.method==="PATCH"){
  const body=await readBody(req);calls.updates.push(body);const record=saved.find(item=>item.id===recordMatch[1]);
  if(!record)return send(res,404,{error:"Record not found"});if(record.version!==body.expected_version)return send(res,409,{error:"Version conflict"});
  const before={...record},mapping={A:"production_date",B:"product_code",C:"line",D:"stop_time",E:"resume_time",H:"category",I:"factor",J:"reason"};
  for(const [key,value] of Object.entries(body.changes||{}))record[mapping[key]]=value||null;
  const code=record.product_code;record.product_code_reference_status=!code?"not_entered":catalog.product_codes.includes(code)?"matched":"unmatched";
  record.downtime_minutes=duration(record.stop_time,record.resume_time);record.downtime_hours=record.downtime_minutes===null?null:record.downtime_minutes/60;
  record.version++;record.updated_at="2026-11-22T10:10:00Z";
  revisions.unshift({version:record.version,before_data:before,after_data:{...record},changed_fields:Object.keys(mapping).filter(k=>before[mapping[k]]!==record[mapping[k]]),change_reason:body.change_reason||null,changed_at:record.updated_at});
  return send(res,200,{id:record.id,changed:true,version:record.version});
 }
 if(pathname==="/favicon.ico"){res.writeHead(204);res.end();return;}
 const target=path.resolve(designDir,"."+pathname);
 if(!target.startsWith(designDir)||!fs.existsSync(target)||!fs.statSync(target).isFile()){res.writeHead(404);res.end("Not found");return;}
 const ext=path.extname(target).toLowerCase(),type={".html":"text/html; charset=utf-8",".js":"application/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".webp":"image/webp",".png":"image/png"}[ext]||"application/octet-stream";
 res.writeHead(200,{"Content-Type":type,"Cache-Control":"no-store"});fs.createReadStream(target).pipe(res);
});
async function main(){
 let puppeteer;try{puppeteer=require("puppeteer");}catch{
  const cache=path.join(process.env.LOCALAPPDATA||"C:\\Users\\Rominick\\AppData\\Local","npm-cache","_npx");
  const found=fs.readdirSync(cache).map(dir=>path.join(cache,dir,"node_modules","puppeteer")).find(file=>fs.existsSync(file));
  if(!found)throw new Error("Puppeteer is not installed.");puppeteer=require(found);
 }
 await new Promise(resolve=>server.listen(5116,"127.0.0.1",resolve));
 const browser=await puppeteer.launch({headless:true,args:["--no-sandbox","--disable-setuid-sandbox"]});
 try{
  const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];
  page.on("pageerror",error=>errors.push(error.message));
  await page.goto("http://127.0.0.1:5116/dmr-coding-preview.html",{waitUntil:"networkidle0"});
  await page.waitForFunction(()=>document.body.dataset.tfiReady==="true",{timeout:15000});
  const initial=await page.evaluate(()=>({ready:document.body.dataset.tfiReady,source:document.body.dataset.tfiDmcSource,
   rows:document.querySelectorAll("#dmc-tbody tr").length,codes:document.querySelectorAll("#dmc-product-codes option").length,
   categories:document.querySelectorAll("#dmc-filter-category option").length-1,factors:document.querySelectorAll("#dmc-filter-factor option").length-1,
   sourceRow:document.querySelector("#dmc-tbody tr").dataset.sourceRow}));
  if(initial.rows!==12||initial.codes!==116||initial.categories!==8||initial.factors!==13||initial.sourceRow!=="4775"||initial.source!=="TFI2")
   throw new Error("DMR Coding form/catalog did not initialize: "+JSON.stringify(initial));
  const row='tr[data-row="1"]';
  const set=(selector,value)=>page.$eval(selector,(el,v)=>{el.value=v;el.dispatchEvent(new Event("input",{bubbles:true}));},value);
  await set(row+' [data-col="A"]',"2026-11-22");await set(row+' [data-col="B"]',"MDP-100-155");await set(row+' [data-col="C"]',"AGRILINE");
  await set(row+' [data-col="D"]',"23:50");await set(row+' [data-col="E"]',"00:20");
  await page.select(row+' [data-col="H"]',"BD");await page.select(row+' [data-col="I"]',"Change Basket");
  await set(row+' [data-col="J"]',"Coding ink issue");
  const derived=await page.$eval(row,rowEl=>({minutes:rowEl.querySelector('[data-col="F"]').value,hours:rowEl.querySelector('[data-col="G"]').value,name:rowEl.querySelector('[data-col="K"]').value}));
  if(derived.minutes!=="30"||derived.hours!=="0.5000"||derived.name!=="DPGP")throw new Error("DMR Coding derived fields incorrect: "+JSON.stringify(derived));
  await page.click("#dmc-save");
  await page.waitForFunction(()=>document.querySelector("#dmc-saved-tbody tr td")?.textContent?.includes("2026")||document.querySelector("#dmc-saved-tbody tr td")?.textContent?.includes("11/22"),{timeout:10000});
  if(calls.create.length!==1)throw new Error("DMR Coding save did not call API.");
  const posted=calls.create[0].records[0].record_data;
  if(posted.B!=="MDP-100-155"||posted.I!=="Change Basket"||posted.J!=="Coding ink issue")throw new Error("DMR Coding payload lost source inputs.");
  await page.click('#dmc-saved-tbody button[data-action="edit"]');
  await page.$eval("#dmc-edit-reason",el=>{el.value="Corrected coding reason";});
  await page.$eval("#dmc-edit-change-reason",el=>{el.value="Clarified event details";});
  await page.click("#dmc-edit-save");
  await page.waitForFunction(()=>document.querySelector("#dmc-saved-tbody tr")?.innerText.includes("Corrected coding reason"),{timeout:10000});
  if(calls.updates.length!==1||calls.updates[0].expected_version!==1||calls.updates[0].changes.J!=="Corrected coding reason")throw new Error("DMR Coding versioned update failed.");
  await page.click('#dmc-saved-tbody button[data-action="history"]');
  await page.waitForFunction(()=>document.querySelector("#dmc-history-content").innerText.includes("Version 2"),{timeout:10000});
  if(calls.history!==1)throw new Error("DMR Coding history did not load.");
  const screenshot=path.join(designDir,"dmr-coding-backend-verified-desktop.png");
  await page.screenshot({path:screenshot,fullPage:false});
  if(errors.length)throw new Error("Browser runtime errors: "+errors.join(" | "));
  console.log(JSON.stringify({status:"PASS",initial,derived,savePayload:posted,update:calls.updates[0],historyCalls:calls.history,browserErrors:errors,screenshot},null,2));
 }finally{await browser.close();server.close();}
}
main().catch(error=>{console.error(error.stack||error);server.close(()=>process.exit(1));});
