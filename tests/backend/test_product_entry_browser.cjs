const fs=require("fs");
const path=require("path");
const http=require("http");

const root=path.resolve(__dirname,"../..");
const designDir=path.join(root,"design");
const manifest=JSON.parse(fs.readFileSync(path.join(root,"src/tfi_backend/product_entry_manifest.json"),"utf8"));
const blocks=new Map(manifest.blocks.map(block=>[block.block_key,block]));
const calls={create:[],update:[],list:0,listQueries:[],history:0};
let savedRecord=null;
let revisions=[];

function sendJson(res,status,payload){
  const body=JSON.stringify(payload);
  res.writeHead(status,{"Content-Type":"application/json; charset=utf-8","Content-Length":Buffer.byteLength(body),"Cache-Control":"no-store"});
  res.end(body);
}
function readBody(req){
  return new Promise((resolve,reject)=>{
    let body="";
    req.on("data",chunk=>body+=chunk);
    req.on("end",()=>{try{resolve(JSON.parse(body||"{}"));}catch(error){reject(error);}});
    req.on("error",reject);
  });
}
const server=http.createServer(async(req,res)=>{
  const parsed=new URL(req.url,"http://127.0.0.1:5112");
  if(parsed.pathname==="/favicon.ico"){res.writeHead(204);res.end();return;}
  if(parsed.pathname==="/api/auth/me"){
    return sendJson(res,200,{user:{email:"admin@example.test"},permissions:["product_entry.view","product_entry.create","product_entry.edit"]});
  }
  if(parsed.pathname==="/api/product-entry/catalog"){
    return sendJson(res,200,{catalog:manifest,permissions:{view:true,create:true,edit:true}});
  }
  if(parsed.pathname==="/api/product-entry/records"&&req.method==="GET"){
    calls.list++;
    calls.listQueries.push(Object.fromEntries(parsed.searchParams.entries()));
    const blockKey=parsed.searchParams.get("block_key");
    const records=savedRecord&&savedRecord.block_key===blockKey?[savedRecord]:[];
    return sendJson(res,200,{block_key:blockKey,records,page:1,page_size:50,has_more:false});
  }
  if(parsed.pathname==="/api/product-entry/records"&&req.method==="POST"){
    const body=await readBody(req);
    calls.create.push(body);
    const block=blocks.get(body.block_key);
    const data=body.records[0]||{};
    savedRecord={
      id:"00000000-0000-0000-0000-000000000321",
      block_key:body.block_key,
      product_key:block.product_key,
      production_date_text:data.A||null,
      production_date:data.A||null,
      product_code:data.B||null,
      pr_number:data.D||null,
      review_status:data[block.review_column]||null,
      record_data:{...data},
      completeness_status:"unassessed",
      blank_fields:[],
      record_status:"active",
      version:1,
      created_at:"2026-11-21T08:00:00Z",
      updated_at:"2026-11-21T08:00:00Z"
    };
    return sendJson(res,201,{block_key:body.block_key,inserted:1,duplicates:0,empty:0,results:[{row_index:1,status:"inserted",id:savedRecord.id}]});
  }
  const recordMatch=parsed.pathname.match(/^\/api\/product-entry\/records\/([0-9a-f-]+)$/);
  if(recordMatch&&req.method==="PATCH"){
    const body=await readBody(req);
    calls.update.push(body);
    if(!savedRecord)return sendJson(res,404,{error:"Record not found"});
    if(body.expected_version!==savedRecord.version)return sendJson(res,409,{error:"Version conflict"});
    const before={...savedRecord.record_data};
    for(const [key,value] of Object.entries(body.changes||{})){
      if(value===null)delete savedRecord.record_data[key];
      else savedRecord.record_data[key]=String(value);
    }
    savedRecord.version++;
    savedRecord.updated_at="2026-11-21T08:10:00Z";
    revisions.unshift({
      version:savedRecord.version,
      before_data:before,
      after_data:{...savedRecord.record_data},
      changed_columns:Object.keys(body.changes||{}),
      change_reason:body.change_reason||null,
      changed_by:"test-user",
      changed_at:savedRecord.updated_at
    });
    return sendJson(res,200,{id:savedRecord.id,changed:true,version:savedRecord.version,changed_columns:Object.keys(body.changes||{})});
  }
  const historyMatch=parsed.pathname.match(/^\/api\/product-entry\/records\/([0-9a-f-]+)\/revisions$/);
  if(historyMatch&&req.method==="GET"){
    calls.history++;
    return sendJson(res,200,{record_id:historyMatch[1],revisions});
  }

  const filePath=path.resolve(designDir,"."+decodeURIComponent(parsed.pathname));
  if(!filePath.startsWith(designDir)||!fs.existsSync(filePath)||!fs.statSync(filePath).isFile()){
    res.writeHead(404);res.end("Not found");return;
  }
  const ext=path.extname(filePath).toLowerCase();
  const type={".html":"text/html; charset=utf-8",".js":"application/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".webp":"image/webp",".png":"image/png"}[ext]||"application/octet-stream";
  res.writeHead(200,{"Content-Type":type,"Cache-Control":"no-store"});
  fs.createReadStream(filePath).pipe(res);
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
  await new Promise(resolve=>server.listen(5112,"127.0.0.1",resolve));
  const browser=await puppeteer.launch({headless:true,args:["--no-sandbox","--disable-setuid-sandbox"]});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1000}});
    const errors=[];
    page.on("pageerror",error=>errors.push(error.message));
    page.on("console",message=>{if(message.type()==="error")errors.push(message.text());});
    await page.goto("http://127.0.0.1:5112/product-entry-preview.html",{waitUntil:"networkidle0"});
    await page.waitForFunction(()=>document.body.dataset.tfiReady==="true",{timeout:20000});
    await page.screenshot({path:path.join(designDir,"product-entry-backend-verified-desktop.png"),fullPage:false});

    const initial=await page.evaluate(()=>({
      source:document.body.dataset.tfiDataSource,
      blocks:document.body.dataset.tfiCatalogBlocks,
      selected:document.body.dataset.tfiBlock,
      visible:document.body.dataset.tfiVisibleColumns,
      editable:document.body.dataset.tfiEditableColumns,
      options:document.querySelectorAll("#product-select option").length,
      rows:document.querySelectorAll("#entry-tbody tr").length,
      noMock:document.body.dataset.tfiNoMock,
      saveEnabled:!document.querySelector("#pe-save").disabled
    }));
    if(initial.source!=="TFI2"||initial.blocks!=="39"||initial.options!==39||initial.selected!=="BLK_38"||initial.noMock!=="true"||!initial.saveEnabled){
      throw new Error("Initial TFI2 Product Entry catalog/UI failed: "+JSON.stringify(initial));
    }

    const allBlockChecks=[];
    for(const sourceBlock of manifest.blocks){
      await page.select("#product-select",sourceBlock.product_key);
      await page.waitForFunction(key=>document.body.dataset.tfiBlock===key,{timeout:5000},sourceBlock.block_key);
      const check=await page.evaluate(reviewColumn=>({
        block:document.body.dataset.tfiBlock,
        title:document.querySelector("#product-title").textContent,
        codeOptions:document.querySelectorAll('tbody tr:first-child select[data-col="B"] option').length,
        reviewVisible:!!document.querySelector('tbody select[data-col="'+reviewColumn+'"]')
      }),sourceBlock.review_column);
      if(check.block!==sourceBlock.block_key||check.title!==sourceBlock.display_title||check.codeOptions!==sourceBlock.product_codes.length+1||!check.reviewVisible){
        throw new Error("Source block switch validation failed: "+JSON.stringify({sourceBlock:sourceBlock.block_key,check,expectedCodes:sourceBlock.product_codes.length+1}));
      }
      allBlockChecks.push(check.block);
    }

    await page.select("#product-select","DPGP");
    const blockOne=await page.evaluate(()=>({
      block:document.body.dataset.tfiBlock,
      codeOptions:document.querySelectorAll('tbody tr:first-child select[data-col="B"] option').length,
      formulaReadOnly:!!document.querySelector('td[data-col="F"].calculated-cell'),
      formulaHasInput:!!document.querySelector('td[data-col="F"] input,td[data-col="F"] select'),
      hiddenColumnRendered:!!document.querySelector('td[data-col="Z"]'),
      reviewField:!!document.querySelector('tbody select[data-col="DH"]')
    }));
    if(blockOne.block!=="BLK_01"||blockOne.codeOptions<2||!blockOne.formulaReadOnly||blockOne.formulaHasInput||blockOne.hiddenColumnRendered||!blockOne.reviewField){
      throw new Error("BLK_01 source mapping or block-specific field rules failed: "+JSON.stringify(blockOne));
    }

    const code=blocks.get("BLK_01").product_codes[0];
    await page.$eval('tbody input[data-col="A"]',el=>{el.value="2026-11-21";el.dispatchEvent(new Event("input",{bubbles:true}));});
    await page.$eval('tbody select[data-col="B"]',(el,value)=>{el.value=value;el.dispatchEvent(new Event("change",{bubbles:true}));},code);
    await page.$eval('tbody input[data-col="D"]',el=>{el.value="PE-BROWSER-ACCEPTANCE-01";el.dispatchEvent(new Event("input",{bubbles:true}));});
    await page.$eval('tbody input[data-col="E"]',el=>{el.value="2";el.dispatchEvent(new Event("input",{bubbles:true}));});
    await page.$eval('tbody select[data-col="DH"]',el=>{el.value="Reviewed";el.dispatchEvent(new Event("change",{bubbles:true}));});
    await page.click("#pe-save");
    await page.waitForFunction(()=>document.querySelector("#pe-save").textContent==="SAVE ENTRIES"&&document.querySelector('tbody input[data-col="D"]').value==="",{timeout:10000});
    if(calls.create.length!==1)throw new Error("New Product Entry row was not posted to the backend mock.");
    const posted=calls.create[0];
    if(posted.block_key!=="BLK_01"||posted.records[0].B!==code||posted.records[0].DH!=="Reviewed"||posted.records[0].D!=="PE-BROWSER-ACCEPTANCE-01"){
      throw new Error("Product Entry save payload did not preserve block-specific source fields: "+JSON.stringify(posted));
    }

    await page.click("#pe-mode-saved");
    await page.waitForFunction(()=>document.querySelector("#entry-tbody [data-record-id]")!==null,{timeout:10000});
    await page.select("#pe-filter-code",code);
    await page.$eval("#pe-filter-pr",el=>{el.value="PE-BROWSER-ACCEPTANCE-01";});
    await page.select("#pe-filter-review","Reviewed");
    await page.click("#pe-filter-apply");
    await page.waitForFunction(()=>document.querySelector("#entry-tbody [data-record-id]")!==null,{timeout:10000});
    const appliedFilter=calls.listQueries[calls.listQueries.length-1];
    if(appliedFilter.block_key!=="BLK_01"||appliedFilter.product_code!==code||appliedFilter.pr_number!=="PE-BROWSER-ACCEPTANCE-01"||appliedFilter.review_status!=="Reviewed"){
      throw new Error("Saved Product Entry filters were not sent to TFI2: "+JSON.stringify(appliedFilter));
    }
    const savedRow=await page.evaluate(()=>({
      id:document.querySelector("#entry-tbody [data-record-id]")?.dataset.recordId,
      displayed:document.querySelector("#entry-tbody [data-col=\"D\"] .pe-cell-display")?.textContent,
      actions:!!document.querySelector("[data-pe-edit-row]")&&!!document.querySelector("[data-pe-history-row]")
    }));
    if(savedRow.id!=="00000000-0000-0000-0000-000000000321"||savedRow.displayed!=="PE-BROWSER-ACCEPTANCE-01"||!savedRow.actions){
      throw new Error("Saved record view or record actions failed: "+JSON.stringify(savedRow));
    }

    await page.click("[data-pe-edit-row]");
    await page.$eval('tr[data-record-id] input[data-col="E"]',el=>{el.value="3";el.dispatchEvent(new Event("input",{bubbles:true}));});
    await page.click("[data-pe-save-row]");
    await page.waitForFunction(()=>document.querySelector("[data-pe-edit-row]")!==null&&document.querySelector("#entry-tbody [data-record-id]").dataset.version==="2",{timeout:10000});
    if(calls.update.length!==1||calls.update[0].expected_version!==1||calls.update[0].changes.E!=="3"){
      throw new Error("Saved Product Entry edit did not call the version-checked update API: "+JSON.stringify(calls.update));
    }

    await page.click("[data-pe-history-row]");
    await page.waitForFunction(()=>document.querySelector("#pe-history-content").innerText.includes("Version 2"),{timeout:10000});
    const history=await page.$eval("#pe-history-content",el=>el.innerText);
    if(!history.includes("No. of Batches")||!history.includes("2")||!history.includes("3")||calls.history!==1){
      throw new Error("Product Entry revision history did not show the before/after field values: "+history);
    }
    await page.click("#pe-history-close");
    await page.click("#pe-mode-new");

    await page.select("#product-select","Maharlika LM");
    await page.waitForFunction(()=>document.body.dataset.tfiBlock==="BLK_38");
    const block38=await page.evaluate(()=>({
      review:document.querySelector('tbody select[data-col="EL"]')!==null,
      title:document.querySelector("#product-title").textContent
    }));
    if(!block38.review||block38.title!=="Maharlika Luncheon Meat"){
      throw new Error("BLK_38 specific review field or product title failed: "+JSON.stringify(block38));
    }

    if(errors.length)throw new Error("Browser console errors: "+errors.join(" | "));
    console.log(JSON.stringify({
      status:"PASS",
      initial,
      allBlockChecks,
      blockOne,
      savePayload:posted,
      appliedFilter,
      savedRow,
      update:calls.update[0],
      historyCalls:calls.history,
      block38,
      browserErrors:errors
    },null,2));
  }finally{
    await browser.close();
    server.close();
  }
}
main().catch(error=>{console.error(error.stack||error);server.close(()=>process.exit(1));});
