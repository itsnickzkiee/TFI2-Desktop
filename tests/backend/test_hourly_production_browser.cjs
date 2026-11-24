const fs=require("fs");
const path=require("path");
const http=require("http");
const root=path.resolve(__dirname,"../..");
const design=path.join(root,"design");
const raw=fs.readFileSync(path.join(design,"hourly-meat-data.js"),"utf8");
const start=raw.indexOf("=")+1,end=raw.lastIndexOf(";");
const source=JSON.parse(raw.slice(start,end));
const products=source.products;
const names=Object.fromEntries(products.map(p=>[p.code,p.name]));
const records={hourly_meat:[],hourly_coding:[],hourly_agri:[]};
const revisions={hourly_meat:{},hourly_coding:{},hourly_agri:{}};
const calls={create:[],update:[],catalog:[],list:[]};
let nextId=1;
function send(res,status,data){const body=JSON.stringify(data);res.writeHead(status,{"Content-Type":"application/json; charset=utf-8","Content-Length":Buffer.byteLength(body),"Cache-Control":"no-store"});res.end(body);}
async function body(req){let value="";for await(const chunk of req)value+=chunk;return JSON.parse(value||"{}");}
function derived(module){
 const rows=[...records[module]].sort((a,b)=>String(a.production_date||"").localeCompare(String(b.production_date||""))||String(a.product_code||"").localeCompare(String(b.product_code||""))||(a.hour??-1)-(b.hour??-1));
 return rows.map(record=>{
  const code=record.product_code, prior=rows.filter(r=>r.production_date===record.production_date&&r.product_code===code&&r.hour!==null&&record.hour!==null&&r.hour<=record.hour);
  const duration=record.hour===null?null:String(record.hour).padStart(2,"0")+":00-"+String((record.hour+1)%24).padStart(2,"0")+":00";
  return {...record,record_date:record.production_date,product_name:code?(names[code]||"Other"):null,time_slot:duration,
   variance_tins:record.target_tins===null||record.actual_tins===null?null:record.actual_tins-record.target_tins,
   cumulative_target_tins:!record.production_date||record.hour===null||!code?null:prior.reduce((s,r)=>s+(r.target_tins||0),0),
   cumulative_actual_tins:!record.production_date||record.hour===null||!code||record.actual_tins===null?null:prior.reduce((s,r)=>s+(r.actual_tins||0),0),
   hour_attainment:record.target_tins===null||record.target_tins===0||record.actual_tins===null?null:record.actual_tins/record.target_tins};
 });
}
function summary(rows){const target=rows.reduce((s,r)=>s+(r.target_tins||0),0),actual=rows.reduce((s,r)=>s+(r.actual_tins||0),0);return{record_count:rows.length,product_codes_in_use:new Set(rows.map(r=>r.product_code).filter(Boolean)).size,total_target_tins:target,total_actual_tins:actual,total_variance_tins:rows.reduce((s,r)=>s+(r.variance_tins||0),0),attainment:target>0?actual/target:null};}
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,"http://127.0.0.1:5117"),p=decodeURIComponent(url.pathname);
 const catalogMatch=p.match(/^\/api\/hourly\/(hourly_meat|hourly_coding|hourly_agri)\/catalog$/);
 if(catalogMatch&&req.method==="GET"){const module=catalogMatch[1];calls.catalog.push(module);return send(res,200,{catalog:{module_key:module,module_name:module,products,product_code_count:products.length},permissions:{view:true,create:true,edit:true,submit:true,approve:true,review:true}});}
 const listMatch=p.match(/^\/api\/hourly\/(hourly_meat|hourly_coding|hourly_agri)\/records$/);
 if(listMatch&&req.method==="GET"){
  const module=listMatch[1],q=Object.fromEntries(url.searchParams.entries());calls.list.push({module,...q});
  let rows=derived(module);
  if(q.date_from)rows=rows.filter(r=>r.production_date&&r.production_date>=q.date_from);
  if(q.date_to)rows=rows.filter(r=>r.production_date&&r.production_date<=q.date_to);
  if(q.product_code)rows=rows.filter(r=>r.product_code===q.product_code);
  if(q.search){const search=q.search.toLowerCase();rows=rows.filter(r=>[r.product_code,r.product_name,r.remarks,r.time_slot,r.hour,r.production_date].join(" ").toLowerCase().includes(search));}
  rows.sort((a,b)=>String(b.production_date||"").localeCompare(String(a.production_date||""))||(b.hour??-1)-(a.hour??-1));
  const page=Number(q.page||1),size=Number(q.page_size||100),total=rows.length;
  return send(res,200,{records:rows.slice((page-1)*size,page*size),page,page_size:size,total_count:total,has_more:total>page*size,summary:summary(rows)});
 }
 if(listMatch&&req.method==="POST"){
  const module=listMatch[1],payload=await body(req);calls.create.push({module,...payload});const results=[];let inserted=0,duplicates=0,empty=0;
  for(const item of payload.records||[]){const d=item.record_data||{};
   if(Object.values(d).every(v=>v===null||v==="")){empty++;results.push({row_index:item.row_index,status:"empty"});continue;}
   const dup=records[module].some(r=>r.production_date===d.production_date&&r.hour===d.hour&&r.product_code===d.product_code&&d.production_date&&d.hour!==null&&d.product_code);
   if(dup){duplicates++;results.push({row_index:item.row_index,status:"duplicate"});continue;}
   const id="hourly-test-"+nextId++,code=d.product_code||null;
   const record={id,module_key:module,production_date:d.production_date||null,hour:d.hour===undefined?null:d.hour,product_code:code,target_tins:d.target_tins===undefined?null:d.target_tins===null?null:Number(d.target_tins),actual_tins:d.actual_tins===undefined?null:d.actual_tins===null?null:Number(d.actual_tins),remarks:d.remarks||null,product_code_reference_status:!code?"not_entered":names[code]?"matched":"unmatched",version:1,record_status:"active",created_at:"2026-11-22T10:00:00Z"};
   records[module].push(record);revisions[module][id]=[];inserted++;results.push({row_index:item.row_index,status:"inserted",id,product_code_reference_status:record.product_code_reference_status});
  }
  return send(res,inserted?201:200,{inserted,duplicates,empty,results});
 }
 const revisionMatch=p.match(/^\/api\/hourly\/(hourly_meat|hourly_coding|hourly_agri)\/records\/([^/]+)\/revisions$/);
 if(revisionMatch&&req.method==="GET"){const [_,module,id]=revisionMatch;return send(res,200,{record_id:id,revisions:revisions[module][id]||[]});}
 const updateMatch=p.match(/^\/api\/hourly\/(hourly_meat|hourly_coding|hourly_agri)\/records\/([^/]+)$/);
 if(updateMatch&&req.method==="PATCH"){
  const [_,module,id]=updateMatch,payload=await body(req),record=records[module].find(r=>r.id===id);
  if(!record)return send(res,404,{error:"Record not found"});
  if(record.version!==payload.expected_version)return send(res,409,{error:"Version conflict"});
  const before={...record};
  Object.entries(payload.changes||{}).forEach(([key,value])=>{record[key]=value===""?null:value;});
  record.version++;record.updated_at="2026-11-22T10:10:00Z";
  revisions[module][id].unshift({version:record.version,before_data:before,after_data:{...record},changed_fields:Object.keys(payload.changes||{}),change_reason:payload.change_reason||null,changed_at:record.updated_at});
  calls.update.push({module,id,payload});
  return send(res,200,{changed:true,id,version:record.version});
 }
 if(p==="/favicon.ico"){res.writeHead(204);res.end();return;}
 const target=path.resolve(design,"."+p);
 if(!target.startsWith(design)||!fs.existsSync(target)||!fs.statSync(target).isFile()){res.writeHead(404);res.end("Not found");return;}
 const ext=path.extname(target).toLowerCase(),type={".html":"text/html; charset=utf-8",".js":"application/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".webp":"image/webp",".png":"image/png"}[ext]||"application/octet-stream";
 res.writeHead(200,{"Content-Type":type,"Cache-Control":"no-store"});fs.createReadStream(target).pipe(res);
});
async function main(){
 let puppeteer;try{puppeteer=require("puppeteer");}catch{const cache=path.join(process.env.LOCALAPPDATA||"C:\\Users\\Rominick\\AppData\\Local","npm-cache","_npx");const found=fs.readdirSync(cache).map(dir=>path.join(cache,dir,"node_modules","puppeteer")).find(file=>fs.existsSync(file));if(!found)throw new Error("Puppeteer is not installed.");puppeteer=require(found);}
 await new Promise(resolve=>server.listen(5117,"127.0.0.1",resolve));
 const browser=await puppeteer.launch({headless:true,args:["--no-sandbox","--disable-setuid-sandbox"]});
 try{
  const results=[];
  for(const module of ["hourly_meat","hourly_coding","hourly_agri"]){
   const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];
   page.on("pageerror",e=>errors.push(e.message));
   const filename=module.replace("hourly-","").replaceAll("_","-")+"-preview.html";
   await page.goto("http://127.0.0.1:5117/"+filename,{waitUntil:"networkidle0"});
   await page.waitForFunction(()=>document.body.dataset.tfiHourlyReady==="true",{timeout:15000});
   if(module==="hourly_meat"){
    const rows=await page.$$("#hm-tbody tr");if(rows.length!==12)throw new Error("Hourly Meat did not initialize 12 blank rows.");
    const set=async(sel,val)=>page.$eval(sel,(el,v)=>{el.value=v;el.dispatchEvent(new Event("input",{bubbles:true}));},val);
    await set('#hm-tbody tr[data-row="1"] [data-col="A"]',"2026-11-22");
    await page.select('#hm-tbody tr[data-row="1"] [data-col="B"]',"23");
    await page.select('#hm-tbody tr[data-row="1"] [data-col="C"]',"MDP-100-155");
    await set('#hm-tbody tr[data-row="1"] [data-col="D"]',"120");
    await set('#hm-tbody tr[data-row="1"] [data-col="E"]',"115");
    await set('#hm-tbody tr[data-row="1"] [data-col="F"]',"Meat browser test");
    const calc=await page.$eval('#hm-tbody tr[data-row="1"]',r=>({variance:r.querySelector('[data-col="I"]').value,product:r.querySelector('[data-col="G"]').value}));
    if(calc.variance!=="-5"||calc.product!=="DPGP")throw new Error("Hourly Meat calculated columns failed: "+JSON.stringify(calc));
    await page.click("#hm-save");
    await page.waitForFunction(()=>document.querySelector("#hm-saved-tbody tr")?.innerText.includes("MDP-100-155"),{timeout:10000});
   }else{
    await page.click("#"+(module==="hourly_coding"?"hc-new":"ha-new"));
    const prefix=module==="hourly_coding"?"hc":"ha";
    const set=async(sel,val)=>page.$eval(sel,(el,v)=>{el.value=v;el.dispatchEvent(new Event("input",{bubbles:true}));},val);
    await set("#"+prefix+"-draft-rows tr:first-child [data-field=date]","2026-11-22");
    await page.select("#"+prefix+"-draft-rows tr:first-child [data-field=hour]","23");
    await page.select("#"+prefix+"-draft-rows tr:first-child [data-field=code]","MDP-100-155");
    await set("#"+prefix+"-draft-rows tr:first-child [data-field=target]","120");
    await set("#"+prefix+"-draft-rows tr:first-child [data-field=actual]","115");
    await set("#"+prefix+"-draft-rows tr:first-child [data-field=remarks]",module+" browser test");
    await page.click("#"+prefix+"-save-draft");
    const historySelector="#"+(module==="hourly_coding"?"hc-history-rows":"ha-history-rows");
    await page.waitForFunction(selector=>document.querySelector(selector+" tr")?.innerText.includes("MDP-100-155"),{timeout:10000},historySelector);
   }
   await page.waitForFunction(()=>document.body.dataset.tfiHourlyAnalytics==="ready",{timeout:12000});
   const analytics=await page.evaluate(prefix=>({
    records:document.querySelector("#"+prefix+"-analytics-records")?.textContent,
    actual:document.querySelector("#"+prefix+"-analytics-actual")?.textContent,
    hours:document.querySelectorAll("#"+prefix+"-analytics-hourly .hp-hour-col").length,
    days:document.querySelectorAll("#"+prefix+"-analytics-daily .hp-day-col").length,
    products:document.querySelectorAll("#"+prefix+"-analytics-products .hp-product-row").length
   }),module==="hourly_meat"?"hm":module==="hourly_coding"?"hc":"ha");
   if(analytics.records!=="1"||analytics.actual!=="115"||analytics.hours!==24||analytics.days!==1||analytics.products!==1)
    throw new Error(module+" analytics visualization failed: "+JSON.stringify(analytics));
   await page.setViewport({width:390,height:844});
   if(!(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)))
    throw new Error(module+" analytics layout overflows mobile viewport");
   await page.setViewport({width:1500,height:1000});
   const tbody=module==="hourly_meat"?"hm-saved-tbody":module==="hourly_coding"?"hc-history-rows":"ha-history-rows";
   await page.click("#"+tbody+' button[data-hourly-action="edit"]');
   await page.$eval("#tfi-hourly-edit-actual",el=>{el.value="110";});
   await page.click("#tfi-hourly-edit-save");
   await page.waitForFunction(selector=>document.querySelector(selector+" tr")?.innerText.includes("110"),{timeout:10000},"#"+tbody);
   await page.click("#"+tbody+' button[data-hourly-action="history"]');
   await page.waitForFunction(()=>document.querySelector("#tfi-hourly-history-content").innerText.includes("Version 2"),{timeout:10000});
   await page.waitForFunction(prefix=>document.querySelector("#"+prefix+"-analytics-actual")?.textContent==="110",{timeout:10000},module==="hourly_meat"?"hm":module==="hourly_coding"?"hc":"ha");
   if(errors.length)throw new Error(module+" browser errors: "+errors.join(" | "));
   results.push({module,status:"PASS",recordCount:records[module].length,createCalls:calls.create.filter(x=>x.module===module).length,updateCalls:calls.update.filter(x=>x.module===module).length,browserErrors:errors});
   await page.close();
  }
  console.log(JSON.stringify({status:"PASS",results,productCodeOptions:products.length},null,2));
 }finally{await browser.close();server.close();}
}
main().catch(e=>{console.error(e.stack||e);server.close(()=>process.exit(1));});
