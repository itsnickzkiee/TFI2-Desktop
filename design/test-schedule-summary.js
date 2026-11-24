const puppeteer = require("C:/Users/Rominick/AppData/Local/npm-cache/_npx/4b4c857f6efdfb61/node_modules/puppeteer");
const path = require("path");
const { pathToFileURL } = require("url");
const dir = "C:/Users/Rominick/Desktop/TFI_NEW/design";

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox", "--allow-file-access-from-files"] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  const failed = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  page.on("requestfailed", request => failed.push(request.url() + " :: " + request.failure()?.errorText));
  await page.goto(pathToFileURL(path.join(dir, "dashboard-preview.html")).href + "?module=Schedule%20Summary", { waitUntil: "load" });
  await page.waitForFunction(() => { const active=document.querySelector(".tfi-module-frame.is-active"); return !!active && (active.getAttribute("src")||"").includes("schedule-summary-preview.html"); }, { timeout: 10000 });
  await page.waitForFunction(() => {
    const frame = [...document.querySelectorAll("#tfi-module-frame-0,#tfi-module-frame-1")].find(x => (x.getAttribute("src") || "").includes("schedule-summary-preview.html"));
    return !!frame && frame.contentDocument?.body?.dataset?.tfiReady === "true";
  }, { timeout: 10000 });

  const frame = [...page.frames()].find(f => f.url().includes("schedule-summary-preview.html"));
  if (!frame) throw new Error("Schedule Summary iframe not found.");
  const sourceHeaders = ["DATE","DAY","LINE","AREA","PRODUCT NAME","PRODUCTION CODE","# OF BATCHES","TARGET","REVISED TARGET","UM","QUANTITY (tins/ends)","QUANTITY (box)","REQUIRED NO. OF PAX","PR#","REMARKS","FC/IDC REF","SHIFT HRS","AVAILABLE PAX (day)","SAVED ON"];
  const initial = await frame.evaluate(expected => {
    const headers = [...document.querySelectorAll(".ss-table thead th")].map(th => th.querySelector("button").childNodes[0].textContent.trim());
    const rows = [...document.querySelectorAll("#ss-tbody tr")];
    const active = document.querySelector(".sidebar .nav-link.active");
    return {
      title: document.title,
      ready: document.body.dataset.tfiReady,
      report: document.body.dataset.tfiReport,
      sheetId: document.body.dataset.tfiSourceSheetId,
      columns: Number(document.body.dataset.tfiColumns),
      headerRow: Number(document.body.dataset.tfiHeaderRow),
      firstDataRow: Number(document.body.dataset.tfiFirstDataRow),
      upstreamSheetId: document.body.dataset.tfiUpstreamSheetId,
      inspectedRange: document.body.dataset.tfiInspectedSourceRange,
      headers,
      headersMatch: JSON.stringify(headers) === JSON.stringify(expected),
      emptyState: rows.length === 1 && !!rows[0].querySelector(".rr-empty-state"),
      noSampleRows: document.querySelectorAll("#ss-tbody tr:not(:has(.rr-empty-state))").length === 0,
      activeSidebar: active?.dataset.page || "",
      reportTabs: [...document.querySelectorAll("[data-report-page]")].map(b => ({ page:b.dataset.reportPage, active:b.getAttribute("aria-current")==="page" })),
      exportDisabled: document.querySelector("#ss-export").disabled,
      filters: ["ss-from","ss-to","ss-day","ss-line","ss-area","ss-product","ss-code","ss-pr","ss-search"].every(id => !!document.getElementById(id))
    };
  }, sourceHeaders);

  await frame.click("#ss-import-open");
  const modal = await frame.evaluate(() => ({
    open: document.querySelector("#ss-import-modal").classList.contains("open"),
    text: document.querySelector("#ss-import-modal").innerText,
    disabled: document.querySelector("#ss-import-modal button[disabled]")?.innerText.trim()
  }));
  await frame.click("#ss-modal-dismiss");
  const modalClosed = await frame.$eval("#ss-import-modal", el => !el.classList.contains("open"));

  await frame.click('[data-ss-sort="productName"]');
  const sortWorks = await frame.$eval('[data-ss-sort="productName"]', el => el.closest("th").getAttribute("aria-sort") === "ascending");
  await frame.type("#ss-line", "Agri");
  const filterInputWorks = await frame.$eval("#ss-line", el => el.value === "Agri");
  await frame.click("#ss-reset");
  const resetWorks = await frame.evaluate(() => ["ss-from","ss-to","ss-day","ss-line","ss-area","ss-product","ss-code","ss-pr","ss-search"].every(id => document.getElementById(id).value === ""));
  await page.screenshot({ path: path.join(dir, "schedule-summary-desktop.png"), fullPage: true });

  await frame.click('[data-report-page="Reports"]');
  await page.waitForFunction(() => { const active=document.querySelector(".tfi-module-frame.is-active"); return !!active && (active.getAttribute("src")||"").includes("reports-reconciliation-preview.html"); }, { timeout: 10000 });
  const reportFrame = [...page.frames()].find(f => f.url().includes("reports-reconciliation-preview.html"));
  if (reportFrame) await reportFrame.waitForFunction(() => document.body.dataset.tfiReady === "true", { timeout: 10000 });
  const returnToProductionSummary = await page.evaluate(() => { const active=document.querySelector(".tfi-module-frame.is-active"); return !!active && active.dataset.loadedModule==="Reports" && (active.getAttribute("src")||"").includes("reports-reconciliation-preview.html"); });
  if (reportFrame) await reportFrame.click('[data-report-page="Schedule Summary"]');
  await page.waitForFunction(() => { const active=document.querySelector(".tfi-module-frame.is-active"); return !!active && active.dataset.loadedModule==="Schedule Summary" && (active.getAttribute("src") || "").includes("schedule-summary-preview.html"); }, { timeout: 10000 });
  const backToSchedule = await page.evaluate(() => { const active=document.querySelector(".tfi-module-frame.is-active"); return !!active && active.dataset.loadedModule==="Schedule Summary" && (active.getAttribute("src")||"").includes("schedule-summary-preview.html"); });
  const sidebarActiveAfterTabNavigation = await page.$eval(".sidebar .nav-link.active", el => el.dataset.page);

  await page.setViewport({ width: 390, height: 844 });
  await new Promise(resolve => setTimeout(resolve, 200));
  const mobile = await page.evaluate(() => ({
    viewportWidth: document.documentElement.clientWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
    noPageOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth
  }));
  await page.screenshot({ path: path.join(dir, "schedule-summary-mobile.png"), fullPage: true });

  const result = {
    initial,
    modal: { opens: modal.open, sourceDetailsCorrect: modal.text.includes("sheetId: 720094137") && modal.text.includes("sheetId: 1538651320") && modal.text.includes("A3:S1000"), importDisabled: modal.disabled === "IMPORT NOT CONNECTED", closes: modalClosed },
    interactions: { sortingIndicatorWorks: sortWorks, filterInputWorks, resetWorks },
    navigation: { returnToProductionSummary, backToSchedule, sidebarActiveAfterTabNavigation },
    mobile,
    browserErrors: errors,
    failedRequests: failed
  };
  const pass =
    initial.ready === "true" &&
    initial.report === "schedule-summary" &&
    initial.sheetId === "720094137" &&
    initial.columns === 19 &&
    initial.headerRow === 2 &&
    initial.firstDataRow === 3 &&
    initial.upstreamSheetId === "1538651320" &&
    initial.headersMatch &&
    initial.emptyState &&
    initial.noSampleRows &&
    initial.activeSidebar === "Reports" &&
    initial.exportDisabled &&
    initial.filters &&
    modal.open && modal.text.includes("A3:S1000") &&
    modal.disabled === "IMPORT NOT CONNECTED" &&
    modalClosed && sortWorks && filterInputWorks && resetWorks &&
    returnToProductionSummary && backToSchedule && sidebarActiveAfterTabNavigation === "Reports" &&
    mobile.noPageOverflow && errors.length === 0 && failed.length === 0;
  result.pass = pass;
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
  if (!pass) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });


