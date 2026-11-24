const fs=require("fs");
const path=require("path");
const http=require("http");
const root=path.resolve(__dirname,"../..");
const designDir=path.join(root,"design");
const manifest=JSON.parse(fs.readFileSync(path.join(root,"src/tfi_backend/dmr_production_manifest.json"),"utf8"));
const calls={create:[],updates:[],history:0,filters:[]};
const saved=[];
const revisions=[];
function send(res,status,payload){
  const body=JSON.stringify(payload);
  res.writeHead(status,{"Content-Type":"application/json; charset=utf-8","Content-Length":Buffer.byteLength(body),"Cache-Control":"no-store"});
  res.end(body);
}
async function readBody(req){let body="";for await(const chunk of req)body+=chunk;return JSON.parse(body||"{}");}
function duration(stop,resume){
  const toMin=v=>{const [h,m]=String(v||"00:00").slice(0,5).split(":").map(Number);return h*60+m;};
  return (toMin(resume)-toMin(stop)+1440)%1440;
}
const catalog={
  product_codes:manifest.productCodes,product_names:manifest.productNames,lines:manifest.lines,
  categories:manifest.categories,additional_options:manifest.additionalOptions,
  source:{worksheet:manifest.sourceSheet,sheet_id:manifest.sourceSheetId,range:manifest.sourceRange}
};
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,"http://127.0.0.1:5115");
  const pathname=decodeURIComponent(url.pathname);
  if(pathname==="/api/dmr-production/catalog"&&req.method==="GET"){
    return send(res,200,{catalog,permissions:{view:true,create:true,edit:true}});
  }
  if(pathname==="/api/dmr-production/records"&&req.method==="GET"){
    const filters=Object.fromEntries(url.searchParams.entries());calls.filters.push(filters);
    let records=saved.slice();
    if(filters.category)records=records.filter(r=>r.category===filters.category);
    if(filters.product_code)records=records.filter(r=>r.product_code===filters.product_code);
    const page=Number(filters.page||1),size=Number(filters.page_size||25);
    records=records.slice((page-1)*size,page*size);
    return send(res,200,{records,page,page_size:size,has_more:false});
  }
  if(pathname==="/api/dmr-production/records"&&req.method==="POST"){
    const body=await readBody(req);calls.create.push(body);
    const results=[];
    for(const item of body.records){
      const d=item.record_data;
      const id="00000000-0000-0000-0000-"+String(saved.length+1).padStart(12,"0");
      const record={
        id,production_date:d.A,product_code:d.B,line:d.C,
        stop_time:d.D,resume_time:d.E,category:d.H,
        source_column_i:d.I,source_column_j:d.J,remarks:d.K,
        downtime_minutes:duration(d.stop_time,d.resume_time),source_import_row_id:null,
        version:1,record_status:"active",created_at:"2026-11-22T10:00:00Z"
      };
      saved.push(record);results.push({row_index:item.row_index,status:"inserted",id});
    }
    return send(res,201,{inserted:results.length,duplicates:0,conflicts:0,results});
  }
  const revisionMatch=pathname.match(/^\/api\/dmr-production\/records\/([0-9a-f-]+)\/revisions$/);
  if(revisionMatch&&req.method==="GET"){
    calls.history++;
    return send(res,200,{record_id:revisionMatch[1],revisions});
  }
  const recordMatch=pathname.match(/^\/api\/dmr-production\/records\/([0-9a-f-]+)$/);
  if(recordMatch&&req.method==="PATCH"){
    const body=await readBody(req);calls.updates.push(body);
    const record=saved.find(item=>item.id===recordMatch[1]);
    if(!record)return send(res,404,{error:"Record not found"});
    if(record.version!==body.expected_version)return send(res,409,{error:"Version conflict"});
    const before={...record};
    const mapping={A:"production_date",B:"product_code",C:"line",D:"stop_time",E:"resume_time",H:"category",I:"source_column_i",J:"source_column_j",K:"remarks"};
    for(const [key,value] of Object.entries(body.changes||{}))record[mapping[key]]=value||null;
    record.downtime_minutes=duration(record.stop_time,record.resume_time);
    record.version++;record.updated_at="2026-11-22T10:10:00Z";
    revisions.unshift({version:record.version,before_data:before,after_data:{...record},
      changed_fields:Object.values(mapping).filter(key=>before[key]!==record[key]),
      change_reason:body.change_reason||null,changed_at:record.updated_at});
    return send(res,200,{id:record.id,changed:true,version:record.version});
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
  await new Promise(resolve=>server.listen(5115,"127.0.0.1",resolve));
  const browser=await puppeteer.launch({headless:true,args:["--no-sandbox","--disable-setuid-sandbox"]});
  try{
    const page=await browser.newPage({viewport:{width:1500,height:1000}});
    const errors=[];page.on("pageerror",error=>errors.push(error.message));
    await page.goto("http://127.0.0.1:5115/dmr-production-preview.html",{waitUntil:"networkidle0"});
    await page.waitForFunction(()=>document.body.dataset.tfiReady==="true",{timeout:15000});
    const initial=await page.evaluate(()=>({
      ready:document.body.dataset.tfiReady,source:document.body.dataset.tfiDmrSource,
      rows:document.querySelectorAll("#dmr-tbody tr").length,
      codes:document.querySelectorAll("#dmr-product-codes option").length,
      saved:document.querySelectorAll("#dmr-saved-tbody tr").length
    }));
    if(initial.rows!==12||initial.codes!==58||initial.source!=="TFI2")throw new Error("DMR form/catalog did not initialize: "+JSON.stringify(initial));
    const row='tr[data-row="1"]';
    await page.$eval(row+' [data-col="A"]',el=>{el.value="2026-11-22";el.dispatchEvent(new Event("input",{bubbles:true}));});
    await page.$eval(row+' [data-col="B"]',el=>{el.value="MDP-100-155";el.dispatchEvent(new Event("input",{bubbles:true}));});
    await page.$eval(row+' [data-col="C"]',el=>{el.value="AGRILINE";el.dispatchEvent(new Event("input",{bubbles:true}));});
    await page.$eval(row+' [data-col="D"]',el=>{el.value="23:50";el.dispatchEvent(new Event("input",{bubbles:true}));});
    await page.$eval(row+' [data-col="E"]',el=>{el.value="00:20";el.dispatchEvent(new Event("input",{bubbles:true}));});
    await page.select(row+' [data-col="H"]',"BD");
    await page.select(row+' [data-col="I"]',"Filler Machine");
    await page.select(row+' [data-col="J"]',"Seaming Machine");
    await page.$eval(row+' [data-col="K"]',el=>{el.value="Maintenance";el.dispatchEvent(new Event("input",{bubbles:true}));});
    const derived=await page.$eval(row,rowEl=>({
      minutes:rowEl.querySelector('[data-col="F"]').value,
      hours:rowEl.querySelector('[data-col="G"]').value,
      product:rowEl.querySelector('[data-col="L"]').value
    }));
    if(derived.minutes!=="30"||derived.hours!=="0.5000"||derived.product!=="DPGP")throw new Error("DMR derived fields are incorrect: "+JSON.stringify(derived));
    await page.click("#dmr-save");
    await new Promise(resolve=>setTimeout(resolve,1200));
    await page.waitForFunction(()=>document.querySelector("#dmr-saved-tbody tr td")?.textContent?.includes("2026")||document.querySelector("#dmr-saved-tbody tr td")?.textContent?.includes("11/22"),{timeout:5000});
    if(calls.create.length!==1)throw new Error("DMR save did not call the API mock.");
    const posted=calls.create[0].records[0].record_data;
    if(posted.B!=="MDP-100-155"||posted.I!=="Filler Machine"||posted.J!=="Seaming Machine")throw new Error("DMR payload lost source inputs: "+JSON.stringify(posted));
    await page.click('#dmr-saved-tbody button[data-action="edit"]');
    await page.$eval("#dmr-edit-remarks",el=>{el.value="Corrected maintenance note";});
    await page.$eval("#dmr-edit-reason",el=>{el.value="Clarified event details";});
    await page.click("#dmr-edit-save");
    await new Promise(resolve=>setTimeout(resolve,1200));
    await page.waitForFunction(()=>document.querySelector("#dmr-saved-tbody tr")?.innerText.includes("Corrected maintenance note"),{timeout:5000});
    if(calls.updates.length!==1||calls.updates[0].expected_version!==1||calls.updates[0].changes.K!=="Corrected maintenance note")throw new Error("DMR update did not use a version-checked API call.");
    await page.click('#dmr-saved-tbody button[data-action="history"]');
    await page.waitForFunction(()=>document.querySelector("#dmr-history-content").innerText.includes("Version 2"),{timeout:10000});
    if(calls.history!==1)throw new Error("DMR revision history did not load.");
    const screenshot=path.join(designDir,"dmr-production-backend-verified-desktop.png");
    await page.screenshot({path:screenshot,fullPage:false});
    if(errors.length)throw new Error("Browser runtime errors: "+errors.join(" | "));
    console.log(JSON.stringify({status:"PASS",initial,derived,savePayload:posted,update:calls.updates[0],historyCalls:calls.history,browserErrors:errors,screenshot},null,2));
  }finally{await browser.close();server.close();}
}
main().catch(error=>{console.error(error.stack||error);server.close(()=>process.exit(1));});
