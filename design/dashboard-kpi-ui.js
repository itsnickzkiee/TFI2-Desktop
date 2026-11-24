/* TFI KPI Dashboard — Phase 7A/7B live TFI2 coverage and shell interactions.
   KPI calculations remain intentionally blank until Phase 7C validates their rules. */
(function(){
 const $=id=>document.getElementById(id);
 const tabs=[...document.querySelectorAll("[data-kpi-tab]")];
 const panels=[...document.querySelectorAll("[data-kpi-panel]")];
 const toast=$("toast");
 let toastTimer=null;

 function showToast(message){
  if(!toast)return;
  toast.textContent=message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>toast.classList.remove("show"),2600);
 }

 function setText(id,value){
  const element=$(id);
  if(element)element.textContent=String(value);
 }

 function setStatus(label,state){
  const element=$("kpi-data-status");
  if(!element)return;
  const dot=element.querySelector("span")||document.createElement("span");
  element.replaceChildren(dot,document.createTextNode(label));
  element.dataset.state=state;
 }

 function renderCoverageModules(modules){
  const list=$("kpi-live-module-list");
  if(!list)return;
  list.replaceChildren();
  const active=(Array.isArray(modules)?modules:[]).filter(item=>Number(item.record_count)>0);
  active.forEach(item=>{
   const row=document.createElement("div");
   row.className="kpi-live-module-row";
   const label=document.createElement("span");
   label.textContent=item.label||item.module_key||"Operational module";
   const count=document.createElement("strong");
   count.textContent=new Intl.NumberFormat().format(Number(item.record_count)||0);
   row.append(label,count);
   list.append(row);
  });
  list.hidden=active.length===0;
 }

 async function loadDashboardCoverage(){
  setStatus("Connecting to TFI2","loading");
  try{
   const response=await fetch("/api/dashboard/coverage",{
    method:"GET",
    credentials:"same-origin",
    cache:"no-store",
    headers:{Accept:"application/json"}
   });
   const payload=await response.json().catch(()=>({}));
   if(!response.ok){
    const message=payload.error||"Dashboard coverage is not available for this account.";
    throw new Error(message);
   }

   const total=Number(payload.total_operational_records)||0;
   const visible=Number(payload.visible_module_count)||0;
   const populated=Number(payload.modules_with_records)||0;
   const imports=payload.imports&&typeof payload.imports==="object"?payload.imports:null;
   const audit=payload.audit_events;

   setStatus(total>0?"TFI2 connected · Live records available":"TFI2 connected · Awaiting records",total>0?"connected":"empty");
   setText("kpi-live-source","TFI2 · LIVE");
   setText("kpi-live-total-records",new Intl.NumberFormat().format(total));
   setText("kpi-live-modules-with-records",visible?populated+" / "+visible:"—");
   setText("kpi-live-import-review",imports?new Intl.NumberFormat().format(Number(imports.batches_in_review)||0):"—");
   setText("kpi-live-audit-events",audit===null||audit===undefined?"—":new Intl.NumberFormat().format(Number(audit)||0));

   const checked=Number(payload.checked_at);
   const checkedText=Number.isFinite(checked)&&checked>0?new Date(checked*1000).toLocaleString():"just now";
   setText("kpi-live-caption",populated+" of "+visible+" visible modules contain active saved records · Checked "+checkedText);
   renderCoverageModules(payload.modules);

   if(total>0){
    setText("kpi-data-notice-title","TFI2 is connected. Live operational records are available.");
    setText("kpi-data-notice-copy","The dashboard is reading active records from modules you can view. KPI values, charts, and filters remain blank until Phase 7C verifies each calculation rule and source mapping.");
   }else{
    setText("kpi-data-notice-title","TFI2 is connected, but no active operational records are saved yet.");
    setText("kpi-data-notice-copy","The dashboard is reading TFI2 successfully. KPI values, charts, and filters remain blank until eligible operational records exist and Phase 7C verifies each calculation rule. No spreadsheet display values or sample metrics are used.");
   }
  }catch(error){
   setStatus("TFI2 data unavailable","error");
   setText("kpi-live-source","TFI2 · UNAVAILABLE");
   setText("kpi-live-caption",error.message||"Could not load live dashboard coverage.");
   setText("kpi-data-notice-title","Live dashboard data could not be loaded.");
   setText("kpi-data-notice-copy",error.message||"Check the TFI2 connection and your Dashboard view permission. KPI values remain blank.");
  }
 }

 let dashboardFilterCatalog=null;
 let dashboardFilterCatalogFetched=false;
 const dashboardFilterIds={
  year:"kpi-filter-year",view:"kpi-filter-view",month:"kpi-filter-month",week:"kpi-filter-week",
  date:"kpi-filter-date",product_name:"kpi-filter-product",product_code:"kpi-filter-code",machine:"kpi-filter-machine"
 };
 function localIsoDate(value){
  const year=value.getFullYear(),month=String(value.getMonth()+1).padStart(2,"0"),day=String(value.getDate()).padStart(2,"0");
  return year+"-"+month+"-"+day;
 }
 function isoWeekNumber(value){
  const date=new Date(Date.UTC(value.getFullYear(),value.getMonth(),value.getDate()));
  const day=date.getUTCDay()||7;
  date.setUTCDate(date.getUTCDate()+4-day);
  const yearStart=new Date(Date.UTC(date.getUTCFullYear(),0,1));
  return String(Math.ceil((((date-yearStart)/86400000)+1)/7));
 }
 function populateFilterSelect(id,values,selected){
  const element=$(id);
  if(!element)return;
  const options=Array.isArray(values)?values:[];
  element.replaceChildren();
  options.forEach(value=>{
   const option=document.createElement("option");
   option.value=String(value);
   option.textContent=String(value);
   element.append(option);
  });
  element.disabled=options.length===0;
  if(selected!==undefined&&selected!==null&&options.some(value=>String(value)===String(selected))){
   element.value=String(selected);
  }else if(options.length){
   element.selectedIndex=0;
  }
 }
 function setFilterMode(){
  const view=$(dashboardFilterIds.view)?.value||"";
  const month=$(dashboardFilterIds.month),week=$(dashboardFilterIds.week),day=$(dashboardFilterIds.date);
  if(month)month.disabled=view!=="Monthly";
  if(week)week.disabled=view!=="Weekly";
  if(day)day.disabled=view!=="Daily"||!dashboardFilterCatalog;
 }
 function updateProductFilterStatus(){
  const status=$("kpi-filter-status");
  if(!status)return;
  const code=$(dashboardFilterIds.product_code)?.value||"All";
  const name=$(dashboardFilterIds.product_name)?.value||"All";
  const mapped=dashboardFilterCatalog?.product_map?.[code];
  if(code!=="All"&&name!=="All"&&mapped&&mapped!==name){
   status.textContent="Warning: this Product Code is not mapped to the selected Product Name.";
   status.dataset.state="warning";
   return;
  }
  status.textContent="Source options loaded from TFI2 Master Data. Daily, Weekly, and Monthly views use the source workbook period rules.";
  status.dataset.state="ready";
 }
 async function loadDashboardFilterCatalog(){
  const status=$("kpi-filter-status");
  const apply=$("kpi-analytics-refresh");
  if(status){status.textContent="Loading source filters from TFI2…";status.dataset.state="loading";}
  try{
   const response=await fetch("/api/dashboard/filter-catalog",{
    method:"GET",credentials:"same-origin",cache:"no-store",headers:{Accept:"application/json"}
   });
   const payload=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(payload.error||"Dashboard filter options are unavailable.");
   if(payload.status!=="available"){
    dashboardFilterCatalog=null;
    dashboardFilterCatalogFetched=true;
    Object.values(dashboardFilterIds).forEach(id=>{
     const element=$(id);
     if(element)element.disabled=true;
    });
    if(apply)apply.disabled=true;
    if(status){status.textContent=payload.message||"Dashboard filter lists are restricted for this account.";status.dataset.state="restricted";}
    return;
   }
   const previous={};
   Object.entries(dashboardFilterIds).forEach(([key,id])=>{previous[key]=$(id)?.value||"";});
   dashboardFilterCatalog=payload;
   dashboardFilterCatalogFetched=true;
   const options=payload.options||{};
   const now=new Date();
   const currentYear=String(now.getFullYear());
   const currentMonth=new Intl.DateTimeFormat("en",{month:"short"}).format(now);
   const defaults={
    year:options.year?.includes(currentYear)?currentYear:(options.year||[]).slice(-1)[0],
    view:(options.view||[]).includes("Monthly")?"Monthly":(options.view||[])[0],
    month:(options.month||[]).includes(currentMonth)?currentMonth:(options.month||[])[0],
    week:(options.week||[]).includes(isoWeekNumber(now))?isoWeekNumber(now):(options.week||[])[0],
    date:localIsoDate(now),product_name:"All",product_code:"All",machine:"All"
   };
   Object.entries(dashboardFilterIds).forEach(([key,id])=>{
    if(key==="date"){
     const element=$(id);
     if(element){
      if(!element.value)element.value=defaults.date;
      element.disabled=false;
     }
     return;
    }
    const values=options[key]||[];
    const selected=values.some(value=>String(value)===previous[key])?previous[key]:defaults[key];
    populateFilterSelect(id,values,selected);
   });
   if(apply)apply.disabled=false;
   setFilterMode();
   updateProductFilterStatus();
  }catch(error){
   dashboardFilterCatalog=null;
   dashboardFilterCatalogFetched=false;
   Object.values(dashboardFilterIds).forEach(id=>{const element=$(id);if(element)element.disabled=true;});
   if(apply)apply.disabled=true;
   if(status){status.textContent=error.message||"Could not load dashboard filter options.";status.dataset.state="error";}
  }
 }
 function syncDashboardDateRange(showError){
  const year=Number($(dashboardFilterIds.year)?.value);
  const view=$(dashboardFilterIds.view)?.value||"";
  if(!Number.isInteger(year)||year<1900||year>2200){
   if(showError)showToast("Choose a valid dashboard year.");
   return false;
  }
  let start=null,end=null;
  if(view==="Daily"){
   const selected=$(dashboardFilterIds.date)?.value||"";
   if(!/^\d{4}-\d{2}-\d{2}$/.test(selected)){
    if(showError)showToast("Choose a date for the Daily view.");
    return false;
   }
   if(Number(selected.slice(0,4))!==year){
    if(showError)showToast("The selected date must belong to the chosen year.");
    return false;
   }
   start=end=selected;
  }else if(view==="Weekly"){
   const week=Number($(dashboardFilterIds.week)?.value);
   if(!Number.isInteger(week)||week<1||week>53){
    if(showError)showToast("Choose a valid week number.");
    return false;
   }
   const jan4=new Date(Date.UTC(year,0,4));
   const weekday=(jan4.getUTCDay()+6)%7;
   const monday=new Date(Date.UTC(year,0,4-weekday+7*(week-1)));
   const sunday=new Date(monday);
   sunday.setUTCDate(monday.getUTCDate()+6);
   start=localIsoDate(new Date(monday.getUTCFullYear(),monday.getUTCMonth(),monday.getUTCDate()));
   end=localIsoDate(new Date(sunday.getUTCFullYear(),sunday.getUTCMonth(),sunday.getUTCDate()));
  }else if(view==="Monthly"){
   const monthName=$(dashboardFilterIds.month)?.value||"";
   const monthIndex=new Date(Date.parse(monthName+" 1, 2000")).getMonth();
   if(!Number.isInteger(monthIndex)||!monthName){
    if(showError)showToast("Choose a month for the Monthly view.");
    return false;
   }
   start=localIsoDate(new Date(year,monthIndex,1));
   end=localIsoDate(new Date(year,monthIndex+1,0));
  }else{
   if(showError)showToast("Choose Daily, Weekly, or Monthly view.");
   return false;
  }
  $("kpi-analytics-date-from").value=start;
  $("kpi-analytics-date-to").value=end;
  return true;
 }

 function formatNumber(value,digits=2){
  const number=Number(value);
  if(!Number.isFinite(number))return "—";
  return new Intl.NumberFormat(undefined,{maximumFractionDigits:digits}).format(number);
 }

 function formatPercent(value){
  const number=Number(value);
  if(!Number.isFinite(number))return "—";
  return formatNumber(number*100,2)+"%";
 }

 function updateKpiCard(labelPrefix,value,foot,state){
  const card=[...document.querySelectorAll(".kpi-stat-card")].find(item=>
   (item.querySelector(".kpi-stat-label")?.textContent||"").trim().startsWith(labelPrefix)
  );
  if(!card)return;
  const valueNode=card.querySelector(".kpi-stat-value");
  const footNode=card.querySelector(".kpi-stat-foot");
  if(valueNode)valueNode.textContent=value;
  if(footNode)footNode.textContent=foot;
  card.dataset.state=state||"empty";
 }


 let yieldRecords=[];
 let yieldOffset=0;
 let yieldHasMore=false;
 let yieldLoading=false;
 const yieldPageSize=100;

 function yieldAverage(key){
  const values=yieldRecords.map(record=>record[key]).filter(value=>value!==null&&value!==undefined&&value!==""&&Number.isFinite(Number(value))).map(Number);
  return values.length?values.reduce((sum,value)=>sum+value,0)/values.length:null;
 }
 function yieldPercent(value){return value===null||value===undefined?"—":formatPercent(value);}
 function yieldNumber(value,digits=2){return value===null||value===undefined?"—":formatNumber(value,digits);}
 function yieldSetValue(id,value){setText(id,value);}
 function yieldMakeCell(row,value){
  const cell=document.createElement("td");
  cell.textContent=value===null||value===undefined||value===""?"—":String(value);
  row.append(cell);
 }
 function renderYieldTables(){
  const records=yieldRecords;
  const validCount=records.length;
  const main=yieldAverage("main_yield");
  const stage2=yieldAverage("stage2_yield");
  const stage3=yieldAverage("stage3_yield");
  const bloom=yieldAverage("bloom_rate");
  const lid=yieldAverage("lid_reject");
  const can=yieldAverage("can_reject");
  const box=yieldAverage("box_reject");
  const label=yieldAverage("label_reject");
  const foot=validCount?"Average of "+formatNumber(validCount,0)+" loaded Yield Log rows"+(yieldHasMore?" · load more for earlier rows":""):"No eligible Yield Log rows in selected period";
  yieldSetValue("yield-average-main",yieldPercent(main));
  yieldSetValue("yield-average-stage2",yieldPercent(stage2));
  yieldSetValue("yield-average-stage3",yieldPercent(stage3));
  yieldSetValue("yield-average-bloom",bloom===null?"—":yieldNumber(bloom)+"x");
  yieldSetValue("yield-average-lid",yieldPercent(lid));
  yieldSetValue("yield-average-can",yieldPercent(can));
  yieldSetValue("yield-average-box",yieldPercent(box));
  yieldSetValue("yield-average-label",yieldPercent(label));
  ["main","stage2","stage3"].forEach(key=>yieldSetValue("yield-average-"+key+"-foot",foot));
  yieldSetValue("yield-average-bloom-foot",foot);
  if (!periodYieldActive) {
   updateKpiCard("AVG % YIELD",yieldPercent(main),validCount?"Yield Log · "+formatNumber(validCount,0)+" loaded rows":"No eligible Yield Log rows",validCount?"verified":"empty");
  }

  const scoreGroups=new Map();
  records.forEach(record=>{
   const key=String(record.product_key||record.product_name||"Unknown product");
   if(!scoreGroups.has(key))scoreGroups.set(key,{name:record.product_name||key,fg:0,fgCount:0,rows:[]});
   const group=scoreGroups.get(key);
   const fg=record.total_fg_tins==null||record.total_fg_tins===""?NaN:Number(record.total_fg_tins);
   if(Number.isFinite(fg)){group.fg+=fg;group.fgCount++;}
   group.rows.push(record);
  });
  const scoreRows=[...scoreGroups.values()].sort((left,right)=>right.fg-left.fg);
  const scoreBody=$("yield-scorecard-rows");
  if(scoreBody){
   scoreBody.replaceChildren();
   scoreRows.forEach(group=>{
    const row=document.createElement("tr");
    const avg=key=>{const values=group.rows.map(item=>item[key]).filter(value=>value!==null&&value!==undefined&&value!==""&&Number.isFinite(Number(value))).map(Number);return values.length?values.reduce((sum,value)=>sum+value,0)/values.length:null;};
    yieldMakeCell(row,group.name);
    yieldMakeCell(row,group.fgCount?formatNumber(group.fg,0):"—");
    yieldMakeCell(row,yieldPercent(avg("main_yield")));
    yieldMakeCell(row,yieldPercent(avg("stage2_yield")));
    yieldMakeCell(row,yieldPercent(avg("stage3_yield")));
    const bloomValue=avg("bloom_rate");
    yieldMakeCell(row,bloomValue===null?"—":formatNumber(bloomValue)+"x");
    scoreBody.append(row);
   });
  }
  const scoreEmpty=$("yield-scorecard-empty"),scoreWrap=$("yield-scorecard-wrap");
  if(scoreEmpty)scoreEmpty.hidden=scoreRows.length>0;
  if(scoreWrap)scoreWrap.hidden=scoreRows.length===0;
  yieldSetValue("yield-scorecard-count",scoreRows.length+" products");

  const logBody=$("yield-log-rows");
  if(logBody){
   logBody.replaceChildren();
   records.forEach(record=>{
    const row=document.createElement("tr");
    yieldMakeCell(row,record.production_date||"—");
    yieldMakeCell(row,record.product_name);
    yieldMakeCell(row,record.product_code);
    yieldMakeCell(row,record.total_fg_tins===null?null:formatNumber(record.total_fg_tins,0));
    yieldMakeCell(row,yieldPercent(record.main_yield));
    yieldMakeCell(row,yieldPercent(record.stage2_yield));
    yieldMakeCell(row,yieldPercent(record.stage3_yield));
    yieldMakeCell(row,record.bloom_rate===null?"—":formatNumber(record.bloom_rate)+"x");
    yieldMakeCell(row,yieldPercent(record.lid_reject));
    yieldMakeCell(row,yieldPercent(record.can_reject));
    yieldMakeCell(row,yieldPercent(record.box_reject));
    yieldMakeCell(row,yieldPercent(record.label_reject));
    logBody.append(row);
   });
  }
  const logEmpty=$("yield-log-empty"),logWrap=$("yield-log-wrap"),more=$("yield-log-load-more");
  if(logEmpty)logEmpty.hidden=validCount>0;
  if(logWrap)logWrap.hidden=validCount===0;
  if(more){more.hidden=!yieldHasMore;more.disabled=yieldLoading;more.textContent=yieldLoading?"Loading…":"Load more";}
  yieldSetValue("yield-log-count",formatNumber(validCount,0)+" records");
  yieldSetValue("yield-record-status",validCount?formatNumber(validCount,0)+" Yield Log rows loaded":"No Yield Log rows");
  yieldSetValue("yield-log-page-status",validCount?(yieldHasMore?"Showing "+formatNumber(validCount,0)+" rows · more records available":"Showing all "+formatNumber(validCount,0)+" returned rows"):"No records loaded");
 }

 async function loadDashboardYield(reset=true){
  if(yieldLoading)return;
  if(reset){yieldRecords=[];yieldOffset=0;yieldHasMore=false;renderYieldTables();}
  const params=new URLSearchParams();
  params.set("limit",String(yieldPageSize));
  params.set("offset",String(yieldOffset));
  const from=$("kpi-analytics-date-from")?.value||"";
  const to=$("kpi-analytics-date-to")?.value||"";
  if(from)params.set("date_from",from);
  if(to)params.set("date_to",to);
  const productName=$(dashboardFilterIds.product_name)?.value||"";
  const productCode=$(dashboardFilterIds.product_code)?.value||"";
  if(productName&&productName.toLowerCase()!=="all")params.set("product_name",productName);
  if(productCode&&productCode.toLowerCase()!=="all")params.set("product_code",productCode);
  yieldLoading=true;
  const more=$("yield-log-load-more");
  if(more){more.disabled=true;more.textContent="Loading…";}
  yieldSetValue("yield-record-status","Loading Yield Log…");
  try{
   const response=await fetch("/api/yield/log?"+params.toString(),{
    method:"GET",credentials:"same-origin",cache:"no-store",headers:{Accept:"application/json"}
   });
   const payload=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(payload.error||"Yield Log data is unavailable.");
   const incoming=Array.isArray(payload.records)?payload.records:[];
   yieldRecords=reset?incoming:yieldRecords.concat(incoming);
   /* batch5 source offset */ yieldOffset=Number(payload.offset||0)+Number(payload.limit||yieldPageSize);
   yieldHasMore=Boolean(payload.has_more);
   const sourceNote=payload.yield_map_note||"Yield Map source mapping is active. 95% placeholder targets are not treated as verified performance targets.";
   yieldSetValue("yield-source-title",payload.count?"Yield Log formulas calculated from TFI2 source records.":"Yield Log is connected; no eligible records were returned.");
   yieldSetValue("yield-source-copy",sourceNote+" · "+Number(payload.mapped_products||0)+" product mappings available. Calculations are read-only.");
   const note=$("yield-source-note");
   if(note)note.dataset.state=payload.count?"ready":"warning";
   renderYieldTables();
  }catch(error){
   if(reset){yieldRecords=[];yieldHasMore=false;renderYieldTables();}
   const note=$("yield-source-note");
   if(note)note.dataset.state="error";
   yieldSetValue("yield-source-title","Yield Log could not be loaded.");
   yieldSetValue("yield-source-copy",error.message||"Check Product Entry, Master Data, and Dashboard view permissions.");
   yieldSetValue("yield-record-status","Yield Log unavailable");
   yieldSetValue("yield-log-page-status",error.message||"Yield Log unavailable");
   showToast(error.message||"Yield Log data could not be loaded.");
  }finally{
   yieldLoading=false;
   if(more){more.disabled=false;more.textContent="Load more";}
   renderYieldTables();
  }
 }

 const comparisonCards = {
  total_output_tins:"TOTAL OUTPUT",output_attainment:"OUTPUT ATTAINMENT",productivity_tins_per_mhr:"PRODUCTIVITY",
  oee:"OEE",main_yield:"AVG % YIELD",fg_reject_pct:"FG REJECT %",total_downtime_hours:"DOWNTIME",
  downtime_pct:"% DOWNTIME",machine_downtime_hours:"MACHINE-RELATED DT",manpower_downtime_hours:"MANPOWER-RELATED DT",
  mtbf_hours:"MTBF",total_manpower_hours:"MANPOWER HOURS"
 };
 let analyticsRequest=0;
 let periodYieldActive=false;

 function changeLabel(metric) {
  if (!Number.isFinite(metric?.change)) return "No comparison data";
  const magnitude=Math.abs(metric.change).toFixed(1);
  const arrow=magnitude==="0.0"?"":metric.change>0?"▲ ":"▼ ";
  return arrow+magnitude+(metric.unit==="points"?" pp":"%")+" vs previous";
 }

 function renderComparisonCard(key, metric, previousRange) {
  const card=[...document.querySelectorAll("#kpi-panel-overview .kpi-stat-card")].find(item=>
   item.querySelector(".kpi-stat-label")?.textContent.trim().startsWith(comparisonCards[key])
  );
  if (!card) return;
  let node=card.querySelector(".kpi-stat-comparison");
  if (!node) {
   node=document.createElement("div");
   node.className="kpi-stat-comparison";
   card.append(node);
  }
  const prior=metric?.previous;
  const baseline=Number.isFinite(prior) ? "Previous: "+(metric.unit==="points"?formatPercent(prior):formatNumber(prior))+" · " : "";
  node.textContent=baseline+changeLabel(metric);
  node.title=previousRange||"";
 }

 async function loadYieldAverages(params, comparison, requestId) {
  const base=new URLSearchParams(params);
  base.delete("machine");
  base.delete("period");
  base.set("main_average","1");
  const loadPeriod=async query=>{
   const response=await fetch("/api/yield/log?"+query,{credentials:"same-origin",cache:"no-store"});
   if (!response.ok) throw new Error("Period Yield average unavailable");
   return response.json();
  };
  const prior=new URLSearchParams(base);
  prior.set("date_from",comparison.date_from);
  prior.set("date_to",comparison.date_to);
  const [currentResult,previousResult]=await Promise.allSettled([loadPeriod(base),loadPeriod(prior)]);
  if (requestId!==analyticsRequest) return;
  const current=currentResult.value?.main_yield ?? null, previous=previousResult.value?.main_yield ?? null;
  const range=comparison.date_from+" to "+comparison.date_to;
  updateKpiCard("AVG % YIELD",yieldPercent(current),current!==null?
   "Period average · "+formatNumber(currentResult.value.eligible_rows,0)+" eligible rows":
   currentResult.status==="rejected"?"Yield average unavailable":"No eligible Yield records",current!==null?"verified":"empty");
  renderComparisonCard("main_yield",{
   previous,unit:"points",change:current!==null&&previous!==null?(current-previous)*100:null
  },range);
 }

 function renderPeriodComparison(payload, params, requestId) {
  const comparison=payload?.previous_period;
  periodYieldActive=Boolean(comparison?.date_from);
  const range=comparison?.date_from ? comparison.date_from+" to "+comparison.date_to : "";
  setText("kpi-previous-period",range ? "Previous period · "+range : "Select a period to compare");
  Object.keys(comparisonCards).forEach(key=>renderComparisonCard(key,comparison?.metrics?.[key],range));
  if (range) {
   updateKpiCard("AVG % YIELD","—","Checking period Yield","pending");
   void loadYieldAverages(params,comparison,requestId);
  } else {
   const main=yieldAverage("main_yield");
   updateKpiCard("AVG % YIELD",yieldPercent(main),main!==null?"Yield Log average":"No eligible Yield Log rows",main!==null?"verified":"empty");
  }
  const rows=$("kpi-downtime-comparison-rows");
  if (rows) {
   rows.replaceChildren();
   for (const [key,label] of [["machine_downtime_hours","Machine (hrs)"],["manpower_downtime_hours","Manpower (hrs)"]]) {
    const metric=comparison?.metrics?.[key];
    const row=document.createElement("tr");
    [label,Number.isFinite(metric?.current)?formatNumber(metric.current):"—",
     Number.isFinite(metric?.previous)?formatNumber(metric.previous):"—",changeLabel(metric)]
      .forEach(value=>yieldMakeCell(row,value));
    rows.append(row);
   }
  }
 }

 let hourlyProductLines=null;
 const hourlyProductLine=$("hourly-product-line");

 function renderHourlyProducts(){
  const body=$("hourly-product-rows");
  if(!body||!hourlyProductLine)return;
  const lineKey=hourlyProductLine.value;
  const products=new Map();
  for(const line of hourlyProductLines||[]){
   if(lineKey&&lineKey!==line.key)continue;
   for(const product of line.data.product_breakdown||[]){
    const code=product.product_code;
    const totals=products.get(code)||{code,name:"",records:0,target:0,actual:0,variance:0};
    totals.name ||= product.product_name||"";
    totals.records+=Number(product.record_count)||0;
    totals.target+=Number(product.target_tins)||0;
    totals.actual+=Number(product.actual_tins)||0;
    totals.variance+=Number(product.variance_tins)||0;
    products.set(code,totals);
   }
  }

  const ranked=[...products.values()].sort((a,b)=>b.actual-a.actual||String(a.code??"").localeCompare(String(b.code??"")));
  body.replaceChildren();
  if(!ranked.length){
   const cell=body.insertRow().insertCell();
   cell.colSpan=8;
   cell.textContent=hourlyProductLines===null?"Hourly product data could not load.":
    !hourlyProductLines.length?"Hourly product data is restricted for this account.":
    hourlyProductLines.some(line=>line.status==="available"&&!Array.isArray(line.data.product_breakdown))
     ?"Hourly product breakdown is unavailable.":"No hourly products match the selected filters.";
   return;
  }

  const rows=document.createDocumentFragment();
  ranked.forEach((product,index)=>{
   const row=document.createElement("tr");
   const values=[
    formatNumber(index+1,0),product.code||"Unassigned",product.name||"\u2014",
    formatNumber(product.records,0),formatNumber(product.target),formatNumber(product.actual),
    formatNumber(product.variance),product.target>0?formatPercent(product.actual/product.target):"\u2014"
   ];
   values.forEach(value=>{row.insertCell().textContent=value;});
   rows.append(row);
  });
  body.append(rows);
 }

 hourlyProductLine?.addEventListener("change",renderHourlyProducts);

 function renderHourlyDashboard(hourly){
  const lines=[
   {key:"hourly_agri",name:"Agri Line",short:"Agri",id:"agri",color:"#169b62"},
   {key:"hourly_meat",name:"Meat Line",short:"Meat",id:"meat",color:"#1677a5"},
   {key:"hourly_coding",name:"Coding Line",short:"Coding",id:"coding",color:"#b47a22"}
  ];
  const number=value=>formatNumber(Number(value)||0,2);
  const percent=value=>value===null||value===undefined||!Number.isFinite(Number(value))?"—":formatPercent(Number(value));
  const allowed=lines.map(line=>({...line,data:hourly?.[line.key]||null,status:hourly?.[line.key]?.status||"restricted"}));
  const visible=allowed.filter(line=>line.status==="available"||line.status==="empty");
  hourlyProductLines=hourly?visible:null;
  if(hourlyProductLine){
   const selectedLine=hourlyProductLine.value;
   hourlyProductLine.replaceChildren(new Option("All available lines",""),
    ...visible.map(line=>new Option(line.name,line.key)));
   if(visible.some(line=>line.key===selectedLine))hourlyProductLine.value=selectedLine;
   hourlyProductLine.disabled=!visible.length;
  }
  renderHourlyProducts();
  const total=visible.reduce((acc,line)=>({records:acc.records+(Number(line.data.record_count)||0),target:acc.target+(Number(line.data.target_tins)||0),actual:acc.actual+(Number(line.data.actual_tins)||0),variance:acc.variance+(Number(line.data.variance_tins)||0)}),{records:0,target:0,actual:0,variance:0});
  const set=(id,value)=>setText(id,value),ready=visible.length>0;
  set("hourly-total-records",ready?formatNumber(total.records,0):"—");
  set("hourly-total-target",ready?number(total.target):"—");
  set("hourly-total-actual",ready?number(total.actual):"—");
  set("hourly-total-variance",ready?number(total.variance):"—");
  set("hourly-total-attainment",ready&&total.target>0?percent(total.actual/total.target):"—");
  set("hourly-access-caption",visible.length+" of 3 hourly lines available to your role"+(allowed.some(line=>line.status==="restricted")?" · some lines restricted":""));
  const tbody=$("hourly-line-summary-rows");if(tbody)tbody.replaceChildren();
  const aggregate=Array.from({length:24},(_,hour)=>({hour,target:0,actual:0}));
  function miniChart(line){
   const bins=Array.from({length:24},(_,hour)=>({hour,target:0,actual:0}));
   (Array.isArray(line.data?.hourly_series)?line.data.hourly_series:[]).forEach(point=>{const h=Number(point.hour);if(Number.isInteger(h)&&h>=0&&h<24){bins[h].target+=Number(point.target_tins)||0;bins[h].actual+=Number(point.actual_tins)||0;}});
   bins.forEach((bin,index)=>{aggregate[index].target+=bin.target;aggregate[index].actual+=bin.actual;});
   const max=Math.max(1,...bins.flatMap(bin=>[bin.target,bin.actual]));
   return '<div class="kpi-hourly-mini-bars" role="img" aria-label="'+line.name+' hourly target and actual output">'+bins.map(bin=>'<div title="'+String(bin.hour).padStart(2,"0")+':00 · Target '+number(bin.target)+' · Actual '+number(bin.actual)+'"><i class="target" style="height:'+bin.target/max*100+'%"></i><i class="actual" style="height:'+bin.actual/max*100+'%"></i></div>').join("")+'</div><div class="kpi-hourly-mini-labels"><span>00</span><span>03</span><span>06</span><span>09</span><span>12</span><span>15</span><span>18</span><span>21</span></div><div class="kpi-hourly-mini-legend"><span><i></i>Target</span><span><i class="actual"></i>Actual</span></div>';
  }
  allowed.forEach(line=>{
   const card=document.querySelector('[data-hourly-line="'+line.key+'"]');if(card)card.dataset.status=line.status;
   const d=line.data||{},restricted=line.status==="restricted";
   set("hourly-"+line.id+"-count",restricted?"Restricted":formatNumber(d.record_count||0,0)+" records");
   set("hourly-"+line.id+"-status",restricted?"Your role does not have view access":line.status==="empty"?"No saved records in selected period":"Live TFI2 records");
   set("hourly-"+line.id+"-target",restricted?"—":number(d.target_tins));
   set("hourly-"+line.id+"-actual",restricted?"—":number(d.actual_tins));
   set("hourly-"+line.id+"-variance",restricted?"—":number(d.variance_tins));
   set("hourly-"+line.id+"-attainment",restricted?"—":percent(d.attainment));
   const chart=$("hourly-"+line.id+"-chart");
   if(chart){chart.style.setProperty("--line-color",line.color);chart.innerHTML=restricted?'<div class="kpi-hourly-empty">Hourly details are restricted for this role.</div>':line.status==="empty"?'<div class="kpi-hourly-empty">No saved hourly records in this period.</div>':miniChart(line);}
   if(tbody){
    const row=document.createElement("tr"),values=[line.name,restricted?"—":formatNumber(d.record_count||0,0),restricted?"—":number(d.target_tins),restricted?"—":number(d.actual_tins),restricted?"—":number(d.variance_tins),restricted?"—":percent(d.attainment)];
    values.forEach(value=>{const cell=document.createElement("td");cell.textContent=value;row.append(cell);});
    const cell=document.createElement("td"),badge=document.createElement("span");badge.className="kpi-hourly-status "+(restricted?"restricted":line.status==="empty"?"empty":"");badge.textContent=restricted?"Restricted":line.status==="empty"?"No records":"Live";cell.append(badge);row.append(cell);tbody.append(row);
   }
  });
  const chart=$("hourly-combined-chart");if(!chart)return;
  if(!ready||total.records===0){chart.innerHTML='<div class="kpi-hourly-empty">'+(ready?"No hourly production records match the selected date and product filters.":"No hourly modules are available to this account.")+' No sample data is displayed.</div>';return;}
  const max=Math.max(1,...aggregate.flatMap(point=>[point.target,point.actual]));
  const width=1080,height=270,left=48,right=18,top=15,bottom=36,plotW=width-left-right,plotH=height-top-bottom;
  const x=hour=>left+(hour/23)*plotW,y=value=>top+plotH-(value/max)*plotH,ns="http://www.w3.org/2000/svg";
  const svg=document.createElementNS(ns,"svg");svg.setAttribute("viewBox","0 0 "+width+" "+height);svg.setAttribute("role","img");svg.setAttribute("aria-label","Combined hourly target and actual output for Agri, Meat and Coding lines");
  for(let tick=0;tick<=4;tick++){const value=max*tick/4,yy=y(value),grid=document.createElementNS(ns,"line");grid.setAttribute("x1",left);grid.setAttribute("x2",width-right);grid.setAttribute("y1",yy);grid.setAttribute("y2",yy);grid.setAttribute("class","kpi-hourly-gridline");svg.append(grid);const label=document.createElementNS(ns,"text");label.setAttribute("x",left-9);label.setAttribute("y",yy+3);label.setAttribute("text-anchor","end");label.setAttribute("class","kpi-hourly-axis-label");label.textContent=formatNumber(value,0);svg.append(label);}
  for(let hour=0;hour<24;hour+=3){const label=document.createElementNS(ns,"text");label.setAttribute("x",x(hour));label.setAttribute("y",height-12);label.setAttribute("text-anchor","middle");label.setAttribute("class","kpi-hourly-axis-label");label.textContent=String(hour).padStart(2,"0");svg.append(label);}
  const target=document.createElementNS(ns,"path");target.setAttribute("d",aggregate.map((point,index)=>(index?"L":"M")+x(point.hour)+" "+y(point.target)).join(" "));target.setAttribute("class","kpi-hourly-target-line");svg.append(target);
  allowed.filter(line=>line.status==="available").forEach(line=>{const map=new Map((line.data.hourly_series||[]).map(point=>[Number(point.hour),Number(point.actual_tins)||0]));const path=Array.from({length:24},(_,hour)=>({hour,actual:map.get(hour)||0})).map((point,index)=>(index?"L":"M")+x(point.hour)+" "+y(point.actual)).join(" ");const series=document.createElementNS(ns,"path");series.setAttribute("d",path);series.setAttribute("class","kpi-hourly-actual-line");series.setAttribute("stroke",line.color);series.setAttribute("aria-label",line.name+" actual output");svg.append(series);});
  const wrap=document.createElement("div");wrap.className="kpi-hourly-chart-scroll";wrap.append(svg);
  const legend=document.createElement("div");legend.className="kpi-hourly-legend";
  [{label:"Combined Target",target:true,color:"#87968d"},...allowed.filter(line=>line.status==="available").map(line=>({label:line.short+" Actual",color:line.color}))].forEach(item=>{const entry=document.createElement("span"),swatch=document.createElement("i");swatch.style.setProperty("--legend-color",item.color);if(item.target)swatch.className="target";entry.append(swatch,document.createTextNode(item.label));legend.append(entry);});
  chart.replaceChildren(wrap,legend);
 }

 async function loadDashboardAnalytics(){
  const params=new URLSearchParams();
  const from=$("kpi-analytics-date-from")?.value||"";
  const to=$("kpi-analytics-date-to")?.value||"";
  if(from)params.set("date_from",from);
  if(to)params.set("date_to",to);
  [
   ["product_name","kpi-filter-product"],
   ["product_code","kpi-filter-code"],
   ["machine","kpi-filter-machine"]
  ].forEach(([parameter,id])=>{
   const value=$(id)?.value||"";
   if(value&&value.toLowerCase()!=="all")params.set(parameter,value);
  });
  const period=$(dashboardFilterIds.view)?.value||"";
  if (from&&to&&["Daily","Weekly","Monthly"].includes(period)) params.set("period",period);
  periodYieldActive=params.has("period");
  const requestId=++analyticsRequest;
  const suffix=params.toString()?"?"+params.toString():"";
  setText("kpi-analytics-caption","Loading source-backed calculations from TFI2…");
  try{
   const response=await fetch("/api/dashboard/analytics"+suffix,{
    method:"GET",credentials:"same-origin",cache:"no-store",headers:{Accept:"application/json"}
   });
   const payload=await response.json().catch(()=>({}));
   if(requestId!==analyticsRequest)return;
   if(!response.ok)throw new Error(payload.error||"TFI2 calculations are unavailable.");
   const metrics=payload.metrics||{};
   const modules=payload.modules||{};
   const productivity=modules.productivity||{};
   const downtime=modules.dmr_production||{};
   const oee=modules.oee||{};
   renderHourlyDashboard(modules.hourly||{});
   const hasProductivity=productivity.status==="available";
   const hasDowntime=downtime.status==="available"||(downtime.status==="empty"&&hasProductivity);
   const hasOee=oee.status==="available";
   const metric=(key,ready,percent=false)=>ready&&metrics[key]!==null&&metrics[key]!==undefined
    ?(percent?formatPercent(metrics[key]):formatNumber(metrics[key])):"—";
   const readyFoot=(ready,source)=>ready?"TFI2 · "+source:"No verified records in selected period";
   updateKpiCard("TOTAL OUTPUT",metric("total_output_tins",hasProductivity),readyFoot(hasProductivity,"Productivity source formula"),hasProductivity?"verified":"empty");
   updateKpiCard("OUTPUT ATTAINMENT",metric("output_attainment",hasProductivity,true),readyFoot(hasProductivity,"output with target ÷ target"),hasProductivity?"verified":"empty");
   updateKpiCard("PRODUCTIVITY",metric("productivity_tins_per_mhr",hasProductivity),readyFoot(hasProductivity,"output with MHR ÷ MHR"),hasProductivity?"verified":"empty");
   updateKpiCard("OEE",metric("oee",hasOee,true),readyFoot(hasOee,"Availability × Performance × Quality"),hasOee?"verified":"empty");
   updateKpiCard("FG REJECT %",metric("fg_reject_pct",hasProductivity,true),readyFoot(hasProductivity,"FG rejects ÷ (output + rejects)"),hasProductivity?"verified":"empty");
   updateKpiCard("DOWNTIME",metric("total_downtime_hours",hasDowntime),readyFoot(hasDowntime,"DMR Production downtime"),hasDowntime?"verified":"empty");
   updateKpiCard("% DOWNTIME",metric("downtime_pct",hasDowntime&&hasProductivity,true),hasDowntime&&hasProductivity?"TFI2 · DMR Production hours ÷ planned run hours":"Requires DMR Production and Productivity records",hasDowntime&&hasProductivity?"verified":"empty");
   updateKpiCard("MACHINE-RELATED DT",metric("machine_downtime_hours",hasDowntime),readyFoot(hasDowntime,"KPI Setup downtime groups"),hasDowntime?"verified":"empty");
   updateKpiCard("MANPOWER-RELATED DT",metric("manpower_downtime_hours",hasDowntime),readyFoot(hasDowntime,"KPI Setup downtime groups"),hasDowntime?"verified":"empty");
   updateKpiCard("MTBF",metric("mtbf_hours",hasDowntime&&hasProductivity),hasDowntime&&hasProductivity?"TFI2 · (planned hours − downtime) ÷ BD count":"Requires verified run hours and breakdown records",hasDowntime&&hasProductivity?"verified":"empty");
   updateKpiCard("MANPOWER HOURS",metric("total_manpower_hours",hasProductivity),readyFoot(hasProductivity,"DMP-linked Productivity source"),hasProductivity?"verified":"empty");

   const verified=payload.readiness?.verified_kpi_groups||[];
   const pending=payload.readiness?.pending_kpi_groups||[];
   const reports=payload.reports||{};
   const connectedReports=["production_summary","schedule_summary","product_entry_summary","removed_rows"]
    .filter(key=>reports[key]&&["available","empty","implemented_read_only_projection","available_read_only_archive"].includes(reports[key].status)).length;
   renderPeriodComparison(payload,params,requestId);
   setText("kpi-analytics-verified",verified.length);
   setText("kpi-analytics-pending",pending.length);
   setText("kpi-analytics-reports",connectedReports+" / 4");
   setText("kpi-analytics-contract","SOURCE FORMULAS · "+(payload.calculation_contract||"VERIFIED"));
   setText("kpi-analytics-caption",verified.join(" · ")+" connected; "+pending.length+" source projections remain pending.");
   if(!hasProductivity&&!hasDowntime&&!hasOee){
    setText("kpi-data-notice-title","TFI2 calculation service is connected; no eligible KPI records exist for this period.");
    setText("kpi-data-notice-copy","No sample values are shown. Yield is read from the source-mapped Product Entry formula projection; other report projections remain separately identified until verified.");
   }else{
    setText("kpi-data-notice-title","Verified KPI calculations are reading live TFI2 records.");
    setText("kpi-data-notice-copy","Displayed metrics use the original workbook formulas and permission-checked TFI2 sources. Yield Log results are loaded from the source formula projection; Product Entry Summary remains a separate report projection.");
   }
  }catch(error){
   if(requestId!==analyticsRequest)return;
   renderPeriodComparison(null,params,requestId);
   renderHourlyDashboard(null);
   setText("kpi-analytics-contract","TFI2 · UNAVAILABLE");
   setText("kpi-analytics-caption",error.message||"Could not load verified KPI calculations.");
   setText("kpi-analytics-verified","—");
   setText("kpi-analytics-pending","—");
   setText("kpi-analytics-reports","—");
   showToast(error.message||"Dashboard calculations could not be loaded.");
  }
 }

 let dashboardRefreshPromise=null;
 let dashboardRefreshQueued=false;
 async function refreshDashboardData(reason){
  if(dashboardRefreshPromise){
   dashboardRefreshQueued=true;
   return dashboardRefreshPromise;
  }
  dashboardRefreshPromise=(async()=>{
   do{
    dashboardRefreshQueued=false;
    const refreshFilterCatalog=!dashboardFilterCatalogFetched||["module-save","window-focus","visible"].includes(reason);
    const refreshTasks=[loadDashboardCoverage()];
    if(refreshFilterCatalog)refreshTasks.push(loadDashboardFilterCatalog());
    await Promise.allSettled(refreshTasks);
    syncDashboardDateRange(false);
    await Promise.all([loadDashboardAnalytics(),loadDashboardYield(true)]);
    document.body.dataset.tfiDashboardUpdatedAt=new Date().toISOString();
    document.body.dataset.tfiDashboardUpdateReason=reason||"automatic";
   }while(dashboardRefreshQueued);
  })();
  try{return await dashboardRefreshPromise;}
  finally{dashboardRefreshPromise=null;}
 }

 function activateTab(key,focus){
  const tab=tabs.find(item=>item.dataset.kpiTab===key);
  const panel=panels.find(item=>item.dataset.kpiPanel===key);
  if(!tab||!panel)return;
  tabs.forEach(item=>{
   const active=item===tab;
   item.classList.toggle("active",active);
   item.setAttribute("aria-selected",active?"true":"false");
   item.tabIndex=active?0:-1;
  });
  panels.forEach(item=>{
   const active=item===panel;
   item.classList.toggle("active",active);
   item.hidden=!active;
  });
  if(focus)tab.focus();
 }

 tabs.forEach((tab,index)=>{
  tab.addEventListener("click",()=>activateTab(tab.dataset.kpiTab,false));
  tab.addEventListener("keydown",event=>{
   let next=-1;
   if(event.key==="ArrowRight")next=(index+1)%tabs.length;
   else if(event.key==="ArrowLeft")next=(index-1+tabs.length)%tabs.length;
   else if(event.key==="Home")next=0;
   else if(event.key==="End")next=tabs.length-1;
   if(next<0)return;
   event.preventDefault();
   activateTab(tabs[next].dataset.kpiTab,true);
  });
 });

 function openModule(page,file){
  const embedded=window.self!==window.top||new URLSearchParams(location.search).get("embedded")==="1";
  if(embedded){
   window.parent.postMessage({type:"TFI_NAVIGATE_MODULE",page}, "*");
   return;
  }
  location.href=file;
 }

 const importButton=$("kpi-open-import");
 if(importButton)importButton.addEventListener("click",()=>openModule("Spreadsheet Import","spreadsheet-import-center-preview.html"));

 const search=$("module-search");
 if(search){
  search.addEventListener("input",()=>{
   const query=search.value.trim().toLowerCase();
   document.querySelectorAll(".sidebar nav .nav-group").forEach(group=>{
    const links=[...group.querySelectorAll(".nav-link")];
    let visible=0;
    links.forEach(link=>{
     const match=!query||link.textContent.toLowerCase().includes(query);
     link.hidden=!match;
     if(match)visible++;
    });
    group.hidden=visible===0;
   });
  });
 }

 const notifications=$("notification-button");
 if(notifications)notifications.addEventListener("click",()=>showToast("No verified notifications are available."));

 ["year","view","month","week","product_name","product_code","machine"].forEach(key=>{
  const element=$(dashboardFilterIds[key]);
  if(!element)return;
  element.addEventListener("change",()=>{
   if(key==="view")setFilterMode();
   updateProductFilterStatus();
  });
 });
 const dateFilter=$(dashboardFilterIds.date);
 if(dateFilter)dateFilter.addEventListener("change",()=>{
  const selectedYear=dateFilter.value.slice(0,4);
  const yearSelect=$(dashboardFilterIds.year);
  if(yearSelect&&[...yearSelect.options].some(option=>option.value===selectedYear))yearSelect.value=selectedYear;
 });
 const analyticsRefresh=$("kpi-analytics-refresh");
 if(analyticsRefresh)analyticsRefresh.addEventListener("click",()=>{
  if(!syncDashboardDateRange(true))return;
  updateProductFilterStatus();
  void Promise.all([loadDashboardAnalytics(),loadDashboardYield(true)]);
 });
 const yieldLoadMore=$("yield-log-load-more");
 if(yieldLoadMore)yieldLoadMore.addEventListener("click",()=>void loadDashboardYield(false));

 window.addEventListener("tfi:data-saved",event=>{
  const detail=event.detail||{};
  document.body.dataset.tfiLastSavedModule=detail.module||"";
  document.body.dataset.tfiLastSavedEndpoint=detail.endpoint||"";
  void refreshDashboardData("module-save");
 });
 window.addEventListener("focus",()=>void refreshDashboardData("window-focus"));
 document.addEventListener("visibilitychange",()=>{
  if(!document.hidden)void refreshDashboardData("visible");
 });
 window.setInterval(()=>{
  if(!document.hidden)void refreshDashboardData("15-second-poll");
 },15000);

 activateTab("overview",false);
 void refreshDashboardData("initial");
})();
