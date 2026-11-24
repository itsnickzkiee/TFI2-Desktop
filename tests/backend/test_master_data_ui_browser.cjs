const fs = require("fs");
const path = require("path");
const http = require("http");
const crypto = require("crypto");

const root = path.resolve(__dirname, "../..");
const designDir = path.join(root, "design");
const raw = fs.readFileSync(path.join(designDir, "master-data-source-data.js"), "utf8");
const marker = "window.TFI_MASTER_DATA = ";
const start = raw.indexOf(marker);
const jsonStart = start + marker.length;
const jsonEnd = raw.lastIndexOf("};");
const snapshot = JSON.parse(raw.slice(jsonStart, jsonEnd + 1));

const specs = [
  {key:"product_standard",sheet:"productStandard",width:21,count:110,editable:["B","C","D","E","H","I","J","K","L","M","N","O","P","Q","R","T","U"],readonly:["A","F","G","S"],headers:[1,2],first:3,ref:58,policy:"controlled_fields"},
  {key:"code_map",sheet:"codeMap",width:2,count:72,editable:["B"],readonly:["A"],headers:[4],first:5,ref:68,policy:"controlled_fields"},
  {key:"yield_map",sheet:"yieldMap",width:23,count:43,editable:["B","C","D","E","F","G","H","I","J","K","L","M"],readonly:["A","N","P","Q","R","S","T","U","V","W"],headers:[4],first:5,ref:39,policy:"controlled_fields"},
  {key:"entry_map",sheet:"entryMap",width:5,count:43,editable:[],readonly:["A","B","C","D","E"],headers:[1],first:2,ref:39,policy:"read_only"},
  {key:"kpi_setup",sheet:"kpiSetup",width:20,count:129,editable:[],readonly:"ABCDEFGHIJKLMNOPQRST".split(""),headers:[1],first:2,ref:128,policy:"read_only"},
  {key:"dpr_legend",sheet:"dprLegend",width:40,count:119,editable:[],readonly:["A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z","AA","AB","AC","AD","AE","AF","AG","AH","AI","AJ","AK","AL","AM","AN"],headers:[2],first:3,ref:116,policy:"read_only"},
  {key:"dmp_legend",sheet:"dmpLegend",width:4,count:70,editable:["A","B","C","D"],readonly:[],headers:[1],first:2,ref:69,policy:"controlled_fields",locked:[5,9,14,17,20,23,31,33,36,39]},
  {key:"manpower",sheet:"manpower",width:5,count:448,editable:["A","B","C","D","E"],readonly:[],headers:[3],first:4,ref:445,policy:"controlled_fields"},
  {key:"schedule_lists",sheet:"scheduleLists",width:12,count:101,editable:[],readonly:["A","B","C","D","E","F","G","H","I","J","K","L"],headers:[1],first:2,ref:100,policy:"auto_refreshed"}
];

function nonempty(v){return v!==null&&v!==undefined&&String(v)!=="";}
function rowKind(spec,row,n){
  if(spec.sheet==="productStandard"){
    if(n===1)return "header";
    if(row[0]==="▶")return "group_header";
    if(String(row[1]||"").includes("+ new variant code"))return "reserved_slot";
    if(nonempty(row[0]))return "data";
    return row.some(nonempty)?"helper":"blank";
  }
  if(spec.sheet==="codeMap"||spec.sheet==="yieldMap"){
    if(n===1)return "title";
    if(n===2)return "instruction";
    if(n===3)return "blank";
    if(n===4)return "header";
  }
  if(spec.sheet==="entryMap"){if(n===1)return "header";if(n===43)return "instruction";}
  if(spec.sheet==="kpiSetup"&&n===1)return "header";
  if(spec.sheet==="dprLegend"){if(n===1)return "title";if(n===2)return "header";}
  if(spec.sheet==="dmpLegend"&&n===1)return "header";
  if(spec.sheet==="manpower"){if(n===1)return "title";if(n===2)return "blank";if(n===3)return "header";}
  if(spec.sheet==="scheduleLists"&&n===1)return "header";
  return row.some(nonempty)?"data":"blank";
}
function colIndex(column){let n=0;for(const c of column)n=n*26+c.charCodeAt(0)-64;return n-1;}

