const fs=require("fs");
const p="C:/Users/Rominick/Desktop/TFI_NEW/design/build-removed-rows-ui.js";
let s=fs.readFileSync(p,"utf8");
const tick=String.fromCharCode(96);
s=s.split("\\"+tick).join(tick);
fs.writeFileSync(p,s,"utf8");
console.log("Normalized template literal delimiters.");
