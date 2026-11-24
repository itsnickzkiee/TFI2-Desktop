const fs=require("fs");
const p="C:/Users/Rominick/Desktop/TFI_NEW/design/master-data-ui.js";
let s=fs.readFileSync(p,"utf8");
s=s.replace('const type=(categoryKey==="productStandard"&&[4,7,16,19,20].includes(index))?"number":"text";','const type="text";');
fs.writeFileSync(p,s,"utf8");
console.log("Preserved formatted source values in modal fields by using text inputs.");
