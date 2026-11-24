const puppeteer=require("C:/Users/Rominick/AppData/Local/npm-cache/_npx/4b4c857f6efdfb61/node_modules/puppeteer");
const path=require("path");
const{pathToFileURL}=require("url");
const dir="C:/Users/Rominick/Desktop/TFI_NEW/design";
const file=name=>pathToFileURL(path.join(dir,name)).href;
(async()=>{
  const browser=await puppeteer.launch({headless:true,args:["--no-sandbox","--disable-setuid-sandbox"]});
  const errors=[],failed=[],requests=[];
  function watch(page){
    page.on("pageerror",e=>errors.push(e.message));
    page.on("console",m=>{if(m.type()==="error")errors.push(m.text())});
    page.on("requestfailed",r=>failed.push(r.url()+" :: "+r.failure()?.errorText));
    page.on("request",r=>requests.push(r.url()));
  }

  const dashboard=await browser.newPage();
  await dashboard.setViewport({width:1440,height:900});
  watch(dashboard);
  await dashboard.goto(file("dashboard-preview.html"),{waitUntil:"load"});
  await dashboard.waitForFunction(()=>document.body.dataset.tfiSignoutReady==="true");
  const menuInitial=await dashboard.evaluate(()=>({
    triggerCount:document.querySelectorAll(".tfi-profile-trigger").length,
    dropdownHidden:document.querySelector(".tfi-profile-dropdown").hidden,
    signoutConnected:document.body.dataset.tfiSignoutConnected,
    topbarActions:document.querySelectorAll(".tfi-topbar-actions").length
  }));
  await dashboard.click(".tfi-profile-trigger");
  const menuOpened=await dashboard.$eval(".tfi-profile-dropdown",el=>!el.hidden);
  await dashboard.screenshot({path:path.join(dir,"sign-out-profile-menu-desktop.png"),fullPage:true});
  await dashboard.click(".tfi-signout-menu-item");
  const confirmation=await dashboard.evaluate(()=>({
    visible:!document.querySelector(".tfi-signout-backdrop").hidden,
    heading:document.querySelector("#tfi-signout-title").textContent,
    cancelFocused:document.activeElement.matches("[data-tfi-signout-cancel]"),
    previewNotice:document.querySelector(".tfi-signout-preview-note").innerText
  }));
  await dashboard.screenshot({path:path.join(dir,"sign-out-confirm-desktop.png"),fullPage:true});
  await dashboard.click("[data-tfi-signout-cancel]");
  const cancelWorks=await dashboard.$eval(".tfi-signout-backdrop",el=>el.hidden);
  await dashboard.click(".tfi-profile-trigger");
  await dashboard.click(".tfi-signout-menu-item");
  await Promise.all([
    dashboard.waitForNavigation({waitUntil:"load"}),
    dashboard.click("[data-tfi-signout-confirm]")
  ]);
  await dashboard.waitForFunction(()=>document.body.dataset.tfiSignoutSuccessReady==="true");
  const success=await dashboard.evaluate(()=>({
    title:document.title,
    heading:document.querySelector("#signout-title").textContent,
    status:document.querySelector(".signedout-status").innerText.replace(/\s+/g," ").trim(),
    countdown:document.querySelector("#redirect-countdown").textContent,
    sessionConnected:document.body.dataset.tfiSignoutConnected,
    autoRedirect:document.body.dataset.tfiAutoRedirect,
    previewNotice:document.querySelector(".preview-disclaimer").innerText
  }));
  await dashboard.screenshot({path:path.join(dir,"sign-out-success-desktop.png"),fullPage:true});
  await Promise.all([
    dashboard.waitForNavigation({waitUntil:"load"}),
    dashboard.click("#return-to-sign-in")
  ]);
  const manualRedirect={title:await dashboard.title(),url:dashboard.url()};

  const mobile=await browser.newPage();
  await mobile.setViewport({width:390,height:844});
  watch(mobile);
  await mobile.goto(file("dashboard-preview.html"),{waitUntil:"load"});
  await mobile.waitForFunction(()=>document.body.dataset.tfiSignoutReady==="true");
  await mobile.click(".tfi-profile-trigger");
  const mobileMenu=await mobile.$eval(".tfi-profile-dropdown",el=>!el.hidden);
  await mobile.screenshot({path:path.join(dir,"sign-out-profile-menu-mobile.png"),fullPage:true});
  await mobile.click(".tfi-signout-menu-item");
  const mobileDialog=await mobile.$eval(".tfi-signout-backdrop",el=>!el.hidden);
  await mobile.screenshot({path:path.join(dir,"sign-out-confirm-mobile.png"),fullPage:true});
  const mobileLayout=await mobile.evaluate(()=>({
    viewport:innerWidth,clientWidth:document.documentElement.clientWidth,
    scrollWidth:document.documentElement.scrollWidth,
    overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth,
    dialogWidth:Math.round(document.querySelector(".tfi-signout-dialog").getBoundingClientRect().width),
    cancelVisible:!!document.querySelector("[data-tfi-signout-cancel]").getClientRects().length,
    confirmVisible:!!document.querySelector("[data-tfi-signout-confirm]").getClientRects().length
  }));
  await mobile.keyboard.press("Escape");
  const escapeCloses=await mobile.$eval(".tfi-signout-backdrop",el=>el.hidden);
  await mobile.setViewport({width:320,height:844});
  const narrow=await mobile.evaluate(()=>({
    viewport:innerWidth,clientWidth:document.documentElement.clientWidth,
    scrollWidth:document.documentElement.scrollWidth,
    overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth
  }));

  const module=await browser.newPage();
  await module.setViewport({width:1440,height:900});
  watch(module);
  await module.goto(file("audit-trail-preview.html")+"?embedded=1&module=Audit%20Trail",{waitUntil:"load"});
  await module.waitForFunction(()=>document.body.dataset.tfiSignoutReady==="true");
  await module.click(".tfi-profile-trigger");
  const moduleMenu=await module.$eval(".tfi-profile-dropdown",el=>!el.hidden);
  await module.click(".tfi-signout-menu-item");
  const moduleDialog=await module.$eval(".tfi-signout-backdrop",el=>!el.hidden);

  const auto=await browser.newPage();
  await auto.setViewport({width:390,height:844});
  watch(auto);
  await auto.goto(file("sign-out-success-preview.html"),{waitUntil:"load"});
  await auto.waitForFunction(()=>document.body.dataset.tfiSignoutSuccessReady==="true");
  await auto.screenshot({path:path.join(dir,"sign-out-success-mobile.png"),fullPage:true});
  await auto.waitForFunction(()=>document.title==="TFI | Administrator Sign In",{timeout:7000});
  const automaticRedirect={title:await auto.title(),url:auto.url()};

  const result={
    menuInitial,menuOpened,confirmation,cancelWorks,success,manualRedirect,
    mobileMenu,mobileDialog,mobileLayout,escapeCloses,narrow,moduleMenu,moduleDialog,automaticRedirect,
    errors,failed,requests,
    pass:menuInitial.triggerCount===1&&menuInitial.dropdownHidden&&menuInitial.signoutConnected==="false"&&
      menuInitial.topbarActions===1&&menuOpened&&confirmation.visible&&confirmation.heading==="Sign out of TFI?"&&
      confirmation.cancelFocused&&confirmation.previewNotice.includes("does not revoke a real session")&&
      cancelWorks&&success.title==="TFI | Signed Out"&&success.heading==="You've been signed out"&&
      success.status.includes("Complete")&&success.countdown==="04"&&success.sessionConnected==="false"&&
      success.autoRedirect==="true"&&success.previewNotice.includes("No real session was revoked")&&
      manualRedirect.title==="TFI | Administrator Sign In"&&manualRedirect.url.endsWith("admin-login-preview.html")&&
      mobileMenu&&mobileDialog&&!mobileLayout.overflow&&mobileLayout.cancelVisible&&mobileLayout.confirmVisible&&
      escapeCloses&&!narrow.overflow&&moduleMenu&&moduleDialog&&
      automaticRedirect.title==="TFI | Administrator Sign In"&&automaticRedirect.url.endsWith("admin-login-preview.html")&&
      requests.every(x=>x.startsWith("file://"))&&errors.length===0&&failed.length===0
  };
  console.log(JSON.stringify(result,null,2));
  await browser.close();
  if(!result.pass)process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1});