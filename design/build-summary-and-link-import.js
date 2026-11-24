const fs = require("fs");
const path = require("path");
const vm = require("vm");
const dir = "C:/Users/Rominick/Desktop/TFI_NEW/design";
const files = {
  reportsHtml:path.join(dir,"reports-reconciliation-preview.html"),
  reportsJs:path.join(dir,"reports-reconciliation-ui.js"),
  reportsCss:path.join(dir,"reports-reconciliation.css"),
  scheduleHtml:path.join(dir,"schedule-summary-preview.html"),
  scheduleJs:path.join(dir,"schedule-summary-ui.js"),
  router:path.join(dir,"tfi-preview-router.js"),
  summaryHtml:path.join(dir,"summary-preview.html"),
  summaryMain:path.join(dir,"summary-main.tmp"),
  summaryModal:path.join(dir,"summary-modal.tmp"),
  summaryCss:path.join(dir,"summary.css"),
  summaryJs:path.join(dir,"summary-ui.js")
};
function replaceOnce(source,from,to,label){
  const i=source.indexOf(from);
  if(i<0)throw new Error(label+": pattern not found");
  if(source.indexOf(from,i+from.length)>=0)throw new Error(label+": pattern occurs more than once");
  return source.slice(0,i)+to+source.slice(i+from.length);
}
function backup(file,tag){
  const p=file+".pre-"+tag+"-20261120.bak";
  if(fs.existsSync(p))throw new Error("Refusing to overwrite existing backup: "+p);
  fs.copyFileSync(file,p);
  return p;
}
function linkSection(prefix){
  return '    <div class="rr-link-import" aria-label="Paste Google Sheets source link">\n'+
    '      <div class="rr-link-import-head"><div><strong>PASTE SPREADSHEET LINK</strong><span>Paste the Google Sheets URL for the source workbook.</span></div><span class="rr-link-badge">GOOGLE SHEETS</span></div>\n'+
    '      <label class="rr-link-label" for="'+prefix+'-spreadsheet-link">Google Sheets URL</label>\n'+
    '      <div class="rr-link-input-row"><input id="'+prefix+'-spreadsheet-link" type="url" inputmode="url" placeholder="https://docs.google.com/spreadsheets/d/..." autocomplete="off" aria-describedby="'+prefix+'-link-feedback"><button class="rr-btn rr-btn-light" id="'+prefix+'-link-validate" type="button">VALIDATE LINK</button></div>\n'+
    '      <div class="rr-link-feedback" id="'+prefix+'-link-feedback" role="status" aria-live="polite">Paste a Google Sheets link, then select Validate Link.</div>\n'+
    '      <div class="rr-link-id" id="'+prefix+'-link-id" hidden><span>DETECTED SPREADSHEET ID</span><code id="'+prefix+'-link-id-value"></code></div>\n'+
    '    </div>\n';
}
function insertLinkSection(html,modalId,prefix){
  if(html.includes('id="'+prefix+'-spreadsheet-link"'))throw new Error(prefix+" spreadsheet link section already exists.");
  const modalStart=html.indexOf('<div class="rr-modal-backdrop" id="'+modalId+'"');
  const warningIndex=html.indexOf('<div class="rr-modal-warning">',modalStart);
  if(modalStart<0||warningIndex<0)throw new Error("Could not locate "+modalId+" warning insertion point.");
  return html.slice(0,warningIndex)+linkSection(prefix)+html.slice(warningIndex);
}
function linkJs(prefix){
  return '\n  function spreadsheetIdFromUrl(raw) {\n'+
    '    try {\n'+
    '      const url = new URL(raw);\n'+
    '      if (url.protocol !== "https:" || url.hostname.toLowerCase() !== "docs.google.com") return "";\n'+
    '      const match = url.pathname.match(/^\\/spreadsheets\\/(?:u\\/\\d+\\/)?d\\/([A-Za-z0-9_-]+)/);\n'+
    '      return match ? match[1] : "";\n'+
    '    } catch (_) { return ""; }\n'+
    '  }\n'+
    '  function bindSpreadsheetLink(prefix) {\n'+
    '    const input = $("'+prefix+'-spreadsheet-link");\n'+
    '    const button = $("'+prefix+'-link-validate");\n'+
    '    const feedback = $("'+prefix+'-link-feedback");\n'+
    '    const idBox = $("'+prefix+'-link-id");\n'+
    '    const idValue = $("'+prefix+'-link-id-value");\n'+
    '    const reset = () => {\n'+
    '      input.setAttribute("aria-invalid", "false");\n'+
    '      feedback.className = "rr-link-feedback";\n'+
    '      feedback.textContent = "Link changed. Select Validate Link to check its URL format.";\n'+
    '      idBox.hidden = true;\n'+
    '      idValue.textContent = "";\n'+
    '      document.body.dataset.tfiSpreadsheetLinkStatus = "pending";\n'+
    '      delete document.body.dataset.tfiDetectedSpreadsheetId;\n'+
    '    };\n'+
    '    input.addEventListener("input", reset);\n'+
    '    button.addEventListener("click", () => {\n'+
    '      const raw = clean(input.value);\n'+
    '      if (!raw) {\n'+
    '        input.setAttribute("aria-invalid", "true");\n'+
    '        feedback.className = "rr-link-feedback is-invalid";\n'+
    '        feedback.textContent = "Paste a Google Sheets URL first.";\n'+
    '        idBox.hidden = true;\n'+
    '        document.body.dataset.tfiSpreadsheetLinkStatus = "empty";\n'+
    '        input.focus();\n'+
    '        return;\n'+
    '      }\n'+
    '      const id = spreadsheetIdFromUrl(raw);\n'+
    '      if (!id) {\n'+
    '        input.setAttribute("aria-invalid", "true");\n'+
    '        feedback.className = "rr-link-feedback is-invalid";\n'+
    '        feedback.textContent = "That link format is not recognized. Paste the full Google Sheets URL beginning with https://docs.google.com/spreadsheets/d/.";\n'+
    '        idBox.hidden = true;\n'+
    '        idValue.textContent = "";\n'+
    '        document.body.dataset.tfiSpreadsheetLinkStatus = "invalid";\n'+
    '        delete document.body.dataset.tfiDetectedSpreadsheetId;\n'+
    '        return;\n'+
    '      }\n'+
    '      input.setAttribute("aria-invalid", "false");\n'+
    '      feedback.className = "rr-link-feedback is-valid";\n'+
    '      feedback.textContent = "Link format looks valid. Access permissions and sheet contents have not been checked.";\n'+
    '      idValue.textContent = id;\n'+
    '      idBox.hidden = false;\n'+
    '      document.body.dataset.tfiSpreadsheetLinkStatus = "valid";\n'+
    '      document.body.dataset.tfiDetectedSpreadsheetId = id;\n'+
    '    });\n'+
    '  }\n';
}
let reportsHtml=fs.readFileSync(files.reportsHtml,"utf8");
let reportsJs=fs.readFileSync(files.reportsJs,"utf8");
let reportsCss=fs.readFileSync(files.reportsCss,"utf8");
let scheduleHtml=fs.readFileSync(files.scheduleHtml,"utf8");
let scheduleJs=fs.readFileSync(files.scheduleJs,"utf8");
let router=fs.readFileSync(files.router,"utf8");
const summaryMain=fs.readFileSync(files.summaryMain,"utf8");
const summaryModal=fs.readFileSync(files.summaryModal,"utf8");
const summaryJs=fs.readFileSync(files.summaryJs,"utf8");
if(fs.existsSync(files.summaryHtml))throw new Error("Summary preview already exists; refusing to overwrite.");
new vm.Script(reportsJs,{filename:"reports-reconciliation-ui.js"});
new vm.Script(scheduleJs,{filename:"schedule-summary-ui.js"});
new vm.Script(summaryJs,{filename:"summary-ui.js"});

