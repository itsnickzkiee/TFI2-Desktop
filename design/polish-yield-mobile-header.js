const fs=require("fs");
const css="C:/Users/Rominick/Desktop/TFI_NEW/design/yield-monitoring.css";
const bak=css+".pre-yield-mobile-topbar-20261120.bak";
if(!fs.existsSync(bak))fs.copyFileSync(css,bak);
let c=fs.readFileSync(css,"utf8");
const addition=[
"/* Mobile embedded-shell header: keep breadcrumb and administrator avatar from colliding. */",
"@media(max-width:620px){",
"  .topbar{padding:0 12px;gap:8px;min-height:56px}",
"  .crumb{min-width:0;gap:6px;font-size:10px;white-space:nowrap}",
"  .crumb span:nth-child(2),.crumb span:nth-child(3),.crumb span:nth-child(4){display:none}",
"  .profile{flex:0 0 auto;gap:6px}",
"  .profile>div:last-child{display:none}",
"}"
].join("\n");
if(!c.includes("Mobile embedded-shell header"))c+="\n"+addition+"\n";
fs.writeFileSync(css,c,"utf8");
const test="C:/Users/Rominick/Desktop/TFI_NEW/design/verify-yield-monitoring-ui.js";
let s=fs.readFileSync(test,"utf8");
s=s.replace('x.childNodes[0].textContent.replace(/\\s+/g," ").trim()','x.innerText.replace("↕","").replace(/\\s+/g," ").trim()');
s=s.replace('filtered.includes("No records")','filtered.includes("No source records")');
s=s.replace('sourceCards:getComputedStyle(document.querySelector(".ym-source-strip")).gridTemplateColumns.split(" ").length','sourceCards:getComputedStyle(document.querySelector(".ym-source-strip")).gridTemplateColumns.trim().split(/\\s+/).length,headerOverlap:(()=>{const c=document.querySelector(".crumb").getBoundingClientRect(),p=document.querySelector(".profile").getBoundingClientRect();return c.right<=p.left})()');
s=s.replace('&&mobile.sourceCards===1&&errors.length===0','&&mobile.sourceCards===1&&mobile.headerOverlap&&errors.length===0');
fs.writeFileSync(test,s,"utf8");
console.log("Applied mobile topbar spacing fix; retained CSS backup; corrected exact-header browser assertion.");
