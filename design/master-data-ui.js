/* TFI Master Data UI — source-aligned TFI2 data with permission-controlled edits. */
(function(){
  "use strict";
  const DATA=window.TFI_MASTER_DATA;
  const $=id=>document.getElementById(id);
  if(!DATA||!DATA.sheets){document.body.innerHTML="<p>Master Data source snapshot unavailable.</p>";return;}
  const clone=v=>JSON.parse(JSON.stringify(v));
  const sheets=clone(DATA.sheets);
  const state={category:"product",page:1,pageSize:25,search:"",filter:"all",dprView:"family",dprFamily:8,scheduleView:"codes",modal:null,rowMeta:{},permissions:{view:false,edit:false},categoryMeta:{},loaded:false};
  const category={
    product:{key:"productStandard",name:"Product Standard and Specificat",desc:"Product specifications, capacity and product references.",count:"58 populated variants",access:"Admin · controlled fields",range:"A1:U110",icon:"▤",header:1,width:21,editable:[1,2,3,4,7,8,9,10,11,12,13,14,15,16,17,19,20]},
    code:{key:"codeMap",name:"Code Map",desc:"Product code to Product Entry family mapping.",count:"68 source mappings",access:"Admin · controlled mapping",range:"A1:B72",icon:"⌘",header:4,width:2,editable:[1]},
    yield:{key:"yieldMap",name:"Yield Map",desc:"Yield and rejection calculation mappings by product family.",count:"39 mapped product families",access:"Admin · B:M inputs only",range:"A1:W43",icon:"◉",header:4,width:23,editable:[1,2,3,4,5,6,7,8,9,10,11,12]},
    entry:{key:"entryMap",name:"Entry Map",desc:"39 Product Entry family/block configurations and named-range references.",count:"39 populated mappings",access:"Read-only · protected structure",range:"A1:E43",icon:"▦",header:1,width:5,editable:[]},
    kpi:{key:"kpiSetup",name:"KPI Setup",desc:"KPI settings, machines, products, downtime references and reporting lists.",count:"127 product codes + All",access:"Admin · paired reference groups",range:"A1:T129",icon:"◫",header:1,width:20,editable:[]},
    dpr:{key:"dprLegend",name:"DPR LEGEND",desc:"DPR codes, product-family lists, downtime and review references.",count:"116 unique product codes",access:"Admin · helper outputs protected",range:"A1:AN119",icon:"▥",header:2,width:40,editable:[]},
    dmp:{key:"dmpLegend",name:"DMP LEGEND",desc:"Workers, positions, processes and production lines.",count:"69 source rows",access:"Admin · worker notes retained",range:"A1:D70",icon:"⚙",header:1,width:4,editable:[0,1,2,3]},
    manpower:{key:"manpower",name:"MANPOWER",desc:"Employee and manpower reference records used by operational modules.",count:"445 source records",access:"Admin · HR / manpower review",range:"A1:E448",icon:"♙",header:3,width:5,editable:[0,1,2,3,4]},
    schedule:{key:"scheduleLists",name:"Schedule Lists",desc:"Production codes and schedule reference values refreshed from Product Standard.",count:"100 production-code rows",access:"Auto-refreshed · read-only",range:"A1:L101",icon:"▣",header:1,width:12,editable:[]}
  };
  const colLetter=n=>{let s="";while(n>0){let r=(n-1)%26;s=String.fromCharCode(65+r)+s;n=Math.floor((n-1)/26);}return s;};
  const esc=v=>String(v===null||v===undefined?"":v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const val=(key,row,col)=>((sheets[key].values[row-1]||[])[col]??"");
  const pad=(row,width)=>Array.from({length:width},(_,i)=>row?.[i]??"");
  const rows=(key,start,end,width)=>{
    const src=sheets[key].values||[];
    const out=[];
    for(let n=start;n<=Math.min(end,src.length);n++)out.push({sourceRow:n,values:pad(src[n-1],width)});
    return out;
  };
  const rowMeta=(key,sourceRow)=>state.rowMeta[key]?.[sourceRow]||null;
  const canEditRow=(key,sourceRow)=>state.permissions.edit===true&&rowMeta(key,sourceRow)?.row_editable===true;
  const header=(key,row,width)=>pad((sheets[key].values||[])[row-1]||[],width);
  const nonempty=v=>v!==null&&v!==undefined&&String(v)!=="";
  const textCell=v=>nonempty(v)?esc(v).replace(/\n/g,"<br>"):"";
  const sourceTag=n=>'<span class="source-row-tag">ROW '+n+'</span>';
  const sourceCell=(v,n,first)=>'<td'+(nonempty(v)?"":" class=\"source-blank\"")+'>'+(first?sourceTag(n):"")+(nonempty(v)?'<span class="source-value">'+textCell(v)+'</span>':"")+'</td>';
  const searchMatch=(row,q)=>!q||row.values.join(" ").toLowerCase().includes(q)||(row.note||"").toLowerCase().includes(q);
  const paginate=list=>{
    const total=list.length,pages=Math.max(1,Math.ceil(total/state.pageSize));
    state.page=Math.min(Math.max(1,state.page),pages);
    const start=(state.page-1)*state.pageSize;
    return {items:list.slice(start,start+state.pageSize),total,pages,start:total?start+1:0,end:Math.min(start+state.pageSize,total)};
  };
  function setPagination(p){
    const el=$("pagination");if(!el)return;
    if(p.total<=state.pageSize){el.innerHTML='<span class="page-summary">Showing '+p.total+' source rows</span>';return;}
    el.innerHTML='<span class="page-summary">'+p.start+'–'+p.end+' of '+p.total+'</span><button class="page-btn" data-page="prev" '+(state.page<=1?"disabled":"")+' aria-label="Previous page">‹</button><span class="page-number">Page '+state.page+' / '+p.pages+'</span><button class="page-btn" data-page="next" '+(state.page>=p.pages?"disabled":"")+' aria-label="Next page">›</button>';
  }
  function setCount(s){$("record-count").textContent=s;}
  function setFoot(s){$("panel-foot-note").textContent=s;}
  function setSourceMeta(){
    const c=category[state.category],s=sheets[c.key];
    $("source-sheet-name").textContent=s.title;
    $("source-sheet-id").textContent=String(s.sheetId);
    $("source-range").textContent=c.range;
    $("source-workbook").textContent=DATA.meta.workbookTitle;
    $("source-workbook-link").href=DATA.meta.sourceWorkbookUrl;
    $("import-sheet-name").textContent=s.title;
    $("import-sheet-id").textContent=String(s.sheetId);
    $("import-source-range").textContent=c.range;
  }
  function setFilterOptions(options,visible){
    const select=$("filter-select");
    if(!select)return;
    select.innerHTML=(options||[]).map(o=>'<option value="'+esc(o.value)+'">'+esc(o.label)+'</option>').join("");
    select.style.display=visible===false?"none":"";
    $("record-search").style.display=visible===false?"none":"";
  }
  function setCategory(key){
    if(!state.loaded||!category[key])return;
    state.category=key;state.page=1;state.search="";state.filter="all";
    $("record-search").value="";$("filter-select").value="all";
    document.querySelectorAll(".cat[data-category]").forEach(b=>b.classList.toggle("active",b.dataset.category===key));
    const c=category[key];
    $("panel-icon").textContent=c.icon;
    $("panel-name").textContent=c.name;
    $("panel-description").textContent=c.desc;
    const categoryCanEdit=(c.editable||[]).length>0&&state.permissions.edit===true;
    $("access-status").textContent=categoryCanEdit?"TFI2 LIVE · controlled fields":"TFI2 LIVE · read-only";
    $("access-status").className="status "+(categoryCanEdit?"review":"readonly");
    $("add-record").style.display="none";
    setSourceMeta();
    renderCategory();
  }
  function tableHtml(headers,list,opts){
    opts=opts||{};
    const c=category[state.category];
    let out='<div class="table-wrap '+esc(opts.tableClass||"")+'"><table class="data-table source-table '+esc(opts.tableClass||"")+'"><thead><tr>';
    headers.forEach((h,i)=>{
      let role="";
      if(opts.roles&&opts.roles[i])role='<small class="column-role '+esc(opts.roles[i].kind)+'">'+esc(opts.roles[i].label)+'</small>';
      out+='<th><span class="source-header">'+textCell(h)+'</span>'+role+'</th>';
    });
    if(opts.actions)out+='<th class="action-heading">Admin Actions</th>';
    if(opts.extraHeader)out+='<th>'+esc(opts.extraHeader)+'</th>';
    out+='</tr></thead><tbody>';
    if(!list.length)out+='<tr><td colspan="'+(headers.length+(opts.actions?1:0)+(opts.extraHeader?1:0))+'"><div class="empty-table"><div class="big">⌕</div>No matching source records</div></td></tr>';
    list.forEach(r=>{
      const v=r.values||[];
      out+='<tr data-source-row="'+r.sourceRow+'">';
      v.slice(0,headers.length).forEach((x,i)=>{
        let cell=sourceCell(x,r.sourceRow,i===0);
        if(opts.cellClass&&opts.cellClass[i])cell=cell.replace("<td","<td class=\""+opts.cellClass[i]+"\"");
        if(opts.cellMeta&&opts.cellMeta[i])cell=cell.replace('</td>','<small class="cell-meta">'+esc(opts.cellMeta[i](r))+'</small></td>');
        out+=cell;
      });
      if(opts.actions){
        const canEdit=canEditRow(c.key,r.sourceRow);
        out+='<td class="action-cell"><button class="row-action" data-source-view="'+c.key+':'+r.sourceRow+'">View</button>'+(canEdit?'<button class="row-action" data-source-edit="'+c.key+':'+r.sourceRow+'">Edit</button>':"")+'</td>';
      }
      if(opts.extraCell)out+='<td>'+opts.extraCell(r)+'</td>';
      out+='</tr>';
    });
    out+='</tbody></table></div>';
    return out;
  }
  function renderPaginated(headers,list,opts){
    const p=paginate(list);
    $("data-content").innerHTML=tableHtml(headers,p.items,opts);
    setPagination(p);
    return p;
  }
  function renderProduct(){
    const key="productStandard",all=rows(key,2,110,21);
    const variants=all.filter(r=>nonempty(r.values[0])&&r.values[0]!=="▶");
    const groups=all.filter(r=>r.values[0]==="▶");
    const slots=all.filter(r=>String(r.values[1]||"").includes("+ new variant code"));
    const q=state.search;
    let filtered=all.filter(r=>{
      const v=r.values;
      const type=v[0]==="▶"?"group":String(v[1]||"").includes("+ new variant code")?"slot":nonempty(v[0])?"variant":"blank";
      if(state.filter!=="all"&&state.filter!==type)return false;
      return searchMatch(r,q);
    });
    setCount(variants.length+" product variants · "+groups.length+" family headers · "+slots.length+" reserved source slots");
    setFoot("Exact Product Standard source layout A:U. Formula-derived columns F, G and S are read-only. Source notes: E edited by Production; F and G edited by Plant IE. New family creation requires a verified Entry Map and Product Entry block.");
    const p=paginate(filtered);state.page=p.pages<state.page?1:state.page;
    let html='<div class="source-summary-row"><span class="source-chip">58 populated variants</span><span class="source-chip">'+groups.length+' family headers</span><span class="source-chip">'+slots.length+' reserved new-variant rows</span><span class="source-chip muted-chip">Source rows 2–110</span></div>';
    html+='<div class="table-wrap product-table-wrap"><table class="data-table source-table product-source-table"><thead><tr>';
    const heads=header(key,1,21);
    heads.forEach((h,i)=>{const ro=[5,6,18].includes(i);html+='<th><span class="source-header">'+textCell(h)+'</span>'+(ro?'<small class="column-role formula">FORMULA / READ-ONLY</small>':i===4?'<small class="column-role owner">PRODUCTION INPUT</small>':"")+'</th>';});
    html+='<th class="action-heading">Admin Actions</th></tr></thead><tbody>';
    const pg=p.items;
    if(!pg.length)html+='<tr><td colspan="22"><div class="empty-table">No matching source rows</div></td></tr>';
    pg.forEach(r=>{
      const v=r.values;
      if(v[0]==="▶"){html+='<tr class="family-source-row" data-source-row="'+r.sourceRow+'"><td colspan="22">'+sourceTag(r.sourceRow)+'<strong>'+textCell(v[1])+'</strong>'+(nonempty(v[11])?'<span class="family-note">'+textCell(v[11])+'</span>':"")+'</td></tr>';return;}
      const isSlot=String(v[1]||"").includes("+ new variant code");
      html+='<tr class="'+(isSlot?"reserved-source-row":"")+'" data-source-row="'+r.sourceRow+'">';
      v.forEach((x,i)=>html+=sourceCell(x,r.sourceRow,i===0));
      const editAction=canEditRow("productStandard",r.sourceRow)?'<button class="row-action" data-source-edit="productStandard:'+r.sourceRow+'">Edit</button>':"";
      html+='<td class="action-cell">'+(isSlot?'<span class="status readonly">Reserved slot</span>':nonempty(v[0])?'<button class="row-action" data-source-view="productStandard:'+r.sourceRow+'">View</button>'+editAction:"")+'</td></tr>';
    });
    html+='</tbody></table></div>';
    $("data-content").innerHTML=html;setPagination(p);
  }
  function renderCode(){
    const key="codeMap",heads=header(key,4,2),all=rows(key,5,72,2);
    const productCodes=new Set(rows("productStandard",2,110,21).filter(r=>nonempty(r.values[0])&&r.values[0]!=="▶").map(r=>String(r.values[0]).trim().toUpperCase()));
    let list=all.map(r=>{r.match=productCodes.has(String(r.values[0]).trim().toUpperCase());return r;});
    list=list.filter(r=>(state.filter==="all"||(state.filter==="matched"&&r.match)||(state.filter==="unmatched"&&!r.match))&&searchMatch(r,state.search));
    const matched=list.filter(r=>r.match).length,unmatched=list.filter(r=>!r.match).length;
    setCount("68 source mappings · "+matched+" matching and "+unmatched+" unmatched in current view");
    setFoot("Code Map is not one-to-one with Product Standard. Across the full source: 32 codes are present in both, 36 Code Map codes have no Product Standard variant, and 26 Product Standard variants have no Code Map mapping. Preserve unmatched references for Admin review.");
    const p=paginate(list),html=tableHtml(heads,p.items,{actions:true,extraHeader:"Product Standard match",extraCell:r=>r.match?'<span class="status editable">Matched</span>':'<span class="status review">No matching variant</span>'});
    $("data-content").innerHTML='<div class="source-callout warning"><strong>Reconciliation exception.</strong> Unmatched codes are preserved exactly as found. The UI does not create missing Product Standard variants or auto-map codes.</div>'+html;
    setPagination(p);
  }
  function renderYield(){
    const key="yieldMap",heads=header(key,4,23),all=rows(key,5,43,23);
    let list=all.filter(r=>(state.filter==="all"||(state.filter==="target"&&nonempty(r.values[12]))||(state.filter==="no-target"&&!nonempty(r.values[12])))&&searchMatch(r,state.search));
    setCount("39 mapped product families · 12 input columns B:M · 8 formula helpers P:W");
    setFoot("Product family A and last-data-row info N are reference fields. B:M are source input fields. P:W are formula-generated helper outputs and remain read-only. No Yield Map targets are silently approved or changed.");
    const roles=heads.map((_,i)=>i>=1&&i<=12?{label:"INPUT",kind:"input"}:i>=15?{label:"FORMULA",kind:"formula"}:i===0||i===13?{label:"REFERENCE",kind:"readonly"}:null);
    const p=paginate(list);
    $("data-content").innerHTML='<div class="source-callout warning"><strong>Source instruction:</strong> '+textCell(val(key,2,0))+'<br><span>'+textCell(val(key,2,1))+'</span></div>'+tableHtml(heads,p.items,{actions:true,tableClass:"yield-source-table",roles});
    setPagination(p);
  }
  function renderEntry(){
    const key="entryMap",heads=header(key,1,5),list=rows(key,2,40,5).filter(r=>searchMatch(r,state.search));
    setCount("39 populated family-to-block mappings · source rows 2–40");
    setFoot("Read-only structure. Do not change Product (dropdown) or Block name. A new family requires a verified BLK_xx named range and its complete Product Entry block.");
    const note=val(key,43,0);
    const p=paginate(list);
    $("data-content").innerHTML=tableHtml(heads,p.items,{tableClass:"entry-source-table"})+(nonempty(note)?'<div class="source-callout warning"><strong>Source instruction:</strong> '+textCell(note)+'</div>':"");
    setPagination(p);
  }
  function lastNonemptyRow(key,col){
    const a=sheets[key].values||[];let last=1;
    for(let i=1;i<a.length;i++)if(nonempty(a[i]?.[col]))last=i+1;
    return last;
  }
  function rangeFor(key,col){
    const letter=colLetter(col+1),last=lastNonemptyRow(key,col);
    return letter+"2:"+letter+last;
  }
  function kpiCard(title,cols,rangeLabel){
    const key="kpiSetup",heads=header(key,1,20),source=rows(key,2,129,20);
    let list=source.filter(r=>cols.some(c=>nonempty(r.values[c]))&&searchMatch({values:cols.map(c=>r.values[c])},state.search));
    if(!list.length)return "";
    let h='<article class="kpi-reference-card"><div class="kpi-card-head"><strong>'+esc(title)+'</strong><span>'+esc(rangeLabel)+'</span></div><div class="kpi-card-body"><table class="mini-source-table"><thead><tr>';
    cols.forEach(c=>h+='<th>'+textCell(heads[c])+'</th>');
    h+='</tr></thead><tbody>';
    list.forEach(r=>{
      h+='<tr data-source-row="'+r.sourceRow+'">';
      cols.forEach((c,i)=>{
        const v=r.values[c],protectedValue=(c===4&&String(v)==="All")||(c===0&&String(v)==="Daily");
        h+='<td>'+(i===0?sourceTag(r.sourceRow):"")+(nonempty(v)?textCell(v):"")+(protectedValue?'<small class="protected-tag">PROTECTED</small>':"")+'</td>';
      });
      h+='</tr>';
    });
    h+='</tbody></table></div><div class="kpi-card-foot">'+list.length+' values shown · source rows '+list[0].sourceRow+'–'+list[list.length-1].sourceRow+'</div></article>';
    return h;
  }
  function renderKpi(){
    setCount("127 product codes + protected All · multiple source reference groups");
    setFoot("Paired source fields stay together: Month / Month #, DT Code / DT Description / Y/N, and DT CODE / DT GROUP. Product Code 'All' and View 'Daily' are protected. No delete/clear action.");
    setFilterOptions([],false);
    const cards=[
      kpiCard("View", [0], "A2:A4"),
      kpiCard("Calendar", [1,2,3], "B2:D53"),
      kpiCard("Product Code", [4], "E2:E129"),
      kpiCard("Machine", [5], "F2:F54"),
      kpiCard("Line", [6], "G2:G5"),
      kpiCard("Downtime Reference", [7,8,9], "H2:J9"),
      kpiCard("KPI Settings", [11,12], "L2:M5"),
      kpiCard("Downtime Code Group", [14,15], "O2:P7"),
      kpiCard("Product Name List", [17], "R2:R40"),
      kpiCard("Year List", [19], "T2:T5")
    ].join("");
    $("data-content").innerHTML='<div class="kpi-intro"><span class="source-chip">Source worksheet: KPI Setup</span><span class="source-chip">Paired reference fields preserved</span><span class="source-chip muted-chip">Read-only preview</span></div><div class="kpi-reference-grid">'+cards+'</div>';
    $("pagination").innerHTML='<span class="page-summary">All source reference groups</span>';
  }
  function dprTabs(){
    return '<div class="subnav"><button data-dpr-view="family" class="'+(state.dprView==="family"?"active":"")+'">Product Family Codes</button><button data-dpr-view="lists" class="'+(state.dprView==="lists"?"active":"")+'">Independent Reference Lists</button><button data-dpr-view="helpers" class="'+(state.dprView==="helpers"?"active":"")+'">Helper Outputs</button></div>';
  }
  function renderDpr(){
    const key="dprLegend",heads=header(key,2,40),all=rows(key,3,119,40);
    let body="";
    if(state.dprView==="family"){
      const familyCols=Array.from({length:32},(_,i)=>i+8).filter(i=>nonempty(heads[i]));
      if(!familyCols.includes(state.dprFamily))state.dprFamily=familyCols[0]||8;
      const options=familyCols.map(i=>'<option value="'+i+'" '+(i===state.dprFamily?"selected":"")+'>'+esc(heads[i])+'</option>').join("");
      let list=all.filter(r=>nonempty(r.values[state.dprFamily])&&String(r.values[state.dprFamily]).toLowerCase().includes(state.search));
      setCount("116 unique product codes across 119 product-family list entries · "+list.length+" codes in selected family");
      setFoot("Product-specific code lists are in DPR LEGEND columns I:AN. Family headings and code values are preserved in source order. No new code is auto-created.");
      const p=paginate(list);
      body='<div class="dpr-toolbar"><label>Product family<select id="dpr-family-select" class="select">'+options+'</select></label><span class="source-chip">Source column '+colLetter(state.dprFamily+1)+'</span></div>'+tableHtml(["DPR Product Code"],p.items.map(r=>({sourceRow:r.sourceRow,values:[r.values[state.dprFamily]]})),{tableClass:"dpr-family-table"});
      setPagination(p);
    }else if(state.dprView==="lists"){
      const cols=[1,2,3,4,5],list=all.filter(r=>searchMatch({values:cols.map(c=>r.values[c])},state.search));
      setCount("Independent reference lists · source columns B:F");
      setFoot("These source lists include Down time, Factor Prod DT, Factor coding DT, Item Status and Prod review. Preserve their exact source labels and option values.");
      const p=paginate(list);
      body=tableHtml(cols.map(c=>heads[c]),p.items.map(r=>({sourceRow:r.sourceRow,values:cols.map(c=>r.values[c])})),{tableClass:"dpr-list-table"});
      setPagination(p);
    }else{
      const cols=[6,7],list=all.filter(r=>searchMatch({values:cols.map(c=>r.values[c])},state.search));
      setCount("Formula/helper outputs · source columns G:H");
      setFoot("Production Line and DPR CODES are helper outputs. Keep these fields read-only; the helper formula issue omitting TMRMB-24-380 is documented and no source formula was changed.");
      const p=paginate(list);
      body=tableHtml(cols.map(c=>heads[c]),p.items.map(r=>({sourceRow:r.sourceRow,values:cols.map(c=>r.values[c])})),{tableClass:"dpr-helper-table",roles:[{label:"HELPER",kind:"formula"},{label:"HELPER",kind:"formula"}]});
      setPagination(p);
    }
    $("data-content").innerHTML=dprTabs()+'<div class="source-callout"><strong>Source layout:</strong> B:F independent reference lists · G:H formula/helper outputs · I:AN product-specific code lists. The source workbook remains unchanged.</div>'+body;
  }
  function renderDmp(){
    const key="dmpLegend",heads=header(key,1,4),notes=sheets[key].notes||[],noteMap=new Map(notes.map(n=>[n.sourceRow,n.status]));
    let list=rows(key,2,70,4).map(r=>({...r,note:noteMap.get(r.sourceRow)||""}));
    list=list.filter(r=>(state.filter==="all"||(state.filter==="resigned"&&r.note==="RESIGNED")||(state.filter==="awol"&&r.note==="AWOL"))&&searchMatch(r,state.search));
    setCount("69 source rows · 10 source notes retained (resigned / AWOL)");
    setFoot("Worker-name cell notes are preserved as source status signals. Blank source names remain blank; no person is inferred or silently substituted. Confirm current employment status with the authorized manpower custodian.");
    const p=paginate(list);
    let html='<div class="source-callout warning"><strong>Worker status notes:</strong> 10 source notes mark cells as resigned or AWOL. The note status is shown separately from the source name and is not treated as a verified live HR status.</div>';
    html+='<div class="table-wrap"><table class="data-table source-table"><thead><tr>'+heads.map(h=>'<th>'+textCell(h)+'</th>').join("")+'<th>Source Note</th><th>Admin Actions</th></tr></thead><tbody>';
    if(!p.items.length)html+='<tr><td colspan="6"><div class="empty-table">No matching source rows</div></td></tr>';
    p.items.forEach(r=>{
      html+='<tr data-source-row="'+r.sourceRow+'">';
      r.values.forEach((v,i)=>html+=sourceCell(v,r.sourceRow,i===0));
      html+='<td>'+(r.note?'<span class="status '+(r.note==="AWOL"?"review":"readonly")+'">'+r.note+'</span>':"")+'</td>';
      const editAction=canEditRow("dmpLegend",r.sourceRow)?'<button class="row-action" data-source-edit="dmpLegend:'+r.sourceRow+'">Edit</button>':"";
      html+='<td class="action-cell"><button class="row-action" data-source-view="dmpLegend:'+r.sourceRow+'">View</button>'+editAction+'</td></tr>';
    });
    html+='</tbody></table></div>';
    $("data-content").innerHTML=html;setPagination(p);
  }
  function renderManpower(){
    const key="manpower",heads=header(key,3,5),all=rows(key,4,448,5);
    const positions=[...new Set(all.map(r=>String(r.values[1]||"").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
    let list=all.filter(r=>(state.filter==="all"||String(r.values[1]||"").trim()===state.filter)&&searchMatch(r,state.search));
    setCount("445 source records · 430 distinct employee names");
    setFoot("Repeated employee-name rows are retained separately in original source order. No automatic merge, deduplication or deletion is performed.");
    const p=paginate(list);
    $("data-content").innerHTML='<div class="source-callout"><strong>Source handling:</strong> duplicate names remain separate source records. Use the source-row label to trace each entry back to MANPOWER.</div>'+tableHtml(heads,p.items,{actions:true,tableClass:"manpower-table"});
    setPagination(p);
    setFilterOptions([{value:"all",label:"All positions"},...positions.map(v=>({value:v,label:v}))],true);
    $("filter-select").value=state.filter;
  }
  function scheduleTabs(){
    return '<div class="subnav"><button data-schedule-view="codes" class="'+(state.scheduleView==="codes"?"active":"")+'">Production Codes</button><button data-schedule-view="references" class="'+(state.scheduleView==="references"?"active":"")+'">Reference Lists</button><button data-schedule-view="mapping" class="'+(state.scheduleView==="mapping"?"active":"")+'">Product Standard Field Map</button></div>';
  }
  function renderSchedule(){
    const key="scheduleLists",all=rows(key,2,101,12),heads=header(key,1,12);
    let body="";
    if(state.scheduleView==="codes"){
      const list=all.filter(r=>searchMatch({values:r.values.slice(0,2)},state.search));
      setCount("100 production-code rows · columns A:B");
      setFoot("Product Name (group) and ALL PRODUCTION CODES are automatically refreshed from Product Standard. Source note says not to edit columns A, B, K or L.");
      const p=paginate(list);
      body=tableHtml([heads[0],heads[1]],p.items.map(r=>({sourceRow:r.sourceRow,values:r.values.slice(0,2)})),{tableClass:"schedule-code-table"});
      setPagination(p);
    }else if(state.scheduleView==="references"){
      const cols=[3,4,5,6];
      setCount("Production Schedule reference options · columns D:G");
      setFoot("Reference lists are shown exactly as stored in Schedule Lists. No source values are added or normalized.");
      body='<div class="schedule-reference-grid">';
      cols.forEach(c=>{
        const items=all.map(r=>({sourceRow:r.sourceRow,value:r.values[c]})).filter(x=>nonempty(x.value)&&(!state.search||String(x.value).toLowerCase().includes(state.search)));
        body+='<article class="schedule-reference-card"><header><strong>'+textCell(heads[c])+'</strong><span>'+colLetter(c+1)+'2:'+colLetter(c+1)+lastNonemptyRow(key,c)+'</span></header><div class="schedule-reference-list">';
        items.forEach(x=>body+='<div class="schedule-reference-item">'+sourceTag(x.sourceRow)+'<span>'+textCell(x.value)+'</span></div>');
        body+='</div></article>';
      });
      body+='</div>';$("pagination").innerHTML='<span class="page-summary">Source reference lists</span>';
    }else{
      const mapping=rows(key,2,8,12).map(r=>({sourceRow:r.sourceRow,values:r.values.slice(10,12)})).filter(r=>searchMatch(r,state.search));
      setCount("Product Standard field-to-column mapping · columns K:L");
      setFoot("K:L are source helper/configuration fields. A, B, K and L are explicitly marked 'Huwag galawin' in the source sheet and remain read-only.");
      const p=paginate(mapping);
      body='<div class="source-callout warning"><strong>Source instruction:</strong> '+textCell(val(key,1,7))+'</div>'+tableHtml([heads[10],heads[11]],p.items,{tableClass:"schedule-map-table"});
      setPagination(p);
    }
    $("data-content").innerHTML=scheduleTabs()+body;
  }
  function renderCategory(){
    if(!state.loaded)return;
    const c=category[state.category];
    $("panel-name").textContent=c.name;$("panel-description").textContent=c.desc;
    const categoryCanEdit=(c.editable||[]).length>0&&state.permissions.edit===true;
    $("access-status").textContent=categoryCanEdit?"TFI2 LIVE · controlled fields":"TFI2 LIVE · read-only";
    $("access-status").className="status "+(categoryCanEdit?"review":"readonly");
    state.search=$("record-search").value.trim().toLowerCase();
    if(state.category==="product"){
      setFilterOptions([{value:"all",label:"All source rows"},{value:"variant",label:"Product variants"},{value:"group",label:"Family headers"},{value:"slot",label:"Reserved new-variant slots"}],true);
      $("filter-select").value=state.filter;renderProduct();
    }else if(state.category==="code"){
      setFilterOptions([{value:"all",label:"All mappings"},{value:"matched",label:"Matched Product Standard"},{value:"unmatched",label:"No Product Standard variant"}],true);
      $("filter-select").value=state.filter;renderCode();
    }else if(state.category==="yield"){
      setFilterOptions([{value:"all",label:"All families"},{value:"target",label:"With target value"},{value:"no-target",label:"Blank target"}],true);
      $("filter-select").value=state.filter;renderYield();
    }else if(state.category==="entry"){
      setFilterOptions([],false);renderEntry();
    }else if(state.category==="kpi"){
      setFilterOptions([],false);renderKpi();
    }else if(state.category==="dpr"){
      setFilterOptions([],false);renderDpr();
    }else if(state.category==="dmp"){
      setFilterOptions([{value:"all",label:"All DMP rows"},{value:"resigned",label:"Source note: resigned"},{value:"awol",label:"Source note: AWOL"}],true);
      $("filter-select").value=state.filter;renderDmp();
    }else if(state.category==="manpower"){
      renderManpower();
    }else if(state.category==="schedule"){
      setFilterOptions([],false);renderSchedule();
    }
    $("data-content").dataset.category=state.category;
    document.body.dataset.tfiReady="true";
    document.body.dataset.tfiMasterDataCategory=state.category;
  }
  function fieldInput(label,index,value,editable,categoryKey){
    const type="text";
    let options=null;
    if(categoryKey==="productStandard"&&index===2)options=["AGRI LINE","MEAT LINE"];
    if(categoryKey==="productStandard"&&index===17)options=["Yes","No"];
    if(categoryKey==="productStandard"&&index===19)options=["8","10","12"];
    if(categoryKey==="codeMap"&&index===1)options=rows("entryMap",2,40,5).map(r=>r.values[0]).filter(nonempty);
    const name="field_"+index;
    let control;
    if(options){
      control='<select name="'+name+'" '+(!editable?"disabled":"")+'><option value=""></option>'+options.map(o=>'<option value="'+esc(o)+'" '+(String(o)===String(value)?"selected":"")+'>'+esc(o)+'</option>').join("")+'</select>';
    }else{
      control='<input type="'+type+'" name="'+name+'" value="'+esc(value)+'" '+(!editable?"readonly":"")+' />';
    }
    const note=categoryKey==="productStandard"&&index===4?" · Production-owned":categoryKey==="productStandard"&&[5,6].includes(index)?" · Plant IE / formula field":categoryKey==="productStandard"&&index===18?" · Formula-derived":"";
    return '<div class="field"><label>'+textCell(label)+esc(note)+'</label>'+control+'</div>';
  }
  function openRecordModal(categoryKey,sourceRow,mode){
    const c=Object.values(category).find(x=>x.key===categoryKey);
    if(!c)return;
    const vals=pad(sheets[categoryKey].values[sourceRow-1]||[],c.width);
    const heads=header(categoryKey,c.header,c.width);
    const meta=rowMeta(categoryKey,sourceRow);
    const canEdit=mode==="edit"&&state.permissions.edit===true&&!!meta?.row_editable&&(c.editable||[]).length>0;
    if(mode==="edit"&&!canEdit)mode="view";
    state.modal={categoryKey,sourceRow,mode};
    $("modal-title").textContent=(canEdit?"Edit record · ":"Source record · ")+c.name;
    $("modal-sub").textContent="Source row "+sourceRow+" · "+sheets[categoryKey].title+" · Sheet ID "+sheets[categoryKey].sheetId;
    let fields="";
    heads.forEach((h,i)=>fields+=fieldInput(h,i,vals[i],canEdit&&c.editable.includes(i),categoryKey));
    $("form-fields").innerHTML=fields;
    $("modal-note").textContent=canEdit?"Saving writes the approved field changes to TFI2 and records a revision. The original Google Spreadsheet snapshot remains unchanged. Protected formula and helper fields stay read-only.":"This record is loaded from TFI2. The original source values are preserved separately, and this view does not change the record.";
    $("record-form").querySelector('button[type="submit"]').style.display=canEdit?"inline-flex":"none";
    $("record-form").querySelector('button[type="submit"]').textContent="Save to TFI2";
    $("revision-history").hidden=true;
    $("revision-list").innerHTML="";
    $("view-history").disabled=false;
    $("view-history").textContent="View history";
    $("record-modal").classList.add("open");
  }
  function closeRecordModal(){
    $("record-modal").classList.remove("open");state.modal=null;
    $("record-form").querySelector('button[type="submit"]').style.display="inline-flex";
    $("revision-history").hidden=true;
    $("revision-list").innerHTML="";
    $("view-history").disabled=false;
    $("view-history").textContent="View history";
  }
  async function loadRevisionHistory(){
    if(!state.modal)return;
    const meta=rowMeta(state.modal.categoryKey,state.modal.sourceRow);
    const panel=$("revision-history"),list=$("revision-list"),button=$("view-history");
    if(!meta?.id){toast("Revision history is unavailable for this source row.");return;}
    panel.hidden=false;
    list.innerHTML='<div class="revision-loading">Loading revision history from TFI2...</div>';
    button.disabled=true;button.textContent="Loading...";
    try{
      const response=await fetch("/api/master-data/rows/"+encodeURIComponent(meta.id)+"/revisions",{credentials:"same-origin"});
      const payload=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(payload.error||"Unable to load revision history.");
      const revisions=Array.isArray(payload.revisions)?payload.revisions:[];
      if(!revisions.length){
        list.innerHTML='<div class="revision-empty">No revisions have been recorded for this record.</div>';
        return;
      }
      list.innerHTML=revisions.map(revision=>{
        const columns=Array.isArray(revision.changed_columns)?revision.changed_columns:[];
        const before=Array.isArray(revision.before_values)?revision.before_values:[];
        const after=Array.isArray(revision.after_values)?revision.after_values:[];
        const changes=columns.map(column=>{
          let index=0;
          for(const char of String(column))index=index*26+char.charCodeAt(0)-64;
          index-=1;
          return '<div class="revision-change"><strong>'+esc(column)+'</strong><span class="revision-change-values"><span class="before">'+esc(before[index]??"—")+'</span> → <span class="after">'+esc(after[index]??"—")+'</span></span></div>';
        }).join("");
        const changedAt=revision.changed_at?new Date(revision.changed_at).toLocaleString():"Date unavailable";
        const reason=revision.change_reason?'<div class="revision-reason">Reason: '+esc(revision.change_reason)+'</div>':"";
        return '<article class="revision-item"><div class="revision-item-head"><strong>Revision '+esc(revision.version)+'</strong><span>'+esc(changedAt)+'</span></div><div class="revision-meta">Changed fields: '+esc(columns.join(", ")||"Not specified")+'</div>'+reason+'<div class="revision-changes">'+changes+'</div></article>';
      }).join("");
    }catch(error){
      list.innerHTML='<div class="revision-empty">'+esc(error.message||"Unable to load revision history.")+'</div>';
    }finally{
      button.disabled=false;button.textContent="Refresh history";
    }
  }
  function toast(msg){
    const el=document.createElement("div");el.className="toast";el.textContent=msg;document.body.appendChild(el);setTimeout(()=>el.remove(),2600);
  }
  function openImportModal(){
    setSourceMeta();$("spreadsheet-link").value="";
    $("link-feedback").textContent="Paste the approved TFI Google Spreadsheet link, then validate its source ID.";
    $("link-feedback").className="link-feedback";
    $("import-detected-id").textContent="Not validated";
    $("import-submit").disabled=true;
    $("import-modal").classList.add("open");
  }
  function closeImportModal(){$("import-modal").classList.remove("open");}
  function validateSpreadsheetLink(){
    const raw=$("spreadsheet-link").value.trim();
    const m=raw.match(/docs\.google\.com\/spreadsheets\/d\/([A-Za-z0-9_-]+)/)||raw.match(/^([A-Za-z0-9_-]{25,})$/);
    if(!raw||!m){
      $("link-feedback").textContent="Invalid link. Paste a Google Sheets URL or spreadsheet ID.";
      $("link-feedback").className="link-feedback invalid";
      $("import-detected-id").textContent="Invalid";
      $("import-submit").disabled=true;
      document.body.dataset.tfiSpreadsheetLinkStatus="invalid";
      return;
    }
    const found=m[1];$("import-detected-id").textContent=found;
    if(found!==DATA.meta.spreadsheetId){
      $("link-feedback").textContent="This is not the current approved TFI source workbook. No import can proceed.";
      $("link-feedback").className="link-feedback invalid";
      $("import-submit").disabled=true;
      document.body.dataset.tfiSpreadsheetLinkStatus="wrong-source";
      return;
    }
    $("link-feedback").textContent="Valid source workbook link format and matching approved spreadsheet ID. Google access and import permissions have not been checked.";
    $("link-feedback").className="link-feedback valid";
    $("import-submit").disabled=true;
    document.body.dataset.tfiSpreadsheetLinkStatus="valid";
  }
  async function loadMasterDataFromApi(){
    const categoryResponse=await fetch("/api/master-data/categories",{credentials:"same-origin"});
    const categoryPayload=await categoryResponse.json().catch(()=>({}));
    if(!categoryResponse.ok)throw new Error(categoryPayload.error||"Unable to load Master Data permissions from TFI2.");
    const categoryRows=categoryPayload.categories;
    if(!Array.isArray(categoryRows)||categoryRows.length!==9)throw new Error("TFI2 did not return the complete nine-category Master Data registry.");
    state.permissions=categoryPayload.permissions||{view:false,edit:false};
    const sourceMap=[
      ["productStandard","product_standard"],
      ["codeMap","code_map"],
      ["yieldMap","yield_map"],
      ["entryMap","entry_map"],
      ["kpiSetup","kpi_setup"],
      ["dprLegend","dpr_legend"],
      ["dmpLegend","dmp_legend"],
      ["manpower","manpower"],
      ["scheduleLists","schedule_lists"]
    ];
    for(const [localKey,dbKey] of sourceMap){
      const categoryInfo=categoryRows.find(item=>item.category_key===dbKey);
      if(!categoryInfo)throw new Error("Missing TFI2 category: "+dbKey);
      const response=await fetch("/api/master-data/"+encodeURIComponent(dbKey)+"/rows?page=1&page_size=500",{credentials:"same-origin"});
      const payload=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(payload.error||"Unable to load "+categoryInfo.display_name+" from TFI2.");
      if(!Array.isArray(payload.rows)||payload.total!==categoryInfo.source_row_count||payload.rows.length!==categoryInfo.source_row_count){
        throw new Error("The TFI2 source-row count does not match the verified baseline for "+categoryInfo.display_name+".");
      }
      const values=Array.from({length:categoryInfo.source_row_count},()=>Array(categoryInfo.source_column_count).fill(null));
      const rowMap={};
      const notes=[];
      payload.rows.forEach(record=>{
        const sourceRow=Number(record.source_row_number);
        if(!Number.isInteger(sourceRow)||sourceRow<1||sourceRow>categoryInfo.source_row_count)throw new Error("An invalid source row was returned for "+dbKey+".");
        values[sourceRow-1]=pad(record.current_values,categoryInfo.source_column_count);
        rowMap[sourceRow]=record;
        (record.source_notes||[]).forEach(note=>notes.push({sourceRow,column:note.column||"",status:note.status||""}));
      });
      sheets[localKey].values=values;
      if(localKey==="dmpLegend")sheets[localKey].notes=notes;
      state.rowMeta[localKey]=rowMap;
      state.categoryMeta[dbKey]=categoryInfo;
    }
    state.loaded=true;
    document.body.dataset.tfiMasterDataSource="tfi2";
    document.body.dataset.tfiMasterDataRows="1135";
  }

  document.querySelectorAll(".cat[data-category]").forEach(b=>b.addEventListener("click",()=>setCategory(b.dataset.category)));
  $("record-search").addEventListener("input",()=>{state.page=1;renderCategory();});
  $("global-search").addEventListener("input",e=>{$("record-search").value=e.target.value;state.page=1;renderCategory();});
  $("filter-select").addEventListener("change",e=>{state.filter=e.target.value;state.page=1;renderCategory();});
  $("data-content").addEventListener("click",e=>{
    const view=e.target.closest("[data-source-view]"),edit=e.target.closest("[data-source-edit]");
    if(view||edit){
      const parts=(view||edit).dataset[view?"sourceView":"sourceEdit"].split(":");
      openRecordModal(parts[0],Number(parts[1]),view?"view":"edit");return;
    }
    const page=e.target.closest("[data-page]");
    if(page){if(page.dataset.page==="prev")state.page--;else state.page++;renderCategory();return;}
    const dpr=e.target.closest("[data-dpr-view]");
    if(dpr){state.dprView=dpr.dataset.dprView;state.page=1;renderCategory();return;}
    const sched=e.target.closest("[data-schedule-view]");
    if(sched){state.scheduleView=sched.dataset.scheduleView;state.page=1;renderCategory();return;}
  });
  $("data-content").addEventListener("change",e=>{
    if(e.target.id==="dpr-family-select"){state.dprFamily=Number(e.target.value);state.page=1;renderCategory();}
  });
  $("record-form").addEventListener("submit",async e=>{
    e.preventDefault();
    if(!state.modal||state.modal.mode!=="edit")return;
    const c=Object.values(category).find(x=>x.key===state.modal.categoryKey);
    const key=state.modal.categoryKey,sourceRow=state.modal.sourceRow;
    const meta=rowMeta(key,sourceRow);
    if(!c||!meta?.id||!canEditRow(key,sourceRow)){toast("This source row is protected from editing.");return;}
    const row=pad(sheets[key].values[sourceRow-1]||[],c.width);
    const form=new FormData(e.target);
    const changes={};
    (c.editable||[]).forEach(i=>{
      const value=form.get("field_"+i);
      if(value!==null&&String(value)!==String(row[i]??""))changes[colLetter(i+1)]=String(value);
    });
    if(!Object.keys(changes).length){closeRecordModal();toast("No changes to save.");return;}
    const submit=e.target.querySelector('button[type="submit"]');
    submit.disabled=true;submit.textContent="Saving...";
    try{
      const response=await fetch("/api/master-data/rows/"+encodeURIComponent(meta.id),{
        method:"PATCH",
        credentials:"same-origin",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          expected_version:meta.version,
          changes,
          change_reason:"Updated from the TFI2 Master Data screen"
        })
      });
      const result=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(result.error||"TFI2 could not save this Master Data change.");
      const updated=pad(result.current_values||row,c.width);
      sheets[key].values[sourceRow-1]=updated;
      meta.current_values=updated;
      meta.version=result.version;
      meta.updated_at=result.updated_at||null;
      closeRecordModal();renderCategory();
      toast(result.changed===false?"No changes were required.":"Saved to TFI2 · revision "+result.version);
    }catch(error){
      toast(error.message||"Unable to save this record.");
    }finally{
      submit.disabled=false;submit.textContent="Save to TFI2";
    }
  });
  $("view-history").addEventListener("click",loadRevisionHistory);
  $("close-modal").addEventListener("click",closeRecordModal);
  $("cancel-modal").addEventListener("click",closeRecordModal);
  $("record-modal").addEventListener("click",e=>{if(e.target===$("record-modal"))closeRecordModal();});
  $("record-modal").addEventListener("keydown",e=>{if(e.key==="Escape")closeRecordModal();});
  $("open-import").addEventListener("click",openImportModal);
  $("close-import").addEventListener("click",closeImportModal);
  $("cancel-import").addEventListener("click",closeImportModal);
  $("import-modal").addEventListener("click",e=>{if(e.target===$("import-modal"))closeImportModal();});
  $("link-validate").addEventListener("click",validateSpreadsheetLink);
  $("spreadsheet-link").addEventListener("input",()=>{document.body.dataset.tfiSpreadsheetLinkStatus="pending";$("import-submit").disabled=true;});
  $("import-modal").addEventListener("keydown",e=>{if(e.key==="Escape")closeImportModal();});
  $("data-content").innerHTML='<div class="source-callout">Connecting to TFI2 and loading the verified Master Data records...</div>';
  loadMasterDataFromApi().then(()=>{
    document.body.dataset.tfiSourceWorkbookId=DATA.meta.spreadsheetId;
    document.body.dataset.tfiMasterDataCategoryCount="9";
    setCategory("product");
    window.TFI_MASTER_DATA_UI={source:DATA.meta,categories:category,state:state,dataSource:"TFI2"};
  }).catch(error=>{
    $("data-content").innerHTML='<div class="source-callout warning"><strong>Master Data could not be loaded from TFI2.</strong><br>'+esc(error.message||"Please sign in again or contact the system administrator.")+'</div>';
    $("record-count").textContent="TFI2 data unavailable";
    $("panel-foot-note").textContent="The local reference preview is not being used as a fallback. No edit can be made until the live TFI2 data is available.";
    document.body.dataset.tfiReady="false";
    document.body.dataset.tfiMasterDataSource="unavailable";
  });
})();