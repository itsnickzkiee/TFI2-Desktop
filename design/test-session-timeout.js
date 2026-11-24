const puppeteer=require("C:/Users/Rominick/AppData/Local/npm-cache/_npx/4b4c857f6efdfb61/node_modules/puppeteer");
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
  await page.goto(pathToFileURL(path.join(dir,"session-timeout-preview.html")).href,{waitUntil:"load"});
  await page.waitForFunction(()=>document.body.dataset.tfiReady==="true");
  const desktop=await page.evaluate(()=>({
    title:document.title,
    ready:document.body.dataset.tfiReady,
    sessionConnected:document.body.dataset.tfiSessionConnected,
    countdownSimulated:document.body.dataset.tfiCountdownSimulated,
    dialogVisible:!!document.querySelector('[role="dialog"][aria-modal="true"]'),
    logoLoaded:document.querySelector(".brand-logo img").naturalWidth>0,
    workspaceLoaded:document.querySelector("#workspace-preview").naturalWidth>0,
    countdown:document.querySelector("#timeout-countdown").textContent,
    progressValue:document.querySelector("#timeout-progress").getAttribute("aria-valuenow"),
    primary:document.querySelector("#stay-signed-in").innerText.trim(),
    secondary:document.querySelector("#sign-out-now").innerText.trim(),
    overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth
  }));
  await page.screenshot({path:path.join(dir,"session-timeout-desktop.png"),fullPage:true});
  await page.waitForFunction(()=>document.querySelector("#timeout-countdown").textContent==="01:29",{timeout:4000});
  const timerAdvanced=await page.$eval("#timeout-countdown",el=>el.textContent==="01:29");
  await page.click("#stay-signed-in");
  const stayAction=await page.$eval("#action-status",el=>({visible:!el.hidden,text:el.textContent}));
  await page.click("#sign-out-now");
  const signOutAction=await page.$eval("#action-status",el=>el.textContent);
  const storage=await page.evaluate(()=>({localStorage:localStorage.length,sessionStorage:sessionStorage.length}));
  await page.keyboard.press("Escape");
  const escapeKeepsDialog=await page.$eval(".timeout-dialog",el=>!!el && getComputedStyle(el).display!=="none");

  const mobilePage=await browser.newPage();
  await mobilePage.setViewport({width:390,height:844});
  watch(mobilePage);
  await mobilePage.goto(pathToFileURL(path.join(dir,"session-timeout-preview.html")).href,{waitUntil:"load"});
  await mobilePage.waitForFunction(()=>document.body.dataset.tfiReady==="true");
  const mobile=await mobilePage.evaluate(()=>({
    viewport:innerWidth,
    clientWidth:document.documentElement.clientWidth,
    scrollWidth:document.documentElement.scrollWidth,
    overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth,
    dialogWidth:Math.round(document.querySelector(".timeout-dialog").getBoundingClientRect().width),
    dialogHeight:Math.round(document.querySelector(".timeout-dialog").getBoundingClientRect().height),
    actionColumns:getComputedStyle(document.querySelector(".dialog-actions")).gridTemplateColumns
  }));
  await mobilePage.screenshot({path:path.join(dir,"session-timeout-mobile.png"),fullPage:true});
  await mobilePage.setViewport({width:320,height:844});
  const narrow=await mobilePage.evaluate(()=>({
    viewport:innerWidth,
    clientWidth:document.documentElement.clientWidth,
    scrollWidth:document.documentElement.scrollWidth,
    overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth
  }));

  const result={
    desktop,timerAdvanced,stayAction,signOutAction,storage,escapeKeepsDialog,mobile,narrow,
    requests,errors,failed,
    pass:desktop.ready==="true"&&desktop.sessionConnected==="false"&&desktop.countdownSimulated==="true"&&
      desktop.dialogVisible&&desktop.logoLoaded&&desktop.workspaceLoaded&&desktop.countdown==="01:30"&&desktop.progressValue==="90"&&
      desktop.primary.includes("Stay signed in")&&desktop.secondary==="Sign out now"&&!desktop.overflow&&
      timerAdvanced&&stayAction.visible&&stayAction.text.includes("session extension is not connected")&&
      signOutAction.includes("No session was ended")&&storage.localStorage===0&&storage.sessionStorage===0&&
      escapeKeepsDialog&&!mobile.overflow&&!narrow.overflow&&requests.every(x=>x.startsWith("file://"))&&
      errors.length===0&&failed.length===0
  };
  console.log(JSON.stringify(result,null,2));
  await browser.close();
  if(!result.pass)process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1});