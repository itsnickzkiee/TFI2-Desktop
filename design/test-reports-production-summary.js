const puppeteer = require("C:/Users/Rominick/AppData/Local/npm-cache/_npx/4b4c857f6efdfb61/node_modules/puppeteer");
const path = require("path");
const { pathToFileURL } = require("url");
const dir = "C:/Users/Rominick/Desktop/TFI_NEW/design";

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  const failed = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  page.on("requestfailed", request => failed.push(request.url() + " :: " + request.failure()?.errorText));
  await page.goto(pathToFileURL(path.join(dir, "reports-reconciliation-preview.html")).href, { waitUntil: "load" });

  const desktop = await page.evaluate(() => {
    const groupHeaders = [...document.querySelectorAll(".rr-group-row th")];
    const columnHeaders = [...document.querySelectorAll(".rr-column-row th")];
    const bodyRows = [...document.querySelectorAll("#rr-tbody tr")];
    const reportsLink = document.querySelector('.sidebar .nav-link[data-page="Reports"]');
    return {
      title: document.title,
      ready: document.body.dataset.tfiReady,
      report: document.body.dataset.tfiReport,
      sourceSheetId: document.body.dataset.tfiSourceSheetId,
      sourceColumns: Number(document.body.dataset.tfiColumns),
      groupColumnSpan: groupHeaders.reduce((sum, th) => sum + Number(th.colSpan), 0),
      columnHeaderCount: columnHeaders.length,
      derivedHeaderCount: document.querySelectorAll(".rr-derived-head").length,
      emptyStateVisible: bodyRows.length === 1 && bodyRows[0].querySelector(".rr-empty-state") !== null,
      importButtonVisible: !!document.querySelector("#rr-import-open"),
      exportDisabled: document.querySelector("#rr-export").disabled,
      noSampleTransactionRows: document.querySelectorAll("#rr-tbody tr:not(:has(.rr-empty-state))").length === 0,
      reportsSidebarLabel: reportsLink?.querySelector("span")?.textContent.trim() || ""
    };
  });

  await page.click("#rr-import-open");
  const modalOpen = await page.$eval("#rr-import-modal", el => el.classList.contains("open") && el.getAttribute("aria-hidden") === "false");
  const modalHasNoBackendNotice = await page.$eval("#rr-import-modal", el => el.innerText.includes("not connected") && el.innerText.includes("No source link has been validated") && el.innerText.includes("no data has been scanned or imported"));
  const importActionDisabled = await page.$eval("#rr-import-modal button[disabled]", el => el.innerText.includes("IMPORT NOT CONNECTED"));
  await page.click("#rr-modal-dismiss");
  const modalClosed = await page.$eval("#rr-import-modal", el => !el.classList.contains("open") && el.getAttribute("aria-hidden") === "true");

  await page.click('[data-rr-sort="productName"]');
  const sortActivated = await page.$eval('[data-rr-sort="productName"]', el => el.closest("th").getAttribute("aria-sort") === "ascending");
  await page.click("#rr-reset");
  const resetCleared = await page.evaluate(() => ["rr-from","rr-to","rr-line","rr-product","rr-code","rr-search"].every(id => document.getElementById(id).value === ""));
  await page.screenshot({ path: path.join(dir, "reports-production-summary-desktop.png"), fullPage: true });

  await page.setViewport({ width: 390, height: 844 });
  await new Promise(resolve => setTimeout(resolve, 200));
  const mobile = await page.evaluate(() => ({
    viewportWidth: document.documentElement.clientWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
    tableScrollWidth: document.querySelector(".rr-table-scroll").scrollWidth,
    tableClientWidth: document.querySelector(".rr-table-scroll").clientWidth,
    topbarProfileTextHidden: getComputedStyle(document.querySelector(".profile>div:not(.avatar)")).display === "none",
    noPageLevelHorizontalOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth
  }));
  await page.screenshot({ path: path.join(dir, "reports-production-summary-mobile.png"), fullPage: true });

  const result = {
    desktop,
    modal: { opens: modalOpen, correctNotice: modalHasNoBackendNotice, importActionDisabled, closes: modalClosed },
    interactions: { sortingIndicatorWorks: sortActivated, resetFiltersWorks: resetCleared },
    mobile,
    browserErrors: errors,
    failedRequests: failed
  };
  const pass =
    desktop.ready === "true" &&
    desktop.report === "production-summary" &&
    desktop.sourceSheetId === "1846667474" &&
    desktop.sourceColumns === 24 &&
    desktop.groupColumnSpan === 24 &&
    desktop.columnHeaderCount === 24 && desktop.derivedHeaderCount === 2 &&
    desktop.emptyStateVisible &&
    desktop.importButtonVisible &&
    desktop.exportDisabled &&
    desktop.noSampleTransactionRows &&
    desktop.reportsSidebarLabel === "Reports & Reconciliation" &&
    modalOpen && modalHasNoBackendNotice && importActionDisabled && modalClosed &&
    sortActivated && resetCleared && mobile.noPageLevelHorizontalOverflow && mobile.topbarProfileTextHidden &&
    errors.length === 0 && failed.length === 0;
  result.pass = pass;
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
  if (!pass) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });


