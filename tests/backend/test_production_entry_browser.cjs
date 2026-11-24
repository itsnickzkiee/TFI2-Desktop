const fs=require("fs");
const path=require("path");
const http=require("http");

const root=path.resolve(__dirname,"../..");
const designDir=path.join(root,"design");
const manifest=JSON.parse(fs.readFileSync(path.join(root,"src/tfi_backend/production_entry_manifest.json"),"utf8"));
const calls={create:[],filters:[],updates:[],history:0};
const revisions=[];
let savedRecords=[];

function lineFor(row){
  return row>=8&&row<=11?"Agri":row>=12&&row<=15?"Meat":"Finishing";
}
function derive(data){
  const target=data.F===undefined?null:Number(data.F);
  const produced=data.G===undefined?null:Number(data.G);
  const manpower=data.O===undefined?null:Number(data.O);
  const present=data.P===undefined?null:Number(data.P);
  data.I=target!==null&&produced!==null&&target>0?produced/target:null;
  data.Q=manpower!==null&&present!==null?manpower-present:null;
  data.R=manpower!==null&&present!==null&&manpower>0?present/manpower:null;
  data.W=true;
  return data;
}
function summary(){
  const dates=new Set(savedRecords.map(row=>row.production_date).filter(Boolean));
  const values=savedRecords.map(row=>row.attainment).filter(value=>value!==null&&value!==undefined);
  return {
    saved_rows:savedRecords.length,
    days_saved:dates.size,
    avg_attainment:values.length?values.reduce((sum,value)=>sum+Number(value),0)/values.length:null,
    last_saved:savedRecords.reduce((latest,row)=>!latest||row.saved_on>latest?row.saved_on:latest,null)
  };
}
function send(res,status,payload){
  const body=JSON.stringify(payload);
  res.writeHead(status,{"Content-Type":"application/json; charset=utf-8","Content-Length":Buffer.byteLength(body),"Cache-Control":"no-store"});
  res.end(body);
}
async function readBody(req){
  let body="";
  for await(const chunk of req)body+=chunk;
  return JSON.parse(body||"{}");
}
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,"http://127.0.0.1:5114");
  const pathname=decodeURIComponent(url.pathname);
  if(pathname==="/api/production-entry/catalog"&&req.method==="GET"){
    return send(res,200,{catalog:manifest,permissions:{view:true,create:true,edit:true}});
  }
  if(pathname==="/api/production-entry/summary"&&req.method==="GET"){
    return send(res,200,{summary:summary()});
  }
  if(pathname==="/api/production-entry/records"&&req.method==="POST"){
    const body=await readBody(req);
    calls.create.push(body);
    const results=[];
    body.records.forEach((entry,index)=>{
      const data=derive({...entry.record_data,B:lineFor(entry.source_row_number),U:"2026-11-21T10:00:00Z",V:null,X:null});
      const id="00000000-0000-0000-0000-"+String(savedRecords.length+1).padStart(12,"0");
      const record={
        id,entry_batch_id:"00000000-0000-0000-0000-000000000789",
        source_row_number:entry.source_row_number,production_date:data.A||null,line:data.B,
        product_name:data.C||null,product_code:data.D||null,batches:data.E?Number(data.E):null,
        target:data.F?Number(data.F):null,produced:data.G?Number(data.G):null,uom:data.H||null,
        attainment:data.I,plan_start:data.J||null,actual_start:data.K||null,plan_end:data.L||null,
        actual_end_prod:data.M||null,actual_end_cleaning:data.N||null,
        manpower_required:data.O?Number(data.O):null,present:data.P?Number(data.P):null,
        absent:data.Q,attendance:data.R,ot_hours:data.S?Number(data.S):null,remarks:data.T||null,
        saved_on:"2026-11-21T10:00:00Z",check_value:null,has_data:true,day_has_data:null,
        record_data:data,record_fingerprint:"test",blank_fields:[],record_status:"active",
        version:1,created_at:"2026-11-21T10:00:00Z",updated_at:"2026-11-21T10:00:00Z"
      };
      savedRecords.push(record);
      results.push({row_index:index+1,source_row_number:entry.source_row_number,status:"inserted",id});
    });
    return send(res,201,{entry_batch_id:"00000000-0000-0000-0000-000000000789",inserted:results.length,duplicates:0,empty:0,results});
  }
  if(pathname==="/api/production-entry/records"&&req.method==="GET"){
    const filters=Object.fromEntries(url.searchParams.entries());
    calls.filters.push(filters);
    let records=savedRecords.slice();
    const includes=(a,b)=>String(a||"").toLowerCase().includes(String(b||"").toLowerCase());
    if(filters.date_from)records=records.filter(row=>row.production_date>=filters.date_from);
    if(filters.date_to)records=records.filter(row=>row.production_date<=filters.date_to);
    if(filters.line)records=records.filter(row=>row.line===filters.line);
    if(filters.product_name)records=records.filter(row=>includes(row.product_name,filters.product_name));
    if(filters.product_code)records=records.filter(row=>includes(row.product_code,filters.product_code));
    if(filters.search)records=records.filter(row=>includes(JSON.stringify(row.record_data),filters.search));
    const total=records.length;
    const size=Number(filters.page_size||10),page=Number(filters.page||1);
    records=records.slice((page-1)*size,page*size);
    return send(res,200,{records,total,page,page_size:size,pages:Math.max(1,Math.ceil(total/size)),has_more:page*size<total});
  }
  const revisionsMatch=pathname.match(/^\/api\/production-entry\/records\/([0-9a-f-]+)\/revisions$/);
  if(revisionsMatch&&req.method==="GET"){
    calls.history++;
    return send(res,200,{record_id:revisionsMatch[1],revisions});
  }
  const recordMatch=pathname.match(/^\/api\/production-entry\/records\/([0-9a-f-]+)$/);
  if(recordMatch&&req.method==="PATCH"){
    const body=await readBody(req);
    calls.updates.push(body);
    const record=savedRecords.find(item=>item.id===recordMatch[1]);
    if(!record)return send(res,404,{error:"Record not found"});
    if(record.version!==body.expected_version)return send(res,409,{error:"Version conflict"});
    const before={...record.record_data};
    for(const [key,value] of Object.entries(body.changes||{})){
      if(value===null)delete record.record_data[key];
      else record.record_data[key]=String(value);
    }
    derive(record.record_data);
    record.version++;
    record.produced=record.record_data.G?Number(record.record_data.G):null;
    record.attainment=record.record_data.I;
    record.updated_at="2026-11-21T10:10:00Z";
    revisions.unshift({
      version:record.version,before_data:before,after_data:{...record.record_data},
      changed_columns:Object.keys(body.changes||{}),change_reason:body.change_reason||null,
      changed_at:record.updated_at
    });
    return send(res,200,{id:record.id,changed:true,version:record.version,changed_columns:Object.keys(body.changes||{})});
  }
  if(pathname==="/favicon.ico"){res.writeHead(204);res.end();return;}
  const target=path.resolve(designDir,"."+pathname);
  if(!target.startsWith(designDir)||!fs.existsSync(target)||!fs.statSync(target).isFile()){
    res.writeHead(404);res.end("Not found");return;
  }
  const ext=path.extname(target).toLowerCase();
  const type={".html":"text/html; charset=utf-8",".js":"application/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".webp":"image/webp",".png":"image/png"}[ext]||"application/octet-stream";
  res.writeHead(200,{"Content-Type":type,"Cache-Control":"no-store"});
  fs.createReadStream(target).pipe(res);
});

async function main(){
  let puppeteer;
  try{puppeteer=require("puppeteer");}
  catch{
    const cache=path.join(process.env.LOCALAPPDATA||"C:\\Users\\Rominick\\AppData\\Local","npm-cache","_npx");
    const found=fs.readdirSync(cache).map(dir=>path.join(cache,dir,"node_modules","puppeteer")).find(file=>fs.existsSync(file));
    if(!found)throw new Error("Puppeteer is not installed.");
    puppeteer=require(found);
  }
  await new Promise(resolve=>server.listen(5114,"127.0.0.1",resolve));
  const browser=await puppeteer.launch({headless:true,args:["--no-sandbox","--disable-setuid-sandbox"]});
  try{
    const page=await browser.newPage({viewport:{width:1500,height:1000}});
    const errors=[];
    page.on("pageerror",error=>errors.push(error.message));

    await page.goto("http://127.0.0.1:5114/production-entry-preview.html",{waitUntil:"networkidle0"});
    await page.waitForFunction(()=>document.body.dataset.tfiReady==="true",{timeout:15000});
    const formInitial=await page.evaluate(()=>({
      ready:document.body.dataset.tfiReady,
      source:document.body.dataset.tfiDataSource,
      rows:document.querySelectorAll("#entry-tbody tr").length,
      products:Number(document.body.dataset.tfiProducts),
      saved:document.querySelector("#saved-rows").textContent,
      last:document.querySelector("#last-saved").textContent,
      saveEnabled:!document.querySelector("#save-form").disabled,
      date:document.querySelector("#production-date").value
    }));
    if(formInitial.source!=="TFI2"||formInitial.rows!==12||formInitial.products!==32||formInitial.saved!=="0"||formInitial.last!=="—"||!formInitial.saveEnabled){
      throw new Error("Production Entry did not initialize from live TFI2 catalog and empty metrics: "+JSON.stringify(formInitial));
    }

    const product=manifest.product_names[0],code=manifest.product_codes[product][0];
    await page.select('tr[data-source-row="8"] select[data-col="C"]',product);
    await page.select('tr[data-source-row="8"] select[data-col="D"]',code);
    await page.$eval('tr[data-source-row="8"] input[data-col="F"]',el=>{el.value="100";el.dispatchEvent(new Event("input",{bubbles:true}));});
    await page.$eval('tr[data-source-row="8"] input[data-col="G"]',el=>{el.value="90";el.dispatchEvent(new Event("input",{bubbles:true}));});
    await page.$eval('tr[data-source-row="8"] input[data-col="O"]',el=>{el.value="10";el.dispatchEvent(new Event("input",{bubbles:true}));});
    await page.$eval('tr[data-source-row="8"] input[data-col="P"]',el=>{el.value="8";el.dispatchEvent(new Event("input",{bubbles:true}));});
    await page.$eval('tr[data-source-row="8"] input[data-col="T"]',el=>{el.value="Acceptance test run";el.dispatchEvent(new Event("input",{bubbles:true}));});
    const calculated=await page.$eval('tr[data-source-row="8"]',row=>({
      attainment:row.querySelector('[data-col="I"]').innerText.trim(),
      absent:row.querySelector('[data-col="Q"]').innerText.trim(),
      attendance:row.querySelector('[data-col="R"]').innerText.trim(),
      hasData:row.querySelector('[data-col="W"]').innerText.trim()
    }));
    if(calculated.attainment!=="90.0%"||calculated.absent!=="2"||calculated.attendance!=="80.0%"||calculated.hasData!=="1"){
      throw new Error("Production Entry source formulas did not calculate correctly: "+JSON.stringify(calculated));
    }
    await page.click("#save-form");
    await page.waitForFunction(()=>document.querySelector("#save-form").textContent==="SAVE TO PRODUCTION SUMMARY"&&document.querySelector('tr[data-source-row="8"] select[data-col="C"]').value==="",{timeout:10000});
    if(calls.create.length!==1)throw new Error("Production Entry save did not call the backend mock.");
    const posted=calls.create[0].records[0];
    if(posted.source_row_number!==8||posted.record_data.C!==product||posted.record_data.D!==code||posted.record_data.G!=="90"||posted.record_data.A!==formInitial.date){
      throw new Error("Production Entry save payload did not preserve source row/date/product values: "+JSON.stringify(posted));
    }
    if(await page.$eval("#saved-rows",el=>el.textContent)!=="1")throw new Error("Live summary card did not refresh after saving.");
    const formScreenshot=path.join(designDir,"production-entry-backend-verified-desktop.png");
    await page.screenshot({path:formScreenshot,fullPage:false});

    await page.goto("http://127.0.0.1:5114/reports-reconciliation-preview.html",{waitUntil:"networkidle0"});
    await page.waitForFunction(()=>document.body.dataset.tfiReady==="true"&&document.body.dataset.tfiDataSource==="TFI2",{timeout:15000});
    await page.waitForFunction(()=>document.querySelector("#rr-tbody tr[data-record-id]")!==null,{timeout:10000});
    const reportInitial=await page.evaluate(()=>({
      columns:document.querySelectorAll("#rr-table thead th").length,
      cells:document.querySelector("#rr-tbody tr[data-record-id]")?.children.length,
      runs:document.querySelector("#rr-kpi-runs").textContent,
      days:document.querySelector("#rr-kpi-days").textContent,
      line:document.querySelector("#rr-tbody tr[data-record-id]")?.children[1].textContent,
      product:document.querySelector("#rr-tbody tr[data-record-id]")?.children[2].textContent
    }));
    if(reportInitial.cells!==24||reportInitial.runs!=="1"||reportInitial.days!=="1"||reportInitial.line!=="Agri"||reportInitial.product!==product){
      throw new Error("Production Summary did not render the 24-column saved run register: "+JSON.stringify(reportInitial));
    }

    await page.select("#rr-line","Agri");
    await page.$eval("#rr-product",el=>{el.value="Peas";el.dispatchEvent(new Event("input",{bubbles:true}));});
    await page.waitForFunction(()=>document.body.dataset.tfiLoadedQuery?.includes("line=Agri")&&document.body.dataset.tfiLoadedQuery?.includes("product_name=Peas"),{timeout:10000});
    const filter=calls.filters[calls.filters.length-1];
    if(filter.line!=="Agri"||filter.product_name!=="Peas")throw new Error("Production Summary filters were not sent to TFI2: "+JSON.stringify(filter));

    await page.click('#rr-tbody tr[data-record-id]');
    if(await page.$eval("#rr-edit-selected",el=>el.disabled))throw new Error("Selected Production Summary run did not enable Edit.");
    await page.click("#rr-edit-selected");
    await page.$eval('[data-edit-column="G"]',el=>{el.value="95";});
    await page.$eval("#rr-change-reason",el=>{el.value="Corrected produced quantity";});
    await page.click("#rr-edit-save");
    await page.waitForFunction(()=>document.querySelector('#rr-tbody tr[data-record-id]')?.children[6].textContent==="95",{timeout:10000});
    if(calls.updates.length!==1||calls.updates[0].expected_version!==1||calls.updates[0].changes.G!=="95"){
      throw new Error("Production Summary edit did not use a version-checked update: "+JSON.stringify(calls.updates));
    }

    await page.click('#rr-tbody tr[data-record-id]');
    await page.click("#rr-history-selected");
    await page.waitForFunction(()=>document.querySelector("#rr-history-content").innerText.includes("Version 2"),{timeout:10000});
    const history=await page.$eval("#rr-history-content",el=>el.innerText);
    if(!history.includes("Produced")||!history.includes("90")||!history.includes("95")||calls.history!==1){
      throw new Error("Production Summary revision history did not show before/after values: "+history);
    }
    const reportScreenshot=path.join(designDir,"production-summary-backend-verified-desktop.png");
    await page.screenshot({path:reportScreenshot,fullPage:false});
    if(errors.length)throw new Error("Browser runtime errors: "+errors.join(" | "));

    console.log(JSON.stringify({
      status:"PASS",
      formInitial,
      calculated,
      savePayload:posted,
      reportInitial,
      appliedFilter:filter,
      update:calls.updates[0],
      historyCalls:calls.history,
      browserErrors:errors,
      screenshots:[formScreenshot,reportScreenshot]
    },null,2));
  }finally{
    await browser.close();
    server.close();
  }
}
main().catch(error=>{console.error(error.stack||error);server.close(()=>process.exit(1));});
