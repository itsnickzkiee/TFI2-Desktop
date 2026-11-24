(function(){
  "use strict";
  const DATA=window.TFI_CODING_DPR_DATA;
  if(!DATA)throw new Error("Coding DPR source references were not loaded.");
  const $=id=>document.getElementById(id);
  const BATCHES=DATA.sourceColumns.batches;
  const SOURCE_TOTAL_QTY_COLS=BATCHES.slice(0,6).map(x=>x.quantity);
  const BATCH7= BATCHES[6];
  let rowCount=12;
  let toastTimer;

  const esc=v=>String(v??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  const formatNumber=v=>new Intl.NumberFormat("en-US",{maximumFractionDigits:0}).format(v||0);
  const productList=DATA.productCodes.map(code=>'<option value="'+esc(code)+'"></option>').join("");
  const lineOptions='<option value=""></option>'+DATA.lineNumbers.map(v=>'<option value="'+esc(v)+'">'+esc(v)+'</option>').join("");

  function inputCell(col,type,cls,label,extra=""){
    return '<td><input class="cdpr-cell '+cls+'" data-col="'+col+'" type="'+type+'" aria-label="'+esc(label)+'" '+extra+'></td>';
  }
  function batchCells(batch,index){
    const slot=index+1;
    return inputCell(batch.productionDate,"date","cdpr-date","Batch "+slot+" production date")
      +'<td class="cdpr-batch-start"><input class="cdpr-cell cdpr-code" data-col="'+batch.productCode+'" type="text" list="cdpr-product-codes" autocomplete="off" aria-label="Batch '+slot+' product code"></td>'
      +inputCell(batch.quantity,"number","cdpr-qty","Batch "+slot+" quantity in tins",'min="0" step="1" inputmode="numeric"');
  }
  function rowHtml(index){
    const batches=BATCHES.map(batchCells).join("");
    return '<tr data-row="'+index+'">'
      +'<th class="cdpr-rownum">'+index+'</th>'
      +inputCell("A","date","cdpr-date cdpr-detail-col","Coding or labelling date")
      +'<td class="cdpr-detail-col"><select class="cdpr-cell cdpr-select" data-col="B" aria-label="Line number">'+lineOptions+'</select></td>'
      +batches
      +'<td class="cdpr-total-cell"><input class="cdpr-cell cdpr-total" data-col="X" type="text" readonly tabindex="-1" aria-label="Total quantity in tins"></td>'
      +'</tr>';
  }
  function valueOf(row,col){return row.querySelector('[data-col="'+col+'"]')?.value||"";}
  function quantityOf(row,col){const raw=String(valueOf(row,col)).replace(/,/g,"");const n=Number(raw);return raw!==""&&Number.isFinite(n)?n:0;}
  function rowHasData(row){return Array.from(row.querySelectorAll("[data-col]")).some(el=>el.dataset.col!=="X"&&String(el.value||"").trim()!=="");}
  function batchHasData(row,batch){return [batch.productionDate,batch.productCode,batch.quantity].some(col=>String(valueOf(row,col)).trim()!=="");}

  function recalculateRow(row){
    const total=SOURCE_TOTAL_QTY_COLS.reduce((sum,col)=>sum+quantityOf(row,col),0);
    const output=row.querySelector('[data-col="X"]');
    output.value=rowHasData(row)?formatNumber(total):"";
  }
  function updateSummary(){
    const rows=Array.from($("cdpr-tbody").querySelectorAll("tr"));
    const filled=rows.filter(rowHasData);
    const sourceTotal=rows.reduce((sum,row)=>sum+SOURCE_TOTAL_QTY_COLS.reduce((rowSum,col)=>rowSum+quantityOf(row,col),0),0);
    const batch7Total=rows.reduce((sum,row)=>sum+quantityOf(row,BATCH7.quantity),0);
    const batches=rows.reduce((sum,row)=>sum+BATCHES.filter(batch=>batchHasData(row,batch)).length,0);
    $("cdpr-entry-rows").textContent=String(rows.length);
    $("cdpr-filled-rows").textContent=String(filled.length);
    $("cdpr-batch-count").textContent=String(batches);
    $("cdpr-total-tins").textContent=formatNumber(sourceTotal);
    $("cdpr-batch7-tins").textContent=formatNumber(batch7Total);
    $("cdpr-table-status").textContent=filled.length+" of "+rows.length+" entry rows contain data Â· "+batches+" batch entries Â· no sample transactions are preloaded";
  }
  function handleEdit(event){
    const row=event.target.closest("tr");
    if(!row)return;
    if(SOURCE_TOTAL_QTY_COLS.includes(event.target.dataset.col))recalculateRow(row);
    if(event.target.dataset.col===BATCH7.quantity)recalculateRow(row);
    updateSummary();
  }
  function buildRows(count=rowCount){
    $("cdpr-tbody").innerHTML=Array.from({length:count},(_,i)=>rowHtml(i+1)).join("");
    updateSummary();
  }
  function toast(message){
    const el=$("cdpr-toast");
    el.textContent=message;
    el.hidden=false;
    clearTimeout(toastTimer);
    toastTimer=setTimeout(()=>el.hidden=true,3600);
  }
  function clearForm(){
    const rows=Array.from($("cdpr-tbody").querySelectorAll("tr"));
    rows.forEach(row=>{
      row.querySelectorAll("input,select").forEach(el=>el.value="");
      recalculateRow(row);
    });
    updateSummary();
    toast("Coding DPR form cleared. No records were saved.");
  }
  function addRows(){
    if(rowCount>=50){toast("The current save limit is 50 rows. Save the current form before adding more.");return;}
    const first=rowCount+1;
    const added=Math.min(12,50-rowCount);
    rowCount+=added;
    const tbody=$("cdpr-tbody");
    for(let i=first;i<=rowCount;i++)tbody.insertAdjacentHTML("beforeend",rowHtml(i));
    updateSummary();
    toast(added+" blank Coding DPR entry rows added.");
  }

  $("cdpr-tbody").addEventListener("input",handleEdit);
  $("cdpr-tbody").addEventListener("change",handleEdit);
  $("cdpr-reset").addEventListener("click",clearForm);
  $("cdpr-add-rows").addEventListener("click",addRows);
  $("cdpr-save").addEventListener("click",()=>toast("Preview only â€” database saving is not connected yet. No data has been saved."));
  $("cdpr-product-codes").innerHTML=productList;
  buildRows();

  document.body.dataset.tfiReady="true";
  document.body.dataset.tfiRows=String(rowCount);
  document.body.dataset.tfiProductCodes=String(DATA.productCodes.length);
  document.body.dataset.tfiBatchSlots=String(BATCHES.length);
  document.body.dataset.tfiNoMock="true";
})();

