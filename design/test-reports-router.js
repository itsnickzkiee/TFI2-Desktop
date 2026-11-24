const puppeteer = require("C:/Users/Rominick/AppData/Local/npm-cache/_npx/4b4c857f6efdfb61/node_modules/puppeteer");
const path = require("path");
const { pathToFileURL } = require("url");
const dir = "C:/Users/Rominick/Desktop/TFI_NEW/design";

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox", "--allow-file-access-from-files"] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto(pathToFileURL(path.join(dir, "dashboard-preview.html")).href + "?module=Reports", { waitUntil: "load" });
  await page.waitForFunction(() => {
    const frames = [...document.querySelectorAll("#tfi-module-frame-0,#tfi-module-frame-1")];
    return frames.some(frame => (frame.getAttribute("src") || "").includes("reports-reconciliation-preview.html"));
  }, { timeout: 8000 });
  const result = await page.evaluate(() => {
    const active = document.querySelector(".sidebar nav .nav-link.active");
    const frame = [...document.querySelectorAll("#tfi-module-frame-0,#tfi-module-frame-1")]
      .find(item => (item.getAttribute("src") || "").includes("reports-reconciliation-preview.html"));
    return {
      activePage: active?.dataset.page || "",
      activeLabel: active?.querySelector("span")?.textContent.trim() || "",
      routeFrameFound: !!frame,
      frameUrl: frame?.getAttribute("src") || "",
      routeFunctionAvailable: typeof window.TFINavigatePreview === "function"
    };
  });
  const pass = result.activePage === "Reports" && result.activeLabel === "Reports & Reconciliation" &&
    result.routeFrameFound && result.frameUrl.includes("reports-reconciliation-preview.html") &&
    result.routeFunctionAvailable && errors.length === 0;
  console.log(JSON.stringify({ result, browserErrors: errors, pass }, null, 2));
  await browser.close();
  if (!pass) process.exitCode = 1;
})().catch(e => { console.error(e); process.exitCode = 1; });
