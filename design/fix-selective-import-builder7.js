const fs=require('fs');
const p='C:/Users/Rominick/Desktop/TFI_NEW/design/build-selective-import-flow.js';
let lines=fs.readFileSync(p,'utf8').split(/\r?\n/);
const at=lines.findIndex(x=>x.startsWith('const newNav='));
if(at<0)throw new Error('newNav declaration missing');
if(!lines.some(x=>x.startsWith('const oldNav='))){
 lines.splice(at,0,"const oldNav=\"  window.location.href='scan-progress-worksheet-detection-preview.html?'+new URLSearchParams({sourceType:source.type,sourceName:source.name,sourceSize:String(source.size||'')}).toString();\";");
}
fs.writeFileSync(p,lines.join('\n'),'utf8');
console.log('Added the original navigation marker to the builder.');
