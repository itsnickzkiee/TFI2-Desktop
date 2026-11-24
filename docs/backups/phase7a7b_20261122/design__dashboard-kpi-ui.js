/* TFI KPI Dashboard — navigation and shell interactions only.
   No KPI values, chart series, or production rows are seeded here. */
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

 activateTab("overview",false);
})();
