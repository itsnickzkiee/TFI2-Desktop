const fs=require("fs");
const path=require("path");
const http=require("http");

const root=path.resolve(__dirname,"../..");
const designDir=path.join(root,"design");
const counts=new Map();

const server=http.createServer((req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,"http://127.0.0.1:5113").pathname);
  if(pathname==="/favicon.ico"){res.writeHead(204);res.end();return;}
  const target=path.resolve(designDir,"."+pathname);
  if(!target.startsWith(designDir)||!fs.existsSync(target)||!fs.statSync(target).isFile()){
    res.writeHead(404);res.end("Not found");return;
  }
  counts.set(pathname,(counts.get(pathname)||0)+1);
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
  await new Promise(resolve=>server.listen(5113,"127.0.0.1",resolve));
  const browser=await puppeteer.launch({headless:true,args:["--no-sandbox","--disable-setuid-sandbox"]});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:950}});
    let mainNavigations=0;
    const navigationEvents=[];
    const pageErrors=[];
    page.on("framenavigated",frame=>{const isMain=frame===page.mainFrame();navigationEvents.push({url:frame.url(),isMain,parent:!!frame.parentFrame()});if(isMain)mainNavigations++;});
    page.on("pageerror",error=>pageErrors.push(error.message));
    await page.goto("http://127.0.0.1:5113/dashboard-preview.html",{waitUntil:"networkidle0"});
    const before=await page.evaluate(()=>({
      iframes:document.querySelectorAll("#tfi-module-stage iframe").length,
      cacheSize:document.body.dataset.tfiModuleCacheSize||"0",
      navMode:document.body.dataset.tfiNavMode||"not-started"
    }));
    if(before.iframes!==0)throw new Error("Modules were eagerly loaded before a user selected one: "+JSON.stringify(before));

    async function openModule(name){
      await page.click('.sidebar .nav-link[data-page="'+name+'"]');
      await page.waitForFunction(value=>document.body.dataset.tfiActiveModule===value,{timeout:15000},name);
      return page.evaluate(()=>({
        active:document.body.dataset.tfiActiveModule,
        cache:Number(document.body.dataset.tfiModuleCacheSize||0),
        iframeCount:document.querySelectorAll("#tfi-module-stage iframe").length,
        highlighted:document.querySelector(".sidebar .nav-link.active")?.dataset.page||""
      }));
    }

    const first=await openModule("Production Entry");
    if(first.cache!==1||first.iframeCount!==1||first.highlighted!=="Production Entry")throw new Error("First module was not lazily mounted: "+JSON.stringify(first));
    const firstLoadCount=counts.get("/production-entry-preview.html")||0;

    const second=await openModule("Product Entry");
    if(second.cache!==2||second.iframeCount!==2)throw new Error("Second module did not create one on-demand cache entry: "+JSON.stringify(second));
    const productEntryLoads=counts.get("/product-entry-preview.html")||0;

    const cached=await openModule("Production Entry");
    const afterCachedLoadCount=counts.get("/production-entry-preview.html")||0;
    if(afterCachedLoadCount!==firstLoadCount||cached.cache!==2)throw new Error("Returning to a cached module caused another document load: "+JSON.stringify({firstLoadCount,afterCachedLoadCount,cached}));

    const modules=["DMP Production","DMR Production","OEE","Productivity","Production Schedule"];
    const opened=[];
    for(const name of modules)opened.push(await openModule(name));
    const cacheAfterSeven=await page.evaluate(()=>({
      size:Number(document.body.dataset.tfiModuleCacheSize||0),
      frames:document.querySelectorAll("#tfi-module-stage iframe").length
    }));
    if(cacheAfterSeven.size>6||cacheAfterSeven.frames>6)throw new Error("The LRU cache exceeded its six-module cap: "+JSON.stringify(cacheAfterSeven));

    const beforeRecent=counts.get("/productivity-preview.html")||0;
    const recent=await openModule("Productivity");
    const afterRecent=counts.get("/productivity-preview.html")||0;
    if(beforeRecent!==afterRecent)throw new Error("Recently used module did not return from cache: "+JSON.stringify({beforeRecent,afterRecent,recent}));

    await page.click('.sidebar .nav-link[data-page="DMR Coding"]');
    const immediateHighlight=await page.evaluate(()=>document.querySelector(".sidebar .nav-link.active")?.dataset.page||"");
    await page.click('.sidebar .nav-link[data-page="DMP Production"]');
    await page.waitForFunction(()=>document.body.dataset.tfiActiveModule==="DMP Production",{timeout:15000});
    const race=await page.evaluate(()=>({
      active:document.body.dataset.tfiActiveModule,
      highlighted:document.querySelector(".sidebar .nav-link.active")?.dataset.page||"",
      pending:document.body.dataset.tfiPendingModule||""
    }));
    if(immediateHighlight!=="DMR Coding"||race.active!=="DMP Production"||race.highlighted!=="DMP Production"||race.pending!==""){
      throw new Error("Rapid navigation did not settle on the last requested module: "+JSON.stringify({immediateHighlight,race}));
    }

    if(new URL(page.url()).pathname!=="/dashboard-preview.html"||(counts.get("/dashboard-preview.html")||0)!==1)throw new Error("Module switches reloaded the top-level dashboard document: "+page.url());
    if(pageErrors.length)throw new Error("Browser runtime errors: "+pageErrors.join(" | "));
    const result={
      status:"PASS",
      before,
      first,
      second,
      cachedReturn:{loadCountBefore:firstLoadCount,loadCountAfter:afterCachedLoadCount,cache:cached.cache},
      productEntryInitialLoads:productEntryLoads,
      cacheAfterSeven,
      recentReturn:{before:beforeRecent,after:afterRecent},
      rapidSwitch:{immediateHighlight,race},
      topLevelDocumentLoads:counts.get("/dashboard-preview.html")||0,
      finalPageUrl:page.url(),
      documentLoads:Object.fromEntries(counts),
      browserErrors:pageErrors
    };
    await page.screenshot({path:path.join(designDir,"navigation-lazy-cache-verified-desktop.png"),fullPage:false});
    console.log(JSON.stringify(result,null,2));
  }finally{
    await browser.close();
    server.close();
  }
}
main().catch(error=>{console.error(error.stack||error);server.close(()=>process.exit(1));});
