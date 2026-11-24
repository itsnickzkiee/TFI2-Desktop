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

 const page=await browser.newPage();
 await page.setViewport({width:1440,height:1000});
 watch(page);
 await page.goto(file("session-management-preview.html"),{waitUntil:"load"});
 await page.waitForFunction(()=>document.body.dataset.tfiSessionManagementReady==="true");
 const desktop=await page.evaluate(()=>({
  title:document.title,
  heading:document.querySelector("h1")?.textContent.trim(),
  connected:document.body.dataset.tfiSessionManagementConnected,
  statusCards:document.querySelectorAll(".sm-readiness-card").length,
  statusTexts:[...document.querySelectorAll(".sm-readiness-card .sm-state")].map(x=>x.textContent.trim()),
  activeEmpty:document.querySelector(".sm-empty-state")?.innerText,
  policyStatus:document.querySelector("#sm-policy-title")?.closest(".sm-card")?.querySelector(".sm-state")?.textContent.trim(),
  lifecycleItems:document.querySelectorAll(".sm-lifecycle-item").length,
  readinessItems:document.querySelectorAll(".sm-readiness-list li").length,
  sessionNumbers:[...document.querySelectorAll(".sm-content")].flatMap(e=>[...e.querySelectorAll("[data-session-count],.session-count,.active-session-count")]).length,
  navSessionLinks:document.querySelectorAll('.sidebar .nav-link[data-page="Session Management"]').length,
  activeNav:document.querySelector('.sidebar .nav-link.active')?.dataset.page,
  duplicateIds:[...document.querySelectorAll("[id]")].map(x=>x.id).filter((id,i,a)=>a.indexOf(id)!==i),
  overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth
 }));
 await page.screenshot({path:path.join(dir,"session-management-desktop.png"),fullPage:true});
 await page.click("#sm-preview-signout");
 const standaloneSignout=await page.evaluate(()=>({
  visible:!document.querySelector(".tfi-signout-backdrop")?.hidden,
  heading:document.querySelector("#tfi-signout-title")?.textContent.trim(),
  preview:document.querySelector(".tfi-signout-preview-note")?.textContent.trim()
 }));
 await page.click("[data-tfi-signout-cancel]");
 const signoutCancel=await page.$eval(".tfi-signout-backdrop",e=>e.hidden);

 const mobile=await browser.newPage();
 await mobile.setViewport({width:390,height:844});
 watch(mobile);
 await mobile.goto(file("session-management-preview.html"),{waitUntil:"load"});
 await mobile.waitForFunction(()=>document.body.dataset.tfiSessionManagementReady==="true");
 const mobileLayout=await mobile.evaluate(()=>({
  viewport:innerWidth,clientWidth:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,
  overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth,
  readinessColumns:getComputedStyle(document.querySelector(".sm-readiness-grid")).gridTemplateColumns,
  layoutColumns:getComputedStyle(document.querySelector(".sm-layout")).gridTemplateColumns
 }));
 await mobile.screenshot({path:path.join(dir,"session-management-mobile.png"),fullPage:true});
 await mobile.setViewport({width:320,height:844});
 const narrow=await mobile.evaluate(()=>({viewport:innerWidth,clientWidth:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth}));

 const timeout=await browser.newPage();
 watch(timeout);
 await timeout.goto(file("session-management-preview.html"),{waitUntil:"load"});
 await timeout.click("#sm-preview-timeout");
 await timeout.waitForFunction(()=>document.title==="TFI | Session Timeout Warning");
 const timeoutRoute={title:await timeout.title(),connected:await timeout.$eval("body",e=>e.dataset.tfiSessionConnected),simulated:await timeout.$eval("body",e=>e.dataset.tfiCountdownSimulated)};

 const expired=await browser.newPage();
 watch(expired);
 await expired.goto(file("session-management-preview.html"),{waitUntil:"load"});
 await expired.click("#sm-preview-expired");
 await expired.waitForFunction(()=>document.title==="TFI | Session Expired");
 const expiredRoute={title:await expired.title(),url:expired.url()};

 const policy=await browser.newPage();
 await policy.setViewport({width:1440,height:900});
 watch(policy);
 await policy.goto(file("session-management-preview.html"),{waitUntil:"load"});
 await policy.click("#sm-edit-policy");
 await policy.waitForFunction(()=>[...document.querySelectorAll("iframe")].some(f=>f.classList.contains("is-active")&&f.src.includes("system-settings-preview.html")));
 const policyFrame=policy.frames().find(f=>f.url().includes("system-settings-preview.html")&&f.url().includes("embedded=1"));
 await policyFrame.waitForSelector("#section-session");
 const policyRoute=await policyFrame.$eval("#section-session",e=>e.classList.contains("active"));

 const security=await browser.newPage();
 watch(security);
 await security.goto(file("session-management-preview.html"),{waitUntil:"load"});
 await security.click("#sm-open-security");
 await security.waitForFunction(()=>[...document.querySelectorAll("iframe")].some(f=>f.classList.contains("is-active")&&f.src.includes("security-activity-preview.html")));
 const securityRoute=await security.evaluate(()=>[...document.querySelectorAll("iframe")].find(f=>f.classList.contains("is-active"))?.src||"");

 const navClick=await browser.newPage();
 await navClick.setViewport({width:1440,height:1000});
 watch(navClick);
 await navClick.goto(file("dashboard-preview.html"),{waitUntil:"load"});
 await navClick.waitForSelector('.sidebar .nav-link[data-page="Session Management"]');
 await navClick.click('.sidebar .nav-link[data-page="Session Management"]');
 await navClick.waitForFunction(()=>[...document.querySelectorAll("iframe")].some(f=>f.classList.contains("is-active")&&f.src.includes("session-management-preview.html")));
 const navClickRoute=await navClick.evaluate(()=>({active:document.querySelector(".sidebar .nav-link.active")?.dataset.page,frame:[...document.querySelectorAll("iframe")].find(f=>f.classList.contains("is-active"))?.src||""}));

 const embedded=await browser.newPage();
 await embedded.setViewport({width:1440,height:1000});
 watch(embedded);
 await embedded.goto(file("dashboard-preview.html")+"?module=Session%20Management",{waitUntil:"load"});
 await embedded.waitForFunction(()=>[...document.querySelectorAll("iframe")].some(f=>f.classList.contains("is-active")&&f.src.includes("session-management-preview.html")));
 const frame=embedded.frames().find(f=>f.url().includes("session-management-preview.html")&&f.url().includes("embedded=1"));
 await frame.waitForFunction(()=>document.body.dataset.tfiSessionManagementReady==="true");
 const embeddedInitial=await embedded.evaluate(()=>({
  navCount:document.querySelectorAll('.sidebar .nav-link[data-page="Session Management"]').length,
  activeNav:document.querySelector('.sidebar .nav-link.active')?.dataset.page
 }));
 await frame.click("#sm-open-policy");
 await embedded.waitForFunction(()=>[...document.querySelectorAll("iframe")].some(f=>f.classList.contains("is-active")&&f.src.includes("system-settings-preview.html")));
 const embeddedPolicy=await embedded.evaluate(()=>[...document.querySelectorAll("iframe")].find(f=>f.classList.contains("is-active"))?.src||"");
 const activeSettings=embedded.frames().find(f=>f.url().includes("system-settings-preview.html")&&f.url().includes("embedded=1"));
 await activeSettings.waitForSelector("#section-session");
 const embeddedPolicySection=await activeSettings.$eval("#section-session",e=>e.classList.contains("active"));

 await embedded.click('.sidebar .nav-link[data-page="Session Management"]');
 await embedded.waitForFunction(()=>[...document.querySelectorAll("iframe")].some(f=>f.classList.contains("is-active")&&f.src.includes("session-management-preview.html")));
 const activeSessionFrame=embedded.frames().find(f=>f.url().includes("session-management-preview.html")&&f.url().includes("embedded=1"));
 await activeSessionFrame.waitForFunction(()=>document.body.dataset.tfiSessionManagementReady==="true");
 await activeSessionFrame.click("#sm-preview-signout");
 const embeddedSignout=await embedded.$eval(".tfi-signout-backdrop",e=>!e.hidden);
 const embeddedSignoutHeading=await embedded.$eval("#tfi-signout-title",e=>e.textContent.trim());
 await embedded.click("[data-tfi-signout-cancel]");
 const embeddedCancel=await embedded.$eval(".tfi-signout-backdrop",e=>e.hidden);

 const result={
  desktop,standaloneSignout,signoutCancel,mobileLayout,narrow,timeoutRoute,expiredRoute,
  policyRoute,securityRoute,navClickRoute,embeddedInitial,embeddedPolicy,embeddedPolicySection,
  embeddedSignout,embeddedSignoutHeading,embeddedCancel,
  errors,failed,requests,
  pass:desktop.title==="TFI | Session Management"&&desktop.heading==="Session Management"&&
   desktop.connected==="false"&&desktop.statusCards===4&&desktop.statusTexts.includes("Not connected")&&
   desktop.activeEmpty.includes("not available")&&desktop.policyStatus.includes("Draft")&&
   desktop.lifecycleItems===3&&desktop.readinessItems===5&&desktop.sessionNumbers===0&&
   desktop.navSessionLinks===1&&desktop.activeNav==="Session Management"&&desktop.duplicateIds.length===0&&!desktop.overflow&&
   standaloneSignout.visible&&standaloneSignout.heading==="Sign out of TFI?"&&standaloneSignout.preview.includes("Preview only")&&signoutCancel&&
   !mobileLayout.overflow&&!narrow.overflow&&timeoutRoute.title==="TFI | Session Timeout Warning"&&
   timeoutRoute.connected==="false"&&timeoutRoute.simulated==="true"&&expiredRoute.title==="TFI | Session Expired"&&
   policyRoute&&securityRoute.includes("security-activity-preview.html")&&
   navClickRoute.active==="Session Management"&&navClickRoute.frame.includes("session-management-preview.html")&&
   embeddedInitial.navCount===1&&embeddedInitial.activeNav==="Session Management"&&
   embeddedPolicy.includes("system-settings-preview.html")&&embeddedPolicySection&&
   embeddedSignout&&embeddedSignoutHeading==="Sign out of TFI?"&&embeddedCancel&&
   errors.length===0&&failed.length===0&&requests.every(x=>x.startsWith("file://"))
 };
 console.log(JSON.stringify(result,null,2));
 await browser.close();
 if(!result.pass)process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1});