/* TFI Security & Activity preview — intentionally no seeded accounts or events. */
(function(){
 const $=id=>document.getElementById(id);
 const sessions=[];
 const signIns=[];
 let activeLoginKind='all';
 const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
 const params=new URLSearchParams(window.location.search);
 const isEmbedded=window.self!==window.top||params.get('embedded')==='1';

 function showToast(message){
  const toast=document.createElement('div');
  toast.className='toast';
  toast.setAttribute('role','status');
  toast.textContent=message;
  document.body.appendChild(toast);
  window.setTimeout(()=>toast.remove(),2600);
 }

 function navigateModule(page,file,context){
  if(isEmbedded){
   window.parent.postMessage({type:'TFI_NAVIGATE_MODULE',page,context:context||null},'*');
   return;
  }
  const query=context&&context.section?'?section='+encodeURIComponent(context.section):'';
  window.location.href=file+query;
 }

 function renderSessions(){
  const query=($('session-search').value+' '+$('global-search').value).trim().toLowerCase();
  const status=$('session-filter').value;
  const rows=sessions.filter(session=>{
   const text=[session.account,session.role,session.device,session.ip,session.id].join(' ').toLowerCase();
   return (!query||text.includes(query))&&(status==='all'||session.status.toLowerCase()===status);
  });
  $('active-session-rows').innerHTML=rows.map(session=>'<tr><td>'+esc(session.account)+'</td><td>'+esc(session.role)+'</td><td>'+esc(session.device)+'</td><td>'+esc(session.ip)+'</td><td>'+esc(session.started)+'</td><td>'+esc(session.lastActivity)+'</td><td>'+esc(session.status)+'</td><td><button class="sa-text-link" type="button" disabled>Revoke</button></td></tr>').join('');
  $('active-session-table-wrap').hidden=rows.length===0;
  $('active-session-empty').hidden=rows.length!==0;
  $('active-session-count').textContent=sessions.length?'Showing '+rows.length+' of '+sessions.length+' verified sessions':'No live session records available';
  $('revoke-selected').disabled=true;
  $('metric-active-sessions').textContent='—';
 }

 function renderLoginHistory(){
  const query=($('login-search').value+' '+$('global-search').value).trim().toLowerCase();
  const period=$('login-date-filter').value;
  const now=new Date();
  const rows=signIns.filter(event=>{
   const searchable=[event.account,event.event,event.device,event.ip,event.result].join(' ').toLowerCase();
   if(activeLoginKind!=='all'&&event.kind!==activeLoginKind)return false;
   if(query&&!searchable.includes(query))return false;
   if(period!=='all'){
    const date=new Date(event.iso);
    if(Number.isNaN(date.getTime()))return false;
    if(period==='today'&&date.toDateString()!==now.toDateString())return false;
    if(period!=='today'&&(now-date<0||(now-date)/(1000*60*60*24)>Number(period)))return false;
   }
   return true;
  });
  const emptyText=activeLoginKind==='success'?'No verified successful sign-ins are available yet.':activeLoginKind==='failed'?'No verified failed sign-in attempts are available yet.':'No verified sign-in events are available yet.';
  $('login-history-rows').innerHTML=rows.map(event=>'<tr><td>'+esc(event.date)+' · '+esc(event.time)+'</td><td>'+esc(event.account)+'</td><td>'+esc(event.event)+'</td><td>'+esc(event.device)+'</td><td>'+esc(event.ip)+'</td><td>'+esc(event.result)+'</td></tr>').join('');
  $('login-history-panel').hidden=rows.length===0;
  $('login-history-empty').hidden=rows.length!==0;
  $('login-history-empty').querySelector('strong').textContent=emptyText;
  $('login-history-count').textContent=signIns.length?'Showing '+rows.length+' of '+signIns.length+' sign-in records':'No verified sign-in records available';
  $('metric-success-logins').textContent='—';
  $('metric-failed-logins').textContent='—';
  $('metric-security-events').textContent='—';
 }

 document.querySelectorAll('[data-login-kind]').forEach(button=>{
  button.addEventListener('click',()=>{
   document.querySelectorAll('[data-login-kind]').forEach(tab=>{
    tab.classList.remove('active');
    tab.setAttribute('aria-selected','false');
    tab.tabIndex=-1;
   });
   button.classList.add('active');
   button.setAttribute('aria-selected','true');
   button.tabIndex=0;
   $('login-history-panel').setAttribute('aria-labelledby',button.id);
   activeLoginKind=button.dataset.loginKind;
   renderLoginHistory();
  });
  button.addEventListener('keydown',event=>{
   const tabs=[...document.querySelectorAll('[data-login-kind]')];
   const index=tabs.indexOf(button);
   let next=-1;
   if(event.key==='ArrowRight')next=(index+1)%tabs.length;
   else if(event.key==='ArrowLeft')next=(index-1+tabs.length)%tabs.length;
   else if(event.key==='Home')next=0;
   else if(event.key==='End')next=tabs.length-1;
   if(next<0)return;
   event.preventDefault();
   tabs[next].focus();
   tabs[next].click();
  });
 });

 $('session-search').addEventListener('input',renderSessions);
 $('session-filter').addEventListener('change',renderSessions);
 $('login-search').addEventListener('input',renderLoginHistory);
 $('login-date-filter').addEventListener('change',renderLoginHistory);
 $('global-search').addEventListener('input',()=>{renderSessions();renderLoginHistory()});

 $('refresh-security').addEventListener('click',()=>showToast('Authentication service is not connected. No live security data was refreshed.'));
 $('manage-session-policy').addEventListener('click',()=>navigateModule('Settings','system-settings-preview.html',{section:'session'}));
 $('manage-policy-from-posture').addEventListener('click',()=>navigateModule('Settings','system-settings-preview.html',{section:'session'}));
 $('manage-users').addEventListener('click',()=>navigateModule('Users & Access','users-access-preview.html'));
 $('manage-users-from-posture').addEventListener('click',()=>navigateModule('Users & Access','users-access-preview.html'));
 $('open-audit-from-login').addEventListener('click',()=>navigateModule('Audit Trail','audit-trail-preview.html'));
 $('open-audit-from-failed').addEventListener('click',()=>navigateModule('Audit Trail','audit-trail-preview.html'));
 $('open-audit-from-events').addEventListener('click',()=>navigateModule('Audit Trail','audit-trail-preview.html'));

 renderSessions();
 renderLoginHistory();
})();
