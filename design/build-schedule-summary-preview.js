const fs = require("fs");
const path = require("path");
const vm = require("vm");
const dir = "C:/Users/Rominick/Desktop/TFI_NEW/design";
const reportsPath = path.join(dir,"reports-reconciliation-preview.html");
const schedulePath = path.join(dir,"schedule-summary-preview.html");
const routerPath = path.join(dir,"tfi-preview-router.js");
const reportsJsPath = path.join(dir,"reports-reconciliation-ui.js");
const reportsCssPath = path.join(dir,"reports-reconciliation.css");
const mainPath = path.join(dir,"schedule-summary-main.tmp");
const scheduleCssPath = path.join(dir,"schedule-summary.css");
const scheduleJsPath = path.join(dir,"schedule-summary-ui.js");

function replaceOnce(source, from, to, label) {
  const i=source.indexOf(from);
  if(i<0) throw new Error(label+": pattern not found");
  if(source.indexOf(from,i+from.length)>=0) throw new Error(label+": pattern occurs more than once");
  return source.slice(0,i)+to+source.slice(i+from.length);
}
function backup(file,tag) {
  const backupPath=file+".pre-"+tag+"-20261120.bak";
  if(fs.existsSync(backupPath)) throw new Error("Refusing to overwrite existing backup: "+backupPath);
  fs.copyFileSync(file,backupPath);
  return backupPath;
}
if(fs.existsSync(schedulePath)) throw new Error("Schedule Summary preview already exists.");
let reports=fs.readFileSync(reportsPath,"utf8");
let router=fs.readFileSync(routerPath,"utf8");
let reportsJs=fs.readFileSync(reportsJsPath,"utf8");
let reportsCss=fs.readFileSync(reportsCssPath,"utf8");
const mainContent=fs.readFileSync(mainPath,"utf8");
const scheduleCss=fs.readFileSync(scheduleCssPath,"utf8");
const scheduleJs=fs.readFileSync(scheduleJsPath,"utf8");
new vm.Script(reportsJs,{filename:"reports-reconciliation-ui.js"});
new vm.Script(scheduleJs,{filename:"schedule-summary-ui.js"});

let schedule=reports;
schedule=replaceOnce(schedule,"<title>TFI | Reports &amp; Reconciliation</title>","<title>TFI | Schedule Summary</title>","schedule page title");
schedule=replaceOnce(schedule,'<link rel="stylesheet" href="reports-reconciliation.css">','<link rel="stylesheet" href="reports-reconciliation.css">\n<link rel="stylesheet" href="schedule-summary.css">',"schedule stylesheet");
schedule=replaceOnce(schedule,'<div class="crumb"><span>TFI</span><span>/</span><span>Data &amp; Reports</span><span>/</span><b>Reports &amp; Reconciliation</b></div>','<div class="crumb"><span>TFI</span><span>/</span><span>Data &amp; Reports</span><span>/</span><b>Reports &amp; Reconciliation</b><span>/</span><b>Schedule Summary</b></div>',"schedule breadcrumb");
const mainStart=schedule.indexOf('<main class="content rr-content">');
const mainEnd=schedule.indexOf("</main>",mainStart);
if(mainStart<0||mainEnd<0) throw new Error("Reports main content not found.");
schedule=schedule.slice(0,mainStart)+mainContent+"\n"+schedule.slice(mainEnd+"</main>".length);
const oldModalStart=schedule.indexOf('<div class="rr-modal-backdrop" id="rr-import-modal"');
const oldToast=schedule.indexOf('<div id="rr-toast" class="toast" hidden></div>',oldModalStart);
if(oldModalStart<0||oldToast<0) throw new Error("Original Production Summary import modal not found in cloned page.");
const oldToastEnd=oldToast+'<div id="rr-toast" class="toast" hidden></div>'.length;
schedule=schedule.slice(0,oldModalStart)+schedule.slice(oldToastEnd);
schedule=replaceOnce(schedule,'<script src="reports-reconciliation-ui.js"></script>','<script src="schedule-summary-ui.js"></script>',"schedule UI script");

