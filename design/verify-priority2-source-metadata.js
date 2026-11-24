const fs = require("fs");
const path = require("path");
const vm = require("vm");

const dir = "C:/Users/Rominick/Desktop/TFI_NEW/design";
const officialSpreadsheetId = "1rCbQ16wj7MRjQCFF3tA-WEMkudraJK0RkwcqayUlz7k";
const specs = [
  {
    file: "dmp-production-data.js",
    key: "TFI_DMP_PRODUCTION_DATA",
    sheet: "DMP - Production",
    sheetId: 1312335050,
    refs: { "DMP LEGEND": 1070169465 },
    backup: true
  },
  {
    file: "dmr-production-data.js",
    key: "TFI_DMR_PRODUCTION_DATA",
    sheet: "DMR Production",
    sheetId: 2048043346,
    refs: { "Code Map": 2098561343, "DPR LEGEND": 508797580 },
    backup: true
  },
  {
    file: "hourly-meat-data.js",
    key: "TFI_HOURLY_MEAT_DATA",
    sheet: "Hourly Meat",
    sheetId: 428082343,
    refs: { "Code Map": 2098561343 },
    backup: true
  },
  {
    file: "product-entry-data.js",
    key: "TFI_PRODUCT_ENTRY_DATA",
    sheet: "Product Entry",
    sheetId: 545274882,
    entryMapSheet: "Entry Map",
    entryMapSheetId: 1628314566,
    backup: true
  },
  {
    file: "production-entry-data.js",
    key: "TFI_PRODUCTION_ENTRY_DATA",
    sheet: "Production Entry",
    sheetId: 1923467491,
    legendSheet: "DPR LEGEND",
    legendSheetId: 508797580,
    backup: true
  },
  {
    file: "production-schedule-data.js",
    key: "TFI_PRODUCTION_SCHEDULE_DATA",
    sheet: "Production Schedule",
    sheetId: 1538651320,
    refs: { "Schedule Lists": 156467196, "Product Standard and Specificat": 2138697021 },
    backup: true
  }
];

const results = [];
for (const spec of specs) {
  const filePath = path.join(dir, spec.file);
  const source = fs.readFileSync(filePath, "utf8");
  const context = { window: {} };
  new vm.Script(source, { filename: spec.file });
  vm.runInNewContext(source, context, { timeout: 1000 });
  const data = context.window[spec.key];
  const checks = {
    syntax: true,
    officialSpreadsheetId: data?.sourceSpreadsheetId === officialSpreadsheetId,
    exactWorksheet: data?.sourceSheet === spec.sheet,
    exactSheetId: data?.sourceSheetId === spec.sheetId,
    referenceSheetIds: true,
    entryMap: true,
    legend: true,
    rollbackBackup: fs.existsSync(filePath + ".pre-source-mapping-corrections-20261120.bak")
  };
  if (spec.refs) {
    for (const [name, id] of Object.entries(spec.refs)) {
      if ((data?.referenceSheetIds || {})[name] !== id) checks.referenceSheetIds = false;
    }
  }
  if (spec.entryMapSheet) {
    checks.entryMap = data?.entryMapSheet === spec.entryMapSheet && data?.entryMapSheetId === spec.entryMapSheetId;
  }
  if (spec.legendSheet) {
    checks.legend = data?.legendSheet === spec.legendSheet && data?.legendSheetId === spec.legendSheetId;
  }
  const pass = Object.values(checks).every(Boolean);
  results.push({
    file: spec.file,
    worksheet: data?.sourceSheet,
    sheetId: data?.sourceSheetId,
    referenceSheetIds: data?.referenceSheetIds || {
      "Entry Map": data?.entryMapSheetId,
      "DPR LEGEND": data?.legendSheetId
    },
    checks,
    pass
  });
}
console.log(JSON.stringify({
  officialSpreadsheetId,
  checked: results.length,
  passed: results.filter(x => x.pass).length,
  failed: results.filter(x => !x.pass),
  results
}, null, 2));
if (results.some(x => !x.pass)) process.exitCode = 1;