reportsHtml=insertLinkSection(reportsHtml,"rr-import-modal","rr");
scheduleHtml=insertLinkSection(scheduleHtml,"ss-import-modal","ss");
const summaryTab='<button class="rr-report-tab" type="button" data-report-page="Summary">Summary</button>';
reportsHtml=replaceOnce(reportsHtml,
  '<button class="rr-report-tab" type="button" data-report-page="Schedule Summary">Schedule Summary</button>',
  '<button class="rr-report-tab" type="button" data-report-page="Schedule Summary">Schedule Summary</button>\n    '+summaryTab,
  "Production Summary third tab");
scheduleHtml=replaceOnce(scheduleHtml,
  '<button class="rr-report-tab active" type="button" data-report-page="Schedule Summary" aria-current="page">Schedule Summary</button>',
  '<button class="rr-report-tab" type="button" data-report-page="Schedule Summary" aria-current="page">Schedule Summary</button>\n    '+summaryTab,
  "Schedule Summary third tab");

reportsJs=replaceOnce(reportsJs,
  '  function closeImportModal() {\n    $("rr-import-modal").classList.remove("open");\n    $("rr-import-modal").setAttribute("aria-hidden", "true");\n    $("rr-import-open").focus();\n  }\n',
  '  function closeImportModal() {\n    $("rr-import-modal").classList.remove("open");\n    $("rr-import-modal").setAttribute("aria-hidden", "true");\n    $("rr-import-open").focus();\n  }\n'+linkJs("rr"),
  "Production Summary link validation functions");
