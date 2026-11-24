/* Live TFI2 visual analytics for Hourly Meat, Coding and Agri. */
(function(){
  "use strict";
  const MAX_CHART_ROWS=5000, PAGE_SIZE=100;
  let config=null, loading=false;
  const $=id=>document.getElementById(id);
  const localISO=date=>{const y=date.getFullYear(),m=String(date.getMonth()+1).padStart(2,"0"),d=String(date.getDate()).padStart(2,"0");return y+"-"+m+"-"+d;};
  const fmt=value=>new Intl.NumberFormat("en-PH",{maximumFractionDigits:2}).format(Number(value)||0);
  const pct=value=>value==null?"—":(Number(value)*100).toFixed(1)+"%";
  const safe=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const sum=(rows,key)=>rows.reduce((total,row)=>total+(Number(row[key])||0),0);
  function empty(node,message){if(node)node.innerHTML='<div class="hp-empty">'+safe(message)+'</div>';}
  function setKpi(name,value){const node=$(config.prefix+"-analytics-"+name);if(node)node.textContent=value;}
  function renderHourly(rows){
    const node=$(config.prefix+"-analytics-hourly");if(!node)return;
    const bins=Array.from({length:24},(_,hour)=>({hour,target:0,actual:0,count:0}));
    rows.forEach(r=>{const h=Number(r.hour);if(Number.isInteger(h)&&h>=0&&h<24){bins[h].target+=Number(r.target_tins)||0;bins[h].actual+=Number(r.actual_tins)||0;bins[h].count++;}});
    if(!rows.length||!bins.some(b=>b.target||b.actual)){empty(node,"No hourly output data for this date range.");return;}
    const max=Math.max(1,...bins.flatMap(b=>[b.target,b.actual]));
    node.innerHTML='<div class="hp-hourly-chart">'+bins.map(b=>'<div class="hp-hour-col" title="'+String(b.hour).padStart(2,"0")+':00 · Target '+fmt(b.target)+' · Actual '+fmt(b.actual)+'"><div class="hp-hour-bars"><span class="hp-bar hp-target" style="height:'+Math.max(0,b.target/max*100)+'%"></span><span class="hp-bar hp-actual" style="height:'+Math.max(0,b.actual/max*100)+'%"></span></div><small>'+(b.hour%3===0?String(b.hour).padStart(2,"0"):"")+'</small></div>').join("")+'</div><div class="hp-legend"><span><i class="hp-legend-target"></i>Target</span><span><i class="hp-legend-actual"></i>Actual</span></div>';
  }
  function renderDaily(rows){
    const node=$(config.prefix+"-analytics-daily");if(!node)return;
    const map=new Map();
    rows.forEach(r=>{if(!r.production_date)return;const d=map.get(r.production_date)||{date:r.production_date,target:0,actual:0};d.target+=Number(r.target_tins)||0;d.actual+=Number(r.actual_tins)||0;map.set(r.production_date,d);});
    const days=[...map.values()].sort((a,b)=>a.date.localeCompare(b.date));
    if(!days.length||!days.some(d=>d.target||d.actual)){empty(node,"No daily output data for this date range.");return;}
    const max=Math.max(1,...days.flatMap(d=>[d.target,d.actual]));
    node.innerHTML='<div class="hp-daily-chart">'+days.map(d=>'<div class="hp-day-col" title="'+safe(d.date)+' · Target '+fmt(d.target)+' · Actual '+fmt(d.actual)+'"><div class="hp-day-bars"><span class="hp-bar hp-target" style="height:'+Math.max(0,d.target/max*100)+'%"></span><span class="hp-bar hp-actual" style="height:'+Math.max(0,d.actual/max*100)+'%"></span></div><small>'+safe(d.date.slice(5))+'</small></div>').join("")+'</div><div class="hp-legend"><span><i class="hp-legend-target"></i>Target</span><span><i class="hp-legend-actual"></i>Actual</span></div>';
  }
  function renderProducts(rows){
    const node=$(config.prefix+"-analytics-products");if(!node)return;
    const map=new Map();
    rows.forEach(r=>{const code=String(r.product_code||"Unassigned");const item=map.get(code)||{code,name:r.product_name||"Other",actual:0,target:0};item.actual+=Number(r.actual_tins)||0;item.target+=Number(r.target_tins)||0;map.set(code,item);});
    const items=[...map.values()].sort((a,b)=>b.actual-a.actual).slice(0,8);
    if(!items.length||!items.some(x=>x.actual||x.target)){empty(node,"Product contribution will appear after records are saved.");return;}
    const max=Math.max(1,...items.map(x=>x.actual));
    node.innerHTML='<div class="hp-product-list">'+items.map(x=>'<div class="hp-product-row"><div class="hp-product-copy"><strong>'+safe(x.code)+'</strong><small>'+safe(x.name)+'</small><b>'+fmt(x.actual)+' tins</b></div><div class="hp-product-track"><span style="width:'+Math.max(1,x.actual/max*100)+'%"></span></div></div>').join("")+'</div>';
  }
  async function refresh(){
    if(!config||loading)return;
    const {moduleKey,prefix,api}=config,button=$(prefix+"-analytics-apply"),status=$(prefix+"-analytics-status");
    const from=$(prefix+"-analytics-from")?.value||"",to=$(prefix+"-analytics-to")?.value||"",code=$(prefix+"-analytics-code")?.value||"";
    if(from&&to&&from>to){if(status)status.textContent="Date From cannot be later than Date To.";return;}
    loading=true;if(button){button.disabled=true;button.textContent="LOADING…";}
    if(status)status.textContent="Loading live TFI2 production data…";
    try{
      const rows=[];let page=1,payload=null,truncated=false;
      do{
        const q=new URLSearchParams({page:String(page),page_size:String(PAGE_SIZE)});
        if(from)q.set("date_from",from);if(to)q.set("date_to",to);if(code)q.set("product_code",code);
        payload=await api("/api/hourly/"+moduleKey+"/records?"+q.toString());
        rows.push(...(payload.records||[]));
        if(rows.length>=MAX_CHART_ROWS&&payload.has_more){truncated=true;break;}
        page++;
      }while(payload?.has_more&&page<=Math.ceil(MAX_CHART_ROWS/PAGE_SIZE));
      const summary=payload?.summary||{};
      setKpi("records",fmt(summary.record_count??rows.length));
      setKpi("target",fmt(summary.total_target_tins??sum(rows,"target_tins")));
      setKpi("actual",fmt(summary.total_actual_tins??sum(rows,"actual_tins")));
      setKpi("variance",fmt(summary.total_variance_tins??(sum(rows,"actual_tins")-sum(rows,"target_tins"))));
      const target=Number(summary.total_target_tins??sum(rows,"target_tins"));
      const actual=Number(summary.total_actual_tins??sum(rows,"actual_tins"));
      setKpi("attainment",pct(summary.attainment??(target>0?actual/target:null)));
      renderHourly(rows);renderDaily(rows);renderProducts(rows);
      if(status){
        status.textContent=rows.length
          ? "TFI2 live data · "+fmt(summary.record_count??rows.length)+" matching records · charts built from "+fmt(rows.length)+" records"+(truncated?" · narrow the date range to see all chart details":"")
          : "TFI2 connected · no saved records match this date range and product filter. No sample data is shown.";
      }
      const root=$(prefix+"-analytics");if(root)root.dataset.records=String(rows.length);
      document.body.dataset.tfiHourlyAnalytics="ready";
    }catch(error){
      ["records","target","actual","variance","attainment"].forEach(key=>setKpi(key,"—"));
      ["hourly","daily","products"].forEach(key=>empty($(prefix+"-analytics-"+key),"Analytics could not load. "+error.message));
      if(status)status.textContent=error.message;
      document.body.dataset.tfiHourlyAnalytics="error";
    }finally{loading=false;if(button){button.disabled=false;button.textContent="UPDATE ANALYTICS";}}
  }
  async function init(options){
    config=options;
    const {prefix,productOptions}=config;
    const from=$(prefix+"-analytics-from"),to=$(prefix+"-analytics-to"),code=$(prefix+"-analytics-code");
    const today=new Date(),start=new Date(today);start.setDate(start.getDate()-29);
    if(from&&!from.value)from.value=localISO(start);
    if(to&&!to.value)to.value=localISO(today);
    if(code){const current=code.value;code.innerHTML='<option value="">All product codes</option>'+(productOptions()||[]).map(p=>'<option value="'+safe(p.code)+'">'+safe(p.code+" — "+p.name)+'</option>').join("");code.value=current;}
    $(prefix+"-analytics-apply")?.addEventListener("click",refresh);
    from?.addEventListener("keydown",e=>{if(e.key==="Enter")refresh();});
    to?.addEventListener("keydown",e=>{if(e.key==="Enter")refresh();});
    code?.addEventListener("change",refresh);
    await refresh();
  }
  window.TFI_HOURLY_ANALYTICS={init,refresh};
})();