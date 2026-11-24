const http=require("http"),fs=require("fs"),path=require("path");
const puppeteer=require("C:/Users/Rominick/AppData/Local/npm-cache/_npx/4b4c857f6efdfb61/node_modules/puppeteer");
const designDir="C:/Users/Rominick/Desktop/TFI_NEW/design";
const mime={".html":"text/html; charset=utf-8",".js":"application/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".webp":"image/webp"};
const catalog={source:{spreadsheet_id:"1rCbQ16wj7MRjQCFF3tA-WEMkudraJK0RkwcqayUlz7k",sheet_id:867256143},snapshot_summary:{total_tins_to_produce:{formatted_value:"16,182,629"},total_tins_produced:{formatted_value:"15,648,348"},completion:{formatted_value:"96.70%"}},permissions:{view:true,export:true}};
const records=[
{id:"00000000-0000-0000-0000-000000000123",source_row_number:5,column_a:"Product A",pr_no:"001",date_pr_received:"2025-01-05",pr_required_quantity_tins:42111,production_produced_tins:42111,for_production_quantity_tins:0,status:"Complete"},
{id:"00000000-0000-0000-0000-000000000124",source_row_number:7,column_a:"Product B",pr_no:"006",date_pr_received:"2025-03-12",pr_required_quantity_tins:17856,production_produced_tins:17855,for_production_quantity_tins:1,status:"Pending for Production"}
];
let recordCalls=0,catalogCalls=0,exportCalls=0;
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,"http://127.0.0.1"),p=decodeURIComponent(url.pathname);
 if(p==="/api/pr-monitoring/catalog"){catalogCalls++;res.writeHead(200,{"Content-Type":"application/json"});return res.end(JSON.stringify({catalog,permissions:catalog.permissions}));}
 if(p==="/api/pr-monitoring/records"){recordCalls++;res.writeHead(200,{"Content-Type":"application/json"});return res.end(JSON.stringify({records,total_count:2,page:1,page_size:1000,has_more:false}));}
 if(p==="/api/pr-monitoring/export.csv"){exportCalls++;res.writeHead(200,{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":"attachment; filename=TFI-PR-Monitoring-Export.csv"});return res.end("\ufeff,PR No.,Date PR Recieved,PR Required Quantity (tins),Production Produced (tins),For Production Quantity (tins),Status\r\n");}
 if(p==="/favicon.ico"){res.writeHead(204);return res.end();}
 const file=path.resolve(designDir,"."+p);
 if(!file.startsWith(path.resolve(designDir)+path.sep)){res.writeHead(403);return res.end();}
 fs.readFile(file,(e,b)=>{if(e){res.writeHead(404);return res.end("Not found");}res.writeHead(200,{"Content-Type":mime[path.extname(file)]||"application/octet-stream"});res.end(b);});
});
async function mockApi(page){
 await page.setRequestInterception(true);
 page.on("request",async req=>{
  const u=new URL(req.url());
  if(u.pathname==="/api/pr-monitoring/catalog")return req.respond({status:200,contentType:"application/json",body:JSON.stringify({catalog,permissions:catalog.permissions})});
  if(u.pathname==="/api/pr-monitoring/records")return req.respond({status:200,contentType:"application/json",body:JSON.stringify({records,total_count:2,page:1,page_size:1000,has_more:false})});
  if(u.pathname==="/api/pr-monitoring/export.csv")return req.respond({status:200,contentType:"text/csv",headers:{"Content-Disposition":"attachment; filename=pr.csv"},body:"\ufeff,PR No.\r\n"});
  return req.continue();
 });
}
async function run(){
 await new Promise(r=>server.listen(8769,"127.0.0.1",r));
 const browser=await puppeteer.launch({headless:true,args:["--no-sandbox","--disable-setuid-sandbox"]});
 const page=await browser.newPage();await page.setViewport({width:1440,height:1000});
 const errors=[];page.on("pageerror",e=>errors.push(e.message));page.on("console",m=>{if(m.type()==="error")errors.push(m.text());});
 await mockApi(page);await page.goto("http://127.0.0.1:8769/pr-monitoring-preview.html",{waitUntil:"domcontentloaded"});
 await page.waitForFunction(()=>document.body.dataset.tfiPrBackend==="connected",{timeout:10000});
 await page.waitForFunction(()=>document.querySelectorAll("#pr-tbody tr").length===2);
 const desktop=await page.evaluate(()=>({
  status:document.querySelector("#pr-db-status").textContent,
  summary:[document.querySelector("#pr-total-required").textContent,document.querySelector("#pr-total-produced").textContent,document.querySelector("#pr-completion").textContent],
  records:document.querySelectorAll("#pr-tbody tr").length,
  prNos:[...document.querySelectorAll("#pr-tbody tr")].map(tr=>tr.children[1].textContent),
  exportDisabled:document.querySelector("#pr-export").disabled,
  sourceColumns:document.querySelectorAll("#pr-table thead th").length,
  noWriteActions:![...document.querySelectorAll("button")].some(b=>/^(ADD|EDIT|SAVE|SUBMIT)$/i.test(b.textContent.trim()))
 }));
 await page.select("#pr-status","Complete");
 await page.waitForFunction(()=>document.querySelectorAll("#pr-tbody tr").length===1);
 const filtered=await page.$eval("#pr-tbody tr:first-child",tr=>[tr.children[1].textContent,tr.children[6].textContent]);
 await page.$eval("#pr-refresh",e=>e.click());
 await page.waitForFunction(()=>document.body.dataset.tfiPrBackend==="connected");
 await page.waitForFunction(()=>document.querySelectorAll("#pr-tbody tr").length===1);
 const mobile=await browser.newPage();await mobile.setViewport({width:390,height:844});await mockApi(mobile);
 await mobile.goto("http://127.0.0.1:8769/pr-monitoring-preview.html",{waitUntil:"domcontentloaded"});
 await mobile.waitForFunction(()=>document.body.dataset.tfiPrBackend==="connected",{timeout:10000});
 const mobileState=await mobile.evaluate(()=>({width:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,tableScroll:document.querySelector(".pr-table-scroll").scrollWidth>document.querySelector(".pr-table-scroll").clientWidth}));
 console.log(JSON.stringify({desktop,filtered,mobileState,recordCalls,catalogCalls,exportCalls,errors},null,2));
 await browser.close();await new Promise(r=>server.close(r));
 if(desktop.status!=="TFI2 CONNECTED · READ-ONLY"||desktop.records!==2||desktop.prNos[0]!=="001"||desktop.exportDisabled||desktop.sourceColumns!==7||!desktop.noWriteActions||filtered[0]!=="001"||!mobileState.tableScroll||mobileState.scrollWidth>mobileState.width||errors.length)process.exitCode=1;
}
run().catch(e=>{console.error(e);process.exitCode=1;});
