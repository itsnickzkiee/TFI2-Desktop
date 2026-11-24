const fs=require("fs"),file="C:/Users/Rominick/Desktop/TFI_NEW/design/test-users-access-acceptance.js";let s=fs.readFileSync(file,"utf8");
function once(a,b,label){const n=s.split(a).length-1;if(n!==1)throw Error(label+" matches "+n);s=s.replace(a,b);}
once('const multiSearch=await frame.$eval("#user-count",x=>x.textContent.trim());\n await frame.evaluate',
'const multiSearch=await frame.$eval("#user-count",x=>x.textContent.trim());\n const filterPressed=await frame.$eval(\'.ua-filter-tab[data-status="all"]\',x=>x.getAttribute("aria-pressed"));\n const csvFiltered=await frame.evaluate(async()=>{let captured=null;const oldCreate=URL.createObjectURL,oldClick=HTMLAnchorElement.prototype.click;URL.createObjectURL=b=>{captured=b;return "blob:test"};HTMLAnchorElement.prototype.click=function(){};exportUsers();const text=captured?await captured.text():"";URL.createObjectURL=oldCreate;HTMLAnchorElement.prototype.click=oldClick;return text});\n await frame.evaluate','filtered CSV capture');
once('const saveToast=await frame.$$eval(".ua-toast",xs=>xs[xs.length-1]?.textContent||"");',
'const saveToast=await frame.evaluate(()=>({note:document.querySelector("#permission-foot-note").textContent.trim(),savedCount:Object.keys(savedPermissionState).length}));','save confirmation state');
once('activeFilter,pendingFilter,multiSearch,csv,rolesInitial',
'activeFilter,pendingFilter,multiSearch,filterPressed,csvFiltered,csv,rolesInitial','result include filter states');
once('saveToast.includes("saved locally")',
'saveToast.note.includes("saved in this preview session")&&saveToast.savedCount===1','save confirmation assertion');
once('multiSearch==="Showing 1 of 1 accounts"&&csv.filename',
'multiSearch==="Showing 1 of 1 accounts"&&filterPressed==="true"&&csvFiltered.includes("Alex Updated")&&csv.filename','multi search/export assertions');
fs.writeFileSync(file,s,"utf8");console.log("Acceptance test now checks filter semantics, filtered CSV, and permission save confirmation state.");