const categories=[];
const rowsByKey={};
const revisionsById={};
for(let ci=0;ci<specs.length;ci++){
  const spec=specs[ci],sheet=snapshot.sheets[spec.sheet];
  const locked=spec.locked||[];
  const notes=spec.sheet==="dmpLegend"?(sheet.notes||[]):[];
  categories.push({
    category_key:spec.key,
    display_name:sheet.title,
    source_range:({
      product_standard:"A1:U110",code_map:"A1:B72",yield_map:"A1:W43",entry_map:"A1:E43",
      kpi_setup:"A1:T129",dpr_legend:"A1:AN119",dmp_legend:"A1:D70",manpower:"A1:E448",schedule_lists:"A1:L101"
    })[spec.key],
    source_row_count:spec.count,
    reference_count:spec.ref,
    source_column_count:spec.width,
    source_header_rows:spec.headers,
    first_data_row:spec.first,
    edit_policy:spec.policy,
    editable_columns:spec.editable,
    read_only_columns:spec.readonly,
    locked_source_rows:locked,
    field_rules:{},
    source_count_note:"",
    sort_order:ci+1,
    is_active:true
  });
  rowsByKey[spec.key]=sheet.values.map((rawRow,index)=>{
    const sourceRow=index+1;
    const values=Array.from({length:spec.width},(_,i)=>rawRow?.[i]??null);
    const sourceNotes=notes.filter(n=>n.sourceRow===sourceRow).map(n=>({column:String(n.column||""),status:String(n.status||"")}));
    const kind=rowKind(spec,values,sourceRow);
    const rowEditable=spec.editable.length>0&&kind==="data"&&!locked.includes(sourceRow);
    const fingerprint=crypto.createHash("sha256").update(JSON.stringify([values,sourceNotes])).digest("hex");
    return {
      id:"00000000-0000-0000-0000-"+String(ci*1000+sourceRow).padStart(12,"0"),
      category_key:spec.key,
      source_row_number:sourceRow,
      row_kind:kind,
      source_values:values,
      current_values:values,
      source_notes:sourceNotes,
      source_fingerprint:fingerprint,
      record_status:"active",
      row_editable:rowEditable,
      version:1
    };
  });
}

