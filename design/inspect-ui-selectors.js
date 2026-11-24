const fs=require('fs'),path=require('path'),dir='C:/Users/Rominick/Desktop/TFI_NEW/design';
for(const f of ['product-entry-preview.html','production-entry-preview.html','production-schedule-preview.html','dmr-coding-ui.js','coding-dpr-ui.js','oee-ui.js']){
 const a=fs.readFileSync(path.join(dir,f),'utf8').split(/\r?\n/);console.log('\n### '+f+' lines='+a.length);
 a.forEach((line,i)=>{if(/dataset\.tfi|data-col|querySelector(All)?\(|<select|createElement\(['"]select|optionList|productNames|productCodes|products\.map|machines\.map|codes\.map|select\./i.test(line))console.log((i+1)+': '+line.trim().slice(0,280))});
}