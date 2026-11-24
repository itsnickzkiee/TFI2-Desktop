const http = require("http");
const fs = require("fs");
const path = require("path");
const puppeteer = require("C:/Users/Rominick/AppData/Local/npm-cache/_npx/4b4c857f6efdfb61/node_modules/puppeteer");

const designDir = "C:/Users/Rominick/Desktop/TFI_NEW/design";
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml"
};
const spreadsheetId = "1rCbQ16wj7MRjQCFF3tA-WEMkudraJK0RkwcqayUlz7k";
const destinations = [
  ["product_entry", "Product Entry", 545274882],
  ["production_entry", "Production Entry", 1923467491],
  ["production_schedule", "Production Schedule", 1538651320],
  ["dmp_production", "DMP - Production", 1312335050],
  ["dmr_production", "DMR Production", 2048043346],
  ["dmr_coding", "DMR Coding", 675328096],
  ["hourly_meat", "Hourly Meat", 428082343],
  ["hourly_coding", "Hourly Coding", 1916766220],
  ["hourly_agri", "Hourly Agri", 534145404],
  ["oee", "OEE", 1750442014],
  ["productivity", "Productivity", 1688444278],
  ["coding_dpr", "Coding DPR", 1266086431],
  ["co_qa", "co QA", 1359678099],
  ["nonprod", "NON-PROD", 1381857831],
  ["pr_monitoring", "PR MONITORING", 867256143]
].map(([module_key, source_sheet_title, source_sheet_id]) => ({
  module_key,
  source_sheet_title,
  source_sheet_id,
  contract_status: module_key === "co_qa" ? "hold_pending_business_rule" : "raw_capture_only",
  first_data_row: 2,
  grid_rows: 100,
  grid_columns: 10,
  input_columns: ["A"]
}));

let submittedBody = null;
const batchId = "00000000-0000-0000-0000-000000000101";
const batch = {
  id: batchId,
  batch_ref: "TFI-UI-GOOGLE-0001",
  module_key: "product_entry",
  status: "review",
  source_type: "google_sheets",
  source_name: "Client TFI Workbook",
  source_sheet_title: "Product Entry",
  source_sheet_id: 545274882,
  rows_inspected: 15,
  rows_staged: 8,
  formula_cells: 3,
  derived_rows: 1,
  unmapped_rows: 1
};

function jsonResponse(request, payload, status = 200) {
  return request.respond({
    status,
    contentType: "application/json",
    headers: { "Cache-Control": "no-store" },
    body: JSON.stringify(payload)
  });
}

async function mockApis(page) {
  await page.setRequestInterception(true);
  page.on("request", async request => {
    const url = new URL(request.url());
    const pathname = url.pathname;
    try {
      if (pathname === "/api/import/destinations" && request.method() === "GET") {
        return jsonResponse(request, { destinations });
      }
      if (pathname === "/api/google-sheets/status" && request.method() === "GET") {
        return jsonResponse(request, {
          configured: true,
          connected: true,
          email: "tfi-import@example.test",
          redirect_uri: "http://127.0.0.1:5100/api/google-sheets/callback"
        });
      }
      if (pathname === "/api/import/batches" && request.method() === "POST") {
        submittedBody = JSON.parse(request.postData() || "{}");
        return jsonResponse(request, {
          batch,
          source: {
            name: "Client TFI Workbook",
            type: "google_sheets",
            spreadsheet_id: spreadsheetId,
            sheet_count: 15,
            size: null
          },
          message: "The approved Google worksheet scan has started."
        }, 202);
      }
      if (pathname === "/api/import/batches/" + batchId && request.method() === "GET") {
        return jsonResponse(request, {
          batch,
          progress: { rows_inspected: 15, rows_staged: 8 }
        });
      }
      if (pathname === "/api/import/batches/" + batchId + "/rows" && request.method() === "GET") {
        return jsonResponse(request, { batch_id: batchId, rows: [], page: 1, page_size: 50, has_more: false });
      }
      if (pathname.startsWith("/api/")) {
        return jsonResponse(request, { error: "Unexpected API request: " + pathname }, 404);
      }
      return request.continue();
    } catch (error) {
      try { return jsonResponse(request, { error: error.message }, 500); } catch {}
    }
  });
}