function sendJson(res,status,payload){
  const body=JSON.stringify(payload);
  res.writeHead(status,{"Content-Type":"application/json","Content-Length":Buffer.byteLength(body),"Cache-Control":"no-store"});
  res.end(body);
}
function readBody(req){
  return new Promise((resolve,reject)=>{
    let body="";
    req.on("data",chunk=>body+=chunk);
    req.on("end",()=>{try{resolve(JSON.parse(body||"{}"));}catch(e){reject(e);}});
    req.on("error",reject);
  });
}
const server=http.createServer(async(req,res)=>{
  const parsed=new URL(req.url,"http://127.0.0.1:5111");
  if(parsed.pathname==="/favicon.ico"){res.writeHead(204);res.end();return;}
  if(parsed.pathname==="/api/master-data/categories"){
    return sendJson(res,200,{categories,permissions:{view:true,edit:true}});
  }
  const rowsMatch=parsed.pathname.match(/^\/api\/master-data\/([a-z_]+)\/rows$/);
  if(rowsMatch){
    const key=rowsMatch[1],rows=rowsByKey[key];
    if(!rows)return sendJson(res,404,{error:"Unknown category"});
    const page=Math.max(1,Number(parsed.searchParams.get("page")||1));
    const pageSize=Math.min(500,Math.max(1,Number(parsed.searchParams.get("page_size")||100)));
    const start=(page-1)*pageSize;
    return sendJson(res,200,{category_key:key,rows:rows.slice(start,start+pageSize),page,page_size:pageSize,total:rows.length,pages:Math.max(1,Math.ceil(rows.length/pageSize))});
  }
  const revisionMatch=parsed.pathname.match(/^\/api\/master-data\/rows\/([0-9a-f-]+)\/revisions$/);
  if(req.method==="GET"&&revisionMatch){
    return sendJson(res,200,{row_id:revisionMatch[1],revisions:revisionsById[revisionMatch[1]]||[]});
  }
  const patchMatch=parsed.pathname.match(/^\/api\/master-data\/rows\/([0-9a-f-]+)$/);
  if(req.method==="PATCH"&&patchMatch){
    const body=await readBody(req);
    const row=Object.values(rowsByKey).flat().find(r=>r.id===patchMatch[1]);
    if(!row)return sendJson(res,404,{error:"Record not found"});
    if(row.version!==body.expected_version)return sendJson(res,409,{error:"Version conflict"});
    const before=[...row.current_values];
    const changedColumns=[];
    for(const [column,value] of Object.entries(body.changes||{})){
      const index=colIndex(column);
      if(!row.row_editable)return sendJson(res,403,{error:"Protected row"});
      if(String(row.current_values[index]??"")!==String(value)){
        row.current_values[index]=String(value);
        changedColumns.push(column);
      }
    }
    row.version++;
    const changedAt=new Date().toISOString();
    if(changedColumns.length){
      const revision={id:"revision-"+row.version,version:row.version,before_values:before,after_values:[...row.current_values],changed_columns:changedColumns,change_reason:body.change_reason||null,changed_by:"browser-test-user",changed_at:changedAt};
      (revisionsById[row.id] ||= []).unshift(revision);
    }
    return sendJson(res,200,{changed:changedColumns.length>0,id:row.id,category_key:row.category_key,source_row_number:row.source_row_number,version:row.version,current_values:row.current_values,updated_at:changedAt});
  }

  const filePath=path.resolve(designDir,"."+decodeURIComponent(parsed.pathname));
  if(!filePath.startsWith(designDir)||!fs.existsSync(filePath)||!fs.statSync(filePath).isFile()){
    res.writeHead(404);res.end("Not found");return;
  }
  const ext=path.extname(filePath).toLowerCase();
  const type={".html":"text/html; charset=utf-8",".js":"application/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".webp":"image/webp",".png":"image/png",".jpg":"image/jpeg"}[ext]||"application/octet-stream";
  res.writeHead(200,{"Content-Type":type});
  fs.createReadStream(filePath).pipe(res);
});

async function main(){
  let puppeteer;
  try{puppeteer=require("puppeteer");}
  catch{
    const cache=path.join(process.env.LOCALAPPDATA||"C:\\Users\\Rominick\\AppData\\Local","npm-cache","_npx");
    const found=fs.readdirSync(cache).map(dir=>path.join(cache,dir,"node_modules","puppeteer")).find(p=>fs.existsSync(p));
    if(!found)throw new Error("Puppeteer is not installed.");
    puppeteer=require(found);
  }
  await new Promise(resolve=>server.listen(5111,"127.0.0.1",resolve));
  const browser=await puppeteer.launch({headless:true,args:["--no-sandbox","--disable-setuid-sandbox"]});
  try{
    const page=await browser.newPage();
    const errors=[];
    page.on("pageerror",e=>errors.push(e.message));
    page.on("console",msg=>{if(msg.type()==="error")errors.push(msg.text());});
    await page.goto("http://127.0.0.1:5111/master-data-preview.html",{waitUntil:"networkidle0"});
    await page.waitForFunction(()=>document.body.dataset.tfiReady==="true",{timeout:20000});
    const source=await page.evaluate(()=>({
      dataSource:window.TFI_MASTER_DATA_UI?.dataSource,
      rowCount:document.body.dataset.tfiMasterDataRows,
      productEdit:!!document.querySelector('[data-source-edit="productStandard:3"]')
    }));
    if(source.dataSource!=="TFI2"||source.rowCount!=="1135"||!source.productEdit)throw new Error("TFI2 data hydration or Product Standard edit controls failed: "+JSON.stringify(source));

    const modules=[
      {key:"product",local:"productStandard",db:"product_standard",rows:110},
      {key:"code",local:"codeMap",db:"code_map",rows:72},
      {key:"yield",local:"yieldMap",db:"yield_map",rows:43},
      {key:"entry",local:"entryMap",db:"entry_map",rows:43},
      {key:"kpi",local:"kpiSetup",db:"kpi_setup",rows:129},
      {key:"dpr",local:"dprLegend",db:"dpr_legend",rows:119},
      {key:"dmp",local:"dmpLegend",db:"dmp_legend",rows:70},
      {key:"manpower",local:"manpower",db:"manpower",rows:448},
      {key:"schedule",local:"scheduleLists",db:"schedule_lists",rows:101}
    ];
    for(const module of modules){
      await page.click('[data-category="'+module.key+'"]');
      await page.waitForFunction(key=>document.body.dataset.tfiMasterDataCategory===key,{timeout:5000},module.key);
      const result=await page.evaluate(({local,db})=>({
        loadedRows:Object.keys(window.TFI_MASTER_DATA_UI.state.rowMeta[local]||{}).length,
        expectedRows:window.TFI_MASTER_DATA_UI.state.categoryMeta[db]?.source_row_count,
        rendered:document.querySelector("#data-content").innerText.trim().length>0
      }),module);
      if(result.loadedRows!==module.rows||result.expectedRows!==module.rows||!result.rendered){
        throw new Error("Master Data module failed to load/render: "+module.key+" "+JSON.stringify(result));
      }
    }
    await page.click('[data-category="product"]');
    await page.waitForFunction(()=>document.body.dataset.tfiMasterDataCategory==="product");
    await page.click('[data-source-edit="productStandard:3"]');
    await page.waitForSelector("#record-modal.open");
    const modalTitle=await page.$eval("#modal-title",el=>el.textContent);
    if(!modalTitle.includes("Edit record"))throw new Error("Edit modal did not open in live edit mode.");
    await page.$eval('input[name="field_1"]',el=>{el.value="BROWSER TEST PRODUCT NAME";});
    await page.click('#record-form button[type="submit"]');
    await page.waitForFunction(()=>document.body.innerText.includes("Saved to TFI2 · revision 2"),{timeout:10000});
    const updated=await page.$eval('[data-source-row="3"] td:nth-child(2)',el=>el.innerText);
    if(!updated.includes("BROWSER TEST PRODUCT NAME"))throw new Error("Saved product name was not rendered.");

    await page.click('[data-source-view="productStandard:3"]');
    await page.waitForSelector("#record-modal.open");
    await page.click("#view-history");
    await page.waitForSelector(".revision-item",{timeout:5000});
    const history=await page.$eval("#revision-list",el=>el.innerText);
    if(!history.includes("Revision 2")||!history.includes("BROWSER TEST PRODUCT NAME")||!history.includes("MAYON DRY PEAS 155G X 100")){
      throw new Error("Revision history did not show the saved before/after values: "+history);
    }
    await page.click("#cancel-modal");

    await page.click('[data-category="dmp"]');
    await page.waitForFunction(()=>document.body.dataset.tfiMasterDataCategory==="dmp");
    const dmpLock=await page.evaluate(()=>({
      locked:!!document.querySelector('[data-source-edit="dmpLegend:5"]'),
      editable:!!document.querySelector('[data-source-edit="dmpLegend:6"]')
    }));
    if(dmpLock.locked||!dmpLock.editable)throw new Error("DMP note-row lock behavior failed: "+JSON.stringify(dmpLock));

    await page.click('[data-category="entry"]');
    await page.waitForFunction(()=>document.body.dataset.tfiMasterDataCategory==="entry");
    const entryEditCount=await page.$$eval("[data-source-edit]",els=>els.length);
    if(entryEditCount!==0)throw new Error("Read-only Entry Map unexpectedly exposed edit controls.");

    if(errors.length)throw new Error("Browser console errors: "+errors.join(" | "));
    console.log(JSON.stringify({browser:"PASS",dataSource:source.dataSource,sourceRows:Number(source.rowCount),modulesLoaded:modules.length,allNineModules:"PASS",productEdit:"PASS",saveFlow:"PASS",revisionHistory:"PASS",dmpRowLocks:"PASS",entryMapReadOnly:"PASS",consoleErrors:errors.length},null,2));
  }finally{
    await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
}
main().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
