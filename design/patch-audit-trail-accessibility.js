const fs=require("fs");
const file="C:/Users/Rominick/Desktop/TFI_NEW/design/audit-trail-preview.html";
let s=fs.readFileSync(file,"utf8");
function once(a,b,label){const n=s.split(a).length-1;if(n!==1)throw Error(label+" match count "+n);s=s.replace(a,b);}
once('<optgroup label="Master Data"><option>Product Standard and Specification</option>',
'<optgroup label="Master Data"><option>Master Data</option><option>Product Standard and Specification</option>','master data filter');
once("document.querySelectorAll('.audit-tab').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.audit-tab').forEach(x=>{x.classList.remove('active');x.setAttribute('aria-selected','false');x.tabIndex=-1});b.classList.add('active');b.setAttribute('aria-selected','true');b.tabIndex=0;$('audit-panel').setAttribute('aria-labelledby',b.id);activeKind=b.dataset.kind;renderAudit()}));",
"document.querySelectorAll('.audit-tab').forEach(b=>{b.addEventListener('click',()=>{document.querySelectorAll('.audit-tab').forEach(x=>{x.classList.remove('active');x.setAttribute('aria-selected','false');x.tabIndex=-1});b.classList.add('active');b.setAttribute('aria-selected','true');b.tabIndex=0;$('audit-panel').setAttribute('aria-labelledby',b.id);activeKind=b.dataset.kind;renderAudit()});b.addEventListener('keydown',e=>{const tabs=[...document.querySelectorAll('.audit-tab')],i=tabs.indexOf(b);let next=-1;if(e.key==='ArrowRight')next=(i+1)%tabs.length;else if(e.key==='ArrowLeft')next=(i-1+tabs.length)%tabs.length;else if(e.key==='Home')next=0;else if(e.key==='End')next=tabs.length-1;if(next<0)return;e.preventDefault();tabs[next].focus();tabs[next].click()})});","tab keyboard support");
fs.writeFileSync(file,s,"utf8");
console.log("Audit Trail keyboard navigation and Master Data filter option patched.");
