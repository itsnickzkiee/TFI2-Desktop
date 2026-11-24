const fs=require('fs');
const p='C:/Users/Rominick/Desktop/TFI_NEW/design/test-selective-import-flow.js';
const lines=fs.readFileSync(p,'utf8').split(/\r?\n/);
const i=lines.findIndex(x=>x.includes('mapping.push(await page.evaluate'));
if(i<0)throw new Error('mapping assertion line missing');
lines[i]=' for(const [key,want] of Object.entries(expected)){await page.select("#target-module",key);mapping.push(await page.evaluate(()=>[document.querySelector("#target-sheet-name").textContent,(document.querySelector("#target-sheet-meta").textContent.match(/\\d{6,}/)||[])[0]]));}';
fs.writeFileSync(p,lines.join('\n'),'utf8');
console.log('Corrected numeric sheetId extraction in the browser test.');
