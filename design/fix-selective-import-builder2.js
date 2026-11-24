const fs=require('fs');
const p='C:/Users/Rominick/Desktop/TFI_NEW/design/build-selective-import-flow.js';
const lines=fs.readFileSync(p,'utf8').split(/\r?\n/);
lines[21]="if(!h.includes('function updateTarget()')){const marker=\"function toast(msg){$('toast').textContent=msg;\";if(!h.includes(marker))throw new Error('Import Center toast JS marker missing');h=h.replace(marker,targetCode+'\\n'+marker);}";
lines[22]="h=h.replace('  let source;',\"  const target=updateTarget();if(!target){toast('Choose one destination module before continuing.');$('target-module').focus();return}\\n  let source;\");";
lines[24]="const newNav=\"  const params=new URLSearchParams({sourceType:source.type,sourceName:source.name,sourceSize:String(source.size||''),sourceUrl:source.url||'',targetModule:$('target-module').value,targetLabel:target.label,sourceWorksheet:target.sheet,sourceSheetId:target.sheetId});window.location.href='scan-progress-worksheet-detection-preview.html?'+params.toString();\";";
fs.writeFileSync(p,lines.join('\n'),'utf8');
console.log('Fixed quote escaping in the selective import builder.');
