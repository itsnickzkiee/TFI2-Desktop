/* TFI Session Management — preview-only navigation and screen links.
   No live session records or security actions are simulated as real. */
(function(){
  "use strict";
  const params=new URLSearchParams(window.location.search);
  const embedded=window.self!==window.top||params.get("embedded")==="1";

  function navigate(page,context){
    if(embedded){
      window.parent.postMessage({type:"TFI_NAVIGATE_MODULE",page,context:context||null},"*");
      return;
    }
    if(typeof window.TFINavigatePreview==="function"){
      window.TFINavigatePreview(page,context||null);
      return;
    }
    if(page==="Settings"){
      const query=new URLSearchParams({section:context?.section||"session"});
      window.location.href="system-settings-preview.html?"+query.toString();
      return;
    }
    const routes={"Security & Activity":"security-activity-preview.html","Settings":"system-settings-preview.html"};
    if(routes[page])window.location.href=routes[page];
  }

  const bind=(id,handler)=>{
    const element=document.getElementById(id);
    if(element)element.addEventListener("click",handler);
  };

  const openPolicy=()=>navigate("Settings",{section:"session"});
  const openSecurity=()=>navigate("Security & Activity");

  bind("sm-open-policy",openPolicy);
  bind("sm-edit-policy",openPolicy);
  bind("sm-open-security",openSecurity);

  bind("sm-preview-timeout",()=>{window.location.href="session-timeout-preview.html";});
  bind("sm-preview-expired",()=>{window.location.href="session-expired-preview.html";});

  bind("sm-preview-signout",()=>{
    if(embedded){
      window.parent.postMessage({type:"TFI_OPEN_SIGNOUT"},"*");
      return;
    }
    const profile=document.querySelector(".tfi-profile-trigger");
    const signout=document.querySelector(".tfi-signout-menu-item");
    if(profile&&signout){
      if(profile.getAttribute("aria-expanded")!=="true")profile.click();
      signout.click();
    }
  });

  document.body.dataset.tfiSessionManagementReady="true";
  document.body.dataset.tfiSessionManagementConnected="false";
})();
