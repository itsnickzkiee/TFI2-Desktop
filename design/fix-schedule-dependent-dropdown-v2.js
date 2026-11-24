const fs = require("fs");
const path = require("path");
const vm = require("vm");

const dir = "C:/Users/Rominick/Desktop/TFI_NEW/design";
const htmlPath = path.join(dir, "production-schedule-preview.html");
const dataPath = path.join(dir, "production-schedule-data.js");
const backupPath = htmlPath + ".pre-source-mapping-corrections-20261120.bak";

function replaceExactlyOnce(source, needle, replacement, label) {
  const first = source.indexOf(needle);
  if (first < 0) throw new Error(label + ": source pattern not found");
  if (source.indexOf(needle, first + needle.length) >= 0) {
    throw new Error(label + ": source pattern occurs more than once");
  }
  return source.slice(0, first) + replacement + source.slice(first + needle.length);
}

let html = fs.readFileSync(htmlPath, "utf8");
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(dataPath, "utf8"), context, { timeout: 1000 });
const data = context.window.TFI_PRODUCTION_SCHEDULE_DATA;
if (!data || data.sourceSheetId !== 1538651320) {
  throw new Error("Production Schedule source metadata is missing or does not match the verified sheetId");
}
if (!Array.isArray(data.products) || !data.groupCodes) {
  throw new Error("Production Schedule product/group-code mappings are unavailable");
}
const targetGroup = "MAYON DRY PEAS";
const expectedCodes = data.groupCodes[targetGroup];
const productCodes = new Set(data.products.map(p => p && p.code).filter(Boolean));
if (!Array.isArray(expectedCodes) || !expectedCodes.length) {
  throw new Error("Expected source group is missing: " + targetGroup);
}
const unmapped = expectedCodes.filter(code => !productCodes.has(code));
if (unmapped.length) throw new Error("Group contains codes missing from Product Standard: " + unmapped.join(", "));

const startMarker = " const codeOptions=()=>{";
const endMarker = " const codeOptionsHtml=codeOptions();";
const start = html.indexOf(startMarker);
const end = html.indexOf(endMarker, start);
if (start < 0 || end < 0 || html.indexOf(startMarker, start + startMarker.length) >= 0) {
  throw new Error("Could not isolate the existing global product-code option builder exactly once");
}
const replacementBlock = [
  " const codeOptionsForGroup=group=>{",
  "  const codes=DATA.groupCodes?.[group]||[];",
  "  return '<option value=\"\"></option>'+codes.filter(code=>byCode[code]).map(code=>'<option value=\"'+esc(code)+'\">'+esc(code)+'</option>').join(\"\");",
  " };"
].join("\n");
html = html.slice(0, start) + replacementBlock + html.slice(end + endMarker.length);

html = replaceExactlyOnce(
  html,
  "  '<td><select class=\"cell-select\" data-field=\"code\" aria-label=\"Production code row '+(i+1)+'\">'+codeOptionsHtml+'</select></td>'+",
  "  '<td><select class=\"cell-select\" data-field=\"code\" aria-label=\"Production code row '+(i+1)+'\" disabled><option value=\"\"></option></select></td>'+",
  "initial product-code select"
);

html = replaceExactlyOnce(
  html,
  '  get(row,"code").addEventListener("change",()=>{',
  [
    '  get(row,"productName").addEventListener("change",()=>{',
    '   const group=value(row,"productName");',
    '   const codeSelect=get(row,"code");',
    '   const codes=DATA.groupCodes?.[group]||[];',
    '   codeSelect.innerHTML=codeOptionsForGroup(group);',
    '   codeSelect.disabled=!codes.some(code=>byCode[code]);',
    '   codeSelect.value="";',
    '   get(row,"shift").value="";',
    '   updateAll();',
    '  });',
    '  get(row,"code").addEventListener("change",()=>{'
  ].join("\n"),
  "product-name dependent product-code handler"
);

html = replaceExactlyOnce(
  html,
  '  rows.forEach(row=>row.querySelectorAll("input,select").forEach(el=>el.value=""));',
  [
    "  rows.forEach(row=>{",
    '   row.querySelectorAll("input,select").forEach(el=>el.value="");',
    '   const codeSelect=get(row,"code");',
    '   codeSelect.innerHTML=\'<option value=""></option>\';',
    "   codeSelect.disabled=true;",
    "  });"
  ].join("\n"),
  "reset dependent dropdown state"
);

if (html.includes("codeOptionsHtml") || html.includes("const codeOptions=()=>")) {
  throw new Error("Global product-code list reference remains after transformation");
}
const inlineScripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
if (inlineScripts.length !== 1) throw new Error("Expected exactly one inline script; found " + inlineScripts.length);
new vm.Script(inlineScripts[0][1], { filename: "production-schedule-preview.html inline script" });

if (fs.existsSync(backupPath)) {
  throw new Error("Rollback backup already exists; refusing to overwrite it: " + backupPath);
}
fs.copyFileSync(htmlPath, backupPath);
fs.writeFileSync(htmlPath, html, "utf8");

console.log(JSON.stringify({
  updated: "production-schedule-preview.html",
  backup: backupPath,
  sourceSheetId: data.sourceSheetId,
  dependentDropdown: "Product Code options now load only from the selected Product Name group",
  resetBehavior: "Product Code options clear and disable on reset",
  testGroup: targetGroup,
  expectedCodeCount: expectedCodes.length,
  inlineScriptSyntax: "passed"
}, null, 2));
