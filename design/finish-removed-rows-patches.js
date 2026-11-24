const fs=require("fs"),path=require("path");
const d="C:/Users/Rominick/Desktop/TFI_NEW/design";
function edit(name,fn){const p=path.join(d,name);const s=fs.readFileSync(p,"utf8");const n=fn(s);if(n===s)console.log("UNCHANGED "+name);else{fs.writeFileSync(p,n,"utf8");console.log("PATCHED "+name);}}
edit("reports-reconciliation-ui.js",s=>{
 const old='else window.location.assign(page==="Schedule Summary"?"dashboard-preview.html?module=Schedule%20Summary":page==="Summary"?"dashboard-preview.html?module=Summary":"dashboard-preview.html?module=Reports");';
 const neu='else { const routes={"Production Summary":"Reports","Schedule Summary":"Schedule Summary","Summary":"Summary","Removed Rows":"Removed Rows"}; const module=routes[page]||"Reports"; window.location.assign("dashboard-preview.html?module="+encodeURIComponent(module)); }';
 if(s.includes(neu))return s;if(!s.includes(old))throw new Error("Production Summary tab route marker missing");return s.replace(old,neu);
});
const oldBlock='const url = page === "Schedule Summary"\n      ? "dashboard-preview.html?module=Schedule%20Summary"\n      : page === "Summary"\n        ? "dashboard-preview.html?module=Summary"\n        : "dashboard-preview.html?module=Reports";\n    window.location.assign(url);';
const newBlock='const routes = {"Production Summary":"Reports","Schedule Summary":"Schedule Summary","Summary":"Summary","Removed Rows":"Removed Rows"};\n    const module = routes[page] || "Reports";\n    window.location.assign("dashboard-preview.html?module=" + encodeURIComponent(module));';
for(const name of ["schedule-summary-ui.js","summary-ui.js"])edit(name,s=>{if(s.includes(newBlock))return s;if(!s.includes(oldBlock))throw new Error(name+" report route block missing");return s.replace(oldBlock,newBlock);});
edit("tfi-preview-router.js",s=>{
 const mark='    "summary":"summary-preview.html",';
 if(s.includes('"removed rows":"removed-rows-preview.html"'))return s;
 if(!s.includes(mark))throw new Error("Router summary marker missing");
 return s.replace(mark,mark+'\n    "removed rows":"removed-rows-preview.html",');
});
edit("reports-reconciliation.css",s=>s.replace(/\.rr-report-tabs\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/g,'.rr-report-tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr))'));
for(const name of ["schedule-summary.css","summary.css"])edit(name,s=>s+'\n/* Four report views, including Removed Rows. */\n@media(max-width:620px){.rr-report-tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));width:100%;overflow:visible}.rr-report-tab{min-width:0;flex:none;padding:7px 4px;font-size:8px;line-height:1.2;white-space:normal;text-align:center}}\n');
console.log("Finished report navigation, router, and mobile tab layout.");
