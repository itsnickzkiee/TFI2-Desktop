(function(){
  "use strict";

  const DATA = window.TFI_PRODUCT_ENTRY_DATA;
  const $ = id => document.getElementById(id);
  const PAGE_SIZE = 40;
  const SAVED_PAGE_SIZE = 50;
  const MAX_NEW_ROWS = 1000;
  const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[ch]));
  const state = {
    blocks:[], block:null, mode:"new", visible:[], widths:[], rendered:0,
    totalRows:MAX_NEW_ROWS, canCreate:false, canEdit:false, backendReady:false,
    currentPage:1, hasMore:false, savedRecords:[], editingRecordId:null,
    draftsByBlock:{}, floatingHead:null, listRequest:0
  };

  function showToast(message,error){
    const root=$("toast-root");
    const toast=document.createElement("div");
    toast.className="toast";
    toast.textContent=message;
    toast.style.background=error?"#8e3028":"#173d29";
    root.appendChild(toast);
    window.setTimeout(()=>toast.remove(),5000);
  }

  async function api(url,options){
    const response=await fetch(url,Object.assign({credentials:"same-origin",cache:"no-store"},options||{}));
    let payload={};
    try{payload=await response.json();}catch(_error){}
    if(!response.ok){
      const message=payload.error||(
        response.status===401||response.status===403
          ?"Your session or Product Entry permission is no longer active. Sign in again or contact the administrator."
          :"TFI2 could not complete the Product Entry request. Try again."
      );
      const error=new Error(message);
      error.status=response.status;
      error.code=payload.code||"product_entry_request_failed";
      throw error;
    }
    return payload;
  }

  function colLetter(number){
    let value="",n=number;
    while(n){const remainder=(n-1)%26;value=String.fromCharCode(65+remainder)+value;n=Math.floor((n-1)/26);}
    return value;
  }
  function colNumber(value){
    let number=0;
    for(const character of String(value||""))number=number*26+character.charCodeAt(0)-64;
    return number;
  }
  function normalizeBlock(source,local){
    const meta=source.schema_metadata||{};
    return {
      block:source.block_key,
      product:source.product_key,
      title:source.display_title,
      firstRow:Number(source.source_first_row||local?.firstRow||1),
      firstDataRow:Number(source.source_first_data_row||local?.firstDataRow||1),
      rows:Number(source.source_block_rows||local?.rows||1004),
      headers:meta.headers||local?.headers||[],
      group1:meta.group1||local?.group1||[],
      group2:meta.group2||local?.group2||[],
      formulas:meta.formulas||local?.formulas||{},
      formulaColumns:source.formula_columns||meta.formula_columns||local?.formulaColumns||[],
      hidden:meta.hidden_spec||local?.hidden||"",
      validations:meta.validations||local?.validations||{},
      fills:meta.fills||local?.fills||{},
      visibleColumns:source.visible_columns||[],
      editableColumns:source.editable_columns||[],
      productCodes:source.product_codes||[],
      reviewColumn:source.review_column,
      reviewOptions:source.review_options||[],
      schemaHash:source.source_schema_sha256||""
    };
  }
  function visibleColumns(block){
    if(Array.isArray(block.visibleColumns)&&block.visibleColumns.length){
      return block.visibleColumns.map(col=>colNumber(col)-1).filter(index=>index>=0&&index<block.headers.length);
    }
    const hidden=new Set();
    String(block.hidden||"").split(",").forEach(part=>{
      const bits=part.trim().split(":");
      if(!bits[0])return;
      const start=colNumber(bits[0]);
      const end=colNumber(bits[1]||bits[0]);
      for(let n=Math.min(start,end);n<=Math.max(start,end);n++)hidden.add(n-1);
    });
    return block.headers.map((_,index)=>index).filter(index=>!hidden.has(index));
  }
  function widthFor(index,label){
    const fixed=[104,130,80,70,78,78,86];
    if(index<fixed.length)return fixed[index];
    const value=String(label||"").toLowerCase();
    if(value.includes("date"))return 105;
    if(value.includes("product code"))return 130;
    if(value.includes("issuance slip")||value.includes("mrs no"))return 100;
    if(value.includes("total hours"))return 84;
    if(value.includes("mp count"))return 76;
    if(value.includes("%"))return 78;
    if(value.includes("input")||value.includes("output"))return 91;
    if(value.length>24)return 145;
    if(value.length>15)return 115;
    return 94;
  }
  function stickyLeft(position){
    let total=42;
    for(let index=0;index<position;index++)total+=state.widths[index];
    return total;
  }
  function groupHeader(values,className,withActions){
    let html='<tr class="'+className+'"><th class="rownum"> </th>';
    let index=0;
    while(index<state.visible.length){
      let end=index+1;
      while(end<state.visible.length&&!(values[state.visible[end]]||"").trim())end++;
      const sourceIndex=state.visible[index];
      const label=(values[sourceIndex]||"").trim();
      const frozen=sourceIndex<6;
      let span=end-index;
      if(className==="group1"&&sourceIndex===6)span=1;
      const left=frozen?' style="left:'+stickyLeft(index)+'px"':"";
      html+='<th colspan="'+span+'"'+(frozen?' class="frozen"':"")+left+'>'+esc(label)+'</th>';
      index+=span;
    }
    if(withActions)html+='<th class="pe-action-head"></th>';
    return html+"</tr>";
  }
  function buildHeader(block,withActions){
    state.visible=visibleColumns(block);
    state.widths=state.visible.map(index=>widthFor(index,block.headers[index]));
    let columns='<col style="width:42px">';
    state.visible.forEach((index,position)=>{columns+='<col style="width:'+state.widths[position]+'px">';});
    if(withActions)columns+='<col style="width:132px">';
    $("entry-colgroup").innerHTML=columns;

    let header=groupHeader(block.group1,"group1",withActions);
    header+=groupHeader(block.group2,"group2",withActions);
    header+='<tr class="column-head"><th class="rownum"> </th>';
    state.visible.forEach((index,position)=>{
      const frozen=index<6;
      const left=frozen?' style="left:'+stickyLeft(position)+'px"':"";
      const label=block.headers[index]||"";
      header+='<th'+(frozen?' class="frozen"':"")+left+' title="'+esc(label)+'">'+esc(label)+'</th>';
    });
    if(withActions)header+='<th class="pe-action-head">RECORD ACTIONS</th>';
    header+="</tr>";
    $("entry-thead").innerHTML=header;
  }
  function cellStyle(block,letter){
    const fill=block.fills?.[letter];
    return fill?' style="--cell-fill:'+esc(fill)+'" data-fill="1"':"";
  }
  function makeControl(block,letter,label,value,rowNumber){
    const current=String(value??"");
    const aria=esc(label+" row "+rowNumber);
    if(letter==="B"||letter===block.reviewColumn){
      const options=letter==="B"?block.productCodes:block.reviewOptions;
      const values=Array.isArray(options)?options.slice():[];
      if(current&&!values.includes(current))values.unshift(current);
      return '<select class="cell-select" data-col="'+letter+'" aria-label="'+aria+'"><option value=""></option>'+
        values.map(option=>'<option value="'+esc(option)+'"'+(String(option)===current?" selected":"")+'>'+esc(option)+'</option>').join("")+
        '</select>';
    }
    return '<input class="cell-input" type="text"'+(letter==="A"?' inputmode="numeric"':'')+
      ' maxlength="1000" autocomplete="off" data-col="'+letter+'" aria-label="'+aria+'" value="'+esc(current)+'">';
  }
  function renderRow(block,displayRowNumber,record,mode,isEditing){
    const data=record?.record_data||{};
    const rowClass=isEditing?"pe-row-editing":"";
    let html='<tr class="'+rowClass+'" data-row-index="'+displayRowNumber+'"';
    if(record)html+=' data-record-id="'+esc(record.id)+'" data-version="'+esc(record.version)+'"';
    else html+=' data-source-row="'+(block.firstDataRow+displayRowNumber-1)+'"';
    html+='><th class="rownum">'+displayRowNumber+'</th>';

    state.visible.forEach((sourceIndex,position)=>{
      const letter=colLetter(sourceIndex+1);
      const label=block.headers[sourceIndex]||letter;
      const formula=block.formulaColumns.includes(letter);
      const editable=block.editableColumns.includes(letter)&&!formula;
      const frozen=sourceIndex<6;
      const left=frozen?' style="left:'+stickyLeft(position)+'px"':"";
      const style=cellStyle(block,letter);
      const classes=(frozen?"frozen ":"")+(formula?"calculated-cell":"input-cell");
      const value=data[letter]??"";
      html+='<td class="'+classes+'"'+style+left+' data-col="'+letter+'" title="'+esc(label)+'">';
      if(formula){
        html+='<div class="calculated" aria-label="Calculated field '+esc(label)+'"></div>';
      }else if(mode==="saved"&&!isEditing){
        html+='<span class="pe-cell-display">'+esc(value||"")+'</span>';
      }else if(editable){
        html+=makeControl(block,letter,label,value,displayRowNumber);
      }else{
        html+='<span class="pe-cell-display">'+esc(value||"")+'</span>';
      }
      html+="</td>";
    });

    if(mode==="saved"){
      html+='<td class="pe-action-cell">';
      if(isEditing){
        html+='<button type="button" class="pe-row-action primary" data-pe-save-row="'+esc(record.id)+'">SAVE</button>';
        html+='<button type="button" class="pe-row-action" data-pe-cancel-row="'+esc(record.id)+'">CANCEL</button>';
      }else if(state.canEdit){
        html+='<button type="button" class="pe-row-action" data-pe-edit-row="'+esc(record.id)+'">EDIT</button>';
      }
      html+='<button type="button" class="pe-row-action history" data-pe-history-row="'+esc(record.id)+'">HISTORY</button>';
      html+="</td>";
    }
    return html+"</tr>";
  }
  function ensureFloatingHeader(){
    if(state.floatingHead)return;
    state.floatingHead=document.createElement("div");
    state.floatingHead.className="floating-sheet-head";
    state.floatingHead.setAttribute("aria-hidden","true");
    document.body.appendChild(state.floatingHead);
  }
  function buildFloatingHeader(){
    ensureFloatingHeader();
    state.floatingHead.innerHTML="";
    const table=document.createElement("table");
    table.className="sheet-table";
    const colgroup=$("entry-colgroup").cloneNode(true);
    const thead=$("entry-thead").cloneNode(true);
    colgroup.removeAttribute("id");
    thead.removeAttribute("id");
    table.appendChild(colgroup);
    table.appendChild(thead);
    state.floatingHead.appendChild(table);
    syncFloatingHeader();
  }
  function syncFloatingHeader(){
    if(!state.floatingHead||!state.block)return;
    const wrap=$("table-scroll");
    const rect=wrap.getBoundingClientRect();
    const topbar=document.querySelector(".topbar");
    const top=topbar?topbar.getBoundingClientRect().bottom:0;
    const headerHeight=$("entry-thead").getBoundingClientRect().height;
    const show=rect.top<top&&rect.bottom>top+headerHeight+8;
    state.floatingHead.style.display=show?"block":"none";
    if(!show)return;
    state.floatingHead.style.top=top+"px";
    state.floatingHead.style.left=rect.left+"px";
    state.floatingHead.style.width=wrap.clientWidth+"px";
    state.floatingHead.style.height=headerHeight+"px";
    const clone=state.floatingHead.firstElementChild;
    if(clone){
      clone.style.width=$("entry-table").scrollWidth+"px";
      clone.style.transform="translateX(-"+wrap.scrollLeft+"px)";
    }
  }
  function rowHasData(row){
    return state.block.editableColumns.some(letter=>{
      const field=row.querySelector('input[data-col="'+letter+'"],select[data-col="'+letter+'"]');
      return field&&String(field.value||"").trim()!=="";
    });
  }
  function readNewRow(row){
    const result={};
    state.block.editableColumns.forEach(letter=>{
      const field=row.querySelector('input[data-col="'+letter+'"],select[data-col="'+letter+'"]');
      if(!field)return;
      const value=String(field.value??"").trim();
      if(value!=="")result[letter]=value;
    });
    return result;
  }
  function captureDraft(){
    if(!state.block||state.mode!=="new")return;
    const rows=Array.from($("entry-tbody").querySelectorAll("tr"));
    state.draftsByBlock[state.block.block]=rows.map(readNewRow);
  }
  function restoreDraft(){
    const saved=state.draftsByBlock[state.block.block]||[];
    const needed=Math.max(PAGE_SIZE,saved.length);
    state.rendered=0;
    $("entry-tbody").innerHTML="";
    appendRows(needed);
    const rows=$("entry-tbody").querySelectorAll("tr");
    saved.forEach((values,index)=>{
      const row=rows[index];
      if(!row)return;
      Object.entries(values).forEach(([letter,value])=>{
        const field=row.querySelector('input[data-col="'+letter+'"],select[data-col="'+letter+'"]');
        if(field)field.value=value;
      });
    });
    updateSummary();
  }
  function appendRows(count){
    if(!state.block||state.mode!=="new"||state.rendered>=state.totalRows)return;
    const end=Math.min(state.rendered+count,state.totalRows);
    let html="";
    for(let index=state.rendered;index<end;index++){
      html+=renderRow(state.block,index+1,null,"new",false);
    }
    $("entry-tbody").insertAdjacentHTML("beforeend",html);
    state.rendered=end;
    $("loaded-status").textContent="New entry · "+state.rendered+" of "+state.totalRows+" blank rows available";
    document.body.dataset.tfiRows=String(state.rendered);
    syncFloatingHeader();
  }
  function updateSummary(){
    if(state.mode==="new"){
      const rows=Array.from($("entry-tbody").querySelectorAll("tr"));
      const filled=rows.filter(rowHasData).length;
      $("logged-label").textContent="ROWS WITH DATA";
      $("last-label").textContent="ENTRY MODE";
      $("free-label").textContent="BLANK ROWS REMAINING";
      $("logged-rows").textContent=String(filled);
      $("last-entry").textContent="New entry";
      $("free-rows").textContent=String(Math.max(0,state.totalRows-state.rendered));
      $("loaded-status").textContent=filled+" row(s) with data · incomplete entries may be saved";
      return;
    }
    const first=state.savedRecords[0];
    $("logged-label").textContent="SAVED RECORDS LOADED";
    $("last-label").textContent="LATEST ENTRY";
    $("free-label").textContent="CURRENT PAGE";
    $("logged-rows").textContent=String(state.savedRecords.length);
    $("last-entry").textContent=first?(first.production_date_text||first.production_date||String(first.created_at||"").slice(0,10)||"—"):"—";
    $("free-rows").textContent="Page "+state.currentPage;
    $("loaded-status").textContent=state.savedRecords.length+" saved record(s) loaded from TFI2";
  }
  function setConnection(text,isError){
    const status=$("pe-connection");
    status.textContent=text;
    status.classList.toggle("is-error",!!isError);
  }
  function populateFilters(block){
    $("pe-filter-code").innerHTML='<option value="">All Product Codes</option>'+
      block.productCodes.map(value=>'<option value="'+esc(value)+'">'+esc(value)+'</option>').join("");
    $("pe-filter-review").innerHTML='<option value="">All Review Statuses</option>'+
      block.reviewOptions.map(value=>'<option value="'+esc(value)+'">'+esc(value)+'</option>').join("");
    $("pe-filter-pr").value="";
    $("pe-filter-from").value="";
    $("pe-filter-to").value="";
  }
  function renderSavedRecords(){
    const tbody=$("entry-tbody");
    if(!state.savedRecords.length){
      tbody.innerHTML='<tr><td colspan="'+(state.visible.length+2)+'" class="pe-no-records">No Product Entry records have been saved in TFI2 for this product block yet.</td></tr>';
      updateSummary();
      return;
    }
    tbody.innerHTML=state.savedRecords.map((record,index)=>
      renderRow(state.block,index+1,record,"saved",state.editingRecordId===record.id)
    ).join("");
    updateSummary();
  }
  async function loadSavedRecords(reset){
    if(!state.backendReady||!state.block)return;
    if(reset){state.currentPage=1;state.savedRecords=[];state.editingRecordId=null;}
    const request=++state.listRequest;
    $("loaded-status").textContent="Loading saved records from TFI2…";
    $("pe-load-more").hidden=true;
    try{
      const query=new URLSearchParams({
        block_key:state.block.block,
        page:String(state.currentPage),
        page_size:String(SAVED_PAGE_SIZE)
      });
      const from=$("pe-filter-from").value;
      const to=$("pe-filter-to").value;
      const code=$("pe-filter-code").value;
      const pr=$("pe-filter-pr").value.trim();
      const review=$("pe-filter-review").value;
      if(from)query.set("date_from",from);
      if(to)query.set("date_to",to);
      if(code)query.set("product_code",code);
      if(pr)query.set("pr_number",pr);
      if(review)query.set("review_status",review);
      const payload=await api("/api/product-entry/records?"+query.toString());
      if(request!==state.listRequest)return;
      const records=payload.records||[];
      state.savedRecords=reset?records:state.savedRecords.concat(records);
      state.hasMore=!!payload.has_more;
      renderSavedRecords();
      $("pe-load-more").hidden=!state.hasMore;
      $("pe-load-more").disabled=false;
      $("pe-load-more").textContent=state.hasMore?"LOAD MORE RECORDS":"";
      $("loaded-status").textContent=state.savedRecords.length+" saved record(s) loaded from TFI2";
    }catch(error){
      if(request!==state.listRequest)return;
      $("entry-tbody").innerHTML='<tr><td colspan="'+(state.visible.length+2)+'" class="pe-no-records">'+esc(error.message)+'</td></tr>';
      $("loaded-status").textContent="Could not load saved records.";
      $("pe-load-more").hidden=true;
      showToast(error.message,true);
    }
  }
  function setMode(mode){
    if(mode===state.mode)return;
    if(state.mode==="saved"&&state.editingRecordId&&mode!=="saved"){
      showToast("Save or cancel the current record edit before leaving Saved Records.",true);
      return;
    }
    if(state.mode==="new")captureDraft();
    state.mode=mode;
    state.editingRecordId=null;
    $("pe-mode-new").classList.toggle("active",mode==="new");
    $("pe-mode-saved").classList.toggle("active",mode==="saved");
    $("pe-filters").hidden=mode!=="saved";
    $("pe-add-rows").hidden=mode!=="new";
    $("pe-save").hidden=mode!=="new";
    $("pe-refresh").hidden=mode!=="saved";
    if(mode==="new"){
      buildHeader(state.block,false);
      restoreDraft();
      if(state.mode==="new")$("pe-table-mode").textContent="NEW ENTRY";
      if(state.mode==="new")$("loaded-status").textContent="New entry · no sample records";
    }else{
      buildHeader(state.block,true);
      $("entry-tbody").innerHTML="";
      $("pe-table-mode").textContent="SAVED RECORDS";
      loadSavedRecords(true);
    }
    buildFloatingHeader();
    syncFloatingHeader();
  }
  function selectProduct(product){
    if(state.mode==="saved"&&state.editingRecordId){
      $("product-select").value=state.block.product;
      showToast("Save or cancel the current record edit before changing products.",true);
      return;
    }
    if(state.mode==="new")captureDraft();
    state.block=state.blocks.find(block=>block.product===product)||state.blocks[0];
    if(!state.block)return;
    $("product-title").textContent=state.block.title;
    $("block-name").textContent=state.block.block;
    $("product-select").value=state.block.product;
    $("pe-table-mode").textContent=state.mode==="new"?"NEW ENTRY":"SAVED RECORDS";
    populateFilters(state.block);
    state.totalRows=Math.min(MAX_NEW_ROWS,Math.max(PAGE_SIZE,state.block.rows-(state.block.firstDataRow-state.block.firstRow)));
    buildHeader(state.block,state.mode==="saved");
    $("entry-tbody").innerHTML="";
    $("table-scroll").scrollLeft=0;
    state.editingRecordId=null;
    if(state.mode==="new")restoreDraft();
    else loadSavedRecords(true);
    buildFloatingHeader();
    document.body.dataset.tfiBlock=state.block.block;
    document.body.dataset.tfiVisibleColumns=String(state.visible.length);
    document.body.dataset.tfiEditableColumns=String(state.block.editableColumns.length);
    updateSummary();
  }
  async function saveNewEntries(){
    if(!state.backendReady||!state.canCreate){
      showToast("Your TFI role does not have Product Entry create permission.",true);
      return;
    }
    const rows=Array.from($("entry-tbody").querySelectorAll("tr"));
    const entries=rows.map((row,index)=>({row,index,data:readNewRow(row)})).filter(item=>Object.keys(item.data).length>0);
    if(!entries.length){showToast("Enter at least one value before saving.",true);return;}
    $("pe-save").disabled=true;
    $("pe-save").textContent="SAVING…";
    let inserted=0,duplicates=0,failed=false;
    try{
      for(let start=0;start<entries.length;start+=40){
        const batch=entries.slice(start,start+40);
        const result=await api("/api/product-entry/records",{
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({block_key:state.block.block,records:batch.map(item=>item.data)})
        });
        inserted+=Number(result.inserted||0);
        duplicates+=Number(result.duplicates||0);
        (result.results||[]).forEach(item=>{
          const entry=batch[item.row_index-1];
          if(!entry)return;
          if(item.status==="inserted"){
            entry.row.querySelectorAll("input,select").forEach(field=>{field.value="";});
            entry.row.classList.remove("pe-duplicate-row");
          }else if(item.status==="duplicate"){
            entry.row.classList.add("pe-duplicate-row");
          }
        });
      }
      captureDraft();
      updateSummary();
      if(inserted){
        showToast(inserted+" Product Entry record(s) saved to TFI2 · "+duplicates+" exact duplicate(s) skipped.");
      }else if(duplicates){
        showToast("No new records saved. "+duplicates+" exact duplicate row(s) were blocked.",true);
      }else{
        showToast("No nonblank Product Entry rows were saved.");
      }
    }catch(error){
      failed=true;
      captureDraft();
      showToast(error.message+(inserted?" Previously accepted rows were saved; remaining entries are still in the form.":""),true);
    }finally{
      $("pe-save").disabled=!state.canCreate;
      $("pe-save").textContent="SAVE ENTRIES";
      updateSummary();
    }
    if(!failed&&state.mode==="saved")await loadSavedRecords(true);
  }
  function beginEdit(recordId){
    if(!state.canEdit)return;
    const record=state.savedRecords.find(item=>item.id===recordId);
    if(!record)return;
    state.editingRecordId=recordId;
    renderSavedRecords();
    const row=$("entry-tbody").querySelector('[data-record-id="'+CSS.escape(recordId)+'"]');
    if(row)row.scrollIntoView({behavior:"smooth",block:"nearest"});
    showToast("Record is ready to edit. Save applies only changed fields and creates a revision.");
  }
  function cancelEdit(){
    state.editingRecordId=null;
    renderSavedRecords();
  }
  async function saveEditedRecord(recordId){
    if(!state.canEdit)return;
    const record=state.savedRecords.find(item=>item.id===recordId);
    const row=$("entry-tbody").querySelector('[data-record-id="'+CSS.escape(recordId)+'"]');
    if(!record||!row)return;
    const original=record.record_data||{};
    const changes={};
    state.block.editableColumns.forEach(letter=>{
      const field=row.querySelector('input[data-col="'+letter+'"],select[data-col="'+letter+'"]');
      if(!field)return;
      const current=String(field.value??"").trim();
      const before=String(original[letter]??"").trim();
      if(current!==before)changes[letter]=current===""?null:current;
    });
    if(!Object.keys(changes).length){
      showToast("No changes detected for this record.");
      cancelEdit();
      return;
    }
    const saveButton=row.querySelector("[data-pe-save-row]");
    if(saveButton){saveButton.disabled=true;saveButton.textContent="SAVING…";}
    try{
      const result=await api("/api/product-entry/records/"+encodeURIComponent(recordId),{
        method:"PATCH",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          expected_version:Number(record.version),
          changes,
          change_reason:"Updated through Product Entry"
        })
      });
      state.editingRecordId=null;
      await loadSavedRecords(true);
      showToast(result.changed?"Product Entry record updated. Revision history was recorded.":"No changes were detected.");
    }catch(error){
      showToast(error.message,true);
      if(error.status===409){
        state.editingRecordId=null;
        await loadSavedRecords(true);
      }else if(saveButton){
        saveButton.disabled=false;
        saveButton.textContent="SAVE";
      }
    }
  }
  async function showHistory(recordId){
    $("pe-history-content").innerHTML='<div class="pe-history-empty">Loading revision history…</div>';
    $("pe-history-backdrop").hidden=false;
    try{
      const payload=await api("/api/product-entry/records/"+encodeURIComponent(recordId)+"/revisions");
      const revisions=payload.revisions||[];
      if(!revisions.length){
        $("pe-history-content").innerHTML='<div class="pe-history-empty">No edits have been recorded for this Product Entry record.</div>';
        return;
      }
      $("pe-history-content").innerHTML=revisions.map(revision=>{
        const changed=revision.changed_columns||[];
        const before=revision.before_data||{};
        const after=revision.after_data||{};
        const rows=changed.map(letter=>{
          const index=colNumber(letter)-1;
          const label=state.block.headers[index]||letter;
          return "<tr><th>"+esc(letter+" · "+label)+"</th><td>"+esc(before[letter]??"—")+"</td><td>"+esc(after[letter]??"—")+"</td></tr>";
        }).join("");
        return '<article class="pe-history-item"><div class="pe-history-item-head"><strong>Version '+esc(revision.version)+'</strong><span>'+esc(revision.changed_at||"")+'</span></div>'+
          (revision.change_reason?'<p class="pe-history-reason">Reason: '+esc(revision.change_reason)+'</p>':"")+
          '<table class="pe-history-table"><thead><tr><th>Field</th><th>Before</th><th>After</th></tr></thead><tbody>'+rows+'</tbody></table></article>';
      }).join("");
    }catch(error){
      $("pe-history-content").innerHTML='<div class="pe-history-empty">'+esc(error.message)+'</div>';
    }
  }
  function initializeEvents(){
    $("product-select").addEventListener("change",event=>selectProduct(event.target.value));
    $("pe-mode-new").addEventListener("click",()=>setMode("new"));
    $("pe-mode-saved").addEventListener("click",()=>setMode("saved"));
    $("pe-save").addEventListener("click",saveNewEntries);
    $("pe-add-rows").addEventListener("click",()=>{
      if(state.mode!=="new")return;
      const before=state.rendered;
      appendRows(PAGE_SIZE);
      if(state.rendered===before)showToast("The maximum number of source entry rows has been reached.");
      else showToast("Added "+(state.rendered-before)+" blank entry rows.");
    });
    $("pe-refresh").addEventListener("click",()=>loadSavedRecords(true));
    $("pe-filter-apply").addEventListener("click",()=>loadSavedRecords(true));
    $("pe-filter-clear").addEventListener("click",()=>{
      populateFilters(state.block);
      loadSavedRecords(true);
    });
    $("pe-load-more").addEventListener("click",()=>{
      if(!state.hasMore)return;
      state.currentPage+=1;
      loadSavedRecords(false);
    });
    $("entry-tbody").addEventListener("input",()=>{if(state.mode==="new")updateSummary();});
    $("entry-tbody").addEventListener("change",()=>{if(state.mode==="new")updateSummary();});
    $("entry-tbody").addEventListener("click",event=>{
      const edit=event.target.closest("[data-pe-edit-row]");
      const save=event.target.closest("[data-pe-save-row]");
      const cancel=event.target.closest("[data-pe-cancel-row]");
      const history=event.target.closest("[data-pe-history-row]");
      if(edit)beginEdit(edit.dataset.peEditRow);
      if(save)saveEditedRecord(save.dataset.peSaveRow);
      if(cancel)cancelEdit();
      if(history)showHistory(history.dataset.peHistoryRow);
    });
    $("pe-history-close").addEventListener("click",()=>{$("pe-history-backdrop").hidden=true;});
    $("pe-history-backdrop").addEventListener("click",event=>{
      if(event.target===$("pe-history-backdrop"))$("pe-history-backdrop").hidden=true;
    });
    $("table-scroll").addEventListener("scroll",syncFloatingHeader,{passive:true});
    window.addEventListener("scroll",()=>{
      if(state.mode==="new"&&window.innerHeight+window.scrollY>=document.documentElement.scrollHeight-260){
        appendRows(PAGE_SIZE);
      }
      syncFloatingHeader();
    },{passive:true});
    window.addEventListener("resize",syncFloatingHeader,{passive:true});
  }

  async function initialize(){
    $("pe-save").disabled=true;
    $("pe-add-rows").disabled=true;
    setConnection("CONNECTING TO TFI2…",false);
    initializeEvents();
    try{
      const [me,catalogPayload]=await Promise.all([
        api("/api/auth/me"),
        api("/api/product-entry/catalog")
      ]);
      const catalog=catalogPayload.catalog||{};
      const localBlocks=new Map((DATA?.blocks||[]).map(block=>[block.block,block]));
      if(!Array.isArray(catalog.blocks)||catalog.blocks.length!==39){
        throw new Error("The TFI2 Product Entry catalog must contain all 39 source blocks.");
      }
      state.blocks=catalog.blocks.map(source=>normalizeBlock(source,localBlocks.get(source.block_key)));
      state.canCreate=!!catalogPayload.permissions?.create||new Set(me.permissions||[]).has("product_entry.create");
      state.canEdit=!!catalogPayload.permissions?.edit||new Set(me.permissions||[]).has("product_entry.edit");
      state.backendReady=true;
      const select=$("product-select");
      select.innerHTML=state.blocks.map(block=>'<option value="'+esc(block.product)+'">'+esc(block.product)+'</option>').join("");
      select.value=state.blocks.some(block=>block.product==="Maharlika LM")?"Maharlika LM":state.blocks[0].product;
      $("pe-save").disabled=!state.canCreate;
      $("pe-save").title=state.canCreate?"Save new Product Entry records":"Your role does not have Product Entry create permission";
      $("pe-add-rows").disabled=false;
      $("pe-connection").textContent="TFI2 CONNECTED";
      setConnection("TFI2 CONNECTED",false);
      $("pe-mode-new").disabled=false;
      $("pe-mode-saved").disabled=false;
      state.mode="new";
      selectProduct(select.value);
      /* batch1 live default */ setMode("saved");
      document.body.dataset.tfiReady="true";
      document.body.dataset.tfiDataSource="TFI2";
      document.body.dataset.tfiCatalogBlocks=String(state.blocks.length);
      document.body.dataset.tfiCreatePermission=String(state.canCreate);
      document.body.dataset.tfiEditPermission=String(state.canEdit);
      document.body.dataset.tfiNoMock="true";
      if(state.mode==="new")$("loaded-status").textContent="New entry · no sample records";
      if(state.mode==="new")$("pe-table-mode").textContent="NEW ENTRY";
    }catch(error){
      setConnection("TFI2 UNAVAILABLE",true);
      $("loaded-status").textContent="Product Entry could not connect to TFI2.";
      $("entry-tbody").innerHTML='<tr><td colspan="8" class="pe-no-records">'+esc(error.message)+'</td></tr>';
      $("pe-save").disabled=true;
      $("pe-add-rows").disabled=true;
      document.body.dataset.tfiError=error.message;
      document.body.dataset.tfiNoMock="true";
      showToast(error.message,true);
    }
  }

  window.addEventListener("focus",()=>{if(state.backendReady&&state.mode==="saved"&&!state.editingRecordId)loadSavedRecords(true);});
  initialize();
})();