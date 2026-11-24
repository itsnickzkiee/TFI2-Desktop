const fs=require('fs');
const p='C:/Users/Rominick/Desktop/TFI_NEW/design/build-selective-import-flow.js';
const lines=fs.readFileSync(p,'utf8').split(/\r?\n/);
lines[20]="if(!h.includes('const moduleMap=')){const marker=\"const $=id=>document.getElementById(id);let mode='file';let toastTimer;\";if(!h.includes(marker))throw new Error('Import Center JS start marker missing');h=h.replace(marker,moduleCode+marker);}";
fs.writeFileSync(p,lines.join('\n'),'utf8');
console.log('Fixed the builder script quote around the import mode marker.');
