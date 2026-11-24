(function(){
  "use strict";
  const body=document.body;
  const sidebar=document.querySelector(".sidebar");
  const topbar=document.querySelector(".topbar");
  if(!sidebar||!topbar)return;

  const storageKey="tfi-preview-sidebar-collapsed";
  const navScrollKey="tfi-preview-nav-scroll-top";
  let saved=null;
  try{saved=localStorage.getItem(storageKey);}catch(_){}
  const routeState=new URLSearchParams(window.location.search).get("sidebar");
  const collapsed=routeState==="collapsed"||(routeState!=="expanded"&&(saved==="1"||(saved===null&&window.matchMedia("(max-width: 760px)").matches)));
  body.classList.toggle("tfi-sidebar-collapsed",collapsed);

  const toggle=document.createElement("button");
  toggle.type="button";
  toggle.className="sidebar-toggle";
  toggle.setAttribute("aria-controls","tfi-main-navigation");
  toggle.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 5-7 7 7 7"/></svg>';
  const nav=sidebar.querySelector("nav");
  nav?.setAttribute("id","tfi-main-navigation");
  if(nav){
    const spreadsheetLink=Array.from(nav.querySelectorAll(".nav-link[data-page]")).find(link=>link.dataset.page.trim().toLowerCase()==="spreadsheet import");
    const inboxLink=Array.from(nav.querySelectorAll(".nav-link[data-page]")).find(link=>link.dataset.page.trim().toLowerCase()==="module import inbox");
    if(spreadsheetLink&&!inboxLink){
      const link=document.createElement("button");
      link.type="button";
      link.className="nav-link";
      link.dataset.page="Module Import Inbox";
      link.innerHTML='<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path d="M4 4h16v16H4z"/><path d="M4 9h16M9 9v3h6V9"/></svg><span>Module Import Inbox</span>';
      spreadsheetLink.insertAdjacentElement("afterend",link);
    }
    const securityLink=Array.from(nav.querySelectorAll(".nav-link[data-page]")).find(link=>link.dataset.page.trim().toLowerCase()==="security & activity");
    const sessionLink=Array.from(nav.querySelectorAll(".nav-link[data-page]")).find(link=>link.dataset.page.trim().toLowerCase()==="session management");
    if(securityLink&&!sessionLink){
      const link=document.createElement("button");
      link.type="button";
      link.className="nav-link";
      link.dataset.page="Session Management";
      link.innerHTML='<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg><span>Session Management</span>';
      securityLink.insertAdjacentElement("afterend",link);
    }
  }
  document.body.appendChild(toggle);

  function updateSidebar(){
    const isCollapsed=body.classList.contains("tfi-sidebar-collapsed");
    toggle.setAttribute("aria-expanded",String(!isCollapsed));
    toggle.setAttribute("aria-label",isCollapsed?"Expand navigation":"Collapse navigation");
    toggle.title=isCollapsed?"Expand navigation":"Collapse navigation";
    toggle.innerHTML=isCollapsed
      ?'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 5 7 7-7 7"/></svg>'
      :'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 5-7 7 7 7"/></svg>';
    try{localStorage.setItem(storageKey,isCollapsed?"1":"0");}catch(_){}
    try{const url=new URL(window.location.href);url.searchParams.set("sidebar",isCollapsed?"collapsed":"expanded");window.history.replaceState(null,"",url.toString());}catch(_){}
    window.setTimeout(()=>window.dispatchEvent(new Event("resize")),240);
  }
  toggle.addEventListener("click",()=>{body.classList.toggle("tfi-sidebar-collapsed");updateSidebar();});
  updateSidebar();

  const requestedModule=new URLSearchParams(window.location.search).get("module");
  if(requestedModule&&nav){
    const target=Array.from(nav.querySelectorAll(".nav-link[data-page]")).find(link=>link.dataset.page.trim().toLowerCase()===requestedModule.trim().toLowerCase());
    if(target){
      nav.querySelectorAll(".nav-link.active").forEach(link=>{link.classList.remove("active");link.removeAttribute("aria-current");});
      target.classList.add("active");
      target.setAttribute("aria-current","page");
    }
  }
  nav?.querySelectorAll(".nav-link.active").forEach(link=>link.setAttribute("aria-current","page"));

  function restoreNavigationScroll(element,position){
    if(!element||!position)return;
    const exact=Number(position.navScrollTop);
    const legacy=Number(position.navRatio);
    const max=Math.max(0,element.scrollHeight-element.clientHeight);
    const target=Number.isFinite(exact)
      ? Math.min(max,Math.max(0,exact))
      : Number.isFinite(legacy)?Math.round(max*Math.min(1,Math.max(0,legacy))):null;
    if(target===null)return;
    element.style.scrollBehavior="auto";
    element.scrollTop=target;
  }
  try{
    const raw=sessionStorage.getItem(navScrollKey);
    if(raw!==null){
      const position=JSON.parse(raw);
      restoreNavigationScroll(nav,position);
      sessionStorage.removeItem(navScrollKey);
    }
  }catch(_){
    try{sessionStorage.removeItem(navScrollKey);}catch(__){}
  }

  const profile=topbar.querySelector(".profile, .top-profile");
  const profileContainer=profile?.parentElement||null;
  const actions=document.createElement("div");
  actions.className="tfi-topbar-actions";
  if(profile&&profileContainer)profileContainer.insertBefore(actions,profile);
  const fullscreen=document.createElement("button");
  fullscreen.type="button";
  fullscreen.className="tfi-fullscreen-btn";
  fullscreen.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M3 16v3a2 2 0 0 0 2 2h3"/></svg><span>Full screen</span>';
  fullscreen.setAttribute("aria-label","Enter full screen");

  let profileMenu=null,profileDropdown=null,signoutBackdrop=null;
  const closeProfileMenu=()=>{
    if(!profileMenu||!profile)return;
    profileMenu.classList.remove("is-open");
    profile.setAttribute("aria-expanded","false");
    if(profileDropdown)profileDropdown.hidden=true;
  };
  const openProfileMenu=()=>{
    if(!profileMenu||!profile)return;
    profileMenu.classList.add("is-open");
    profile.setAttribute("aria-expanded","true");
    if(profileDropdown)profileDropdown.hidden=false;
  };
  const toggleProfileMenu=()=>{
    if(profile?.getAttribute("aria-expanded")==="true")closeProfileMenu();
    else openProfileMenu();
  };
  const closeSignoutDialog=(restoreFocus=true)=>{
    if(!signoutBackdrop)return;
    signoutBackdrop.hidden=true;
    document.body.classList.remove("tfi-signout-open");
    if(restoreFocus)profile?.focus();
  };
  const openSignoutDialog=()=>{
    closeProfileMenu();
    if(!signoutBackdrop)return;
    signoutBackdrop.hidden=false;
    document.body.classList.add("tfi-signout-open");
    signoutBackdrop.querySelector("[data-tfi-signout-cancel]")?.focus();
  };

  if(profile){
    profileMenu=document.createElement("div");
    profileMenu.className="tfi-profile-menu";
    profile.classList.add("tfi-profile-trigger");
    profile.setAttribute("role","button");
    profile.setAttribute("tabindex","0");
    profile.setAttribute("aria-haspopup","menu");
    profile.setAttribute("aria-expanded","false");
    profile.setAttribute("aria-label","Administrator account menu");
    const chevron=document.createElementNS("http://www.w3.org/2000/svg","svg");
    chevron.setAttribute("viewBox","0 0 24 24");
    chevron.setAttribute("aria-hidden","true");
    chevron.classList.add("tfi-profile-chevron");
    chevron.innerHTML='<path d="m7 10 5 5 5-5"/>';
    profile.appendChild(chevron);

    profileDropdown=document.createElement("div");
    profileDropdown.className="tfi-profile-dropdown";
    profileDropdown.setAttribute("role","menu");
    profileDropdown.hidden=true;
    profileDropdown.innerHTML='<div class="tfi-profile-menu-head"><span>SIGNED IN AS</span><strong>Administrator</strong><small>System Admin</small></div><div class="tfi-profile-menu-divider"></div><button class="tfi-signout-menu-item" type="button" role="menuitem"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 17l5-5-5-5M15 12H3"/><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6"/></svg><span>Sign out</span></button>';
    profileMenu.append(profile,profileDropdown);

    const signoutButton=profileDropdown.querySelector(".tfi-signout-menu-item");
    signoutButton.addEventListener("click",openSignoutDialog);
    profile.addEventListener("click",toggleProfileMenu);
    profile.addEventListener("keydown",event=>{
      if(event.key==="Enter"||event.key===" "){
        event.preventDefault();
        toggleProfileMenu();
      }else if(event.key==="ArrowDown"){
        event.preventDefault();
        openProfileMenu();
        signoutButton.focus();
      }else if(event.key==="Escape"){
        closeProfileMenu();
      }
    });
    signoutButton.addEventListener("keydown",event=>{
      if(event.key==="Escape"){
        event.preventDefault();
        closeProfileMenu();
        profile.focus();
      }
    });
    document.addEventListener("click",event=>{
      if(profileMenu&&!profileMenu.contains(event.target))closeProfileMenu();
    });

    signoutBackdrop=document.createElement("div");
    signoutBackdrop.className="tfi-signout-backdrop";
    signoutBackdrop.hidden=true;
    signoutBackdrop.innerHTML='<section class="tfi-signout-dialog" role="dialog" aria-modal="true" aria-labelledby="tfi-signout-title" aria-describedby="tfi-signout-description"><div class="tfi-signout-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M10 17l5-5-5-5M15 12H3"/><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6"/></svg></div><p class="tfi-signout-eyebrow">ACCOUNT SECURITY</p><h2 id="tfi-signout-title">Sign out of TFI?</h2><p class="tfi-signout-copy" id="tfi-signout-description">Are you sure you want to sign out of the TFI administrator portal? You will return to the sign-in screen.</p><div class="tfi-signout-preview-note"><strong>Preview only.</strong> This action demonstrates the sign-out flow. It does not revoke a real session or change account access.</div><div class="tfi-signout-actions"><button type="button" class="tfi-signout-cancel" data-tfi-signout-cancel>Cancel</button><button type="button" class="tfi-signout-confirm" data-tfi-signout-confirm><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 17l5-5-5-5M15 12H3"/><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6"/></svg>Sign out</button></div></section>';
    document.body.appendChild(signoutBackdrop);
    signoutBackdrop.querySelector("[data-tfi-signout-cancel]")?.addEventListener("click",()=>closeSignoutDialog());
    signoutBackdrop.querySelector("[data-tfi-signout-confirm]")?.addEventListener("click",()=>{
      window.location.assign("sign-out-success-preview.html");
    });
    signoutBackdrop.addEventListener("click",event=>{
      if(event.target===signoutBackdrop)closeSignoutDialog();
    });
    signoutBackdrop.addEventListener("keydown",event=>{
      if(event.key==="Escape"){
        event.preventDefault();
        closeSignoutDialog();
        return;
      }
      if(event.key==="Tab"){
        const controls=Array.from(signoutBackdrop.querySelectorAll("button:not([disabled])"));
        const first=controls[0],last=controls[controls.length-1];
        if(event.shiftKey&&document.activeElement===first){
          event.preventDefault();last.focus();
        }else if(!event.shiftKey&&document.activeElement===last){
          event.preventDefault();first.focus();
        }
      }
    });
    document.addEventListener("keydown",event=>{
      if(event.key==="Escape"&&profile?.getAttribute("aria-expanded")==="true")closeProfileMenu();
    });
    document.body.dataset.tfiSignoutReady="true";
    document.body.dataset.tfiSignoutConnected="false";
  }

  if(profile){actions.append(fullscreen,profileMenu);}
  else{actions.append(fullscreen);topbar.appendChild(actions);}

  function updateFullscreen(){
    const active=!!document.fullscreenElement;
    fullscreen.setAttribute("aria-pressed",String(active));
    fullscreen.setAttribute("aria-label",active?"Exit full screen":"Enter full screen");
    fullscreen.title=active?"Exit full screen":"Full screen";
    fullscreen.innerHTML=(active
      ?'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3v5H3M16 3v5h5M3 16h5v5M21 16h-5v5"/></svg>'
      :'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>')
      +'<span>'+(active?"Exit full screen":"Full screen")+'</span>';
  }
  fullscreen.addEventListener("click",async()=>{
    try{
      if(document.fullscreenElement)await document.exitFullscreen();
      else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen({navigationUI:"hide"});
      else return;
    }catch(error){
      fullscreen.title="Full-screen mode is unavailable in this browser window";
    }
    updateFullscreen();
  });
  document.addEventListener("fullscreenchange",updateFullscreen);
  updateFullscreen();

  document.querySelectorAll(".nav-link[data-page]").forEach(link=>{
    link.title=link.querySelector("span")?.textContent?.trim()||link.dataset.page||"";
  });
  /* TFI_HIDE_REMOTE_EXECUTION_STAMPS: keep remote execution diagnostics out of the rendered preview. */
  (function(){
    const token='[executed on device:';
    const removeFrom=(node)=>{
      if(node.nodeType===Node.TEXT_NODE){
        if((node.nodeValue||'').toLowerCase().includes(token))node.remove();
        return;
      }
      if(node.nodeType!==Node.ELEMENT_NODE&&node.nodeType!==Node.DOCUMENT_FRAGMENT_NODE)return;
      const walker=document.createTreeWalker(node,NodeFilter.SHOW_TEXT);
      const matches=[];
      while(walker.nextNode()){
        const text=walker.currentNode;
        if((text.nodeValue||'').toLowerCase().includes(token))matches.push(text);
      }
      matches.forEach(text=>text.remove());
    };
    removeFrom(document.body);
    const observer=new MutationObserver(records=>records.forEach(record=>record.addedNodes.forEach(removeFrom)));
    observer.observe(document.documentElement,{childList:true,subtree:true});
  })();
})();
