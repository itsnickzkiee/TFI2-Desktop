(function(){
  "use strict";
  const $=id=>document.getElementById(id);
  const COST_FIELDS=[
    {column:"Y",input:"qa-cost-y",label:"Labels"},
    {column:"Z",input:"qa-cost-z",label:"Box"},
    {column:"AA",input:"qa-cost-aa",label:"Can"},
    {column:"AB",input:"qa-cost-ab",label:"Lids/Cover"},
    {column:"AC",input:"qa-cost-ac",label:"Labels"},
    {column:"AD",input:"qa-cost-ad",label:"Box"}
  ];
  const esc=value=>String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  const state={catalog:null,blocks:new Map(),records:[],selected:null,page:1,pageSize:50,hasMore:false,canCreate:false,canEdit:false,search:""};
  async function api(path,options={}){
    const response=await fetch(path,{credentials:"same-origin",...options,headers:{"Content-Type":"application/json",...(options.headers||{})}});
    let payload={};
    try{payload=await response.json();}catch(_){}
    if(!response.ok)throw new Error(payload.error||("Request failed ("+response.status+")."));
    return payload;
  }
  function toast(message,isError=false){
    const node=$("qa-toast");node.textContent=message;node.classList.toggle("is-error",isError);node.hidden=false;
    window.setTimeout(()=>{node.hidden=true;},3600);
  }
  function showModal(id){$(id).hidden=false;document.body.classList.add("qa-modal-open");}
  function hideModal(id){$(id).hidden=true;if($("qa-cost-modal").hidden&&$("qa-history-modal").hidden&&$("qa-details-modal").hidden)document.body.classList.remove("qa-modal-open");}
  function formatCost(value){return value===null||value===undefined||value===""?"—":Number(value).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:6});}
  function formatCalculation(item){
    if(!item||item.value===null||item.value===undefined)return '<span class="qa-formula-pending" title="'+esc(item?.reason||"Calculation pending")+'">Pending</span>';
    return '<strong class="qa-formula-value">'+esc(formatCost(item.value))+'</strong>';
  }
  function blockLabel(key){const block=state.blocks.get(key);return block?.display_title||key||"—";}
  function setConnection(message,kind=""){
    const node=$("qa-connection-status");node.textContent=message;node.classList.toggle("is-connected",kind==="connected");node.classList.toggle("is-error",kind==="error");
  }

  function renderSourceMap(){
    $("qa-source-map").innerHTML=[
      {range:"A:X",title:"QA observations",desc:"Derived from Product Entry records and their product-specific QA fields",kind:"SOURCE"},
      {range:"Y:AD",title:"Packaging unit costs",desc:"Six separate unit-cost inputs saved against a stable Product Entry record UUID",kind:"EDITABLE"},
      {range:"AE:AH",title:"Calculated outputs",desc:"Read-only calculations using the exact source worksheet formulas; formula-derived source fields remain pending",kind:"FORMULA"},
      {range:"AI:AL",title:"Labels and box totals",desc:"Source labels exist, but no formulas were found in inspected source rows",kind:"UNRESOLVED"}
    ].map(item=>'<article class="qa-map-card"><div class="qa-map-top"><strong>'+esc(item.range)+'</strong><span>'+esc(item.kind)+'</span></div><h3>'+esc(item.title)+'</h3><p>'+esc(item.desc)+'</p></article>').join("");
  }
  function emptyRow(message,detail){
    $("qa-tbody").innerHTML='<tr><td colspan="19" class="qa-empty-cell"><div class="qa-empty-state"><strong>'+esc(message)+'</strong><span>'+esc(detail)+'</span></div></td></tr>';
  }
  function visibleRecords(){
    const query=state.search.trim().toLowerCase();
    if(!query)return state.records;
    return state.records.filter(record=>{
      const data=record.record_data||{};
      return [record.product_code,data.B,record.pr_number,data.D,blockLabel(record.block_key)]
        .some(value=>String(value||"").toLowerCase().includes(query));
    });
  }
  function renderRecords(){
    const records=visibleRecords();
    if(!records.length){
      emptyRow(state.records.length?"No records match this search.":"No Product Entry records are available yet.",
        state.records.length?"Try a different product code or PR number.":"Create a Product Entry record first. It will appear here with its own linked CO QA unit-cost fields.");
    }else{
      $("qa-tbody").innerHTML=records.map(record=>{
        const data=record.record_data||{};
        const costs=record.costs||{};
        const projection=record.qa_projection||{};
        const calculations=record.qa_calculations||{};
        const calculationCells=["AE","AF","AG","AH"].map(column=>'<td class="qa-calculated-cell">'+formatCalculation(calculations[column])+'</td>').join("");
        const count=Number(projection.available_count||0);
        const formulaPending=Number(projection.formula_pending_count||0);
        const qaSummary=count+"/18"+(formulaPending?" · "+formulaPending+" formula pending":"");
        const costCells=COST_FIELDS.map(field=>'<td class="qa-cost-value '+(costs[field.column]===null||costs[field.column]===undefined?"qa-muted-value":"")+'">'+esc(formatCost(costs[field.column]))+'</td>').join("");
        const version=Number(record.cost_version||0);
        return '<tr>'+
          '<td>'+esc(record.production_date_text||data.A||"—")+'</td>'+
          '<td><strong>'+esc(record.product_code||data.B||"—")+'</strong><small>'+esc(record.product_key||"")+'</small></td>'+
          '<td><strong>'+esc(blockLabel(record.block_key))+'</strong><small>'+esc(record.block_key)+'</small></td>'+
          '<td>'+esc(data.C||"—")+'</td>'+
          '<td>'+esc(record.pr_number||data.D||"—")+'</td>'+
          '<td>'+esc(data.E||"—")+'</td>'+
          '<td><strong>'+esc(qaSummary)+'</strong><small>'+esc(projection.status||"not mapped")+'</small></td>'+costCells+calculationCells+
          '<td>'+(version?("v"+version):'<span class="qa-muted-value">Not set</span>')+'</td>'+
          '<td><div class="qa-actions-cell"><button type="button" class="qa-row-action" data-action="details" data-id="'+esc(record.id)+'">View QA</button><button type="button" class="qa-row-action primary" data-action="costs" data-id="'+esc(record.id)+'" '+((version?state.canEdit:state.canCreate)?"":"disabled")+'>Edit costs</button><button type="button" class="qa-row-action" data-action="history" data-id="'+esc(record.id)+'">History</button></div></td>'+
        '</tr>';
      }).join("");
    }
    $("qa-table-status").textContent=records.length+" shown · "+state.records.length+" loaded from Product Entry";
    $("qa-load-more-wrap").hidden=!state.hasMore;
  }
  async function loadRecords(append=false){
    if(!append){state.page=1;state.records=[];}
    const params=new URLSearchParams({page:String(state.page),page_size:String(state.pageSize)});
    if($("qa-block-filter").value)params.set("block_key",$("qa-block-filter").value);
    if($("qa-date-from").value)params.set("date_from",$("qa-date-from").value);
    if($("qa-date-to").value)params.set("date_to",$("qa-date-to").value);
    try{
      const payload=await api("/api/co-qa/records?"+params.toString());
      state.records=append?state.records.concat(payload.records||[]):(payload.records||[]);
      state.hasMore=Boolean(payload.has_more);
      renderRecords();
      setConnection("Connected to TFI2","connected");
    }catch(error){
      if(!append)emptyRow("Unable to load CO QA records.",error.message);
      setConnection(error.message,"error");
      $("qa-table-status").textContent="Connection error";
    }
  }

  function openProductEntry(){
    const message={type:"TFI_NAVIGATE_MODULE",page:"Product Entry"};
    if(window.parent&&window.parent!==window){window.parent.postMessage(message,"*");return;}
    if(typeof window.TFINavigatePreview==="function"){window.TFINavigatePreview("Product Entry");return;}
    window.location.href="product-entry-preview.html";
  }

  function openQaDetails(record){
    const data=record.record_data||{};
    const projection=record.qa_projection||{};
    $("qa-details-record-label").textContent=(record.product_code||data.B||"Product Entry record")+" · "+blockLabel(record.block_key)+" · "+(record.production_date_text||data.A||"No date");
    const fields=projection.fields||[];
    if(!fields.length){
      $("qa-details-list").innerHTML='<p class="qa-modal-record">This Product Entry block is not part of the original CO QA source projection.</p>';
    }else{
      $("qa-details-list").innerHTML=fields.map(field=>{
        const status=field.formula_pending?"Formula pending":(field.missing?"Not entered":"Captured");
        const value=field.formula_pending?"Awaiting source formula":(field.missing?"—":String(field.value));
        return '<article class="qa-detail-card"><div><strong>'+esc(field.column)+' · '+esc(field.label)+'</strong><small>Product Entry source '+esc(field.source_column)+'</small></div><span class="qa-detail-status '+(field.formula_pending?"pending":(field.missing?"missing":"captured"))+'">'+esc(status)+'</span><p>'+esc(value)+'</p></article>';
      }).join("");
    }
    showModal("qa-details-modal");
  }
  function openCostEditor(record){
    state.selected=record;
    const data=record.record_data||{};
    $("qa-cost-record-label").textContent=(record.product_code||data.B||"Product Entry record")+" · "+blockLabel(record.block_key)+" · "+(record.production_date_text||data.A||"No date");
    const costs=record.costs||{};
    COST_FIELDS.forEach(field=>{$(field.input).value=costs[field.column]??"";});
    $("qa-change-reason").value="";
    $("qa-cost-title").textContent=Number(record.cost_version||0)?"Edit unit costs":"Add unit costs";
    showModal("qa-cost-modal");
  }
  async function openCostHistory(record){
    const data=record.record_data||{};
    $("qa-history-record-label").textContent=(record.product_code||data.B||"Product Entry record")+" · "+blockLabel(record.block_key);
    $("qa-history-list").innerHTML='<p class="qa-modal-record">Loading revision history…</p>';
    showModal("qa-history-modal");
    try{
      const payload=await api("/api/co-qa/records/"+encodeURIComponent(record.id)+"/cost-revisions");
      const revisions=payload.revisions||[];
      if(!revisions.length){$("qa-history-list").innerHTML='<p class="qa-modal-record">No cost edits have been recorded yet. The initial cost save is available in the audit trail.</p>';return;}
      $("qa-history-list").innerHTML=revisions.map(item=>{
        const changed=(item.changed_columns||[]).join(", ");
        const values=Object.entries(item.after_data||{}).map(([key,value])=>'<code>'+esc(key)+': '+esc(value??"—")+'</code>').join(" · ");
        return '<article class="qa-history-item"><strong>Version '+esc(item.version)+' · '+esc(new Date(item.changed_at).toLocaleString())+'</strong><p>Changed: '+esc(changed||"—")+'</p><p>'+values+'</p><p>'+esc(item.change_reason||"No change reason supplied")+'</p></article>';
      }).join("");
    }catch(error){$("qa-history-list").innerHTML='<p class="qa-modal-record">'+esc(error.message)+'</p>';}
  }
  async function saveCosts(event){
    event.preventDefault();
    if(!state.selected)return;
    const costs={};
    COST_FIELDS.forEach(field=>{const value=$(field.input).value.trim();costs[field.column]=value===""?null:value;});
    const hasValue=Object.values(costs).some(value=>value!==null);
    if(!hasValue&&!Number(state.selected.cost_version||0)){toast("Enter at least one unit cost before saving.",true);return;}
    const button=$("qa-cost-save");button.disabled=true;button.textContent="Saving…";
    try{
      const result=await api("/api/co-qa/records/"+encodeURIComponent(state.selected.id)+"/costs",{
        method:"PUT",
        body:JSON.stringify({
          expected_version:Number(state.selected.cost_version||0)||null,
          costs,
          change_reason:$("qa-change-reason").value.trim()||null
        })
      });
      hideModal("qa-cost-modal");
      toast(result.changed?"CO QA unit costs saved.":"No cost changes detected.");
      await loadRecords(false);
    }catch(error){toast(error.message,true);}
    finally{button.disabled=false;button.textContent="Save unit costs";}
  }
  function bindEvents(){
    $("qa-open-product-entry").addEventListener("click",openProductEntry);
    $("qa-block-filter").addEventListener("change",()=>loadRecords(false));
    $("qa-date-from").addEventListener("change",()=>loadRecords(false));
    $("qa-date-to").addEventListener("change",()=>loadRecords(false));
    $("qa-search").addEventListener("input",event=>{state.search=event.target.value;renderRecords();});
    $("qa-tbody").addEventListener("click",event=>{
      const button=event.target.closest("button[data-action]");
      if(!button)return;
      const record=state.records.find(item=>item.id===button.dataset.id);
      if(!record)return;
      if(button.dataset.action==="details")openQaDetails(record);
      if(button.dataset.action==="costs")openCostEditor(record);
      if(button.dataset.action==="history")openCostHistory(record);
    });
    $("qa-cost-form").addEventListener("submit",saveCosts);
    document.querySelectorAll("[data-close-details-modal]").forEach(node=>node.addEventListener("click",()=>hideModal("qa-details-modal")));
    document.querySelectorAll("[data-close-cost-modal]").forEach(node=>node.addEventListener("click",()=>hideModal("qa-cost-modal")));
    document.querySelectorAll("[data-close-history-modal]").forEach(node=>node.addEventListener("click",()=>hideModal("qa-history-modal")));
    $("qa-load-more").addEventListener("click",()=>{state.page+=1;loadRecords(true);});
  }

  async function initialize(){
    renderSourceMap();
    bindEvents();
    try{
      const payload=await api("/api/co-qa/catalog");
      state.catalog=payload.catalog;
      state.canCreate=Boolean(payload.permissions?.create);
      state.canEdit=Boolean(payload.permissions?.edit);
      const blocks=payload.product_entry_catalog?.blocks||[];
      state.blocks=new Map(blocks.map(block=>[block.block_key,block]));
      $("qa-block-count").textContent=String(blocks.length);
      $("qa-block-filter").innerHTML='<option value="">All Product Entry blocks</option>'+blocks.map(block=>'<option value="'+esc(block.block_key)+'">'+esc(block.display_title||block.block_key)+'</option>').join("");
      await loadRecords(false);
      document.body.dataset.tfiReady="true";
      document.body.dataset.tfiSourceSheet=state.catalog?.source?.sheet||"co QA";
      document.body.dataset.tfiSourceColumns="38";
      document.body.dataset.tfiNoMock="true";
      document.body.dataset.tfiCostLinkage="product-entry-record-uuid";
    }catch(error){
      setConnection(error.message,"error");
      emptyRow("CO QA connection is not available.",error.message);
      $("qa-table-status").textContent="Unable to connect";
    }
  }
  /* batch4 live focus */ window.addEventListener("focus",()=>{if(Array.from(document.querySelectorAll("[role=dialog]")).some(el=>el.getClientRects().length))return;if(state.catalog)loadRecords(false);});
  initialize();
})();
