const fs=require('fs'),p='C:/Users/Rominick/Desktop/TFI_NEW/design/production-entry-data.js',s=fs.readFileSync(p,'utf8'),needle='"American Corned Beef"';
const count=s.split(needle).length-1;if(count!==2)throw new Error('Expected 2 American Corned Beef source-name occurrences; found '+count);
const backup=p+'.pre-source-mapping-corrections-20261120.bak';
let out=s.replaceAll(needle,'"American Corned Beef "');
fs.writeFileSync(p,out,'utf8');
console.log(JSON.stringify({correctedOccurrences:count,backupExists:fs.existsSync(backup),preservedTrailingSpace:out.includes('"American Corned Beef "')}));