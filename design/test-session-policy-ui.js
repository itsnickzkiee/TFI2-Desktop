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

 const desktop=await browser.newPage();
 await desktop.setViewport({width:1440,height:1000});
 watch(desktop);
 await desktop.goto(file("system-settings-preview.html"),{waitUntil:"load"});
 await desktop.waitForSelector("#section-session");
 const navCount=await desktop.$$eval(".ss-nav-btn",els=>els.length);
 const metricCount=await desktop.$eval(".ss-metrics .metric-value",el=>el.textContent.trim());
 await desktop.click('.ss-nav-btn[data-section="session"]');
 const initial=await desktop.evaluate(()=>({
  active:document.querySelector("#section-session").classList.contains("active"),
  status:document.querySelector("#session-policy-status").textContent,
  idle:document.querySelector("#summary-idle").textContent,
  warning:document.querySelector("#summary-warning").textContent,
  lifetime:document.querySelector("#summary-lifetime").textContent,
  concurrent:document.querySelector("#summary-concurrent").textContent,
  restart:document.querySelector("#summary-browser-restart").textContent,
  extension:document.querySelector("#summary-extension").textContent,
  password:document.querySelector("#summary-password-revoke").textContent,
  audit:document.querySelector("#summary-audit-events").textContent,
  disclaimer:document.querySelector(".sp-intro-note").innerText
 }));
 await desktop.screenshot({path:path.join(dir,"session-policy-desktop.png"),fullPage:true});
 await desktop.select("#idle-timeout","45 minutes");
 await desktop.select("#warning-window","3 minutes");
 await desktop.select("#absolute-lifetime","12 hours");
 await desktop.select("#concurrent-sessions","2 sessions");
 await desktop.click("#allow-extension");
 const changed=await desktop.evaluate(()=>({
  idle:document.querySelector("#summary-idle").textContent,
  warning:document.querySelector("#summary-warning").textContent,
  lifetime:document.querySelector("#summary-lifetime").textContent,
  concurrent:document.querySelector("#summary-concurrent").textContent,
  extension:document.querySelector("#summary-extension").textContent,
  status:document.querySelector("#session-policy-status").textContent
 }));
 await desktop.click('[data-save-section="session"]');
 const saved=await desktop.$eval("#session-policy-status",el=>el.textContent);
 await desktop.select("#idle-timeout","60 minutes");
 await desktop.click('[data-reset-section="session"]');
 const reset=await desktop.evaluate(()=>({
  idle:document.querySelector("#summary-idle").textContent,
  warning:document.querySelector("#summary-warning").textContent,
  lifetime:document.querySelector("#summary-lifetime").textContent,
  concurrent:document.querySelector("#summary-concurrent").textContent,
  extension:document.querySelector("#summary-extension").textContent,
  status:document.querySelector("#session-policy-status").textContent
 }));
 await desktop.click("#back-to-security");
 const backSecurity=await desktop.$eval("#section-security",el=>el.classList.contains("active"));
 await desktop.click("#open-session-policy");
 const ctaOpens=await desktop.$eval("#section-session",el=>el.classList.contains("active"));
 await desktop.screenshot({path:path.join(dir,"session-policy-after-save-desktop.png"),fullPage:true});

 const warningTab=await browser.newPage();
 await warningTab.setViewport({width:1440,height:900});
 watch(warningTab);
 await warningTab.goto(file("system-settings-preview.html"),{waitUntil:"load"});
 await warningTab.click('.ss-nav-btn[data-section="session"]');
 await Promise.all([
  warningTab.waitForNavigation({waitUntil:"load"}),
  warningTab.click("#preview-timeout-warning")
 ]);
 const warningPage={title:await warningTab.title(),ready:await warningTab.$eval("body",el=>el.dataset.tfiReady)};
 await warningTab.goBack({waitUntil:"load"});
 await warningTab.click('.ss-nav-btn[data-section="session"]');
 await Promise.all([
  warningTab.waitForNavigation({waitUntil:"load"}),
  warningTab.click("#preview-session-expired")
 ]);
 const expiredPage={title:await warningTab.title(),url:warningTab.url()};

 const mobile=await browser.newPage();
 await mobile.setViewport({width:390,height:844});
 watch(mobile);
 await mobile.goto(file("system-settings-preview.html"),{waitUntil:"load"});
 await mobile.click('.ss-nav-btn[data-section="session"]');
 const mobileLayout=await mobile.evaluate(()=>({
  viewport:innerWidth,clientWidth:document.documentElement.clientWidth,
  scrollWidth:document.documentElement.scrollWidth,
  overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth,
  contentWidth:Math.round(document.querySelector("#section-session").getBoundingClientRect().width),
  layoutColumns:getComputedStyle(document.querySelector(".sp-layout")).gridTemplateColumns,
  sideVisible:!!document.querySelector(".sp-side").getClientRects().length
 }));
 await mobile.screenshot({path:path.join(dir,"session-policy-mobile.png"),fullPage:true});
 await mobile.setViewport({width:320,height:844});
 const narrow=await mobile.evaluate(()=>({
  viewport:innerWidth,clientWidth:document.documentElement.clientWidth,
  scrollWidth:document.documentElement.scrollWidth,
  overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth
 }));

 const embedded=await browser.newPage();
 await embedded.setViewport({width:1440,height:1000});
 watch(embedded);
 await embedded.goto(file("system-settings-preview.html")+"?embedded=1&module=Settings",{waitUntil:"load"});
 await embedded.click('.ss-nav-btn[data-section="session"]');
 const embeddedWorks=await embedded.$eval("#section-session",el=>el.classList.contains("active"));
 await embedded.click("#back-to-security");
 const embeddedBack=await embedded.$eval("#section-security",el=>el.classList.contains("active"));

 const direct=await browser.newPage();
 await direct.setViewport({width:1440,height:1000});
 watch(direct);
 await direct.goto(file("system-settings-preview.html")+"?section=session",{waitUntil:"load"});
 const directSection=await direct.$eval("#section-session",el=>el.classList.contains("active"));

 const result={
  navCount,metricCount,initial,changed,saved,reset,backSecurity,ctaOpens,
  warningPage,expiredPage,mobileLayout,narrow,embeddedWorks,embeddedBack,directSection,
  errors,failed,requests,
  pass:navCount===7&&metricCount==="7"&&initial.active&&initial.status==="Draft proposal · not active"&&
   initial.idle==="30 minutes"&&initial.warning==="2 minutes"&&initial.lifetime==="8 hours"&&
   initial.concurrent==="1 session"&&initial.restart==="Required"&&initial.extension==="Allowed once"&&
   initial.password==="Revoke on change"&&initial.audit==="Enabled"&&
   initial.disclaimer.includes("not approved security rules")&&
   changed.idle==="45 minutes"&&changed.warning==="3 minutes"&&changed.lifetime==="12 hours"&&
   changed.concurrent==="2 sessions"&&changed.extension==="Disabled"&&changed.status==="Unsaved changes · not active"&&
   saved==="Draft saved · not active"&&reset.idle==="45 minutes"&&reset.warning==="3 minutes"&&
   reset.lifetime==="12 hours"&&reset.concurrent==="2 sessions"&&reset.extension==="Disabled"&&
   reset.status==="Draft restored · not active"&&backSecurity&&ctaOpens&&
   warningPage.title==="TFI | Session Timeout Warning"&&warningPage.ready==="true"&&
   expiredPage.title==="TFI | Session Expired"&&expiredPage.url.endsWith("session-expired-preview.html")&&
   !mobileLayout.overflow&&mobileLayout.sideVisible&&!narrow.overflow&&embeddedWorks&&embeddedBack&&directSection&&
   errors.length===0&&failed.length===0&&requests.every(x=>x.startsWith("file://"))
 };
 console.log(JSON.stringify(result,null,2));
 await browser.close();
 if(!result.pass)process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1});