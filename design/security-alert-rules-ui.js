/* TFI Security Alert Rules & Notifications preview — no seeded rules or delivery records. */
(function(){
 const $=id=>document.getElementById(id);
 const drafts=[];
 let editingId=null;
 let nextId=1;
 const categoryLabels={authentication:'Authentication',account:'Account & access',session:'Sessions',audit:'Audit integrity'};
 const severityLabels={info:'Informational',warning:'Warning',critical:'Critical'};
 const channelLabels={'in-app':'In-app',email:'Email',both:'Both channels'};
 const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
 const params=new URLSearchParams(window.location.search);
 const isEmbedded=window.self!==window.top||params.get('embedded')==='1';
 function toast(message){
  const node=$('sar-toast');node.textContent=message;node.classList.add('show');
  window.clearTimeout(toast.timer);toast.timer=window.setTimeout(()=>node.classList.remove('show'),2600);
 }
 function navigateModule(page,file){
  if(isEmbedded){window.parent.postMessage({type:'TFI_NAVIGATE_MODULE',page},'*');return;}
  window.location.href=file;
 }
 function openModal(rule){
  editingId=rule?rule.id:null;
  $('rule-form').reset();
  $('rule-modal-title').textContent=rule?'Edit alert rule draft':'Create alert rule';
  $('rule-name').value=rule?.name||'';
  $('rule-category').value=rule?.category||'';
  $('rule-trigger').value=rule?.trigger||'';
  $('rule-severity').value=rule?.severity||'';
  $('rule-channel').value=rule?.channel||'';
  $('rule-recipients').value=rule?.recipients||'';
  $('rule-threshold').value=rule?.threshold||'';
  $('rule-window').value=rule?.timeWindow||'';
  $('rule-modal').classList.add('open');
  $('rule-modal').setAttribute('aria-hidden','false');
  $('rule-name').focus();
 }
 function closeModal(){
  $('rule-modal').classList.remove('open');
  $('rule-modal').setAttribute('aria-hidden','true');
  editingId=null;
 }
 function renderRules(){
  const query=($('rule-search').value+' '+$('global-search').value).trim().toLowerCase();
  const category=$('rule-category-filter').value;
  const severity=$('rule-severity-filter').value;
  const filtered=drafts.filter(rule=>{
   const searchable=[rule.name,rule.trigger,rule.recipients,categoryLabels[rule.category],severityLabels[rule.severity]].join(' ').toLowerCase();
   return (!query||searchable.includes(query))&&(category==='all'||rule.category===category)&&(severity==='all'||rule.severity===severity);
  });
  $('rule-rows').innerHTML=filtered.map(rule=>'<tr>'+
   '<td><span class="sar-rule-name">'+esc(rule.name)+'</span><span class="sar-rule-meta">'+esc(categoryLabels[rule.category])+'</span></td>'+
   '<td><span class="sar-trigger">'+esc(rule.trigger)+'</span></td>'+
   '<td><span class="sar-severity '+esc(rule.severity)+'">'+esc(severityLabels[rule.severity])+'</span></td>'+
   '<td>'+esc(channelLabels[rule.channel])+'<span class="sar-rule-meta">To: '+esc(rule.recipients)+'</span></td>'+
   '<td><span class="sar-status sar-draft">Draft · session only</span></td>'+
   '<td><button class="sar-action" type="button" data-action="edit" data-id="'+rule.id+'">Edit</button><button class="sar-action discard" type="button" data-action="discard" data-id="'+rule.id+'">Discard</button></td></tr>').join('');
  const hasRows=filtered.length>0;
  document.querySelector('.sar-table-wrap').hidden=!hasRows;
  $('rules-empty').hidden=hasRows;
  $('rules-empty').querySelector('strong').textContent=drafts.length?'No drafts match these filters':'No alert rules configured';
  $('rules-empty').querySelector('p').textContent=drafts.length?'Try changing the category, severity, or search filters.':'Create a draft rule to define the event, severity, and intended notification route. It will not become active in this preview.';
  $('create-first-rule').hidden=drafts.length>0;
  $('metric-draft-rules').textContent=String(drafts.length);
  $('rule-count').textContent=drafts.length?'Showing '+filtered.length+' of '+drafts.length+' local draft rules':'No alert rules in this session';
 }
 function activateTab(name,focus){
  document.querySelectorAll('[data-tab]').forEach(button=>{
   const active=button.dataset.tab===name;
   button.classList.toggle('active',active);
   button.setAttribute('aria-selected',String(active));
   button.tabIndex=active?0:-1;
   if(active&&focus)button.focus();
  });
  ['rules','channels','history'].forEach(key=>{$('panel-'+key).hidden=key!==name;});
 }
 document.querySelectorAll('[data-tab]').forEach(button=>{
  button.addEventListener('click',()=>activateTab(button.dataset.tab,false));
  button.addEventListener('keydown',event=>{
   const tabs=[...document.querySelectorAll('[data-tab]')],index=tabs.indexOf(button);
   let next=-1;
   if(event.key==='ArrowRight')next=(index+1)%tabs.length;
   else if(event.key==='ArrowLeft')next=(index-1+tabs.length)%tabs.length;
   else if(event.key==='Home')next=0;
   else if(event.key==='End')next=tabs.length-1;
   if(next<0)return;
   event.preventDefault();activateTab(tabs[next].dataset.tab,true);
  });
 });
 $('create-alert-rule').addEventListener('click',()=>openModal(null));
 $('create-first-rule').addEventListener('click',()=>openModal(null));
 $('close-rule-modal').addEventListener('click',closeModal);
 $('cancel-rule').addEventListener('click',closeModal);
 $('rule-modal').addEventListener('click',event=>{if(event.target===$('rule-modal'))closeModal();});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&$('rule-modal').classList.contains('open'))closeModal();});
 $('rule-trigger').addEventListener('change',()=>{
  const trigger=$('rule-trigger').value;
  const map={
   'Failed sign-in attempts exceed threshold':'authentication',
   'Repeated failed sign-ins for one account':'authentication',
   'New administrator account created':'account',
   'Role or permission changed':'account',
   'Account locked or disabled':'account',
   'Session revoked':'session',
   'Repeated session expiry':'session',
   'Audit capture unavailable':'audit'
  };
  if(map[trigger])$('rule-category').value=map[trigger];
 });
 $('rule-form').addEventListener('submit',event=>{
  event.preventDefault();
  const form=event.currentTarget;
  if(!form.reportValidity())return;
  const rule={
   id:editingId??nextId++,
   name:$('rule-name').value.trim(),
   category:$('rule-category').value,
   trigger:$('rule-trigger').value,
   severity:$('rule-severity').value,
   channel:$('rule-channel').value,
   recipients:$('rule-recipients').value.trim(),
   threshold:$('rule-threshold').value,
   timeWindow:$('rule-window').value
  };
  if(editingId!==null){
   const index=drafts.findIndex(item=>item.id===editingId);
   if(index>=0)drafts[index]=rule;
   toast('Local alert rule draft updated.');
  }else{
   drafts.push(rule);
   toast('Alert rule saved as a local draft only.');
  }
  closeModal();renderRules();
 });
 $('rule-rows').addEventListener('click',event=>{
  const button=event.target.closest('button[data-action]');
  if(!button)return;
  const id=Number(button.dataset.id),rule=drafts.find(item=>item.id===id);
  if(!rule)return;
  if(button.dataset.action==='edit')openModal(rule);
  if(button.dataset.action==='discard'){
   const index=drafts.findIndex(item=>item.id===id);
   if(index>=0)drafts.splice(index,1);
   renderRules();toast('Local draft discarded.');
  }
 });
 ['rule-search','rule-category-filter','rule-severity-filter','global-search'].forEach(id=>{
  $(id).addEventListener(id==='rule-search'||id==='global-search'?'input':'change',renderRules);
 });
 $('view-security-activity').addEventListener('click',()=>navigateModule('Security & Activity','security-activity-preview.html'));
 $('view-audit-trail').addEventListener('click',()=>navigateModule('Audit Trail','audit-trail-preview.html'));
 $('history-search').addEventListener('input',()=>{});
 $('history-channel-filter').addEventListener('change',()=>{});
 renderRules();
})();