async function run() {
  const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, "http://127.0.0.1").pathname);
    if (pathname === "/favicon.ico") { res.writeHead(204); res.end(); return; }
    const requested = path.resolve(designDir, "." + pathname);
    if (!requested.startsWith(path.resolve(designDir) + path.sep)) {
      res.writeHead(403); res.end("Forbidden"); return;
    }
    fs.readFile(requested, (error, data) => {
      if (error) { res.writeHead(404); res.end("Not found"); return; }
      res.writeHead(200, { "Content-Type": mime[path.extname(requested)] || "application/octet-stream" });
      res.end(data);
    });
  });
  await new Promise(resolve => server.listen(8765, "127.0.0.1", resolve));

  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000 });
  const errors = [];
  const badResponses = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  page.on("response", response => { if (response.status() >= 400) badResponses.push({ status: response.status(), url: response.url() }); });
  await mockApis(page);
  await page.goto("http://127.0.0.1:8765/spreadsheet-import-center-preview.html", { waitUntil: "networkidle0" });
  await page.waitForFunction(() => document.querySelector("#google-status")?.textContent === "Google Account connected");
  await page.select("#target-module", "product-entry");
  await page.type("#sheet-url", "https://docs.google.com/spreadsheets/d/" + spreadsheetId + "/edit");
  await page.waitForFunction(() => !document.querySelector("#continue-button").disabled);
  const startState = await page.evaluate(() => ({
    googleSelected: document.querySelector("#method-link").classList.contains("selected"),
    filePanelHidden: getComputedStyle(document.querySelector("#file-panel")).display === "none",
    connected: window.googleSheetsConnected,
    status: document.querySelector("#google-status").textContent,
    continueEnabled: !document.querySelector("#continue-button").disabled
  }));
  await page.click("#continue-button");
  await page.waitForFunction(() => location.pathname.endsWith("scan-progress-worksheet-detection-preview.html"));
  await page.waitForFunction(() => document.querySelector("#progress-label")?.textContent.includes("Scan complete"));
  const scanState = await page.evaluate(() => ({
    sourceMeta: document.querySelector("#workbook-meta").textContent,
    sourceName: document.querySelector("#workbook-name").textContent,
    target: document.querySelector("#target-module-name").textContent,
    worksheet: document.querySelector("#target-source-name").textContent,
    sheetId: document.querySelector("#target-source-id").textContent
  }));

  const mobile = await browser.newPage();
  await mobile.setViewport({ width: 390, height: 844 });
  await mockApis(mobile);
  await mobile.goto("http://127.0.0.1:8765/spreadsheet-import-center-preview.html", { waitUntil: "networkidle0" });
  await mobile.waitForFunction(() => document.querySelector("#google-status")?.textContent === "Google Account connected");
  const mobileState = await mobile.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    pageWidth: document.documentElement.scrollWidth,
    noHorizontalOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    methodGrid: document.querySelectorAll(".section-body > .method-grid").length,
    connectionStatus: document.querySelector("#google-status").textContent
  }));

  const checks = {
    googleLinkPrimary: startState.googleSelected && startState.filePanelHidden,
    connectedStatus: startState.connected && startState.status === "Google Account connected",
    continueEnabledAfterValidUrl: startState.continueEnabled,
    correctGooglePayload: submittedBody?.module_key === "product_entry" &&
      submittedBody?.source_type === "google_sheets" &&
      submittedBody?.spreadsheet_url === "https://docs.google.com/spreadsheets/d/" + spreadsheetId + "/edit",
    scanSourceType: scanState.sourceMeta === "Google Sheets · Read-only selective scan",
    scanContext: scanState.sourceName === "Client TFI Workbook" &&
      scanState.target === "Product Entry" &&
      scanState.worksheet === "Mapped worksheet: Product Entry" &&
      scanState.sheetId === "sheetId 545274882",
    mobileResponsive: mobileState.viewport === 390 && mobileState.noHorizontalOverflow &&
      mobileState.methodGrid === 1 && mobileState.connectionStatus === "Google Account connected",
    noBrowserErrors: errors.length === 0
  };

  console.log(JSON.stringify({ startState, submittedBody, scanState, mobileState, errors, badResponses, checks, pass: Object.values(checks).every(Boolean) }, null, 2));
  await browser.close();
  await new Promise(resolve => server.close(resolve));
  if (!Object.values(checks).every(Boolean)) process.exitCode = 1;
}

run().catch(error => { console.error(error); process.exitCode = 1; });
