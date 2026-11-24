const fs=require('fs');
const path=require('path');
const dir='C:/Users/Rominick/Desktop/TFI_NEW/design';
const backupSuffix='.pre-security-alert-rules-20261120.bak';
const targets=['dashboard-preview.html','users-access-preview.html','security-activity-preview.html','session-management-preview.html','audit-trail-preview.html','system-settings-preview.html','tfi-preview-router.js'];
for(const name of targets){
 const p=path.join(dir,name), b=p+backupSuffix;
 if(fs.existsSync(p)&&!fs.existsSync(b))fs.copyFileSync(p,b);
}
const navLink='<button class="nav-link" data-page="Security Alert Rules & Notifications"><svg viewBox="0 0 24 24" width="17" height="17"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg><span>Security Alert Rules &amp; Notifications</span></button>';
function addNav(html,active=false){
 const re=/<button class="nav-link(?: active)?" data-page="Security & Activity"[^>]*>[\s\S]*?<\/button>/;
 const m=html.match(re);
 if(!m)throw new Error('Security & Activity nav anchor not found');
 let current=m[0].replace('class="nav-link active"','class="nav-link"').replace(' aria-current="page"','');
 if(html.includes('data-page="Security Alert Rules & Notifications"'))return html;
 let link=navLink;
 if(active)link=link.replace('class="nav-link"','class="nav-link active"').replace('data-page="Security Alert Rules & Notifications">','data-page="Security Alert Rules & Notifications" aria-current="page">');
 return html.replace(m[0],current+link);
}
const basePath=path.join(dir,'security-activity-preview.html');
let base=fs.readFileSync(basePath,'utf8');
let html=addNav(base,true)
 .replace('<title>TFI | Security &amp; Activity</title>','<title>TFI | Security Alert Rules &amp; Notifications</title>')
 .replace('<b>Security &amp; Activity</b>','<b>Security Alert Rules &amp; Notifications</b>')
 .replace('<link rel="stylesheet" href="security-activity.css">','<link rel="stylesheet" href="security-alert-rules.css">')
 .replace('<script src="security-activity-ui.js"></script>','<script src="security-alert-rules-ui.js"></script>');
