const fs=require("fs");
const path=require("path");
const http=require("http");

const root=path.resolve(__dirname,"../..");
const designDir=path.join(root,"design");
const manifest=JSON.parse(fs.readFileSync(path.join(root,"src/tfi_backend/product_entry_manifest.json"),"utf8"));
const calls={list:0,saves:[],history:0};
const coQaBlockKeys=["BLK_01","BLK_02","BLK_03","BLK_07","BLK_13","BLK_09","BLK_11","BLK_10","BLK_18","BLK_15","BLK_17","BLK_20","BLK_23","BLK_16","BLK_25","BLK_28","BLK_22","BLK_38","BLK_27","BLK_26","BLK_08","BLK_29","BLK_32","BLK_33","BLK_30","BLK_37","BLK_12","BLK_34","BLK_24","BLK_19","BLK_35"];
const record={
  id:"00000000-0000-0000-0000-000000000321",
  block_key:"BLK_01",
  product_key:"DPGP",
  production_date_text:"2026-11-22",
  product_code:"MDP-100-155",
  pr_number:"PR-COQA-001",
  record_data:{A:"2026-11-22",B:"MDP-100-155",C:"202 X 306",D:"PR-COQA-001",E:"2",G:"3",P:"1",DH:"Reviewed"},
  costs:{Y:"0.250000",Z:null,AA:"1.500000",AB:null,AC:null,AD:null},
  cost_version:1,
  qa_projection:{
    status:"complete",source_range:"CA:CR",available_count:18,formula_pending_count:0,missing_count:0,
    fields:[
      {column:"G",label:"Dented",source_column:"CA",value:"1",formula_pending:false,missing:false},
      {column:"H",label:"False seam",source_column:"CB",value:"2",formula_pending:false,missing:false},
      {column:"M",label:"Retention",source_column:"CG",value:"14",formula_pending:false,missing:false},
      {column:"X",label:"Manual source input",source_column:"CR",value:"45",formula_pending:false,missing:false}
    ]
  },
  qa_calculations:{
    AE:{column:"AE",label:"Total cans",value:"586",status:"calculated",reason:null},
    AF:{column:"AF",label:"Cost of cans",value:"879.00",status:"calculated",reason:null},
    AG:{column:"AG",label:"Total lids",value:"546",status:"calculated",reason:null},
    AH:{column:"AH",label:"Cost of lids",value:"0",status:"calculated",reason:null}
  }
};
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
  const parsed=new URL(req.url,"http://127.0.0.1:5113");
  if(parsed.pathname==="/favicon.ico"){res.writeHead(204);res.end();return;}
  if(parsed.pathname==="/api/co-qa/catalog"){
    return sendJson(res,200,{
      catalog:{source:{sheet:"co QA"},cost_storage:{key:"product_entry_record_id"}},
      product_entry_catalog:{...manifest,blocks:manifest.blocks.filter(block=>coQaBlockKeys.includes(block.block_key))},
      permissions:{view:true,create:true,edit:true}
    });
  }
  if(parsed.pathname==="/api/co-qa/records"&&req.method==="GET"){
    calls.list++;
    return sendJson(res,200,{records:[record],page:1,page_size:50,has_more:false});
  }
  const saveMatch=parsed.pathname.match(/^\/api\/co-qa\/records\/([0-9a-f-]+)\/costs$/);
  if(saveMatch&&req.method==="PUT"){
    const body=await readBody(req);calls.saves.push(body);
    record.costs={...record.costs,...body.costs};record.cost_version++;
    return sendJson(res,200,{product_entry_record_id:record.id,created:false,changed:true,version:record.cost_version,costs:record.costs});
  }
  const historyMatch=parsed.pathname.match(/^\/api\/co-qa\/records\/([0-9a-f-]+)\/cost-revisions$/);
  if(historyMatch&&req.method==="GET"){
    calls.history++;
    return sendJson(res,200,{product_entry_record_id:record.id,revisions:[{
      version:2,before_data:{Y:0.25,AA:1.5},after_data:{Y:0.3,AA:1.75},
      changed_columns:["Y","AA"],change_reason:"Browser QA test",changed_at:"2026-11-22T12:00:00Z"
    }]});
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
  await new Promise(resolve=>server.listen(5113,"127.0.0.1",resolve));
  const browser=await puppeteer.launch({headless:true,args:["--no-sandbox","--disable-setuid-sandbox"]});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1000}});
    const errors=[];
    page.on("pageerror",error=>errors.push(error.message));
    page.on("console",message=>{if(message.type()==="error")errors.push(message.text());});
    await page.goto("http://127.0.0.1:5113/co-qa-preview.html",{waitUntil:"networkidle0"});
    await page.waitForFunction(()=>document.body.dataset.tfiReady==="true",{timeout:20000});
    await page.screenshot({path:path.join(designDir,"co-qa-backend-verified-desktop.png"),fullPage:false});

    const initial=await page.evaluate(()=>({
      blockOptions:document.querySelectorAll("#qa-block-filter option").length,
      rows:document.querySelectorAll("#qa-tbody tr").length,
      product:document.querySelector("#qa-tbody tr td:nth-child(2)")?.innerText,
      cost:document.querySelector("#qa-tbody tr td:nth-child(10)")?.innerText,
      qaSummary:document.querySelector("#qa-tbody tr td:nth-child(7)")?.innerText,
      totalCans:document.querySelector("#qa-tbody tr td:nth-child(14)")?.innerText,
      costOfCans:document.querySelector("#qa-tbody tr td:nth-child(15)")?.innerText,
      totalLids:document.querySelector("#qa-tbody tr td:nth-child(16)")?.innerText,
      linkage:document.body.dataset.tfiCostLinkage,
      noMock:document.body.dataset.tfiNoMock
    }));
    if(initial.blockOptions!==32||initial.rows!==1||!initial.product.includes("MDP-100-155")||!initial.cost.includes("1.5")||!initial.qaSummary.includes("18/18")||!initial.totalCans.includes("586")||!initial.costOfCans.includes("879")||!initial.totalLids.includes("546")||initial.linkage!=="product-entry-record-uuid"||initial.noMock!=="true"){
      throw new Error("Initial CO QA live-record view failed: "+JSON.stringify(initial));
    }

    await page.click('[data-action="details"]');
    await page.waitForSelector("#qa-details-modal:not([hidden])");
    const qaDetails=await page.$eval("#qa-details-list",el=>el.innerText);
    if(!qaDetails.includes("Dented")||!qaDetails.includes("1")||!qaDetails.includes("Captured")||!qaDetails.includes("45")){
      throw new Error("CO QA source projection details did not render: "+qaDetails);
    }
    await page.click("#qa-details-modal .qa-modal-close");
    await page.waitForFunction(()=>document.querySelector("#qa-details-modal").hidden);
    const costButtonState=await page.$eval('[data-action="costs"]',el=>({disabled:el.disabled,visible:!!el.getClientRects().length}));
    await page.$eval('[data-action="costs"]',el=>el.click());
    await page.waitForFunction(()=>!document.querySelector("#qa-cost-modal").hidden,{timeout:5000}).catch(async error=>{
      const state=await page.evaluate(()=>({
        detailsHidden:document.querySelector("#qa-details-modal").hidden,
        costsHidden:document.querySelector("#qa-cost-modal").hidden,
        buttons:[...document.querySelectorAll("[data-action]")].map(el=>({action:el.dataset.action,disabled:el.disabled})),
        errors:document.body.innerText.slice(-500)
      }));
      throw new Error("Cost editor did not open: "+JSON.stringify({costButtonState,state,pageErrors:errors,message:error.message}));
    });
    await page.$eval("#qa-cost-aa",el=>{el.value="1.75";el.dispatchEvent(new Event("input",{bubbles:true}));});
    await page.$eval("#qa-cost-y",el=>{el.value="0.30";el.dispatchEvent(new Event("input",{bubbles:true}));});
    await page.$eval("#qa-change-reason",el=>{el.value="Browser QA update";});
    await page.click("#qa-cost-save");
    await page.waitForFunction(()=>document.querySelector("#qa-cost-modal").hidden&&document.querySelector("#qa-tbody tr td:nth-child(10)").innerText.includes("1.75"),{timeout:10000});
    if(calls.saves.length!==1||calls.saves[0].expected_version!==1||calls.saves[0].costs.AA!=="1.75"||calls.saves[0].costs.Y!=="0.30"){
      throw new Error("CO QA save did not submit per-record costs with expected version: "+JSON.stringify(calls.saves));
    }

    await page.click('[data-action="history"]');
    await page.waitForFunction(()=>document.querySelector("#qa-history-list").innerText.includes("Version 2"),{timeout:10000});
    const history=await page.$eval("#qa-history-list",el=>el.innerText);
    if(!history.includes("Y, AA")||!history.includes("Browser QA test")||calls.history!==1){
      throw new Error("CO QA cost revision history did not render: "+history);
    }
    if(errors.length)throw new Error("Browser console errors: "+errors.join(" | "));
    console.log(JSON.stringify({status:"PASS",initial,saves:calls.saves.length,history:calls.history,browserErrors:errors.length}));
  }finally{await browser.close();server.close();}
}
main().catch(error=>{console.error(error.stack||error);process.exitCode=1;server.close();});
