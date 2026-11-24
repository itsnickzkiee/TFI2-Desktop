const fs=require("fs"),file="C:/Users/Rominick/Desktop/TFI_NEW/design/test-users-access-acceptance.js";let s=fs.readFileSync(file,"utf8");
function once(a,b,label){const n=s.split(a).length-1;if(n!==1)throw Error(label+" matches "+n);s=s.replace(a,b);}
once('userTab:document.querySelector(\'.ua-tab[data-view="users"]\')?.getAttribute("role"),\n  roleTab:document.querySelector(\'.ua-tab[data-view="roles"]\')?.getAttribute("role"),\n  paginationVisible:!document.querySelector(".ua-foot .pagination").hidden&&getComputedStyle(document.querySelector(".ua-foot .pagination")).display!=="none",',
'userTab:document.querySelector(\'.ua-tab[data-view="users"]\')?.getAttribute("role"),\n  userTabSelected:document.querySelector(\'.ua-tab[data-view="users"]\')?.getAttribute("aria-selected"),\n  roleTab:document.querySelector(\'.ua-tab[data-view="roles"]\')?.getAttribute("role"),\n  paginationPresent:!!document.querySelector(".ua-foot .pagination"),','initial accessibility fields');
once('toast:document.querySelector(".ua-toast")?.textContent||"",modalOpen:document.querySelector("#user-modal").classList.contains("open")',
'toast:[...document.querySelectorAll(".ua-toast")].at(-1)?.textContent||"",modalOpen:document.querySelector("#user-modal").classList.contains("open")','duplicate toast');
once('const saveToast=await frame.$eval(".ua-toast",x=>x.textContent);',
'const saveToast=await frame.$$eval(".ua-toast",xs=>xs.at(-1)?.textContent||"");','save toast');
once('toast:document.querySelector(".ua-toast")?.textContent||"",modalOpen:document.querySelector("#role-modal").classList.contains("open")',
'toast:[...document.querySelectorAll(".ua-toast")].at(-1)?.textContent||"",modalOpen:document.querySelector("#role-modal").classList.contains("open")','duplicate role toast');
once('initial.title==="Users & Access"&&initial.activeNav==="Users & Access"&&initial.metrics.every(x=>x==="—")&&initial.empty&&initial.exportDisabled&&addModal',
'initial.title==="Users & Access"&&initial.activeNav==="Users & Access"&&initial.metrics.every(x=>x==="—")&&initial.empty&&initial.exportDisabled&&initial.userTab==="tab"&&initial.userTabSelected==="true"&&initial.roleTab==="tab"&&!initial.paginationPresent&&addModal','initial accessibility assertions');
once('duplicate.toast.includes("already in the preview directory")',
'duplicate.toast.includes("already in the preview directory")','duplicate assertion');
once('rolesInitial.viewVisible&&rolesInitial.saveDisabled&&roleModal',
'rolesInitial.viewVisible&&rolesInitial.saveDisabled&&roleModal','role save assertion');
fs.writeFileSync(file,s,"utf8");console.log("Acceptance test updated for accessibility, empty pagination, and latest toast assertions.");