const navInsertion='  <div class="rr-source-meta"';
const navHtml='  <nav class="rr-report-tabs" aria-label="Reports and reconciliation views">\n    <button class="rr-report-tab active" type="button" data-report-page="Reports" aria-current="page">Production Summary</button>\n    <button class="rr-report-tab" type="button" data-report-page="Schedule Summary">Schedule Summary</button>\n  </nav>\n\n';
reports=replaceOnce(reports,navInsertion,navHtml+navInsertion,"Production Summary report tabs");
reports=replaceOnce(reports,'<b>Reports &amp; Reconciliation</b></div>','<b>Reports &amp; Reconciliation</b><span>/</span><b>Production Summary</b></div>',"Production Summary breadcrumb");
const reportsNavCode='    document.querySelectorAll("[data-report-page]").forEach(button=>button.addEventListener("click",()=>{\n      const page=button.dataset.reportPage;\n      if(window.parent&&window.parent!==window)window.parent.postMessage({type:"TFI_NAVIGATE_MODULE",page},"*");\n      else window.location.assign(page==="Schedule Summary"?"dashboard-preview.html?module=Schedule%20Summary":"dashboard-preview.html?module=Reports");\n    }));\n';
reportsJs=replaceOnce(reportsJs,'    $("rr-import-open").addEventListener("click", openImportModal);',reportsNavCode+'    $("rr-import-open").addEventListener("click", openImportModal);',"Production Summary tab navigation");

router=replaceOnce(router,'    "reports & reconciliation":"reports-reconciliation-preview.html",','    "reports & reconciliation":"reports-reconciliation-preview.html",\n    "production summary":"reports-reconciliation-preview.html",\n    "schedule summary":"schedule-summary-preview.html",',"Schedule Summary route");
router=replaceOnce(router,'function setActive(page){\n    const nav=document.querySelector(".sidebar nav");\n    if(!nav)return;\n    const key=String(page||"").trim().toLowerCase();','function setActive(page){\n    const nav=document.querySelector(".sidebar nav");\n    if(!nav)return;\n    const rawKey=String(page||"").trim().toLowerCase();\n    const key=["production summary","schedule summary","summary","removed rows"].includes(rawKey)?"reports":rawKey;',"keep Reports sidebar active for report subviews");

reportsCss += '\n/* Reports & Reconciliation report-view navigation */\n.rr-report-tabs{display:flex;align-items:center;gap:5px;width:max-content;max-width:100%;margin:13px 0 14px;padding:5px;border:1px solid #dfe8e1;border-radius:10px;background:#fff;box-shadow:0 2px 8px rgba(25,55,37,.025);overflow-x:auto}\n.rr-report-tab{min-height:32px;padding:7px 13px;border:1px solid transparent;border-radius:7px;background:transparent;color:#728278;font:inherit;font-size:9px;font-weight:850;white-space:nowrap;cursor:pointer;transition:background .14s,border-color .14s,color .14s}\n.rr-report-tab:hover{background:#f4f8f5;color:#315d47}\n.rr-report-tab.active,.rr-report-tab[aria-current="page"]{border-color:#d4e7da;background:#eaf4ed;color:#075b38}\n.rr-report-tab:focus-visible{outline:3px solid #0b785033;outline-offset:2px}\n@media(max-width:620px){.rr-report-tabs{width:100%}.rr-report-tab{flex:1;text-align:center;padding-left:8px;padding-right:8px}}\n';

const backups=[
  backup(routerPath,"schedule-summary-route"),
  backup(reportsPath,"schedule-tabs"),
  backup(reportsJsPath,"schedule-tabs"),
  backup(reportsCssPath,"schedule-tabs")
];
fs.writeFileSync(schedulePath,schedule,"utf8");
fs.writeFileSync(routerPath,router,"utf8");
fs.writeFileSync(reportsPath,reports,"utf8");
fs.writeFileSync(reportsJsPath,reportsJs,"utf8");
fs.writeFileSync(reportsCssPath,reportsCss,"utf8");
fs.unlinkSync(mainPath);
console.log(JSON.stringify({
  created:[schedulePath,scheduleCssPath,scheduleJsPath],
  updated:[routerPath,reportsPath,reportsJsPath,reportsCssPath],
  route:"Schedule Summary -> schedule-summary-preview.html",
  sidebar:"Reports remains active for both report views",
  source:{worksheet:"Schedule Summary",sheetId:720094137,headerRow:2,firstDataRow:3,columns:19,upstream:"Production Schedule",upstreamSheetId:1538651320},
  noMockData:true,
  backups
},null,2));

