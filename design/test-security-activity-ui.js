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
 await page.goto(file("security-activity-preview.html"),{waitUntil:"load"});
 await page.waitForSelector("#active-session-rows");
 const initial=await page.evaluate(()=>({
  title:document.title,
  heading:document.querySelector("h1")?.textContent.trim(),
  activeSessions:document.querySelector("#metric-active-sessions")?.textContent.trim(),
  successful:document.querySelector("#metric-success-logins")?.textContent.trim(),
  failed:document.querySelector("#metric-failed-logins")?.textContent.trim(),
  security:document.querySelector("#metric-security-events")?.textContent.trim(),
  sessionRows:document.querySelectorAll("#active-session-rows tr").length,
  loginRows:document.querySelectorAll("#login-history-rows tr").length,
  sessionEmptyVisible:!document.querySelector("#active-session-empty").hidden,
  sessionTableHidden:document.querySelector("#active-session-table-wrap").hidden,
  loginEmptyVisible:!document.querySelector("#login-history-empty").hidden,
  loginTableHidden:document.querySelector("#login-history-panel").hidden,
  revokeDisabled:document.querySelector("#revoke-selected").disabled,
  posture:document.querySelector(".sa-posture-list").innerText,
  notice:document.querySelector(".sa-connection-note").innerText,
  navCount:document.querySelectorAll(".sidebar .nav-link").length,
  navActive:document.querySelector('.sidebar .nav-link.active')?.dataset.page,
  duplicateIds:[...document.querySelectorAll("[id]")].map(x=>x.id).filter((id,i,a)=>a.indexOf(id)!==i),
 }));
 await page.screenshot({path:path.join(dir,"security-activity-desktop.png"),fullPage:true});
 await page.click("#login-tab-failed");
 const failedTab=await page.evaluate(()=>({
  selected:document.querySelector("#login-tab-failed").getAttribute("aria-selected"),
  panelLabel:document.querySelector("#login-history-panel").getAttribute("aria-labelledby"),
  emptyText:document.querySelector("#login-history-empty").innerText
 }));
 await page.click("#login-tab-success");
 const successTab=await page.$eval("#login-tab-success",el=>el.getAttribute("aria-selected"));
 await page.click("#refresh-security");
 const refreshToast=await page.$eval(".toast",el=>el.textContent);
 await page.click("#manage-session-policy");
 await page.waitForFunction(()=>document.title==="TFI | System Settings");
 const directPolicy=await page.evaluate(()=>({
  title:document.title,
  active:document.querySelector("#section-session")?.classList.contains("active"),
  status:document.querySelector("#session-policy-status")?.textContent.trim()
 }));

 const shell=await browser.newPage();
 await shell.setViewport({width:1440,height:1000});
 watch(shell);
 await shell.goto(file("dashboard-preview.html"),{waitUntil:"load"});
 await shell.click('.sidebar .nav-link[data-page="Security & Activity"]');
 await shell.waitForFunction(()=>[...document.querySelectorAll("iframe")].some(f=>f.classList.contains("is-active")&&f.src.includes("security-activity-preview.html")));
 let secFrame=shell.frames().find(f=>f.url().includes("security-activity-preview.html"));
 await secFrame.waitForSelector("#manage-session-policy");
 const embeddedNav=await shell.evaluate(()=>({
  active:[...document.querySelectorAll("iframe")].find(f=>f.classList.contains("is-active"))?.src,
  activeNav:document.querySelector(".sidebar .nav-link.active")?.dataset.page
 }));
 await secFrame.click("#manage-session-policy");
 await shell.waitForFunction(()=>[...document.querySelectorAll("iframe")].some(f=>f.classList.contains("is-active")&&f.src.includes("system-settings-preview.html")&&f.src.includes("section=session")));
 const settingsFrame=shell.frames().find(f=>f.url().includes("system-settings-preview.html")&&f.url().includes("section=session"));
 await settingsFrame.waitForSelector("#section-session");
 const embeddedPolicy=await settingsFrame.$eval("#section-session",el=>el.classList.contains("active"));
 await settingsFrame.click("#back-to-security");
 const backToSecurity=await settingsFrame.$eval("#section-security",el=>el.classList.contains("active"));
 await shell.click('.sidebar .nav-link[data-page="Security & Activity"]');
 await shell.waitForFunction(()=>[...document.querySelectorAll("iframe")].some(f=>f.classList.contains("is-active")&&f.src.includes("security-activity-preview.html")));
 secFrame=shell.frames().find(f=>f.url().includes("security-activity-preview.html"));
 await secFrame.click("#open-audit-from-events");
 await shell.waitForFunction(()=>[...document.querySelectorAll("iframe")].some(f=>f.classList.contains("is-active")&&f.src.includes("audit-trail-preview.html")));
 const auditRoute=await shell.evaluate(()=>[...document.querySelectorAll("iframe")].find(f=>f.classList.contains("is-active"))?.src||"");
 await shell.click('.sidebar .nav-link[data-page="Security & Activity"]');
 await shell.waitForFunction(()=>[...document.querySelectorAll("iframe")].some(f=>f.classList.contains("is-active")&&f.src.includes("security-activity-preview.html")));
 secFrame=shell.frames().find(f=>f.url().includes("security-activity-preview.html"));
 await secFrame.click("#manage-users");
 await shell.waitForFunction(()=>[...document.querySelectorAll("iframe")].some(f=>f.classList.contains("is-active")&&f.src.includes("users-access-preview.html")));
 const usersRoute=await shell.evaluate(()=>[...document.querySelectorAll("iframe")].find(f=>f.classList.contains("is-active"))?.src||"");

 const mobile=await browser.newPage();
 await mobile.setViewport({width:390,height:844});
 watch(mobile);
 await mobile.goto(file("security-activity-preview.html")+"?embedded=1&module=Security%20%26%20Activity",{waitUntil:"load"});
 const mobileLayout=await mobile.evaluate(()=>({
  width:innerWidth,client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,
  overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth,
  grid:getComputedStyle(document.querySelector(".sa-layout")).gridTemplateColumns,
  columns:getComputedStyle(document.querySelector(".sa-side-column")).gridTemplateColumns
 }));
 await mobile.screenshot({path:path.join(dir,"security-activity-mobile.png"),fullPage:true});
 await mobile.setViewport({width:320,height:844});
 const narrow=await mobile.evaluate(()=>({width:innerWidth,client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth}));

 const result={
  initial,failedTab,successTab,refreshToast,directPolicy,embeddedNav,embeddedPolicy,backToSecurity,auditRoute,usersRoute,mobileLayout,narrow,
  errors,failed,requests,
  pass:initial.title==="TFI | Security & Activity"&&initial.heading==="Security & Activity"&&
   initial.activeSessions==="—"&&initial.successful==="—"&&initial.failed==="—"&&initial.security==="—"&&
   initial.sessionRows===0&&initial.loginRows===0&&initial.sessionEmptyVisible&&initial.sessionTableHidden&&initial.loginEmptyVisible&&initial.loginTableHidden&&initial.revokeDisabled&&
   initial.posture.includes("Not connected")&&initial.posture.includes("Draft · not active")&&
   initial.notice.includes("no sample accounts")&&initial.navActive==="Security & Activity"&&
   initial.duplicateIds.length===0&&
   failedTab.selected==="true"&&failedTab.panelLabel==="login-tab-failed"&&failedTab.emptyText.includes("No verified failed sign-in")&&
   successTab==="true"&&refreshToast.includes("not connected")&&directPolicy.active&&
   embeddedNav.active.includes("security-activity-preview.html")&&embeddedNav.activeNav==="Security & Activity"&&
   embeddedPolicy&&backToSecurity&&auditRoute.includes("audit-trail-preview.html")&&usersRoute.includes("users-access-preview.html")&&!mobileLayout.overflow&&!narrow.overflow&&
   errors.length===0&&failed.length===0&&requests.some(x=>x.endsWith("/security-activity-ui.js"))&&requests.some(x=>x.endsWith("/tfi-preview-router.js"))&&requests.every(x=>x.startsWith("file://"))
 };
 console.log(JSON.stringify(result,null,2));
 await browser.close();
 if(!result.pass)process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1});