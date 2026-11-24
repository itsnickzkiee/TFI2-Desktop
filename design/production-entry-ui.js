(function(){
  "use strict";
  const SOURCE = window.TFI_PRODUCTION_ENTRY_DATA;
  if(!SOURCE)throw new Error("Production Entry source map not loaded.");
  const $ = id => document.getElementById(id);
  const letters = "ABCDEFGHIJKLMNOPQRSTUVW".split("");
  const widths = [105,112,245,145,105,100,105,85,110,105,105,105,125,145,100,90,90,115,85,245,125,110,90];
  const INPUT_COLUMNS = ["A","C","D","E","F","G","H","J","K","L","M","N","O","P","S","T"];
  const HAS_DATA_COLUMNS = ["C","D","F","G","O","P","S","T"];
  const state = {
    catalog:null,
    productNames:SOURCE.productNames||[],
    productCodes:SOURCE.productCodes||{},
    uom:SOURCE.uom||[],
    rows:[],
    backendReady:false,
    canCreate:false,
    floatingHead:null,
    toastTimer:null,
    saving:false
  };
  const esc=value=>String(value??"").replace(/[&<>"']/g,ch=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[ch]));
  function localToday(){
    const d=new Date();
    return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");
  }
  function prettyDate(iso){
    if(!iso)return "SELECT PRODUCTION DATE";
    const d=new Date(iso+"T12:00:00");
    return d.toLocaleDateString("en-US",{weekday:"long",year:"numeric",month:"long",day:"numeric"}).toUpperCase();
  }
  function shortDate(iso){
    if(!iso)return "";
    const d=new Date(iso+"T12:00:00");
    return d.toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"2-digit"});
  }
  function percent(value){
    if(value===null||value===undefined||value==="")return "—";
    const n=Number(value);
    return Number.isFinite(n)?(n*100).toFixed(1)+"%":"—";
  }
  async function api(url,options){
    const response=await fetch(url,Object.assign({
      credentials:"same-origin",cache:"no-store"
    },options||{}));
    let payload={};
    try{payload=await response.json();}catch(_error){}
    if(!response.ok){
      const error=new Error(payload.error||(
        response.status===401||response.status===403
          ?"Your session or Production Entry permission is no longer active. Sign in again or contact the administrator."
          :"TFI2 could not complete the Production Entry request. Try again."
      ));
      error.status=response.status;
      error.code=payload.code||"production_entry_request_failed";
      throw error;
    }
    return payload;
  }
  function showToast(message,error){
    const toast=$("toast");
    toast.textContent=message;
    toast.hidden=false;
    toast.style.background=error?"#8e3028":"#173d29";
    window.clearTimeout(state.toastTimer);
    state.toastTimer=window.setTimeout(()=>toast.hidden=true,4500);
  }
  function setConnection(message,error){
    const status=$("connection-status");
    status.textContent=message;
    status.style.color=error?"#8e3028":"#496d5a";
    status.style.fontWeight="800";
    status.dataset.state=error?"error":"connected";
  }
  function sourceGroups(){
    return state.catalog?.form?.source_groups||SOURCE.groups||[];
  }
  function headerMarkup(){
    const groups=sourceGroups().map(group=>
      '<th class="'+(group.tone==="teal"?"teal":"")+'" colspan="'+(group.end-group.start+1)+'">'+esc(group.title)+'</th>'
    ).join("");
    const headers=(state.catalog?.form?.source_headers||SOURCE.headers).map(label=>
      '<th title="'+esc(label)+'">'+esc(label)+'</th>'
    ).join("");
    $("entry-thead").innerHTML=
      '<tr class="group-row"><th class="rownum"></th>'+groups+'</tr>'+
      '<tr class="column-row"><th class="rownum"></th>'+headers+'</tr>';
  }
  function rowCell(col,rowIndex){
    const label=(state.catalog?.form?.source_headers||SOURCE.headers)[col-1]||letters[col-1];
    const letter=letters[col-1];
    const common=' data-col="'+letter+'" aria-label="'+esc(label+" row "+(rowIndex+1))+'"';
    if(col===1)return '<td class="date-cell" data-col="A"></td>';
    if(col===2){
      const line=state.rows[rowIndex].line;
      const cls=line==="Agri"?"line-agri":line==="Meat"?"line-meat":"line-finishing";
      return '<td class="line-cell '+cls+'" data-col="B">'+esc(line)+'</td>';
    }
    if(col===3){
      return '<td><select class="cell-select product-name"'+common+'><option value=""></option>'+
        state.productNames.map(name=>'<option value="'+esc(name)+'">'+esc(name)+'</option>').join("")+
        '</select></td>';
    }
    if(col===4)return '<td><select class="cell-select product-code"'+common+' disabled><option value=""></option></select></td>';
    if(col===8){
      return '<td><select class="cell-select uom"'+common+'><option value=""></option>'+
        state.uom.map(value=>'<option value="'+esc(value)+'">'+esc(value)+'</option>').join("")+
        '</select></td>';
    }
    if([9,17,18].includes(col))return '<td class="calc-cell" data-col="'+letter+'"><span class="calc-value">—</span></td>';
    if(col===21||col===22)return '<td class="trace-cell" data-col="'+letter+'"></td>';
    if(col===23)return '<td class="calc-cell" data-col="W"><span class="has-data">0</span></td>';
    if([10,11,12,13,14].includes(col))return '<td><input class="cell-input" type="time"'+common+'></td>';
    if([5,6,7,15,16,19].includes(col))return '<td><input class="cell-input" type="number" min="0" step="any"'+common+'></td>';
    return '<td><input class="cell-input" type="text" autocomplete="off"'+common+'></td>';
  }
  function buildRows(){
    const slots=state.catalog?.form?.slots||SOURCE.lines.flatMap(group=>
      Array.from({length:group.count},(_,i)=>({
        source_row_number:group.sourceRows[0]+i,line:group.line,line_slot:i+1
      }))
    );
    state.rows=slots.map(slot=>({
      line:slot.line,
      sourceRow:Number(slot.source_row_number)
    }));
    $("entry-tbody").innerHTML=state.rows.map((row,index)=>
      '<tr data-source-row="'+row.sourceRow+'" data-line="'+esc(row.line)+'">'+
      '<th class="rownum">'+(index+1)+'</th>'+
      letters.map((_,colIndex)=>rowCell(colIndex+1,index)).join("")+
      '</tr>'
    ).join("");
    const body=$("entry-tbody");
    body.addEventListener("change",event=>{
      const name=event.target.closest(".product-name");
      if(name){
        const row=name.closest("tr");
        const code=row.querySelector(".product-code");
        const list=state.productCodes[name.value]||[];
        code.innerHTML='<option value=""></option>'+list.map(value=>
          '<option value="'+esc(value)+'">'+esc(value)+'</option>'
        ).join("");
        code.disabled=!name.value||!list.length;
      }
      updateAll();
    });
    body.addEventListener("input",updateAll);
  }
  function value(row,column){
    const field=row.querySelector('[data-col="'+column+'"]');
    return field?String(field.value??"").trim():"";
  }
  function number(row,column){
    const raw=value(row,column);
    return raw===""?null:Number(raw);
  }
  function updateRow(row){
    const target=number(row,"F"),produced=number(row,"G");
    const manpower=number(row,"O"),present=number(row,"P");
    const attainment=target!==null&&produced!==null&&target>0?produced/target:null;
    const absent=manpower!==null&&present!==null?manpower-present:null;
    const attendance=manpower!==null&&present!==null&&manpower>0?present/manpower:null;
    row.querySelector('[data-col="I"] .calc-value').textContent=percent(attainment);
    row.querySelector('[data-col="Q"] .calc-value').textContent=absent===null?"—":String(absent);
    row.querySelector('[data-col="R"] .calc-value').textContent=percent(attendance);
    const hasData=HAS_DATA_COLUMNS.some(column=>value(row,column)!=="");
    const indicator=row.querySelector('[data-col="W"] .has-data');
    indicator.textContent=hasData?"1":"0";
    indicator.classList.toggle("yes",hasData);
    return {attainment,hasData};
  }
  function updateAll(){
    const date=$("production-date").value;
    const title=prettyDate(date)+"  |  OPENING & CLOSING REPORT";
    $("report-title").textContent=title;
    $("report-day").textContent=title;
    $("entry-tbody").querySelectorAll("tr").forEach(row=>{
      row.querySelector('[data-col="A"]').textContent=shortDate(date);
    });
    const results=Array.from($("entry-tbody").querySelectorAll("tr")).map(updateRow);
    const withData=results.filter(result=>result.hasData).length;
    const valid=results.map(result=>result.attainment).filter(result=>result!==null&&Number.isFinite(result));
    $("rows-in-form").textContent=String(withData);
    $("avg-attainment").textContent=valid.length
      ?percent(valid.reduce((sum,value)=>sum+value,0)/valid.length):"—";
    $("table-status").textContent=withData+" of 12 source rows contain data · incomplete entries are allowed";
    syncFloatingHeader();
  }
  function ensureFloating(){
    if(state.floatingHead)return;
    state.floatingHead=document.createElement("div");
    state.floatingHead.className="floating-sheet-head";
    state.floatingHead.setAttribute("aria-hidden","true");
    document.body.appendChild(state.floatingHead);
  }
  function buildFloating(){
    ensureFloating();
    state.floatingHead.innerHTML="";
    const table=document.createElement("table");
    table.className="entry-table";
    const columns=$("entry-colgroup").cloneNode(true);
    const header=$("entry-thead").cloneNode(true);
    columns.removeAttribute("id");
    header.removeAttribute("id");
    table.append(columns,header);
    state.floatingHead.appendChild(table);
    syncFloatingHeader();
  }
  function syncFloatingHeader(){
    if(!state.floatingHead)return;
    const wrap=$("table-scroll");
    const rect=wrap.getBoundingClientRect();
    const topbar=document.querySelector(".topbar");
    const top=topbar?topbar.getBoundingClientRect().bottom:0;
    const headerHeight=$("entry-thead").getBoundingClientRect().height;
    const visible=rect.top<top&&rect.bottom>top+headerHeight+8;
    state.floatingHead.style.display=visible?"block":"none";
    if(!visible)return;
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
  function readRow(row){
    const recordData={};
    INPUT_COLUMNS.forEach(column=>{
      const current=column==="A"
        ?String($("production-date").value||"").trim()
        :String(row.querySelector('[data-col="'+column+'"]')?.value??"").trim();
      if(current!=="")recordData[column]=current;
    });
    return {
      source_row_number:Number(row.dataset.sourceRow),
      record_data:recordData,
      hasData:HAS_DATA_COLUMNS.some(column=>String(recordData[column]??"").trim()!==""),
      element:row
    };
  }
  function clearRow(row){
    row.querySelectorAll("input").forEach(field=>field.value="");
    row.querySelectorAll("select").forEach(field=>{
      field.value="";
      if(field.classList.contains("product-code")){
        field.innerHTML='<option value=""></option>';
        field.disabled=true;
      }
    });
    row.classList.remove("pe-duplicate-row");
  }
  function updateSummary(summary){
    $("saved-rows").textContent=String(summary.saved_rows??0);
    $("days-saved").textContent=String(summary.days_saved??0);
    $("last-saved").textContent=summary.last_saved
      ?new Date(summary.last_saved).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"2-digit"})
      :"—";
    $("avg-attainment").textContent=percent(summary.avg_attainment);
  }
  async function refreshSummary(){
    const payload=await api("/api/production-entry/summary");
    updateSummary(payload.summary||{});
  }
  function resetForm(){
    $("entry-tbody").querySelectorAll("tr").forEach(clearRow);
    updateAll();
    showToast("Form cleared. The 12 verified source template rows are ready.");
  }
  async function saveForm(){
    if(!state.backendReady||!state.canCreate){
      showToast("Your TFI role does not have Production Entry create permission.",true);
      return;
    }
    if(state.saving)return;
    const rows=Array.from($("entry-tbody").querySelectorAll("tr")).map(readRow);
    const records=rows.filter(row=>row.hasData);
    if(!records.length){
      showToast("Enter at least one source Has data field before saving.",true);
      return;
    }
    state.saving=true;
    const button=$("save-form");
    button.disabled=true;
    button.textContent="SAVING…";
    try{
      const result=await api("/api/production-entry/records",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({records:records.map(({source_row_number,record_data})=>({source_row_number,record_data}))})
      });
      let inserted=0,duplicates=0;
      (result.results||[]).forEach(item=>{
        const entry=records[item.row_index-1];
        if(!entry)return;
        if(item.status==="inserted"){
          inserted++;
          clearRow(entry.element);
        }else if(item.status==="duplicate"){
          duplicates++;
          entry.element.classList.add("pe-duplicate-row");
        }
      });
      if(inserted){
        showToast(inserted+" production run(s) saved to TFI2 Production Summary · "+duplicates+" exact duplicate(s) skipped.");
      }else if(duplicates){
        showToast("No new runs saved. "+duplicates+" exact duplicate(s) were blocked.",true);
      }else{
        showToast("No new production runs were saved.");
      }
      updateAll();
      await refreshSummary();
    }catch(error){
      showToast(error.message,true);
      setConnection("TFI2 CONNECTION ISSUE · SAVE NOT CONFIRMED",true);
    }finally{
      state.saving=false;
      button.disabled=!state.backendReady||!state.canCreate;
      button.textContent="SAVE TO PRODUCTION SUMMARY";
    }
  }
  function openSummary(){
    const message={type:"TFI_NAVIGATE_MODULE",page:"Reports"};
    if(window.parent&&window.parent!==window)window.parent.postMessage(message,"*");
    else window.location.assign("dashboard-preview.html?module=Reports");
  }
  async function initialize(){
    $("production-date").value=localToday();
    $("production-date").addEventListener("change",updateAll);
    $("reset-form").addEventListener("click",resetForm);
    $("save-form").addEventListener("click",saveForm);
    $("view-summary").addEventListener("click",openSummary);
    $("table-scroll").addEventListener("scroll",syncFloatingHeader,{passive:true});
    window.addEventListener("scroll",syncFloatingHeader,{passive:true});
    window.addEventListener("resize",syncFloatingHeader,{passive:true});

    try{
      const [catalogPayload,summaryPayload]=await Promise.all([
        api("/api/production-entry/catalog"),
        api("/api/production-entry/summary")
      ]);
      state.catalog=catalogPayload.catalog;
      state.productNames=state.catalog.product_names||[];
      state.productCodes=state.catalog.product_codes||{};
      state.uom=state.catalog.uom||[];
      state.canCreate=!!catalogPayload.permissions?.create;
      state.backendReady=true;
      setConnection("TFI2 CONNECTED · LIVE PRODUCTION SUMMARY",false);
      $("save-form").disabled=!state.canCreate;
    }catch(error){
      state.backendReady=false;
      state.canCreate=false;
      setConnection("TFI2 UNAVAILABLE · SAVING DISABLED",true);
      $("save-form").disabled=true;
      showToast(error.message,true);
    }

    headerMarkup();
    buildRows();
    const columns=letters.map((letter,index)=>'<col style="width:'+widths[index]+'px">').join("");
    $("entry-colgroup").innerHTML='<col style="width:42px">'+columns;
    buildFloating();
    updateAll();

    if(state.backendReady){
      try{
        await refreshSummary();
      }catch(error){
        setConnection("TFI2 CONNECTED · SUMMARY METRICS UNAVAILABLE",true);
        showToast(error.message,true);
      }
    }else{
      updateSummary({saved_rows:0,days_saved:0,last_saved:null,avg_attainment:null});
    }

    document.body.dataset.tfiReady="true";
    document.body.dataset.tfiDataSource=state.backendReady?"TFI2":"UNAVAILABLE";
    document.body.dataset.tfiRows=String(state.rows.length);
    document.body.dataset.tfiProducts=String(state.productNames.length);
    document.body.dataset.tfiSourceMapping=state.rows.map(row=>row.sourceRow).join(",");
    document.body.dataset.tfiNoMock="true";
    document.body.dataset.tfiCreatePermission=String(state.canCreate);
  }
  function installLiveRecords(){
    let live=false,page=1,more=false,request=0;
    const body=$("entry-tbody"), save=$("save-form"), reset=$("reset-form");
    const draft=document.createDocumentFragment();
    const bar=document.createElement("div");
    bar.style.cssText="display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:10px";
    bar.innerHTML='<button type="button" class="action-btn reset" data-mode>+ NEW ENTRY</button><button type="button" class="action-btn reset" data-prev>Previous</button><button type="button" class="action-btn reset" data-next>Next</button><span role="status" data-status></span>';
    $("table-scroll").before(bar);
    const mode=bar.querySelector("[data-mode]"),prev=bar.querySelector("[data-prev]"),next=bar.querySelector("[data-next]"),status=bar.querySelector("[data-status]");
    async function load(){
      const token=++request;
      prev.disabled=next.disabled=true;status.textContent="Loading records...";
      try{
        const payload=await api("/api/production-entry/records?page="+page+"&page_size=100");
        if(token!==request||!live)return;
        const records=payload.records||[];
        body.innerHTML=records.map((r,i)=>'<tr><th class="rownum">'+((page-1)*100+i+1)+'</th>'+letters.map(k=>'<td style="padding:8px;white-space:normal">'+esc(r.record_data?.[k]??"")+'</td>').join("")+'</tr>').join("")||'<tr><td colspan="24">No saved production records.</td></tr>';
        more=!!payload.has_more;prev.disabled=page<=1;next.disabled=!more;
        status.textContent="Page "+page+" | "+Number(payload.total||0).toLocaleString()+" saved records";
        $("table-status").textContent=status.textContent;
        $("rows-in-form").textContent=String(records.length);
        await refreshSummary();
      }catch(e){if(token===request&&live){body.innerHTML='<tr><td colspan="24">'+esc(e.message)+'</td></tr>';status.textContent=e.message;}}
    }
    function switchMode(toLive){
      if(toLive===live)return;
      live=toLive;++request;
      if(live){while(body.firstChild)draft.appendChild(body.firstChild);save.hidden=reset.hidden=true;save.style.display=reset.style.display="none";$("production-date").disabled=true;mode.textContent="+ NEW ENTRY";prev.hidden=next.hidden=false;page=1;load();}
      else{body.replaceChildren(draft);save.hidden=reset.hidden=false;save.style.display=reset.style.display="";$("production-date").disabled=false;mode.textContent="BACK TO RECORDS";prev.hidden=next.hidden=true;status.textContent="Manual entry";updateAll();}
    }
    mode.onclick=()=>{if(!live||state.canCreate)switchMode(!live);};
    prev.onclick=()=>{if(live&&page>1){page--;load();}};
    next.onclick=()=>{if(live&&more){page++;load();}};
    window.addEventListener("focus",()=>{if(live)load();});
    switchMode(true);
  }
  initialize().then(()=>{if(state.backendReady)installLiveRecords();});
})();