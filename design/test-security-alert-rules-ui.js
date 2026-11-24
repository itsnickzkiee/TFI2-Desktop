const puppeteer=require("C:/Users/Rominick/AppData/Local/npm-cache/_npx/4b4c857f6efdfb61/node_modules/puppeteer");
const path=require("path");const{pathToFileURL}=require("url");const dir="C:/Users/Rominick/Desktop/TFI_NEW/design";const file=n=>pathToFileURL(path.join(dir,n)).href;
(async()=>{
 const browser=await puppeteer.launch({headless:true,args:["--no-sandbox","--disable-setuid-sandbox"]});
 const errors=[],failed=[];
 const watch=p=>{p.on("pageerror",e=>errors.push(e.message));p.on("console",m=>{if(m.type()==="error")errors.push(m.text())});p.on("requestfailed",r=>failed.push(r.url()+" :: "+r.failure()?.errorText));};
 const page=await browser.newPage();watch(page);await page.setViewport({width:1440,height:1000});
 await page.goto(file("security-alert-rules-preview.html"),{waitUntil:"load"});await page.waitForSelector("#rule-rows");
 const initial=await page.evaluate(()=>({
  title:document.title,heading:document.querySelector("h1")?.textContent.trim(),
  navActive:document.querySelector('.sidebar .nav-link.active')?.dataset.page,
  navCount:document.querySelectorAll('.sidebar .nav-link[data-page="Security Alert Rules & Notifications"]').length,
  adminLinks:document.querySelectorAll('.nav-group').length,
  draftCount:document.querySelector("#metric-draft-rules")?.textContent.trim(),
  enabledRules:document.querySelectorAll(".sar-metrics .metric-value")[1]?.textContent.trim(),
  connectedChannels:document.querySelectorAll(".sar-metrics .metric-value")[2]?.textContent.trim(),
  sent:document.querySelectorAll(".sar-metrics .metric-value")[3]?.textContent.trim(),
  rows:document.querySelectorAll("#rule-rows tr").length,
  empty:!document.querySelector("#rules-empty").hidden,
  channelsDisabled:[...document.querySelectorAll("#panel-channels button")].every(b=>b.disabled),
  historyEmpty:!document.querySelector("#history-empty").hidden,
  historySearchDisabled:document.querySelector("#history-search").disabled&&document.querySelector("#history-channel-filter").disabled,
  duplicateIds:[...document.querySelectorAll("[id]")].map(x=>x.id).filter((id,i,a)=>a.indexOf(id)!==i)
 }));
 await page.click("#tab-channels");const channels=await page.evaluate(()=>({selected:document.querySelector("#tab-channels").getAttribute("aria-selected"),visible:!document.querySelector("#panel-channels").hidden,disabled:[...document.querySelectorAll("#panel-channels button")].every(b=>b.disabled)}));
 await page.click("#tab-history");const history=await page.evaluate(()=>({selected:document.querySelector("#tab-history").getAttribute("aria-selected"),visible:!document.querySelector("#panel-history").hidden,empty:!document.querySelector("#history-empty").hidden,rows:document.querySelectorAll("#history-rows tr").length}));
 await page.click("#tab-rules");
 await page.click("#create-alert-rule");
 const requiredFields=await page.$eval("#rule-form",form=>!form.checkValidity());
 await page.click('#rule-form button[type=submit]');
 const invalidDidNotSave=await page.$eval("#metric-draft-rules",e=>e.textContent==="0");
 await page.$eval("#rule-name",e=>e.value="Repeated sign-in attempts");
 await page.select("#rule-trigger","Repeated failed sign-ins for one account");
 await page.select("#rule-severity","critical");
 await page.select("#rule-channel","email");
 await page.$eval("#rule-recipients",e=>e.value="Authorized security reviewers");
 await page.click('#rule-form button[type="submit"]');
 const created=await page.evaluate(()=>({count:document.querySelector("#metric-draft-rules").textContent,rows:document.querySelectorAll("#rule-rows tr").length,empty:!document.querySelector("#rules-empty").hidden,enabled:document.querySelectorAll(".sar-metrics .metric-value")[1].textContent,historyRows:document.querySelectorAll("#history-rows tr").length,cell:document.querySelector("#rule-rows").innerText}));
 await page.click('#rule-rows button[data-action="edit"]');
 await page.$eval("#rule-name",e=>e.value="Repeated sign-in attempts - revised");
 await page.click('#rule-form button[type="submit"]');
 const edited=await page.$eval("#rule-rows",e=>e.innerText);
 await page.click('#rule-rows button[data-action="discard"]');
 const discarded=await page.evaluate(()=>({count:document.querySelector("#metric-draft-rules").textContent,rows:document.querySelectorAll("#rule-rows tr").length,empty:!document.querySelector("#rules-empty").hidden}));
 await page.click("#create-alert-rule");await page.keyboard.press("Escape");
 const modalEscape=await page.$eval("#rule-modal",e=>e.getAttribute("aria-hidden"));
 await page.reload({waitUntil:"load"});await page.waitForSelector("#rule-rows");
 await page.screenshot({path:path.join(dir,"security-alert-rules-verified-desktop.png"),fullPage:true});
 const mobile=await browser.newPage();watch(mobile);await mobile.setViewport({width:390,height:844});await mobile.goto(file("security-alert-rules-preview.html")+"?embedded=1&module=Security%20Alert%20Rules%20%26%20Notifications",{waitUntil:"load"});
 const mobileLayout=await mobile.evaluate(()=>({width:innerWidth,client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth,tableScroll:false}));
 await mobile.screenshot({path:path.join(dir,"security-alert-rules-verified-mobile.png"),fullPage:true});
 await mobile.evaluate(()=>{document.querySelector(".sar-table-wrap").hidden=false;document.querySelector("#rule-rows").innerHTML="<tr><td>Temporary browser-only check</td><td>Test trigger</td><td>Warning</td><td>In-app</td><td>Draft</td><td>—</td></tr>";});
 mobileLayout.tableScroll=await mobile.evaluate(()=>document.querySelector(".sar-table-wrap").scrollWidth>document.querySelector(".sar-table-wrap").clientWidth);
 await mobile.setViewport({width:320,height:844});const narrow=await mobile.evaluate(()=>({width:innerWidth,client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth}));
 const shell=await browser.newPage();watch(shell);await shell.setViewport({width:1440,height:1000});await shell.goto(file("dashboard-preview.html")+"?module=Security%20Alert%20Rules%20%26%20Notifications",{waitUntil:"load"});
 await shell.waitForFunction(()=>[...document.querySelectorAll("iframe")].some(f=>f.classList.contains("is-active")&&f.src.includes("security-alert-rules-preview.html")));
 const route=await shell.evaluate(()=>({active:document.querySelector(".sidebar .nav-link.active")?.dataset.page,frame:[...document.querySelectorAll("iframe")].find(f=>f.classList.contains("is-active"))?.src}));
 let embedded=shell.frames().find(f=>f.url().includes("security-alert-rules-preview.html"));await embedded.waitForSelector("#view-security-activity");await embedded.click("#view-security-activity");
 await shell.waitForFunction(()=>[...document.querySelectorAll("iframe")].some(f=>f.classList.contains("is-active")&&f.src.includes("security-activity-preview.html")));
 const backRoute=await shell.evaluate(()=>({active:document.querySelector('.sidebar .nav-link.active')?.dataset.page,frame:[...document.querySelectorAll('iframe')].find(f=>f.classList.contains('is-active'))?.src}));
 await shell.click('.sidebar .nav-link[data-page="Security Alert Rules & Notifications"]');
 await shell.waitForFunction(()=>[...document.querySelectorAll('iframe')].some(f=>f.classList.contains('is-active')&&f.src.includes('security-alert-rules-preview.html')));
 embedded=shell.frames().find(f=>f.url().includes('security-alert-rules-preview.html'));
 await embedded.click('#tab-history');await embedded.click('#view-audit-trail');
 await shell.waitForFunction(()=>[...document.querySelectorAll('iframe')].some(f=>f.classList.contains('is-active')&&f.src.includes('audit-trail-preview.html')));
 const auditRoute=await shell.evaluate(()=>({active:document.querySelector('.sidebar .nav-link.active')?.dataset.page,frame:[...document.querySelectorAll('iframe')].find(f=>f.classList.contains('is-active'))?.src}));
 const navPages=["dashboard-preview.html","users-access-preview.html","security-activity-preview.html","session-management-preview.html","audit-trail-preview.html","system-settings-preview.html"];
 const navCheck=[];
 for(const name of navPages){const s=require("fs").readFileSync(path.join(dir,name),"utf8");navCheck.push({name,count:(s.match(/data-page="Security Alert Rules & Notifications"/g)||[]).length});}
 const result={initial,channels,history,created,edited,discarded,modalEscape,requiredFields,invalidDidNotSave,mobileLayout,narrow,route,backRoute,auditRoute,navCheck,errors,failed,
  pass:initial.title==="TFI | Security Alert Rules & Notifications"&&initial.heading==="Security Alert Rules & Notifications"&&initial.navActive==="Security Alert Rules & Notifications"&&initial.navCount===1&&initial.draftCount==="0"&&initial.enabledRules==="—"&&initial.connectedChannels==="—"&&initial.sent==="—"&&initial.rows===0&&initial.empty&&initial.channelsDisabled&&initial.historyEmpty&&initial.historySearchDisabled&&initial.duplicateIds.length===0&&channels.selected==="true"&&channels.visible&&channels.disabled&&history.selected==="true"&&history.visible&&history.empty&&history.rows===0&&created.count==="1"&&created.rows===1&&created.enabled==="—"&&created.historyRows===0&&created.cell.includes("Repeated sign-in attempts")&&requiredFields&&invalidDidNotSave&&edited.includes("revised")&&discarded.count==="0"&&discarded.rows===0&&discarded.empty&&modalEscape==="true"&&mobileLayout.tableScroll&&!mobileLayout.overflow&&!narrow.overflow&&route.active==="Security Alert Rules & Notifications"&&backRoute.active==="Security & Activity"&&auditRoute.active==="Audit Trail"&&navCheck.every(x=>x.count===1)&&errors.length===0&&failed.length===0};
 console.log(JSON.stringify(result,null,2));await browser.close();if(!result.pass)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});