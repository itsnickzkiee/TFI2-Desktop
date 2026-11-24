(function(){
  "use strict";

  const $=id=>document.getElementById(id);
  const SOURCE_ROWS=Array.from({length:10},(_,i)=>i+8);
  const EDITABLE_FIELDS=[
    ["B","productName"],["C","code"],["D","batches"],["E","line"],["F","area"],
    ["G","pr"],["K","revised"],["L","um"],["M","qtyTins"],["O","fcidc"],
    ["P","remarks"],["R","availablePax"]
  ];
  const state={
    catalog:null,productByCode:{},rows:[],formId:null,version:null,
    canCreate:false,canEdit:false,backendReady:false,loading:false,saving:false,
    dirty:false,lastLoadedDate:"",toastTimer:null,requestId:0,summary:{}
  };

  const esc=value=>String(value??"").replace(/[&<>"']/g,ch=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[ch]));
  const num=value=>{
    if(value===null||value===undefined||String(value).trim()==="")return null;
    const result=Number(String(value).replace(/,/g,""));
    return Number.isFinite(result)?result:null;
  };
  const fmt=value=>value===null||value===undefined||!Number.isFinite(Number(value))
    ?"—":Number(value).toLocaleString("en-US",{maximumFractionDigits:2});
  function localToday(){
    const d=new Date();
    return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");
  }
  function isoWeek(iso){
    if(!iso)return "";
    const d=new Date(iso+"T00:00:00Z");
    if(Number.isNaN(d.getTime()))return "";
    d.setUTCDate(d.getUTCDate()+4-(d.getUTCDay()||7));
    const yearStart=new Date(Date.UTC(d.getUTCFullYear(),0,1));
    return Math.ceil((((d-yearStart)/86400000)+1)/7);
  }
  function longDate(iso){
    return iso?new Date(iso+"T12:00:00").toLocaleDateString("en-US",{
      weekday:"long",year:"numeric",month:"long",day:"numeric"
    }).toUpperCase():"SELECT A DATE";
  }
  function shortDate(iso){
    return iso?new Date(iso+"T12:00:00").toLocaleDateString("en-US",{
      month:"short",day:"numeric",year:"numeric"
    }):"";
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
          ?"Your session or Production Schedule permission is not active. Sign in again or contact the administrator."
          :"TFI2 could not complete the Production Schedule request. Try again."
      ));
      error.status=response.status;
      error.code=payload.code||"production_schedule_request_failed";
      throw error;
    }
    return payload;
  }
  function toast(message,error){
    const el=$("toast");
    el.textContent=message;
    el.hidden=false;
    el.style.background=error?"#8e3028":"#173d29";
    window.clearTimeout(state.toastTimer);
    state.toastTimer=window.setTimeout(()=>el.hidden=true,4200);
  }
  function setConnection(message,error){
    const el=$("connection-status");
    el.textContent=message;
    el.style.color=error?"#ffd2cc":"#a0e3d9";
    el.dataset.state=error?"error":"connected";
  }
  function setFormStatus(message,error){
    $("table-status").textContent=message;
    $("table-status").style.color=error?"#8e3028":"#77857c";
  }
  function optionsMarkup(values,selected){
    return '<option value=""></option>'+(values||[]).map(value=>
      '<option value="'+esc(value)+'"'+(String(value)===String(selected??"")?" selected":"")+'>'+esc(value)+'</option>'
    ).join("");
  }
  function rowHtml(index,sourceRow){
    const catalog=state.catalog;
    const groups=catalog?.product_groups||[];
    const lines=catalog?.line_options||[];
    const areas=catalog?.area_options||[];
    const uom=catalog?.uom||[];
    return '<tr data-row="'+index+'" data-source-row="'+sourceRow+'">'+
      '<th class="rownum">'+(index+1)+'</th>'+
      '<td class="date-cell" data-field="date"></td>'+
      '<td><select class="cell-select" data-field="productName" aria-label="Product name row '+(index+1)+'">'+optionsMarkup(groups)+'</select></td>'+
      '<td><select class="cell-select" data-field="code" aria-label="Production code row '+(index+1)+'" disabled><option value=""></option></select></td>'+
      '<td><input class="cell-input" data-field="batches" type="number" min="0" step="any" aria-label="Number of batches row '+(index+1)+'"></td>'+
      '<td><select class="cell-select" data-field="line" aria-label="Line row '+(index+1)+'">'+optionsMarkup(lines)+'</select></td>'+
      '<td><select class="cell-select" data-field="area" aria-label="Area row '+(index+1)+'">'+optionsMarkup(areas)+'</select></td>'+
      '<td><input class="cell-input" data-field="pr" type="text" maxlength="120" aria-label="PR number row '+(index+1)+'"></td>'+
      '<td class="calc-cell" data-field="canSize"><span class="calc-value">—</span></td>'+
      '<td class="calc-cell" data-field="shift"><span class="calc-value">—</span></td>'+
      '<td class="calc-cell" data-field="target"><span class="calc-value">—</span></td>'+
      '<td><input class="cell-input" data-field="revised" type="number" min="0" step="any" aria-label="Revised target row '+(index+1)+'"></td>'+
      '<td><select class="cell-select" data-field="um" aria-label="Unit of measure row '+(index+1)+'">'+optionsMarkup(uom)+'</select></td>'+
      '<td><input class="cell-input" data-field="qtyTins" type="number" min="0" step="any" aria-label="Quantity tins or ends row '+(index+1)+'"></td>'+
      '<td class="calc-cell" data-field="qtyBox"><span class="calc-value">—</span></td>'+
      '<td><input class="cell-input" data-field="fcidc" type="text" maxlength="120" aria-label="FC IDC reference row '+(index+1)+'"></td>'+
      '<td><input class="cell-input" data-field="remarks" type="text" maxlength="1000" aria-label="Remarks row '+(index+1)+'"></td>'+
      '<td class="calc-cell" data-field="requiredPax"><span class="calc-value">—</span></td>'+
      '<td><input class="cell-input" data-field="availablePax" type="number" min="0" step="any" aria-label="Available pax row '+(index+1)+'"></td>'+
    '</tr>';
  }
  function buildRows(){
    $("schedule-body").innerHTML=SOURCE_ROWS.map((sourceRow,index)=>rowHtml(index,sourceRow)).join("");
    state.rows=Array.from($("schedule-body").querySelectorAll("tr"));
    const body=$("schedule-body");
    body.addEventListener("input",event=>{
      if(state.loading)return;
      state.dirty=true;
      updateAll();
    });
    body.addEventListener("change",event=>{
      if(state.loading)return;
      const row=event.target.closest("tr");
      if(!row)return;
      if(event.target.dataset.field==="productName"){
        const group=event.target.value;
        const code=get(row,"code");
        const codes=state.catalog?.group_codes?.[group]||[];
        code.innerHTML=optionsMarkup(codes);
        code.disabled=!codes.length;
        code.value="";
      }
      state.dirty=true;
      updateAll();
    });
    $("available-total").addEventListener("input",()=>{
      if(state.loading)return;
      state.dirty=true;
      updateAll();
    });
  }
  function get(row,field){return row.querySelector('[data-field="'+field+'"]');}
  function value(row,field){return String(get(row,field)?.value??"").trim();}
  function write(row,field,val){
    const el=get(row,field);
    if(el)el.textContent=val===null||val===undefined||val===""?"—":String(val);
  }
  function productFor(row){return state.productByCode[value(row,"code")]||null;}
  function updateRow(row){
    const product=productFor(row);
    const output=num(product?.output_per_hour);
    const shift=num(product?.default_shift);
    const shiftHours=shift!==null&&shift>0?shift:12;
    const target=output!==null?Math.round(output*shiftHours):null;
    const quantity=num(value(row,"qtyTins"));
    const caseCount=num(product?.case_count);
    const boxes=quantity!==null&&caseCount!==null&&caseCount>0
      ?Math.round(quantity/caseCount):null;
    const manpower=num(product?.manpower);
    write(row,"date",shortDate($("schedule-date").value));
    write(row,"canSize",product?.can_size||"—");
    write(row,"shift",product?fmt(shiftHours):"—");
    write(row,"target",target===null?"—":fmt(target));
    write(row,"qtyBox",boxes===null?"—":fmt(boxes));
    write(row,"requiredPax",manpower===null?"—":fmt(manpower));
    const populated=!!value(row,"code");
    row.dataset.hasData=populated?"1":"0";
    return {
      populated,target,quantity,boxes,
      revised:num(value(row,"revised")),
      required:manpower,
      available:num(value(row,"availablePax"))
    };
  }
  function updateAll(){
    const date=$("schedule-date").value;
    $("date-title").textContent=date?longDate(date)+"   |   WEEK "+isoWeek(date):"SELECT A DATE";
    $("schedule-day").textContent=date?longDate(date)+"   |   WEEK "+isoWeek(date):"SELECT A DATE";
    const totals=state.rows.map(updateRow);
    const sum=key=>totals.reduce((total,row)=>total+(row[key]===null?0:Number(row[key])||0),0);
    const entries=totals.filter(row=>row.populated).length;
    const required=sum("required");
    const availableTotal=num($("available-total").value);
    $("entry-count").textContent=String(entries);
    $("target-total").textContent=fmt(sum("target"));
    $("qty-tins").textContent=fmt(sum("quantity"));
    $("qty-box").textContent=fmt(sum("boxes"));
    $("revised-total").textContent=fmt(sum("revised"));
    $("total-required").textContent=fmt(required);
    $("manpower-adjustment").textContent=availableTotal===null?"—":fmt(availableTotal-required);
    if(!state.formId&&!state.dirty){
      setFormStatus(entries+" of 10 source rows contain data · new daily schedule · not yet saved");
    }else if(state.dirty){
      setFormStatus(entries+" of 10 source rows contain data · unsaved changes");
    }else{
      setFormStatus(entries+" of 10 source rows contain data · saved form version "+state.version);
    }
    document.body.dataset.tfiEntries=String(entries);
  }
  function clearForm(){
    state.loading=true;
    state.rows.forEach(row=>{
      row.querySelectorAll("input,select").forEach(el=>el.value="");
      const code=get(row,"code");
      code.innerHTML='<option value=""></option>';
      code.disabled=true;
      row.classList.remove("pe-duplicate-row");
    });
    $("available-total").value="";
    state.loading=false;
    updateAll();
  }
  function populateForm(form){
    state.loading=true;
    clearForm();
    const formData=form.form_data||{};
    $("available-total").value=form.available_pax_total??formData.available_pax_total??"";
    (formData.rows||[]).forEach(item=>{
      const sourceRow=Number(item.source_row_number);
      const row=state.rows.find(entry=>Number(entry.dataset.sourceRow)===sourceRow);
      if(!row)return;
      const data=item.record_data||{};
      const group=String(data.B??"");
      const productCode=String(data.C??"");
      const groupSelect=get(row,"productName");
      groupSelect.value=group;
      const codes=state.catalog?.group_codes?.[group]||[];
      const codeSelect=get(row,"code");
      codeSelect.innerHTML=optionsMarkup(codes,productCode);
      codeSelect.disabled=!codes.length;
      EDITABLE_FIELDS.forEach(([column,field])=>{
        if(column==="B"||column==="C")return;
        const control=get(row,field);
        if(control)control.value=data[column]??"";
      });
    });
    state.loading=false;
    state.formId=form.id;
    state.version=Number(form.version||1);
    state.dirty=false;
    updateSaveButton();
    updateAll();
  }
  function updateSaveButton(){
    const button=$("save-form");
    if(state.formId){
      button.textContent="UPDATE SCHEDULE SUMMARY";
      button.disabled=!state.backendReady||!state.canEdit||state.saving;
    }else{
      button.textContent="SAVE TO SCHEDULE SUMMARY";
      button.disabled=!state.backendReady||!state.canCreate||state.saving;
    }
  }
  async function loadFormForDate(date){
    if(!state.backendReady||!date)return;
    const requestId=++state.requestId;
    state.loading=true;
    $("schedule-date").disabled=true;
    $("reset-form").disabled=true;
    setFormStatus("Checking TFI2 for a saved schedule on "+date+"…");
    try{
      const payload=await api("/api/production-schedule/forms?date="+encodeURIComponent(date));
      if(requestId!==state.requestId)return;
      state.formId=null;
      state.version=null;
      if(payload.form){
        populateForm(payload.form);
        setFormStatus("Saved daily schedule loaded · version "+state.version+" · last updated "+new Date(payload.form.updated_at).toLocaleString());
      }else{
        clearForm();
        state.dirty=false;
        updateSaveButton();
        setFormStatus("New daily schedule · no saved form exists for this date");
      }
      state.lastLoadedDate=date;
    }catch(error){
      if(requestId!==state.requestId)return;
      clearForm();
      state.formId=null;
      state.version=null;
      updateSaveButton();
      setFormStatus(error.message,true);
      toast(error.message,true);
    }finally{
      state.loading=false;
      $("schedule-date").disabled=false;
      $("reset-form").disabled=false;
      updateSaveButton();
      updateAll();
    }
  }
  function readForm(){
    const rows=state.rows.map(row=>{
      const recordData={};
      EDITABLE_FIELDS.forEach(([column,field])=>{
        const raw=value(row,field);
        if(raw!=="")recordData[column]=raw;
      });
      return {
        source_row_number:Number(row.dataset.sourceRow),
        record_data:recordData
      };
    });
    return {
      production_date:$("schedule-date").value,
      available_pax_total:$("available-total").value||null,
      rows
    };
  }
  async function refreshSummary(){
    const payload=await api("/api/production-schedule/summary");
    state.summary=payload.summary||{};
    document.body.dataset.tfiSavedRows=String(state.summary.saved_rows??0);
    document.body.dataset.tfiSavedDays=String(state.summary.days_saved??0);
  }
  async function saveForm(){
    if(state.saving||!state.backendReady)return;
    if(state.formId&&!state.canEdit){
      toast("Your TFI role does not have Production Schedule edit permission.",true);
      return;
    }
    if(!state.formId&&!state.canCreate){
      toast("Your TFI role does not have Production Schedule create permission.",true);
      return;
    }
    const body=readForm();
    if(!body.production_date){
      toast("Choose a production date before saving.",true);
      return;
    }
    state.saving=true;
    updateSaveButton();
    $("save-form").textContent="SAVING…";
    try{
      let result;
      if(state.formId){
        result=await api("/api/production-schedule/forms/"+encodeURIComponent(state.formId),{
          method:"PATCH",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify(Object.assign({},body,{
            expected_version:state.version,
            change_reason:"Updated through Production Schedule"
          }))
        });
      }else{
        result=await api("/api/production-schedule/forms",{
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify(body)
        });
      }
      state.formId=result.id||state.formId;
      state.version=Number(result.version||state.version||1);
      state.dirty=false;
      await refreshSummary();
      updateSaveButton();
      updateAll();
      setFormStatus("Saved to TFI2 Schedule Summary · version "+state.version+" · "+(result.entry_count??body.rows.length)+" source row(s)");
      toast(state.version>1?"Schedule updated. Revision history has been recorded.":"Daily Production Schedule saved to TFI2 Schedule Summary.");
    }catch(error){
      if(error.status===409&&error.code==="production_schedule_duplicate_date"){
        await loadFormForDate(body.production_date);
      }
      setFormStatus(error.message,true);
      toast(error.message,true);
    }finally{
      state.saving=false;
      updateSaveButton();
    }
  }
  async function resetForm(){
    const date=$("schedule-date").value;
    if(state.formId){
      await loadFormForDate(date);
      toast("The saved schedule has been reloaded; no saved data was deleted.");
      return;
    }
    clearForm();
    state.dirty=false;
    updateSaveButton();
    toast("The unsaved form has been cleared.");
  }
  async function onDateChange(){
    const nextDate=$("schedule-date").value;
    if(state.dirty&&!window.confirm("Discard unsaved changes and load the selected date?")){
      $("schedule-date").value=state.lastLoadedDate||localToday();
      updateAll();
      return;
    }
    state.formId=null;
    state.version=null;
    state.dirty=false;
    await loadFormForDate(nextDate);
  }
  function openSummary(){
    const message={type:"TFI_NAVIGATE_MODULE",page:"Schedule Summary"};
    if(window.parent&&window.parent!==window)window.parent.postMessage(message,"*");
    else window.location.assign("schedule-summary-preview.html");
  }
  async function initialize(){
    $("schedule-date").value=localToday();
    $("schedule-date").addEventListener("change",onDateChange);
    $("reset-form").addEventListener("click",resetForm);
    $("save-form").addEventListener("click",saveForm);
    $("view-summary").addEventListener("click",openSummary);
    $("schedule-date").disabled=true;
    $("save-form").disabled=true;
    $("reset-form").disabled=true;
    setConnection("CONNECTING TO TFI2 · LIVE PRODUCT STANDARD",false);
    try{
      const [catalogPayload,summaryPayload]=await Promise.all([
        api("/api/production-schedule/catalog"),
        api("/api/production-schedule/summary")
      ]);
      state.catalog=catalogPayload.catalog;
      state.canCreate=!!catalogPayload.permissions?.create;
      state.canEdit=!!catalogPayload.permissions?.edit;
      state.backendReady=true;
      state.productByCode=Object.fromEntries(
        (state.catalog.products||[]).map(product=>[product.code,product])
      );
      buildRows();
      state.summary=summaryPayload.summary||{};
      setConnection("TFI2 CONNECTED · 43 PRODUCT GROUPS · 100 PRODUCT VARIANTS",false);
      $("schedule-date").disabled=false;
      $("reset-form").disabled=false;
      updateSaveButton();
      /* batch1 historical default */
      try{
        const recent=await api("/api/production-schedule/records?page=1&page_size=1&sort=date&direction=desc");
        const latest=String(recent.records?.[0]?.date||"").slice(0,10);
        if(/^\d{4}-\d{2}-\d{2}$/.test(latest))$("schedule-date").value=latest;
      }catch(error){toast("Historical schedule lookup: "+error.message,true);}
      await loadFormForDate($("schedule-date").value);
    }catch(error){
      state.backendReady=false;
      setConnection("TFI2 UNAVAILABLE · SAVING DISABLED",true);
      $("schedule-date").disabled=false;
      $("reset-form").disabled=false;
      $("schedule-body").innerHTML=SOURCE_ROWS.map((sourceRow,index)=>
        '<tr data-source-row="'+sourceRow+'"><th class="rownum">'+(index+1)+'</th><td colspan="18" class="calc-cell">TFI2 reference catalog unavailable. Reconnect before entering or saving a schedule.</td></tr>'
      ).join("");
      updateSaveButton();
      setFormStatus(error.message,true);
      toast(error.message,true);
    }
    document.body.dataset.tfiReady="true";
    document.body.dataset.tfiDataSource=state.backendReady?"TFI2":"UNAVAILABLE";
    document.body.dataset.tfiRows=String(SOURCE_ROWS.length);
    document.body.dataset.tfiProducts=String(state.catalog?.products?.length||0);
    document.body.dataset.tfiGroups=String(state.catalog?.product_groups?.length||0);
    document.body.dataset.tfiNoMock="true";
    document.body.dataset.tfiSourceRange=state.catalog?.source?.production_schedule?.source_range||"Production Schedule!A1:U19";
  }
  initialize();
})();