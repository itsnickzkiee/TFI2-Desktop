const puppeteer = require("C:/Users/Rominick/AppData/Local/npm-cache/_npx/4b4c857f6efdfb61/node_modules/puppeteer");
const path = require("path");
const { pathToFileURL } = require("url");
const dir = "C:/Users/Rominick/Desktop/TFI_NEW/design";
(async () => {
  const browser = await puppeteer.launch({headless:true,args:["--no-sandbox","--disable-setuid-sandbox","--allow-file-access-from-files"]});
  const page = await browser.newPage({viewport:{width:1440,height:1000}});
  const errors=[], failed=[];
  page.on("pageerror",e=>errors.push(e.message));
  page.on("console",m=>{if(m.type()==="error")errors.push(m.text())});
  page.on("requestfailed",r=>failed.push(r.url()+" :: "+r.failure()?.errorText));
  async function waitModule(name,file){
    await page.waitForFunction(({name,file})=>{
      const active=document.querySelector(".tfi-module-frame.is-active");
      return active && active.dataset.loadedModule===name && (active.getAttribute("src")||"").includes(file);
    },{timeout:12000},{name,file});
    const active=page.frames().find(f=>f.url().includes(file));
    if(!active)throw new Error("Could not locate active module frame: "+name);
    await active.waitForSelector(file==="audit-trail-preview.html"?"#audit-rows":"h1",{timeout:10000});
    return active;
  }
  await page.goto(pathToFileURL(path.join(dir,"dashboard-preview.html")).href+"?module=Audit%20Trail",{waitUntil:"load"});
  let frame=await waitModule("Audit Trail","audit-trail-preview.html");
  const initial=await frame.evaluate(()=>{
    const rows=[...document.querySelectorAll("#audit-rows tr")];
    return {
      title:document.querySelector("h1")?.textContent.trim(),
      activeNav:document.querySelector(".sidebar .nav-link.active")?.dataset.page,
      note:document.querySelector(".audit-note")?.innerText||"",
      metrics:[...document.querySelectorAll(".audit-metrics .metric-value")].map(x=>x.textContent.trim()),
      metricLabels:[...document.querySelectorAll(".audit-metrics .metric-label")].map(x=>x.textContent.trim()),
      count:document.querySelector("#audit-count")?.textContent.trim(),
      emptyState:rows.some(r=>r.innerText.includes("No verified audit events")),
      dataRows:rows.filter(r=>r.querySelectorAll("td").length===8).length,
      exportDisabled:document.querySelector("#export-audit")?.disabled,
      tabs:[...document.querySelectorAll(".audit-tab")].map(x=>({label:x.textContent.trim(),role:x.getAttribute("role"),selected:x.getAttribute("aria-selected")})),
      moduleOptions:[...document.querySelector("#module-filter").options].map(x=>x.textContent.trim()),
      hasCrudActions:[...document.querySelectorAll("button")].some(b=>/^(add|edit|delete|clear|restore)/i.test(b.textContent.trim())),
      detailsModalInitiallyClosed:!document.querySelector("#event-modal").classList.contains("open")
    };
  });
  const tabResults=[];
  for(const kind of ["data","import","access","system","all"]){
    await frame.click('.audit-tab[data-kind="'+kind+'"]');
    tabResults.push(await frame.$eval('.audit-tab.active',x=>x.dataset.kind));
  }
  await frame.type("#event-search","no-such-event");
  const searchNoErrors=await frame.$eval("#audit-count",x=>x.textContent.trim());
  await frame.$eval("#event-search",e=>{e.value="";e.dispatchEvent(new Event("input",{bubbles:true}));});
  await frame.select("#module-filter","Product Entry");
  await frame.select("#date-filter","7");
  await frame.evaluate(()=>{document.querySelector("#global-search").value="";document.querySelector("#global-search").dispatchEvent(new Event("input",{bubbles:true}));});
  const filtersNoErrors=true;
  const mobileBefore=page.viewport();
  await page.setViewport({width:390,height:844});
  const mobile=await frame.evaluate(()=>({
    viewport:document.documentElement.clientWidth,
    pageWidth:document.documentElement.scrollWidth,
    noPageOverflow:document.documentElement.scrollWidth<=document.documentElement.clientWidth,
    tableHasInternalScroll:document.querySelector(".audit-table-wrap").scrollWidth>document.querySelector(".audit-table-wrap").clientWidth,
    toolbarFits:document.querySelector(".audit-toolbar").getBoundingClientRect().width<=document.documentElement.clientWidth
  }));
  await page.setViewport(mobileBefore);
  await page.screenshot({path:path.join(dir,"audit-trail-acceptance-desktop.png"),fullPage:true});
  await page.click('.sidebar .nav-link[data-page="Users & Access"]');
  await waitModule("Users & Access","users-access-preview.html");
  await page.click('.sidebar .nav-link[data-page="Audit Trail"]');
  frame=await waitModule("Audit Trail","audit-trail-preview.html");
  const navReturn=await page.$eval(".sidebar .nav-link.active",x=>x.dataset.page);
  const result={
    initial,tabResults,searchNoErrors,filtersNoErrors,mobile,navigation:{returnedTo:navReturn},
    browserErrors:errors,failedRequests:failed.filter(x=>!x.includes("ERR_ABORTED"))
  };
  result.pass=initial.title==="Audit Trail"&&initial.activeNav==="Audit Trail"&&initial.metrics.every(x=>x==="—")&&initial.emptyState&&initial.dataRows===0&&initial.exportDisabled&&initial.detailsModalInitiallyClosed&&initial.hasCrudActions===false&&tabResults.join(",")==="data,import,access,system,all"&&mobile.noPageOverflow&&mobile.tableHasInternalScroll&&navReturn==="Audit Trail"&&errors.length===0&&result.failedRequests.length===0;
  console.log(JSON.stringify(result,null,2));
  await browser.close();
  if(!result.pass)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});