reportsJs=replaceOnce(reportsJs,
  'else window.location.assign(page==="Schedule Summary"?"dashboard-preview.html?module=Schedule%20Summary":"dashboard-preview.html?module=Reports");',
  'else window.location.assign(page==="Schedule Summary"?"dashboard-preview.html?module=Schedule%20Summary":page==="Summary"?"dashboard-preview.html?module=Summary":"dashboard-preview.html?module=Reports");',
  "Production Summary Summary-tab route");
reportsJs=replaceOnce(reportsJs,
  '    $("rr-import-open").addEventListener("click", openImportModal);',
  '    bindSpreadsheetLink("rr");\n    $("rr-import-open").addEventListener("click", openImportModal);',
  "Production Summary bind link input");

scheduleJs=replaceOnce(scheduleJs,
  '  function closeImportModal() {\n    $("ss-import-modal").classList.remove("open");\n    $("ss-import-modal").setAttribute("aria-hidden", "true");\n    $("ss-import-open").focus();\n  }\n',
  '  function closeImportModal() {\n    $("ss-import-modal").classList.remove("open");\n    $("ss-import-modal").setAttribute("aria-hidden", "true");\n    $("ss-import-open").focus();\n  }\n'+linkJs("ss"),
  "Schedule Summary link validation functions");
scheduleJs=replaceOnce(scheduleJs,
  '    const url = page === "Schedule Summary"\n      ? "dashboard-preview.html?module=Schedule%20Summary"\n      : "dashboard-preview.html?module=Reports";',
  '    const url = page === "Schedule Summary"\n      ? "dashboard-preview.html?module=Schedule%20Summary"\n      : page === "Summary"\n        ? "dashboard-preview.html?module=Summary"\n        : "dashboard-preview.html?module=Reports";',
  "Schedule Summary Summary-tab route");
scheduleJs=replaceOnce(scheduleJs,
  '    $("ss-import-open").addEventListener("click", openImportModal);',
  '    bindSpreadsheetLink("ss");\n    $("ss-import-open").addEventListener("click", openImportModal);',
  "Schedule Summary bind link input");

router=replaceOnce(router,
  '    "schedule summary":"schedule-summary-preview.html",',
  '    "schedule summary":"schedule-summary-preview.html",\n    "summary":"summary-preview.html",',
  "Summary route");

const linkCss=[
"/* Shared paste-and-validate Google Sheets link section for report import dialogs */",
".rr-link-import{margin-top:12px;padding:13px;border:1px solid #dce8df;border-radius:10px;background:#fbfdfb}",
".rr-link-import-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:11px}",
".rr-link-import-head strong{display:block;color:#294a39;font-size:10px;font-weight:900;letter-spacing:.45px}",
".rr-link-import-head span:not(.rr-link-badge){display:block;margin-top:4px;color:#839087;font-size:9px;line-height:1.45}",
".rr-link-badge{flex:0 0 auto;padding:5px 7px;border:1px solid #d8e8de;border-radius:6px;background:#eef6f0;color:#3c7454;font-size:8px;font-weight:900;letter-spacing:.4px}",
".rr-link-label{display:block;margin-bottom:5px;color:#4b6255;font-size:9px;font-weight:800}",
".rr-link-input-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:7px}",
".rr-link-input-row input{width:100%;min-width:0;height:36px;padding:0 10px;border:1px solid #d4e0d8;border-radius:7px;background:#fff;color:#20382b;font-size:10px;outline:0}",
".rr-link-input-row input::placeholder{color:#a4b0a8}",
".rr-link-input-row input:focus-visible{border-color:#6da887;outline:3px solid rgba(8,99,51,.13);outline-offset:1px}",
".rr-link-input-row input[aria-invalid=true]{border-color:#c76b61;background:#fffafa}",
".rr-link-input-row .rr-btn{min-height:36px;padding:7px 10px;font-size:8px;white-space:nowrap}",
".rr-link-feedback{margin-top:7px;color:#849087;font-size:9px;line-height:1.5}",
".rr-link-feedback.is-valid{color:#087548;font-weight:700}",
".rr-link-feedback.is-invalid{color:#b04438;font-weight:700}",
".rr-link-id{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:8px;padding:8px 9px;border:1px solid #dce8df;border-radius:7px;background:#fff}",
".rr-link-id[hidden]{display:none}",
".rr-link-id span{color:#78897e;font-size:8px;font-weight:900;letter-spacing:.4px}",
".rr-link-id code{max-width:65%;overflow-wrap:anywhere;color:#24583e;font-size:9px;text-align:right}",
".rr-modal{width:min(560px,100%);max-height:calc(100vh - 40px);overflow:auto}",
"@media(max-width:620px){.rr-link-input-row{grid-template-columns:1fr}.rr-link-input-row .rr-btn{width:100%}.rr-link-id{align-items:flex-start;flex-direction:column}.rr-link-id code{max-width:100%;text-align:left}}"
].join("\n");
reportsCss += "\n\n" + linkCss + "\n";