const content=String.raw`<main class="content">
<div class="heading">
 <div><div class="eyebrow">ADMINISTRATION / SECURITY CONFIGURATION</div><h1>Security Alert Rules &amp; Notifications</h1><p class="subtitle">Define which security events should trigger notifications to authorized administrators.</p></div>
 <div class="heading-actions"><span class="pill">Configuration preview</span><button class="btn outline" id="view-security-activity" type="button">Security &amp; Activity</button><button class="btn primary" id="create-alert-rule" type="button">＋ Create alert rule</button></div>
</div>
<div class="sar-connection-note" role="status"><span class="sar-note-icon">i</span><div><strong>Notification delivery is not connected.</strong> Rules created here remain draft-only in this browser session. No emails, in-app alerts, or external notifications will be sent.</div></div>
<section class="metrics sar-metrics" aria-label="Alert rule overview">
 <article class="metric"><div class="metric-top"><span class="metric-label">Draft rules · this session</span><span class="metric-icon">▤</span></div><div class="metric-value" id="metric-draft-rules">0</div><div class="metric-note">Temporary local drafts only</div></article>
 <article class="metric"><div class="metric-top"><span class="metric-label">Enabled rules</span><span class="metric-icon">✓</span></div><div class="metric-value">—</div><div class="metric-note">Awaiting approved rule service</div></article>
 <article class="metric"><div class="metric-top"><span class="metric-label">Connected channels</span><span class="metric-icon">⌁</span></div><div class="metric-value">—</div><div class="metric-note">Email and in-app delivery unavailable</div></article>
 <article class="metric"><div class="metric-top"><span class="metric-label">Notifications sent</span><span class="metric-icon">↗</span></div><div class="metric-value">—</div><div class="metric-note">Awaiting notification delivery logs</div></article>
</section>
<div class="sar-tabs" role="tablist" aria-label="Security alert configuration sections">
 <button class="sar-tab active" type="button" role="tab" id="tab-rules" aria-selected="true" aria-controls="panel-rules" data-tab="rules">Alert Rules</button>
 <button class="sar-tab" type="button" role="tab" id="tab-channels" aria-selected="false" aria-controls="panel-channels" tabindex="-1" data-tab="channels">Delivery Channels</button>
 <button class="sar-tab" type="button" role="tab" id="tab-history" aria-selected="false" aria-controls="panel-history" tabindex="-1" data-tab="history">Notification History</button>
</div>
<section class="sar-panel" id="panel-rules" role="tabpanel" aria-labelledby="tab-rules">
 <div class="sar-panel-head"><div><h2>Alert Rules</h2><p>Set the conditions, severity, and intended recipients for security notifications.</p></div><span class="sar-status sar-neutral">Draft workspace</span></div>
 <div class="sar-toolbar">
  <input class="sar-input" id="rule-search" type="search" placeholder="Search rule name or trigger..." aria-label="Search alert rules">
  <select class="sar-select" id="rule-category-filter" aria-label="Filter by event category"><option value="all">All categories</option><option value="authentication">Authentication</option><option value="account">Account &amp; access</option><option value="session">Sessions</option><option value="audit">Audit integrity</option></select>
  <select class="sar-select" id="rule-severity-filter" aria-label="Filter by severity"><option value="all">All severities</option><option value="critical">Critical</option><option value="warning">Warning</option><option value="info">Informational</option></select>
 </div>
 <div class="sar-table-wrap"><table class="sar-table"><thead><tr><th>Rule name</th><th>Trigger event</th><th>Severity</th><th>Delivery preference</th><th>Status</th><th>Actions</th></tr></thead><tbody id="rule-rows"></tbody></table></div>
 <div class="sar-empty" id="rules-empty"><span class="sar-empty-icon">♧</span><strong>No alert rules configured</strong><p>Create a draft rule to define the event, severity, and intended notification route. It will not become active in this preview.</p><button class="btn primary" type="button" id="create-first-rule">＋ Create first rule</button></div>
 <div class="sar-panel-foot"><span id="rule-count" aria-live="polite">No alert rules in this session</span><span>Only approved, server-managed rules can become active.</span></div>
</section>
<section class="sar-panel" id="panel-channels" role="tabpanel" aria-labelledby="tab-channels" hidden>
 <div class="sar-panel-head"><div><h2>Delivery Channels</h2><p>Review the notification methods that may be connected after provider and policy approval.</p></div><span class="sar-status sar-neutral">Not connected</span></div>
 <div class="sar-channel-grid">
  <article class="sar-channel-card"><div class="sar-channel-top"><span class="sar-channel-icon">✉</span><span class="sar-status sar-neutral">Not connected</span></div><h3>Email notifications</h3><p>Deliver approved security alerts to authorized administrator email addresses.</p><div class="sar-channel-meta"><span>Provider</span><strong>Not configured</strong></div><div class="sar-channel-meta"><span>Delivery status</span><strong>Unavailable</strong></div><button class="btn outline" type="button" disabled title="Email provider integration is not available in this preview">Configure email</button></article>
  <article class="sar-channel-card"><div class="sar-channel-top"><span class="sar-channel-icon">▣</span><span class="sar-status sar-neutral">Not connected</span></div><h3>In-app notifications</h3><p>Show security alerts inside the TFI application for authorized users.</p><div class="sar-channel-meta"><span>Notification service</span><strong>Not implemented</strong></div><div class="sar-channel-meta"><span>Delivery status</span><strong>Unavailable</strong></div><button class="btn outline" type="button" disabled title="In-app notification service is not available in this preview">Configure in-app</button></article>
 </div>
 <div class="sar-callout"><strong>Connection and approval required.</strong> Provider credentials, recipient permissions, delivery retries, and notification retention must be configured and tested on the trusted backend. This screen does not collect passwords, API keys, or email credentials.</div>
</section>
<section class="sar-panel" id="panel-history" role="tabpanel" aria-labelledby="tab-history" hidden>
 <div class="sar-panel-head"><div><h2>Notification History</h2><p>Review verified alert deliveries, recipients, and delivery outcomes.</p></div><span class="sar-status sar-neutral">No records</span></div>
 <div class="sar-toolbar"><input class="sar-input" id="history-search" type="search" placeholder="Search rule, recipient, or event..." aria-label="Search notification history"><select class="sar-select" id="history-channel-filter" aria-label="Filter by delivery channel"><option value="all">All channels</option><option value="email">Email</option><option value="in-app">In-app</option></select></div>
 <div class="sar-history-table-wrap"><table class="sar-table"><thead><tr><th>Date &amp; time</th><th>Rule</th><th>Security event</th><th>Recipient</th><th>Channel</th><th>Delivery result</th></tr></thead><tbody id="history-rows"></tbody></table></div>
 <div class="sar-empty" id="history-empty"><span class="sar-empty-icon">◷</span><strong>No verified notification history</strong><p>Delivery records will appear here only after a trusted notification service is connected and successfully records an outcome.</p></div>
 <div class="sar-panel-foot"><span>No verified notification deliveries available</span><button class="sar-link" type="button" id="view-audit-trail">Open Audit Trail →</button></div>
</section>
<footer class="sar-footer"><span><strong>TOSEN FOODS, INC.</strong> · Production Management System</span><span>Security Alert Rules &amp; Notifications UI preview · v0.1</span></footer>
</main>
<div class="sar-modal-backdrop" id="rule-modal" aria-hidden="true">
 <section class="sar-modal" role="dialog" aria-modal="true" aria-labelledby="rule-modal-title">
  <div class="sar-modal-head"><div><h2 id="rule-modal-title">Create alert rule</h2><p>Save a local draft for review. This does not activate an alert.</p></div><button class="sar-close" type="button" id="close-rule-modal" aria-label="Close dialog">×</button></div>
  <form id="rule-form">
   <div class="sar-form-grid">
    <div class="sar-field sar-full"><label for="rule-name">Rule name <span>*</span></label><input id="rule-name" name="name" maxlength="80" required placeholder="Enter a clear rule name"></div>
    <div class="sar-field"><label for="rule-category">Event category <span>*</span></label><select id="rule-category" name="category" required><option value="">Select category</option><option value="authentication">Authentication</option><option value="account">Account &amp; access</option><option value="session">Sessions</option><option value="audit">Audit integrity</option></select></div>
    <div class="sar-field"><label for="rule-trigger">Trigger event <span>*</span></label><select id="rule-trigger" name="trigger" required><option value="">Select trigger</option><option value="Failed sign-in attempts exceed threshold">Failed sign-in attempts exceed threshold</option><option value="Repeated failed sign-ins for one account">Repeated failed sign-ins for one account</option><option value="New administrator account created">New administrator account created</option><option value="Role or permission changed">Role or permission changed</option><option value="Account locked or disabled">Account locked or disabled</option><option value="Session revoked">Session revoked</option><option value="Repeated session expiry">Repeated session expiry</option><option value="Audit capture unavailable">Audit capture unavailable</option></select></div>
    <div class="sar-field"><label for="rule-severity">Severity <span>*</span></label><select id="rule-severity" name="severity" required><option value="info">Informational</option><option value="warning">Warning</option><option value="critical">Critical</option></select></div>
    <div class="sar-field"><label for="rule-channel">Preferred channel <span>*</span></label><select id="rule-channel" name="channel" required><option value="in-app">In-app</option><option value="email">Email</option><option value="both">Both channels</option></select></div>
    <div class="sar-field sar-full"><label for="rule-recipients">Intended recipients <span>*</span></label><input id="rule-recipients" name="recipients" maxlength="120" required placeholder="Enter an approved recipient group or role"></div>
    <div class="sar-field"><label for="rule-threshold">Threshold (optional)</label><input id="rule-threshold" name="threshold" type="number" min="1" max="9999" placeholder="Set after policy review"></div>
    <div class="sar-field"><label for="rule-window">Time window in minutes (optional)</label><input id="rule-window" name="window" type="number" min="1" max="10080" placeholder="Set after policy review"></div>
   </div>
   <div class="sar-modal-note">This draft is held in browser memory only and disappears when the page is refreshed or closed. Enabling rules and sending notifications require approved server-side services.</div>
   <div class="sar-modal-actions"><button class="btn outline" type="button" id="cancel-rule">Cancel</button><button class="btn primary" type="submit">Save draft</button></div>
  </form>
 </section>
</div>
<div class="sar-toast" id="sar-toast" role="status" aria-live="polite"></div>`;
html=html.replace(/<main class="content">[\s\S]*?<\/main>/,content);
if(!html.includes('Security Alert Rules &amp; Notifications'))throw new Error('Page build verification failed');
fs.writeFileSync(path.join(dir,'security-alert-rules-preview.html'),html,'utf8');
const routerPath=path.join(dir,'tfi-preview-router.js');
let router=fs.readFileSync(routerPath,'utf8');
const routeLine='    "security & activity":"security-activity-preview.html",';
if(!router.includes('"security alert rules & notifications"')){
 if(!router.includes(routeLine))throw new Error('Router insertion anchor not found');
 router=router.replace(routeLine,routeLine+'\n    "security alert rules & notifications":"security-alert-rules-preview.html",');
 fs.writeFileSync(routerPath,router,'utf8');
}
for(const name of targets.slice(0,6)){
 const p=path.join(dir,name);
 let current=fs.readFileSync(p,'utf8');
 if(!current.includes('data-page="Security Alert Rules & Notifications"')){
  current=addNav(current,false);
  fs.writeFileSync(p,current,'utf8');
 }
}
console.log(JSON.stringify({created:['security-alert-rules-preview.html','security-alert-rules.css','security-alert-rules-ui.js'],navUpdated:targets.slice(0,6),routerUpdated:true,backupsCreated:targets},null,2));