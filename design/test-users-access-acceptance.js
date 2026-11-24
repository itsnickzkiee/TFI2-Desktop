const puppeteer=require("C:/Users/Rominick/AppData/Local/npm-cache/_npx/4b4c857f6efdfb61/node_modules/puppeteer");
const path=require("path");const{pathToFileURL}=require("url");const dir="C:/Users/Rominick/Desktop/TFI_NEW/design";
(async()=>{
 const browser=await puppeteer.launch({headless:true,args:["--no-sandbox","--disable-setuid-sandbox","--allow-file-access-from-files"]});
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],failed=[];
 page.on("pageerror",e=>errors.push(e.message));page.on("console",m=>{if(m.type()==="error")errors.push(m.text())});page.on("requestfailed",r=>failed.push(r.url()+" :: "+r.failure()?.errorText));
 async function waitModule(name,file){
  await page.waitForFunction(({name,file})=>{const f=document.querySelector(".tfi-module-frame.is-active");return f&&f.dataset.loadedModule===name&&(f.getAttribute("src")||"").includes(file)},{timeout:12000},{name,file});
  const frame=page.frames().find(f=>f.url().includes(file));if(!frame)throw Error("Missing frame "+file);
  await frame.waitForSelector("#add-user",{timeout:10000});return frame;
 }
 await page.goto(pathToFileURL(path.join(dir,"dashboard-preview.html")).href+"?module=Users%20%26%20Access",{waitUntil:"load"});
 let frame=await waitModule("Users & Access","users-access-preview.html");
 const initial=await frame.evaluate(()=>({
  title:document.querySelector("h1")?.textContent.trim(),
  activeNav:document.querySelector(".sidebar .nav-link.active")?.dataset.page,
  note:document.querySelector(".ua-note")?.innerText||"",
  metrics:[...document.querySelectorAll(".ua-metrics .metric-value")].map(x=>x.textContent.trim()),
  userRows:document.querySelectorAll("#user-rows tr").length,
  empty:document.querySelector("#user-rows").innerText.includes("No user accounts are loaded"),
  count:document.querySelector("#user-count").textContent.trim(),
  exportDisabled:document.querySelector("#export-users").disabled,
  userTab:document.querySelector('.ua-tab[data-view="users"]')?.getAttribute("role"),
  userTabSelected:document.querySelector('.ua-tab[data-view="users"]')?.getAttribute("aria-selected"),
  roleTab:document.querySelector('.ua-tab[data-view="roles"]')?.getAttribute("role"),
  paginationPresent:!!document.querySelector(".ua-foot .pagination"),
  rolesEmpty:document.querySelector("#role-cards").innerText.includes("No role templates"),
  permissionRows:document.querySelectorAll("#permission-rows tr").length,
  savePermissionsDisabled:document.querySelector("#save-permissions").disabled,
  localStorageKeys:Object.keys(localStorage)
 }));
 await frame.click("#add-user");
 await frame.$eval("#ua-tab-users",e=>e.dispatchEvent(new KeyboardEvent("keydown",{key:"ArrowRight",bubbles:true})));
 const keyboardToRoles=await frame.$eval("#ua-tab-roles",e=>e.getAttribute("aria-selected"));
 await frame.$eval("#ua-tab-roles",e=>e.dispatchEvent(new KeyboardEvent("keydown",{key:"ArrowLeft",bubbles:true})));
 const keyboardToUsers=await frame.$eval("#ua-tab-users",e=>e.getAttribute("aria-selected"));
 const addModal=await frame.$eval("#user-modal",x=>x.classList.contains("open"));
 const blankValidity=await frame.$eval("#user-form",x=>x.checkValidity());
 await frame.type("#user-name-input","Alex Test");
 await frame.type("#user-email-input","ALEX@example.com");
 await frame.type("#user-username-input","alex.t");
 await frame.select("#user-department-input","Production");
 await frame.select("#user-status-input","Pending");
 await frame.click("#user-form button[type=submit]");
 const added=await frame.evaluate(()=>({
  rows:[...document.querySelectorAll("#user-rows tr")].map(x=>x.innerText),
  metrics:[...document.querySelectorAll(".ua-metrics .metric-value")].map(x=>x.textContent.trim()),
  count:document.querySelector("#user-count").textContent.trim(),
  modalClosed:!document.querySelector("#user-modal").classList.contains("open"),
  exportDisabled:document.querySelector("#export-users").disabled
 }));
 await frame.click("#add-user");
 await frame.type("#user-name-input","Alex Duplicate");
 await frame.type("#user-email-input","alex@EXAMPLE.com");
 await frame.click("#user-form button[type=submit]");
 const duplicate=await frame.evaluate(()=>({count:document.querySelector("#user-count").textContent.trim(),toast:(()=>{const xs=[...document.querySelectorAll(".ua-toast")];return xs[xs.length-1]})()?.textContent||"",modalOpen:document.querySelector("#user-modal").classList.contains("open")}));
 await frame.click("#cancel-user-modal");
 await frame.click('[data-edit-user="USR-0001"]');
 await frame.$eval("#user-name-input",x=>{x.value="Alex Updated";x.dispatchEvent(new Event("input",{bubbles:true}))});
 await frame.select("#user-status-input","Active");
 await frame.click("#user-form button[type=submit]");
 const edited=await frame.evaluate(()=>({row:document.querySelector("#user-rows tr")?.innerText,metrics:[...document.querySelectorAll(".ua-metrics .metric-value")].map(x=>x.textContent.trim())}));
 await frame.click('[data-toggle-user="USR-0001"]');
 const disabled=await frame.evaluate(()=>({row:document.querySelector("#user-rows tr")?.innerText,metrics:[...document.querySelectorAll(".ua-metrics .metric-value")].map(x=>x.textContent.trim())}));
 await frame.click('[data-toggle-user="USR-0001"]');
 await frame.click('.ua-filter-tab[data-status="Active"]');
 const activeFilter=await frame.$eval("#user-count",x=>x.textContent.trim());
 await frame.click('.ua-filter-tab[data-status="Pending"]');
 const pendingFilter=await frame.$eval("#user-count",x=>x.textContent.trim());
 await frame.click('.ua-filter-tab[data-status="all"]');
 await frame.$eval("#user-search",x=>{x.value="Alex";x.dispatchEvent(new Event("input",{bubbles:true}))});
 await frame.$eval("#global-search",x=>{x.value="Production";x.dispatchEvent(new Event("input",{bubbles:true}))});
 const multiSearch=await frame.$eval("#user-count",x=>x.textContent.trim());
 const filterPressed=await frame.$eval('.ua-filter-tab[data-status="all"]',x=>x.getAttribute('aria-pressed'));
 const csvFiltered=await frame.evaluate(async()=>{let captured=null;const oldCreate=URL.createObjectURL,oldClick=HTMLAnchorElement.prototype.click;URL.createObjectURL=b=>{captured=b;return 'blob:test'};HTMLAnchorElement.prototype.click=function(){};exportUsers();const text=captured?await captured.text():'';URL.createObjectURL=oldCreate;HTMLAnchorElement.prototype.click=oldClick;return text});
 await frame.evaluate(()=>{for(const id of ["user-search","global-search"]){const x=document.getElementById(id);x.value="";x.dispatchEvent(new Event("input",{bubbles:true}))}});
 const csv=await frame.evaluate(async()=>{
  let captured=null;const oldCreate=URL.createObjectURL,oldClick=HTMLAnchorElement.prototype.click;
  URL.createObjectURL=b=>{captured=b;return "blob:test"};
  HTMLAnchorElement.prototype.click=function(){window.__csvName=this.download};
  exportUsers();const text=captured?await captured.text():"";
  URL.createObjectURL=oldCreate;HTMLAnchorElement.prototype.click=oldClick;
  return {filename:window.__csvName,text};
 });
 await frame.click('.ua-tab[data-view="roles"]');
 const rolesInitial=await frame.evaluate(()=>({viewVisible:!document.querySelector("#roles-view").classList.contains("ua-hidden"),draftCount:document.querySelector("#draft-role-count").textContent.trim(),empty:document.querySelector("#role-cards").innerText,saveDisabled:document.querySelector("#save-permissions").disabled}));
 await frame.click("#add-role");
 const roleModal=await frame.$eval("#role-modal",x=>x.classList.contains("open"));
 await frame.type("#role-name-input","Production Supervisor");
 await frame.type("#role-purpose-input","Reviews daily production entries.");
 await frame.click('#role-form button[type="submit"]');
 const roleCreated=await frame.evaluate(()=>({count:document.querySelector("#draft-role-count").textContent.trim(),title:document.querySelector("#permission-title").textContent,rows:document.querySelectorAll("#permission-rows tr").length,checks:document.querySelectorAll("#permission-rows input[type=checkbox]").length,saveDisabled:document.querySelector("#save-permissions").disabled,card:document.querySelector("#role-cards").innerText}));
 const firstPermission=await frame.$('#permission-rows input[type="checkbox"]');
 if(firstPermission)await firstPermission.click();
 const permissionChanged=await frame.evaluate(()=>({checked:document.querySelector('#permission-rows input[type="checkbox"]').checked,state:Object.values(permissionState).filter(Boolean).length}));
 await frame.click("#save-permissions");
 const saveToast=await frame.evaluate(()=>({note:document.querySelector("#permission-foot-note").textContent.trim(),savedCount:Object.keys(savedPermissionState).length}));
 await frame.click("#add-role");
 await frame.type("#role-name-input","production supervisor");
 await frame.click('#role-form button[type="submit"]');
 const duplicateRole=await frame.evaluate(()=>({count:document.querySelector("#draft-role-count").textContent.trim(),toast:(()=>{const xs=[...document.querySelectorAll(".ua-toast")];return xs[xs.length-1]})()?.textContent||"",modalOpen:document.querySelector("#role-modal").classList.contains("open")}));
 await frame.click("#cancel-role-modal");
 await frame.click('.ua-tab[data-view="users"]');
 await frame.click("#add-user");
 await frame.type("#user-name-input","Morgan Role");
 await frame.type("#user-email-input","morgan@example.com");
 await frame.select("#user-role-input","Production Supervisor");
 await frame.select("#user-status-input","Active");
 await frame.click('#user-form button[type="submit"]');
 const assigned=await frame.evaluate(()=>({count:document.querySelector("#user-count").textContent.trim(),roleOptions:[...document.querySelector("#role-filter").options].map(x=>x.value),row:document.querySelector("#user-rows").innerText}));
 await frame.$eval("#role-filter",x=>{x.value="Production Supervisor";x.dispatchEvent(new Event("change",{bubbles:true}))});
 const roleFilter=await frame.$eval("#user-count",x=>x.textContent.trim());
 await page.setViewport({width:390,height:844});
 const mobile=await frame.evaluate(()=>({width:document.documentElement.clientWidth,pageWidth:document.documentElement.scrollWidth,noOverflow:document.documentElement.scrollWidth<=document.documentElement.clientWidth,tableScroll:document.querySelector(".ua-table-wrap").scrollWidth>document.querySelector(".ua-table-wrap").clientWidth,roleLayoutColumns:getComputedStyle(document.querySelector(".ua-role-layout")).gridTemplateColumns}));
 await frame.$eval('.ua-tab[data-view="roles"]',x=>x.click());
 const mobileRoles=await frame.evaluate(()=>({noOverflow:document.documentElement.scrollWidth<=document.documentElement.clientWidth,layoutColumns:getComputedStyle(document.querySelector(".ua-role-layout")).gridTemplateColumns,permissionTableScroll:document.querySelector(".ua-permission-wrap").scrollWidth>document.querySelector(".ua-permission-wrap").clientWidth,selectedRole,roleCount:roles.length,matrixRows:document.querySelectorAll("#permission-rows tr").length,wrapWidth:document.querySelector(".ua-permission-wrap").clientWidth,wrapScroll:document.querySelector(".ua-permission-wrap").scrollWidth}));
 await frame.$eval('.ua-tab[data-view="users"]',x=>x.click());
 await page.setViewport({width:1440,height:1000});
 await page.screenshot({path:path.join(dir,"users-access-acceptance-desktop.png"),fullPage:true});
 await page.click('.sidebar .nav-link[data-page="Audit Trail"]');
 await page.waitForFunction(()=>{const f=document.querySelector(".tfi-module-frame.is-active");return f&&f.dataset.loadedModule==="Audit Trail"&&(f.getAttribute("src")||"").includes("audit-trail-preview.html")},{timeout:12000});
 await page.click('.sidebar .nav-link[data-page="Users & Access"]');
 frame=await waitModule("Users & Access","users-access-preview.html");
 const navReturn=await page.$eval(".sidebar .nav-link.active",x=>x.dataset.page);
 const result={initial,keyboardToRoles,keyboardToUsers,addModal,blankValidity,added,duplicate,edited,disabled,activeFilter,pendingFilter,multiSearch,filterPressed,csvFiltered,csv,rolesInitial,roleModal,roleCreated,permissionChanged,saveToast,duplicateRole,assigned,roleFilter,mobile,mobileRoles,navigation:{returnedTo:navReturn},browserErrors:errors,failedRequests:failed.filter(x=>!x.includes("ERR_ABORTED"))};
 result.pass=initial.title==="Users & Access"&&initial.activeNav==="Users & Access"&&initial.metrics.every(x=>x.length===1)&&initial.empty&&initial.exportDisabled&&initial.userTab==="tab"&&initial.userTabSelected==="true"&&initial.roleTab==="tab"&&!initial.paginationPresent&&addModal&&!blankValidity&&added.count==="Showing 1 of 1 accounts"&&added.metrics.join(",")==="1,0,1,0"&&added.modalClosed&&duplicate.modalOpen&&duplicate.count==="Showing 1 of 1 accounts"&&duplicate.toast.includes("already in the preview directory")&&edited.metrics.join(",")==="1,1,0,0"&&disabled.metrics.join(",")==="1,0,0,1"&&activeFilter==="Showing 1 of 1 accounts"&&pendingFilter==="Showing 0 of 1 accounts"&&multiSearch==="Showing 1 of 1 accounts"&&filterPressed==="true"&&csvFiltered.includes("Alex Updated")&&csv.filename==="TFI-Users-Access-preview.csv"&&csv.text.includes("Alex Updated")&&rolesInitial.viewVisible&&rolesInitial.saveDisabled&&roleModal&&roleCreated.count==="1"&&roleCreated.checks===15*7&&permissionChanged.checked&&permissionChanged.state===1&&saveToast.note.includes("saved in this preview session")&&saveToast.savedCount===1&&duplicateRole.count==="1"&&duplicateRole.toast.includes("already exists")&&assigned.roleOptions.includes("Production Supervisor")&&roleFilter==="Showing 1 of 2 accounts"&&mobile.noOverflow&&mobile.tableScroll&&mobileRoles.noOverflow&&mobileRoles.permissionTableScroll&&keyboardToRoles==="true"&&keyboardToUsers==="true"&&navReturn==="Users & Access"&&errors.length===0&&result.failedRequests.length===0;
 console.log(JSON.stringify(result,null,2));await browser.close();if(!result.pass)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});