let summaryHtml=fs.readFileSync(files.reportsHtml,"utf8");
summaryHtml=replaceOnce(summaryHtml,'<title>TFI | Reports &amp; Reconciliation</title>','<title>TFI | Summary</title>','Summary page title');
summaryHtml=replaceOnce(summaryHtml,'<link rel="stylesheet" href="reports-reconciliation.css">','<link rel="stylesheet" href="reports-reconciliation.css">\n<link rel="stylesheet" href="summary.css">','Summary page stylesheet');
summaryHtml=replaceOnce(summaryHtml,
  '<div class="crumb"><span>TFI</span><span>/</span><span>Data &amp; Reports</span><span>/</span><b>Reports &amp; Reconciliation</b><span>/</span><b>Production Summary</b></div>',
  '<div class="crumb"><span>TFI</span><span>/</span><span>Data &amp; Reports</span><span>/</span><b>Reports &amp; Reconciliation</b><span>/</span><b>Summary</b></div>',
  "Summary breadcrumb");
const mainStart=summaryHtml.indexOf('<main class="content rr-content">');
const mainEnd=summaryHtml.indexOf("</main>",mainStart);
if(mainStart<0||mainEnd<0)throw new Error("Could not locate Production Summary main content for Summary clone.");
summaryHtml=summaryHtml.slice(0,mainStart)+summaryMain+summaryHtml.slice(mainEnd+"</main>".length);
const oldModalStart=summaryHtml.indexOf('<div class="rr-modal-backdrop" id="rr-import-modal"');
const oldToastMarker='<div id="rr-toast" class="toast" hidden></div>';
const oldToastIndex=summaryHtml.indexOf(oldToastMarker,oldModalStart);
if(oldModalStart<0||oldToastIndex<0)throw new Error("Could not locate original import modal/toast in Summary clone.");
summaryHtml=summaryHtml.slice(0,oldModalStart)+summaryModal+summaryHtml.slice(oldToastIndex+oldToastMarker.length);
summaryHtml=replaceOnce(summaryHtml,'<script src="reports-reconciliation-ui.js"></script>','<script src="summary-ui.js"></script>','Summary page UI script');

new vm.Script(reportsJs,{filename:"reports-reconciliation-ui.js patched"});
new vm.Script(scheduleJs,{filename:"schedule-summary-ui.js patched"});
new vm.Script(summaryJs,{filename:"summary-ui.js"});
new vm.Script(router,{filename:"tfi-preview-router.js patched"});

const backups=[
  backup(files.reportsHtml,"summary-tabs-and-link"),
  backup(files.reportsJs,"summary-tabs-and-link"),
  backup(files.scheduleHtml,"summary-tabs-and-link"),
  backup(files.scheduleJs,"summary-tabs-and-link"),
  backup(files.reportsCss,"summary-link-styles"),
  backup(files.router,"summary-route")
];
fs.writeFileSync(files.reportsHtml,reportsHtml,"utf8");
fs.writeFileSync(files.reportsJs,reportsJs,"utf8");
fs.writeFileSync(files.scheduleHtml,scheduleHtml,"utf8");
fs.writeFileSync(files.scheduleJs,scheduleJs,"utf8");
fs.writeFileSync(files.reportsCss,reportsCss,"utf8");
fs.writeFileSync(files.router,router,"utf8");
fs.writeFileSync(files.summaryHtml,summaryHtml,"utf8");
fs.unlinkSync(files.summaryMain);
fs.unlinkSync(files.summaryModal);
console.log(JSON.stringify({
  created:[files.summaryHtml,files.summaryCss,files.summaryJs],
  updated:[files.reportsHtml,files.reportsJs,files.scheduleHtml,files.scheduleJs,files.reportsCss,files.router],
  source:{workbook:"Copy of TFI - Production Monitoring Sheet 1",worksheet:"Summary",sheetId:1639151211,columns:32,range:"A:AF",headerRows:"1-3",firstDataRow:4,frozenRows:3,formulaSource:"Product Entry"},
  reportTabs:["Production Summary","Schedule Summary","Summary"],
  importLinkSections:["Production Summary","Schedule Summary","Summary"],
  linkValidation:"Local URL format check only; no access check or import",
  noMockData:true,
  backups
},null,2));
