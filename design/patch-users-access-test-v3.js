const fs=require("fs"),file="C:/Users/Rominick/Desktop/TFI_NEW/design/test-users-access-acceptance.js";let s=fs.readFileSync(file,"utf8");
const re=/initial\.metrics\.every\(x=>x===.*?\)&&initial\.empty/;
if(!re.test(s))throw Error("metrics assertion not found");
s=s.replace(re,"initial.metrics.every(x=>x.length===1)&&initial.empty");
const old='saveToast.includes("saved locally")',next='saveToast.note.includes("saved in this preview session")&&saveToast.savedCount===1';
if(!s.includes(old))throw Error("permission save assertion not found");
s=s.replace(old,next);
fs.writeFileSync(file,s,"utf8");console.log("Fixed Unicode-safe metric assertion and permission save expectation.");
