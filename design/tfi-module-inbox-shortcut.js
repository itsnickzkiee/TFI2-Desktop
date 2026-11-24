(function(){
  "use strict";
  const modules={
    "product-entry-preview.html":{value:"product-entry",label:"Product Entry",sheet:"Product Entry",sheetId:"545274882"},
    "production-entry-preview.html":{value:"production-entry",label:"Production Entry",sheet:"Production Entry",sheetId:"1923467491"},
    "production-schedule-preview.html":{value:"production-schedule",label:"Production Schedule",sheet:"Production Schedule",sheetId:"1538651320"},
    "dmp-production-preview.html":{value:"dmp-production",label:"DMP Production",sheet:"DMP - Production",sheetId:"1312335050"},
    "dmr-production-preview.html":{value:"dmr-production",label:"DMR Production",sheet:"DMR Production",sheetId:"2048043346"},
    "dmr-coding-preview.html":{value:"dmr-coding",label:"DMR Coding",sheet:"DMR Coding",sheetId:"675328096"},
    "hourly-meat-preview.html":{value:"hourly-meat",label:"Hourly Meat",sheet:"Hourly Meat",sheetId:"428082343"},
    "hourly-coding-preview.html":{value:"hourly-coding",label:"Hourly Coding",sheet:"Hourly Coding",sheetId:"1916766220"},
    "hourly-agri-preview.html":{value:"hourly-agri",label:"Hourly Agri",sheet:"Hourly Agri",sheetId:"534145404"},
    "oee-preview.html":{value:"oee",label:"OEE",sheet:"OEE",sheetId:"1750442014"},
    "productivity-preview.html":{value:"productivity",label:"Productivity",sheet:"Productivity",sheetId:"1688444278"},
    "coding-dpr-preview.html":{value:"coding-dpr",label:"Coding DPR",sheet:"Coding DPR",sheetId:"1266086431"},
    "co-qa-preview.html":{value:"co-qa",label:"CO QA",sheet:"co QA",sheetId:"1359678099"},
    "non-prod-preview.html":{value:"non-prod",label:"NON-PROD",sheet:"NON-PROD",sheetId:"1381857831"},
    "pr-monitoring-preview.html":{value:"pr-monitoring",label:"PR Monitoring",sheet:"PR MONITORING",sheetId:"867256143"}
  };
  const page=decodeURIComponent(window.location.pathname.split("/").pop()||"").toLowerCase();
  const module=modules[page];
  if(!module)return;
  const actions=document.querySelector(".tfi-topbar-actions")||document.querySelector(".topbar");
  if(!actions||document.getElementById("tfi-module-inbox-shortcut"))return;
  if(!document.getElementById("tfi-module-inbox-shortcut-style")){
    const style=document.createElement("style");
    style.id="tfi-module-inbox-shortcut-style";
    style.textContent=`
      .tfi-module-inbox-shortcut{height:36px;display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:0 12px;border:1px solid #cfe0d4;border-radius:9px;background:#edf5ef;color:#075a35;font-size:10px;font-weight:800;white-space:nowrap;box-shadow:0 1px 2px rgba(20,50,34,.04);cursor:pointer;transition:background .16s ease,border-color .16s ease}
      .tfi-module-inbox-shortcut:hover{background:#e2f0e6;border-color:#a9cbb4}
      .tfi-module-inbox-shortcut svg{width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
      @media(max-width:620px){.tfi-module-inbox-shortcut{width:36px!important;min-width:36px!important;max-width:36px!important;flex:0 0 36px!important;height:36px!important;padding:0!important;box-sizing:border-box!important}.tfi-module-inbox-shortcut span{display:none}}
    `;
    document.head.appendChild(style);
  }
  const button=document.createElement("button");
  button.type="button";
  button.id="tfi-module-inbox-shortcut";
  button.className="tfi-module-inbox-shortcut";
  button.title="Open "+module.label+" Import Inbox";
  button.setAttribute("aria-label",button.title);
  button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16v16H4z"/><path d="M4 9h16M9 9v3h6V9"/></svg><span>Import Inbox</span>';
  button.addEventListener("click",function(){
    const context={targetModule:module.value,targetLabel:module.label,sourceWorksheet:module.sheet,sourceSheetId:module.sheetId,from:"module-page"};
    if(window.self!==window.top){
      window.parent.postMessage({type:"TFI_NAVIGATE_MODULE",page:"Module Import Inbox",context:context},"*");
      return;
    }
    const query=new URLSearchParams(context);
    window.location.href="module-import-inbox-preview.html?"+query.toString();
  });
  const fullscreen=actions.querySelector(".tfi-fullscreen-btn");
  actions.insertBefore(button,fullscreen||actions.firstChild);
})();