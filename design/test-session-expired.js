const puppeteer=require("C:/Users/Rominick/AppData/Local/npm-cache/_npx/4b4c857f6efdfb61/node_modules/puppeteer");
const fs=require("fs");
const path=require("path");
const{pathToFileURL}=require("url");
const dir="C:/Users/Rominick/Desktop/TFI_NEW/design";
(async()=>{
  const browser=await puppeteer.launch({headless:true,args:["--no-sandbox","--disable-setuid-sandbox"]});
  const errors=[],failed=[],requests=[];
  function watch(page){
    page.on("pageerror",e=>errors.push(e.message));
    page.on("console",m=>{if(m.type()==="error")errors.push(m.text())});
    page.on("requestfailed",r=>failed.push(r.url()+" :: "+r.failure()?.errorText));
    page.on("request",r=>requests.push(r.url()));
  }

  const page=await browser.newPage();
  await page.setViewport({width:1440,height:900});
  watch(page);
  await page.goto(pathToFileURL(path.join(dir,"session-expired-preview.html")).href,{waitUntil:"load"});
  const desktop=await page.evaluate(()=>({
    title:document.title,
    heading:document.querySelector("#expired-title")?.textContent,
    dialogDescription:document.querySelector("#expired-description")?.textContent,
    logoLoaded:document.querySelector(".brand-logo img").naturalWidth>0,
    workspaceLoaded:document.querySelector(".workspace-backdrop img").naturalWidth>0,
    sessionStatus:document.querySelector(".session-status").innerText.replace(/\s+/g," ").trim(),
    returnLink:document.querySelector("#return-to-sign-in").getAttribute("href"),
    returnVisible:!!document.querySelector("#return-to-sign-in").getClientRects().length,
    previewNotice:document.querySelector(".preview-disclaimer").innerText,
    overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth
  }));
  await page.screenshot({path:path.join(dir,"session-expired-desktop.png"),fullPage:true});
  await page.click("#return-to-sign-in");
  await page.waitForFunction(()=>document.title==="TFI | Administrator Sign In",{timeout:5000});
  const returnNavigation={title:await page.title(),url:page.url()};
  const loginScreenOpened=returnNavigation.title==="TFI | Administrator Sign In"&&returnNavigation.url.endsWith("admin-login-preview.html");

  const mobilePage=await browser.newPage();
  await mobilePage.setViewport({width:390,height:844});
  watch(mobilePage);
  await mobilePage.goto(pathToFileURL(path.join(dir,"session-expired-preview.html")).href,{waitUntil:"load"});
  const mobile=await mobilePage.evaluate(()=>({
    viewport:innerWidth,clientWidth:document.documentElement.clientWidth,
    scrollWidth:document.documentElement.scrollWidth,
    overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth,
    cardWidth:Math.round(document.querySelector(".expired-card").getBoundingClientRect().width),
    cardHeight:Math.round(document.querySelector(".expired-card").getBoundingClientRect().height),
    returnButtonVisible:!!document.querySelector("#return-to-sign-in").getClientRects().length
  }));
  await mobilePage.screenshot({path:path.join(dir,"session-expired-mobile.png"),fullPage:true});
  await mobilePage.setViewport({width:320,height:844});
  const narrow=await mobilePage.evaluate(()=>({
    viewport:innerWidth,clientWidth:document.documentElement.clientWidth,
    scrollWidth:document.documentElement.scrollWidth,
    overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth
  }));

  const localAssetsExist=["admin-login-preview.html","session-expired.css","dashboard-preview.png","assets/tosen-foods-logo.webp"].every(name=>fs.existsSync(path.join(dir,name)));
  const result={
    desktop,returnNavigation,loginScreenOpened,mobile,narrow,localAssetsExist,
    requests,errors,failed,
    pass:desktop.title==="TFI | Session Expired"&&desktop.heading==="Your session has expired"&&
      desktop.logoLoaded&&desktop.workspaceLoaded&&desktop.sessionStatus.includes("Expired")&&
      desktop.returnLink==="admin-login-preview.html"&&desktop.returnVisible&&!desktop.overflow&&
      desktop.previewNotice.includes("does not expire a real session")&&loginScreenOpened&&
      !mobile.overflow&&mobile.returnButtonVisible&&!narrow.overflow&&localAssetsExist&&
      requests.every(x=>x.startsWith("file://"))&&errors.length===0&&failed.length===0
  };
  console.log(JSON.stringify(result,null,2));
  await browser.close();
  if(!result.pass)process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1});