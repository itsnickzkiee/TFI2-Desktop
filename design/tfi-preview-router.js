/* TFI preview navigation: on-demand lazy module loading with a small persistent LRU cache. */
(function(){
  "use strict";
  const params=new URLSearchParams(window.location.search);
  const embedded=window.self!==window.top||params.get("embedded")==="1";
  if(embedded)document.body.classList.add("tfi-embedded-preview");

  const routes={
    "dashboard":"dashboard-preview.html",
    "product entry":"product-entry-preview.html",
    "production entry":"production-entry-preview.html",
    "production schedule":"production-schedule-preview.html",
    "dmp production":"dmp-production-preview.html",
    "dmr production":"dmr-production-preview.html",
    "dmr coding":"dmr-coding-preview.html",
    "hourly meat":"hourly-meat-preview.html",
    "hourly coding":"hourly-coding-preview.html",
    "hourly agri":"hourly-agri-preview.html",
    "oee":"oee-preview.html",
    "productivity":"productivity-preview.html",
    "yield monitoring":"yield-monitoring-preview.html",
    "pr monitoring":"pr-monitoring-preview.html",
    "reports":"reports-reconciliation-preview.html",
    "reports & reconciliation":"reports-reconciliation-preview.html",
    "production summary":"reports-reconciliation-preview.html",
    "schedule summary":"schedule-summary-preview.html",
    "summary":"summary-preview.html",
    "removed rows":"removed-rows-preview.html",
    "coding dpr":"coding-dpr-preview.html",
    "co qa":"co-qa-preview.html",
    "non-prod":"non-prod-preview.html",
    "spreadsheet import":"spreadsheet-import-center-preview.html",
    "module import inbox":"module-import-inbox-preview.html",
    "import history":"import-history-preview.html",
    "master data":"master-data-preview.html",
    "users & access":"users-access-preview.html",
    "security & activity":"security-activity-preview.html",
    "security alert rules & notifications":"security-alert-rules-preview.html",
    "session management":"session-management-preview.html",
    "audit trail":"audit-trail-preview.html",
    "settings":"system-settings-preview.html"
  };

  const MAX_CACHED_MODULES=6;
  let stage=null;
  let fallback=null;
  let loadingIndicator=null;
  let activeFrame=null;
  let activeModule="";
  let latestRequest=0;
  let pendingModule="";
  let frameSequence=0;
  let usageClock=0;
  const moduleFrames=new Map();
  const FRAME_ROUTE_STORAGE_KEY="tfi-preview-frame-routes:v1";

  function readStoredFrameRoutes(){
    try{
      const value=JSON.parse(window.sessionStorage.getItem(FRAME_ROUTE_STORAGE_KEY)||"{}");
      return value&&typeof value==="object"&&!Array.isArray(value)?value:{};
    }catch(_error){return {};}
  }

  function getStoredFrameRoute(page){
    const routesByModule=readStoredFrameRoutes();
    const key=String(page||"").trim().toLowerCase();
    const href=routesByModule[key];
    if(!href)return "";
    try{
      const saved=new URL(href,window.location.href);
      if(saved.origin!==window.location.origin||!saved.pathname.startsWith("/design/"))return "";
      return saved.href;
    }catch(_error){return "";}
  }

  function saveFrameRoute(page,href){
    try{
      const current=new URL(href,window.location.href);
      if(current.origin!==window.location.origin||!current.pathname.startsWith("/design/"))return;
      const routesByModule=readStoredFrameRoutes();
      routesByModule[String(page||"").trim().toLowerCase()]=current.href;
      window.sessionStorage.setItem(FRAME_ROUTE_STORAGE_KEY,JSON.stringify(routesByModule));
    }catch(_error){}
  }

  const sidebarState=()=>document.body.classList.contains("tfi-sidebar-collapsed")?"collapsed":"expanded";

  function setActive(page){
    const nav=document.querySelector(".sidebar nav");
    if(!nav)return;
    const rawKey=String(page||"").trim().toLowerCase();
    const key=["production summary","schedule summary","summary","removed rows"].includes(rawKey)?"reports":rawKey;
    nav.querySelectorAll(".nav-link[data-page]").forEach(link=>{
      const active=link.dataset.page.trim().toLowerCase()===key;
      link.classList.toggle("active",active);
      if(active)link.setAttribute("aria-current","page");
      else link.removeAttribute("aria-current");
    });
  }

  function embeddedUrl(page,requestId,routeContext){
    const key=String(page||"").trim().toLowerCase();
    const target=routes[key]||"module-placeholder-preview.html";
    const query=new URLSearchParams({
      embedded:"1",
      module:String(page).trim(),
      sidebar:sidebarState(),
      tfiRequest:String(requestId||"")
    });
    if(key==="module import inbox"&&routeContext){
      Object.entries(routeContext).forEach(([name,value])=>{
        if(value!==undefined&&value!==null&&String(value)!=="")query.set(name,String(value));
      });
    }
    if(key==="settings"&&routeContext?.section)query.set("section",String(routeContext.section));
    return target+"?"+query.toString();
  }

  function updateDiagnostics(){
    document.body.dataset.tfiNavMode="lazy-cache";
    document.body.dataset.tfiModuleCacheSize=String(moduleFrames.size);
    document.body.dataset.tfiActiveModule=activeModule;
    document.body.dataset.tfiPendingModule=pendingModule;
  }

  function showLoading(page){
    if(!stage||!loadingIndicator)return;
    loadingIndicator.querySelector("[data-tfi-loading-label]").textContent="Opening "+page+"…";
    stage.classList.add("is-loading");
    loadingIndicator.setAttribute("aria-hidden","false");
    updateDiagnostics();
  }

  function hideLoading(){
    if(!stage||!loadingIndicator)return;
    stage.classList.remove("is-loading");
    loadingIndicator.setAttribute("aria-hidden","true");
    updateDiagnostics();
  }

  function ensureStage(main){
    if(stage&&main.contains(stage))return;
    main.classList.add("tfi-module-host");
    stage=document.createElement("div");
    stage.id="tfi-module-stage";
    stage.className="tfi-module-stage";

    fallback=document.createElement("div");
    fallback.className="tfi-module-fallback";
    fallback.setAttribute("aria-label","Previous module while the next module loads");
    Array.from(main.childNodes).forEach(node=>fallback.appendChild(node));
    stage.appendChild(fallback);

    loadingIndicator=document.createElement("div");
    loadingIndicator.className="tfi-module-loading";
    loadingIndicator.setAttribute("role","status");
    loadingIndicator.setAttribute("aria-live","polite");
    loadingIndicator.setAttribute("aria-hidden","true");
    loadingIndicator.innerHTML='<span class="tfi-module-loading-spinner" aria-hidden="true"></span><span data-tfi-loading-label>Opening module…</span>';
    stage.appendChild(loadingIndicator);

    main.replaceChildren(stage);
    updateDiagnostics();
  }

  function pruneCache(){
    if(moduleFrames.size<=MAX_CACHED_MODULES){
      updateDiagnostics();
      return;
    }
    const candidates=Array.from(moduleFrames.entries())
      .filter(([key,frame])=>key!==activeModule&&key!==pendingModule&&frame!==activeFrame)
      .sort((a,b)=>Number(a[1].dataset.lastUsed||0)-Number(b[1].dataset.lastUsed||0));
    while(moduleFrames.size>MAX_CACHED_MODULES&&candidates.length){
      const [key,frame]=candidates.shift();
      moduleFrames.delete(key);
      frame.remove();
    }
    updateDiagnostics();
  }

  function discardPendingIfDifferent(nextModule){
    if(!pendingModule||pendingModule===nextModule)return;
    const oldKey=pendingModule;
    const pendingFrame=moduleFrames.get(oldKey);
    if(pendingFrame&&pendingFrame!==activeFrame&&pendingFrame.dataset.loadedModule!==oldKey){
      moduleFrames.delete(oldKey);
      pendingFrame.remove();
    }
    if(activeFrame&&activeFrame.dataset.loadedModule===oldKey){
      moduleFrames.set(oldKey,activeFrame);
    }
    pendingModule="";
    hideLoading();
    updateDiagnostics();
  }

  function showCachedFrame(frame,module){
    latestRequest++;
    pendingModule="";
    if(activeFrame&&activeFrame!==frame){
      activeFrame.classList.remove("is-active");
      activeFrame.style.display="none";
    }
    moduleFrames.forEach(item=>{
      item.classList.toggle("is-active",item===frame);
      item.style.display=item===frame?"block":"none";
    });
    frame.classList.add("is-active");
    frame.style.display="block";
    activeFrame=frame;
    activeModule=module;
    frame.dataset.lastUsed=String(++usageClock);
    frame.title="TFI "+module+" module";
    if(fallback)fallback.style.display="none";
    hideLoading();
    pruneCache();
  }

  function activateFrame(frame,module,requestId){
    if(!frame)return;
    const expected=String(module||"");
    const request=String(requestId||"");
    if(!expected||request!==String(latestRequest))return;
    if(frame.dataset.requestId!==request||frame.dataset.expectedModule!==expected)return;

    if(activeFrame&&activeFrame!==frame){
      activeFrame.classList.remove("is-active");
      activeFrame.style.display="none";
    }
    moduleFrames.forEach(item=>{
      item.classList.toggle("is-active",item===frame);
      item.style.display=item===frame?"block":"none";
    });
    frame.classList.add("is-active");
    frame.style.display="block";
    activeFrame=frame;
    activeModule=expected;
    pendingModule="";
    frame.dataset.loadedModule=expected;
    frame.dataset.lastUsed=String(++usageClock);
    frame.title="TFI "+expected+" module";

    const replacedId=frame.dataset.replaceFrameId;
    if(replacedId){
      const replaced=document.getElementById(replacedId);
      if(replaced&&replaced!==frame)replaced.remove();
      delete frame.dataset.replaceFrameId;
    }
    if(fallback)fallback.style.display="none";
    hideLoading();
    pruneCache();
  }

  function installModuleWriteWatch(frame){
    try{
      const child=frame.contentWindow;
      if(!child||child.__tfiWriteWatchInstalled)return;
      const originalFetch=child.fetch.bind(child);
      const moduleName=frame.dataset.moduleKey||"";
      child.fetch=async function(input,init){
        const requestMethod=String(init?.method||(input&&typeof input==="object"&&input.method)||"GET").toUpperCase();
        const rawUrl=typeof input==="string"?input:(input&&typeof input==="object"&&input.url)||"";
        const target=new URL(rawUrl,child.location.href);
        const response=await originalFetch(input,init);
        if(response.ok&&requestMethod!=="GET"&&target.origin===window.location.origin&&target.pathname.startsWith("/api/")){
          const detail={type:"TFI_DATA_SAVED",module:moduleName,method:requestMethod,endpoint:target.pathname,savedAt:Date.now()};
          try{child.dispatchEvent(new child.CustomEvent("tfi:data-saved",{detail}));}catch(_error){}
          try{child.parent.postMessage(detail,window.location.origin==="null"?"*":window.location.origin);}catch(_error){}
        }
        return response;
      };
      child.__tfiWriteWatchInstalled=true;
    }catch(_error){}
  }

  function createModuleFrame(page,requestId,routeContext,replacedFrame){
    const frame=document.createElement("iframe");
    const slug=String(page).trim().toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
    frame.id="tfi-module-"+slug+"-"+(++frameSequence);
    frame.className="tfi-module-frame";
    frame.title="Loading TFI "+page+" module";
    frame.setAttribute("allowfullscreen","");
    // The iframe is created only after a user requests the module: on-demand lazy loading.
    frame.setAttribute("loading","eager");
    frame.dataset.moduleKey=page;
    frame.dataset.requestId=String(requestId);
    frame.dataset.expectedModule=String(page);
    frame.dataset.loadedModule="";
    frame.dataset.lastUsed=String(++usageClock);
    if(replacedFrame)frame.dataset.replaceFrameId=replacedFrame.id;
    const savedFrameRoute=routeContext?"":getStoredFrameRoute(page);
    frame.dataset.restoreHref=savedFrameRoute;
    frame.dataset.restoreApplied=savedFrameRoute?"false":"true";
    frame.addEventListener("load",()=>{
      frame.dataset.loadEventSeen="true";
      installModuleWriteWatch(frame);
      let currentHref="";
      try{currentHref=frame.contentWindow.location.href;}catch(_error){}
      const restoreHref=frame.dataset.restoreHref||"";
      if(restoreHref&&frame.dataset.restoreApplied!=="true"&&currentHref&&currentHref!==restoreHref){
        frame.dataset.restoreApplied="true";
        try{frame.contentWindow.location.replace(restoreHref);return;}catch(_error){}
      }
      if(restoreHref&&currentHref===restoreHref)frame.dataset.restoreApplied="true";
      if(currentHref)saveFrameRoute(page,currentHref);
    });
    moduleFrames.set(page,frame);
    stage.appendChild(frame);
    frame.src=embeddedUrl(page,requestId,routeContext);
    updateDiagnostics();
    return frame;
  }

  function mountModule(page,updateHistory,routeContext){
    const main=document.querySelector(".shell > .main, .shell > .main-shell, .shell > .main-content, .app-shell > .main-shell, .main");
    if(!main){window.location.assign(embeddedUrl(page,"",routeContext));return;}
    ensureStage(main);
    const value=String(page||"").trim();
    if(!value)return;

    if(activeModule===value&&activeFrame&&activeFrame.dataset.loadedModule===value&&!routeContext){
      if(updateHistory)writeHistory(value);
      return;
    }
    if(pendingModule===value&&!routeContext){
      if(updateHistory)writeHistory(value);
      return;
    }

    const existing=moduleFrames.get(value);
    if(existing&&existing.dataset.loadedModule===value&&!routeContext){
      discardPendingIfDifferent(value);
      showCachedFrame(existing,value);
      if(updateHistory)writeHistory(value);
      return;
    }

    discardPendingIfDifferent(value);
    const request=++latestRequest;
    pendingModule=value;
    showLoading(value);

    let target=existing;
    if(!target|| (routeContext&&target.dataset.loadedModule===value)){
      target=createModuleFrame(value,request,routeContext,routeContext?existing:null);
    }else{
      target.classList.remove("is-active");
      target.style.display="none";
      target.dataset.requestId=String(request);
      target.dataset.expectedModule=value;
      target.dataset.loadedModule="";
      target.dataset.lastUsed=String(++usageClock);
      target.title="Loading TFI "+value+" module";
      target.src=embeddedUrl(value,request,routeContext);
    }

    if(updateHistory)writeHistory(value,routeContext);
    updateDiagnostics();
  }

  function writeHistory(page,routeContext){
    const url=new URL(window.location.href);
    url.searchParams.set("module",String(page).trim());
    url.searchParams.set("sidebar",sidebarState());
    ["targetModule","targetLabel","sourceWorksheet","sourceSheetId","from"].forEach(name=>url.searchParams.delete(name));
    if(String(page).trim().toLowerCase()==="module import inbox"&&routeContext){
      Object.entries(routeContext).forEach(([name,value])=>{
        if(value!==undefined&&value!==null&&String(value)!=="")url.searchParams.set(name,String(value));
      });
    }
    if(String(page).trim().toLowerCase()==="settings"&&routeContext?.section)url.searchParams.set("section",String(routeContext.section));
    window.history.pushState({tfiModule:String(page).trim(),tfiContext:routeContext||null},"",url.toString());
  }

  function navigate(page,routeContext){
    if(embedded)return;
    const value=String(page||"").trim();
    if(!value)return;
    setActive(value);
    mountModule(value,true,routeContext);
  }

  if(!embedded){
    document.addEventListener("click",function(event){
      const button=event.target.closest(".nav-link[data-page]");
      if(!button||!document.contains(button))return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const current=document.querySelector(".sidebar nav .nav-link.active");
      if(current===button)return;
      navigate(button.dataset.page);
    },true);

    window.addEventListener("message",function(event){
      if(event.data?.type==="TFI_DATA_SAVED"){
        document.body.dataset.tfiDataSaveMessageReceived="true";
        document.body.dataset.tfiDataSaveMessageOrigin=event.origin;
        if(event.origin!==window.location.origin){
          document.body.dataset.tfiDataSaveOriginValid="false";
          return;
        }
        document.body.dataset.tfiDataSaveOriginValid="true";
        const detail={
          type:"TFI_DATA_SAVED",
          module:String(event.data.module||""),
          method:String(event.data.method||"").toUpperCase(),
          endpoint:String(event.data.endpoint||""),
          savedAt:Number(event.data.savedAt)||Date.now()
        };
        window.dispatchEvent(new CustomEvent("tfi:data-saved",{detail}));
        document.querySelectorAll(".tfi-module-frame").forEach(item=>{
          if(item.dataset.moduleKey===detail.module||!item.contentWindow)return;
          try{item.contentWindow.postMessage(detail,window.location.origin==="null"?"*":window.location.origin);}catch(_error){}
        });
        return;
      }
      if(event.data?.type==="TFI_MODULE_READY"){
        const frame=Array.from(moduleFrames.values()).find(item=>item.contentWindow===event.source);
        if(!frame)return;
        activateFrame(frame,event.data.module,event.data.requestId);
        return;
      }
      if(event.data?.type==="TFI_OPEN_SIGNOUT"){
        if(!activeFrame||event.source!==activeFrame.contentWindow)return;
        const profile=document.querySelector(".tfi-profile-trigger");
        const signout=document.querySelector(".tfi-signout-menu-item");
        if(profile&&signout){
          if(profile.getAttribute("aria-expanded")!=="true")profile.click();
          signout.click();
        }
        return;
      }
      if(event.data?.type!=="TFI_NAVIGATE_MODULE")return;
      if(!activeFrame||event.source!==activeFrame.contentWindow)return;
      navigate(event.data.page,event.data.context||null);
    });

    window.addEventListener("popstate",function(){
      const currentParams=new URLSearchParams(window.location.search);
      const page=currentParams.get("module");
      if(page){
        setActive(page);
        const pageKey=page.trim().toLowerCase();
        const routeContext=pageKey==="module import inbox"?{
          targetModule:currentParams.get("targetModule"),
          targetLabel:currentParams.get("targetLabel"),
          sourceWorksheet:currentParams.get("sourceWorksheet"),
          sourceSheetId:currentParams.get("sourceSheetId"),
          from:currentParams.get("from")
        }:pageKey==="settings"&&currentParams.get("section")?{section:currentParams.get("section")}:null;
        mountModule(page,false,routeContext);
      }else window.location.reload();
    });

    const initialModule=params.get("module");
    if(initialModule){
      const initialKey=initialModule.trim().toLowerCase();
      const initialContext=initialKey==="module import inbox"?{
        targetModule:params.get("targetModule"),
        targetLabel:params.get("targetLabel"),
        sourceWorksheet:params.get("sourceWorksheet"),
        sourceSheetId:params.get("sourceSheetId"),
        from:params.get("from")
      }:initialKey==="settings"&&params.get("section")?{section:params.get("section")}:null;
      const start=()=>{setActive(initialModule);mountModule(initialModule,false,initialContext);};
      if(document.readyState==="loading")window.addEventListener("DOMContentLoaded",start,{once:true});
      else start();
    }
  }

  window.TFINavigatePreview=navigate;
  if(embedded){
    const announceReady=()=>window.parent.postMessage({
      type:"TFI_MODULE_READY",
      module:params.get("module")||"",
      requestId:params.get("tfiRequest")||""
    },"*");
    if(document.readyState==="complete")announceReady();
    else window.addEventListener("load",announceReady,{once:true});
  }
})();
