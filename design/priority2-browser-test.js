const puppeteer=require('C:/Users/Rominick/AppData/Local/npm-cache/_npx/4b4c857f6efdfb61/node_modules/puppeteer');
const path=require('path'),{pathToFileURL}=require('url');
const dir='C:/Users/Rominick/Desktop/TFI_NEW/design';
const specs=[
 {file:'dmp-production-preview.html',checks:[
  ['DMP source data ready',()=>document.body.dataset.tfiReady==='true'&&document.body.dataset.tfiProductCodes==='67'&&document.body.dataset.tfiProcesses==='69'&&document.body.dataset.tfiWorkers==='42'],
  ['DMP Product Code dropdown count',()=>document.querySelector('.dmp-select[data-col="B"]').options.length===68],
  ['DMP Process dropdown source whitespace',()=>{const a=[...document.querySelector('.dmp-select[data-col="C"]').options].map(x=>x.value);return a.includes('WEIGHING / SAUCE FILLING / SEAMING ')&&a.includes('KAONG WASHING & SOAKING ')}],
  ['DMP Worker dropdown count',()=>document.querySelector('.dmp-select[data-col="D"]').options.length===43]
 ]},
 {file:'dmr-production-preview.html',checks:[
  ['DMR Production source data ready',()=>document.body.dataset.tfiReady==='true'&&document.body.dataset.tfiProductCodes==='58'],
  ['DMR Product Code dropdown count',()=>document.querySelector('.dmr-select[data-col="B"]').options.length===59],
  ['DMR additional dropdown count',()=>document.querySelector('.dmr-select[data-col="I"]').options.length===22&&document.querySelector('.dmr-select[data-col="J"]').options.length===22],
  ['DMR additional options match source list',()=>{const a=[...document.querySelector('.dmr-select[data-col="I"]').options].slice(1).map(x=>x.value);return a[9]==='Hoist '&&!a.includes('Factor Prod DT')}]
 ]},
 {file:'hourly-meat-preview.html',checks:[
  ['Hourly Meat source data ready',()=>document.body.dataset.tfiReady==='true'&&document.body.dataset.tfiProducts==='68'],
  ['Hourly product dropdown count',()=>document.querySelector('.hm-code').options.length===69],
  ['Hourly rows blank',()=>[...document.querySelectorAll('#hm-tbody input,#hm-tbody select')].every(x=>!x.value)]
 ]},
 {file:'product-entry-preview.html',checks:[
  ['Product Entry source ready',()=>document.body.dataset.tfiReady==='true'&&Object.keys(window.TFI_PRODUCT_ENTRY_OPTIONS.codes).length===39],
  ['Product Entry 39 family options',()=>document.querySelector('#product-select').options.length===39],
  ['Product Entry selected block source mapping',()=>!!document.body.dataset.tfiBlock]
 ]},
 {file:'production-entry-preview.html',checks:[
  ['Production Entry source ready',()=>document.body.dataset.tfiReady==='true'&&document.body.dataset.tfiProducts==='32'],
  ['Production Entry product name options',()=>document.querySelector('.product-name').options.length===33],
  ['American Corned Beef source label and code map',()=>{const n=document.querySelector('.product-name'),c=document.querySelector('.product-code');const expected=window.TFI_PRODUCTION_ENTRY_DATA.productCodes['American Corned Beef '];return !!expected&&n.querySelector('option[value="American Corned Beef "]')!==null&&c.disabled&&expected.length>0}],
  ['Product-specific code dropdown activates',async()=>{const n=document.querySelector('.product-name'),c=document.querySelector('.product-code');n.value='American Corned Beef ';n.dispatchEvent(new Event('change',{bubbles:true}));return !c.disabled&&[...c.options].slice(1).map(x=>x.value).join('|')===window.TFI_PRODUCTION_ENTRY_DATA.productCodes['American Corned Beef '].join('|')}]
 ]},
 {file:'production-schedule-preview.html',checks:[
  ['Production Schedule source ready',()=>document.body.dataset.tfiReady==='true'&&document.body.dataset.tfiGroups==='43'&&document.body.dataset.tfiProducts==='100'],
  ['Product group dropdown count',()=>document.querySelector('select[data-field="productName"]').options.length===44],
  ['Group-dependent production codes',async()=>{const n=document.querySelector('select[data-field="productName"]'),c=document.querySelector('select[data-field="code"]');n.value='MAYON DRY PEAS';n.dispatchEvent(new Event('change',{bubbles:true}));const expected=window.TFI_PRODUCTION_SCHEDULE_DATA.groupCodes['MAYON DRY PEAS'];return expected.length>0&&[...c.options].slice(1).map(x=>x.value).join('|')===expected.join('|')}]
 ]},
 {file:'dmr-coding-preview.html',checks:[
  ['DMR Coding source ready',()=>document.body.dataset.tfiReady==='true'&&document.body.dataset.tfiProductCodes==='116'],
  ['DMR Coding Product Code options',()=>document.querySelector('.dmc-select[data-col="B"]').options.length===117],
  ['DMR Coding Category and Factor options',()=>document.querySelector('.dmc-select[data-col="H"]').options.length===9&&document.querySelector('.dmc-select[data-col="I"]').options.length===14],
  ['Unmatched historical code not promoted to dropdown',()=>![...document.querySelector('.dmc-select[data-col="B"]').options].some(x=>['TMWKC-6-2950'].includes(x.value))]
 ]},
 {file:'coding-dpr-preview.html',checks:[
  ['Coding DPR source ready',()=>document.body.dataset.tfiReady==='true'&&document.body.dataset.tfiProductCodes==='116'&&document.body.dataset.tfiBatchSlots==='7'],
  ['Coding DPR product datalist options',()=>document.querySelectorAll('#cdpr-product-codes option').length===116],
  ['Coding DPR line number options',()=>document.querySelector('select[data-col="B"]').options.length===4],
  ['Unmatched historical codes not promoted',()=>{const a=[...document.querySelectorAll('#cdpr-product-codes option')].map(x=>x.value);return !a.includes('TMWKC-6-2950')&&!a.includes('MRMB-24-380')}]
 ]},
 {file:'oee-preview.html',checks:[
  ['OEE source ready',()=>document.body.dataset.tfiReady==='true'&&document.body.dataset.tfiMachines==='50'&&document.body.dataset.tfiProducts==='127'],
  ['OEE machine dropdown options',()=>document.querySelector('.oee-machine').options.length===51],
  ['OEE product dropdown options',()=>document.querySelector('.oee-code').options.length===128&&!([...document.querySelector('.oee-code').options].some(x=>x.value==='All'))],
  ['OEE line dropdown options',()=>document.querySelector('select[data-col="C"]').options.length===4]
 ]}
];
(async()=>{
 const browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-setuid-sandbox']});
 const results=[];
 for(const spec of specs){
  const page=await browser.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await page.goto(pathToFileURL(path.join(dir,spec.file)).href,{waitUntil:'load'});
  const checks=[];
  for(const [name,fn] of spec.checks){let pass=false;try{pass=await page.evaluate(fn)}catch(e){errors.push(name+': '+e.message)}checks.push({name,pass})}
  results.push({file:spec.file,checks,errors});
  await page.close();
 }
 await browser.close();
 const failed=results.flatMap(x=>[...x.checks.filter(c=>!c.pass).map(c=>x.file+': '+c.name),...x.errors.map(e=>x.file+': '+e)]);
 console.log(JSON.stringify(results,null,2));
 if(failed.length){console.error('FAILED: '+failed.join(' | '));process.exitCode=1}else console.log('ALL PRIORITY 2 BROWSER CHECKS PASSED');
})().catch(e=>{console.error(e);process.exitCode=1});